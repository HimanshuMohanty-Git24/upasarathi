import { Ready } from "@/components/ui/Ready";
import Link from "next/link";
import type { Metadata } from "next";
import { getFacts, getKb } from "@/lib/server/data";
import { Art } from "@/components/ui/Art";
import { TEXT_HEX } from "@/components/explore/palette";

export const metadata: Metadata = { title: "Read the Upanishads" };

export default function TextsPage() {
  const kb = getKb();
  const facts = getFacts();
  const group = (scope: "complete" | "excerpts") => kb.texts.filter((t) => t.scope === scope);
  return (
    <>
      <Ready />
      <Art name="two-birds" alt="Two luminous birds on one tree" className="flex min-h-[clamp(380px,52vh,560px)] items-end" position="50% 58%">
        <div className="gutter on-art w-full pb-14 pt-24">
          <p className="eyebrow !text-[rgba(241,239,233,0.62)]">Read</p>
          <h1 className="display mt-3 text-[clamp(40px,5vw,76px)] leading-[1.02]">The Principal Upanishads</h1>
          <p className="mt-4 max-w-[62ch] text-[17px] leading-relaxed text-[rgba(241,239,233,0.85)]">
            Every passage in Devanagari and IAST, with a translation in the tradition of Śaṅkara, a second reading where available, the chant, and Śaṅkara&apos;s own commentary on {facts.bhashyaVerses} key mantras.
          </p>
        </div>
      </Art>
      <div className="gutter pb-24">
        {(["complete", "excerpts"] as const).map((scope) => (
          <section key={scope} className="mt-14">
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-3">
              <h2 className="display text-[28px]">{scope === "complete" ? "Complete texts" : "Story passages"}</h2>
              <span className="text-[13px] text-text-3">{scope === "complete" ? `${facts.mantras.complete} mantras, every one` : `${facts.mantras.excerpts} passages chosen for their stories`}</span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
              {group(scope).map((t) => (
                <Link key={t.id} href={`/u/${t.id}`} className="tile group flex min-h-[230px] flex-col p-6">
                  <span className="flex items-center justify-between gap-3">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: TEXT_HEX.dark[t.id], boxShadow: `0 0 14px ${TEXT_HEX.dark[t.id]}` }} />
                    <span className="text-[12px] text-text-4">{t.count} {scope === "complete" ? "mantras" : "passages"}</span>
                  </span>
                  <span className="deva mt-5 text-[22px] text-text-2" style={{ lineHeight: 1.3 }}>{t.sa}</span>
                  <span className="display mt-1 text-[28px]">{t.iast}</span>
                  <span className="mt-2 text-[14px] leading-relaxed text-text-3">{t.tagline}</span>
                  <span className="mt-auto pt-5 text-[12px] text-text-4">{t.veda} · {t.translators.join(", ")}{t.audio ? " · chant" : ""}</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
