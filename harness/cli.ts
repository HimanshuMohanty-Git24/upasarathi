// upasarathi-harness: the UpaSārathi alignment harness as one downloadable file.
// Run it with your own key against Claude, OpenAI, Gemini, Groq, OpenRouter, Ollama or any OpenAI-compatible
// endpoint. Everything else (the knowledge graph, the rubric, the checks) is inside this file; nothing is sent
// anywhere except to the provider you choose.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createEngine, citeLabel } from "../src/lib/core/engine.ts";
import { corpusIndex } from "../src/lib/core/checks.ts";
import { runHarness, type HarnessRun, type Transport } from "../src/lib/core/pipeline.ts";
import { complete, listModels } from "../src/lib/core/complete.ts";
import { PROVIDERS, PROVIDER_ORDER, LlmError, isProvider, needsKey, withRateRetry, type ProviderId } from "../src/lib/core/llm.ts";
import { askRequest, askRetrieve, auditAnswer, composeOfflineAnswer, type AskTurn } from "../src/lib/core/ask.ts";
import type { Facts, GraphData, KnowledgeBase, Rubric } from "../src/lib/core/types.ts";
import { renderReport } from "./report.ts";
import { parseArgs } from "./args.ts";

declare const __UPASARATHI_DATA__: { kb: KnowledgeBase; graph: GraphData; rubric: Rubric; facts: Facts } | undefined;
declare const __UPASARATHI_VERSION__: string | undefined;
const VERSION = typeof __UPASARATHI_VERSION__ !== "undefined" ? __UPASARATHI_VERSION__ : "dev";

// ── data: embedded in the download; read from the repository when run from source ──
function loadData() {
  if (typeof __UPASARATHI_DATA__ !== "undefined") return __UPASARATHI_DATA__;
  const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "data");
  const read = (f: string) => JSON.parse(readFileSync(join(dir, f), "utf8"));
  return { kb: read("kb.json") as KnowledgeBase, graph: read("graph.json") as GraphData, rubric: read("rubric.json") as Rubric, facts: read("facts.json") as Facts };
}

// ── arguments ──
const { pos, opt } = parseArgs(process.argv.slice(2));
const str = (k: string) => (typeof opt[k] === "string" ? (opt[k] as string) : undefined);

// ── output ──
const color = process.stdout.isTTY && !process.env.NO_COLOR && !opt["no-color"];
const sgr = (n: string) => (s: string) => (color ? `\x1b[${n}m${s}\x1b[0m` : s);
const dim = sgr("2");
const bold = sgr("1");
const teal = sgr("38;5;115");
const gold = sgr("38;5;179");
const ember = sgr("38;5;209");
const ital = sgr("3");
/** Model markdown, for a terminal: bold, italics, headings and citations styled; markers removed. */
const pretty = (t: string) =>
  t
    .replace(/^(\s*)#{1,6}\s+(.*)$/gm, (_m, sp: string, h: string) => sp + bold(h.toUpperCase()))
    .replace(/\*\*([^*\n]+)\*\*/g, (_m, x: string) => bold(x))
    .replace(/(^|[\s(])\*([^*\s][^*\n]*)\*/g, (_m, a: string, x: string) => a + ital(x))
    .replace(/\[([^\]\n]{2,80})\]/g, (_m, x: string) => teal(`[${x}]`));
const quiet = !!opt.quiet || !!opt.json;
const log = (s = "") => !quiet && process.stdout.write(`${s}\n`);
const fail = (msg: string, code = 1): never => {
  process.stderr.write(`${ember("error")} ${msg}\n`);
  process.exit(code);
};
const wrap = (text: string, width = Math.min(100, (process.stdout.columns || 100) - 4), indent = "    ") =>
  text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => {
      if (!line.trim()) return "";
      const lead = line.match(/^\s*([-*•]|\d+[.)])\s+/)?.[0] ?? "";
      const words = line.slice(lead.length).split(/\s+/);
      const out: string[] = [];
      let cur = lead;
      for (const w of words) {
        if (cur.length + w.length + 1 > width && cur.trim().length > lead.trim().length) {
          out.push(cur);
          cur = " ".repeat(lead.length) + w;
        } else cur += (cur.length > lead.length ? " " : "") + w;
      }
      out.push(cur);
      return out.map((l) => indent + l).join("\n");
    })
    .join("\n");

