import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createEngine } from "../src/lib/core/engine.ts";
import { corpusIndex } from "../src/lib/core/checks.ts";
import type { GraphData, KnowledgeBase, Rubric } from "../src/lib/core/types.ts";

const D = join(import.meta.dirname, "..", "public", "data");
export const read = <T>(f: string): T => JSON.parse(readFileSync(join(D, f), "utf8")) as T;
export const kb = read<KnowledgeBase>("kb.json");
export const graph = read<GraphData>("graph.json");
export const rubric = read<Rubric>("rubric.json");
export const E = createEngine(kb, graph, rubric);
export const ci = corpusIndex(kb);
export const verse = (id: string) => kb.verses.find((v) => v.id === id)!;
