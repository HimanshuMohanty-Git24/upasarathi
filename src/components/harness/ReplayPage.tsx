"use client";
import { RunView, type RunContext } from "./RunView";
import type { HarnessRun } from "@/lib/core/pipeline";
import { useReady } from "@/lib/client/capture";

export function ReplayPage({ run, ctx }: { run: HarnessRun; ctx: RunContext }) {
  useReady(true);
  return <RunView run={run} ctx={ctx} mode="replay" layout="full" />;
}
