"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Zap, Clock, ArrowRight, ChevronRight } from "lucide-react";
import { ConsensusComparison } from "@/components/consensus-comparison";
import { EvolutionTimeline } from "@/components/evolution-timeline";
import { MetricsCard } from "@/components/metrics-card";
import { ConsensusVisualization } from "@/components/consensus-visualization";

const consensusVersions = {
  quorumStore: {
    name: "Quorum Store",
    status: "Legacy",
    blockTime: "~100ms",
    finality: "~1.4s",
    networkHops: 6,
    description: "Separate data dissemination before consensus",
    color: "#f97316",
  },
  velociraptr: {
    name: "Velociraptr",
    status: "Current (Oct 2025)",
    blockTime: "~94ms",
    finality: "~650ms",
    networkHops: 4,
    description: "Optimistic proposals - validators propose every network delay",
    color: "#06D6A0",
  },
  raptr: {
    name: "Raptr",
    status: "Q1 2026",
    blockTime: "<50ms",
    finality: "<500ms",
    networkHops: 4,
    description: "DAG-based throughput with leader-based low latency",
    color: "#4ECDC4",
  },
};

export default function Home() {
  const [activeVersion, setActiveVersion] = useState<"quorumStore" | "velociraptr" | "raptr">("velociraptr");
  const [isAnimating, setIsAnimating] = useState(false);

  return (
    <main className="min-h-screen py-12 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-aptos-teal/20 mb-4">
            <Zap className="w-8 h-8 text-aptos-teal" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Aptos Consensus Evolution
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Visualize the journey from Quorum Store to Velociraptr to Raptr —
            achieving sub-50ms block times for the global trading engine.
          </p>
        </motion.div>

        {/* Key Metrics Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12"
        >
          <MetricsCard
            label="Current Block Time"
            value="~94ms"
            subtext="Velociraptr"
            icon={<Clock className="w-5 h-5" />}
          />
          <MetricsCard
            label="User Finality"
            value="~650ms"
            subtext="20% faster"
            icon={<Zap className="w-5 h-5" />}
          />
          <MetricsCard
            label="Network Hops"
            value="4"
            subtext="Down from 6"
            icon={<ArrowRight className="w-5 h-5" />}
          />
          <MetricsCard
            label="Target (Q1 2026)"
            value="<50ms"
            subtext="Full Raptr"
            icon={<ChevronRight className="w-5 h-5" />}
          />
        </motion.div>

        {/* Evolution Timeline */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mb-16"
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Consensus Evolution Timeline
          </h2>
          <EvolutionTimeline
            activeVersion={activeVersion}
            onVersionSelect={setActiveVersion}
            versions={consensusVersions}
          />
        </motion.section>

        {/* Interactive Visualization */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mb-16"
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            How It Works: {consensusVersions[activeVersion].name}
          </h2>
          <ConsensusVisualization
            version={activeVersion}
            isAnimating={isAnimating}
            onToggleAnimation={() => setIsAnimating(!isAnimating)}
          />
        </motion.section>

        {/* Side-by-Side Comparison */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mb-16"
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Compare Consensus Methods
          </h2>
          <ConsensusComparison />
        </motion.section>

        {/* Technical Details */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-2xl p-8 shadow-lg"
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Technical Breakdown
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {Object.entries(consensusVersions).map(([key, version]) => (
              <div
                key={key}
                className={`p-6 rounded-xl border-2 transition-all ${
                  activeVersion === key
                    ? "border-aptos-teal bg-aptos-teal/5"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: version.color }}
                  />
                  <h3 className="font-semibold text-gray-900">{version.name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    {version.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-4">{version.description}</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Block Time</span>
                    <span className="font-medium" style={{ color: version.color }}>
                      {version.blockTime}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Finality</span>
                    <span className="font-medium">{version.finality}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Network Hops</span>
                    <span className="font-medium">{version.networkHops}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Footer */}
        <footer className="mt-16 text-center text-gray-500 text-sm">
          <p>
            Data sourced from{" "}
            <a
              href="https://aptosnetwork.com/currents/baby-raptr-lands-on-mainnet"
              className="text-aptos-teal hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Aptos Network
            </a>
            {" "}and{" "}
            <a
              href="https://arxiv.org/pdf/2504.18649"
              className="text-aptos-teal hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Raptr Paper
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}
