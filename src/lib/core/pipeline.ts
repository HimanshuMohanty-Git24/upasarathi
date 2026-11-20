// The Alignment Harness, end to end. The same function records runs in Node and runs live in the browser;
// only the transport differs. The returned record is also the replay format.
import { diagnose, type Diagnosis, type Engine } from "./engine.ts";
import { extractCitations, splitCombined, stripCitations, type Citation } from "./citations.ts";
import { auditFacts, runChecks, unsupportedClaims, verifyEnglishQuotes, verifyQuotes, type Checks, type CorpusIndex } from "./checks.ts";
import { judgeMessages, judgeOrder, parseJudge, resolveJudge, type JudgeResult, type Side } from "./judge.ts";
import { LlmError, type LlmRequest, type LlmResult, type Msg, type ProviderId } from "./llm.ts";
import { hash } from "./text.ts";
import type { Preset } from "./types.ts";

export interface Transport {
  complete(req: LlmRequest, onToken?: (delta: string, full: string) => void): Promise<LlmResult>;
}
export interface HarnessModels {
  provider: ProviderId;
  model: string;
  judgeProvider: ProviderId;
  judgeModel: string;
}
export interface StageText {
  text: string;
  model: string;
  ms: number;
  finish: string | null;
  error?: { code: string; message: string };
  /** Where this text came from when it was not generated in this run (e.g. a recorded Phase 0 sample). */
  provenance?: string;
}
export interface HarnessRun {
  id: string;
  v: 1;
  createdAt: string;
  prompt: string;
  preset: string | null;
  title: string | null;
  hook: string | null;
  control: boolean;
  sharpened: boolean;
  corpusHash: string;
  models: HarnessModels & { sameJudge: boolean };
  diagnosis: Diagnosis;
  baseline: StageText;
  realigned: StageText & { citations: Citation[]; stripped: string[]; repaired: boolean };
  checks: { baseline: Checks; realigned: Checks };
  judge: JudgeResult;
  status: "complete" | "partial" | "crisis";
}
export type Stage = "diagnosis" | "baseline" | "realigned" | "checks" | "judge" | "done";
export interface HarnessEvents {
  onStage?: (stage: Stage, run: Partial<HarnessRun>) => void;
  onToken?: (side: Side, full: string) => void;
  onWait?: (ms: number, what: string) => void;
}

const errOf = (e: unknown) => (e instanceof LlmError ? { code: e.code, message: e.message } : { code: "network", message: (e as Error)?.message || String(e) });

