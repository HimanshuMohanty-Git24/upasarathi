import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCorpus, getKb, getPaths } from "@/lib/server/data";
import { PathView, type StepData } from "@/components/paths/PathView";

export const dynamicParams = false;
export function generateStaticParams() {
  return getPaths().map((p) => ({ id: p.id }));
}
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: getPaths().find((p) => p.id === id)?.title ?? "Path" };
}

export default async function PathPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const paths = getPaths();
  const path = paths.find((p) => p.id === id);
  if (!path) notFound();
  const kb = getKb();
  const steps: StepData[] = path.steps.map((s) => {
    const lite = kb.verses.find((v) => v.id === s.node);
    if (lite) {
      const v = getCorpus(lite.up).find((x) => x.id === s.node)!;
      const t = kb.texts.find((x) => x.id === lite.up)!;
      return { ...s, verse: { id: v.id, label: `${t.abbrev} ${v.ref}`, up: v.up, ref: v.ref, sa: v.sa, iast: v.iast, tr: v.tr?.text ?? "", trBy: v.tr?.by ?? "", audio: v.audio?.mp3 ?? null, hasBhashya: v.hasBhashya } };
    }
    const c = kb.concepts.find((x) => `concept:${x.id}` === s.node);
    return { ...s, concept: c ? { id: s.node, iast: c.iast, sa: c.sa, en: c.en, desc: c.desc } : undefined };
  });
  const next = paths[paths.indexOf(path) + 1];
  return (
    <div className="mx-auto max-w-[860px] px-4 pt-8 sm:px-6">
      <Link href="/paths" className="text-[13px] text-text-3 hover:text-text">← All paths</Link>
      <p className="eyebrow mt-5">{path.subtitle}</p>
      <h1 className="mt-1 text-[32px] font-semibold tracking-tight">{path.title}</h1>
      <p className="mt-3 text-[16px] text-text-2">{path.intro}</p>
      <PathView pathId={path.id} steps={steps} />
      {next && (
        <Link href={`/paths/${next.id}`} className="card mt-10 flex items-center justify-between p-5 hover:border-line-3">
          <span><span className="eyebrow">Next path</span><span className="block text-[17px] font-semibold">{next.title}</span></span>
          <span aria-hidden>→</span>
        </Link>
      )}
    </div>
  );
}
