import { Ready } from "@/components/ui/Ready";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCorpus, getKb, getText } from "@/lib/server/data";

export const dynamicParams = false;
export function generateStaticParams() {
  return getKb().texts.map((t) => ({ up: t.id }));
}
export async function generateMetadata({ params }: { params: Promise<{ up: string }> }): Promise<Metadata> {
  const { up } = await params;
  return { title: `${getText(up)?.iast ?? ""} Upaniṣad` };
}

export default async function TextPage({ params }: { params: Promise<{ up: string }> }) {
  const { up } = await params;
  const t = getText(up);
  if (!t) notFound();
  const verses = getCorpus(up);
  const sections = [...new Set(verses.map((v) => v.section))];
  return (
    <div className="mx-auto max-w-[900px] px-4 pt-8 sm:px-6">
      <Ready />
      <Link href="/u" className="text-[13px] text-text-3 hover:text-text">← All texts</Link>
      <p className="deva mt-4 text-[26px]">{t.sa}</p>
      <h1 className="text-[32px] font-semibold tracking-tight">{t.iast} Upaniṣad</h1>
      <p className="text-[13px] text-text-3">{t.veda} · {t.count} {t.scope === "complete" ? "mantras" : "passages (story excerpts)"} · translation: {t.translators.join(", ")}</p>
      <p className="mt-3 text-[15.5px] text-text-2">{t.tagline}</p>
      {t.audio && <p className="mt-2 text-[12.5px] text-text-3">Chant{t.audio.chanter ? ` by ${t.audio.chanter}` : ""}, per mantra, from upanishads.org.in.</p>}
      {sections.map((s) => (
        <section key={s} className="mt-8">
          <h2 className="eyebrow border-b border-line pb-2">{s}</h2>
          <ul className="divide-y divide-line">
            {verses.filter((v) => v.section === s).map((v) => (
              <li key={v.id}>
                <Link href={`/u/${up}/${v.ref}`} className="grid grid-cols-[4.5rem_1fr] gap-3 py-3 hover:bg-surface-2 sm:grid-cols-[5.5rem_1fr]">
                  <span className="num pt-1 text-[13px] font-semibold text-text-3">{t.abbrev} {v.ref}</span>
                  <span>
                    <span className="deva block text-[16px]" style={{ lineHeight: 1.8 }}>{v.sa[0]}</span>
                    <span className="mt-0.5 line-clamp-2 block text-[13.5px] text-text-2">{v.tr?.text}</span>
                    {(v.hasBhashya || !v.audio) && (
                      <span className="mt-1 flex gap-1.5">
                        {v.hasBhashya && <span className="chip chip-accent">Śaṅkara</span>}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
