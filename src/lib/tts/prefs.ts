// Speech preferences, kept in this browser: which English voice engine (asked once), the Kokoro voice, the speed,
// and whether the reader has agreed to the one-time Vāgdhenu download.
import { useSyncExternalStore } from "react";
import { KOKORO_VOICES, SPEEDS, type KokoroVoice, type Speed } from "./config";

export type Engine = "kokoro" | "browser";
export interface TtsPrefs {
  engine: Engine | null;
  voice: KokoroVoice;
  speed: Speed;
  chantOk: boolean;
}
const KEY = "upasarathi:tts";
const DEFAULTS: TtsPrefs = { engine: null, voice: "bm_george", speed: 1, chantOk: false };

function read(): TtsPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}") as Partial<TtsPrefs>;
    return {
      engine: raw.engine === "kokoro" || raw.engine === "browser" ? raw.engine : null,
      voice: KOKORO_VOICES.some((v) => v.id === raw.voice) ? (raw.voice as KokoroVoice) : DEFAULTS.voice,
      speed: SPEEDS.includes(raw.speed as Speed) ? (raw.speed as Speed) : DEFAULTS.speed,
      chantOk: raw.chantOk === true,
    };
  } catch {
    return DEFAULTS;
  }
}

let prefs: TtsPrefs | null = null;
const listeners = new Set<() => void>();
export const getPrefs = (): TtsPrefs => (prefs ||= typeof window === "undefined" ? DEFAULTS : read());
export function setPrefs(patch: Partial<TtsPrefs>) {
  prefs = { ...getPrefs(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {}
  listeners.forEach((l) => l());
}
export const usePrefs = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getPrefs,
    () => DEFAULTS,
  );

/** Phones and small-memory devices are better served by the browser's own voice than by a 92 MB model. */
export function lowMemoryDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  return (mem !== undefined && mem <= 2) || (mobile && (mem === undefined || mem < 4));
}

/** Is a file already in one of the browser's Cache API buckets (so no download is needed)? */
export async function inCache(cacheName: string, urls: readonly string[]): Promise<boolean> {
  try {
    if (typeof caches === "undefined") return false;
    const c = await caches.open(cacheName);
    for (const u of urls) if (await c.match(u)) return true;
  } catch {}
  return false;
}
