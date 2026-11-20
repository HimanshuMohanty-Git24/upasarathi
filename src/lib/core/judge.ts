// Stage E: the blind judge. Two responses, shuffled into A/B by a hash of the prompt, scored 0–4 on the rubric axes.
// Every score must carry a quote that occurs verbatim in the response it scores; scores whose evidence cannot be
// found are discarded and counted, never shown as if they were valid.
import { canon, hash } from "./text.ts";
import type { Msg } from "./llm.ts";
import type { Rubric } from "./types.ts";

export type Side = "baseline" | "realigned";
export interface AxisScore {
  score: number | null;
  raw: number;
  evidence: string;
  verified: boolean;
}
export interface JudgeResult {
  status: "ok" | "unavailable" | "skipped";
  order: [Side, Side];
  scores: Record<string, Record<Side, AxisScore>>;
  /** Sums over the axes where BOTH sides' evidence was verified, so the two totals are always comparable. */
  totals: Record<Side, number>;
  max: number;
  comparableAxes: number;
  verdict: Side | "tie" | null;
  /** True when the judge gave no usable verdict and it was derived from the totals. */
  verdictDerived?: boolean;
  summary: string;
  rejectedEvidence: number;
  sameModel: boolean;
  model: string | null;
  ms: number;
  error?: string;
}

export const judgeOrder = (prompt: string): [Side, Side] => (hash(prompt) % 2 === 0 ? ["baseline", "realigned"] : ["realigned", "baseline"]);

export function judgeMessages(rubric: Rubric, prompt: string, a: string, b: string, facts?: { a: string; b: string }): Msg[] {
  const axes = rubric.axes
    .map((x) => `- ${x.id} (${x.label}, ${x.en}): ${x.question}\n    0 = ${x.levels[0]}\n    2 = ${x.levels[2]}\n    4 = ${x.levels[4]}`)
    .join("\n");
  const user = rubric.judgeTemplate
    .replace("{{PROMPT}}", prompt)
    .replace("{{A}}", a || "(empty response)")
    .replace("{{B}}", b || "(empty response)")
    .replace("{{AXES}}", axes)
    .replace("{{AXIS_IDS}}", rubric.axes.map((x) => x.id).join(", "))
    .replace("{{FACTS_A}}", facts?.a || "- (no audit)")
    .replace("{{FACTS_B}}", facts?.b || "- (no audit)");
  return [
    { role: "system", content: rubric.judgeSystem },
    { role: "user", content: user },
  ];
}

interface RawJudge {
  scores: Record<string, { A: { score: number; evidence: string }; B: { score: number; evidence: string } }>;
  verdict: string;
  summary: string;
}

/** Parse and validate the judge's JSON. Throws with a precise reason when the shape is wrong. */
export function parseJudge(text: string, axisIds: string[]): RawJudge {
  const s = text.indexOf("{"), e = text.lastIndexOf("}");
  if (s < 0 || e <= s) throw new Error("judge returned no JSON object");
  let j: unknown;
  try {
    j = JSON.parse(text.slice(s, e + 1));
  } catch {
    throw new Error("judge JSON does not parse");
  }
  const o = j as RawJudge;
  if (!o || typeof o !== "object" || !o.scores || typeof o.scores !== "object") throw new Error("judge JSON has no scores");
  for (const id of axisIds) {
    const ax = o.scores[id];
    if (!ax) throw new Error(`judge JSON is missing axis ${id}`);
    for (const side of ["A", "B"] as const) {
      const v = ax[side];
      if (!v || typeof v.score !== "number" || v.score < 0 || v.score > 4 || typeof v.evidence !== "string") throw new Error(`judge JSON axis ${id}.${side} is malformed`);
    }
  }
  return { scores: o.scores, verdict: String(o.verdict || ""), summary: String(o.summary || "").slice(0, 400) };
}

/** Evidence must occur in the response it scores. Ellipses may join fragments; each fragment must occur in order. */
export function evidenceOccurs(evidence: string, response: string): boolean {
  const ev = canon(evidence).replace(/^["'\s]+|["'\s]+$/g, "");
  if (!ev) return !response.trim();
  const body = canon(response);
  let from = 0;
  // Quotation marks and end punctuation are the judge's framing, not part of the claim.
  const frags = ev.split(/\s*(?:\.\.\.|…)\s*/).map((f) => f.replace(/^[\s"'(]+|[\s"'.,;:!?)]+$/g, "")).filter((f) => f.length >= 3);
  if (!frags.length) return false;
  for (const frag of frags) {
    const i = body.indexOf(frag, from);
    if (i < 0) return false;
    from = i + frag.length;
  }
  return true;
}

export function resolveJudge(raw: RawJudge, rubric: Rubric, order: [Side, Side], texts: Record<Side, string>): Omit<JudgeResult, "status" | "sameModel" | "model" | "ms"> {
  const scores: JudgeResult["scores"] = {};
  const totals: Record<Side, number> = { baseline: 0, realigned: 0 };
  let rejected = 0;
  let comparable = 0;
  for (const ax of rubric.axes) {
    const pair = raw.scores[ax.id];
    const row = {} as Record<Side, AxisScore>;
    (["A", "B"] as const).forEach((letter, i) => {
      const side = order[i];
      const v = pair[letter];
      const verified = evidenceOccurs(v.evidence, texts[side]);
      if (!verified) rejected++;
      row[side] = { score: verified ? Math.round(v.score) : null, raw: v.score, evidence: v.evidence, verified };
    });
    if (row.baseline.score !== null && row.realigned.score !== null) {
      comparable++;
      totals.baseline += row.baseline.score;
      totals.realigned += row.realigned.score;
    }
    scores[ax.id] = row;
  }
  const v = raw.verdict.trim().toUpperCase().replace(/^RESPONSE\s+/, "");
  let verdict: Side | "tie" | null = /^A\b/.test(v) ? order[0] : /^B\b/.test(v) ? order[1] : /^TIE/.test(v) ? "tie" : null;
  const verdictDerived = verdict === null;
  // No usable verdict from the judge: derive it from the comparable totals, and say so.
  if (verdict === null) verdict = totals.baseline === totals.realigned ? "tie" : totals.baseline > totals.realigned ? "baseline" : "realigned";
  return { order, scores, totals, max: comparable * 4, comparableAxes: comparable, verdict, verdictDerived, summary: raw.summary, rejectedEvidence: rejected };
}
