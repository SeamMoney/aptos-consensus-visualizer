"use client";

import { LatencyCanvas } from "@/components/latency-canvas";
import { BlockStream } from "@/components/block-stream";
import { SpeedComparison } from "@/components/speed-comparison";

export default function Home() {
  return (
    <main className="min-h-screen min-h-[100dvh] px-3 py-4 sm:px-6 sm:py-8">
      <div className="max-w-xl mx-auto">
        {/* Header - Compact and clean */}
        <header className="flex items-center justify-between mb-4 sm:mb-6">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight" style={{ color: "var(--chrome-100)" }}>
              Aptos <span style={{ color: "var(--accent)" }}>Velociraptr</span>
            </h1>
            <p className="text-xs" style={{ color: "var(--chrome-600)" }}>
              Sub-100ms consensus
            </p>
          </div>
          <div className="live-badge">
            <span className="live-dot" />
            Mainnet
          </div>
        </header>

        {/* Key Metrics - Compact hero stats */}
        <div className="chrome-card p-3 sm:p-4 mb-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xl sm:text-2xl font-semibold tabular-nums" style={{ color: "var(--accent)" }}>~94ms</div>
              <div className="stat-label">Block Time</div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-semibold tabular-nums" style={{ color: "var(--chrome-200)" }}>~650ms</div>
              <div className="stat-label">Finality</div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-semibold tabular-nums" style={{ color: "var(--chrome-200)" }}>4</div>
              <div className="stat-label">Hops</div>
            </div>
          </div>
        </div>

        {/* Block Stream - Primary visualization */}
        <section className="mb-4">
          <BlockStream />
        </section>

        {/* Speed Comparison */}
        <section className="mb-4">
          <SpeedComparison />
        </section>

        {/* Latency Flow */}
        <section className="mb-4">
          <LatencyCanvas />
        </section>

        {/* Footer - Minimal */}
        <footer className="text-center py-4">
          <p className="text-xs" style={{ color: "var(--chrome-700)" }}>
            <a
              href="https://aptosnetwork.com"
              style={{ color: "var(--chrome-600)" }}
              target="_blank"
              rel="noopener noreferrer"
            >
              Aptos Network
            </a>
            {" · "}
            <a
              href="https://github.com/SeamMoney"
              style={{ color: "var(--chrome-600)" }}
              target="_blank"
              rel="noopener noreferrer"
            >
              SeamMoney
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}
