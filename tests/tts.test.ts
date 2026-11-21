// Local speech: the text each engine is given, the play-without-gaps gate, the badge, and pinned runtime URLs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { aksharas, chantSegments, chantText, cleanDeva, friendly, speakable, splitSentences } from "../src/lib/tts/text.ts";
import { AI_CHANT_BADGE, KOKORO, VAGDHENU } from "../src/lib/tts/config.ts";
import { shouldRelease } from "../src/lib/tts/stream-player.ts";

const ROOT = join(import.meta.dirname, "..");

test("the AI chant badge says exactly what it is and is not", () => {
  assert.equal(AI_CHANT_BADGE, "AI Chant · Vāgdhenu (classical meter, no Vedic svaras)");
});

test("akṣaras count written and inherent vowels, not half-consonants", () => {
  assert.equal(aksharas("श्रेयश्च"), 3); // śre-yaś-ca
  assert.equal(aksharas("प्रेयो मन्दो"), 4);
  assert.equal(aksharas("ओम्"), 1);
});

test("a verse is chanted hemistich by hemistich; numbers and daṇḍas are dropped", () => {
  const sa = ["श्रेयश्च प्रेयश्च मनुष्यमेतः तौ सम्परीत्य विविनक्ति धीरः ।", "श्रेयो हि धीरोऽभि प्रेयसो वृणीते प्रेयो मन्दो योगक्षेमाद्वृणीते ॥ २॥"];
  const segs = chantSegments(sa);
  assert.equal(segs.length, 2);
  assert.ok(segs.every((s) => !/[।॥०-९0-9]/.test(s)));
  assert.equal(chantText(sa).split("\n").length, 2);
  assert.equal(cleanDeva("ॐ पूर्णमदः ॥ १ ॥"), "ओम् पूर्णमदः");
});

test("long prose is cut at word boundaries, short sentences are joined, and nothing exceeds 40 syllables", () => {
  const prose = ["सूर्यश् चक्षुर् वातः प्राणो व्यात्तम् अग्निर् वैश्वानरः संवत्सर आत्माश्वस्य मेध्यस्य द्यौः पृष्ठम् अन्तरिक्षम् उदरं पृथिवी पाजस्यं दिशः पार्श्वे अवान्तरदिशः ।"];
  const segs = chantSegments(prose);
  assert.ok(segs.length >= 2);
  assert.ok(segs.every((s) => aksharas(s) <= 40));
  assert.equal(segs.join(" ").replace(/\s+/g, " "), cleanDeva(prose[0]));
  const short = ["वाच ऋग् रसः ।", "ऋचः साम रसः ।"];
  assert.equal(chantSegments(short).length, 1);
});

test("every passage in the corpus has chantable text, in pieces of at most 40 syllables", () => {
  const dir = join(ROOT, "data", "corpus");
  if (!existsSync(dir)) return;
  let n = 0;
  for (const up of readdirSync(dir)) {
    const f = join(dir, up, "verses.json");
    if (!existsSync(f)) continue;
    for (const v of JSON.parse(readFileSync(f, "utf8")) as { id: string; sa: string[] }[]) {
      const segs = chantSegments(v.sa);
      assert.ok(segs.length > 0, `${v.id} has nothing to chant`);
      for (const s of segs) assert.ok(aksharas(s) <= 40, `${v.id}: ${aksharas(s)} syllables in "${s}"`);
      n++;
    }
  }
  assert.ok(n > 1000);
});

test("narration text drops Devanagari and footnotes and spells IAST for an English voice", () => {
  const s = speakable("Śaṅkara says the Ātman [12] is not born (न जायते). Com.— Upaniṣad means ‘sitting near’.");
  assert.ok(!/[ऀ-ॿ]/.test(s));
  assert.ok(!/\[12\]/.test(s));
  assert.match(s, /Shankara/);
  assert.match(s, /Atman/);
  assert.match(s, /Upanishad/);
});

test("sentences for the browser voice stay short", () => {
  const long = Array.from({ length: 30 }, (_, i) => `clause ${i}`).join(", ") + ".";
  const parts = splitSentences(`First sentence. Second one!\n${long}`, 120);
  assert.equal(parts[0], "First sentence.");
  assert.equal(parts[1], "Second one!");
  assert.ok(parts.slice(2).every((p) => p.length <= 120));
});

test("playback is held until it can run to the end without a gap", () => {
  // Faster than real time: play as soon as the first piece is ready.
  assert.equal(shouldRelease({ done: 1, total: 5, made: 4, elapsed: 2 }), true);
  // Half real time, first of four pieces: the rest (12 s of audio) takes 24 s to make; 4 s buffered is not enough.
  assert.equal(shouldRelease({ done: 1, total: 4, made: 4, elapsed: 8 }), false);
  // Three of four made at half real time: 4 s left takes 8 s, 12 s buffered covers it.
  assert.equal(shouldRelease({ done: 3, total: 4, made: 12, elapsed: 24 }), true);
  assert.equal(shouldRelease({ done: 4, total: 4, made: 16, elapsed: 32 }), true);
  assert.equal(shouldRelease({ done: 0, total: 4, made: 0, elapsed: 3 }), false);
});

test("the engine's progress lines are put in plain words", () => {
  assert.equal(friendly("Hemistich 2/4: Step 3/7 (Guided CFG · WEBGPU)"), "Line 2 of 4 · pass 3 of 7");
  assert.equal(friendly("Part 1/6: Preparing Prosodic Conditioning..."), "Line 1 of 6 · preparing");
  assert.match(friendly("Downloading ONNX WebGPU DiT Backbone: 12.3 / 191.6 MB"), /once · WebGPU DiT Backbone 12 of 192 MB/);
});

test("runtimes and models are pinned: exact versions, a commit for the chant engine, no 'latest'", () => {
  const workers = ["kokoro-worker.js", "vagdhenu-worker.js"].map((f) => readFileSync(join(ROOT, "public", "tts", f), "utf8"));
  const urls = [...workers.join("\n").matchAll(/https:\/\/cdn\.jsdelivr\.net\/[^"'\s]+/g)].map((m) => m[0]);
  assert.ok(urls.length >= 3);
  for (const u of urls) assert.match(u, /@(\d+\.\d+\.\d+|[0-9a-f]{40})\//, u);
  assert.ok(workers[0].includes(KOKORO.lib) && workers[0].includes(KOKORO.model) && workers[0].includes('dtype: "q8"'));
  assert.ok(workers[1].includes(VAGDHENU.lib) && workers[1].includes(VAGDHENU.ort));
  assert.ok(!/@latest|@\^|@~/.test(workers.join("\n")));
});
