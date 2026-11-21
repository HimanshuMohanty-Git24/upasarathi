// A self-contained HTML report for one or more harness runs: no scripts, no external assets, opens from disk.
import type { HarnessRun } from "../src/lib/core/pipeline.ts";
import type { Checks } from "../src/lib/core/checks.ts";
import type { KnowledgeBase, Rubric } from "../src/lib/core/types.ts";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Minimal, safe markdown: paragraphs, "- " and "1. " lists, > quotes, ### headings, **bold**, *italic*, [citations]. */
export function md(text: string): string {
  const inline = (s: string) =>
    esc(s)
      .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
      .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, "$1<i>$2</i>")
      .replace(/\[([^\]\n]{2,80})\]/g, '<span class="cite">$1</span>');
  const out: string[] = [];
  let list: { tag: string; items: string[] } | null = null;
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`);
    para = [];
    if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.tag}>`);
    list = null;
  };
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const l = raw.trimEnd();
    if (!l.trim()) { flush(); continue; }
    const h = l.match(/^#{1,6}\s+(.*)/);
    if (h) { flush(); out.push(`<h4>${inline(h[1])}</h4>`); continue; }
    const q = l.match(/^\s*>\s?(.*)/);
    if (q) { flush(); out.push(`<blockquote>${inline(q[1])}</blockquote>`); continue; }
    const ul = l.match(/^\s*[-*•]\s+(.*)/);
    const ol = l.match(/^\s*\d+[.)]\s+(.*)/);
    if (ul || ol) {
      if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; }
      const tag = ul ? "ul" : "ol";
      if (!list || list.tag !== tag) { if (list) flush(); list = { tag, items: [] }; }
      list.items.push((ul || ol)![1]);
      continue;
    }
    if (list) flush();
    para.push(l.trim());
  }
  flush();
  return out.join("\n");
}

function checksHtml(c: Checks, kb: KnowledgeBase): string {
  const label = (id: string | null) => {
    if (!id) return "";
    const v = kb.verses.find((x) => x.id === id);
    const t = v && kb.texts.find((x) => x.id === v.up);
    return v && t ? `${t.abbrev} ${v.ref}` : id;
  };
  const rows: string[] = [];
  for (const q of c.quotes) rows.push(`<li class="${q.found ? "ok" : "bad"}">${q.script === "devanagari" ? "Sanskrit" : "IAST"} quotation ${q.found ? `found in ${esc(label(q.found))}` : "<b>not found anywhere in the corpus</b>"}: <q>${esc(q.quote.slice(0, 120))}</q></li>`);
  for (const q of c.englishQuotes) rows.push(`<li class="${q.found ? "ok" : "warn"}">Quoted translation ${q.found ? `matches ${esc(label(q.found))}` : "not found in any translation"}: <q>${esc(q.quote.slice(0, 120))}</q></li>`);
  for (const r of c.claimedRefs) rows.push(`<li class="${r.id ? "ok" : "bad"}">Reference ${esc(r.raw)} ${r.id ? `exists (${esc(label(r.id))})` : "<b>does not exist</b>"}${r.continuous ? " · continuous numbering" : ""}</li>`);
  if (c.flatteryOpener) rows.push(`<li class="warn">Opens with flattery: <q>${esc(c.flatteryOpener)}</q></li>`);
  for (const f of c.flatteryPhrases) rows.push(`<li class="warn">Flattering phrase: <q>${esc(f)}</q></li>`);
  if (c.engagementBait) rows.push(`<li class="warn">Ends with engagement bait: <q>${esc(c.engagementBait.slice(0, 120))}</q></li>`);
  for (const s of c.unsupportedClaims ?? []) rows.push(`<li class="warn">Unverified statistic or finding: <q>${esc(s.slice(0, 140))}</q></li>`);
  if (c.empty) rows.push(`<li class="bad">Empty answer</li>`);
  return rows.length ? `<ul class="checks">${rows.join("")}</ul>` : `<p class="muted">No flags.</p>`;
}

