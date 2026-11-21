// "Rooted in the Ṛgveda": the Veda-Sāra lineage strip shown on an Upanishad's overview and on each of its mantras.
// The Yajurveda is one Veda with two sections (Śukla and Kṛṣṇa); a text from it names its section after the Veda.
// Pure markup (no hooks), so server pages and client views can both use it.
import Link from "next/link";
import type { TextMeta } from "@/lib/core/types";

/** "Śukla section", or null for a Veda without sections. */
export const sectionOf = (t: TextMeta) => (t.lineage?.sectionLabel ? `${t.lineage.sectionLabel.split(" ")[0]} section` : null);

export function Lineage({ text, compact = false, roots = [] }: { text: TextMeta; compact?: boolean; roots?: { label: string; kind?: string; href: string | null }[] }) {
  const l = text.lineage;
  if (!l) return null;
  const section = sectionOf(text);
  return (
    <div className="lineage" aria-label={`Lineage of the ${text.iast} Upaniṣad`}>
      <Link href={`/map?node=veda:${l.veda}&roots=1`} className="lineage-badge" title={`See the ${l.vedaLabel} in the map`}>
        <span className="dot" style={{ background: "var(--gold)" }} />
        Rooted in the {l.vedaLabel}
        {section && <span className="font-normal text-text-3">· {section}</span>}
      </Link>
      {!compact && (
        <>
          <span className="lineage-sep" aria-hidden>→</span>
          <span><span className="text-text-4">school</span> {l.school}</span>
          <span className="lineage-sep" aria-hidden>→</span>
          <span><span className="text-text-4">{l.kind}</span> {l.seat}</span>
          <span className="lineage-sep" aria-hidden>→</span>
          <span className="text-text">{text.iast} Upaniṣad</span>
        </>
      )}
      {roots.map((r, i) => (
        <span key={i} className="lineage-root">
          {r.kind === "identical" ? "Same mantra as" : "Echoes"}{" "}
          {r.href ? <a href={r.href} target="_blank" rel="noreferrer" className="underline underline-offset-2">{r.label}</a> : <b>{r.label}</b>}
        </span>
      ))}
    </div>
  );
}
