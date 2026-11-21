import { Ready } from "@/components/ui/Ready";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCorpus, getKb, getText } from "@/lib/server/data";
import { TEXT_HEX } from "@/components/explore/palette";
import { AskOpen } from "@/components/home/HomeClient";
import { IconChat, IconOrbit } from "@/components/ui/Icons";

export const dynamicParams = false;
export function generateStaticParams() {
  return getKb().texts.map((t) => ({ up: t.id }));
}
export async function generateMetadata({ params }: { params: Promise<{ up: string }> }): Promise<Metadata> {
  const { up } = await params;
  const t = getText(up);
  return { title: `${t?.iast ?? ""} Upaniṣad`, description: t?.tagline };
}

const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-");

export default async function TextPage({ params }: { params: Promise<{ up: string }> }) {
  const { up } = await params;
  const t = getText(up);
  if (!t) notFound();
  const verses = getCorpus(up);
  const sections = [...new Set(verses.map((v) => v.section))];
  const hue = TEXT_HEX.dark[t.id];
  return (
    <div className="gutter grid gap-10 pb-24 pt-10 lg:grid-cols-[minmax(280px,340px)_1fr] xl:gap-16">
      <Ready />
      <aside className="lg:sticky lg:top-[calc(var(--nav-h)+28px)] lg:h-fit">
        <Link href="/u" className="text-[13px] text-text-3 hover:text-text">← All texts</Link>
        <div className="mt-6 h-1 w-16 rounded-full" style={{ background: hue, boxShadow: `0 0 18px ${hue}` }} />
        <p className="deva mt-5 text-[30px]" style={{ lineHeight: 1.35 }}>{t.sa}</p>
        <h1 className="display text-[44px] leading-[1.05]">{t.iast} Upaniṣad</h1>
        <p className="mt-3 text-[15.5px] leading-relaxed text-text-2">{t.tagline}</p>
        <p className="mt-4 text-[13px] leading-relaxed text-text-3">
          {t.veda} · {t.count} {t.scope === "complete" ? "mantras" : "passages (story excerpts)"}
          <br />
          Translation: {t.translators.join(", ")}
          {t.audio && (<><br />Chant{t.audio.chanter ? ` by ${t.audio.chanter}` : ""}, per mantra, from upanishads.org.in</>)}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href={`/explore?node=up:${t.id}`} className="btn btn-sm"><IconOrbit size={14} /> In the cosmos</Link>
          <AskOpen className="btn btn-sm btn-ghost" question={`What is the ${t.iast} Upanishad about, and where should I begin?`}><IconChat size={14} /> Ask about it</AskOpen>
        </div>
        {sections.length > 1 && (
          <nav className="mt-8 hidden border-t border-line pt-5 lg:block" aria-label="Sections">
            <p className="eyebrow mb-2">Sections</p>
            <ul className="space-y-1 text-[13.5px]">
              {sections.map((s) => (
                <li key={s}><a href={`#${slug(s)}`} className="text-text-3 hover:text-text">{s}</a></li>
              ))}
            </ul>
          </nav>
        )}
      </aside>
      <div className="min-w-0">
        {sections.map((s) => (
          <section key={s} id={slug(s)} className="mb-10 scroll-mt-[calc(var(--nav-h)+20px)]">
            <h2 className="eyebrow border-b border-line pb-2">{s}</h2>
            <ul className="divide-y divide-line">
              {verses.filter((v) => v.section === s).map((v) => (
                <li key={v.id}>
                  <Link href={`/u/${up}/${v.ref}`} className="grid gap-x-8 gap-y-1 rounded-lg px-2 py-4 transition hover:bg-surface-2 md:grid-cols-[6.5rem_minmax(0,1.05fr)_minmax(0,1fr)]">
                    <span className="num pt-1 text-[13px] font-semibold text-text-3">
                      {t.abbrev} {v.ref}
                      {v.hasBhashya && <span className="chip chip-accent ml-0 mt-2 !text-[10.5px] md:flex md:w-fit">Śaṅkara</span>}
                    </span>
                    <span className="deva text-[17px]" style={{ lineHeight: 1.85 }}>{v.sa.slice(0, 2).map((l, k) => <span key={k} className="block">{l}</span>)}</span>
                    <span className="line-clamp-3 text-[14px] leading-relaxed text-text-2">{v.tr?.text}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