function runHtml(run: HarnessRun, kb: KnowledgeBase, rubric: Rubric, i: number): string {
  const d = run.diagnosis;
  const dil = d.dilemmas[0] && kb.dilemmas.find((x) => x.id === d.dilemmas[0].id);
  const verse = (id: string) => {
    const v = kb.verses.find((x) => x.id === id);
    const t = v && kb.texts.find((x) => x.id === v.up);
    return v && t ? `<li><b>${esc(t.abbrev)} ${esc(v.ref)}</b> <span class="muted">${esc(v.tr.slice(0, 200))}${v.tr.length > 200 ? "…" : ""}</span></li>` : "";
  };
  const j = run.judge;
  const axes = rubric.axes
    .map((a) => {
      const s = j.scores?.[a.id];
      const cell = (side: "baseline" | "realigned") => {
        const x = s?.[side];
        if (!x) return `<td class="muted">–</td>`;
        return `<td><span class="score s${x.score ?? "x"}">${x.score ?? "×"}</span>${x.evidence ? ` <q>${esc(x.evidence)}</q>` : ""}${x.verified ? "" : ' <span class="muted">(evidence not verbatim: not counted)</span>'}</td>`;
      };
      return `<tr><th>${esc(a.label)}<span class="muted"> · ${esc(a.en)}</span></th>${cell("baseline")}${cell("realigned")}</tr>`;
    })
    .join("");
  const verdict = j.verdict === "realigned" ? "Re-aligned answer preferred" : j.verdict === "baseline" ? "Baseline answer preferred" : j.verdict === "tie" ? "Tie" : "No verdict";
  return `
<section class="run" id="run-${i}">
  <header>
    <p class="eyebrow">${run.title ? esc(run.title) : "Prompt"}${run.control ? " · control" : ""}</p>
    <h2>${esc(run.prompt)}</h2>
    <p class="meta">Model under test <b>${esc(run.models.model)}</b> (${esc(run.models.provider)}) · judge <b>${esc(run.models.judgeModel)}</b> (${esc(run.models.judgeProvider)})${run.models.sameJudge ? ' · <span class="warn-t">same-model judge</span>' : ""} · ${esc(run.createdAt.slice(0, 19).replace("T", " "))} UTC · corpus ${esc(run.corpusHash)}</p>
  </header>
  <div class="diag">
    <div><span class="pill ${d.status === "SUPPORTED" ? "ok" : d.status === "PARTIAL" ? "mid" : "bad"}">${esc(d.status.replace(/_/g, " ").toLowerCase())}</span>${dil ? ` Reads as <b>${esc(dil.en.toLowerCase())}</b>.` : ""}${d.pressures.length ? ` Pressure: ${d.pressures.map((p) => esc(p.label.toLowerCase())).join("; ")}.` : ""}</div>
    ${dil ? `<div class="roads"><p><b class="preyas">Preyas</b> ${esc(dil.preyas)}</p><p><b class="shreyas">Śreyas</b> ${esc(dil.shreyas)}</p></div>` : ""}
    ${d.verses.length ? `<details><summary>Evidence packet: ${d.verses.length} mantras</summary><ul class="verses">${d.verses.map((v) => verse(v.id)).join("")}</ul></details>` : ""}
  </div>
  <div class="cols">
    <article class="pane preyas-b">
      <p class="eyebrow">A · Baseline <span class="muted">neutral prompt · ${(run.baseline.ms / 1000).toFixed(1)} s</span></p>
      ${run.baseline.error ? `<p class="bad-t">${esc(run.baseline.error.message)}</p>` : md(run.baseline.text)}
      ${run.baseline.provenance ? `<p class="muted small">${esc(run.baseline.provenance)}</p>` : ""}
      <p class="eyebrow mt">Checks</p>${checksHtml(run.checks.baseline, kb)}
    </article>
    <article class="pane shreyas-b">
      <p class="eyebrow">C · Re-aligned <span class="muted">grounded in the packet · ${(run.realigned.ms / 1000).toFixed(1)} s${run.realigned.repaired ? " · repaired once" : ""}</span></p>
      ${run.realigned.error ? `<p class="bad-t">${esc(run.realigned.error.message)}</p>` : md(run.realigned.text)}
      ${run.realigned.stripped.length ? `<p class="muted small">Removed citations outside the packet: ${run.realigned.stripped.map(esc).join(", ")}</p>` : ""}
      <p class="eyebrow mt">Checks</p>${checksHtml(run.checks.realigned, kb)}
    </article>
  </div>
  <div class="judge">
    <p class="eyebrow">E · Blind judge ${j.status !== "ok" ? `<span class="warn-t">${esc(j.status)}${j.error ? `: ${esc(j.error)}` : ""}</span>` : ""}</p>
    <p class="totals"><span class="preyas">Baseline ${j.totals.baseline}</span> <span class="muted">vs</span> <span class="shreyas">Re-aligned ${j.totals.realigned}</span> <span class="muted">of ${j.max} · ${j.comparableAxes} comparable axes · ${esc(verdict)}${j.verdictDerived ? " (derived from totals)" : ""}</span></p>
    ${j.summary ? `<p class="summary">${esc(j.summary)}</p>` : ""}
    <table><thead><tr><th>Axis</th><th>Baseline</th><th>Re-aligned</th></tr></thead><tbody>${axes}</tbody></table>
  </div>
</section>`;
}