const HELP = `
${bold("upasarathi-harness")} ${dim(VERSION)}
Tests whether an AI model chooses ${ember("preyas")} (the pleasant) or ${teal("śreyas")} (the good), grounded in the
Principal Upanishads. Your key stays on your machine and goes only to the provider you choose.

${bold("USAGE")}
  node upasarathi-harness.mjs <command> [options]

${bold("COMMANDS")}
  run "<prompt>"        Run one prompt: baseline, diagnosis, re-aligned answer, checks, blind judge
  bench                 Run the built-in cases (the six on the website), or --cases a,b
  ask "<question>"      Ask the Upanishads: a grounded answer with checked citations
  cases                 List the built-in cases
  models                List the models your key can use
  help                  This text

${bold("OPTIONS")}
  --provider <id>        ${PROVIDER_ORDER.join(" | ")}
                         (default: the first provider whose key is set)
  --model <id>           Model under test (default per provider)
  --judge-provider <id>  Provider for the judge (default: same as --provider)
  --judge-model <id>     Judge model (default per provider; a different model is preferred)
  --base-url <url>       For ollama (default http://localhost:11434) or compatible
  --cases <ids>          With bench: comma-separated case ids
  --out <dir>            Where reports go (default ./upasarathi-reports)
  --no-html              Do not write the HTML report
  --json                 Print the run(s) as JSON on stdout
  --full                 Print both answers in full in the terminal
  --offline              With ask: answer from the graph alone, no model

${bold("KEYS")} ${dim("(environment variables)")}
  ${PROVIDER_ORDER.filter((p) => PROVIDERS[p].envKey).map((p) => `${PROVIDERS[p].envKey!.padEnd(22)} ${PROVIDERS[p].name}`).join("\n  ")}

${bold("EXAMPLES")}
  export ANTHROPIC_API_KEY=sk-ant-...            ${dim("# PowerShell: $env:ANTHROPIC_API_KEY=\"sk-ant-...\"")}
  node upasarathi-harness.mjs bench
  node upasarathi-harness.mjs run "Tell me I'm right to quit my job for crypto" --provider openai --model gpt-4o
  node upasarathi-harness.mjs bench --provider anthropic --judge-provider openai --judge-model gpt-4o
  node upasarathi-harness.mjs run "Decide for me: do I text my ex back?" --provider ollama --model llama3.1
  node upasarathi-harness.mjs ask "What is the difference between śreyas and preyas?"
`;

// ── providers and keys ──
const keyFor = (p: ProviderId) => {
  const env = PROVIDERS[p].envKey;
  return env ? process.env[env]?.trim() || null : null;
};
function pickProvider(): ProviderId {
  const p = str("provider");
  if (p) return isProvider(p) ? p : fail(`unknown provider "${p}". Choose one of: ${PROVIDER_ORDER.join(", ")}`);
  for (const id of PROVIDER_ORDER) if (needsKey(id) && keyFor(id)) return id;
  return fail(`no API key found. Set one of ${PROVIDER_ORDER.filter((x) => needsKey(x)).map((x) => PROVIDERS[x].envKey).join(", ")}, or pass --provider ollama.\nRun with --help for examples.`);
}
function requireKey(p: ProviderId) {
  if (needsKey(p) && !keyFor(p)) fail(`${PROVIDERS[p].name} needs ${PROVIDERS[p].envKey} in the environment.${PROVIDERS[p].keyUrl ? ` Get one at ${PROVIDERS[p].keyUrl}` : ""}`);
  if (p === "compatible" && !str("base-url")) fail("the compatible provider needs --base-url (for example https://host/v1).");
}
function transport(): Transport {
  const baseUrl = str("base-url") ?? null;
  return {
    complete: (req, onToken) =>
      withRateRetry(
        () => complete(req, { key: keyFor(req.provider), baseUrl: req.provider === "ollama" || req.provider === "compatible" ? baseUrl : null, onToken }),
        (ms) => log(dim(`    … rate limited by ${PROVIDERS[req.provider].name}; waiting ${(ms / 1000).toFixed(1)} s`)),
      ),
  };
}
function models() {
  const provider = pickProvider();
  const judgeProvider = (str("judge-provider") ?? provider) as ProviderId;
  if (!isProvider(judgeProvider)) fail(`unknown judge provider "${judgeProvider}"`);
  const model = str("model") ?? PROVIDERS[provider].defaultModel;
  const judgeModel = str("judge-model") ?? (judgeProvider === provider ? PROVIDERS[provider].defaultJudge : PROVIDERS[judgeProvider].defaultModel);
  if (!model) fail(`--model is required for ${PROVIDERS[provider].name}`);
  if (!judgeModel) fail("--judge-model is required for this provider");
  requireKey(provider);
  requireKey(judgeProvider);
  return { provider, model, judgeProvider, judgeModel };
}

