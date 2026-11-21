// UpaSārathi · English narration worker (module worker). Kokoro-82M via kokoro-js, q8 ONNX on WASM; the model is
// fetched once from Hugging Face and kept in the browser's Cache API ("transformers-cache"), voices in "kokoro-voices".
// Protocol, in:  {type:"speak", job, text, from, voice, speed} · {type:"config", voice?, speed?} · {type:"cancel"}
//          out: {type:"progress", loaded, total} · {type:"ready"} · {type:"start", job, count, from, chars}
//               {type:"chunk", job, index, text, samples: Float32Array, sr} · {type:"end", job} · {type:"error", job, message}
const LIB = "https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js";
const MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";

let mod = null;
let tts = null;
let loading = null;
let job = 0;
const cfg = { voice: "bm_george", speed: 1 };

function load() {
  return (loading ||= (async () => {
    mod = await import(LIB);
    const files = new Map();
    tts = await mod.KokoroTTS.from_pretrained(MODEL, {
      dtype: "q8",
      device: "wasm",
      progress_callback: (p) => {
        if (p.status !== "progress" || !p.file) return;
        files.set(p.file, { loaded: p.loaded || 0, total: p.total || 0 });
        let loaded = 0;
        let total = 0;
        for (const f of files.values()) {
          loaded += f.loaded;
          total += f.total;
        }
        self.postMessage({ type: "progress", loaded, total, file: p.file });
      },
    });
    self.postMessage({ type: "ready" });
  })());
}

// The model reads at most ~510 phonemes at once; a very long sentence is cut at its clauses.
function pieces(sentence, max = 320) {
  if (sentence.length <= max) return [sentence];
  const out = [];
  let cur = "";
  for (const part of sentence.split(/(?<=[;:,—])\s+/)) {
    if (cur && (cur + " " + part).length > max) {
      out.push(cur);
      cur = part;
    } else cur = cur ? `${cur} ${part}` : part;
  }
  if (cur) out.push(cur);
  return out.flatMap((p) => (p.length <= max * 1.5 ? [p] : p.match(new RegExp(`.{1,${max}}(\\s|$)`, "g")) || [p]));
}

async function speak({ job: my, text, from = 0, voice, speed }) {
  job = my;
  if (voice) cfg.voice = voice;
  if (speed) cfg.speed = speed;
  try {
    await load();
    if (my !== job) return;
    const splitter = new mod.TextSplitterStream();
    splitter.push(text);
    splitter.close();
    const sentences = [...splitter.sentences].flatMap((s) => pieces(s));
    self.postMessage({ type: "start", job: my, count: sentences.length, from, chars: sentences.map((s) => s.length) });
    for (let i = from; i < sentences.length; i++) {
      if (my !== job) return;
      const audio = await tts.generate(sentences[i], { voice: cfg.voice, speed: cfg.speed });
      if (my !== job) return;
      const samples = new Float32Array(audio.audio);
      self.postMessage({ type: "chunk", job: my, index: i, text: sentences[i], samples, sr: audio.sampling_rate }, [samples.buffer]);
    }
    if (my === job) self.postMessage({ type: "end", job: my });
  } catch (e) {
    loading = null;
    self.postMessage({ type: "error", job: my, message: String((e && e.message) || e) });
  }
}

self.onmessage = (e) => {
  const m = e.data || {};
  if (m.type === "speak") speak(m);
  else if (m.type === "config") {
    if (m.voice) cfg.voice = m.voice;
    if (m.speed) cfg.speed = m.speed;
  } else if (m.type === "cancel") job++;
  else if (m.type === "load") load().catch((err) => self.postMessage({ type: "error", job, message: String(err?.message || err) }));
};
