// Build-time access to the compiled data (public/data). Used only by server components and route generation.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Bhashya, Facts, GraphData, KnowledgeBase, LearningPath, Rubric, Verse } from "@/lib/core/types";
import type { HarnessRun } from "@/lib/core/pipeline";

const D = join(process.cwd(), "public", "data");
const cache = new Map<string, unknown>();
function read<T>(file: string): T {
  if (!cache.has(file)) cache.set(file, JSON.parse(readFileSync(join(D, file), "utf8")));
  return cache.get(file) as T;
}

export const getKb = () => read<KnowledgeBase>("kb.json");
export const getGraph = () => read<GraphData>("graph.json");
export const getRubric = () => read<Rubric>("rubric.json");
export const getFacts = () => read<Facts>("facts.json");
export const getPaths = () => read<{ paths: LearningPath[]; categories: Record<string, string> }>("paths.json").paths;
export const getCorpus = (up: string) => read<Verse[]>(`corpus/${up}.json`);
export const getBhashya = (up: string) => read<Record<string, Bhashya>>(`bhashya/${up}.json`);

export interface RunSummary {
  id: string;
  title: string | null;
  hook: string | null;
  prompt: string;
  control: boolean;
  sharpened: boolean;
  createdAt: string;
  status: string;
  models: HarnessRun["models"];
  totals: { baseline: number; realigned: number };
  max: number;
  verdict: string | null;
  dilemma: string | null;
}
export function getRuns(): RunSummary[] {
  return existsSync(join(D, "runs", "index.json")) ? read<RunSummary[]>("runs/index.json") : [];
}
export function getRun(id: string): HarnessRun | null {
  return existsSync(join(D, "runs", `${id}.json`)) ? read<HarnessRun>(`runs/${id}.json`) : null;
}
export function runIds(): string[] {
  return existsSync(join(D, "runs")) ? readdirSync(join(D, "runs")).filter((f) => f.endsWith(".json") && f !== "index.json").map((f) => f.slice(0, -5)) : [];
}
export function getText(up: string) {
  return getKb().texts.find((t) => t.id === up) ?? null;
}
