// English narration of a translation or of Śaṅkara's commentary. Two engines:
//   kokoro   Kokoro-82M in a module worker (public/tts/kokoro-worker.js): about 92 MB downloaded once and cached by the
//            browser; sentences are synthesized one at a time and played as they arrive.
//   browser  the browser's own speechSynthesis: instant, no download, quality depends on the system voices.
// Which engine is asked once and remembered (prefs). One narration at a time, and it shares the speaker with the
// chant player (claimAudio).
import { useSyncExternalStore } from "react";
import { claimAudio, releaseAudio } from "@/lib/client/player";
import { KOKORO, type KokoroVoice, type Speed } from "./config";
import { getPrefs, setPrefs, type Engine } from "./prefs";
import { MAX_HOLD_S, shouldRelease, StreamPlayer } from "./stream-player";
import { speakable, splitSentences } from "./text";

export type Part = "translation" | "commentary";
export interface NarrationItem {
  /** The passage id; with `part` it names what is being read. */
  key: string;
  label: string;
  part: Part;
  text: string;
}
export interface NarrationState {
  status: "idle" | "choose" | "loading" | "speaking" | "error";
  paused: boolean;
  engine: Engine | null;
  item: Omit<NarrationItem, "text"> | null;
  /** Kokoro model download, while it happens. */
  download: { loaded: number; total: number } | null;
  sentence: number;
  sentences: number;
  /** Waiting for the next sentence to be synthesized. */
  starved: boolean;
  /** Kokoro: playback is held until enough is buffered to play through without gaps. */
  held: boolean;
  error: string | null;
}
const IDLE: NarrationState = { status: "idle", paused: false, engine: null, item: null, download: null, sentence: 0, sentences: 0, starved: false, held: false, error: null };
let state: NarrationState = IDLE;
const listeners = new Set<() => void>();
const set = (patch: Partial<NarrationState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
export const useNarration = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => IDLE,
  );

let pending: NarrationItem | null = null;
let currentText = "";
let job = 0;

// ── Kokoro worker ─────────────────────────────────────────────────────────────────────────────────
let worker: Worker | null = null;
let ready = false;
let sp: StreamPlayer | null = null;
// Progress of the current Kokoro job, for the release gate: characters per sentence, characters made, start time.
let gate = { chars: [] as number[], done: 0, total: 0, t0: 0, firstAt: 0 };

function kokoroWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(KOKORO.worker, { type: "module", name: "kokoro" });
  w.onmessage = (e: MessageEvent) => {
    const m = e.data;
    if (m.type === "progress") {
      if (state.status === "loading") set({ download: { loaded: m.loaded, total: m.total || KOKORO.modelBytes } });
      return;
    }
    if (m.type === "ready") {
      ready = true;
      if (state.status === "loading") set({ status: "speaking", download: null });
      return;
    }
    if (m.job !== job) return;
    if (m.type === "start") {
      const chars: number[] = m.chars ?? [];
      gate = { chars, done: 0, total: chars.slice(m.from).reduce((a, b) => a + b, 0), t0: performance.now(), firstAt: 0 };
      set({ sentences: m.count, sentence: m.from, status: "speaking", download: null, held: true });
    } else if (m.type === "chunk") {
      if (!sp) return;
      sp.push(m.samples, m.sr);
      gate.firstAt ||= performance.now();
      gate.done += gate.chars[m.index] ?? 0;
      if (sp.held && shouldRelease({ done: gate.done, total: gate.total, made: sp.made, elapsed: (performance.now() - gate.t0) / 1000 })) sp.release();
      set({ sentence: m.index + 1, starved: false, held: sp.held });
    } else if (m.type === "end") {
      sp?.end();
      set({ held: false });
    }
    else if (m.type === "error") fail(m.message);
  };
  w.onerror = (e) => fail(e.message || "The voice model could not start in this browser.");
  worker = w;
  return w;
}

function speakKokoro(text: string, from: number) {
  const p = getPrefs();
  sp?.stop();
  const player = new StreamPlayer({ hold: true });
  sp = player;
  player.onDone = () => {
    if (sp === player) done();
  };
  const w = kokoroWorker();
  set({ status: ready ? "speaking" : "loading", download: ready ? null : { loaded: 0, total: KOKORO.modelBytes } });
  w.postMessage({ type: "speak", job, text, from, voice: p.voice, speed: p.speed });
}

