"use client";

import { LatencyCanvas } from "@/components/latency-canvas";
import { BlockStream } from "@/components/block-stream";
import { SpeedComparison } from "@/components/speed-comparison";

export default function Home() {
  return (
    <main className="min-h-screen min-h-[100dvh] px-4 py-6 sm:px-6 sm:py-8">
      <div className="max-w-2xl mx-auto">
        {/* Header - Minimal and clean */}
        <header className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-2" style={{ color: "var(--chrome-100)" }}>
            Aptos <span style={{ color: "var(--accent)" }}>Velociraptr</span>
          </h1>
          <p className="text-sm" style={{ color: "var(--chrome-500)" }}>
            Sub-100ms block times. Real-time visualization.
          </p>
        </header>

        {/* Key Metrics - Hero stats */}
        <div className="chrome-card p-4 sm:p-6 mb-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="stat-value stat-value-accent">~94ms</div>
              <div className="stat-label">Block Time</div>
            </div>
            <div>
              <div className="stat-value">~650ms</div>
              <div className="stat-label">Finality</div>
            </div>
            <div>
              <div className="stat-value">4</div>
              <div className="stat-label">Network Hops</div>
            </div>
          </div>
        </div>

        {/* Latency Flow */}
        <section className="mb-6">
          <LatencyCanvas />
        </section>

        {/* Block Stream */}
        <section className="mb-6">
          <BlockStream />
        </section>

        {/* Speed Comparison */}
        <section className="mb-6">
          <SpeedComparison />
        </section>

        {/* Footer - Minimal */}
        <footer className="text-center py-8">
          <p className="text-xs" style={{ color: "var(--chrome-600)" }}>
            Data from{" "}
            <a
              href="https://aptosnetwork.com"
              style={{ color: "var(--chrome-500)" }}
              target="_blank"
              rel="noopener noreferrer"
            >
              Aptos Network
            </a>
            {" · "}
            <a
              href="https://github.com/SeamMoney"
              style={{ color: "var(--chrome-500)" }}
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
