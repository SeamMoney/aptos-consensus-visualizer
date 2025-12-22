"use client";

import { Zap } from "lucide-react";
import { motion } from "framer-motion";
import { LatencyFlow } from "@/components/latency-flow";
import { BlockRiver } from "@/components/block-river";
import { ChainSpeedRace } from "@/components/chain-speed-race";

export default function Home() {
  return (
    <main className="min-h-screen py-8 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#06D6A0]/20 to-[#4ecdc4]/20 mb-4 pulse-dot">
            <Zap className="w-8 h-8 text-[#06D6A0]" />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
            Aptos{" "}
            <span className="bg-gradient-to-r from-[#06D6A0] to-[#4ecdc4] bg-clip-text text-transparent">
              Velociraptr
            </span>
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            Real-time visualization of Aptos blockchain speed. Experience sub-100ms block times
            with the Velociraptr consensus upgrade.
          </p>

          {/* Quick Stats */}
          <div className="flex justify-center gap-8 mt-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-[#06D6A0] font-mono">~94ms</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Block Time</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-[#4ecdc4] font-mono">~650ms</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Finality</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-[#ff428e] font-mono">4</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Network Hops</div>
            </div>
          </div>
        </motion.div>

        {/* Latency Flow Visualization */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <LatencyFlow />
        </motion.section>

        {/* Block River */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <BlockRiver />
        </motion.section>

        {/* Chain Speed Race */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-8"
        >
          <ChainSpeedRace />
        </motion.section>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center text-gray-500 text-sm mt-16 pb-8"
        >
          <p className="mb-2">
            Data based on{" "}
            <a
              href="https://aptosnetwork.com/currents/baby-raptr-lands-on-mainnet"
              className="text-[#06D6A0] hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Baby Raptr
            </a>
            {" "}and{" "}
            <a
              href="https://arxiv.org/pdf/2504.18649"
              className="text-[#06D6A0] hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Raptr Consensus Paper
            </a>
          </p>
          <p className="text-gray-600">
            Built by{" "}
            <a
              href="https://github.com/SeamMoney"
              className="text-[#06D6A0] hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              SeamMoney
            </a>
          </p>
        </motion.footer>
      </div>
    </main>
  );
}
