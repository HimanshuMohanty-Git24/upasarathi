"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { HarnessRun } from "@/lib/core/pipeline";
import type { GNode, Rubric } from "@/lib/core/types";
import type { Side } from "@/lib/core/judge";
import { RichAnswer, type Highlight } from "./RichAnswer";
import { MiniGraph } from "@/components/graph/MiniGraph";
import { CiteChip, useDrawer } from "@/components/verse/Drawer";
import { AudioButton } from "@/components/verse/AudioButton";
import { markReplayDone, readPace, type Pace } from "@/lib/client/capture";
import { IconAlert, IconCheck, IconReplay } from "@/components/ui/Icons";

export interface VerseInfo {
  label: string;
  tr: string;
  trBy: string;
  audio: string | null;
  text: string;
}
export interface RunContext {
  nodes: Record<string, GNode>;
  verses: Record<string, VerseInfo>;
  axes: Rubric["axes"];
  corpusSize: number;
}

const FACTOR: Record<Pace, number> = { realtime: 1, fast: 0.3, instant: 0 };

/** Beat timeline for a recorded run: 0 prompt · 1 baseline types · 2 stamp/checks · 3 diagnosis · 4 re-aligned types · 5 scorecard. */
function useReplay(run: HarnessRun, mode: "replay" | "live" | "static", pace: Pace, epoch: number) {
  const f = FACTOR[pace];
  const plan = useMemo(() => {
    const bDur = Math.min(Math.max(run.baseline.ms || run.baseline.text.length * 6, 900), 9000) * f;
    const rDur = Math.min(Math.max(run.realigned.text.length * 9, 1600), 11000) * f;
    const b0 = 500 * f, b1 = b0 + bDur, stamp = b1 + 600 * f, diag = stamp + 900 * f, r0 = diag + 700 * f, r1 = r0 + rDur, score = r1 + 500 * f;
    return { b0, b1, stamp, diag, r0, r1, score };
  }, [run, f]);
  const [t, setT] = useState(mode === "replay" && f > 0 ? 0 : Infinity);
  useEffect(() => {
    if (mode !== "replay" || f === 0) {
      setT(Infinity);
      if (mode === "replay") markReplayDone();
      return;
    }
    setT(0);
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      const el = performance.now() - start;
      setT(el);
      if (el < plan.score + 50) raf = requestAnimationFrame(tick);
      else markReplayDone();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode, f, plan, epoch]);
  const frac = (a: number, b: number) => (t >= b ? 1 : t <= a ? 0 : (t - a) / Math.max(1, b - a));
  return {
    bChars: Math.round(run.baseline.text.length * frac(plan.b0, plan.b1)),
    rChars: Math.round(run.realigned.text.length * frac(plan.r0, plan.r1)),
    beat: t >= plan.score ? 5 : t >= plan.r0 ? 4 : t >= plan.diag ? 3 : t >= plan.stamp ? 2 : t >= plan.b0 ? 1 : 0,
  };
}

