import { Ready } from "@/components/ui/Ready";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBhashya, getCorpus, getGraph, getKb, getText } from "@/lib/server/data";
import { REL_LABEL } from "@/lib/core/graph";
import { AudioButton } from "@/components/verse/AudioButton";
import { CiteChip } from "@/components/verse/Drawer";
import { IconExternal } from "@/components/ui/Icons";

export const dynamicParams = false;
export function generateStaticParams() {
  return getKb().verses.map((v) => ({ up: v.up, ref: v.ref }));
}
export async function generateMetadata({ params }: { params: Promise<{ up: string; ref: string }> }): Promise<Metadata> {
  const { up, ref } = await params;
  const t = getText(up);
  const v = getCorpus(up).find((x) => x.ref === ref);
  return { title: `${t?.iast} Upaniṣad ${ref}`, description: v?.tr?.text.slice(0, 160) };
}

export default async function VersePage({ params }: { params: Promise<{ up: string; ref: string }> }) {
  const { up, ref } = await params;
  const t = getText(up);
  const verses = getCorpus(up);
  const i = verses.findIndex((x) => x.ref === ref);
  if (!t || i < 0) notFound();
  const v = verses[i];
  const prev = verses[i - 1];
  const next = verses[i + 1];
  const b = getBhashya(up)[v.id];
  const kb = getKb();
  const graph = getGraph();
  const label = (id: string) => graph.nodes.find((n) => n.id === id)?.label ?? id;
  const rel = graph.edges.filter((e) => (e.s === v.id || e.t === v.id) && !["PART_OF", "NEXT"].includes(e.type));
  const of = (type: string) => rel.filter((e) => e.type === type);
  const cross = of("CROSS_REFERENCES");

  return (
    <article className="mx-auto max-w-[860px] px-4 pt-8 sm:px-6">
      <Ready />
      <nav className="flex items-center justify-between text-[13px] text-text-3">
        <Link href={`/u/${up}`} className="hover:text-text">← {t.iast} Upaniṣad · {v.section}</Link>
        <span className="flex gap-3">
          {prev && <Link href={`/u/${up}/${prev.ref}`} className="hover:text-text">← {prev.ref}</Link>}
          {next && <Link href={`/u/${up}/${next.ref}`} className="hover:text-text">{next.ref} →</Link>}
        </span>
      </nav>
      <h1 className="mt-5 text-[13px] font-semibold uppercase tracking-[0.1em] text-text-3">{t.iast} Upaniṣad {v.ref}</h1>
      <div className="deva mt-3 text-[24px] sm:text-[28px]">{v.sa.map((l, k) => <div key={k}>{l}</div>)}</div>
      <div className="iast mt-3 text-[16px]">{v.iast.map((l, k) => <div key={k}>{l}</div>)}</div>
      <div className="mt-4 flex flex-wrap gap-2">
        <AudioButton src={v.audio?.mp3} label="Hear the chant" />
        <Link className="btn btn-sm" href={`/map?node=${encodeURIComponent(v.id)}`}>In the map</Link>
      </div>

      {v.tr && (
        <figure className="mt-6">
          <blockquote className="reading text-[18px]">{v.tr.text}</blockquote>
          <figcaption className="mt-2 text-[13px] text-text-3">
            {v.tr.by} · in the tradition of Śaṅkara{v.tr.joint ? ` · this translation renders ${t.abbrev} ${v.tr.joint} together` : ""}
          </figcaption>
        </figure>
      )}

      {b && (
        <details className="card mt-6 p-5" open>
          <summary className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-[16px] font-semibold">Śaṅkara&apos;s commentary <span className="font-normal text-text-3">(bhāṣya)</span></span>
            <span className="text-[12.5px] text-text-3">tr. {b.translator}, {b.edition}</span>
          </summary>
          <div className="reading mt-3 text-[15.5px] whitespace-pre-line">{b.text}</div>
          <a className="mt-3 inline-flex items-center gap-1 text-[12.5px] text-text-3 underline" href={b.source} target="_blank" rel="noreferrer">Source: Wisdom Library <IconExternal size={12} /></a>
        </details>
      )}

      {v.alt.map((a, k) => (
        <details key={k} className="card-soft mt-4 p-5">
          <summary className="font-semibold">Another reading · {a.by}</summary>
          <p className="reading mt-2 text-[16px]">{a.text}</p>
          <p className="mt-1 text-[12.5px] text-text-3">{a.cite}</p>
        </details>
      ))}

      {rel.length > 0 && (
        <section className="mt-8 grid gap-6 sm:grid-cols-2">
          {of("TEACHES").length > 0 && (
            <div>
              <p className="eyebrow">Teaches</p>
              <ul className="mt-2 space-y-2">{of("TEACHES").map((e, k) => <li key={k} className="text-[14px]"><CiteChip id={e.t} label={label(e.t)} /> <span className="text-text-3">{e.why}</span></li>)}</ul>
            </div>
          )}
          {of("DIAGNOSES").length > 0 && (
            <div>
              <p className="eyebrow">Speaks to</p>
              <ul className="mt-2 space-y-2">{of("DIAGNOSES").map((e, k) => <li key={k} className="text-[14px]"><CiteChip id={e.t} label={label(e.t)} /> <span className="text-text-3">{e.why}</span></li>)}</ul>
            </div>
          )}
          {of("IN_STORY").length > 0 && (
            <div>
              <p className="eyebrow">Story</p>
              <ul className="mt-2 space-y-2">{of("IN_STORY").map((e, k) => <li key={k}><CiteChip id={e.t} label={label(e.t)} /></li>)}</ul>
            </div>
          )}
          {cross.length > 0 && (
            <div>
              <p className="eyebrow">Parallels</p>
              <ul className="mt-2 space-y-2">
                {cross.map((e, k) => {
                  const other = e.s === v.id ? e.t : e.s;
                  const ext = kb.external[other];
                  return (
                    <li key={k} className="text-[14px]">
                      {ext?.url ? <a className="cite" href={ext.url} target="_blank" rel="noreferrer">{ext.label} · {ext.corpus} ↗</a> : <CiteChip id={other} label={ext ? `${ext.label} · ${ext.corpus}` : label(other)} />}{" "}
                      <span className="text-text-3">{e.kind} · {e.why}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>
      )}
      <p className="mt-8 text-[12px] text-text-3">Links marked as teaching or speaking to a situation are editorial readings ({REL_LABEL.TEACHES.out}, {REL_LABEL.DIAGNOSES.out}), not translations.</p>
    </article>
  );
}
