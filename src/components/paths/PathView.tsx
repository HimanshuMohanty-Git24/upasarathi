"use client";
import { useEffect, useState } from "react";
import type { PathStep } from "@/lib/core/types";
import { AudioButton } from "@/components/verse/AudioButton";
import { CiteChip } from "@/components/verse/Drawer";
import { IconCheck } from "@/components/ui/Icons";
import { useReady } from "@/lib/client/capture";

export interface StepData extends PathStep {
  verse?: { id: string; label: string; up: string; ref: string; sa: string[]; iast: string[]; tr: string; trBy: string; audio: string | null; hasBhashya: boolean };
  concept?: { id: string; iast: string; sa: string; en: string; desc: string };
}

const KIND: Record<PathStep["kind"], string> = { read: "Read", contrast: "Contrast", story: "Story", reflect: "Reflect" };

export function PathView({ pathId, steps }: { pathId: string; steps: StepData[] }) {
  const key = `upasarathi:path:${pathId}`;
  const [done, setDone] = useState<number[]>([]);
  useReady(true);
  useEffect(() => {
    try {
      setDone(JSON.parse(localStorage.getItem(key) || "[]"));
    } catch {
      /* storage unavailable */
    }
  }, [key]);
  const toggle = (i: number) => {
    const next = done.includes(i) ? done.filter((x) => x !== i) : [...done, i];
    setDone(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* keep in memory */
    }
  };
  const pct = Math.round((done.length / steps.length) * 100);

  return (
    <div className="mt-8">
      <div className="sticky top-14 z-10 -mx-4 border-b border-line bg-[color-mix(in_srgb,var(--bg)_92%,transparent)] px-4 py-2 backdrop-blur sm:mx-0 sm:px-0">
        <div className="flex items-center gap-3 text-[12.5px] text-text-3">
          <span className="num">{done.length}/{steps.length} steps</span>
          <span className="bar flex-1"><span style={{ width: `${pct}%`, background: "var(--accent)" }} /></span>
          <span className="flex gap-1">
            {steps.map((_, i) => (
              <a key={i} href={`#step-${i + 1}`} aria-label={`Step ${i + 1}`} className="dot" style={{ background: done.includes(i) ? "var(--accent)" : "var(--line-3)" }} />
            ))}
          </span>
        </div>
      </div>
      <ol className="mt-6 space-y-10">
        {steps.map((s, i) => (
          <li key={i} id={`step-${i + 1}`} className="scroll-mt-28">
            <div className="grid grid-cols-[2.25rem_1fr] gap-x-3">
              <span className={`num mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border text-[13px] ${done.includes(i) ? "border-transparent bg-accent text-[var(--accent-ink)]" : "border-line-2 text-text-3"}`}>
                {done.includes(i) ? <IconCheck size={15} /> : i + 1}
              </span>
              <div className="min-w-0">
                <p className="eyebrow">{KIND[s.kind]}{s.verse ? ` · ${s.verse.label}` : ""}</p>
                <h2 className="mt-1 text-[20px] font-semibold">{s.title}</h2>
                {s.verse && (
                  <div className="card mt-3 p-4">
                    <div className="deva text-[19px]">{s.verse.sa.map((l, k) => <div key={k}>{l}</div>)}</div>
                    <div className="iast mt-1 text-[14px]">{s.verse.iast.map((l, k) => <div key={k}>{l}</div>)}</div>
                    <p className="reading mt-3 text-[16px]">“{s.verse.tr}”</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-text-3">
                      <span>{s.verse.trBy}</span>
                      <CiteChip id={s.verse.id} label={s.verse.hasBhashya ? `${s.verse.label} · with Śaṅkara` : s.verse.label} />
                      <AudioButton src={s.verse.audio} label="Chant" />
                    </div>
                  </div>
                )}
                {s.concept && (
                  <div className="card mt-3 p-4">
                    <p className="text-[18px] font-semibold">{s.concept.iast} <span className="deva text-[17px] font-normal text-text-3">{s.concept.sa}</span></p>
                    <p className="text-[13px] text-text-3">{s.concept.en}</p>
                    <p className="reading mt-2 text-[15.5px]">{s.concept.desc}</p>
                    <div className="mt-2"><CiteChip id={s.concept.id} label="Connections" /></div>
                  </div>
                )}
                <div className="mt-3 rounded-lg border-l-2 border-line-3 pl-3">
                  <p className="text-[11.5px] uppercase tracking-[0.06em] text-text-4">Editorial note · not a translation</p>
                  <p className="mt-0.5 text-[15px] text-text-2">{s.note}</p>
                </div>
                <p className="mt-3 text-[15px]"><span className="font-semibold text-accent">Reflect · </span>{s.prompt}</p>
                <button className="btn btn-sm capture-hide mt-3" onClick={() => toggle(i)} aria-pressed={done.includes(i)}>
                  {done.includes(i) ? "Done" : "Mark as done"}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
