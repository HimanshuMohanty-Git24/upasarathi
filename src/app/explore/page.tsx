import type { Metadata } from "next";
import { ExploreApp } from "@/components/explore/ExploreApp";

export const metadata: Metadata = {
  title: "Explore the cosmos",
  description: "The nine Principal Upanishads as a 3D knowledge graph: 316 mantras, the ideas they teach, the human situations they speak to and the stories they tell. Ask a question and watch the evidence light up.",
};

export default function ExplorePage() {
  return <ExploreApp />;
}
