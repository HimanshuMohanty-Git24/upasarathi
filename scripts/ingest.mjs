// npm run data:sources — fetch and segment the source texts into data/corpus/<id>/{verses,bhashya}.json.
//
// Auto-discovers every data/corpus/<id>/meta.json and follows its `ingest` block:
//   org      upanishads.org.in slug: Devanagari, IAST and a secondary translation per passage, plus the chant manifest
//   refs     (excerpt texts only) which passages to include, with ranges like "8.7.1-4"
//   pdf      markers for the Śaṅkara-tradition English in 108upanishads.pdf (text extracted to .cache/108upanishads.txt)
//   bhashya  Wisdom Library book holding Śaṅkara's commentary; which verses get it is set in data/curated/anchors.json
// Network results are cached in .cache/, so re-runs are offline and deterministic. Output is committed; `npm run data`
// never touches the network.
import { mkdir, readFile, readdir, writeFile, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, ".cache");
const CORPUS = join(ROOT, "data", "corpus");
const UA = "Mozilla/5.0 (research-client)";
const PDF_TEXT = process.env.PDF108_TEXT || join(CACHE, "108upanishads.txt");
const GITA_VERSES = process.env.GITAVISWA_VERSES || join(ROOT, "..", "..", "GitaGraph", "public", "data", "gita-verses.json");
const RV_TEXT = process.env.VEDANVAYA_RV || join(ROOT, "..", "..", "VedaGraph", "data", "canonical", "rigveda_full_v1", "text_versions.jsonl");
const ALT_EXCLUDE = /Max M[üu]ller|Sacred Books of the East/i; // colonial-era translations are not shown

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exists = (p) => access(p).then(() => true, () => false);
const log = (...a) => console.log(...a);

async function cached(file, url, delay = 700) {
  if (await exists(file)) return readFile(file, "utf8");
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, text, "utf8");
      await sleep(delay);
      return text;
    } catch (e) {
      if (attempt === 3) throw new Error(`${url}: ${e.message}`);
      await sleep(2000 * attempt);
    }
  }
}

