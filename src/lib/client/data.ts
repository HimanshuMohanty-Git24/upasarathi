"use client";
// Fetch-once loaders for the static data in /data (cached for the page's lifetime).
import { useEffect, useState } from "react";
import type { Bhashya, GraphData, KnowledgeBase, Rubric, Verse } from "@/lib/core/types";
import { createEngine, type Engine } from "@/lib/core/engine";
import { corpusIndex, type CorpusIndex } from "@/lib/core/checks";

const cache = new Map<string, Promise<unknown>>();
export function fetchData<T>(file: string): Promise<T> {
  if (!cache.has(file)) {
    cache.set(
      file,
      fetch(`/data/${file}`).then((r) => {
        if (!r.ok) throw new Error(`Could not load ${file} (${r.status})`);
        return r.json();
      }),
    );
  }
  return cache.get(file) as Promise<T>;
}

export function useData<T>(file: string | null): { data: T | null; error: string | null } {
  const [state, setState] = useState<{ data: T | null; error: string | null }>({ data: null, error: null });
  useEffect(() => {
    if (!file) return;
    let live = true;
    fetchData<T>(file).then(
      (data) => live && setState({ data, error: null }),
      (e: Error) => live && setState({ data: null, error: e.message }),
    );
    return () => {
      live = false;
    };
  }, [file]);
  return state;
}

export const loadVerse = async (id: string, up: string): Promise<Verse | undefined> => (await fetchData<Verse[]>(`corpus/${up}.json`)).find((v) => v.id === id);
export const loadBhashya = async (id: string, up: string): Promise<Bhashya | undefined> => (await fetchData<Record<string, Bhashya>>(`bhashya/${up}.json`))[id];

let enginePromise: Promise<{ E: Engine; ci: CorpusIndex }> | null = null;
export function loadEngine() {
  enginePromise ||= Promise.all([fetchData<KnowledgeBase>("kb.json"), fetchData<GraphData>("graph.json"), fetchData<Rubric>("rubric.json")]).then(([kb, g, r]) => ({
    E: createEngine(kb, g, r),
    ci: corpusIndex(kb),
  }));
  return enginePromise;
}
