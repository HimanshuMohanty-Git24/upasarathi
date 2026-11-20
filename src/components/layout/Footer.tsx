import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-line">
      <div className="mx-auto grid max-w-[1240px] gap-8 px-4 py-10 text-[13px] text-text-3 sm:px-6 md:grid-cols-3">
        <div>
          <p className="font-semibold text-text-2">UpaSārathi · उपसारथि</p>
          <p className="mt-2 max-w-sm">
            The charioteer who sits near. A reflective and research tool, not a source of religious authority or personal advice. Editorial links are labelled as editorial.
          </p>
        </div>
        <div>
          <p className="eyebrow">Sources</p>
          <ul className="mt-2 space-y-1">
            <li>Devanagari, IAST and chant: <a className="underline" href="https://upanishads.org.in/" target="_blank" rel="noreferrer">upanishads.org.in</a></li>
            <li>Translations: V. Panoli, Swami Gambhīrānanda, Swami Swahananda, Swami Mādhavānanda (108 Upanishads, comp. R. Sheppard)</li>
            <li>Śaṅkara&apos;s commentary: S. Sitarama Sastri, G. Jha, Swami Nikhilananda, Swami Mādhavānanda via <a className="underline" href="https://www.wisdomlib.org/" target="_blank" rel="noreferrer">Wisdom Library</a></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow">The series</p>
          <ul className="mt-2 space-y-1">
            <li><a className="underline" href="https://gitaviswa.vercel.app" target="_blank" rel="noreferrer">GitaViśva</a>, the Bhagavad Gītā as a graph</li>
            <li>VedAnvaya, the Vedas as a graph</li>
            <li><Link className="underline" href="/harness">How the harness scores</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
