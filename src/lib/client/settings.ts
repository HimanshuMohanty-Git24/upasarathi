"use client";
// Bring-your-own-key settings, kept in this browser only (localStorage). Keys are sent per request to /api/llm,
// which relays them to the provider and stores nothing.
import { useSyncExternalStore } from "react";
import { PROVIDERS, type ProviderId } from "@/lib/core/llm";

export interface Settings {
  provider: ProviderId;
  model: string;
  judgeProvider: ProviderId;
  judgeModel: string;
  keys: Partial<Record<ProviderId, string>>;
  ollamaBaseUrl: string;
}
const KEY = "upasarathi:settings";
const DEFAULTS: Settings = {
  provider: "groq",
  model: PROVIDERS.groq.defaultModel,
  judgeProvider: "groq",
  judgeModel: PROVIDERS.groq.defaultJudge,
  keys: {},
  ollamaBaseUrl: "http://localhost:11434",
};

let current: Settings = DEFAULTS;
let loaded = false;
const listeners = new Set<() => void>();

function load(): Settings {
  if (loaded || typeof window === "undefined") return current;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) current = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    /* storage unavailable: defaults */
  }
  return current;
}

export function getSettings(): Settings {
  return load();
}
export function saveSettings(next: Partial<Settings>) {
  current = { ...load(), ...next };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* private mode: keep in memory */
  }
  listeners.forEach((l) => l());
}
export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    load,
    () => DEFAULTS,
  );
}
export const hasKey = (s: Settings, p: ProviderId = s.provider) => p === "ollama" || Boolean(s.keys[p]);
