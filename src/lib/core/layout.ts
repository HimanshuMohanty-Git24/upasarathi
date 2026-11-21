// The 3D cosmos: one source of truth for the build (scripts/lib/compile.mjs precomputes positions with d3-force-3d)
// and the browser (which places nodes directly and never runs a simulation). No runtime imports.

export const RING_R = 430;
export const LAYOUT_TICKS = 360;
export const ALPHA_DECAY = 0.021;
export const VELOCITY_DECAY = 0.34;
export const CHARGE = { strength: -26, distanceMax: 460 };

const LINK_DIST: Record<string, number> = { PART_OF: 34, NEXT: 9, TEACHES: 300, DIAGNOSES: 300, IN_STORY: 260, CONTRASTS_WITH: 60, GROUNDS: 70, CROSS_REFERENCES: 200 };
const LINK_STR: Record<string, number> = { PART_OF: 0.85, NEXT: 0.45, TEACHES: 0.008, DIAGNOSES: 0.008, IN_STORY: 0.012, CONTRASTS_WITH: 0.25, GROUNDS: 0.2, CROSS_REFERENCES: 0.004 };
export const linkDistance = (type: string) => LINK_DIST[type] ?? 90;
export const linkStrength = (type: string) => LINK_STR[type] ?? 0.05;

/** The nine Upanishads sit on a gently waved ring, in canonical order; everything else is placed by the forces. */
export function hubPosition(order: number, total: number): [number, number, number] {
  const th = ((order - 1) / total) * Math.PI * 2 - Math.PI / 2;
  return [RING_R * Math.cos(th), 30 * Math.sin(th * 3), RING_R * Math.sin(th)];
}

/** Where each kind of node settles: passages at the rim with their Upanishad, the teaching core in the middle. */
export function radialTarget(type: string): number {
  switch (type) {
    case "Verse": return RING_R * 1.02;
    case "Person": return RING_R * 0.48;
    case "External": return RING_R * 1.5;
    case "Story": return RING_R * 0.4;
    case "Axis": return RING_R * 0.16;
    default: return RING_R * 0.28; // concepts, situations
  }
}
export const radialStrength = (type: string) => (type === "Verse" ? 0.05 : type === "External" ? 0.3 : type === "Person" ? 0.35 : 0.55);

type SimNode = { type: string; x?: number; y?: number; z?: number; vx?: number; vy?: number; vz?: number; fx?: number };

/** Passages stay near the rim; ideas, situations, stories and people stay inside the ring; all near the plane. */
export function containForce() {
  let nodes: SimNode[] = [];
  return Object.assign(
    (alpha: number) => {
      for (const n of nodes) {
        if (n.fx !== undefined || n.x === undefined || n.z === undefined) continue;
        const r = Math.hypot(n.x, n.z);
        const max = n.type === "Verse" ? RING_R * 1.28 : n.type === "External" ? RING_R * 1.45 : RING_R * 0.66;
        if (r > max) {
          const k = ((r - max) / r) * alpha * 0.4;
          n.vx = (n.vx ?? 0) - n.x * k;
          n.vz = (n.vz ?? 0) - n.z * k;
        }
        n.vy = (n.vy ?? 0) - (n.y ?? 0) * alpha * (n.type === "Verse" ? 0.05 : 0.025);
      }
    },
    { initialize: (ns: SimNode[]) => (nodes = ns) },
  );
}
