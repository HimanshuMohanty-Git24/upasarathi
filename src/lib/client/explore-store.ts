"use client";
// Explore: what is selected, how the cosmos is coloured and filtered, and camera commands from the toolbar.
import { useSyncExternalStore } from "react";
import type { NodeType } from "@/lib/core/types";

export type ColorBy = "text" | "type";
export type ViewMode = "3d" | "2d";
export type CameraCmd = { kind: "zoomIn" | "zoomOut" | "fit" | "home"; n: number };

export interface ExploreState {
  selected: string | null;
  view: ViewMode;
  colorBy: ColorBy;
  hidden: NodeType[];
  dock: "details" | "ask" | null;
  autoRotate: boolean;
  camera: CameraCmd | null;
  flyTo: { id: string; n: number } | null;
}

let state: ExploreState = { selected: null, view: "3d", colorBy: "text", hidden: [], dock: null, autoRotate: true, camera: null, flyTo: null };
const listeners = new Set<() => void>();
const set = (patch: Partial<ExploreState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
let n = 0;

export const useExplore = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );

export const explore = {
  get: () => state,
  select: (id: string | null, fly = true) => set({ selected: id, dock: id ? "details" : state.dock === "details" ? null : state.dock, ...(id && fly ? { flyTo: { id, n: ++n }, autoRotate: false } : {}) }),
  setView: (view: ViewMode) => set({ view }),
  setColorBy: (colorBy: ColorBy) => set({ colorBy }),
  toggleType: (t: NodeType) => set({ hidden: state.hidden.includes(t) ? state.hidden.filter((x) => x !== t) : [...state.hidden, t] }),
  setDock: (dock: ExploreState["dock"]) => set({ dock }),
  setAutoRotate: (autoRotate: boolean) => set({ autoRotate }),
  camera: (kind: CameraCmd["kind"]) => set({ camera: { kind, n: ++n }, ...(kind !== "home" ? { autoRotate: false } : {}) }),
  flyTo: (id: string) => set({ flyTo: { id, n: ++n }, autoRotate: false }),
};
