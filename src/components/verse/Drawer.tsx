"use client";
// One drawer for the whole app: any citation or graph node opens it, wherever it appears.
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { fetchData, loadBhashya, loadVerse } from "@/lib/client/data";
import type { Bhashya, GraphData, KnowledgeBase, Verse } from "@/lib/core/types";
import { REL_LABEL } from "@/lib/core/graph";
import { AudioButton } from "./AudioButton";
import { IconClose, IconExternal } from "@/components/ui/Icons";

const Ctx = createContext<{ open: (id: string) => void }>({ open: () => {} });
export const useDrawer = () => useContext(Ctx);

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [id, setId] = useState<string | null>(null);
  const open = useCallback((x: string) => setId(x), []);
  useEffect(() => {
    if (!id) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setId(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [id]);
  return (
    <Ctx.Provider value={{ open }}>
      {children}
      {id && (
        <>
          <div className="scrim" onClick={() => setId(null)} />
          <aside className="drawer reveal" role="dialog" aria-modal="true" aria-label="Source">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-5 py-3">
              <span className="eyebrow">Source</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setId(null)} aria-label="Close" autoFocus>
                <IconClose />
              </button>
            </div>
            <DrawerBody id={id} onNavigate={setId} />
          </aside>
        </>
      )}
    </Ctx.Provider>
  );
}

export function CiteChip({ id, label, className = "" }: { id: string; label: string; className?: string }) {
  const { open } = useDrawer();
  return (
    <button type="button" className={`cite ${className}`} onClick={() => open(id)} title="Open the source">
      {label}
    </button>
  );
}

function DrawerBody({ id, onNavigate }: { id: string; onNavigate: (id: string) => void }) {
  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [graph, setGraph] = useState<GraphData | null>(null);
  useEffect(() => {
    fetchData<KnowledgeBase>("kb.json").then(setKb);
    fetchData<GraphData>("graph.json").then(setGraph);
  }, []);
  if (!kb || !graph) return <p className="p-5 muted">Loading…</p>;
  const lite = kb.verses.find((v) => v.id === id);
  if (lite) return <VerseView id={id} up={lite.up} kb={kb} graph={graph} onNavigate={onNavigate} />;
  const node = graph.nodes.find((n) => n.id === id);
  if (!node) return <p className="p-5 muted">Not found: {id}</p>;
  if (node.type === "External") {
    const ext = kb.external[id];
    return (
      <div className="space-y-3 p-5">
        <h2 className="text-xl font-semibold">{node.label}</h2>
        <p className="muted">{node.sub}</p>
        <Related id={id} graph={graph} onNavigate={onNavigate} />
        {ext?.url ? <a className="btn" href={ext.url} target="_blank" rel="noreferrer">Open in {ext.corpus} <IconExternal size={14} /></a> : <p className="muted text-[13px]">{ext?.corpus} link not configured.</p>}
      </div>
    );
  }
  const concept = kb.concepts.find((c) => `concept:${c.id}` === id);
  const dilemma = kb.dilemmas.find((d) => `dilemma:${d.id}` === id);
  const story = kb.stories.find((s) => `story:${s.id}` === id);
  return (
    <div className="space-y-4 p-5">
      <p className="eyebrow">{node.type === "Dilemma" ? "Human situation" : node.type}</p>
      <h2 className="text-2xl font-semibold tracking-tight">{node.label}</h2>
      {concept && <p className="deva text-[19px]">{concept.sa} <span className="iast text-[15px]">· {concept.en}</span></p>}
      <p className="reading text-[15.5px]">{concept?.desc ?? dilemma?.desc ?? story?.summary ?? node.sub}</p>
      {dilemma && (
        <div className="grid gap-2">
          <p className="chip-preyas rounded-lg border px-3 py-2 text-[14px]"><b>Preyas</b> · {dilemma.preyas}</p>
          <p className="chip-accent rounded-lg border px-3 py-2 text-[14px]"><b>Śreyas</b> · {dilemma.shreyas}</p>
        </div>
      )}
      <Related id={id} graph={graph} onNavigate={onNavigate} />
      <Link className="btn btn-sm" href={`/map?node=${encodeURIComponent(id)}`}>See it in the map</Link>
    </div>
  );
}

