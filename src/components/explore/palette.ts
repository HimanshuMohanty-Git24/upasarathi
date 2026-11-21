// Colours for the cosmos. Kinds of node keep one colour each; in "by text" mode the nine Upanishads and their
// mantras take their own hue, so the clusters read as places on a map.
import type { NodeType } from "@/lib/core/types";

export const TYPE_HEX: Record<"dark" | "light", Record<NodeType, string>> = {
  dark: { Upanishad: "#f0c674", Verse: "#a3aba5", Concept: "#7fb2f0", Dilemma: "#b9a6f5", Axis: "#9fe0c6", Story: "#eba7c0", Person: "#e4e7e2", External: "#9aa39c" },
  light: { Upanishad: "#9a6514", Verse: "#6d746f", Concept: "#2d6fc2", Dilemma: "#6a54cf", Axis: "#2a6a54", Story: "#b0457a", Person: "#3c423e", External: "#7b827d" },
};

export const TEXT_HEX: Record<"dark" | "light", Record<string, string>> = {
  dark: {
    isha: "#f3cf7a",
    kena: "#7fd1b0",
    katha: "#f0956c",
    mundaka: "#76aef2",
    mandukya: "#b9a2f7",
    chandogya: "#a5d67c",
    brihadaranyaka: "#ec8aa3",
    taittiriya: "#62cfdc",
    prashna: "#e2b277",
  },
  light: {
    isha: "#a4730f",
    kena: "#1f7a5a",
    katha: "#b7502a",
    mundaka: "#2f68b8",
    mandukya: "#6447c8",
    chandogya: "#4d8a22",
    brihadaranyaka: "#b23b5c",
    taittiriya: "#16808c",
    prashna: "#94622a",
  },
};

export const TYPE_LABEL: Record<NodeType, string> = {
  Upanishad: "Upanishads",
  Verse: "Mantras",
  Concept: "Concepts",
  Dilemma: "Human situations",
  Axis: "Alignment axes",
  Story: "Stories",
  Person: "People",
  External: "Gītā & Ṛgveda",
};
export const TYPE_ORDER: NodeType[] = ["Upanishad", "Verse", "Axis", "Concept", "Dilemma", "Story", "Person", "External"];

export function nodeColor(n: { type: NodeType; up?: string; id: string }, by: "text" | "type", dark: boolean): string {
  const mode = dark ? "dark" : "light";
  if (by === "text") {
    const up = n.type === "Upanishad" ? n.id.slice(3) : n.type === "Verse" ? n.up : undefined;
    if (up && TEXT_HEX[mode][up]) return TEXT_HEX[mode][up];
  }
  return TYPE_HEX[mode][n.type];
}
