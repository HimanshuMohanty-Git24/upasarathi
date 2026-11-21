"use client";
// One-click sharing: copy a deep link, or download a clean image card (drawn on a canvas in the site's own fonts).
import { useEffect, useRef, useState } from "react";
import { IconCheck, IconCopy, IconDownload, IconExternal } from "./Icons";

export interface CardSpec {
  title: string;
  subtitle?: string;
  deva?: string;
  iast?: string;
  lines?: string[];
  url?: string;
}

function cssFont(v: string, fallback: string) {
  const f = getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  return f ? `${f}, ${fallback}` : fallback;
}
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const w of text.split(/\s+/)) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > max && line) {
      out.push(line);
      line = w;
    } else line = t;
  }
  if (line) out.push(line);
  return out;
}

/** Draw the share card and return it as a PNG data URL. */
export async function drawCard(spec: CardSpec): Promise<string> {
  await document.fonts?.ready;
  const W = 1200, H = 630, P = 72;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const serif = cssFont("--font-source-serif", "Georgia, serif");
  const sans = cssFont("--font-inter", "system-ui, sans-serif");
  const deva = cssFont("--font-tiro", "'Nirmala UI', serif");
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#0b100f");
  g.addColorStop(1, "#131a17");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.86, H * 0.2, 0, W * 0.86, H * 0.2, 420);
  glow.addColorStop(0, "rgba(230,185,106,0.18)");
  glow.addColorStop(1, "rgba(230,185,106,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  // the wheel mark
  ctx.strokeStyle = "#e6b96a";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(P + 18, P + 18, 18, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(P + 18 + Math.cos(a) * 4, P + 18 + Math.sin(a) * 4);
    ctx.lineTo(P + 18 + Math.cos(a) * 17, P + 18 + Math.sin(a) * 17);
    ctx.stroke();
  }
  ctx.fillStyle = "#7fc4a8";
  ctx.beginPath();
  ctx.arc(P + 18, P + 18, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ecefe9";
  ctx.font = `600 26px ${sans}`;
  ctx.fillText("UpaSārathi", P + 50, P + 27);
  let y = P + 110;
  if (spec.deva) {
    ctx.fillStyle = "#f3cf7a";
    ctx.font = `34px ${deva}`;
    for (const l of wrap(ctx, spec.deva, W - P * 2).slice(0, 2)) {
      ctx.fillText(l, P, y);
      y += 52;
    }
    y += 6;
  }
  ctx.fillStyle = "#f1efe9";
  ctx.font = `500 ${spec.deva ? 40 : 52}px ${serif}`;
  for (const l of wrap(ctx, spec.title, W - P * 2).slice(0, spec.deva ? 2 : 3)) {
    ctx.fillText(l, P, y);
    y += spec.deva ? 50 : 62;
  }
  if (spec.iast) {
    ctx.fillStyle = "#b4bcb5";
    ctx.font = `italic 22px ${serif}`;
    for (const l of wrap(ctx, spec.iast, W - P * 2).slice(0, 2)) {
      ctx.fillText(l, P, y);
      y += 32;
    }
  }
  if (spec.subtitle) {
    y += 8;
    ctx.fillStyle = "#c8cec9";
    ctx.font = `24px ${serif}`;
    for (const l of wrap(ctx, spec.subtitle, W - P * 2).slice(0, 3)) {
      ctx.fillText(l, P, y);
      y += 34;
    }
  }
  if (spec.lines?.length) {
    y += 14;
    ctx.font = `600 22px ${sans}`;
    let x = P;
    const colors = ["#e8936f", "#9fb7e6", "#7fc4a8", "#e6b96a"];
    spec.lines.forEach((l, i) => {
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillText(l, x, y);
      x += ctx.measureText(l).width + 36;
    });
  }
  ctx.fillStyle = "#858e88";
  ctx.font = `18px ${sans}`;
  ctx.fillText((spec.url || location.href).replace(/^https?:\/\//, "").slice(0, 90), P, H - P + 10);
  return c.toDataURL("image/png");
}

export function ShareButton({ label = "Share", ...spec }: CardSpec & { label?: string }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);
  const flash = (m: string) => {
    setDone(m);
    setTimeout(() => setDone(null), 1600);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(spec.url || location.href);
      flash("Link copied");
    } catch {
      flash("Could not copy");
    }
  };
  const download = async () => {
    const url = await drawCard(spec);
    const a = document.createElement("a");
    a.href = url;
    a.download = `upasarathi-${spec.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}.png`;
    a.click();
    flash("Card downloaded");
  };
  const native = typeof navigator !== "undefined" && "share" in navigator;
  return (
    <div ref={ref} className="relative inline-block">
      <button className="btn btn-sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {done ? <IconCheck size={14} /> : <IconExternal size={14} />} {done ?? label}
      </button>
      {open && (
        <div className="glass reveal absolute right-0 z-30 mt-1.5 w-56 !rounded-xl p-1.5 !bg-[var(--surface)]" role="menu">
          <button className="menu-item" onClick={() => { setOpen(false); copy(); }} role="menuitem"><IconCopy size={14} /> Copy link</button>
          <button className="menu-item" onClick={() => { setOpen(false); download(); }} role="menuitem"><IconDownload size={14} /> Download card (PNG)</button>
          {native && (
            <button className="menu-item" onClick={() => { setOpen(false); navigator.share({ title: spec.title, text: spec.subtitle, url: spec.url || location.href }).catch(() => {}); }} role="menuitem">
              <IconExternal size={14} /> Share…
            </button>
          )}
        </div>
      )}
    </div>
  );
}