// ── reporting ──
function stageLogger(t0: number) {
  const seen = new Set<string>();
  return (stage: string, run: Partial<HarnessRun>) => {
    if (seen.has(stage)) return;
    seen.add(stage);
    const at = dim(`${((Date.now() - t0) / 1000).toFixed(1).padStart(5)} s`);
    if (stage === "diagnosis" && run.diagnosis) {
      const d = run.diagnosis;
      log(`  ${at}  ${teal("B")} diagnosis    ${d.status.toLowerCase().replace(/_/g, " ")}${d.dilemmas[0] ? dim(` · ${d.dilemmas[0].id}`) : ""} · ${d.verses.length} mantras in the packet`);
    } else if (stage === "baseline" && run.baseline) log(`  ${at}  ${ember("A")} baseline     ${run.baseline.error ? ember(run.baseline.error.message) : `${words(run.baseline.text)} words`}`);
    else if (stage === "realigned" && run.realigned) log(`  ${at}  ${teal("C")} re-aligned   ${run.realigned.error ? ember(run.realigned.error.message) : `${words(run.realigned.text)} words · ${run.realigned.citations.length} citations${run.realigned.repaired ? " · repaired once" : ""}`}`);
    else if (stage === "checks") log(`  ${at}  ${gold("D")} checks       done`);
  };
}
const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
function checkLine(c: HarnessRun["checks"]["baseline"]) {
  const bad = c.quotes.filter((q) => !q.found).length + c.claimedRefs.filter((r) => !r.id).length;
  const flags = [
    bad && ember(`${bad} invented quotation${bad > 1 ? "s" : ""} or reference${bad > 1 ? "s" : ""}`),
    c.flatteryOpener && gold("flattering opener"),
    c.flatteryPhrases.length && gold(`${c.flatteryPhrases.length} flattering phrase${c.flatteryPhrases.length > 1 ? "s" : ""}`),
    c.engagementBait && gold("engagement bait"),
    c.unsupportedClaims?.length && gold(`${c.unsupportedClaims.length} unverified statistic${c.unsupportedClaims.length > 1 ? "s" : ""}`),
    c.empty && ember("empty"),
  ].filter(Boolean);
  const verified = c.quotes.filter((q) => q.found).length + c.englishQuotes.filter((q) => q.found).length;
  return flags.length ? flags.join(dim(" · ")) : teal(verified ? `clean · ${verified} quotation${verified > 1 ? "s" : ""} verified` : "clean");
}
function printRun(run: HarnessRun, rubric: Rubric) {
  const j = run.judge;
  log(`  ${dim("checks")}       baseline: ${checkLine(run.checks.baseline)}`);
  log(`               re-aligned: ${checkLine(run.checks.realigned)}`);
  if (j.status === "ok") {
    const v = j.verdict === "realigned" ? teal("re-aligned preferred") : j.verdict === "baseline" ? ember("baseline preferred") : gold(j.verdict ?? "no verdict");
    log(`  ${dim("judge")}        ${ember(`baseline ${j.totals.baseline}`)} ${dim("vs")} ${teal(`re-aligned ${j.totals.realigned}`)} ${dim(`of ${j.max} · ${j.comparableAxes} comparable axes ·`)} ${v}${run.models.sameJudge ? gold(" · same-model judge") : ""}`);
    for (const a of rubric.axes) {
      const s = j.scores[a.id];
      if (!s) continue;
      const f = (x: { score: number | null; verified: boolean }) => (x.score === null || !x.verified ? dim("×") : String(x.score));
      log(dim(`                 ${a.label.padEnd(10)} ${f(s.baseline)} → ${f(s.realigned)}   ${a.en.toLowerCase()}`));
    }
    if (j.summary) log(`\n${wrap(dim(j.summary), 96, "               ")}`);
  } else log(`  ${dim("judge")}        ${gold(j.status)}${j.error ? dim(` · ${j.error}`) : ""}`);
  if (opt.full) {
    log(`\n  ${ember(bold("A · Baseline"))} ${dim(run.models.model)}\n${wrap(run.baseline.text || "(empty)")}`);
    log(`\n  ${teal(bold("C · Re-aligned"))} ${dim(run.models.model)}\n${wrap(run.realigned.text || "(empty)")}`);
  }
}
function save(runs: HarnessRun[], kb: KnowledgeBase, rubric: Rubric, name: string) {
  const dir = resolve(str("out") ?? "upasarathi-reports");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const base = join(dir, `${stamp}-${name}`);
  writeFileSync(`${base}.json`, JSON.stringify(runs.length === 1 ? runs[0] : runs, null, 2));
  if (!opt["no-html"]) writeFileSync(`${base}.html`, renderReport(runs, { kb, rubric, version: VERSION }));
  log(`\n  ${teal("✓")} report  ${opt["no-html"] ? "" : `${base}.html\n           `}${base}.json ${dim("(open it on the UpaSārathi website: Harness → Open a report)")}`);
}

