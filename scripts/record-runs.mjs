// npm run runs:record — run every rubric preset through the full harness and save the replayable records.
//   GROQ_API_KEY=… npm run runs:record            all presets
//   GROQ_API_KEY=… npm run runs:record unicorn     one preset
// Baseline and re-aligned answers use the same model; the judge uses a different one. The Scripture Quote baseline
// is the genuine Phase 0 recording (see BASELINE_FROM below); every other answer is generated in this run.
import { mkdir, readFile, writeFile, readdir, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createEngine } from "../src/lib/core/engine.ts";
import { corpusIndex } from "../src/lib/core/checks.ts";
import { runHarness } from "../src/lib/core/pipeline.ts";
import { nodeTransport } from "./lib/node-transport.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const D = join(ROOT, "public", "data");
const read = async (f) => JSON.parse(await readFile(join(D, f), "utf8"));
const [kb, graph, rubric, facts] = await Promise.all([read("kb.json"), read("graph.json"), read("rubric.json"), read("facts.json")]);
const E = createEngine(kb, graph, rubric);
const ci = corpusIndex(kb);
const models = { provider: "groq", model: rubric.defaults.model, judgeProvider: "groq", judgeModel: rubric.defaults.judgeModel };
const transport = nodeTransport({ groq: process.env.GROQ_API_KEY?.trim(), openrouter: process.env.OPENROUTER_API_KEY?.trim() }, {
  onWait: (ms, m) => console.log(`  … rate-limited on ${m}, waiting ${(ms / 1000).toFixed(1)} s`),
});

// The hero's baseline: the real gpt-oss-20b answer captured in Phase 0 (one of two samples; the other was truthful).
const BASELINE_FROM = process.env.PHASE0_RUNS || join(ROOT, "..", "phase0", "runs");
async function phase0Baseline(presetId, model) {
  try {
    await access(BASELINE_FROM);
  } catch {
    return null;
  }
  for (const f of (await readdir(BASELINE_FROM)).filter((x) => x.startsWith("baseline-groq-")).sort()) {
    const runs = JSON.parse(await readFile(join(BASELINE_FROM, f), "utf8"));
    const same = runs.filter((r) => r.preset === presetId && r.model === model && r.text);
    const fabricated = same.find((r) => /[ऀ-ॿ]/.test(r.text) && r.text.length < 300);
    if (fabricated) return { text: fabricated.text, model, ms: fabricated.ms, finish: fabricated.finish, provenance: `Recorded ${fabricated.at.slice(0, 10)} during Phase 0 testing: sample ${fabricated.sample} of ${same.length} with the same neutral prompt. The other sample${same.length > 2 ? "s" : ""} answered truthfully.` };
  }
  return null;
}

// Re-recording keeps an earlier genuine baseline (same model, same neutral prompt) unless --fresh is passed, so that
// improving the re-aligned stage or the judge does not silently swap the answer being judged.
async function earlierBaseline(presetId) {
  try {
    const prev = JSON.parse(await readFile(join(D, "runs", `${presetId}.json`), "utf8"));
    if (!prev.baseline?.text || prev.baseline.error || prev.models?.model !== models.model || prev.prompt !== rubric.presets.find((p) => p.id === presetId)?.prompt) return null;
    return { ...prev.baseline, provenance: prev.baseline.provenance || `Recorded ${prev.createdAt.slice(0, 10)} in an earlier recording pass (same model, same neutral prompt).` };
  } catch {
    return null;
  }
}

const args = process.argv.slice(2);
const fresh = args.includes("--fresh");
const only = args.filter((a) => !a.startsWith("--"));
const presets = rubric.presets.filter((p) => !only.length || only.includes(p.id));
await mkdir(join(D, "runs"), { recursive: true });
for (const p of presets) {
  // The hero baseline is never regenerated: Phase 0 recording if present, else the stored one (provenance kept).
  const fixed = (p.id === "scripture-quote" ? (await phase0Baseline("scripture-quote", models.model)) ?? (await earlierBaseline(p.id)) : null) ?? (fresh ? null : await earlierBaseline(p.id));
  console.log(`▶ ${p.id}${fixed ? ` (baseline reused: ${fixed.provenance})` : ""}`);
  const run = await runHarness(E, ci, transport, models, p.prompt, { preset: p, baseline: fixed ?? undefined, corpusHash: facts.corpusHash });
  await writeFile(join(D, "runs", `${p.id}.json`), JSON.stringify(run, null, 1), "utf8");
  const j = run.judge;
  console.log(`  ${run.status} · baseline ${run.baseline.text.length} chars${run.baseline.error ? ` (ERROR ${run.baseline.error.code})` : ""} · re-aligned ${run.realigned.text.length} chars, ${run.realigned.citations.length} citations${run.realigned.stripped.length ? `, ${run.realigned.stripped.length} stripped` : ""}${run.realigned.repaired ? ", repaired" : ""}`);
  console.log(`  checks: baseline ${run.checks.baseline.unverifiedQuotes} unverified quote(s), opener ${run.checks.baseline.flatteryOpener ?? "–"}, bait ${run.checks.baseline.engagementBait ? "yes" : "no"}`);
  console.log(`  judge: ${j.status}${j.status === "ok" ? ` · baseline ${j.totals.baseline}/${j.max} vs re-aligned ${j.totals.realigned}/${j.max} (${j.comparableAxes} comparable axes) · verdict ${j.verdict} · ${j.rejectedEvidence} evidence rejected` : ` · ${j.error}`}`);
  console.log(`  re-aligned bait: ${run.checks.realigned.engagementBait ? "STILL PRESENT" : "none"} · English quotes ${run.checks.realigned.englishQuotes.map((q) => (q.found ? "✓" : "✗")).join("") || "–"}`);
  await new Promise((r) => setTimeout(r, 4000));
}

// index for the run list
const files = (await readdir(join(D, "runs"))).filter((f) => f.endsWith(".json") && f !== "index.json");
const index = [];
for (const f of files) {
  const r = JSON.parse(await readFile(join(D, "runs", f), "utf8"));
  index.push({ id: r.id, title: r.title, hook: r.hook, prompt: r.prompt, control: r.control, sharpened: r.sharpened, createdAt: r.createdAt, status: r.status, models: r.models, totals: r.judge.totals, max: r.judge.max, comparableAxes: r.judge.comparableAxes, verdict: r.judge.verdict, dilemma: r.diagnosis.dilemmas[0]?.id ?? null });
}
const order = rubric.presets.map((p) => p.id);
index.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
await writeFile(join(D, "runs", "index.json"), JSON.stringify(index, null, 1), "utf8");
console.log(`index: ${index.length} runs`);
