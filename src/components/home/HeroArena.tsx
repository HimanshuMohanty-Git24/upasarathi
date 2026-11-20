"use client";
import { RunView, type RunContext } from "@/components/harness/RunView";
import type { HarnessRun } from "@/lib/core/pipeline";
import { useReady } from "@/lib/client/capture";

export function HeroArena({ run, ctx }: { run: HarnessRun; ctx: RunContext }) {
  useReady(true);
  return <RunView run={run} ctx={ctx} mode="replay" layout="hero" />;
}
