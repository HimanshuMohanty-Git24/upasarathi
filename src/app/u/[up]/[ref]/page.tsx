import { Ready } from "@/components/ui/Ready";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBhashya, getCorpus, getGraph, getKb, getText } from "@/lib/server/data";
import { REL_LABEL } from "@/lib/core/graph";
import { AudioButton } from "@/components/verse/AudioButton";
import { CiteChip } from "@/components/verse/Drawer";
import { AskOpen } from "@/components/home/HomeClient";
import { TEXT_HEX } from "@/components/explore/palette";
import { IconArrow, IconBack, IconChat, IconExternal, IconOrbit } from "@/components/ui/Icons";

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
  const hue = TEXT_HEX.dark[t.id];
  const nearby = verses.slice(Math.max(0, i - 6), i + 7);

  return (
    <div className="gutter grid gap-10 pb-24 pt-8 xl:grid-cols-[220px_minmax(0,1fr)_minmax(340px,440px)] xl:gap-12">
      <Ready />
      {/* ── left: where you are ── */}
      <nav className="hidden xl:sticky xl:top-[calc(var(--nav-h)+28px)] xl:block xl:h-fit" aria-label="Nearby mantras">
        <Link href={`/u/${up}`} className="text-[13px] text-text-3 hover:text-text">← {t.iast} Upaniṣad</Link>
        <p className="eyebrow mb-2 mt-6">{v.section}</p>
        <ul className="space-y-0.5 text-[13.5px]">
          {nearby.map((x) => (
            <li key={x.id}>
              <Link href={`/u/${up}/${x.ref}`} aria-current={x.id === v.id ? "page" : undefined} className={`flex items-center gap-2 rounded-md px-2 py-1 ${x.id === v.id ? "bg-surface-3 text-text" : "text-text-3 hover:text-text"}`}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: x.id === v.id ? hue : "var(--line-3)" }} />
                {t.abbrev} {x.ref}
                {x.hasBhashya && <span className="ml-auto text-[10px] text-accent">Ś</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── centre: the mantra ── */}
      <article className="min-w-0">
        <div className="flex items-center justify-between gap-3 text-[13px] text-text-3 xl:hidden">
          <Link href={`/u/${up}`} className="hover:text-text">← {t.iast} Upaniṣad · {v.section}</Link>
        </div>
        <p className="eyebrow mt-4 xl:mt-0" style={{ color: hue }}>{t.iast} Upaniṣad · {v.section}</p>
        <h1 className="display mt-2 text-[clamp(34px,3.4vw,52px)]">{t.abbrev} {v.ref}</h1>
        <div className="deva mt-6 text-[clamp(24px,2.2vw,32px)]">{v.sa.map((l, k) => <div key={k}>{l}</div>)}</div>
        <div className="iast mt-4 text-[17px]">{v.iast.map((l, k) => <div key={k}>{l}</div>)}</div>
        <div className="mt-6 flex flex-wrap gap-2">
          <AudioButton src={v.audio?.mp3} label="Hear the chant" />
          <Link className="btn btn-sm" href={`/explore?node=${encodeURIComponent(v.id)}`}><IconOrbit size={14} /> In the cosmos</Link>
          <AskOpen className="btn btn-sm btn-ghost" question={`Explain ${t.abbrev} ${v.ref}: what is it saying, and what does it mean for how I live?`}><IconChat size={14} /> Ask about this mantra</AskOpen>
        </div>
        {v.tr && (
          <figure className="mt-9 border-l-2 pl-6" style={{ borderColor: hue }}>
            <blockquote className="reading max-w-[68ch] text-[19px] leading-[1.75]">{v.tr.text}</blockquote>
            <figcaption className="mt-3 text-[13px] text-text-3">
              {v.tr.by} · in the tradition of Śaṅkara{v.tr.joint ? ` · this translation renders ${t.abbrev} ${v.tr.joint} together` : ""}
            </figcaption>
          </figure>
        )}
        {v.alt.map((a, k) => (
          <details key={k} className="card-soft mt-6 max-w-[76ch] p-5">
            <summary className="font-semibold">Another reading · {a.by}</summary>
            <p className="reading mt-2 text-[16px]">{a.text}</p>
            <p className="mt-1 text-[12.5px] text-text-3">{a.cite}</p>
          </details>
        ))}
        <div className="mt-12 flex items-center justify-between gap-3 border-t border-line pt-5 text-[14px]">
          {prev ? <Link href={`/u/${up}/${prev.ref}`} className="btn btn-ghost"><IconBack size={15} /> {t.abbrev} {prev.ref}</Link> : <span />}
          {next ? <Link href={`/u/${up}/${next.ref}`} className="btn">{t.abbrev} {next.ref} <IconArrow size={15} /></Link> : <span />}
        </div>
      </article>

      {/* ── right: commentary and connections ── */}
      <aside className="min-w-0 space-y-6 xl:sticky xl:top-[calc(var(--nav-h)+28px)] xl:h-fit xl:max-h-[calc(100dvh-var(--nav-h)-48px)] xl:overflow-y-auto xl:pr-1 scroll-thin">
        {b ? (
          <details className="card p-5" open>
            <summary className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[16px] font-semibold">Śaṅkara&apos;s commentary <span className="font-normal text-text-3">(bhāṣya)</span></span>
            </summary>
            <p className="mt-1 text-[12.5px] text-text-3">tr. {b.translator}, {b.edition}</p>
            <div className="reading mt-3 max-h-[52vh] overflow-y-auto pr-1 text-[15px] whitespace-pre-line scroll-thin">{b.text}</div>
            <a className="mt-3 inline-flex items-center gap-1 text-[12.5px] text-text-3 underline" href={b.source} target="_blank" rel="noreferrer">Source: Wisdom Library <IconExternal size={12} /></a>
          </details>
        ) : (
          <div className="rounded-2xl border border-dashed border-line-2 p-5 text-[13.5px] text-text-3">Śaṅkara&apos;s commentary is included for {kb.verses.filter((x) => x.hasBhashya).length} anchor mantras; this is not one of them yet.</div>
        )}
        {rel.length > 0 && (
          <div className="card p-5">
            <p className="text-[16px] font-semibold">In the graph</p>
            <div className="mt-3 space-y-5">
              {[["TEACHES", "Teaches"], ["DIAGNOSES", "Speaks to"], ["IN_STORY", "Story"]].map(([type, name]) =>
                of(type).length ? (
                  <div key={type}>
                    <p className="eyebrow">{name}</p>
                    <ul className="mt-2 space-y-2">{of(type).map((e, k) => <li key={k} className="text-[14px]"><CiteChip id={e.t} label={label(e.t)} /> {e.why && <span className="text-text-3">{e.why}</span>}</li>)}</ul>
                  </div>
                ) : null,
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
            </div>
            <p className="mt-5 text-[12px] text-text-4">Links marked as teaching or speaking to a situation are editorial readings ({REL_LABEL.TEACHES.out}, {REL_LABEL.DIAGNOSES.out}), not translations.</p>
          </div>
        )}
      </aside>
    </div>
  );
}
