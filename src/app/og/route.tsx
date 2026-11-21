// Dynamic OpenGraph images: /og?t=<title>&s=<subtitle>. Latin script only (the image renderer cannot shape
// Devanagari conjuncts correctly), set in Source Serif with full IAST diacritics fetched for exactly the text drawn.
import { ImageResponse } from "next/og";

export const runtime = "edge";
const W = 1200;
const H = 630;

async function font(family: string, weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&text=${encodeURIComponent(text)}`)).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch {
    return null;
  }
}
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const title = clip(q.get("t") || "UpaSārathi", 60);
  const sub = clip(q.get("s") || "Modern AI is trained to please you. The Upanishads were written to wake you up.", 230);
  const brand = "UpaSārathi · the 13 Principal Upanishads";
  const all = `${title}${sub}${brand}“”`;
  const [serif, sans] = await Promise.all([font("Source Serif 4", 600, all), font("Inter", 500, all)]);
  const fonts = [
    ...(serif ? [{ name: "Serif", data: serif, weight: 600 as const, style: "normal" as const }] : []),
    ...(sans ? [{ name: "Sans", data: sans, weight: 500 as const, style: "normal" as const }] : []),
  ];
  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 72px", background: "linear-gradient(135deg, #0a0c0b 0%, #14201b 60%, #2a2112 100%)", color: "#f1efe9", fontFamily: sans ? "Sans" : undefined }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 46, height: 46, borderRadius: 999, border: "3px solid #e6b96a", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 12, height: 12, borderRadius: 999, background: "#7fc4a8" }} />
          </div>
          <div style={{ fontSize: 26, color: "rgba(241,239,233,0.75)" }}>{brand}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontSize: title.length > 30 ? 66 : 84, lineHeight: 1.05, fontFamily: serif ? "Serif" : undefined, color: "#f3cf7a" }}>{title}</div>
          <div style={{ fontSize: 31, lineHeight: 1.4, color: "rgba(241,239,233,0.9)", fontFamily: serif ? "Serif" : undefined }}>{sub}</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {["#e6b96a", "#7fc4a8", "#9fb7e6", "#e08a6d", "#c9a7e0"].map((c) => (
            <div key={c} style={{ width: 54, height: 6, borderRadius: 6, background: c }} />
          ))}
        </div>
      </div>
    ),
    { width: W, height: H, fonts: fonts.length ? fonts : undefined },
  );
}