export function renderReport(runs: HarnessRun[], ctx: { kb: KnowledgeBase; rubric: Rubric; version: string }): string {
  const { kb, rubric } = ctx;
  const multi = runs.length > 1;
  const summary = multi
    ? `<table class="bench"><thead><tr><th>Case</th><th>Baseline</th><th>Re-aligned</th><th>Verdict</th></tr></thead><tbody>${runs
        .map((r, i) => `<tr><td><a href="#run-${i}">${esc(r.title ?? r.prompt.slice(0, 60))}</a>${r.control ? ' <span class="muted">control</span>' : ""}</td><td class="preyas">${r.judge.totals.baseline} / ${r.judge.max}</td><td class="shreyas">${r.judge.totals.realigned} / ${r.judge.max}</td><td>${esc(r.judge.verdict ?? "–")}</td></tr>`)
        .join("")}</tbody></table>`
    : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>UpaSārathi harness report</title>
<style>
:root{--bg:#0a0c0b;--s:#131715;--s2:#191e1b;--l:rgba(226,236,229,.13);--t:#ecefe9;--t2:#b4bcb5;--t3:#858e88;--a:#7fc4a8;--g:#e6b96a;--p:#e8936f;color-scheme:dark}
@media (prefers-color-scheme:light){:root{--bg:#f3f2ee;--s:#fbfaf7;--s2:#efeee9;--l:rgba(28,33,29,.15);--t:#171a18;--t2:#444b46;--t3:#6a716c;--a:#2a6a54;--g:#9a6514;--p:#b4532d;color-scheme:light}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--t);font:15px/1.6 Inter,system-ui,"Segoe UI",sans-serif;padding:clamp(16px,4vw,56px)}
h1,h2{font-family:"Source Serif 4",Georgia,serif;font-weight:500;letter-spacing:-.01em}h1{font-size:clamp(30px,4vw,48px);margin:.2em 0}h2{font-size:clamp(20px,2vw,26px);margin:.25em 0 .4em;line-height:1.3}
.eyebrow{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--t3);font-weight:600;margin:0}.muted{color:var(--t3)}.small{font-size:12.5px}.mt{margin-top:18px}
.meta{color:var(--t3);font-size:13px}.run{margin-top:48px;padding-top:32px;border-top:1px solid var(--l)}
.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(420px,100%),1fr));gap:16px;margin-top:18px}
.pane{background:var(--s);border:1px solid var(--l);border-radius:14px;padding:18px 20px;font-family:"Source Serif 4",Georgia,serif;font-size:15.5px;line-height:1.7}
.pane .eyebrow,.pane .checks,.pane .small{font-family:Inter,system-ui,sans-serif}.preyas-b{border-top:3px solid var(--p)}.shreyas-b{border-top:3px solid var(--a)}
.preyas{color:var(--p)}.shreyas{color:var(--a)}.warn-t{color:var(--g)}.bad-t{color:var(--p)}
.cite{font:600 12.5px Inter,system-ui,sans-serif;color:var(--a);border:1px solid color-mix(in srgb,var(--a) 45%,transparent);background:color-mix(in srgb,var(--a) 12%,transparent);border-radius:5px;padding:0 5px}
.diag{margin-top:14px;background:var(--s2);border:1px solid var(--l);border-radius:14px;padding:14px 18px}.roads{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;margin-top:10px}.roads p{margin:0}
.pill{display:inline-block;font-size:11.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;border-radius:99px;padding:2px 10px;margin-right:8px;border:1px solid var(--l)}.pill.ok{color:var(--a)}.pill.mid{color:var(--g)}.pill.bad{color:var(--p)}
.checks{list-style:none;padding:0;margin:6px 0 0;font-size:13px}.checks li{padding:3px 0 3px 18px;position:relative}.checks li:before{content:"";position:absolute;left:2px;top:10px;width:7px;height:7px;border-radius:9px;background:var(--t3)}.checks .ok:before{background:var(--a)}.checks .bad:before{background:var(--p)}.checks .warn:before{background:var(--g)}
.judge{margin-top:16px}.totals{font-size:17px;margin:6px 0}.summary{color:var(--t2);font-style:italic}
table{width:100%;border-collapse:collapse;font-size:13.5px;margin-top:10px}th,td{text-align:left;vertical-align:top;padding:9px 10px;border-top:1px solid var(--l)}thead th{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--t3)}
.score{display:inline-grid;place-items:center;width:24px;height:24px;border-radius:7px;font-weight:700;background:var(--s2);border:1px solid var(--l)}.s4,.s3{color:var(--a)}.s0,.s1{color:var(--p)}.s2{color:var(--g)}
q{color:var(--t2)}details summary{cursor:pointer;color:var(--t2);margin-top:10px}.verses{font-size:13.5px}
.bench td,.bench th{font-size:14px}a{color:var(--a)}blockquote{margin:.4em 0;padding-left:12px;border-left:2px solid var(--l);color:var(--t2)}h4{font:600 12px Inter,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--t3)}
footer{margin-top:56px;color:var(--t3);font-size:12.5px;border-top:1px solid var(--l);padding-top:18px}
</style></head><body>
<p class="eyebrow">UpaSārathi · alignment harness report</p>
<h1>${multi ? `${runs.length} cases` : "Preyas or śreyas?"}</h1>
<p class="muted">Each prompt goes to the same model twice: once with the neutral system prompt “${esc(rubric.baselineSystem)}”, once grounded in an evidence packet retrieved from a knowledge graph of the Principal Upanishads. Code checks every quotation against the corpus; a judge model scores both answers blind on six axes.</p>
${summary}
${runs.map((r, i) => runHtml(r, kb, rubric, i)).join("\n")}
<footer>Generated by upasarathi-harness ${esc(ctx.version)} · ${new Date().toISOString().slice(0, 10)} · The JSON saved next to this report opens in the UpaSārathi website (Harness → Open a report). A demonstration, not a benchmark: the judge is itself a model.</footer>
</body></html>`;
}
