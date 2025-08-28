"use client";
import dynamic from "next/dynamic";

const GameCanvas = dynamic(() => import("@/app/components/GameCanvas"), { ssr: false });

export default function Page() {
  return <GameCanvas />;
}
