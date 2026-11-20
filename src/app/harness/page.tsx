import { Ready } from "@/components/ui/Ready";
import Link from "next/link";
import type { Metadata } from "next";
import { getFacts, getRubric, getRuns } from "@/lib/server/data";
import { LiveHarness } from "@/components/harness/LiveHarness";

export const metadata: Metadata = { title: "The Alignment Harness" };

export default function HarnessPage() {
  const rubric = getRubric();
  const runs = getRuns();
  const facts = getFacts();
  return (
    <div className="mx-auto max-w-[1240px] px-4 pt-8 sm:px-6">
      <Ready />
      <p className="eyebrow">The Alignment Harness</p>
      <h1 className="mt-2 text-[32px] font-semibold tracking-tight">Does the answer serve the person, or please them?</h1>
      <p className="mt-3 max-w-[720px] text-[15.5px] text-text-2">
        Each request goes to the same model twice: once with a neutral prompt, once grounded in an evidence packet from the Upanishads. Code checks every quotation; a blind judge scores both answers.
      </p>

      <div className="mt-8"><LiveHarness presets={rubric.presets} axes={rubric.axes} corpusSize={facts.mantras.total} /></div>

      <section className="mt-12">
        <h2 className="text-[20px] font-semibold">Recorded runs</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {runs.map((r) => (
            <div key={r.id} className="card p-4">
              <p className="font-semibold">{r.title}</p>
              <p className="mt-1 text-[13px] text-text-2">{r.hook}</p>
              <p className="num mt-2 text-[12.5px] text-text-3">Baseline {r.totals.baseline} · Re-aligned {r.totals.realigned} / {r.max}</p>
              <div className="mt-3 flex gap-2">
                <Link className="btn btn-sm btn-accent" href={`/harness/run/${r.id}`}>Replay</Link>
                <Link className="btn btn-sm" href={`/harness/compare/${r.id}`}>Compare</Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="method" className="mt-14 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="text-[20px] font-semibold">How scoring works</h2>
          <ol className="mt-3 space-y-2 text-[14.5px] text-text-2">
            <li><b>A · Baseline.</b> The model under test, with the neutral system prompt “{rubric.baselineSystem}” and default settings, plus enough token budget for reasoning models.</li>
            <li><b>B · Diagnosis.</b> Code, not a model, routes the request onto human situations and pressure patterns, walks the knowledge graph two hops, and freezes an evidence packet. If nothing in the corpus speaks to the request, the status is <i>insufficient evidence</i> and nothing may be cited.</li>
            <li><b>C · Re-aligned.</b> The same model, given the packet. Citations outside the packet are removed; invented quotations, a missing citation or an offer to “do more” trigger one repair pass.</li>
            <li><b>D · Checks.</b> Every Sanskrit, IAST and quoted English line is looked up in the corpus. Flattery and engagement bait are flagged. Flags are not scores.</li>
            <li><b>E · Blind judge.</b> A different model (when available) sees both answers as A and B in random order, with the code&apos;s audit as fact. Every score must quote its answer verbatim, or it is discarded.</li>
          </ol>
        </div>
        <div>
          <h2 className="text-[20px] font-semibold">What this does not show</h2>
          <ul className="mt-3 space-y-2 text-[14.5px] text-text-2">
            <li>Six prompts are a demonstration, not a benchmark. Models change, and some baseline samples answer well. The Scripture Quote failure was one of two samples; the record says so.</li>
            <li>The Reins and The Genius Idea use sharpened user prompts. The baseline system prompt is never altered.</li>
            <li>The judge is itself a model. Facts outside the corpus (statistics, market sizes) are not verified by code, and the judge may accept them.</li>
            <li>The concept and situation links are editorial readings, labelled as such, not doctrine.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
