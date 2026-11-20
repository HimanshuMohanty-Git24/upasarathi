// Shared domain types. This folder (src/lib/core) is framework-free and uses erasable TypeScript only, so the
// Next app, the Node scripts (node strips the types) and the tests all run the same code.

export type NodeType = "Upanishad" | "Verse" | "Concept" | "Dilemma" | "Axis" | "Story" | "Person" | "External";
export type Rel = "PART_OF" | "NEXT" | "IN_STORY" | "TEACHES" | "CONTRASTS_WITH" | "DIAGNOSES" | "CROSS_REFERENCES" | "GROUNDS";
/** Who asserts an edge: the text's own structure, Śaṅkara, this project's editors, or a model (never shipped unreviewed). */
export type Basis = "text" | "shankara" | "editorial" | "model";

export interface GNode {
  id: string;
  type: NodeType;
  label: string;
  sub?: string;
  /** Upanishad id for verses and texts. */
  up?: string;
  ref?: string;
  url?: string;
}
export interface GEdge {
  s: string;
  t: string;
  type: Rel;
  basis: Basis;
  why?: string;
  reviewed?: boolean;
  role?: "names" | "remedies";
  kind?: "identical" | "parallel" | "echo";
  verse?: string;
}
export interface GraphData {
  nodes: GNode[];
  edges: GEdge[];
  layout: Record<string, [number, number]>;
}

export interface TextMeta {
  id: string;
  abbrev: string;
  sa: string;
  iast: string;
  en: string;
  veda: string;
  levels: string[];
  scope: "complete" | "excerpts";
  order: number;
  tagline: string;
  count: number;
  translators: string[];
  aliases: string[];
  audio: { whole: string; durationSec: number; chanter: string | null } | null;
  bhashya: { translator: string; edition: string } | null;
}

export interface Translation {
  text: string;
  by: string;
  source: string;
  cite?: string;
  /** Set when the translator rendered several mantras together, e.g. "6.1.2–3". */
  joint?: string;
}
export interface Verse {
  id: string;
  ref: string;
  up: string;
  order: number;
  section: string;
  sa: string[];
  iast: string[];
  tr: Translation | null;
  alt: Translation[];
  audio: { mp3: string; whole: [number, number] } | null;
  hasBhashya: boolean;
}
export interface Bhashya {
  author: string;
  lang: string;
  translator: string;
  edition: string;
  text: string;
  source: string;
}

export interface Concept {
  id: string;
  sa: string;
  iast: string;
  en: string;
  category: string;
  desc: string;
  teaches: { verse: string; why: string }[];
  contrasts: { with: string; verse: string; why: string }[];
}
export interface Dilemma {
  id: string;
  en: string;
  desc: string;
  preyas: string;
  shreyas: string;
  cues: string[];
  pressures: string[];
  concepts: string[];
  external?: string[];
  verses: { verse: string; role: "names" | "remedies"; why: string }[];
}
export interface Person {
  id: string;
  sa: string;
  iast: string;
  role: string;
}
export interface Story {
  id: string;
  title: string;
  summary: string;
  cast: string[];
  verses: string[];
}
export interface PathStep {
  node: string;
  kind: "read" | "contrast" | "story" | "reflect";
  title: string;
  note: string;
  prompt: string;
}
export interface LearningPath {
  id: string;
  title: string;
  subtitle: string;
  minutes: number;
  intro: string;
  steps: PathStep[];
}

export interface Axis {
  id: string;
  label: string;
  en: string;
  sa: string;
  question: string;
  grounds: string[];
  levels: string[];
}
export interface Preset {
  id: string;
  title: string;
  prompt: string;
  pressure: string[];
  expectDilemma: string;
  hook: string;
  control?: boolean;
  sharpened?: boolean;
}
export interface Rubric {
  version: number;
  baselineSystem: string;
  defaults: { provider: string; model: string; judgeModel: string };
  axes: Axis[];
  realignSystem: string;
  judgeSystem: string;
  judgeTemplate: string;
  pressures: { id: string; label: string; cues: string[] }[];
  checks: { flatteryOpener: string; flatteryPhrase: string; engagementBait: string };
  presets: Preset[];
}

/** Compact verse record used by retrieval, quote checks and the citation drawer. */
export interface VerseLite {
  id: string;
  up: string;
  ref: string;
  section: string;
  sa: string;
  iast: string;
  tr: string;
  trBy: string;
  audio: string | null;
  hasBhashya: boolean;
}
/** Everything the browser-side engine needs, in one file (public/data/kb.json). */
export interface KnowledgeBase {
  texts: TextMeta[];
  verses: VerseLite[];
  concepts: Concept[];
  dilemmas: Dilemma[];
  stories: Story[];
  persons: Person[];
  external: Record<string, { label: string; url: string | null; corpus: string }>;
}

export interface Facts {
  texts: { complete: number; excerpts: number; total: number };
  mantras: { complete: number; excerpts: number; total: number };
  bhashyaVerses: number;
  audioVerses: number;
  concepts: number;
  dilemmas: number;
  stories: number;
  persons: number;
  paths: number;
  axes: number;
  presets: number;
  nodes: number;
  edges: number;
  anchors: number;
  crossCorpus: number;
  runs: number;
  corpusHash: string;
}
