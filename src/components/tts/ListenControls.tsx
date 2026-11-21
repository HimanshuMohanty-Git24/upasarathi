"use client";
// "Listen to translation" / "Listen to commentary": English narration on this device. The first time, the reader picks
// the voice: Kokoro (natural, a one-time ~92 MB download) or Quick Read (the browser's own voice, instant). The choice
// is remembered and can be switched from the dock.
import { useEffect, useState } from "react";
import { KOKORO } from "@/lib/tts/config";
import { narrator, useNarration, type Part } from "@/lib/tts/narrator";
import { inCache, lowMemoryDevice } from "@/lib/tts/prefs";
import { IconSpeaker, fmtMB } from "./TtsBits";
import { IconPause } from "@/components/ui/Icons";

export function ListenControls({ id, label, translation, commentary, className = "" }: { id: string; label: string; translation?: string | null; commentary?: string | null; className?: string }) {
  const n = useNarration();
  if (!translation && !commentary) return null;
  const choosing = n.status === "choose" && n.item?.key === id;
  const parts: [Part, string, string | null | undefined][] = [
    ["translation", "Listen to translation", translation],
    ["commentary", "Listen to commentary", commentary],
  ];
  return (
    <>
      {parts.map(([part, text, body]) => {
        if (!body) return null;
        const mine = n.item?.key === id && n.item.part === part && (n.status === "speaking" || n.status === "loading");
        const playing = mine && !n.paused;
        return (
          <button
            key={part}
            type="button"
            data-tts={`listen-${part}`}
            className={`btn btn-sm ${mine ? "btn-accent" : ""} ${className}`}
            aria-pressed={mine}
            title={part === "commentary" ? "Read Śaṅkara’s commentary aloud, on this device" : "Read the translation aloud, on this device"}
            onClick={() => narrator.request({ key: id, label, part, text: body })}
          >
            {playing ? <IconPause size={14} /> : <IconSpeaker size={14} />} {text}
          </button>
        );
      })}
      {choosing && <VoiceChooser />}
    </>
  );
}

function VoiceChooser() {
  const [cached, setCached] = useState<boolean | null>(null);
  const [low, setLow] = useState(false);
  useEffect(() => {
    void inCache(KOKORO.cacheName, [KOKORO.modelUrl]).then(setCached);
    setLow(lowMemoryDevice());
  }, []);
  return (
    <div className="tts-card" role="dialog" aria-label="Choose a voice">
      <h3>How should it be read?</h3>
      <p>Both voices run on this device. Nothing is sent anywhere, and no key is needed.</p>
      <div className="tts-actions">
        <button type="button" className="tts-choice" data-tts="choose-kokoro" data-recommended={!low ? "1" : undefined} onClick={() => narrator.choose("kokoro")}>
          <b>Natural voice · Kokoro</b>
          <span>{cached ? "Already downloaded in this browser" : `One-time download of about ${fmtMB(KOKORO.modelBytes)}, then it works offline`}</span>
        </button>
        <button type="button" className="tts-choice" data-tts="choose-browser" data-recommended={low ? "1" : undefined} onClick={() => narrator.choose("browser")}>
          <b>Quick Read (Browser Voice)</b>
          <span>Instant, no download; uses your system’s voice{low ? " · recommended on this device" : ""}</span>
        </button>
      </div>
      <div className="mt-2">
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => narrator.stop()}>Not now</button>
      </div>
    </div>
  );
}