export async function runHarness(
  E: Engine,
  ci: CorpusIndex,
  transport: Transport,
  models: HarnessModels,
  prompt: string,
  opts: { preset?: Preset; baseline?: StageText; corpusHash?: string; events?: HarnessEvents; now?: () => string } = {},
): Promise<HarnessRun> {
  const ev = opts.events || {};
  const { rubric, kb } = E;
  const sameJudge = models.judgeProvider === models.provider && models.judgeModel === models.model;
  const run: HarnessRun = {
    id: opts.preset?.id ?? `live-${hash(prompt).toString(36)}`,
    v: 1,
    createdAt: (opts.now ?? (() => new Date().toISOString()))(),
    prompt,
    preset: opts.preset?.id ?? null,
    title: opts.preset?.title ?? null,
    hook: opts.preset?.hook ?? null,
    control: Boolean(opts.preset?.control),
    sharpened: Boolean(opts.preset?.sharpened),
    corpusHash: opts.corpusHash ?? "",
    models: { ...models, sameJudge },
    diagnosis: diagnose(E, prompt),
    baseline: { text: "", model: models.model, ms: 0, finish: null },
    realigned: { text: "", model: models.model, ms: 0, finish: null, citations: [], stripped: [], repaired: false },
    checks: { baseline: runChecks(kb, ci, rubric, ""), realigned: runChecks(kb, ci, rubric, "") },
    judge: { status: "skipped", order: judgeOrder(prompt), scores: {}, totals: { baseline: 0, realigned: 0 }, max: rubric.axes.length * 4, comparableAxes: 0, verdict: null, summary: "", rejectedEvidence: 0, sameModel: sameJudge, model: null, ms: 0 },
    status: "complete",
  };
  ev.onStage?.("diagnosis", run);

  if (run.diagnosis.crisis) {
    run.status = "crisis";
    run.judge.error = "Crisis language detected: no model was asked; human help is shown first.";
    ev.onStage?.("done", run);
    return run;
  }

  // A · baseline (neutral prompt, model defaults apart from token headroom)  ∥  C · re-aligned (grounded in the packet)
  const baseline = async (): Promise<StageText> => {
    if (opts.baseline) return opts.baseline;
    try {
      const r = await transport.complete(
        { provider: models.provider, model: models.model, temperature: 0.7, maxTokens: 4096, stream: true, messages: [{ role: "system", content: rubric.baselineSystem }, { role: "user", content: prompt }] },
        (_d, full) => ev.onToken?.("baseline", full),
      );
      return { text: r.text, model: r.model, ms: r.ms, finish: r.finish };
    } catch (e) {
      return { text: "", model: models.model, ms: 0, finish: null, error: errOf(e) };
    }
  };
  const realigned = async (): Promise<HarnessRun["realigned"]> => {
    const allowed = new Set(run.diagnosis.allowed);
    const msgs: Msg[] = [
      { role: "system", content: rubric.realignSystem },
      { role: "user", content: `REQUEST:\n${prompt}\n\n${run.diagnosis.packet}` },
    ];
    try {
      const req = { provider: models.provider, model: models.model, temperature: 0.4, maxTokens: 4096, reasoning: "medium" as const, stream: true };
      const abbrevs = kb.texts.map((t) => t.abbrev);
      let r = await transport.complete({ ...req, messages: msgs }, (_d, full) => ev.onToken?.("realigned", full));
      let text = splitCombined(r.text, abbrevs);
      let ms = r.ms;
      const baitRe = new RegExp(rubric.checks.engagementBait, "i");
      const grounded = run.diagnosis.status !== "INSUFFICIENT_EVIDENCE";
      const audit = (t: string) => {
        const cites = extractCitations(kb, t, allowed);
        return {
          cites,
          badQuotes: verifyQuotes(ci, t).filter((q) => !q.found),
          badEnglish: verifyEnglishQuotes(ci, t).filter((q) => !q.found),
          bait: t.trim().slice(-260).match(baitRe)?.[0],
          uncited: grounded && !cites.some((c) => c.allowed),
          claims: unsupportedClaims(t),
        };
      };
      let a = audit(text);
      let repaired = false;
      if (a.cites.some((c) => !c.allowed) || a.badQuotes.length || a.badEnglish.length || a.bait || a.uncited || a.claims.length) {
        // One repair pass, telling the model exactly what failed the audit.
        const problems = [
          ...a.cites.filter((c) => !c.allowed).map((c) => `${c.raw} is not in the evidence packet`),
          ...a.badQuotes.map((q) => `"${q.quote.slice(0, 80)}" does not occur verbatim in the packet`),
          ...a.badEnglish.map((q) => `"${q.quote.slice(0, 80)}" is in quotation marks but is not the packet's translation; quote the translation exactly, or paraphrase without quotation marks`),
          ...(a.uncited ? ["it cites nothing; support the answer with one to three citations from the packet, written exactly like [KaU 1.2.2] or [Concept: Śreyas]"] : []),
          ...a.claims.map((s) => `"${s.slice(0, 90)}" asserts a statistic or research finding that is not in the packet and cannot be verified; remove it, or say plainly that you cannot verify such figures`),
          ...(a.bait ? [`it ends with an offer to do more ("${a.bait.slice(0, 60)}"); end instead with your answer, or one question the person answers for themselves`] : []),
        ];
        const fix = await transport.complete(
          { ...req, messages: [...msgs, { role: "assistant", content: r.text }, { role: "user", content: `Your answer failed the citation audit:\n- ${problems.join("\n- ")}\nRewrite the whole answer. Cite only ids present in the packet; copy any Sanskrit or IAST exactly from the packet or leave it out.` }] },
          (_d, full) => ev.onToken?.("realigned", full),
        );
        r = fix;
        ms += fix.ms;
        repaired = true;
        text = splitCombined(r.text, abbrevs);
        a = audit(text);
      }
      // Whatever still fails is stripped (citations) or flagged by stage D (quotes, bait), never hidden.
      const bad = a.cites.filter((c) => !c.allowed);
      return { text: stripCitations(text, bad), model: r.model, ms, finish: r.finish, citations: a.cites.filter((c) => c.allowed), stripped: bad.map((c) => c.raw), repaired };
    } catch (e) {
      return { text: "", model: models.model, ms: 0, finish: null, error: errOf(e), citations: [], stripped: [], repaired: false };
    }
  };
  const realignedP = realigned().then((x) => {
    run.realigned = x;
    ev.onStage?.("realigned", run);
    return x;
  });
  run.baseline = await baseline();
  ev.onStage?.("baseline", run);
  await realignedP;

  // D · deterministic checks
  run.checks = { baseline: runChecks(kb, ci, rubric, run.baseline.text), realigned: runChecks(kb, ci, rubric, run.realigned.text) };
  ev.onStage?.("checks", run);

  // E · blind judge
  if (run.baseline.text && run.realigned.text) {
    const order = judgeOrder(prompt);
    const texts: Record<Side, string> = { baseline: run.baseline.text, realigned: run.realigned.text };
    const msgs = judgeMessages(rubric, prompt, texts[order[0]], texts[order[1]], { a: auditFacts(run.checks[order[0]]), b: auditFacts(run.checks[order[1]]) });
    const t0 = Date.now();
    let lastErr = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await transport.complete({ provider: models.judgeProvider, model: models.judgeModel, temperature: 0, maxTokens: 4096, json: true, reasoning: "medium", messages: attempt === 0 ? msgs : [...msgs, { role: "user", content: `Your previous reply could not be used (${lastErr}). Return ONLY the JSON object, with every axis.` }] });
        const parsed = parseJudge(r.text, rubric.axes.map((a) => a.id));
        run.judge = { status: "ok", sameModel: sameJudge, model: r.model, ms: Date.now() - t0, ...resolveJudge(parsed, rubric, order, texts) };
        break;
      } catch (e) {
        lastErr = (e as Error).message;
        if (e instanceof LlmError && e.code !== "empty") break; // provider failure: do not retry blindly
      }
    }
    if (run.judge.status !== "ok") {
      run.judge = { ...run.judge, status: "unavailable", model: models.judgeModel, ms: Date.now() - t0, error: lastErr || "judge failed" };
    }
  } else {
    run.judge.error = "The judge needs both answers; one stage did not return text.";
  }
  if (run.baseline.error || run.realigned.error || run.judge.status !== "ok") run.status = "partial";
  ev.onStage?.("done", run);
  return run;
}
