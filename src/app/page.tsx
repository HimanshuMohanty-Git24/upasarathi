import Link from "next/link";
import { getCorpus, getFacts, getKb, getPaths, getRuns } from "@/lib/server/data";
import { Art } from "@/components/ui/Art";
import { AskOpen, CosmosPreview, HomeAsk, HomeReady } from "@/components/home/HomeClient";
import { AudioButton } from "@/components/verse/AudioButton";
import { CiteChip } from "@/components/verse/Drawer";
import { SUGGESTIONS } from "@/components/ask/suggestions";
import { TEXT_HEX } from "@/components/explore/palette";
import { IconArrow, IconBook, IconChat, IconDownload, IconOrbit, IconRoute, IconTerminal } from "@/components/ui/Icons";

export default function Home() {
  const facts = getFacts();
  const kb = getKb();
  const paths = getPaths();
  const runs = getRuns().filter((r) => !r.control);
  const verse = (up: string, id: string) => getCorpus(up).find((v) => v.id === id)!;
  const birds = verse("mundaka", "MuU_3.1.1");
  const chariot = verse("katha", "KaU_1.3.3");
  const horses = verse("katha", "KaU_1.3.4");

  return (
    <>
      <HomeReady />
      {/* ── 1 · Hero ─────────────────────────────────────────────────────────────────────── */}
      <Art name="hero-wide" portrait="hero-portrait" alt="A boy sits with a lamp at the door of a forest temple before dawn" eager className="hero grain flex items-end" imgClassName="kenburns" position="70% 60%">
        <div className="gutter on-art relative w-full pb-[clamp(36px,7vh,88px)] pt-[calc(var(--nav-h)+12vh)]">
          <div className="max-w-[min(820px,62vw)] max-md:max-w-none">
            <p className="deva rise text-[clamp(17px,1.6vw,22px)] text-[#f3cf7a]" style={{ lineHeight: 1.6 }}>उत्तिष्ठत जाग्रत प्राप्य वरान्निबोधत</p>
            <h1 className="display hero-title rise rise-2 mt-3">
              Sit near the
              <br />
              Upanishads.
            </h1>
            <p className="rise rise-3 mt-6 max-w-[620px] text-[clamp(16px,1.25vw,19px)] leading-relaxed text-[rgba(241,239,233,0.86)]">
              <i>Upa-ni-ṣad</i>: to sit down near. Nine Principal Upanishads set in a living 3D graph, every mantra in Devanagari, IAST and translation, with Śaṅkara&apos;s commentary and the chant. Wander it, read it, or ask it anything.
            </p>
            <div className="rise rise-4 mt-8 flex flex-wrap items-center gap-3">
              <Link href="/explore" className="btn btn-accent btn-lg">
                <IconOrbit size={18} /> Enter the cosmos
              </Link>
              <AskOpen className="btn btn-outline btn-lg !border-[rgba(255,255,255,0.3)] !text-white hover:!bg-[rgba(255,255,255,0.08)]">
                <IconChat size={17} /> Ask a question
              </AskOpen>
              <Link href="/harness" className="ml-1 inline-flex items-center gap-1.5 text-[14.5px] text-[rgba(241,239,233,0.78)] hover:text-white">
                <IconTerminal size={16} /> Download the alignment harness <IconArrow size={14} />
              </Link>
            </div>
          </div>
          <div className="stat-row rise rise-4 mt-[clamp(40px,8vh,96px)] border-t border-[rgba(255,255,255,0.14)] pt-6">
            <div><b>{facts.texts.total}</b><span>Upanishads</span></div>
            <div><b>{facts.mantras.total}</b><span>Mantras</span></div>
            <div><b>{facts.bhashyaVerses}</b><span>With Śaṅkara</span></div>
            <div><b>{facts.audioVerses}</b><span>Chanted</span></div>
            <div><b>{facts.edges}</b><span>Links in the graph</span></div>
            <div className="ml-auto hidden max-w-[300px] self-end text-right text-[12.5px] leading-snug text-[rgba(241,239,233,0.6)] lg:block">
              “Arise, awake, and learn by approaching the exalted ones.” <CiteChip id="KaU_1.3.14" label="KaU 1.3.14" />
            </div>
          </div>
        </div>
      </Art>

      {/* ── 2 · The cosmos ───────────────────────────────────────────────────────────────── */}
      <section className="gutter grid items-center gap-10 py-[clamp(72px,11vh,140px)] lg:grid-cols-[minmax(340px,0.8fr)_1.6fr] xl:gap-16">
        <div>
          <p className="eyebrow">Explore</p>
          <h2 className="display band-title mt-3">Not a list of verses. A cosmos of meaning.</h2>
          <p className="mt-5 max-w-[52ch] text-[16.5px] leading-relaxed text-text-2">
            Each Upanishad is a star system, its mantras gathered around it. At the centre, the ideas they share, <i>śreyas</i> and <i>preyas</i>, the Self, the witness, the chariot, sit in a mandala, each drawn toward the texts that teach it. Ask a question and the mantras behind the answer light up.
          </p>
          <ul className="mt-7 space-y-4 text-[15px]">
            {[
              ["Hover to read, click to open", "Every point opens its mantra: Devanagari, IAST, translation, Śaṅkara, the chant."],
              ["Ideas, situations, stories", `${facts.concepts} concepts, ${facts.dilemmas} human situations, ${facts.stories} stories and ${facts.persons} people, linked to the verses that carry them.`],
              ["Three graphs, one tradition", `${facts.crossCorpus} links reach into the Bhagavad Gītā and the Ṛgveda, in GitaViśva and VedAnvaya.`],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--gold)] shadow-[0_0_10px_var(--gold)]" />
                <span>
                  <b className="font-semibold">{t}</b>
                  <span className="block text-text-3">{d}</span>
                </span>
              </li>
            ))}
          </ul>
          <Link href="/explore" className="btn btn-accent btn-lg mt-8">
            Enter the cosmos <IconArrow size={16} />
          </Link>
        </div>
        <div className="relative h-[clamp(420px,62vh,720px)] overflow-hidden rounded-[28px] border border-line-2 bg-[#070908] shadow-[var(--shadow)]">
          <CosmosPreview />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-[rgba(7,9,8,0.85)] to-transparent px-6 pb-5 pt-16 text-[12.5px] text-[rgba(236,239,233,0.7)]">
            <span>Live · drag to orbit · click any point</span>
            <span className="hidden sm:inline">{facts.nodes} nodes · {facts.edges} links</span>
          </div>
        </div>
      </section>

      {/* ── 3 · Ask ──────────────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-y border-line bg-[var(--bg-2)] py-[clamp(72px,11vh,130px)]">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(127,196,168,0.12),transparent)]" />
        <div className="gutter relative mx-auto max-w-[1100px] text-center">
          <p className="eyebrow">Chat with the graph</p>
          <h2 className="display band-title mt-3">Ask the Upanishads.</h2>
          <p className="mx-auto mt-4 max-w-[62ch] text-[16.5px] leading-relaxed text-text-2">
            The graph finds the mantras, ideas and stories that bear on your question and answers from them. Connect Claude, GPT, Gemini or any model with your own key for written answers; every citation is checked against the corpus before you see it.
          </p>
          <div className="mt-9">
            <HomeAsk suggestions={SUGGESTIONS.slice(0, 5)} />
          </div>
          <p className="mt-5 text-[12.5px] text-text-4">Works without a key. Your key never leaves your browser except to reach the provider you choose.</p>
        </div>
      </section>

      {/* ── 4 · Read: the two birds ──────────────────────────────────────────────────────── */}
      <section className="gutter grid items-center gap-10 py-[clamp(72px,11vh,140px)] lg:grid-cols-[1fr_1.15fr] xl:gap-20">
        <Art name="two-birds" alt="Two luminous birds on one tree; one eats the fruit, the other watches" shade="none" className="h-[clamp(420px,78vh,820px)] rounded-[28px] border border-line-2" position="50% 55%" />
        <div>
          <p className="eyebrow">Read · Muṇḍaka Upaniṣad 3.1.1</p>
          <h2 className="display band-title mt-3">Read it the way it was written.</h2>
          <div className="mt-8 border-l-2 border-[var(--gold)] pl-6">
            <div className="deva text-[clamp(20px,1.7vw,26px)]">{birds.sa.map((l, i) => <div key={i}>{l}</div>)}</div>
            <div className="iast mt-3 text-[15.5px]">{birds.iast.map((l, i) => <div key={i}>{l}</div>)}</div>
            <p className="reading mt-4 max-w-[60ch] text-[17px]">{birds.tr?.text}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {birds.audio && <AudioButton src={birds.audio.mp3} label="Hear the chant" />}
              <span className="text-[12.5px] text-text-3">{birds.tr?.by}</span>
            </div>
          </div>
          <ul className="mt-9 grid gap-x-8 gap-y-3 text-[14.5px] text-text-2 sm:grid-cols-2">
            <li><b className="text-text">Devanagari and IAST</b>, line by line</li>
            <li><b className="text-text">Translations</b> in the tradition of Śaṅkara</li>
            <li><b className="text-text">Śaṅkara&apos;s commentary</b> on {facts.bhashyaVerses} anchor mantras</li>
            <li><b className="text-text">The chant</b> for {facts.audioVerses} mantras</li>
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/u/mundaka/3.1.1" className="btn btn-lg">
              <IconBook size={17} /> Open the reader
            </Link>
            <AskOpen question="Explain the two birds on one tree." className="btn btn-ghost btn-lg">
              Ask about the two birds <IconArrow size={15} />
            </AskOpen>
          </div>
        </div>
      </section>

      {/* ── 5 · The name: the chariot ────────────────────────────────────────────────────── */}
      <Art name="chariot" alt="A chariot with four horses races through morning mist, a charioteer at the reins" shade="light" className="min-h-[clamp(560px,86vh,900px)] flex items-center" position="62% 50%">
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
            <Link href="/paths/chariot" className="btn btn-lg mt-8 !border-transparent !bg-[#191b18] !text-[#f1efe9] hover:!bg-[#2a2d29]">
              <IconRoute size={17} /> Walk the chariot path
            </Link>
          </div>
        </div>
      </Art>

      {/* ── 6 · The harness ──────────────────────────────────────────────────────────────── */}
      <Art name="virocana" alt="Prajāpati with Indra and Virocana, looking at their reflections in a bowl of water" className="min-h-[clamp(620px,92vh,980px)] flex items-center" position="70% 50%">
        <div className="gutter on-art grid w-full items-center gap-10 py-24 xl:grid-cols-[minmax(0,640px)_1fr]">
          <div>
            <p className="eyebrow !text-[rgba(241,239,233,0.6)]">The alignment harness · Chāndogya 8.7–8.12</p>
            <h2 className="display band-title mt-3">Virocana left satisfied. Indra came back and asked again.</h2>
            <p className="mt-5 max-w-[58ch] text-[16.5px] leading-relaxed text-[rgba(241,239,233,0.84)]">
              Prajāpati told two students the Self is what they see in the water. Virocana went home content <CiteChip id="ChU_8.8.4" label="ChU 8.8.4" />; Indra saw the flaw. Many AI answers are Virocana&apos;s: satisfying, and wrong in the way that matters.
            </p>
            <p className="mt-4 max-w-[58ch] text-[16px] leading-relaxed text-[rgba(241,239,233,0.72)]">
              The harness is one file you run on your own machine with your own key: Claude, OpenAI, Gemini, Groq, OpenRouter, Ollama or any OpenAI-compatible endpoint. It finds where an answer chose the pleasant, re-answers from the text, checks every quotation against the corpus, and has a second model judge both, blind.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/harness" className="btn btn-gold btn-lg">
                <IconTerminal size={17} /> Get the harness
              </Link>
              <a href="/downloads/upasarathi-harness.mjs" download className="btn btn-outline btn-lg !border-[rgba(255,255,255,0.3)] !text-white hover:!bg-[rgba(255,255,255,0.08)]">
                <IconDownload size={17} /> upasarathi-harness.mjs
              </a>
            </div>
          </div>
          <div className="hidden xl:block" />
        </div>
      </Art>
      <section className="gutter -mt-28 relative z-10 pb-8">
        <div className="term mx-auto max-w-[1100px] shadow-[var(--shadow)]">
          <div><span className="p">$</span> node upasarathi-harness.mjs bench --provider groq --judge-model openai/gpt-oss-120b</div>
          <div className="c">  recorded with {runs[0]?.models.model} · judged blind by {runs[0]?.models.judgeModel}</div>
          {runs.map((r) => (
            <div key={r.id}>
              <span className="g">  ▸ {(r.title ?? r.id).padEnd(26, " ")}</span> baseline <span className="r">{String(r.totals.baseline).padStart(2)}</span> · re-aligned <span className="p">{String(r.totals.realigned).padStart(2)}</span> <span className="c">/ {r.max}</span>
            </div>
          ))}
          <div><span className="p">  ✓</span> report written to <span className="g">upasarathi-report.html</span></div>
        </div>
        <p className="mx-auto mt-3 max-w-[1100px] text-[12.5px] text-text-4">Real recorded runs, replayable in the browser without a key. <Link href="/harness" className="underline underline-offset-2 hover:text-text">See them all</Link>.</p>
      </section>

      {/* ── 7 · Paths ────────────────────────────────────────────────────────────────────── */}
      <section className="gutter py-[clamp(72px,11vh,130px)]">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow">Guided paths</p>
            <h2 className="display band-title mt-3">Five walks through the texts.</h2>
          </div>
          <Link href="/paths" className="btn">All paths <IconArrow size={15} /></Link>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {paths.map((p, i) => (
            <Link key={p.id} href={`/paths/${p.id}`} className="tile group flex min-h-[250px] flex-col p-6">
              <span className="num text-[13px] text-text-4">0{i + 1}</span>
              <span className="display mt-6 text-[26px] leading-tight">{p.title}</span>
              <span className="mt-2 text-[14px] text-text-3">{p.subtitle}</span>
              <span className="mt-auto flex items-center justify-between pt-6 text-[12.5px] text-text-3">
                <span>{p.steps.length} steps · {p.minutes} min</span>
                <IconArrow size={16} className="transition group-hover:translate-x-1 group-hover:text-accent" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── 8 · The nine texts ───────────────────────────────────────────────────────────── */}
      <section className="gutter pb-[clamp(72px,11vh,130px)]">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow">The texts</p>
            <h2 className="display band-title mt-3">Nine Upanishads. Five complete.</h2>
          </div>
          <Link href="/u" className="btn">Open the library <IconArrow size={15} /></Link>
        </div>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {kb.texts.map((t) => (
            <Link key={t.id} href={`/u/${t.id}`} className="tile group flex items-start gap-5 p-6">
              <span className="mt-2 h-3 w-3 shrink-0 rounded-full" style={{ background: TEXT_HEX.dark[t.id], boxShadow: `0 0 14px ${TEXT_HEX.dark[t.id]}` }} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="display text-[24px]">{t.iast}</span>
                  <span className="deva text-[17px] text-text-3" style={{ lineHeight: 1.2 }}>{t.sa}</span>
                </span>
                <span className="mt-2 block text-[14px] leading-relaxed text-text-3">{t.tagline}</span>
                <span className="mt-4 flex items-center gap-2 text-[12px] text-text-4">
                  <span className={t.scope === "complete" ? "chip chip-accent !text-[11px]" : "chip !text-[11px]"}>{t.scope === "complete" ? "Complete" : "Selected passages"}</span>
                  {t.count} mantras · {t.veda}
                </span>
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
            <Link href="/explore" className="btn btn-accent btn-lg">
              <IconOrbit size={18} /> Enter the cosmos
            </Link>
            <AskOpen className="btn btn-outline btn-lg !border-[rgba(255,255,255,0.3)] !text-white hover:!bg-[rgba(255,255,255,0.08)]">
              <IconChat size={17} /> Ask a question
            </AskOpen>
          </div>
        </div>
      </Art>
    </>
  );
}
