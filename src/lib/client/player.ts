"use client";
// One audio player for the whole site: a single mantra, a queue (a chapter, a whole Upanishad mantra by mantra), or
// a whole-text recording; with speed and a loop for chanting practice. The <audio> element lives in <PlayerBar>.
// Only one thing speaks at a time: the player, the narrator and the AI chant each claim the speaker, and claiming it
// stops whoever held it.
import { useSyncExternalStore } from "react";

export interface Track {
  id: string;
  label: string;
  src: string;
  /** Offsets inside a whole-text recording, if this track is one segment of it. */
  start?: number;
  end?: number;
  /** A synthesized chant (Vāgdhenu), never a human recording: the player badges it. */
  ai?: boolean;
}
export interface PlayerState {
  queue: Track[];
  index: number;
  playing: boolean;
  rate: 0.75 | 1 | 1.25;
  loop: boolean;
  title: string;
  error: string | null;
}

// ── the speaker: one owner at a time ──────────────────────────────────────────────────────────────
let holder: { owner: string; stop: () => void } | null = null;
/** Take the speaker; whoever held it is told to stop. */
export function claimAudio(owner: string, stop: () => void) {
  if (holder && holder.owner !== owner) {
    const h = holder;
    holder = null;
    h.stop();
  }
  holder = { owner, stop };
}
export function releaseAudio(owner: string) {
  if (holder?.owner === owner) holder = null;
}

let state: PlayerState = { queue: [], index: 0, playing: false, rate: 1, loop: false, title: "", error: null };
const listeners = new Set<() => void>();
const set = (patch: Partial<PlayerState>) => {
  state = { ...state, ...patch };
  if (patch.playing) claimAudio("player", () => set({ playing: false }));
  listeners.forEach((l) => l());
};
export const usePlayer = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
export const current = () => state.queue[state.index] ?? null;
export const player = {
  get: () => state,
  /** Play one mantra, or toggle it if it is already the current track. */
  toggle(t: Track) {
    const cur = current();
    if (cur?.src === t.src && cur.id === t.id) set({ playing: !state.playing });
    else set({ queue: [t], index: 0, playing: true, title: t.label, error: null });
  },
  playQueue(queue: Track[], title: string, from = 0) {
    if (!queue.length) return;
    set({ queue, index: from, playing: true, title, error: null });
  },
  pause: () => set({ playing: false }),
  resume: () => set({ playing: true }),
  next() {
    if (state.index + 1 < state.queue.length) set({ index: state.index + 1, playing: true });
    else set({ playing: false });
  },
  prev: () => set({ index: Math.max(0, state.index - 1), playing: true }),
  setRate: (rate: PlayerState["rate"]) => set({ rate }),
  toggleLoop: () => set({ loop: !state.loop }),
  fail: (error: string) => set({ error, playing: false }),
  close: () => {
    releaseAudio("player");
    set({ queue: [], index: 0, playing: false, title: "", error: null });
  },
};
