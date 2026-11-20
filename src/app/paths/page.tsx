import { Ready } from "@/components/ui/Ready";
import Link from "next/link";
import type { Metadata } from "next";
import { getPaths } from "@/lib/server/data";
import { IconArrow } from "@/components/ui/Icons";

export const metadata: Metadata = { title: "Paths" };

export default function PathsPage() {
  const paths = getPaths();
  return (
    <div className="mx-auto max-w-[900px] px-4 pt-8 sm:px-6">
      <Ready />
      <p className="eyebrow">Guided paths</p>
      <h1 className="mt-2 text-[32px] font-semibold tracking-tight">Start with a story, not a graph</h1>
      <p className="mt-3 max-w-[680px] text-[15.5px] text-text-2">Short routes through the texts, verse by verse, each ending with a question in your own words. Your progress stays on this device.</p>
      <div className="mt-8 grid gap-3">
        {paths.map((p, i) => (
          <Link key={p.id} href={`/paths/${p.id}`} className="card flex items-center gap-5 p-5 hover:border-line-3">
            <span className="num flex h-10 w-10 flex-none items-center justify-center rounded-full border border-line-2 text-[14px] text-text-3">{i + 1}</span>
            <span className="flex-1">
              <span className="block text-[17px] font-semibold">{p.title}</span>
              <span className="block text-[13px] text-text-3">{p.subtitle} · {p.steps.length} steps · about {p.minutes} minutes</span>
              <span className="mt-1.5 block text-[14px] text-text-2">{p.intro}</span>
            </span>
            <IconArrow size={18} className="text-text-3" />
          </Link>
        ))}
      </div>
    </div>
  );
}
