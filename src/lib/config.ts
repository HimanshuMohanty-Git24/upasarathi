// Site configuration: where this site and its sibling graphs live. Override with environment variables at build time.
//   NEXT_PUBLIC_SITE_URL        this site's public origin (share cards, Open Graph images); localhost when unset
//   NEXT_PUBLIC_GITAVISWA_URL   GitaViśva, for Bhagavad Gītā verses   default https://gitaviswa.vercel.app
//   NEXT_PUBLIC_VEDANVAYA_URL   VedAnvaya, for Saṃhitā mantras        default https://vedanvaya.vercel.app
// Set a sibling's variable to "off" to show its references as plain text instead of links.
const origin = (v: string | undefined, fallback: string) => {
  const x = (v ?? fallback).trim();
  return x === "off" ? "" : x.replace(/\/+$/, "");
};
export const GITAVISWA_URL = origin(process.env.NEXT_PUBLIC_GITAVISWA_URL, "https://gitaviswa.vercel.app");
export const VEDANVAYA_URL = origin(process.env.NEXT_PUBLIC_VEDANVAYA_URL, "https://vedanvaya.vercel.app");
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");

const BASE: Record<string, string> = { gitaviswa: GITAVISWA_URL, vedanvaya: VEDANVAYA_URL };
/** The link for an external passage (a Gītā verse, a Saṃhitā mantra), or null when its site is switched off. */
export function externalUrl(ext: { site?: string | null; path?: string | null } | undefined | null): string | null {
  if (!ext?.site || !ext.path) return null;
  const base = BASE[ext.site];
  return base ? `${base}${ext.path}` : null;
}
