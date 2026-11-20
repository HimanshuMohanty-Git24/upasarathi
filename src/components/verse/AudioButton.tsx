"use client";
// Per-mantra chant. Renders nothing when a passage has no recording (e.g. Kena 1.6, the prose excerpts).
import { useEffect, useRef, useState } from "react";
import { IconPause, IconPlay } from "@/components/ui/Icons";

export function AudioButton({ src, label = "Chant", className = "" }: { src: string | null | undefined; label?: string; className?: string }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "playing" | "error">("idle");
  useEffect(() => () => ref.current?.pause(), []);
  if (!src) return null;
  const toggle = () => {
    const a = (ref.current ||= new Audio(src));
    a.onplaying = () => setState("playing");
    a.onpause = a.onended = () => setState("idle");
    a.onerror = () => setState("error");
    if (state === "playing") a.pause();
    else {
      setState("loading");
      a.play().catch(() => setState("error"));
    }
  };
  return (
    <button type="button" className={`btn btn-sm ${state === "playing" ? "btn-accent" : ""} ${className}`} onClick={toggle} aria-pressed={state === "playing"} data-audio={src}>
      {state === "playing" ? <IconPause size={14} /> : <IconPlay size={14} />}
      {state === "error" ? "Recording unavailable" : state === "loading" ? "Loading…" : label}
    </button>
  );
}