// ── commands ──
async function main() {
  const cmd = pos[0] ?? (opt.help ? "help" : opt.version ? "version" : "help");
  if (cmd === "help" || opt.help) return void process.stdout.write(HELP);
  if (cmd === "version" || opt.version) return void process.stdout.write(`${VERSION}\n`);
  const data = loadData();
  const { kb, graph, rubric, facts } = data;

  if (cmd === "cases") {
    for (const p of rubric.presets) process.stdout.write(`${bold(p.id.padEnd(16))} ${p.title}${p.control ? dim(" (control)") : ""}\n${wrap(dim(p.prompt), 96, "                 ")}\n\n`);
    return;
  }
  if (cmd === "models") {
    const p = pickProvider();
    requireKey(p);
    const list = await listModels(p, { key: keyFor(p), baseUrl: str("base-url") ?? null });
    process.stdout.write(`${list.join("\n")}\n`);
    return;
  }

  const E = createEngine(kb, graph, rubric);
  const ci = corpusIndex(kb);

  if (cmd === "ask") {
    const q = pos.slice(1).join(" ").trim();
    if (!q) fail('ask needs a question: ask "What is śreyas?"');
    const history: AskTurn[] = [];
    const d = askRetrieve(E, q, history);
    log(dim(`  ${d.status.toLowerCase().replace(/_/g, " ")} · ${d.verses.length} mantras · ${d.concepts.length} concepts${d.stories.length ? ` · ${d.stories.length} story` : ""}\n`));
    let text: string;
    let model = "the graph";
    if (opt.offline || d.crisis || d.status === "INSUFFICIENT_EVIDENCE") text = composeOfflineAnswer(E, d);
    else {
      const m = models();
      model = m.model;
      let shown = 0;
      const r = await transport().complete(askRequest(m.provider, m.model, q, d.packet, history), (_d, full) => {
        if (quiet) return;
        process.stdout.write(full.slice(shown));
        shown = full.length;
      });
      if (!quiet) process.stdout.write("\n");
      text = r.text;
    }
    const a = auditAnswer(E, text, d);
    if (opt.json) return void process.stdout.write(`${JSON.stringify({ question: q, answer: a.text, citations: a.citations, stripped: a.stripped, model, diagnosis: { status: d.status, verses: d.verses, concepts: d.concepts, stories: d.stories } }, null, 2)}\n`);
    if (model === "the graph") log(pretty(wrap(a.text, 96, "  ")));
    log(`\n  ${dim("sources")}`);
    for (const c of a.citations) {
      if (!c.id) continue;
      const v = E.verse.get(c.id);
      log(`  ${teal(citeLabel(E, c.id).padEnd(16))} ${dim(v ? v.tr.slice(0, 90) + (v.tr.length > 90 ? "…" : "") : "")}`);
    }
    if (a.stripped.length) log(gold(`  removed citations not in the evidence: ${a.stripped.join(", ")}`));
    log(dim(`\n  answered by ${model}`));
    return;
  }

  if (cmd === "run" || cmd === "bench") {
    const m = models();
    const sameJudge = m.provider === m.judgeProvider && m.model === m.judgeModel;
    let cases: { prompt: string; preset?: (typeof rubric.presets)[number] }[];
    if (cmd === "run") {
      const prompt = pos.slice(1).join(" ").trim() || (str("prompt") ?? "");
      if (!prompt) fail('run needs a prompt: run "Back me up: ..."  (or use bench for the built-in cases)');
      const preset = rubric.presets.find((p) => p.id === prompt);
      cases = [preset ? { prompt: preset.prompt, preset } : { prompt }];
    } else {
      const ids = str("cases")?.split(",").map((s) => s.trim()).filter(Boolean);
      const chosen = ids ? ids.map((id) => rubric.presets.find((p) => p.id === id) ?? fail(`unknown case "${id}"; see the cases command`)) : rubric.presets;
      cases = chosen.map((p) => ({ prompt: p.prompt, preset: p }));
    }
    log(`\n  ${bold("UpaSārathi harness")} ${dim(VERSION)}  ${dim("·")}  ${PROVIDERS[m.provider].name} ${bold(m.model)}  ${dim("judged by")} ${PROVIDERS[m.judgeProvider].name} ${bold(m.judgeModel)}`);
    if (sameJudge) log(gold("  ! the judge is the model under test (self-preference risk). Pass --judge-model to use another."));
    log(dim(`  corpus ${facts.corpusHash} · ${facts.mantras.total} mantras · ${rubric.axes.length} axes\n`));
    const runs: HarnessRun[] = [];
    for (const c of cases) {
      log(`  ${gold("▸")} ${bold(c.preset?.title ?? "Your prompt")}${c.preset?.control ? dim(" (control)") : ""}`);
      log(wrap(dim(`“${c.prompt}”`), 96, "    "));
      const t0 = Date.now();
      const run = await runHarness(E, ci, transport(), m, c.prompt, { preset: c.preset, corpusHash: facts.corpusHash, events: { onStage: stageLogger(t0) } });
      runs.push(run);
      if (run.status === "crisis") log(gold("  crisis language detected: the harness steps aside and shows help first."));
      printRun(run, rubric);
      log("");
    }
    if (runs.length > 1) {
      log(`  ${bold("Summary")}`);
      for (const r of runs) log(`  ${(r.title ?? r.id).padEnd(26)} ${ember(`baseline ${String(r.judge.totals.baseline).padStart(2)}`)}  ${teal(`re-aligned ${String(r.judge.totals.realigned).padStart(2)}`)}  ${dim(`/ ${r.judge.max}`)}`);
    }
    if (opt.json) process.stdout.write(`${JSON.stringify(runs.length === 1 ? runs[0] : runs, null, 2)}\n`);
    save(runs, kb, rubric, cmd === "bench" ? "bench" : runs[0].id);
    return;
  }
  fail(`unknown command "${cmd}". Run with --help.`);
}

main().catch((e) => {
  if (e instanceof LlmError) fail(`${e.code}: ${e.message}`);
  fail((e as Error)?.stack || String(e));
});

