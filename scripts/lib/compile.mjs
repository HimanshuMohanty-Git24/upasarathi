// The whole data build as one pure-ish function: read data/, assemble the graph, run the integrity gate,
// lay out the full map, and return every public/data artifact as a string. `npm run data` writes them only when
// there are zero errors; `npm run data:verify` compiles again and checks the committed files are identical.
import { readFile, readdir, access } from "node:fs/promises";
import { join } from "node:path";
import { normDeva, foldIast, dice, hash } from "../../src/lib/core/text.ts";

const exists = (p) => access(p).then(() => true, () => false);
const readJson = async (p) => JSON.parse(await readFile(p, "utf8"));

export async function compile(ROOT) {
  const DATA = join(ROOT, "data");
  const errors = [];
  const warnings = [];
  const err = (m) => errors.push(m);

  // ── corpora (auto-discovered plugins) ─────────────────────────────────────────────────────────────
  const texts = [];
  const verses = [];
  const bhashya = {};
  for (const d of (await readdir(join(DATA, "corpus"), { withFileTypes: true })).filter((x) => x.isDirectory())) {
    const dir = join(DATA, "corpus", d.name);
    if (!(await exists(join(dir, "meta.json")))) continue;
    const meta = await readJson(join(dir, "meta.json"));
    if (!(await exists(join(dir, "verses.json")))) { err(`${meta.id}: verses.json missing (run npm run data:sources)`); continue; }
    const vs = (await readJson(join(dir, "verses.json"))).map((v) => ({ ...v, up: meta.id }));
    const bh = (await exists(join(dir, "bhashya.json"))) ? await readJson(join(dir, "bhashya.json")) : {};
    bhashya[meta.id] = bh;
    const root = meta.en.replace(/ Upanishad$/, "");
    texts.push({
      id: meta.id, abbrev: meta.abbrev, sa: meta.sa, iast: meta.iast, en: meta.en, veda: meta.veda, levels: meta.levels,
      scope: meta.scope, order: meta.order, tagline: meta.tagline, count: vs.length,
      translators: [...new Set(vs.map((v) => v.tr?.by).filter(Boolean))],
      aliases: [...new Set([meta.abbrev, root, `${root} Upanishad`, `${root}opanishad`, meta.iast, `${meta.iast} Upaniṣad`, meta.sa, ...(meta.aliases || [])])],
      audio: meta.ingest?.org && vs.some((v) => v.audio) ? { whole: "", durationSec: 0, chanter: null } : null,
      bhashya: meta.ingest?.bhashya ? { translator: meta.ingest.bhashya.translator, edition: meta.ingest.bhashya.edition } : null,
    });
    if (meta.scope === "complete" && vs.length !== meta.expect) err(`${meta.id}: ${vs.length} mantras, expected ${meta.expect}`);
    for (const v of vs) {
      if (!v.sa?.length) err(`${v.id}: no Devanagari`);
      if (!v.iast?.length) err(`${v.id}: no IAST`);
      if (!v.tr?.text) err(`${v.id}: no Śaṅkara-tradition translation`);
      if (v.audio && !/^https:\/\//.test(v.audio.mp3)) err(`${v.id}: audio URL is not https`);
      if (v.hasBhashya !== Boolean(bh[v.id])) err(`${v.id}: hasBhashya=${v.hasBhashya} but commentary ${bh[v.id] ? "present" : "absent"}`);
    }
    verses.push(...vs);
  }
  texts.sort((a, b) => a.order - b.order);
  // whole-recording audio for each text, from the cached manifest when available (not required)
  const audioIndexPath = join(ROOT, ".cache", "org", "api_index.json");
  if (await exists(audioIndexPath)) {
    const audio = (await readJson(audioIndexPath)).audio || {};
    for (const t of texts) {
      const meta = await readJson(join(DATA, "corpus", t.id, "meta.json"));
      const a = audio[meta.ingest?.org];
      if (t.audio && a?.whole) t.audio = { whole: a.whole, durationSec: a.dur, chanter: CHANTER[meta.ingest.org] || null };
    }
  } else {
    const prev = join(ROOT, "public", "data", "kb.json");
    if (await exists(prev)) for (const t of (await readJson(prev)).texts) { const x = texts.find((y) => y.id === t.id); if (x && t.audio) x.audio = t.audio; }
  }
  const verseById = new Map(verses.map((v) => [v.id, v]));
  const abbrevOf = new Map(texts.map((t) => [t.id, t.abbrev]));
  const textOf = (vid) => texts.find((t) => vid.startsWith(`${t.abbrev}_`));

  // ── curated layer ───────────────────────────────────────────────────────────────────────────────
  const C = join(DATA, "curated");
  const { concepts, categories } = await readJson(join(C, "concepts.json"));
  const { dilemmas } = await readJson(join(C, "dilemmas.json"));
  const { stories, persons } = await readJson(join(C, "stories.json"));
  const { paths } = await readJson(join(C, "paths.json"));
  const { crossrefs } = await readJson(join(C, "crossrefs.json"));
  const { anchors } = await readJson(join(C, "anchors.json"));
  const { corpora: extCorpora } = await readJson(join(C, "external.json"));
  const extText = (await exists(join(C, "external-text.json"))) ? await readJson(join(C, "external-text.json")) : {};
  const rubric = await readJson(join(C, "rubric.json"));

  const nodes = [];
  const edges = [];
  const addNode = (n) => nodes.push(n);
  const addEdge = (e) => edges.push(e);

  for (const t of texts) addNode({ id: `up:${t.id}`, type: "Upanishad", label: t.iast, sub: t.en, up: t.id });
  for (const v of verses) {
    const ab = abbrevOf.get(v.up);
    addNode({ id: v.id, type: "Verse", label: `${ab} ${v.ref}`, sub: snippet(v.tr?.text || ""), up: v.up, ref: v.ref });
    addEdge({ s: v.id, t: `up:${v.up}`, type: "PART_OF", basis: "text" });
  }
  for (const t of texts) {
    const vs = verses.filter((v) => v.up === t.id).sort((a, b) => a.order - b.order);
    for (let i = 1; i < vs.length; i++) if (adjacent(vs[i - 1].ref, vs[i].ref, t.scope)) addEdge({ s: vs[i - 1].id, t: vs[i].id, type: "NEXT", basis: "text" });
  }
  for (const c of concepts) {
    addNode({ id: `concept:${c.id}`, type: "Concept", label: cap(c.iast), sub: c.en });
    for (const x of c.teaches) addEdge({ s: x.verse, t: `concept:${c.id}`, type: "TEACHES", basis: "editorial", why: x.why, reviewed: false });
    for (const x of c.contrasts) addEdge({ s: `concept:${c.id}`, t: `concept:${x.with}`, type: "CONTRASTS_WITH", basis: "editorial", why: x.why, verse: x.verse, reviewed: false });
    if (!categories[c.category]) err(`concept ${c.id}: unknown category ${c.category}`);
  }
  for (const d of dilemmas) {
    addNode({ id: `dilemma:${d.id}`, type: "Dilemma", label: d.en, sub: d.desc });
    for (const x of d.verses) addEdge({ s: x.verse, t: `dilemma:${d.id}`, type: "DIAGNOSES", basis: "editorial", role: x.role, why: x.why, reviewed: false });
    for (const c of d.concepts) addEdge({ s: `concept:${c}`, t: `dilemma:${d.id}`, type: "DIAGNOSES", basis: "editorial", why: `A key idea for "${d.en}".`, reviewed: false });
  }
  for (const a of rubric.axes) {
    addNode({ id: `axis:${a.id}`, type: "Axis", label: a.label, sub: a.en });
    for (const c of a.grounds) addEdge({ s: `concept:${c}`, t: `axis:${a.id}`, type: "GROUNDS", basis: "editorial", why: `${a.label} is scored against this idea.`, reviewed: false });
  }
  for (const p of persons) addNode({ id: `person:${p.id}`, type: "Person", label: p.iast, sub: p.role });
  for (const s of stories) {
    addNode({ id: `story:${s.id}`, type: "Story", label: s.title, sub: s.summary });
    for (const v of s.verses) addEdge({ s: v, t: `story:${s.id}`, type: "IN_STORY", basis: "text" });
    for (const p of s.cast) addEdge({ s: `person:${p}`, t: `story:${s.id}`, type: "IN_STORY", basis: "text" });
  }
  const external = {};
  for (const x of crossrefs) {
    for (const side of [x.a, x.b]) {
      const corpus = side.split("_")[0];
      if (!extCorpora[corpus] || external[side]) continue;
      const cfg = extCorpora[corpus];
      const ref = side.slice(corpus.length + 1);
      external[side] = { label: `${corpus} ${ref}`, corpus: cfg.name, url: extUrl(cfg, side, ref) };
      addNode({ id: side, type: "External", label: `${corpus} ${ref}`, sub: `${cfg.title} · ${cfg.name}`, url: external[side].url || undefined });
      validExternal(corpus, ref, cfg) || err(`cross-reference ${side}: not a valid ${cfg.title} reference`);
    }
    addEdge({ s: x.a, t: x.b, type: "CROSS_REFERENCES", basis: x.kind === "echo" ? "editorial" : "text", kind: x.kind, why: x.note });
  }
  for (const d of dilemmas) for (const e of d.external || []) {
    const corpus = e.split("_")[0], cfg = extCorpora[corpus];
    if (!cfg) { err(`dilemma ${d.id}: unknown external ${e}`); continue; }
    external[e] ||= { label: `${corpus} ${e.slice(corpus.length + 1)}`, corpus: cfg.name, url: extUrl(cfg, e, e.slice(corpus.length + 1)) };
  }

  // ── integrity gate ──────────────────────────────────────────────────────────────────────────────
  const ids = new Map();
  for (const n of nodes) { if (ids.has(n.id)) err(`duplicate node id ${n.id}`); ids.set(n.id, n); }
  const seen = new Set();
  const degree = new Map();
  for (const e of edges) {
    if (!ids.has(e.s)) err(`${e.type} edge from missing node ${e.s}`);
    if (!ids.has(e.t)) err(`${e.type} edge to missing node ${e.t}`);
    if (e.s === e.t) err(`self-loop ${e.type} on ${e.s}`);
    const k = `${e.type}|${e.s}|${e.t}`;
    if (seen.has(k)) err(`duplicate edge ${k}`);
    seen.add(k);
    degree.set(e.s, (degree.get(e.s) || 0) + 1);
    degree.set(e.t, (degree.get(e.t) || 0) + 1);
    if (["TEACHES", "DIAGNOSES", "CONTRASTS_WITH", "GROUNDS"].includes(e.type) && !e.why) err(`${k} has no 'why'`);
  }
  for (const n of nodes) if (["Concept", "Dilemma", "Axis", "Story", "Person"].includes(n.type) && !degree.get(n.id)) err(`${n.type} ${n.id} is isolated`);

  // Anchors: every curated verse reference must carry the expected Devanagari.
  const curatedRefs = new Set([
    ...concepts.flatMap((c) => [...c.teaches.map((x) => x.verse), ...c.contrasts.map((x) => x.verse)]),
    ...dilemmas.flatMap((d) => d.verses.map((x) => x.verse)),
    ...paths.flatMap((p) => p.steps.map((s) => s.node)).filter((n) => verseById.has(n) || /^[A-Z][a-zA-Z]*_\d/.test(n)),
    ...crossrefs.flatMap((x) => [x.a, x.b]).filter((s) => !extCorpora[s.split("_")[0]]),
  ]);
  let anchorChecks = 0;
  for (const ref of curatedRefs) {
    const v = verseById.get(ref);
    if (!v) { err(`curated reference ${ref} is not in the corpus`); continue; }
    const a = anchors[ref];
    if (!a) { err(`curated reference ${ref} has no anchor in anchors.json`); continue; }
  }
  for (const [ref, a] of Object.entries(anchors)) {
    const v = verseById.get(ref);
    if (!v) { err(`anchor ${ref}: verse not in corpus`); continue; }
    const text = normDeva(v.sa.join(" "));
    const missing = a.sa.filter((f) => !text.includes(normDeva(f)));
    anchorChecks++;
    if (missing.length) err(`anchor ${ref}: Devanagari lacks ${missing.join(" | ")}`);
    if (a.bhashya && !v.hasBhashya) err(`anchor ${ref}: Śaṅkara's commentary expected but missing`);
  }
  for (const c of concepts) if (c.teaches.length < 2) err(`concept ${c.id} has ${c.teaches.length} grounding verse(s); needs ≥ 2`);
  for (const d of dilemmas) {
    if (d.verses.length < 3) err(`dilemma ${d.id} has ${d.verses.length} verses; needs ≥ 3`);
    if (!d.verses.some((x) => textOf(x.verse)?.scope === "complete")) err(`dilemma ${d.id} has no verse from a complete Upanishad`);
    if (!d.preyas || !d.shreyas) err(`dilemma ${d.id} needs both preyas and shreyas`);
    if (d.cues.length < 3) err(`dilemma ${d.id} needs ≥ 3 cues`);
    for (const c of d.concepts) if (!concepts.some((x) => x.id === c)) err(`dilemma ${d.id}: unknown concept ${c}`);
  }
  if (rubric.axes.length !== 6) err(`rubric has ${rubric.axes.length} axes; expected 6`);
  for (const a of rubric.axes) {
    if (a.levels.length !== 5) err(`axis ${a.id} needs 5 level descriptors (0–4)`);
    if (a.grounds.length < 2) err(`axis ${a.id} needs ≥ 2 grounding concepts`);
    for (const c of a.grounds) if (!concepts.some((x) => x.id === c)) err(`axis ${a.id}: unknown concept ${c}`);
  }
  for (const p of rubric.presets) if (!dilemmas.some((d) => d.id === p.expectDilemma)) err(`preset ${p.id}: unknown dilemma ${p.expectDilemma}`);
  for (const re of [rubric.checks.flatteryOpener, rubric.checks.flatteryPhrase, rubric.checks.engagementBait, ...rubric.pressures.flatMap((p) => p.cues)]) {
    try { new RegExp(re, "i"); } catch { err(`rubric regex does not compile: ${re}`); }
  }
  for (const p of paths) for (const s of p.steps) {
    if (s.node === "reflect") continue;
    if (s.node.startsWith("concept:") ? !concepts.some((c) => `concept:${c.id}` === s.node) : !verseById.has(s.node)) err(`path ${p.id}: step ${s.node} does not resolve`);
  }
  for (const s of stories) for (const p of s.cast) if (!persons.some((x) => x.id === p)) err(`story ${s.id}: unknown person ${p}`);

  // Cross-references: identical/parallel passages must actually share their wording.
  const crossChecks = [];
  for (const x of crossrefs) {
    if (x.kind === "echo") continue;
    const A = verseById.get(x.a), B = verseById.get(x.b);
    let sim = null;
    if (A && B) sim = dice(normDeva(A.sa.join("")), normDeva(B.sa.join("")));
    else {
      const local = A || B, other = extText[A ? x.b : x.a];
      if (local && other?.sa) sim = dice(normDeva(local.sa.join("")), normDeva(other.sa.join("")));
      else if (local && other?.iast) sim = dice(foldIast(local.iast.join("")), foldIast(other.iast.join("")));
      else warnings.push(`cross-reference ${x.a} ≡ ${x.b}: external text not available locally; wording not checked`);
    }
    if (sim !== null) {
      crossChecks.push({ a: x.a, b: x.b, kind: x.kind, similarity: Number(sim.toFixed(3)) });
      const min = x.kind === "identical" ? 0.75 : 0.45;
      if (sim < min) err(`cross-reference ${x.a} ${x.kind} ${x.b}: wording similarity ${sim.toFixed(2)} < ${min}`);
    }
  }

  // ── layout for the full map (deterministic) ───────────────────────────────────────────────────────
  const layout = forceLayout(nodes, edges);

  // ── artifacts ─────────────────────────────────────────────────────────────────────────────────────
  const verseLite = verses.map((v) => ({
    id: v.id, up: v.up, ref: v.ref, section: v.section, sa: v.sa.join(" "), iast: v.iast.join(" "),
    tr: v.tr?.text || "", trBy: v.tr?.by || "", audio: v.audio?.mp3 || null, hasBhashya: v.hasBhashya,
  }));
  const kb = { texts, verses: verseLite, concepts, dilemmas, stories, persons, external };
  const graph = { nodes, edges, layout };
  const corpusHash = (hash(JSON.stringify(verseLite)) >>> 0).toString(16).padStart(8, "0");
  const runFiles = (await exists(join(ROOT, "public", "data", "runs"))) ? (await readdir(join(ROOT, "public", "data", "runs"))).filter((f) => f.endsWith(".json") && f !== "index.json") : [];
  const complete = texts.filter((t) => t.scope === "complete");
  const facts = {
    texts: { complete: complete.length, excerpts: texts.length - complete.length, total: texts.length },
    mantras: { complete: complete.reduce((a, t) => a + t.count, 0), excerpts: texts.filter((t) => t.scope === "excerpts").reduce((a, t) => a + t.count, 0), total: verses.length },
    bhashyaVerses: verses.filter((v) => v.hasBhashya).length,
    audioVerses: verses.filter((v) => v.audio).length,
    concepts: concepts.length, dilemmas: dilemmas.length, stories: stories.length, persons: persons.length,
    paths: paths.length, axes: rubric.axes.length, presets: rubric.presets.length,
    nodes: nodes.length, edges: edges.length, anchors: anchorChecks, crossCorpus: Object.keys(external).length,
    runs: runFiles.length, corpusHash,
  };
  const outputs = {
    "kb.json": JSON.stringify(kb),
    "graph.json": JSON.stringify(graph),
    "rubric.json": JSON.stringify(rubric),
    "paths.json": JSON.stringify({ paths, categories }),
    "facts.json": JSON.stringify(facts, null, 2),
  };
  for (const t of texts) {
    outputs[`corpus/${t.id}.json`] = JSON.stringify(verses.filter((v) => v.up === t.id));
    outputs[`bhashya/${t.id}.json`] = JSON.stringify(bhashya[t.id] || {});
  }
  return { outputs, errors, warnings, facts, crossChecks };
}

const CHANTER = { isha: "Ravindra Sathe", katha: "Ravindra Sathe", prashna: "Ravindra Sathe", taittiriya: "Ravindra Sathe", kena: "Ashit Desai", mundaka: "Ashit Desai", mandukya: "Ashit Desai" };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function snippet(t) {
  const s = t.replace(/\s+/g, " ").trim();
  return s.length > 110 ? `${s.slice(0, 107).replace(/\s+\S*$/, "")}…` : s;
}
function adjacent(a, b, scope) {
  if (scope === "complete") return true;
  const pa = a.split("."), pb = b.split(".");
  return pa.length === pb.length && pa.slice(0, -1).join(".") === pb.slice(0, -1).join(".") && Number(pb.at(-1)) === Number(pa.at(-1)) + 1;
}
function extUrl(cfg, id, ref) {
  if (!cfg.url) return null;
  if (cfg.passageKey) {
    const [m, s, v] = ref.split(".").map(Number);
    const key = cfg.passageKey.replace("{m:02}", String(m).padStart(2, "0")).replace("{s:03}", String(s).padStart(3, "0")).replace("{v:03}", String(v).padStart(3, "0"));
    return cfg.url.replace("{key}", key);
  }
  return cfg.url.replace("{id}", id);
}
function validExternal(corpus, ref, cfg) {
  const p = ref.split(".").map(Number);
  if (corpus === "BG") return p.length === 2 && p[0] >= 1 && p[0] <= 18 && p[1] >= 1 && p[1] <= cfg.chapterVerses[p[0] - 1];
  if (corpus === "RV") return p.length === 3 && p[0] >= 1 && p[0] <= 10 && p[1] >= 1 && p[2] >= 1;
  return true;
}

// Fruchterman–Reingold with a seeded start: verses cluster round their Upanishad, ideas sit in the middle.
function forceLayout(nodes, edges) {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const ups = nodes.filter((n) => n.type === "Upanishad");
  const P = new Map();
  const R = 900;
  ups.forEach((u, i) => P.set(u.id, [R * Math.cos((2 * Math.PI * i) / ups.length), R * Math.sin((2 * Math.PI * i) / ups.length)]));
  for (const n of nodes) {
    if (P.has(n.id)) continue;
    const hub = n.up ? P.get(`up:${n.up}`) : null;
    P.set(n.id, hub ? [hub[0] + (rnd() - 0.5) * 300, hub[1] + (rnd() - 0.5) * 300] : [(rnd() - 0.5) * 500, (rnd() - 0.5) * 500]);
  }
  const ids = nodes.map((n) => n.id);
  const idx = new Map(ids.map((id, i) => [id, i]));
  const X = ids.map((id) => P.get(id)[0]), Y = ids.map((id) => P.get(id)[1]);
  const E = edges.filter((e) => e.type !== "NEXT").map((e) => [idx.get(e.s), idx.get(e.t), e.type === "PART_OF" ? 0.35 : 1]);
  const k = 46, n = ids.length;
  for (let it = 0; it < 260; it++) {
    const t = 60 * (1 - it / 260) + 2;
    const dx = new Float64Array(n), dy = new Float64Array(n);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      let ex = X[i] - X[j], ey = Y[i] - Y[j];
      const d2 = ex * ex + ey * ey + 0.01, f = (k * k) / d2;
      dx[i] += ex * f; dy[i] += ey * f; dx[j] -= ex * f; dy[j] -= ey * f;
    }
    for (const [a, b, w] of E) {
      const ex = X[a] - X[b], ey = Y[a] - Y[b], d = Math.sqrt(ex * ex + ey * ey) + 0.01, f = (d * w) / k;
      dx[a] -= (ex / d) * f * d * 0.02; dy[a] -= (ey / d) * f * d * 0.02; dx[b] += (ex / d) * f * d * 0.02; dy[b] += (ey / d) * f * d * 0.02;
    }
    for (let i = 0; i < n; i++) {
      dx[i] -= X[i] * 0.004; dy[i] -= Y[i] * 0.004; // gentle gravity
      const d = Math.sqrt(dx[i] * dx[i] + dy[i] * dy[i]) + 0.01, s = Math.min(d, t) / d;
      X[i] += dx[i] * s; Y[i] += dy[i] * s;
    }
  }
  return Object.fromEntries(ids.map((id, i) => [id, [Math.round(X[i]), Math.round(Y[i])]]));
}