export function RunView({ run, ctx, mode = "replay", layout = "full", initialPace }: { run: HarnessRun; ctx: RunContext; mode?: "replay" | "live" | "static"; layout?: "hero" | "full"; initialPace?: Pace }) {
  const [pace, setPace] = useState<Pace>(initialPace ?? "realtime");
  const [epoch, setEpoch] = useState(0);
  const read = useRef(false);
  useEffect(() => {
    if (read.current || initialPace) return;
    read.current = true;
    setPace(readPace("realtime"));
  }, [initialPace]);
  const { bChars, rChars, beat } = useReplay(run, mode, pace, epoch);
  const live = mode === "live";
  const showB = live || mode === "static" ? run.baseline.text : run.baseline.text.slice(0, bChars);
  const showR = live || mode === "static" ? run.realigned.text : run.realigned.text.slice(0, rChars);
  const beatOk = (n: number) => live || mode === "static" || beat >= n;
  const typingB = mode === "replay" && beat === 1;
  const typingR = mode === "replay" && beat === 4;

  const highlight = useMemo(() => new Set(beatOk(3) ? run.diagnosis.subgraph.nodes : []), [run, beat, live, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  const date = new Date(run.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  const head = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="replay-chip" data-live={live ? "1" : "0"}>{live ? "Live" : "Replay"} · {live ? run.models.model : `Recorded run · ${run.models.model} · ${date}`}</span>
      {run.models.sameJudge && <span className="chip chip-preyas" title="The judge is the same model as the one being judged">Same-model judge</span>}
      {mode === "replay" && (
        <div className="capture-hide ml-auto flex items-center gap-1">
          {(["realtime", "fast", "instant"] as Pace[]).map((p) => (
            <button key={p} className={`btn btn-sm ${pace === p ? "btn-accent" : "btn-ghost"}`} onClick={() => { setPace(p); setEpoch((e) => e + 1); }}>{p[0].toUpperCase() + p.slice(1)}</button>
          ))}
          <button className="btn btn-sm btn-ghost" onClick={() => setEpoch((e) => e + 1)} aria-label="Replay"><IconReplay size={14} /></button>
        </div>
      )}
    </div>
  );

  const prompt = (
    <div className="card-soft p-4">
      <p className="eyebrow">The request{run.sharpened ? " · sharpened red-team prompt" : ""}{run.control ? " · control" : ""}</p>
      <p className="mt-1.5 text-[15.5px] leading-relaxed">{run.prompt}</p>
    </div>
  );

  const baselinePane = (
    <section className="card pane-preyas p-4" aria-label="Baseline answer">
      <PaneHead side="baseline" run={run} />
      {run.baseline.error ? <StageError e={run.baseline.error} /> : <RichAnswer text={showB} highlights={baselineHighlights(run)} caret={typingB || (live && !run.baseline.text)} />}
      {beatOk(2) && <Stamp run={run} ctx={ctx} />}
      {run.baseline.provenance && beatOk(2) && <p className="mt-3 text-[12px] text-text-3">{run.baseline.provenance}</p>}
    </section>
  );
  const realignedPane = (
    <section className="card pane-shreyas p-4" aria-label="Re-aligned answer">
      <PaneHead side="realigned" run={run} />
      {run.realigned.error ? <StageError e={run.realigned.error} /> : beatOk(4) || live ? <RichAnswer text={showR} cites={run.realigned.citations} highlights={realignedHighlights(run)} caret={typingR || (live && !run.realigned.text)} /> : <p className="muted text-[14px]">Waiting for the diagnosis…</p>}
      {beatOk(5) && (run.realigned.stripped.length > 0 || run.realigned.repaired) && (
        <p className="mt-3 text-[12px] text-text-3">
          {run.realigned.repaired ? "Failed the first citation audit and was repaired once. " : ""}
          {run.realigned.stripped.length ? `${run.realigned.stripped.length} citation(s) outside the evidence packet were removed.` : ""}
        </p>
      )}
    </section>
  );
  const diagnosisPane = <DiagnosisPane run={run} ctx={ctx} visible={beatOk(3)} highlight={highlight} compact={layout === "hero"} />;

  if (layout === "hero") {
    return (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          {head}
          {prompt}
          {baselinePane}
          {realignedPane}
        </div>
        <div className="space-y-3 lg:pt-10">
          {diagnosisPane}
          {beatOk(5) && <Scorecard run={run} ctx={ctx} compact />}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {head}
      {prompt}
      <div className="grid gap-4 xl:grid-cols-3">
        {baselinePane}
        {diagnosisPane}
        {realignedPane}
      </div>
      {beatOk(5) && <Scorecard run={run} ctx={ctx} />}
      {beatOk(5) && <ChecksPanel run={run} />}
      {beatOk(5) && run.diagnosis.packet && (
        <details className="card p-4">
          <summary className="font-semibold">What the re-aligned model saw <span className="text-[12.5px] font-normal text-text-3">· the evidence packet, verbatim</span></summary>
          <pre className="mt-3 max-h-[50vh] overflow-auto whitespace-pre-wrap text-[12.5px] leading-relaxed text-text-2">{run.diagnosis.packet}</pre>
        </details>
      )}
    </div>
  );
}

function PaneHead({ side, run }: { side: Side; run: HarnessRun }) {
  const s = run[side];
  return (
    <div className="mb-3 flex items-baseline justify-between gap-2">
      <div>
        <p className="eyebrow" style={{ color: side === "baseline" ? "var(--preyas)" : "var(--accent)" }}>{side === "baseline" ? "Baseline" : "Re-aligned · UpaSārathi"}</p>
        <p className="text-[12px] text-text-3">{side === "baseline" ? `${s.model} · “You are a helpful assistant.”` : `${s.model} · grounded in the evidence packet`}</p>
      </div>
      {run.judge.status === "ok" && (
        <span className="num text-[13px] font-semibold" style={{ color: side === "baseline" ? "var(--preyas)" : "var(--accent)" }}>
          {run.judge.totals[side]}/{run.judge.max}
        </span>
      )}
    </div>
  );
}

function StageError({ e }: { e: { code: string; message: string } }) {
  return (
    <div className="flex gap-2 rounded-lg border border-line-2 bg-surface-2 p-3 text-[13.5px]">
      <IconAlert size={16} className="mt-0.5 text-preyas" />
      <div><b className="font-semibold">{e.code}</b> · {e.message}</div>
    </div>
  );
}

function baselineHighlights(run: HarnessRun): Highlight[] {
  const c = run.checks.baseline;
  const hs: Highlight[] = [];
  for (const q of c.quotes) if (!q.found) hs.push({ text: q.quote, kind: "flag", title: "Not found anywhere in the corpus" });
  for (const r of c.claimedRefs) if (!r.id || c.unverifiedQuotes) hs.push({ text: r.raw, kind: "flag", title: "Claimed reference" });
  if (c.flatteryOpener) hs.push({ text: c.flatteryOpener, kind: "flag", title: "Flattering opener" });
  for (const p of c.flatteryPhrases) hs.push({ text: p, kind: "flag", title: "Flattery" });
  if (c.engagementBait) hs.push({ text: c.engagementBait, kind: "flag", title: "Engagement bait" });
  for (const s of c.unsupportedClaims ?? []) hs.push({ text: s.slice(0, 60), kind: "flag", title: "Statistic or research claim that nothing here can verify" });
  return hs;
}
function realignedHighlights(run: HarnessRun): Highlight[] {
  const c = run.checks.realigned;
  return [
    ...c.quotes.map((q) => ({ text: q.quote, kind: q.found ? ("ok" as const) : ("flag" as const), title: q.found ? `Verified: ${q.found}` : "Not found in the corpus" })),
    ...c.englishQuotes.filter((q) => !q.found).map((q) => ({ text: q.quote, kind: "flag" as const, title: "In quotation marks, but not the translation's exact words" })),
  ];
}

function Stamp({ run, ctx }: { run: HarnessRun; ctx: RunContext }) {
  const c = run.checks.baseline;
  const bad = c.quotes.filter((q) => !q.found);
  if (!bad.length) return null;
  const ref = c.claimedRefs[0];
  const textName = ref ? ctx.nodes[`up:${ref.text}`]?.label : null;
  const actual = ref?.id ? ctx.verses[ref.id] : null;
  return (
    <div className="reveal mt-4 rounded-xl border border-line-2 bg-surface-2 p-4">
      <span className="stamp">Not found</span>
      <p className="mt-3 text-[14px] leading-relaxed">
        {bad.length === 1 ? "This Sanskrit does" : `These ${bad.length} quotations do`} not occur {textName ? <>in the {textName} Upaniṣad it cites, or </> : null}anywhere in this corpus&apos;s {ctx.corpusSize} passages.
      </p>
      {ref && actual && (
        <div className="mt-3 border-t border-line pt-3 text-[13.5px]">
          <p className="text-text-2">
            {textName} “{ref.ref}”{ref.continuous ? <> is <CiteChip id={ref.id!} label={actual.label} /> in adhyāya-vallī numbering</> : <> is <CiteChip id={ref.id!} label={actual.label} /></>}. It actually reads:
          </p>
          <p className="deva mt-1 text-[16px]">{actual.text}</p>
          <p className="reading mt-1 text-[14.5px] text-text-2">“{actual.tr}” <span className="text-[12px] text-text-3">({actual.trBy})</span></p>
        </div>
      )}
    </div>
  );
}

function DiagnosisPane({ run, ctx, visible, highlight, compact }: { run: HarnessRun; ctx: RunContext; visible: boolean; highlight: Set<string>; compact: boolean }) {
  const d = run.diagnosis;
  const { open } = useDrawer();
  const top = d.dilemmas[0] ? ctx.nodes[`dilemma:${d.dilemmas[0].id}`] : null;
  // The hero preview shows a tight, readable core (≤ 8 nodes); the full run page shows the whole subgraph.
  const core = compact
    ? new Set([...(top ? [top.id] : []), ...d.concepts.slice(0, 2).map((c) => c.id), ...d.verses.slice(0, 4).map((v) => v.id), ...d.stories.slice(0, 1).map((s) => s.id)])
    : new Set(d.subgraph.nodes);
  const nodes = d.subgraph.nodes.filter((id) => core.has(id)).map((id) => ctx.nodes[id]).filter(Boolean);
  const edges = d.subgraph.edges.filter((e) => core.has(e.s) && core.has(e.t));
  return (
    <section className="card p-4" aria-label="Diagnosis">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="eyebrow">Diagnosis · the knowledge graph</p>
        <span className={`chip ${d.status === "SUPPORTED" ? "chip-accent" : ""}`}>{d.status.replace("_", " ").toLowerCase()} · {d.ms} ms</span>
      </div>
      {!visible ? (
        <p className="muted text-[14px]">Tracing the request through the graph…</p>
      ) : (
        <div className="reveal space-y-3">
          {top && (
            <div>
              <p className="text-[12px] text-text-3">The request reads, tentatively, as</p>
              <button className="text-left text-[16px] font-semibold hover:underline" onClick={() => open(top.id)}>{top.label}</button>
            </div>
          )}
          {d.pressures.length > 0 && <div className="flex flex-wrap gap-1.5">{d.pressures.map((p) => <span key={p.id} className="chip chip-preyas" title={`“${p.cue}”`}>{p.label}</span>)}</div>}
          {d.preyas && (
            <div className="grid gap-1.5 text-[13.5px]">
              <p><span className="font-semibold text-preyas">Preyas · </span>{d.preyas}</p>
              <p><span className="font-semibold text-accent">Śreyas · </span>{d.shreyas}</p>
            </div>
          )}
          {nodes.length > 0 && (
            <div className="-mx-1 rounded-lg border border-line">
              <MiniGraph nodes={nodes} edges={edges} highlight={highlight} onPick={open} height={compact ? 320 : 300} />
            </div>
          )}
          {d.status === "INSUFFICIENT_EVIDENCE" && <p className="text-[13.5px] text-text-2">The Upanishads in this corpus do not speak directly to this request, so the re-aligned answer cites nothing.</p>}
          {d.verses.length > 0 && !compact && (
            <div className="flex flex-wrap gap-1.5">
              {d.verses.map((v) => <CiteChip key={v.id} id={v.id} label={ctx.verses[v.id]?.label ?? v.id} />)}
            </div>
          )}
          {compact && d.verses[0] && ctx.verses[d.verses[0].id] && <KeyVerse id={d.verses.find((v) => v.id === "KaU_1.1.27")?.id ?? d.verses[0].id} ctx={ctx} />}
        </div>
      )}
    </section>
  );
}

function KeyVerse({ id, ctx }: { id: string; ctx: RunContext }) {
  const v = ctx.verses[id];
  return (
    <div className="rounded-lg border border-line bg-surface-2 p-3">
      <div className="flex items-center justify-between gap-2"><CiteChip id={id} label={v.label} /><AudioButton src={v.audio} label="Hear it chanted" /></div>
      <p className="deva mt-2 text-[16px]">{v.text}</p>
      <p className="reading mt-1 text-[14px] text-text-2">“{v.tr}”</p>
    </div>
  );
}

function Scorecard({ run, ctx, compact = false }: { run: HarnessRun; ctx: RunContext; compact?: boolean }) {
  const j = run.judge;
  if (j.status !== "ok")
    return (
      <section className="card p-4">
        <p className="eyebrow">Blind judge</p>
        <p className="mt-2 text-[14px] text-text-2">{j.status === "unavailable" ? `Judge unavailable: ${j.error}. No scores are shown rather than invented ones.` : j.error || "Not scored."}</p>
      </section>
    );
  return (
    <section className="card reveal p-4" aria-label="Scorecard">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="eyebrow">Blind judge · {j.model}{j.sameModel ? " (same model)" : ""}</p>
        <p className="num text-[13px]"><span className="text-preyas">Baseline {j.totals.baseline}</span> · <span className="text-accent">Re-aligned {j.totals.realigned}</span> <span className="text-text-3">/ {j.max} on {j.comparableAxes} axes</span></p>
      </div>
      <div className="mt-3 space-y-2.5">
        {ctx.axes.map((ax) => {
          const s = j.scores[ax.id];
          if (!s) return null;
          return (
            <details key={ax.id} className="group">
              <summary className="grid grid-cols-[6.5rem_1fr] items-center gap-3">
                <span className="text-[13px] font-semibold">{ax.label}<span className="block text-[11px] font-normal text-text-3">{ax.en}</span></span>
                <span className="grid gap-1">
                  <Bar v={s.baseline.score} color="var(--preyas)" />
                  <Bar v={s.realigned.score} color="var(--accent)" />
                </span>
              </summary>
              {!compact && (
                <div className="mt-2 grid gap-2 pl-[7.25rem] text-[12.5px] text-text-2 sm:grid-cols-2">
                  <Evidence side="Baseline" s={s.baseline} />
                  <Evidence side="Re-aligned" s={s.realigned} />
                </div>
              )}
            </details>
          );
        })}
      </div>
      {!compact && j.summary && (
        <p className="mt-3 text-[13px] text-text-2">
          “{j.summary.replace(/\bResponse ([AB])\b/g, (_m, l: string) => `the ${j.order[l === "A" ? 0 : 1] === "baseline" ? "baseline" : "re-aligned"} answer`)}”
          {j.verdictDerived ? <span className="text-text-3"> (verdict derived from the totals; the judge gave none)</span> : null}
        </p>
      )}
      <p className="mt-2 text-[12px] text-text-3">
        Answers shown to the judge as A and B in random order. Every score must quote its answer verbatim; {j.rejectedEvidence ? `${j.rejectedEvidence} score(s) failed that check and are not counted.` : "all evidence was found."}
      </p>
    </section>
  );
}
function Bar({ v, color }: { v: number | null; color: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="bar flex-1"><span style={{ width: `${((v ?? 0) / 4) * 100}%`, background: v === null ? "var(--line-3)" : color }} /></span>
      <span className="num w-7 text-right text-[12px] text-text-3">{v === null ? "–" : `${v}/4`}</span>
    </span>
  );
}
function Evidence({ side, s }: { side: string; s: { score: number | null; evidence: string; verified: boolean } }) {
  return (
    <p>
      <span className="font-semibold">{side}:</span> {s.verified ? <IconCheck size={12} className="inline text-accent" /> : <span className="text-preyas">evidence not found · </span>}
      <span className="italic">“{s.evidence}”</span>
    </p>
  );
}

function ChecksPanel({ run }: { run: HarnessRun }) {
  const rows = (side: Side) => {
    const c = run.checks[side];
    const out: { ok: boolean; text: string }[] = [];
    if (c.empty) out.push({ ok: false, text: "Empty answer" });
    for (const q of c.quotes) out.push({ ok: Boolean(q.found), text: `${q.script === "devanagari" ? "Sanskrit" : "IAST"} “${q.quote.slice(0, 60)}${q.quote.length > 60 ? "…" : ""}”: ${q.found ? `found (${q.found.replace("_", " ")})` : "not found in the corpus"}` });
    for (const q of c.englishQuotes) out.push({ ok: Boolean(q.found), text: `Quotation “${q.quote.slice(0, 60)}${q.quote.length > 60 ? "…" : ""}”: ${q.found ? `matches the translation of ${q.found.replace("_", " ")}` : "not in any corpus translation"}` });
    for (const r of c.claimedRefs) out.push({ ok: Boolean(r.id) && !c.unverifiedQuotes, text: `Cites ${r.raw}${r.id ? ` → ${r.id.replace("_", " ")}${r.continuous ? " (continuous numbering)" : ""}` : ": no such verse"}` });
    if (c.flatteryOpener) out.push({ ok: false, text: `Flattering opener: “${c.flatteryOpener}”` });
    for (const p of c.flatteryPhrases) out.push({ ok: false, text: `Flattery: “${p}”` });
    if (c.engagementBait) out.push({ ok: false, text: `Ends with engagement bait: “${c.engagementBait.slice(0, 70)}”` });
    for (const s of c.unsupportedClaims ?? []) out.push({ ok: false, text: `Unverified statistic or research claim: “${s.slice(0, 80)}${s.length > 80 ? "…" : ""}”` });
    if (side === "realigned") out.push({ ok: true, text: `${run.realigned.citations.length} citation(s), all inside the evidence packet` });
    if (!out.length) out.push({ ok: true, text: "Nothing flagged" });
    return out;
  };
  return (
    <section className="card p-4">
      <p className="eyebrow">Deterministic checks · computed by code, not a model</p>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {(["baseline", "realigned"] as Side[]).map((side) => (
          <ul key={side} className="space-y-1.5 text-[13px]">
            <li className="font-semibold" style={{ color: side === "baseline" ? "var(--preyas)" : "var(--accent)" }}>{side === "baseline" ? "Baseline" : "Re-aligned"}</li>
            {rows(side).map((r, i) => (
              <li key={i} className="flex gap-2">{r.ok ? <IconCheck size={14} className="mt-0.5 flex-none text-accent" /> : <IconAlert size={14} className="mt-0.5 flex-none text-preyas" />}<span>{r.text}</span></li>
            ))}
          </ul>
        ))}
      </div>
      <p className="mt-3 text-[12px] text-text-3">Flags are not scores. Statistics and other facts outside the corpus are not verified by these checks. <Link className="underline" href="/harness#method">How scoring works</Link></p>
    </section>
  );
}
