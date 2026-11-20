// The blind judge: shuffled order, strict JSON, verbatim evidence or the score is dropped.
import { test } from "node:test";
import assert from "node:assert/strict";
import { rubric } from "./helpers.ts";
import { evidenceOccurs, judgeOrder, parseJudge, resolveJudge } from "../src/lib/core/judge.ts";

const ids = rubric.axes.map((a) => a.id);
const raw = (a: string, b: string, verdict = "B") =>
  JSON.stringify({ scores: Object.fromEntries(ids.map((id) => [id, { A: { score: 1, evidence: a }, B: { score: 4, evidence: b } }])), verdict, summary: "ok" });

test("evidence must occur verbatim; quotation marks and end punctuation are tolerated", () => {
  const text = "Your idea taps a growing appetite for instant, personalized guidance, and the rest.";
  assert.equal(evidenceOccurs("\"Your idea taps a growing appetite for instant, personalized guidance.\"", text), true);
  assert.equal(evidenceOccurs("taps a growing … personalized guidance", text), true);
  assert.equal(evidenceOccurs("Your idea is certain to become a unicorn", text), false);
});

test("judge JSON is validated axis by axis", () => {
  assert.throws(() => parseJudge("not json", ids), /no JSON/);
  assert.throws(() => parseJudge(JSON.stringify({ scores: {} }), ids), /missing axis/);
  assert.doesNotThrow(() => parseJudge(`Here you go: ${raw("x", "y")}`, ids));
});

test("A/B order is deterministic per prompt and is undone when scoring", () => {
  const order = judgeOrder("some prompt");
  assert.deepEqual(order, judgeOrder("some prompt"));
  const texts = { baseline: "baseline says this exactly", realigned: "realigned says that exactly" };
  const [first] = order;
  const a = first === "baseline" ? "baseline says this exactly" : "realigned says that exactly";
  const b = first === "baseline" ? "realigned says that exactly" : "baseline says this exactly";
  const r = resolveJudge(parseJudge(raw(a, b), ids), rubric, order, texts);
  assert.equal(r.verdict, order[1]);
  assert.equal(r.totals[order[1]], ids.length * 4);
  assert.equal(r.comparableAxes, ids.length);
});

test("scores with invented evidence are discarded and totals stay comparable", () => {
  const texts = { baseline: "only this text", realigned: "and this one" };
  const r = resolveJudge(parseJudge(raw("only this text", "words that were never written"), ids), rubric, ["baseline", "realigned"], texts);
  assert.equal(r.rejectedEvidence, ids.length);
  assert.equal(r.comparableAxes, 0);
  assert.equal(r.max, 0);
  assert.equal(r.totals.baseline, 0);
});

test("a missing verdict is derived from the totals and marked as derived", () => {
  const texts = { baseline: "aaa bbb", realigned: "ccc ddd" };
  const r = resolveJudge(parseJudge(raw("aaa bbb", "ccc ddd", ""), ids), rubric, ["baseline", "realigned"], texts);
  assert.equal(r.verdict, "realigned");
  assert.equal(r.verdictDerived, true);
});
