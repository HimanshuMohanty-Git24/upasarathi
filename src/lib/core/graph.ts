import type { GEdge, GNode, Rel } from "./types.ts";

export interface Adj {
  to: string;
  e: GEdge;
  out: boolean;
}
export interface GraphIndex {
  nodes: Map<string, GNode>;
  adj: Map<string, Adj[]>;
}

export function indexGraph(g: { nodes: GNode[]; edges: GEdge[] }): GraphIndex {
  const nodes = new Map(g.nodes.map((n) => [n.id, n]));
  const adj = new Map<string, Adj[]>();
  const push = (k: string, a: Adj) => {
    const l = adj.get(k);
    if (l) l.push(a);
    else adj.set(k, [a]);
  };
  for (const e of g.edges) {
    push(e.s, { to: e.t, e, out: true });
    push(e.t, { to: e.s, e, out: false });
  }
  return { nodes, adj };
}

/** How strongly a relation carries meaning, for retrieval scoring and for choosing what a focus view shows first. */
export const REL_WEIGHT: Record<Rel, number> = {
  DIAGNOSES: 1.2,
  TEACHES: 1,
  CONTRASTS_WITH: 0.9,
  CROSS_REFERENCES: 0.7,
  IN_STORY: 0.6,
  GROUNDS: 0.5,
  NEXT: 0.2,
  PART_OF: 0.05,
};

export const REL_LABEL: Record<Rel, { out: string; in: string }> = {
  PART_OF: { out: "part of", in: "contains" },
  NEXT: { out: "followed by", in: "follows" },
  IN_STORY: { out: "appears in", in: "includes" },
  TEACHES: { out: "teaches", in: "taught by" },
  CONTRASTS_WITH: { out: "contrasts with", in: "contrasts with" },
  DIAGNOSES: { out: "speaks to", in: "addressed by" },
  CROSS_REFERENCES: { out: "parallels", in: "parallels" },
  GROUNDS: { out: "grounds axis", in: "grounded in" },
};

/** A readable focus view: the centre plus its most meaningful neighbours, capped (no hairballs). */
export function focus(gi: GraphIndex, center: string, limit = 15): { nodes: string[]; edges: GEdge[] } {
  if (!gi.nodes.has(center)) return { nodes: [], edges: [] };
  const picked = new Set([center]);
  const ranked = (gi.adj.get(center) || [])
    .filter((a) => a.e.type !== "PART_OF" || gi.nodes.get(center)?.type !== "Upanishad")
    .sort((a, b) => REL_WEIGHT[b.e.type] - REL_WEIGHT[a.e.type] || a.to.localeCompare(b.to));
  for (const a of ranked) {
    if (picked.size >= limit) break;
    picked.add(a.to);
  }
  // Second ring only for strong relations, while there is room.
  if (picked.size < limit) {
    for (const id of [...picked]) {
      if (id === center) continue;
      for (const a of (gi.adj.get(id) || []).sort((x, y) => REL_WEIGHT[y.e.type] - REL_WEIGHT[x.e.type])) {
        if (picked.size >= limit) break;
        if (REL_WEIGHT[a.e.type] >= 0.9 && gi.nodes.get(a.to)?.type !== "Upanishad") picked.add(a.to);
      }
    }
  }
  return { nodes: [...picked], edges: induced(gi, picked) };
}

export function induced(gi: GraphIndex, set: Set<string>): GEdge[] {
  const out: GEdge[] = [];
  const seen = new Set<string>();
  for (const id of set) {
    for (const a of gi.adj.get(id) || []) {
      if (!a.out || !set.has(a.to)) continue;
      const k = `${a.e.type}|${a.e.s}|${a.e.t}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push(a.e);
      }
    }
  }
  return out;
}
