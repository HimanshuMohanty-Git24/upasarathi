import Link from "next/link";
import { getFacts, getKb, getPaths, getRubric, getRun, getRuns } from "@/lib/server/data";
import { runContext } from "@/lib/server/runctx";
import { HeroArena } from "@/components/home/HeroArena";
import { CiteChip } from "@/components/verse/Drawer";
import { IconArrow } from "@/components/ui/Icons";

export default function Home() {
  const run = getRun("scripture-quote");
  const facts = getFacts();
  const rubric = getRubric();
  const runs = getRuns();
  const paths = getPaths();
  const kb = getKb();
  const kau122 = kb.verses.find((v) => v.id === "KaU_1.2.2")!;
  const concept = (id: string) => kb.concepts.find((c) => c.id === id);

  return (
    <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
      {/* ── Hero: the hook first ─────────────────────────────────────────────────────────── */}
      <section className="pt-8 sm:pt-12">
        <div className="max-w-[860px]">
          <p className="eyebrow">An alignment harness grounded in the Upanishads</p>
          <h1 className="mt-3 text-[34px] leading-[1.08] font-semibold tracking-tight sm:text-[48px]">
            Asked for a verse that doesn&apos;t exist, the model invented one.
          </h1>
          <p className="mt-4 max-w-[680px] text-[17px] leading-relaxed text-text-2">
            Assistants are tuned to be liked. The Kaṭha Upaniṣad calls that <em>preyas</em>, the pleasant, and sets it against <em>śreyas</em>, the good. UpaSārathi tests AI answers against the Upanishads and re-answers them, grounded in the text and cited to the verse.
          </p>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13.5px] text-text-3">
          <span>Virocana left Prajāpati “satisfied in his heart” <CiteChip id="ChU_8.8.4" label="ChU 8.8.4" />, and carried away the wrong teaching. Satisfaction is not truth.</span>
        </div>
        <div className="mt-6">{run ? <HeroArena run={run} ctx={runContext(run, ["KaU_1.1.27"])} /> : <p className="muted">Recorded runs are missing. Run <code>npm run runs:record</code>.</p>}</div>
      </section>

      {/* ── The distinction ─────────────────────────────────────────────────────────────── */}
      <section className="mt-24 grid gap-8 md:grid-cols-[1fr_1.1fr] md:items-center">
        <div>
          <p className="eyebrow">Kaṭha Upaniṣad 1.2.2</p>
          <p className="deva mt-3 text-[22px] sm:text-[26px]">{kau122.sa}</p>
          <p className="iast mt-2 text-[15px]">{kau122.iast}</p>
          <p className="reading mt-4 text-[16.5px] text-text-2">“{kau122.tr}”</p>
          <p className="mt-1 text-[12.5px] text-text-3">{kau122.trBy} · <CiteChip id="KaU_1.2.2" label="KaU 1.2.2" /></p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="card p-5" style={{ borderTop: "3px solid var(--preyas)" }}>
            <p className="eyebrow" style={{ color: "var(--preyas)" }}>Preyas · the pleasant</p>
            <p className="mt-2 text-[14.5px] text-text-2">{concept("preyas")?.desc}</p>
            <p className="mt-3 text-[13px] text-text-3">In a model: agreement, flattery, the quote you asked for, the decision made for you.</p>
          </div>
          <div className="card p-5" style={{ borderTop: "3px solid var(--accent)" }}>
            <p className="eyebrow" style={{ color: "var(--accent)" }}>Śreyas · the good</p>
            <p className="mt-2 text-[14.5px] text-text-2">{concept("shreyas")?.desc}</p>
            <p className="mt-3 text-[13px] text-text-3">In a model: the truth, said kindly, with the decision left with you.</p>
          </div>
        </div>
      </section>

      {/* ── The six axes ─────────────────────────────────────────────────────────────────── */}
      <section className="mt-24">
        <p className="eyebrow">How answers are scored</p>
        <h2 className="mt-2 text-[28px] font-semibold tracking-tight">Six axes, each grounded in the text</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rubric.axes.map((a) => (
            <div key={a.id} className="card p-5">
              <div className="flex items-baseline justify-between"><p className="text-[17px] font-semibold">{a.label}</p><span className="deva text-[16px] text-text-3" style={{ lineHeight: 1.2 }}>{a.sa}</span></div>
              <p className="text-[12.5px] text-text-3">{a.en}</p>
              <p className="mt-2 text-[14px] text-text-2">{a.question}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">{a.grounds.map((g) => <CiteChip key={g} id={`concept:${g}`} label={concept(g)?.iast ?? g} />)}</div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[13px] text-text-3">A blind judge (a different model, answers shuffled) scores 0 to 4 on each axis and must quote its evidence verbatim. Code checks every Sanskrit, IAST and English quotation against the corpus first.</p>
      </section>

      {/* ── Recorded runs ────────────────────────────────────────────────────────────────── */}
      <section className="mt-24">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">The red-team set</p>
            <h2 className="mt-2 text-[28px] font-semibold tracking-tight">{runs.length} recorded runs, replayable without a key</h2>
          </div>
          <Link href="/harness" className="btn">Run your own <IconArrow size={14} /></Link>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {runs.map((r) => (
            <Link key={r.id} href={`/harness/run/${r.id}`} className="card group flex flex-col p-5 hover:border-line-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{r.title}</p>
                {r.control ? <span className="chip">control</span> : r.sharpened ? <span className="chip">sharpened</span> : null}
              </div>
              <p className="mt-2 flex-1 text-[13.5px] text-text-2">{r.hook}</p>
              <div className="mt-4 grid gap-1 text-[12.5px]">
                <ScoreLine label="Baseline" v={r.totals.baseline} max={r.max} color="var(--preyas)" />
                <ScoreLine label="Re-aligned" v={r.totals.realigned} max={r.max} color="var(--accent)" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Learn and read ───────────────────────────────────────────────────────────────── */}
      <section className="mt-24 grid gap-10 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <p className="eyebrow">Walk a path</p>
          <h2 className="mt-2 text-[28px] font-semibold tracking-tight">Guided, verse by verse</h2>
          <div className="mt-5 grid gap-2">
            {paths.map((p) => (
              <Link key={p.id} href={`/paths/${p.id}`} className="card flex items-center justify-between gap-4 p-4 hover:border-line-3">
                <div>
                  <p className="font-semibold">{p.title}</p>
                  <p className="text-[13px] text-text-3">{p.subtitle} · {p.steps.length} steps · {p.minutes} min</p>
                </div>
                <IconArrow size={16} className="text-text-3" />
              </Link>
            ))}
          </div>
        </div>
        <div>
          <p className="eyebrow">Read and explore</p>
          <h2 className="mt-2 text-[28px] font-semibold tracking-tight">The texts</h2>
          <ul className="mt-5 divide-y divide-line border-y border-line">
            {kb.texts.map((t) => (
              <li key={t.id}>
                <Link href={`/u/${t.id}`} className="flex items-baseline justify-between gap-3 py-2.5 hover:text-accent">
                  <span><span className="font-semibold">{t.iast}</span> <span className="deva text-[14px] text-text-3" style={{ lineHeight: 1 }}>{t.sa}</span></span>
                  <span className="text-[12.5px] text-text-3">{t.scope === "complete" ? `${t.count} mantras` : `${t.count} passages · excerpts`}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/map" className="btn mt-4">Open the map <IconArrow size={14} /></Link>
          <p className="mt-4 text-[12.5px] text-text-3">
            {facts.mantras.total} passages · {facts.nodes} nodes · {facts.edges} links · {facts.bhashyaVerses} verses with Śaṅkara&apos;s commentary · {facts.audioVerses} with chant · {facts.anchors} anchor checks
          </p>
        </div>
      </section>
    </div>
  );
}

function ScoreLine({ label, v, max, color }: { label: string; v: number; max: number; color: string }) {
  return (
    <span className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-2">
      <span className="text-text-3">{label}</span>
      <span className="bar"><span style={{ width: `${max ? (v / max) * 100 : 0}%`, background: color }} /></span>
      <span className="num text-right">{v}/{max}</span>
    </span>
  );
}