function Related({ id, graph, onNavigate }: { id: string; graph: GraphData; onNavigate: (id: string) => void }) {
  const rel = graph.edges.filter((e) => (e.s === id || e.t === id) && !["PART_OF", "NEXT"].includes(e.type)).slice(0, 24);
  if (!rel.length) return null;
  const label = (x: string) => graph.nodes.find((n) => n.id === x)?.label ?? x;
  return (
    <div>
      <p className="eyebrow mb-2">Connections</p>
      <ul className="space-y-2">
        {rel.map((e, i) => {
          const other = e.s === id ? e.t : e.s;
          const verb = e.s === id ? REL_LABEL[e.type].out : REL_LABEL[e.type].in;
          return (
            <li key={i} className="text-[13.5px]">
              <span className="muted">{verb} </span>
              <button className="cite" onClick={() => onNavigate(other)}>{label(other)}</button>
              {e.why && <p className="mt-0.5 text-text-3">{e.why}{e.basis === "editorial" ? <span className="text-text-4"> · editorial</span> : null}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function VerseView({ id, up, kb, graph, onNavigate }: { id: string; up: string; kb: KnowledgeBase; graph: GraphData; onNavigate: (id: string) => void }) {
  const [v, setV] = useState<Verse | null>(null);
  const [b, setB] = useState<Bhashya | null>(null);
  useEffect(() => {
    loadVerse(id, up).then((x) => setV(x ?? null));
    loadBhashya(id, up).then((x) => setB(x ?? null));
  }, [id, up]);
  const t = kb.texts.find((x) => x.id === up);
  if (!v || !t) return <p className="p-5 muted">Loading…</p>;
  return (
    <div className="space-y-4 p-5">
      <div>
        <p className="eyebrow">{t.iast} Upaniṣad · {v.section}</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">{t.abbrev} {v.ref}</h2>
      </div>
      <div className="deva text-[20px]">{v.sa.map((l, i) => <div key={i}>{l}</div>)}</div>
      <div className="iast text-[15px]">{v.iast.map((l, i) => <div key={i}>{l}</div>)}</div>
      {v.audio && <AudioButton src={v.audio.mp3} label="Hear the chant" />}
      {v.tr && (
        <figure className="card-soft p-4">
          <blockquote className="reading text-[16px]">{v.tr.text}</blockquote>
          <figcaption className="mt-2 text-[12.5px] text-text-3">{v.tr.by} · Śaṅkara tradition{v.tr.joint ? ` · translated together as ${t.abbrev} ${v.tr.joint}` : ""}</figcaption>
        </figure>
      )}
      {b && (
        <details className="card p-4" open>
          <summary className="flex items-center justify-between"><span className="font-semibold">Śaṅkara&apos;s commentary</span><span className="text-[12px] text-text-3">tr. {b.translator}</span></summary>
          <div className="reading mt-3 max-h-[42vh] overflow-y-auto pr-1 text-[14.5px] whitespace-pre-line">{b.text}</div>
          <a className="mt-2 inline-flex items-center gap-1 text-[12px] text-text-3 underline" href={b.source} target="_blank" rel="noreferrer">Source <IconExternal size={12} /></a>
        </details>
      )}
      {v.alt.map((a, i) => (
        <details key={i} className="card-soft p-4">
          <summary className="text-[13.5px] font-semibold">Another reading · {a.by}</summary>
          <p className="reading mt-2 text-[15px]">{a.text}</p>
          <p className="mt-1 text-[12px] text-text-3">{a.cite}</p>
        </details>
      ))}
      <Related id={id} graph={graph} onNavigate={onNavigate} />
      <Link className="btn btn-sm" href={`/u/${up}/${v.ref}`}>Open in the reader</Link>
    </div>
  );
}
