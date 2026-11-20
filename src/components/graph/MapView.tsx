"use client";
// The map: a readable focus view (≤ 15 nodes) by default; the whole graph only on request.
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ReactFlow, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useData } from "@/lib/client/data";
import { focus, indexGraph, REL_LABEL } from "@/lib/core/graph";
import { fold } from "@/lib/core/text";
import type { GraphData, GNode } from "@/lib/core/types";
import { MiniGraph, KIND_COLOR } from "./MiniGraph";
import { useDrawer } from "@/components/verse/Drawer";
import { useReady } from "@/lib/client/capture";

const START = "concept:shreyas";

export function MapView() {
  const params = useSearchParams();
  const router = useRouter();
  const { open } = useDrawer();
  const { data: graph, error } = useData<GraphData>("graph.json");
  const [q, setQ] = useState("");
  const center = params.get("node") || START;
  const full = params.get("full") === "1";
  const gi = useMemo(() => (graph ? indexGraph(graph) : null), [graph]);
  useReady(Boolean(graph));

  const go = (id: string, f = false) => {
    const sp = new URLSearchParams(params.toString());
    sp.set("node", id);
    if (f) sp.set("full", "1");
    else sp.delete("full");
    router.replace(`/map?${sp.toString()}`, { scroll: false });
  };
  const view = useMemo(() => (gi ? focus(gi, center, 15) : null), [gi, center]);
  const matches = useMemo(() => {
    if (!graph || q.trim().length < 2) return [];
    const f = fold(q);
    return graph.nodes.filter((n) => n.type !== "Person" && (fold(n.label).includes(f) || fold(n.sub || "").includes(f))).slice(0, 8);
  }, [graph, q]);

  if (error) return <p className="muted">{error}</p>;
  if (!graph || !gi || !view) return <p className="muted">Loading the map…</p>;
  const c = gi.nodes.get(center);
  const nodes = view.nodes.map((id) => gi.nodes.get(id)).filter((n): n is GNode => Boolean(n));
  const rels = (gi.adj.get(center) || []).filter((a) => a.e.type !== "PART_OF" && a.e.type !== "NEXT");

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Map{full ? " · whole graph" : " · focus view"}</p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight">{c?.label ?? center}</h1>
          {c?.sub && <p className="max-w-[720px] text-[14px] text-text-2">{c.sub}</p>}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-[260px]">
            <input placeholder="Find a verse, idea, story…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the map" />
            {matches.length > 0 && (
              <ul className="card absolute top-11 right-0 left-0 z-20 max-h-72 overflow-auto p-1 shadow-[var(--shadow)]">
                {matches.map((n) => (
                  <li key={n.id}>
                    <button className="w-full rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-surface-2" onClick={() => { setQ(""); go(n.id); }}>
                      <span className="dot mr-2" style={{ background: KIND_COLOR[n.type] }} />{n.label} <span className="text-text-3">· {n.type.toLowerCase()}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button className="btn btn-sm" onClick={() => go(center, !full)}>{full ? "Back to focus" : "Show whole graph"}</button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="card overflow-hidden">
          {full ? <FullMap graph={graph} center={center} onPick={(id) => go(id)} /> : <MiniGraph nodes={nodes} edges={view.edges} highlight={new Set([center])} onPick={(id) => (id === center ? open(id) : go(id))} height="min(70vh, 640px)" />}
        </div>
        <aside className="card p-4">
          <p className="eyebrow">Connections of {c?.label}</p>
          <ul className="mt-3 max-h-[60vh] space-y-2.5 overflow-auto pr-1">
            {rels.slice(0, 40).map((a, i) => (
              <li key={i} className="text-[13px]">
                <span className="text-text-3">{a.out ? REL_LABEL[a.e.type].out : REL_LABEL[a.e.type].in} </span>
                <button className="cite" onClick={() => go(a.to)}>{gi.nodes.get(a.to)?.label}</button>
                {a.e.why && <p className="mt-0.5 text-text-3">{a.e.why}{a.e.basis === "editorial" ? <span className="text-text-4"> · editorial</span> : null}</p>}
              </li>
            ))}
          </ul>
          <button className="btn btn-sm mt-4" onClick={() => open(center)}>Open the source</button>
          <p className="mt-4 text-[12px] text-text-3">Click a node to move the focus. Dashed lines are editorial links; solid lines come from the texts themselves.</p>
        </aside>
      </div>
    </div>
  );
}

function FullMap({ graph, center, onPick }: { graph: GraphData; center: string; onPick: (id: string) => void }) {
  const nodes = useMemo<Node[]>(
    () =>
      graph.nodes.map((n) => {
        const [x, y] = graph.layout[n.id] ?? [0, 0];
        const big = n.type !== "Verse" && n.type !== "Person";
        return {
          id: n.id,
          position: { x, y },
          data: { label: big ? n.label : "" },
          style: {
            width: big ? "auto" : 9,
            height: big ? "auto" : 9,
            padding: big ? "2px 6px" : 0,
            borderRadius: 999,
            fontSize: 10,
            border: n.id === center ? "2px solid var(--accent)" : "none",
            background: big ? "var(--surface)" : KIND_COLOR[n.type],
            color: "var(--text)",
            boxShadow: big ? `inset 0 0 0 1.5px ${KIND_COLOR[n.type]}` : undefined,
          },
          title: n.label,
        };
      }),
    [graph, center],
  );
  const edges = useMemo(
    () => graph.edges.filter((e) => e.type !== "NEXT" && e.type !== "PART_OF").map((e, i) => ({ id: `e${i}`, source: e.s, target: e.t, style: { stroke: "var(--line-2)", strokeWidth: 0.6 } })),
    [graph],
  );
  return (
    <div style={{ height: "min(70vh, 640px)" }}>
      <ReactFlow nodes={nodes} edges={edges} fitView minZoom={0.05} maxZoom={2} nodesDraggable={false} nodesConnectable={false} onlyRenderVisibleElements onNodeClick={(_, n) => onPick(n.id)} zoomOnScroll={false} preventScrolling={false} />
    </div>
  );
}