// ── the browser's own voice ───────────────────────────────────────────────────────────────────────
let sentences: string[] = [];
function pickVoice(): SpeechSynthesisVoice | null {
  const vs = speechSynthesis.getVoices().filter((v) => /^en(-|_|$)/i.test(v.lang));
  return vs.find((v) => /en-IN/i.test(v.lang) && v.localService) || vs.find((v) => /en-GB/i.test(v.lang) && v.localService) || vs.find((v) => v.localService) || vs[0] || null;
}
function speakBrowser(text: string, from: number) {
  if (typeof speechSynthesis === "undefined") return fail("This browser has no built-in voice.");
  speechSynthesis.cancel();
  sentences = splitSentences(text);
  set({ status: "speaking", sentences: sentences.length, sentence: from, download: null });
  const my = job;
  const say = (i: number) => {
    if (my !== job) return;
    if (i >= sentences.length) return done();
    const u = new SpeechSynthesisUtterance(sentences[i]);
    u.rate = getPrefs().speed;
    u.lang = "en-GB";
    const v = pickVoice();
    if (v) u.voice = v;
    u.onstart = () => my === job && set({ sentence: i + 1 });
    u.onend = () => say(i + 1);
    u.onerror = (ev) => {
      if (my !== job || ev.error === "interrupted" || ev.error === "canceled") return;
      fail(`The browser voice stopped (${ev.error}).`);
    };
    speechSynthesis.speak(u);
  };
  say(from);
}

// ── control ───────────────────────────────────────────────────────────────────────────────────────
function begin(item: NarrationItem, engine: Engine, from = 0) {
  job++;
  pending = null;
  currentText = speakable(item.text);
  const { text: _t, ...meta } = item;
  set({ ...IDLE, status: "loading", engine, item: meta });
  claimAudio("narrator", () => narrator.stop());
  if (!currentText) return fail("There is nothing here to read aloud.");
  if (engine === "kokoro") speakKokoro(currentText, from);
  else speakBrowser(currentText, from);
}
function done() {
  releaseAudio("narrator");
  sp = null;
  set({ ...IDLE });
}
function fail(error: string) {
  job++;
  sp?.stop();
  sp = null;
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  releaseAudio("narrator");
  set({ status: "error", error, paused: false, download: null });
}

export const narrator = {
  get: () => state,
  /** Read something aloud; asks for an engine the first time. Call it from a click (audio needs a user gesture). */
  request(item: NarrationItem) {
    const cur = state.item;
    if (cur && cur.key === item.key && cur.part === item.part && (state.status === "speaking" || state.status === "loading")) {
      if (state.paused) narrator.resume();
      else narrator.pause();
      return;
    }
    const engine = getPrefs().engine;
    if (!engine) {
      job++;
      pending = item;
      const { text: _t, ...meta } = item;
      set({ ...IDLE, status: "choose", item: meta });
      return;
    }
    begin(item, engine);
  },
  /** The answer to "which voice?": remembered, then the pending text is read. */
  choose(engine: Engine) {
    setPrefs({ engine });
    if (pending) begin(pending, engine);
  },
  /** Switch engine mid-way: continues from the current sentence. */
  switchEngine(engine: Engine) {
    setPrefs({ engine });
    if (!state.item || state.status === "idle" || state.status === "choose") return;
    const item: NarrationItem = { ...state.item, text: currentText };
    begin(item, engine, engine === state.engine ? Math.max(0, state.sentence - 1) : 0);
  },
  /** Start hearing what is ready now, accepting pauses while the rest is made. */
  playNow() {
    sp?.release();
    set({ held: false });
  },
  pause() {
    if (state.engine === "kokoro") sp?.pause();
    else if (typeof speechSynthesis !== "undefined") speechSynthesis.pause();
    set({ paused: true });
  },
  resume() {
    if (state.engine === "kokoro") sp?.resume();
    else if (typeof speechSynthesis !== "undefined") speechSynthesis.resume();
    claimAudio("narrator", () => narrator.stop());
    set({ paused: false });
  },
  stop() {
    job++;
    pending = null;
    sp?.stop();
    sp = null;
    worker?.postMessage({ type: "cancel" });
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    releaseAudio("narrator");
    set({ ...IDLE });
  },
  setSpeed(speed: Speed) {
    setPrefs({ speed });
    worker?.postMessage({ type: "config", speed });
  },
  setVoice(voice: KokoroVoice) {
    setPrefs({ voice });
    worker?.postMessage({ type: "config", voice });
  },
  /** Starved = everything made so far has been heard; the UI says "preparing the next sentence". */
  poll() {
    if (sp?.held && gate.firstAt && (performance.now() - gate.firstAt) / 1000 > MAX_HOLD_S) {
      sp.release();
      set({ held: false });
    }
    if (sp && state.status === "speaking" && !state.paused) {
      const starved = sp.starved;
      if (starved !== state.starved) set({ starved });
    }
  },
  /** For tests and the download notice: is the Kokoro model already in this browser? */
  modelUrl: KOKORO.modelUrl,
};
