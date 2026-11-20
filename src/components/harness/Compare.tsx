"use client";
// Video-ready comparison: side by side at landscape ratios, stacked at portrait ratios (9:16, 4:5). The product
// itself highlights the flagged phrases and pairs them with a counter-verse, so films never add claims it lacks.
import type { HarnessRun } from "@/lib/core/pipeline";
import type { RunContext } from "./RunView";
import { RichAnswer, type Highlight } from "./RichAnswer";
import { CiteChip } from "@/components/verse/Drawer";
import { useReady } from "@/lib/client/capture";

export function Compare({ run, ctx, counterVerse }: { run: HarnessRun; ctx: RunContext; counterVerse: string | null }) {
  useReady(true);
  const b = run.checks.baseline;
  const flags: Highlight[] = [
    ...b.quotes.filter((q) => !q.found).map((q) => ({ text: q.quote, kind: "flag" as const, title: "Not found in the corpus" })),
    ...(b.flatteryOpener ? [{ text: b.flatteryOpener, kind: "flag" as const }] : []),
    ...b.flatteryPhrases.map((p) => ({ text: p, kind: "flag" as const })),
    ...(b.engagementBait ? [{ text: b.engagementBait, kind: "flag" as const }] : []),
  ];
  const v = counterVerse ? ctx.verses[counterVerse] : null;
  const date = new Date(run.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return (
    <div className="compare mx-auto max-w-[1600px] px-4 py-6 sm:px-8">
      <style>{`
        .compare-grid { display: grid; gap: 20px; grid-template-columns: 1fr 1fr; }
        @media (max-aspect-ratio: 1/1) { .compare-grid { grid-template-columns: 1fr; } }
        .compare .answer { font-size: clamp(15px, 1.25vw, 19px); }
      `}</style>
      <div className="flex flex-wrap items-center gap-2">
        <span className="replay-chip">Replay · recorded run · {run.models.model} · {date}</span>
        <span className="text-[13px] text-text-3">{run.title}</span>
      </div>
      <p className="mt-3 max-w-[1100px] text-[clamp(17px,1.6vw,24px)] leading-snug font-medium">“{run.prompt}”</p>
      <div className="compare-grid mt-5">
        <section className="card pane-preyas p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <p className="eyebrow" style={{ color: "var(--preyas)" }}>Baseline · neutral prompt</p>
            {run.judge.status === "ok" && <span className="num font-semibold text-preyas">{run.judge.totals.baseline}/{run.judge.max}</span>}
          </div>
          <RichAnswer text={run.baseline.text} highlights={flags} />
          {b.unverifiedQuotes > 0 && <p className="mt-3"><span className="stamp">Not found</span> <span className="ml-2 text-[13.5px] text-text-2">in any of the corpus&apos;s {ctx.corpusSize} passages</span></p>}
        </section>
        <section className="card pane-shreyas p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <p className="eyebrow" style={{ color: "var(--accent)" }}>Re-aligned · grounded in the Upanishads</p>
            {run.judge.status === "ok" && <span className="num font-semibold text-accent">{run.judge.totals.realigned}/{run.judge.max}</span>}
          </div>
          <RichAnswer text={run.realigned.text} cites={run.realigned.citations} highlights={run.checks.realigned.englishQuotes.filter((q) => !q.found).map((q) => ({ text: q.quote, kind: "flag" as const, title: "In quotation marks, but not the translation's exact words" }))} />
          {v && counterVerse && (
            <div className="mt-4 rounded-lg border border-line bg-surface-2 p-3">
              <p className="text-[12px] text-text-3">Counter-verse <CiteChip id={counterVerse} label={v.label} /></p>
              <p className="deva mt-1 text-[16px]">{v.text}</p>
              <p className="reading mt-1 text-[14px] text-text-2">“{v.tr}” <span className="text-[12px] text-text-3">({v.trBy})</span></p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
