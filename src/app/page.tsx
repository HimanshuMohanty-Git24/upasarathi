import Link from "next/link";
import { getCorpus, getFacts, getGraph, getIndex, getPaths, getRun } from "@/lib/server/data";
import { getBench } from "@/lib/server/bench";
import { runContext } from "@/lib/server/runctx";
import { VEDA_ORDER } from "@/lib/core/layout";
import type { GEdge, GNode } from "@/lib/core/types";
import { SIDES, SIDE_LABEL } from "@/lib/core/judge";
import { Art } from "@/components/ui/Art";
import { AskOpen, HomeAsk, HomeReady, VedaMiniMap } from "@/components/home/HomeClient";
import { RunView } from "@/components/harness/RunView";
import { AudioButton } from "@/components/verse/AudioButton";
import { CiteChip } from "@/components/verse/Drawer";
import { SUGGESTIONS } from "@/components/ask/suggestions";
import { TEXT_HEX } from "@/components/explore/palette";
import { IconArrow, IconBook, IconChat, IconMap, IconRoute, IconScale } from "@/components/ui/Icons";

export default function Home() {
  const facts = getFacts();
  const ix = getIndex();
  const graph = getGraph();
  const paths = getPaths();
  const bench = getBench();
  const quick = paths.reduce((a, b) => (b.minutes < a.minutes ? b : a), paths[0]);
  const verse = (up: string, id: string) => getCorpus(up).find((v) => v.id === id)!;
  const birds = verse("mundaka", "MuU_3.1.1");
  const chariot = verse("katha", "KaU_1.3.3");
  const horses = verse("katha", "KaU_1.3.4");
  const hero = getRun(bench.hero);
  const heroCtx = hero ? runContext(hero, ["KaU_1.1.27"]) : null;
  // The Veda → Upanishad map: roots on the left, the texts that distil them on the right.
  const vedaNodes: GNode[] = [...VEDA_ORDER.map((v) => graph.nodes.find((n) => n.id === `veda:${v}`)!), ...ix.texts.map((t) => graph.nodes.find((n) => n.id === `up:${t.id}`)!)].filter(Boolean).map((n) => (n.type === "Upanishad" ? { ...n, sub: undefined } : { ...n, sub: undefined }));
  const vedaEdges: GEdge[] = ix.texts.map((t) => ({ s: `veda:${t.lineage?.veda}`, t: `up:${t.id}`, type: "PART_OF", basis: "text" }));

  return (
    <>
      <HomeReady />
      {/* ── 1 · Hero: the premise ───────────────────────────────────────────────────────── */}
      <Art name="hero-wide" portrait="hero-portrait" alt="A boy sits with a lamp at the door of a forest temple before dawn" eager className="hero grain flex items-end" imgClassName="kenburns" position="70% 60%">
        <div className="gutter on-art relative w-full pb-[clamp(36px,7vh,88px)] pt-[calc(var(--nav-h)+12vh)]">
          <div className="max-w-[min(880px,64vw)] max-md:max-w-none">
            <p className="deva rise text-[clamp(17px,1.6vw,22px)] text-[#f3cf7a]" style={{ lineHeight: 1.6 }}>उत्तिष्ठत जाग्रत प्राप्य वरान्निबोधत</p>
            <h1 className="display hero-title rise rise-2 mt-3 !text-[clamp(40px,5.2vw,86px)]">
              Modern AI is trained to please you.
              <br />
              <span className="text-[#f3cf7a]">The Upanishads were written to wake you up.</span>
            </h1>
            <p className="rise rise-3 mt-6 max-w-[640px] text-[clamp(16px,1.25vw,19px)] leading-relaxed text-[rgba(241,239,233,0.86)]">
              All thirteen Principal Upanishads, rooted in their Vedas: every passage in Devanagari, IAST and translation, with the chant and Śaṅkara&apos;s commentary. Read them, walk them, and use them to test whether an AI tells you the truth or what you want to hear.
            </p>
            <div className="rise rise-4 mt-8 flex flex-wrap items-center gap-3">
              <Link href={`/paths/${quick.id}`} className="btn btn-accent btn-lg">
                <IconRoute size={18} /> Start a {quick.minutes}-Min Guided Path
              </Link>
              <Link href="/u" className="btn btn-outline btn-lg !border-[rgba(255,255,255,0.3)] !text-white hover:!bg-[rgba(255,255,255,0.08)]">
                <IconBook size={17} /> Browse the 13 Upanishads
              </Link>
              <Link href="/harness#live" className="btn btn-outline btn-lg !border-[rgba(255,255,255,0.3)] !text-white hover:!bg-[rgba(255,255,255,0.08)]">
                <IconScale size={17} /> Test Your Own Prompt
              </Link>
            </div>
          </div>
          <div className="stat-row rise rise-4 mt-[clamp(40px,8vh,96px)] border-t border-[rgba(255,255,255,0.14)] pt-6">
            <div><b>{facts.texts.total}</b><span>Upanishads</span></div>
            <div><b>{facts.mantras.total.toLocaleString()}</b><span>Passages</span></div>
            <div><b>{facts.bhashyaVerses}</b><span>With Śaṅkara</span></div>
            <div><b>{facts.audioVerses}</b><span>Chanted</span></div>
            <div><b>{facts.semanticEdges.toLocaleString()}</b><span>Meaningful links</span></div>
            <div className="ml-auto hidden max-w-[300px] self-end text-right text-[12.5px] leading-snug text-[rgba(241,239,233,0.6)] lg:block">
              “Arise, awake, and learn by approaching the exalted ones.” <CiteChip id="KaU_1.3.14" label="KaU 1.3.14" />
            </div>
          </div>
        </div>
      </Art>

      {/* ── 2 · The arena: the Scripture Quote replay ───────────────────────────────────── */}
      {hero && heroCtx && (
        <section id="arena" className="gutter scroll-mt-20 py-[clamp(64px,10vh,120px)]">
          <div className="grid gap-10 xl:grid-cols-[minmax(320px,0.62fr)_1.38fr] xl:gap-14">
            <div>
              <p className="eyebrow">The arena · {hero.title}</p>
              <h2 className="display band-title mt-3">Asked for a quote, a model invented one.</h2>
              <p className="mt-5 max-w-[50ch] text-[16.5px] leading-relaxed text-text-2">
                A real recorded run. The baseline answered fluently and attributed a line to the Kaṭha that is not in the Kaṭha. The same model, given the evidence from the graph, quoted the real mantra: Naciketas refusing wealth, <CiteChip id="KaU_1.1.27" label="KaU 1.1.27" />.
              </p>
              <div className="mt-5"><AudioButton src={heroCtx.verses["KaU_1.1.27"]?.audio} label="Hear KaU 1.1.27 chanted" track={{ id: "KaU_1.1.27", label: "KaU 1.1.27" }} /></div>
              <div className="mt-8 grid grid-cols-3 gap-2">
                {SIDES.map((s) => (
                  <div key={s} className="rounded-xl border border-line-2 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: s === "baseline" ? "var(--preyas)" : s === "control" ? "var(--control)" : "var(--accent)" }}>{SIDE_LABEL[s]}</p>
                    <p className="num mt-1 text-[26px] font-semibold">{bench.overall[s] === null ? "–" : `${bench.overall[s]}%`}</p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[12px] text-text-4">Share of the maximum score, judged blind, over {bench.comparable} comparable runs of {bench.models.map((m) => m.model).join(", ")}.</p>
              <div className="mt-7 flex flex-wrap gap-2">
                <Link href={`/harness/run/${hero.id}`} className="btn">Full replay <IconArrow size={15} /></Link>
                <Link href="/harness#benchmark" className="btn btn-ghost">The 3-way benchmark</Link>
              </div>
            </div>
            <div className="min-w-0">
              <RunView run={hero} ctx={heroCtx} layout="hero" mode="replay" />
            </div>
          </div>
        </section>
      )}

      {/* ── 3 · Veda → Upanishad ────────────────────────────────────────────────────────── */}
      <section className="border-y border-line bg-[var(--bg-2)] py-[clamp(64px,10vh,120px)]">
        <div className="gutter grid items-center gap-10 lg:grid-cols-[minmax(320px,0.7fr)_1.3fr] xl:gap-16">
          <div>
            <p className="eyebrow">Veda-Sāra · the roots</p>
            <h2 className="display band-title mt-3">Five Vedas. Thirteen Upanishads. One essence.</h2>
            <p className="mt-5 max-w-[52ch] text-[16.5px] leading-relaxed text-text-2">
              Each Upanishad closes a Veda: the <i>Vedānta</i>, the end of the Veda, and its <i>sāra</i>, its essence. Follow a text back to its school and Brāhmaṇa, and a mantra back to the Saṃhitā hymn it takes up, like the two birds of <CiteChip id="MuU_3.1.1" label="MuU 3.1.1" />, first sung in the Ṛgveda.
            </p>
            <ul className="mt-7 space-y-3 text-[15px]">
              {[
                [`${facts.concepts} ideas, ${facts.stories} stories, ${facts.stems} key words`, "every one linked to the passages that carry it; click any Sanskrit word to find it everywhere"],
                [`${facts.shankaraLinks} Śaṅkara cross-references`, "where his commentary on one passage cites another"],
                [`${facts.vedaSaraLinks} Veda-Sāra links`, "into the Saṃhitās, the Gītā and the Brahma Sūtra"],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--gold)] shadow-[0_0_10px_var(--gold)]" />
                  <span><b className="font-semibold">{t}</b><span className="block text-text-3">{d}</span></span>
                </li>
              ))}
            </ul>
            <Link href="/map?roots=1" className="btn btn-accent btn-lg mt-8"><IconMap size={17} /> Open the map</Link>
          </div>
          <div className="card overflow-hidden p-2">
            <VedaMiniMap nodes={vedaNodes} edges={vedaEdges} height={520} />
          </div>
        </div>
      </section>

      {/* ── 4 · Ask ──────────────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-[clamp(72px,11vh,130px)]">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(127,196,168,0.12),transparent)]" />
        <div className="gutter relative mx-auto max-w-[1100px] text-center">
          <p className="eyebrow">Chat with the graph</p>
          <h2 className="display band-title mt-3">Ask the Upanishads.</h2>
          <p className="mx-auto mt-4 max-w-[62ch] text-[16.5px] leading-relaxed text-text-2">
            The graph finds the mantras, ideas and stories that bear on your question and answers from them. Connect Claude, GPT, Gemini or any model with your own key for written answers; every citation is checked against the corpus before you see it. Your conversations stay in this browser.
          </p>
          <div className="mt-9">
            <HomeAsk suggestions={SUGGESTIONS.slice(0, 5)} />
          </div>
        </div>
      </section>

      {/* ── 5 · Read: the two birds ──────────────────────────────────────────────────────── */}
      <section className="gutter grid items-center gap-10 border-t border-line py-[clamp(72px,11vh,140px)] lg:grid-cols-[1fr_1.15fr] xl:gap-20">
        <Art name="two-birds" alt="Two luminous birds on one tree; one eats the fruit, the other watches" shade="none" className="h-[clamp(420px,78vh,820px)] rounded-[28px] border border-line-2" position="50% 55%" />
        <div>
          <p className="eyebrow">Read · Muṇḍaka Upaniṣad 3.1.1 · Śvetāśvatara 4.6</p>
          <h2 className="display band-title mt-3">Read it the way it was written.</h2>
          <div className="mt-8 border-l-2 border-[var(--gold)] pl-6">
            <div className="deva text-[clamp(20px,1.7vw,26px)]">{birds.sa.map((l, i) => <div key={i}>{l}</div>)}</div>
            <div className="iast mt-3 text-[15.5px]">{birds.iast.map((l, i) => <div key={i}>{l}</div>)}</div>
            <p className="reading mt-4 max-w-[60ch] text-[17px]">{birds.tr?.text}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {birds.audio && <AudioButton src={birds.audio.mp3} label="Hear the chant" track={{ id: birds.id, label: "MuU 3.1.1" }} />}
              <span className="text-[12.5px] text-text-3">{birds.tr?.by}</span>
            </div>
          </div>
          <ul className="mt-9 grid gap-x-8 gap-y-3 text-[14.5px] text-text-2 sm:grid-cols-2">
            <li><b className="text-text">Devanagari and IAST</b>, toggle either</li>
            <li><b className="text-text">{facts.translatedVerses.toLocaleString()} translations</b> in the tradition of Śaṅkara</li>
            <li><b className="text-text">Śaṅkara&apos;s commentary</b> on {facts.bhashyaVerses} passages</li>
            <li><b className="text-text">The chant</b> for {facts.audioVerses} mantras, with speed and loop</li>
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/u/mundaka/3.1.1" className="btn btn-lg"><IconBook size={17} /> Open the reader</Link>
            <AskOpen question="Explain the two birds on one tree." className="btn btn-ghost btn-lg">Ask about the two birds <IconArrow size={15} /></AskOpen>
          </div>
        </div>
      </section>

      {/* ── 6 · The name: the chariot ────────────────────────────────────────────────────── */}
      <Art name="chariot" alt="A chariot with four horses races through morning mist, a charioteer at the reins" shade="light" className="flex min-h-[clamp(560px,86vh,900px)] items-center" position="62% 50%">
        <div className="gutter on-light w-full py-24">
          <div className="max-w-[min(600px,48vw)] max-md:max-w-none max-md:rounded-2xl max-md:bg-[rgba(238,238,233,0.86)] max-md:p-6">
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-[rgba(25,27,24,0.6)]">Why “UpaSārathi”</p>
            <h2 className="display band-title mt-3">The charioteer who sits near.</h2>
            <p className="deva mt-6 text-[clamp(18px,1.5vw,22px)] text-[#5a3d0c]">{chariot.sa[0]}</p>
            <p className="reading mt-2 text-[17px] !text-[#232521]">
              “{chariot.tr?.text} {horses.tr?.text?.split(".")[0]}.” <CiteChip id="KaU_1.3.3" label="KaU 1.3.3" /> <CiteChip id="KaU_1.3.4" label="1.3.4" />
            </p>
            <p className="mt-5 text-[16px] leading-relaxed text-[rgba(25,27,24,0.78)]">
              <i>Sārathi</i> is the charioteer; <i>upa</i>, near. An assistant tuned to be liked is a charioteer that lets the horses choose the road. This one sits near, holds to the text, and points back to the way.
            </p>
            <Link href="/paths/chariot" className="btn btn-lg mt-8 !border-transparent !bg-[#191b18] !text-[#f1efe9] hover:!bg-[#2a2d29]"><IconRoute size={17} /> Walk the chariot path</Link>
          </div>
        </div>
      </Art>

      {/* ── 7 · Paths ────────────────────────────────────────────────────────────────────── */}
      <section className="gutter py-[clamp(72px,11vh,130px)]">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow">Guided paths</p>
            <h2 className="display band-title mt-3">{paths.length} walks through the texts.</h2>
          </div>
          <Link href="/paths" className="btn">All paths <IconArrow size={15} /></Link>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {paths.map((p, i) => (
            <Link key={p.id} href={`/paths/${p.id}`} className="tile group flex min-h-[230px] flex-col p-6">
              <span className="num text-[13px] text-text-4">0{i + 1}</span>
              <span className="display mt-6 text-[24px] leading-tight">{p.title}</span>
              <span className="mt-2 text-[14px] text-text-3">{p.subtitle}</span>
              <span className="mt-auto flex items-center justify-between pt-6 text-[12.5px] text-text-3">
                <span>{p.steps.length} steps · {p.minutes} min</span>
                <IconArrow size={16} className="transition group-hover:translate-x-1 group-hover:text-accent" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── 8 · The thirteen ─────────────────────────────────────────────────────────────── */}
      <section className="gutter pb-[clamp(72px,11vh,130px)]">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow">The texts</p>
            <h2 className="display band-title mt-3">Thirteen Upanishads. Every passage.</h2>
          </div>
          <Link href="/u" className="btn">Open the library <IconArrow size={15} /></Link>
        </div>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {ix.texts.map((t) => (
            <Link key={t.id} href={`/u/${t.id}`} className="tile group flex items-start gap-5 p-6">
              <span className="mt-2 h-3 w-3 shrink-0 rounded-full" style={{ background: TEXT_HEX.dark[t.id], boxShadow: `0 0 14px ${TEXT_HEX.dark[t.id]}` }} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="display text-[24px]">{t.iast}</span>
                  <span className="deva text-[17px] text-text-3" style={{ lineHeight: 1.2 }}>{t.sa}</span>
                </span>
                <span className="mt-2 block text-[14px] leading-relaxed text-text-3">{t.tagline}</span>
                <span className="mt-4 block text-[12px] text-text-4">{t.count} passages · {t.lineage?.vedaLabel ?? t.veda}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── 9 · Close ────────────────────────────────────────────────────────────────────── */}
      <Art name="ashram" alt="A teacher and students seated in a circle beneath a great banyan by a river" shade="center" className="flex min-h-[clamp(560px,88vh,900px)] items-center" position="50% 60%">
        <div className="gutter on-art w-full py-24 text-center">
          <p className="deva text-[clamp(18px,1.6vw,24px)] text-[#f3cf7a]">उप · नि · षद्</p>
          <h2 className="display mt-3 text-[clamp(44px,6vw,96px)] leading-[1.02]">Sit down near.</h2>
          <p className="mx-auto mt-5 max-w-[54ch] text-[17px] leading-relaxed text-[rgba(241,239,233,0.85)]">
            The Upanishads were taught like this: a few students, a teacher, a question. Bring yours.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link href={`/paths/${quick.id}`} className="btn btn-accent btn-lg"><IconRoute size={18} /> Start the {quick.minutes}-minute path</Link>
            <AskOpen className="btn btn-outline btn-lg !border-[rgba(255,255,255,0.3)] !text-white hover:!bg-[rgba(255,255,255,0.08)]"><IconChat size={17} /> Ask a question</AskOpen>
          </div>
        </div>
      </Art>
    </>
  );
}
