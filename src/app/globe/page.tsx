"use client";

import { GlobeVisualizer } from "@/components/globe-visualizer";
import { useNetwork } from "@/contexts/NetworkContext";
import Link from "next/link";

export default function GlobePage() {
  const { network, setNetwork } = useNetwork();

  return (
    <main className="h-screen h-[100dvh] bg-black flex flex-col overflow-hidden">
      {/* Header bar */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-sm border-b border-white/10 z-10">
        <Link
          href="/"
          className="text-sm text-gray-300 hover:text-white transition-colors flex items-center gap-2"
        >
          <span>←</span>
          <span>Back to Dashboard</span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setNetwork("testnet")}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              network === "testnet"
                ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
                : "text-gray-400 hover:text-gray-200 bg-white/5"
            }`}
          >
            Testnet
          </button>
          <button
            onClick={() => setNetwork("mainnet")}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              network === "mainnet"
                ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
                : "text-gray-400 hover:text-gray-200 bg-white/5"
            }`}
          >
            Mainnet
          </button>
        </div>
      </header>

      {/* Full screen globe */}
      <div className="flex-1 w-full">
        <GlobeVisualizer fullscreen />
      </div>
    </main>
  );
}