// ── text helpers ──────────────────────────────────────────────────────────────────────────────────
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", mdash: "—", ndash: "–", hellip: "…" };
const unescape = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => (e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENT[e.toLowerCase()] ?? m));
const strip = (s) => unescape(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
const htmlLines = (html) => (html ? html.split(/<br\s*\/?>|\n/i).map(strip).filter(Boolean) : []);
const grab = (html, cls) => html.match(new RegExp(`<p class="${cls}"[^>]*>([\\s\\S]*?)</p>`))?.[1];
// One normaliser for ingest, build, checks and tests.
import { normDeva } from "../src/lib/core/text.ts";
const ROMAN = { i: 1, v: 5, x: 10, l: 50 };
function roman(s) {
  let n = 0, prev = 0;
  for (const c of s.toLowerCase().split("").reverse()) { const v = ROMAN[c]; n += v < prev ? -v : v; prev = Math.max(prev, v); }
  return n;
}
function expandRefs(list) {
  const out = [];
  for (const r of list) {
    const m = r.match(/^(.*\.)(\d+)-(\d+)$/);
    if (m) for (let i = Number(m[2]); i <= Number(m[3]); i++) out.push(`${m[1]}${i}`);
    else out.push(r);
  }
  return out;
}
const refKey = (r) => r.split(".").map((n) => n.padStart(4, "0")).join(".");

// ── 108 Upanishads PDF: Śaṅkara-tradition translations ─────────────────────────────────────────────
const pdfLines = (await readFile(PDF_TEXT, "utf8")).replace(/\f/g, "\n").split(/\r?\n/);
function pdfTranslations(spec) {
  const start = new RegExp(spec.start), end = new RegExp(spec.end), marker = new RegExp(spec.marker);
  const s = pdfLines.findIndex((l, i) => start.test(l.trim()) && pdfLines.slice(i + 1, i + 4).some((x) => /Transla/i.test(x)));
  const e = pdfLines.findIndex((l, i) => i > s && end.test(l));
  if (s < 0 || e < 0) throw new Error(`PDF block not found for ${spec.start}`);
  const translator = pdfLines.slice(s + 1, s + 4).find((x) => /Transla/i.test(x)).replace(/^.*?\bby\s+/i, "").trim();
  const map = new Map();
  let cur = null;
  for (const raw of pdfLines.slice(s + 1, e)) {
    const l = raw.trim();
    if (!l || /^\d{1,4}$/.test(l)) continue;
    const m = l.match(marker);
    if (m) {
      cur = spec.ref.map((p) => (p.startsWith("R$") ? String(roman(m[Number(p.slice(2))])) : m[Number(p.slice(1))])).join(".");
      const t = m[spec.text] || "";
      map.set(cur, map.has(cur) && spec.join ? `${map.get(cur)}\n${t}` : t);
      continue;
    }
    if (/^Om\s*!/.test(l)) { cur = null; continue; }
    if (cur) map.set(cur, `${map.get(cur)} ${l}`);
  }
  // Joint translations ("VI-i-2-3:" renders mantras 2 and 3 together): give each mantra the shared text, marked.
  const out = new Map();
  for (const [k, raw] of map) {
    const v = raw.replace(/[ \t]+/g, " ").replace(/(\w)- (\w)/g, "$1$2").replace(/ ?\n ?/g, "\n").trim();
    const r = k.match(/^(.*\.)?(\d+)-(\d+)$/);
    if (!r) { out.set(k, { text: v }); continue; }
    const base = r[1] || "";
    for (let i = Number(r[2]); i <= Number(r[3]); i++) out.set(`${base}${i}`, { text: v, joint: `${base}${r[2]}–${r[3]}` });
  }
  return { map: out, translator };
}

// ── Wisdom Library: Śaṅkara's commentary ──────────────────────────────────────────────────────────
const FOOTER = /\n\s*(Footnotes and references|Like what you read|Let'?s grow together|Other print editions|Help me keep this site|Last Updated|\d{1,2} \w+,? \d{4}\s*-->)/i;
function pageText(html) {
  const s = html.indexOf('id="scontent"');
  let body = s >= 0 ? html.slice(s) : html;
  body = body.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "").replace(/<(br|p|div|h\d|li)[^>]*>/gi, "\n");
  let text = unescape(body.replace(/<[^>]+>/g, "")).replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n");
  const f = text.search(FOOTER);
  if (f > 0) text = text.slice(0, f);
  return text.replace(/^[^\n]*scontent">?\n?/, "").trim();
}
const hasDeva = (s) => /[ऀ-ॿ]{3}/.test(s);
const tidy = (s) => s.replace(/\s*\[\d+\]/g, "").replace(/\n{2,}/g, "\n").replace(/ ?• ?/g, " ").trim();
function commentaryAfterTranslation(lines) {
  // Devanagari, IAST, "N. translation", then commentary paragraphs.
  const t = lines.findIndex((l) => /^\d+(-\d+)?\.\s/.test(l) && !hasDeva(l));
  return t >= 0 ? lines.slice(t + 1).filter((l) => !hasDeva(l) && !/\|\|/.test(l)).join("\n") : "";
}
function extractBhashya(text, mode, key) {
  if (mode === "page") {
    const m = text.match(/(Śrī |Shri )?(Shankara|Śaṅkara|Sankara)[’'`]?s?\s+(Commentary|Bhāṣya|Bhashya)\s*(\(commentary\))?\s*:?\s*\n|Commentary\s*\((Śaṅkara|Shankara)[^)]*\)\s*:|\n(Bhāṣya|Commentary)\s*:/i);
    const deva = text.slice(0, m ? m.index : 600);
    const body = m ? text.slice(m.index + m[0].length) : commentaryAfterTranslation(text.split("\n"));
    return { body: tidy(body.replace(/^\s*Com\.\s*[—-]\s*/, "")), deva };
  }
  if (mode === "ordinal") {
    const blocks = text.split(/Upaniṣad text\s*:/i).slice(1);
    for (const b of blocks) {
      const [mula, ...rest] = b.split(/Commentary\s*\(Śaṅkara Bhāṣya\)\s*:/i);
      const ord = mula.match(/\((\d+)\)\s*$/m)?.[1] || mula.trim().match(/\((\d+)\)[^()]*$/)?.[1];
      if (ord === key) return { body: tidy(rest.join("\n")), deva: "", mula: tidy(mula) };
    }
    return null;
  }
  if (mode === "heading") {
    const parts = text.split(/\n?Verse (\d+\.\d+\.\d+)\s*:/);
    for (let i = 1; i < parts.length; i += 2) {
      if (parts[i] !== key) continue;
      const lines = parts[i + 1].split("\n").map((l) => l.trim()).filter(Boolean);
      return { body: tidy(commentaryAfterTranslation(lines)), deva: lines.filter(hasDeva).join(" ") };
    }
    return null;
  }
}
async function fetchBhashya(book, loc, fragments) {
  const [doc, key] = loc.split("#");
  const mode = !key ? "page" : /^\d+$/.test(key) ? "ordinal" : "heading";
  let page = doc;
  for (let hop = 0; hop < 14; hop++) {
    const url = `https://www.wisdomlib.org/hinduism/book/${book}/d/${page}.html`;
    const html = await cached(join(CACHE, "wisdomlib", book, `${page}.html`), url, 900);
    const text = pageText(html);
    const got = extractBhashya(text, mode, key);
    if (got && got.body.length > 40) {
      // Verify against the verse's own Devanagari (heading mode) or, for one-verse pages, any Devanagari on the page.
      const deva = mode === "heading" ? got.deva : (text.match(/[ऀ-ॿ][ऀ-ॿ\s।॥ऽ॰]+/g) || []).join(" ");
      if (deva && hasDeva(deva)) {
        const d = normDeva(deva);
        if (!fragments.some((f) => d.includes(normDeva(f)))) throw new Error(`${url}: Devanagari on page does not match anchor (${fragments.join(" | ")})`);
      }
      return { text: got.body, source: url, verifiedBy: deva && hasDeva(deva) ? "devanagari" : mode === "ordinal" ? "text-number" : "page-title" };
    }
    if (mode !== "heading") break;
    page = html.match(/href="\/hinduism\/book\/[^"]+\/d\/(doc\d+)\.html"[^>]*>\s*Next/i)?.[1]; // section continues on the next page
    if (!page) break;
  }
  throw new Error(`commentary not found at ${book}/${loc}`);
}

// ── main ──────────────────────────────────────────────────────────────────────────────────────────
const anchors = JSON.parse(await readFile(join(ROOT, "data", "curated", "anchors.json"), "utf8")).anchors;
const audioIndex = JSON.parse(await cached(join(CACHE, "org", "api_index.json"), "https://upanishads.org.in/api/content/index")).audio || {};
const ids = (await readdir(CORPUS, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
const problems = [];

for (const id of ids) {
  const metaPath = join(CORPUS, id, "meta.json");
  if (!(await exists(metaPath))) continue;
  const meta = JSON.parse(await readFile(metaPath, "utf8"));
  const ing = meta.ingest;
  const slug = ing.org;
  const contents = await cached(join(CACHE, "org", `${slug}.html`), `https://upanishads.org.in/u/${slug}`);
  const urlRefs = [...contents.matchAll(new RegExp(`href="/u/${slug}/p/([^"]+)"`, "g"))].map((m) => m[1]);
  const byRef = new Map(urlRefs.map((u) => [u.replace(/~/g, "."), u]));
  const wanted = ing.refs ? expandRefs(ing.refs) : [...byRef.keys()].filter((r) => /^\d+(\.\d+)*$/.test(r));
  const pdf = pdfTranslations(ing.pdf);
  const au = audioIndex[slug] || {};
  const verses = [];
  for (const ref of wanted) {
    const urlRef = byRef.get(ref);
    if (!urlRef) { problems.push(`${id}: passage ${ref} not on upanishads.org.in`); continue; }
    const html = await cached(join(CACHE, "org", "p", slug, `${urlRef.replace(/[^0-9A-Za-z.~-]/g, "_")}.html`), `https://upanishads.org.in/u/${slug}/p/${urlRef}`);
    const vid = `${meta.abbrev}_${ref}`;
    const crumb = strip(html.match(/<p class="crumb">([\s\S]*?)<\/p>/)?.[1] || "").split("/").pop()?.trim() || "";
    const altText = grab(html, "translation");
    const altBy = strip(grab(html, "translation-src") || "");
    const auKey = [ref, ref.replace(/\./g, "/")].find((k) => au.t?.[k]);
    verses.push({
      id: vid, ref, section: crumb,
      sa: htmlLines(grab(html, "sloka")),
      iast: htmlLines(grab(html, "sloka-iast iast")),
      tr: pdf.map.has(ref) ? { text: pdf.map.get(ref).text, by: pdf.translator, source: "108 Upanishads (comp. R. Sheppard)", ...(pdf.map.get(ref).joint ? { joint: pdf.map.get(ref).joint } : {}) } : null,
      alt: altText && !ALT_EXCLUDE.test(altBy) ? [{ text: strip(altText), by: altBy.split("·")[0].trim(), cite: altBy, source: "upanishads.org.in" }] : [],
      audio: auKey && au.t[auKey][2] ? { mp3: au.t[auKey][2], whole: [au.t[auKey][0], au.t[auKey][1]] } : null,
      hasBhashya: false,
    });
  }
  verses.sort((a, b) => refKey(a.ref).localeCompare(refKey(b.ref)));
  verses.forEach((v, i) => (v.order = i + 1));

  // Śaṅkara's commentary for this text's anchor verses
  const bhashya = {};
  const wantB = Object.entries(anchors).filter(([vid, a]) => a.bhashya && vid.startsWith(`${meta.abbrev}_`));
  if (wantB.length && !ing.bhashya) problems.push(`${id}: anchors ask for commentary but meta has no bhashya book`);
  for (const [vid, a] of wantB) {
    if (!ing.bhashya) break;
    try {
      const b = await fetchBhashya(ing.bhashya.book, a.bhashya, a.sa);
      bhashya[vid] = { author: "Śaṅkara", lang: "en", translator: ing.bhashya.translator, edition: ing.bhashya.edition, text: b.text, source: b.source, verifiedBy: b.verifiedBy };
      const v = verses.find((x) => x.id === vid);
      if (v) v.hasBhashya = true;
      else problems.push(`${vid}: commentary fetched but verse not in corpus`);
    } catch (e) {
      problems.push(`${vid}: ${e.message}`);
    }
  }

  await writeFile(join(CORPUS, id, "verses.json"), JSON.stringify(verses, null, 1), "utf8");
  await writeFile(join(CORPUS, id, "bhashya.json"), JSON.stringify(bhashya, null, 1), "utf8");
  const noTr = verses.filter((v) => !v.tr).length;
  log(`${id.padEnd(15)} ${String(verses.length).padStart(3)} passages · ${verses.length - noTr} Śaṅkara-tradition tr. (${pdf.translator}) · ${verses.filter((v) => v.alt.length).length} alt · ${verses.filter((v) => v.audio).length} audio · ${Object.keys(bhashya).length} bhāṣya`);
}

// ── external texts for cross-corpus checks (local sibling repos; optional) ─────────────────────────
const crossrefs = JSON.parse(await readFile(join(ROOT, "data", "curated", "crossrefs.json"), "utf8")).crossrefs;
const external = {};
if (await exists(GITA_VERSES)) {
  const gita = JSON.parse(await readFile(GITA_VERSES, "utf8"));
  for (const c of crossrefs) for (const side of [c.a, c.b]) {
    if (!side.startsWith("BG_")) continue;
    const v = gita.verses.find((x) => x.id === side);
    if (v) external[side] = { sa: v.sanskrit, iast: v.iast, source: "GitaViśva gita-verses.json (gita/gita)" };
  }
} else problems.push(`GitaViśva data not found at ${GITA_VERSES}; BG parallels will not be text-checked`);
if (await exists(RV_TEXT)) {
  const wantRV = crossrefs.flatMap((c) => [c.a, c.b]).filter((s) => s.startsWith("RV_"));
  const lines = (await readFile(RV_TEXT, "utf8")).split("\n");
  for (const rv of wantRV) {
    const [m, s, v] = rv.slice(3).split(".").map(Number);
    const loc = `b${String(m).padStart(2, "0")}_h${String(s).padStart(3, "0")}_${v}_`;
    const hit = lines.find((l) => l.includes(`"source_locator":"${loc}`) || l.includes(`"source_locator": "${loc}`));
    if (hit) { const r = JSON.parse(hit); external[rv] = { iast: [r.text_nfc || r.text_original], source: `VedAnvaya ${r.source_id} ${r.source_locator}` }; }
  }
} else problems.push(`VedAnvaya data not found at ${RV_TEXT}; RV parallels will not be text-checked`);
await writeFile(join(ROOT, "data", "curated", "external-text.json"), JSON.stringify(external, null, 1), "utf8");
log(`external texts: ${Object.keys(external).join(", ") || "none"}`);

if (problems.length) { log(`\n${problems.length} problem(s):\n` + problems.join("\n")); process.exitCode = 1; }
