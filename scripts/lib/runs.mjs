// Verify every recorded harness run against the current corpus and core code. A run that cannot be re-derived
// (citation outside its packet, quote result that no longer holds, a counted score without verbatim evidence)
// fails the check rather than being replayed as if it were valid.
import { readFile, readdir, access } from "node:fs/promises";
import { join } from "node:path";
import { extractCitations } from "../../src/lib/core/citations.ts";
import { corpusIndex, runChecks } from "../../src/lib/core/checks.ts";
import { evidenceOccurs } from "../../src/lib/core/judge.ts";

export async function verifyRuns(ROOT) {
  const D = join(ROOT, "public", "data");
  const read = async (f) => JSON.parse(await readFile(join(D, f), "utf8"));
  const [kb, graph, rubric, facts] = await Promise.all([read("kb.json"), read("graph.json"), read("rubric.json"), read("facts.json")]);
  const ci = corpusIndex(kb);
  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  const errors = [];
  const warnings = [];
  const summary = [];
  const dir = join(D, "runs");
  try { await access(dir); } catch { return { errors: ["public/data/runs is missing"], warnings, summary }; }
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json") && f !== "index.json");
  if (!files.length) errors.push("no recorded runs");
  const index = await read("runs/index.json").catch(() => []);

  for (const f of files) {
    const r = await read(`runs/${f}`);
    const at = `run ${r.id}`;
    const err = (m) => errors.push(`${at}: ${m}`);
    if (r.v !== 1) err(`unknown record version ${r.v}`);
    if (`${r.id}.json` !== f) err(`file name does not match id`);
    const preset = rubric.presets.find((p) => p.id === r.preset);
    if (r.preset && !preset) err(`preset ${r.preset} no longer exists`);
    if (preset && preset.prompt !== r.prompt) err(`prompt differs from the preset in rubric.json`);
    if (r.corpusHash && r.corpusHash !== facts.corpusHash) warnings.push(`${at}: recorded against corpus ${r.corpusHash}, current ${facts.corpusHash}`);
    if (!r.models?.model || !r.models?.judgeModel) err(`models missing`);
    if (r.models.sameJudge !== (r.models.judgeModel === r.models.model && r.models.judgeProvider === r.models.provider)) err(`sameJudge flag is wrong`);

    for (const side of ["baseline", "realigned"]) if (!r[side].text && !r[side].error) err(`${side} is empty without an error`);
    for (const id of [...r.diagnosis.subgraph.nodes, ...r.diagnosis.verses.map((v) => v.id)]) if (!nodeIds.has(id)) err(`diagnosis refers to missing node ${id}`);

    // Citations: re-extract from the text with today's code; all must resolve and lie inside the packet.
    const allowed = new Set(r.diagnosis.allowed);
    const cites = extractCitations(kb, r.realigned.text, allowed);
    for (const c of cites) if (!c.id) err(`citation ${c.raw} does not resolve`);
    else if (!c.allowed) err(`citation ${c.raw} is outside the evidence packet`);
    const stored = new Set(r.realigned.citations.map((c) => c.id));
    for (const c of cites) if (c.id && !stored.has(c.id)) err(`citation ${c.raw} is not in the stored citation list`);

    // Deterministic checks must re-derive identically.
    for (const side of ["baseline", "realigned"]) {
      const now = runChecks(kb, ci, rubric, r[side].text);
      const was = r.checks[side];
      const sig = (c) => JSON.stringify([c.quotes.map((q) => [q.quote, q.found]), (c.englishQuotes || []).map((q) => [q.quote, q.found]), c.claimedRefs.map((x) => [x.raw, x.id]), Boolean(c.engagementBait), Boolean(c.flatteryOpener), c.unsupportedClaims || []]);
      if (sig(now) !== sig(was)) err(`${side} checks no longer re-derive (stored ${sig(was).slice(0, 120)} vs now ${sig(now).slice(0, 120)})`);
    }

    // Judge: every counted score must have evidence that occurs in its answer, and the totals must add up.
    const j = r.judge;
    if (j.status === "ok") {
      let b = 0, re = 0, comparable = 0;
      for (const ax of rubric.axes) {
        const s = j.scores[ax.id];
        if (!s) { err(`judge lacks axis ${ax.id}`); continue; }
        for (const side of ["baseline", "realigned"]) {
          const v = s[side];
          if (v.verified !== evidenceOccurs(v.evidence, r[side].text)) err(`judge ${ax.id}.${side}: evidence verification does not re-derive`);
          if (v.verified && v.score === null) err(`judge ${ax.id}.${side}: verified score is null`);
          if (!v.verified && v.score !== null) err(`judge ${ax.id}.${side}: unverified score is counted`);
        }
        if (s.baseline.score !== null && s.realigned.score !== null) { comparable++; b += s.baseline.score; re += s.realigned.score; }
      }
      if (b !== j.totals.baseline || re !== j.totals.realigned || comparable !== j.comparableAxes || j.max !== comparable * 4) err(`judge totals do not add up`);
      if (j.sameModel !== r.models.sameJudge) err(`judge sameModel flag disagrees with models`);
    } else if (r.status === "complete") err(`judge ${j.status} but status is complete`);
    if (!index.some((x) => x.id === r.id)) err(`missing from runs/index.json`);
    summary.push({ id: r.id, citations: cites.length, baselineFlags: r.checks.baseline.unverifiedQuotes, judge: j.status, totals: `${j.totals.baseline}–${j.totals.realigned}/${j.max}` });
  }

  // The homepage hero promises: a fabricated verse, stamped as not found, answered with KaU 1.1.27 and its chant.
  const hero = files.includes("scripture-quote.json") ? await read("runs/scripture-quote.json") : null;
  if (!hero) errors.push("hero run scripture-quote is missing");
  else {
    if (!hero.checks.baseline.quotes.some((q) => !q.found)) errors.push("hero: baseline has no unverified quotation to stamp");
    if (!hero.diagnosis.verses.some((v) => v.id === "KaU_1.1.27")) errors.push("hero: KaU 1.1.27 is not in the evidence packet");
    if (!kb.verses.find((v) => v.id === "KaU_1.1.27")?.audio) errors.push("hero: KaU 1.1.27 has no chant audio");
  }
  return { errors, warnings, summary };
}
