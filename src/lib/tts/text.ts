// Pure text preparation for the two speech engines (no DOM; shared by the browser, the tests and the offline script).

// ── Sanskrit, for Vāgdhenu ────────────────────────────────────────────────────────────────────────
const CONSONANT = /[क-हक़-य़]/;
const AKSHARA = /[क-हक़-य़](?![़]?्)|[ऄ-औॠॡऌ]/g;

/** Syllables (akṣaras) in a Devanagari string: every vowel, written or inherent. */
export const aksharas = (deva: string) => (deva.match(AKSHARA) || []).length;

/** One line of a passage as the chant engine wants it: no daṇḍas, verse numbers, quotes or brackets. */
export function cleanDeva(line: string): string {
  return line
    .replace(/ॐ/g, "ओम्")
    .replace(/[०-९0-9]+/g, " ")
    .replace(/[।॥|"'“”‘’()[\]{}॰*•·.,;:!?–—-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cut a run of letters with no spaces (a long compound) into pieces of about `max` syllables, between akṣaras. */
function cutWord(word: string, max: number): string[] {
  const out: string[] = [];
  let start = 0;
  let n = 0;
  for (let i = 0; i < word.length; i++) {
    const c = word[i];
    const next = word[i + 1] ?? "";
    if (CONSONANT.test(c) ? !/[़्]/.test(next) : /[ऄ-औॠॡऌ]/.test(c)) n++;
    // A new akṣara starts at a consonant or a vowel letter; cut just before one once the piece is full.
    if (n >= max && (CONSONANT.test(next) || /[ऄ-औ]/.test(next)) && c !== "्") {
      out.push(word.slice(start, i + 1));
      start = i + 1;
      n = 0;
    }
  }
  if (start < word.length) out.push(word.slice(start));
  return out.filter(Boolean);
}

/** Split a long prose line at word boundaries into balanced pieces of at most `max` syllables. */
function balance(line: string, max: number): string[] {
  const words = line.split(" ").flatMap((w) => (aksharas(w) > max ? cutWord(w, max) : [w]));
  const total = words.reduce((s, w) => s + aksharas(w), 0);
  const parts = Math.max(1, Math.ceil(total / max));
  const target = total / parts;
  const out: string[] = [];
  let cur: string[] = [];
  let n = 0;
  for (const w of words) {
    const k = aksharas(w);
    if (cur.length && n + k > max) {
      out.push(cur.join(" "));
      cur = [];
      n = 0;
    }
    cur.push(w);
    n += k;
    if (n >= target && out.length < parts - 1) {
      out.push(cur.join(" "));
      cur = [];
      n = 0;
    }
  }
  if (cur.length) out.push(cur.join(" "));
  return out;
}

/**
 * A passage's lines as the units the chant engine synthesizes one by one (a hemistich of verse, or a short phrase of
 * prose). Verse lines are kept whole up to `keep` syllables (the longest classical hemistichs run to about 40);
 * longer prose is cut at word boundaries into pieces of at most `max`. Four pieces are avoided, because the engine
 * pairs a four-line input into two hemistichs, which would double the length of a prose piece.
 */
export function chantSegments(sa: string[], { keep = 40, max = 28, join = 18 }: { keep?: number; max?: number; join?: number } = {}): string[] {
  const lines = sa.flatMap((l) => l.split(/[।॥|]/)).map(cleanDeva).filter((l) => aksharas(l) > 0);
  const split = lines.flatMap((l) => (aksharas(l) > keep ? balance(l, max) : [l]));
  // Very short prose sentences ("vāca ṛg rasaḥ") are chanted together, up to `join` syllables, for a natural flow
  // and fewer passes of the model.
  let out: string[] = [];
  for (const s of split) {
    const last = out.at(-1);
    if (last && aksharas(last) + aksharas(s) <= join) out[out.length - 1] = `${last} ${s}`;
    else out.push(s);
  }
  if (out.length === 4 && out.some((s) => aksharas(s) > 22)) {
    const i = out.reduce((best, s, k) => (aksharas(s) > aksharas(out[best]) ? k : best), 0);
    const halves = balance(out[i], Math.ceil(aksharas(out[i]) / 2));
    if (halves.length > 1) out = [...out.slice(0, i), ...halves, ...out.slice(i + 1)];
  }
  return out;
}

/** The engine's input: one unit per line (it splits on newlines and daṇḍas). */
export const chantText = (sa: string[]) => chantSegments(sa).join("\n");

// ── the chant engine's progress, for people ─────────────────────────────────────────────────────
/** The engine's progress lines, in plain words ("Hemistich 2/4: Step 3/7 (Guided CFG · WEBGPU)" → "Line 2 of 4 · pass 3 of 7"). */
export function friendly(msg: string): string {
  const step = msg.match(/(?:Hemistich|Part) (\d+)\/(\d+): Step (\d+)\/(\d+)/);
  if (step) return `Line ${step[1]} of ${step[2]} · pass ${step[3]} of ${step[4]}`;
  const prep = msg.match(/(?:Hemistich|Part) (\d+)\/(\d+): Preparing/);
  if (prep) return `Line ${prep[1]} of ${prep[2]} · preparing`;
  const dl = msg.match(/Downloading ([^:]+): ([\d.]+) \/ ([\d.]+) MB/);
  if (dl) return `Downloading the chant model, once · ${dl[1].replace(/ONNX |WASM MatMulInteger |Neural /g, "")} ${Math.round(+dl[2])} of ${Math.round(+dl[3])} MB`;
  if (/from browser cache/i.test(msg)) return "Loading the chant model from this browser…";
  if (/Initializing|Pre-warming/i.test(msg)) return "Starting the chant model…";
  return msg;
}

// ── English, for narration ────────────────────────────────────────────────────────────────────────
const IAST_PLAIN: [RegExp, string][] = [
  [/ś|ṣ/g, "sh"],
  [/Ś|Ṣ/g, "Sh"],
  [/ṛ|ṝ/g, "ri"],
  [/Ṛ|Ṝ/g, "Ri"],
  [/ḷ/g, "li"],
  [/ṃ|ṁ/g, "m"],
  [/ḥ/g, "h"],
];

/**
 * Text a voice can read: Devanagari dropped (it is printed above the translation), footnote marks removed, and IAST
 * spelt the way an English reader would say it (Śaṅkara → Shankara, Upaniṣad → Upanishad, Ātman → Atman).
 */
export function speakable(raw: string): string {
  let s = raw
    .replace(/[ऀ-ॿ]+(?:[\sऀ-ॿ]*[ऀ-ॿ])?/g, " ")
    .replace(/\[\d+\]|\{\d+\}/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/^\s*Com\.\s*[—-]\s*/gm, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
  for (const [re, to] of IAST_PLAIN) s = s.replace(re, to);
  s = s.normalize("NFD").replace(/[̀-ͯ]/g, "").normalize("NFC");
  return s
    .split(/\n+/)
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter((l) => /[A-Za-z0-9]/.test(l))
    .join("\n");
}

/** Sentences for the browser voice (which drops long utterances): split at full stops and line breaks, then at
 *  semicolons, colons and commas while a piece is still longer than `max` characters. */
export function splitSentences(text: string, max = 240): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n+/)) {
    for (const s of para.split(/(?<=[.!?…])\s+(?=["'(]?[A-Z0-9])/)) {
      const t = s.trim();
      if (!t) continue;
      if (t.length <= max) {
        out.push(t);
        continue;
      }
      let cur = "";
      for (const part of t.split(/(?<=[;:,—])\s+/)) {
        if (cur && (cur + " " + part).length > max) {
          out.push(cur);
          cur = part;
        } else cur = cur ? `${cur} ${part}` : part;
      }
      if (cur) out.push(cur);
    }
  }
  return out;
}
