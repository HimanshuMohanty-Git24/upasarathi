import { Ready } from "@/components/ui/Ready";
import Link from "next/link";
import type { Metadata } from "next";
import { getFacts, getKb } from "@/lib/server/data";

export const metadata: Metadata = { title: "Read" };

export default function TextsPage() {
  const kb = getKb();
  const facts = getFacts();
  const group = (scope: "complete" | "excerpts") => kb.texts.filter((t) => t.scope === scope);
  return (
    <div className="mx-auto max-w-[1040px] px-4 pt-8 sm:px-6">
      <Ready />
      <p className="eyebrow">Read</p>
      <h1 className="mt-2 text-[32px] font-semibold tracking-tight">The Principal Upanishads</h1>
      <p className="mt-3 max-w-[700px] text-[15.5px] text-text-2">
        Every passage in Devanagari and IAST, with a translation in the tradition of Śaṅkara, a second reading where available, the chant, and Śaṅkara&apos;s own commentary on {facts.bhashyaVerses} key verses.
      </p>
      {(["complete", "excerpts"] as const).map((scope) => (
        <section key={scope} className="mt-10">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-text-3">{scope === "complete" ? `Complete · ${facts.mantras.complete} mantras` : `Story passages · ${facts.mantras.excerpts} passages`}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {group(scope).map((t) => (
              <Link key={t.id} href={`/u/${t.id}`} className="card p-5 hover:border-line-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[18px] font-semibold">{t.iast}</p>
                  <span className="deva text-[17px] text-text-3" style={{ lineHeight: 1.3 }}>{t.sa}</span>
                </div>
                <p className="text-[12.5px] text-text-3">{t.veda} · {t.count} {scope === "complete" ? "mantras" : "passages"}</p>
                <p className="mt-2 text-[14px] text-text-2">{t.tagline}</p>
                <p className="mt-2 text-[12px] text-text-3">Translation: {t.translators.join(", ")}{t.audio ? " · chant" : ""}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
