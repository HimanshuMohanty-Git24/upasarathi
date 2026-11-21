"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { IconBook, IconKey, IconMoon, IconOrbit, IconRoute, IconSearch, IconSun, IconTerminal, Mark } from "@/components/ui/Icons";
import { hasKey, useSettings } from "@/lib/client/settings";
import { PROVIDERS } from "@/lib/core/llm";
import { toggleTheme } from "@/lib/client/theme";
import { ui } from "@/lib/client/ui-store";

const LINKS = [
  { href: "/explore", label: "Explore", icon: IconOrbit },
  { href: "/u", label: "Read", icon: IconBook },
  { href: "/paths", label: "Paths", icon: IconRoute },
  { href: "/harness", label: "Harness", icon: IconTerminal },
];

export function TopNav() {
  const path = usePathname();
  const settings = useSettings();
  const connected = hasKey(settings);
  // On the home page the bar floats transparently over the painting until the page scrolls.
  const [overArt, setOverArt] = useState(path === "/");
  useEffect(() => {
    if (path !== "/") return setOverArt(false);
    const on = () => setOverArt(window.scrollY < 40);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [path]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ui.openPalette();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="topnav" data-over-art={overArt ? "1" : undefined}>
      <div className="gutter flex h-[60px] items-center gap-3 lg:gap-5">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="UpaSārathi, home">
          <Mark size={28} />
          <span className="flex items-baseline gap-2">
            <span className="text-[17px] font-semibold tracking-tight">UpaSārathi</span>
            <span className="deva hidden text-[15px] opacity-60 xl:inline" style={{ lineHeight: 1 }}>उपसारथि</span>
          </span>
        </Link>
        <nav className="seg ml-1 hidden md:inline-flex" aria-label="Main">
          {LINKS.map((l) => {
            const on = path === l.href || path.startsWith(`${l.href}/`);
            return (
              <Link key={l.href} href={l.href} aria-current={on ? "page" : undefined}>
                <l.icon size={15} />
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex-1" />
        <button className="navsearch capture-hide" onClick={ui.openPalette} aria-label="Search">
          <IconSearch size={15} />
          <span className="hidden lg:inline">Search mantras, ideas, stories</span>
          <span className="kbd hidden lg:inline">Ctrl K</span>
        </button>
        <button className="btn btn-ghost btn-icon capture-hide" onClick={toggleTheme} aria-label="Switch theme" title="Switch theme">
          <IconSun size={17} className="hidden [[data-theme=dark]_&]:block" />
          <IconMoon size={17} className="hidden [[data-theme=light]_&]:block" />
        </button>
        <button className="btn btn-sm capture-hide !h-9" onClick={ui.openSettings} aria-label="Model settings" title={connected ? `${PROVIDERS[settings.provider].name} · ${settings.model}` : "Connect a model with your own key"}>
          <span className="dot" style={{ background: connected ? "var(--accent)" : "var(--text-4)", boxShadow: connected ? "0 0 8px var(--accent)" : "none" }} />
          <span className="hidden sm:inline">{connected ? PROVIDERS[settings.provider].name : "Connect a model"}</span>
          {!connected && <IconKey size={13} className="sm:hidden" />}
        </button>
      </div>
      <nav className="topnav-mobile gutter flex h-[44px] items-center gap-1 overflow-x-auto border-t border-line md:hidden" aria-label="Main (mobile)">
        {LINKS.map((l) => {
          const on = path === l.href || path.startsWith(`${l.href}/`);
          return (
            <Link key={l.href} href={l.href} aria-current={on ? "page" : undefined} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13.5px] ${on ? "bg-surface-3 text-text" : "text-text-3"}`}>
              <l.icon size={14} />
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
