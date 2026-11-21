// Site configuration: where the sibling graphs live. Override with environment variables at build time.
//   NEXT_PUBLIC_GITAVISWA_URL   default https://gitaviswa.vercel.app
//   NEXT_PUBLIC_VEDANVAYA_URL   VedAnvaya's origin (links to Saṃhitā mantras are shown as plain references until set)
export const GITAVISWA_URL = (process.env.NEXT_PUBLIC_GITAVISWA_URL || "https://gitaviswa.vercel.app").replace(/\/+$/, "");
export const VEDANVAYA_URL = (process.env.NEXT_PUBLIC_VEDANVAYA_URL || "").replace(/\/+$/, "");
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");

const BASE: Record<string, string> = { gitaviswa: GITAVISWA_URL, vedanvaya: VEDANVAYA_URL };
/** The link for an external passage (a Gītā verse, a Saṃhitā mantra), or null when its site is not configured. */
export function externalUrl(ext: { site?: string | null; path?: string | null } | undefined | null): string | null {
  if (!ext?.site || !ext.path) return null;
  const base = BASE[ext.site];
  return base ? `${base}${ext.path}` : null;
}
