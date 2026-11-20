// npm run data — compile data/ into public/data. Nothing is written unless the integrity gate passes.
import { mkdir, writeFile, readdir, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "./lib/compile.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "data");
const t0 = performance.now();
const { outputs, errors, warnings, facts, crossChecks } = await compile(ROOT);

for (const w of warnings) console.log(`warning: ${w}`);
if (errors.length) {
  console.error(`\nIntegrity gate: ${errors.length} error(s). Nothing written.\n` + errors.map((e) => `  ✗ ${e}`).join("\n"));
  process.exit(1);
}
for (const sub of ["corpus", "bhashya"]) {
  await rm(join(OUT, sub), { recursive: true, force: true });
  await mkdir(join(OUT, sub), { recursive: true });
}
for (const [file, body] of Object.entries(outputs)) await writeFile(join(OUT, file), body, "utf8");
await mkdir(join(OUT, "runs"), { recursive: true });

console.log(`Integrity gate passed: 0 errors · ${facts.anchors} anchors · ${crossChecks.length} wording checks (${crossChecks.map((c) => `${c.a}≡${c.b} ${c.similarity}`).join(", ")})`);
console.log(`${facts.texts.total} texts (${facts.texts.complete} complete + ${facts.texts.excerpts} excerpted) · ${facts.mantras.total} passages · ${facts.nodes} nodes · ${facts.edges} edges · ${facts.bhashyaVerses} with Śaṅkara · ${facts.audioVerses} with chant · ${facts.runs} recorded runs`);
console.log(`wrote ${Object.keys(outputs).length} files to public/data in ${((performance.now() - t0) / 1000).toFixed(1)} s`);

