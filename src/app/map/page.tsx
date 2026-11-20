import { Suspense } from "react";
import type { Metadata } from "next";
import { MapView } from "@/components/graph/MapView";

export const metadata: Metadata = { title: "Map" };

export default function MapPage() {
  return (
    <div className="mx-auto max-w-[1320px] px-4 pt-6 sm:px-6">
      <Suspense fallback={<p className="muted">Loading the map…</p>}>
        <MapView />
      </Suspense>
    </div>
  );
}
