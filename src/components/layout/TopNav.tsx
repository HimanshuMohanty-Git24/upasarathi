"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { IconKey, IconMoon, IconSun } from "@/components/ui/Icons";
import { SettingsDialog } from "@/components/harness/SettingsDialog";
import { hasKey, useSettings } from "@/lib/client/settings";

const LINKS = [
  { href: "/", label: "Arena" },
  { href: "/harness", label: "Harness" },
  { href: "/paths", label: "Paths" },
  { href: "/u", label: "Read" },
  { href: "/map", label: "Map" },
];

export function TopNav() {
  const path = usePathname();
  const settings = useSettings();
  const [open, setOpen] = useState(false);
  const toggleTheme = () => {
    const d = document.documentElement;
    const next = d.dataset.theme === "light" ? "dark" : "light";
    d.dataset.theme = next;
    try {
      localStorage.setItem("upasarathi:theme", next);
    } catch {
      /* ignore */
    }
  };
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1240px] items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-baseline gap-2 font-semibold tracking-tight">
          <span className="text-[16px]">UpaSārathi</span>
          <span className="deva hidden text-[14px] text-text-3 sm:inline" style={{ lineHeight: 1 }}>उपसारथि</span>
        </Link>
        <nav className="ml-2 flex min-w-0 flex-1 gap-0.5 overflow-x-auto" aria-label="Main">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} aria-current={active(l.href) ? "page" : undefined}
              className={`rounded-md px-2.5 py-1.5 text-[13.5px] ${active(l.href) ? "bg-surface-2 text-text" : "text-text-3 hover:text-text"}`}>
              {l.label}
            </Link>
          ))}
        </nav>
        <button className="btn btn-ghost btn-sm capture-hide" onClick={toggleTheme} aria-label="Switch theme">
          <IconSun className="hidden [[data-theme=dark]_&]:block" />
          <IconMoon className="hidden [[data-theme=light]_&]:block" />
        </button>
        <button className="btn btn-sm capture-hide" onClick={() => setOpen(true)} aria-label="Language model settings">
          <IconKey size={14} />
          <span className="hidden sm:inline">{hasKey(settings) ? "Model connected" : "Bring your key"}</span>
          <span className="dot" style={{ background: hasKey(settings) ? "var(--accent)" : "var(--text-4)" }} />
        </button>
      </div>
      {open && <SettingsDialog onClose={() => setOpen(false)} />}
    </header>
  );
}
