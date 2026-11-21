"use client";
// The dock for speech made on this device: English narration (Kokoro or the browser voice) and the AI chant
// (Vāgdhenu) while it is being made. It takes the chant player's place at the bottom of the screen while active.
import { useEffect } from "react";
import { KOKORO, KOKORO_VOICES, SPEEDS, type KokoroVoice } from "@/lib/tts/config";
import { chant, useChant, type ChantState } from "@/lib/tts/chant";
import { narrator, useNarration, type NarrationState } from "@/lib/tts/narrator";
import { usePrefs } from "@/lib/tts/prefs";
import { AiBadge, IconStop, Progress, fmtMB } from "./TtsBits";
import { IconClose, IconPause, IconPlay } from "@/components/ui/Icons";

export const chantActive = (c: ChantState) => c.phase === "loading" || c.phase === "generating" || c.phase === "done" || c.phase === "error";
export const narrationActive = (n: NarrationState) => n.status === "loading" || n.status === "speaking" || n.status === "error";

/** True while the dock is showing (the chant player hides its own bar meanwhile). */
export function useTtsActive() {
  const n = useNarration();
  const c = useChant();
  return chantActive(c) || narrationActive(n);
}

export function TtsBar() {
  const n = useNarration();
  const c = useChant();
  useEffect(() => {
    const t = setInterval(() => {
      narrator.poll();
      chant.poll();
    }, 400);
    return () => clearInterval(t);
  }, []);
  if (chantActive(c)) return <ChantDock c={c} />;
  if (narrationActive(n)) return <NarrationDock n={n} />;
  return null;
}

function ChantDock({ c }: { c: ChantState }) {
  const making = c.phase === "loading" || c.phase === "generating";
  const status =
    c.phase === "error"
      ? `The AI chant did not work here: ${c.error}`
      : c.phase === "loading"
      ? c.message || "Starting the chant model…"
      : c.phase === "done"
        ? c.message
        : c.held
          ? c.part > 0
            ? `${c.part} of ${c.parts} lines ready · playback starts when it can run without gaps · ${c.message}`
            : c.message || "Making the first line…"
          : c.starved
            ? "Making the next line…"
            : c.message;
  return (
    <div className="player tts-bar capture-hide" role="region" aria-label="AI chant">
      <button
        className="btn btn-accent btn-icon !h-10 !w-10 !rounded-full"
        onClick={() => (c.paused ? chant.resume() : chant.pause())}
        disabled={c.phase === "loading" || c.phase === "error" || c.held}
        aria-label={c.paused ? "Resume" : "Pause"}
      >
        {c.paused || c.held || c.phase === "loading" || c.phase === "error" ? <IconPlay size={15} /> : <IconPause size={16} />}
      </button>
      <div className="tts-main">
        <div className="tts-title">
          <span>{c.label}</span>
          {c.provider && <span className="text-[11px] font-normal text-text-4">{c.provider === "webgpu" ? "WebGPU" : "CPU"} · on this device</span>}
        </div>
        <div className="mt-1"><AiBadge /></div>
        <p className="tts-status" aria-live="polite" title={status} style={c.phase === "error" ? { whiteSpace: "normal" } : undefined}>{status}</p>
        {making && <Progress pct={c.phase === "generating" && c.parts ? Math.max(c.pct, (c.part / c.parts) * 100) : c.pct} label={c.phase === "loading" ? "Model download" : "Chant generation"} />}
      </div>
      {c.held && c.part > 0 && (
        <button className="btn btn-sm" data-tts="play-now" onClick={() => chant.playNow()}>Play what’s ready</button>
      )}
      <button className="btn btn-ghost btn-icon !h-9 !w-9" onClick={() => chant.stop()} aria-label="Stop the AI chant" title={making ? "Stop (abandons this chant)" : "Stop"}>
        <IconStop size={14} />
      </button>
    </div>
  );
}

function NarrationDock({ n }: { n: NarrationState }) {
  const p = usePrefs();
  const label = n.item ? `${n.item.label} · ${n.item.part === "commentary" ? "Śaṅkara’s commentary" : "translation"}` : "";
  const dl = n.download;
  const status =
    n.status === "error"
      ? n.error
      : n.status === "loading"
        ? n.engine === "kokoro"
          ? dl && dl.loaded > 0
            ? `Downloading the voice (once) · ${fmtMB(dl.loaded)} of ${fmtMB(dl.total || KOKORO.modelBytes)}`
            : "Starting the voice…"
          : "Starting…"
        : n.held
          ? `Preparing the narration · ${n.sentence} of ${n.sentences} sentences ready`
          : n.starved
            ? `Preparing the next sentence · ${n.sentence} of ${n.sentences}`
            : n.sentences
              ? `Sentence ${n.sentence} of ${n.sentences}`
              : "";
  const pct = n.status === "loading" && dl ? (dl.loaded / (dl.total || KOKORO.modelBytes)) * 100 : n.sentences ? (n.sentence / n.sentences) * 100 : 0;
  return (
    <div className="player tts-bar capture-hide" role="region" aria-label="Narration">
      <button
        className="btn btn-accent btn-icon !h-10 !w-10 !rounded-full"
        onClick={() => (n.paused ? narrator.resume() : narrator.pause())}
        disabled={n.status !== "speaking"}
        aria-label={n.paused ? "Resume" : "Pause"}
      >
        {n.paused || n.status !== "speaking" ? <IconPlay size={15} /> : <IconPause size={16} />}
      </button>
      <div className="tts-main">
        <div className="tts-title">
          <span>{label}</span>
          <span className="shrink-0 text-[11px] font-normal text-text-4">{n.engine === "kokoro" ? "Kokoro · on this device" : "Browser voice"}</span>
        </div>
        <p className="tts-status" aria-live="polite">{status}</p>
        {n.status !== "error" && <Progress pct={pct} label={n.status === "loading" ? "Voice download" : "Narration"} indeterminate={n.status === "loading" && !dl?.loaded && n.engine === "kokoro"} />}
      </div>
      {n.held && n.sentence > 0 && (
        <button className="btn btn-sm" data-tts="play-now" onClick={() => narrator.playNow()}>Play what’s ready</button>
      )}
      <div className="tts-row !w-auto">
        <div className="seg tts-speed !rounded-[10px] !p-[2px]" role="group" aria-label="Speed">
          {SPEEDS.map((s) => (
            <button key={s} aria-pressed={p.speed === s} onClick={() => narrator.setSpeed(s)} className="!h-7 !px-2 !text-[12px]">{s}×</button>
          ))}
        </div>
        {n.engine === "kokoro" && (
          <select aria-label="Voice" value={p.voice} onChange={(e) => narrator.setVoice(e.target.value as KokoroVoice)}>
            {KOKORO_VOICES.map((v) => (
              <option key={v.id} value={v.id}>{v.label} ({v.note})</option>
            ))}
          </select>
        )}
        <button
          className="btn btn-sm btn-ghost"
          data-tts="switch-engine"
          onClick={() => narrator.switchEngine(n.engine === "kokoro" ? "browser" : "kokoro")}
          title={n.engine === "kokoro" ? "Use the browser’s own voice (instant, no download)" : `Use Kokoro (natural; about ${fmtMB(KOKORO.modelBytes)} once)`}
        >
          {n.engine === "kokoro" ? "Quick Read" : "Natural voice"}
        </button>
      </div>
      <button className="btn btn-ghost btn-icon !h-9 !w-9" onClick={() => narrator.stop()} aria-label="Stop reading">
        {n.status === "error" ? <IconClose size={15} /> : <IconStop size={14} />}
      </button>
    </div>
  );
}
