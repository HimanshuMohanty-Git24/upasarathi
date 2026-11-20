// The whole harness with a scripted transport: no network, every failure path exercised.
import { test } from "node:test";
import assert from "node:assert/strict";
import { E, ci, rubric } from "./helpers.ts";
import { runHarness, type Transport } from "../src/lib/core/pipeline.ts";
import { LlmError, type LlmRequest } from "../src/lib/core/llm.ts";

const models = { provider: "groq" as const, model: "test-20b", judgeProvider: "groq" as const, judgeModel: "test-120b" };
const PROMPT = rubric.presets.find((p) => p.id === "scripture-quote")!.prompt;

function scripted(handlers: { baseline?: () => string; realigned?: (n: number, req: LlmRequest) => string; judge?: (req: LlmRequest) => string }): Transport & { calls: string[] } {
  let realignedCalls = 0;
  const calls: string[] = [];
  return {
    calls,
    async complete(req) {
      const kind = req.model === models.judgeModel ? "judge" : req.messages[0].content === rubric.baselineSystem ? "baseline" : "realigned";
      calls.push(kind);
      const text = kind === "baseline" ? handlers.baseline!() : kind === "realigned" ? handlers.realigned!(++realignedCalls, req) : handlers.judge!(req);
      return { text, model: req.model, ms: 5, finish: "stop" };
    },
  };
}
const judgeFor = (req: LlmRequest, pick: (side: "A" | "B") => string) => {
  const body = req.messages[1].content;
  const A = body.split("RESPONSE A:\n<<<")[1].split(">>>")[0];
  const B = body.split("RESPONSE B:\n<<<")[1].split(">>>")[0];
  const ev = (t: string) => t.slice(0, 30);
  return JSON.stringify({
    scores: Object.fromEntries(rubric.axes.map((a) => [a.id, { A: { score: pick("A") === "good" ? 4 : 0, evidence: ev(A) }, B: { score: pick("B") === "good" ? 4 : 0, evidence: ev(B) } }])),
    verdict: pick("A") === "good" ? "A" : "B",
    summary: "test",
  });
};

test("a fabricated baseline, a repaired re-aligned answer and a blind verdict", async () => {
  const goodAnswer = "There is no such verse. The Kaṭha says the opposite [KaU 1.1.27]: a person is not satisfied by wealth.";
  const t = scripted({
    baseline: () => "रजः धनः सर्वधनानां श्रेष्ठः (कथोपनिषद् ४.११)",
    realigned: (n) => (n === 1 ? "Wealth is not the goal [MaU 7]. Would you like me to find more quotes?" : goodAnswer),
    judge: (req) => judgeFor(req, (side) => (req.messages[1].content.split(`RESPONSE ${side}:\n<<<`)[1].startsWith("There is no") ? "good" : "bad")),
  });
  const run = await runHarness(E, ci, t, models, PROMPT);
  assert.equal(run.status, "complete");
  assert.equal(run.checks.baseline.unverifiedQuotes, 1);
  assert.equal(run.realigned.repaired, true);
  assert.equal(run.realigned.text, goodAnswer);
  assert.deepEqual(run.realigned.citations.map((c) => c.id), ["KaU_1.1.27"]);
  assert.equal(run.judge.status, "ok");
  assert.equal(run.judge.verdict, "realigned");
  assert.equal(run.judge.totals.realigned, rubric.axes.length * 4);
  assert.equal(run.models.sameJudge, false);
  assert.deepEqual(t.calls.filter((c) => c === "realigned").length, 2);
});

test("citations that survive the repair outside the packet are stripped, not shown", async () => {
  const t = scripted({ baseline: () => "Here is a fine answer.", realigned: () => "Truth wins [MuU 3.1.6] and [MaU 7].", judge: (req) => judgeFor(req, () => "good") });
  const run = await runHarness(E, ci, t, models, PROMPT);
  assert.deepEqual(run.realigned.stripped, ["[MaU 7]"]);
  assert.doesNotMatch(run.realigned.text, /2\.3\.10/);
});

test("a daily quota and an empty answer become explicit stage errors; the judge is skipped", async () => {
  const t: Transport = {
    async complete(req) {
      if (req.messages[0].content === rubric.baselineSystem) throw new LlmError("rate-daily", "Daily limit reached", 429);
      throw new LlmError("empty", "The model used its whole token budget (likely on reasoning) and returned no answer.");
    },
  };
  const run = await runHarness(E, ci, t, models, PROMPT);
  assert.equal(run.status, "partial");
  assert.equal(run.baseline.error?.code, "rate-daily");
  assert.equal(run.realigned.error?.code, "empty");
  assert.equal(run.judge.status, "skipped");
});

test("judge JSON failures are retried once, then reported as unavailable rather than invented", async () => {
  let judgeCalls = 0;
  const t = scripted({ baseline: () => "Fine.", realigned: () => "Fine [MuU 3.1.6].", judge: () => { judgeCalls++; return "I think B is better."; } });
  const run = await runHarness(E, ci, t, models, PROMPT);
  assert.equal(judgeCalls, 2);
  assert.equal(run.judge.status, "unavailable");
  assert.deepEqual(run.judge.scores, {});
  assert.equal(run.status, "partial");
});

test("same-model judging is detected and labelled", async () => {
  const same = { ...models, judgeModel: models.model };
  const t: Transport = { async complete(req) { return { text: req.messages[0].content === rubric.baselineSystem ? "ok" : "ok [MuU 3.1.6]", model: req.model, ms: 1, finish: "stop" }; } };
  const run = await runHarness(E, ci, t, same, PROMPT);
  assert.equal(run.models.sameJudge, true);
  assert.equal(run.judge.sameModel, true);
});

test("crisis language asks no model at all", async () => {
  let calls = 0;
  const t: Transport = { async complete() { calls++; return { text: "", model: "", ms: 0, finish: null }; } };
  const run = await runHarness(E, ci, t, models, "I want to end my life");
  assert.equal(run.status, "crisis");
  assert.equal(calls, 0);
});
