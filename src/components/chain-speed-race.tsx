"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface ChainData {
  name: string;
  color: string;
  blockTime: number;
  blocks: { filled: boolean; timestamp: number }[];
  avgBlockTime: number;
  currentBlock: number;
}

const CHAINS: Omit<ChainData, "blocks" | "avgBlockTime" | "currentBlock">[] = [
  { name: "Aptos (Velociraptr)", color: "#06D6A0", blockTime: 94 },
  { name: "Solana", color: "#9945FF", blockTime: 400 },
  { name: "Ethereum", color: "#627EEA", blockTime: 12000 },
  { name: "Bitcoin", color: "#F7931A", blockTime: 600000 },
];

const MAX_BLOCKS = 50;

export function ChainSpeedRace({ className = "" }: { className?: string }) {
  const [chains, setChains] = useState<ChainData[]>(() =>
    CHAINS.map((c) => ({
      ...c,
      blocks: Array(MAX_BLOCKS).fill(null).map(() => ({ filled: false, timestamp: 0 })),
      avgBlockTime: c.blockTime,
      currentBlock: 0,
    }))
  );
  const intervalsRef = useRef<NodeJS.Timeout[]>([]);

  useEffect(() => {
    intervalsRef.current.forEach((i) => clearInterval(i));
    intervalsRef.current = [];

    chains.forEach((chain, chainIndex) => {
      const interval = setInterval(() => {
        setChains((prev) => {
          const newChains = [...prev];
          const c = { ...newChains[chainIndex] };
          const newBlocks = [...c.blocks];

          const nextIndex = c.currentBlock % MAX_BLOCKS;
          newBlocks[nextIndex] = { filled: true, timestamp: Date.now() };

          const variance = (Math.random() - 0.5) * 0.2;
          const newAvg = chain.blockTime * (1 + variance);

          c.blocks = newBlocks;
          c.currentBlock = c.currentBlock + 1;
          c.avgBlockTime = Math.round(newAvg);
          newChains[chainIndex] = c;

          return newChains;
        });
      }, chain.blockTime);

      intervalsRef.current.push(interval);
    });

    return () => {
      intervalsRef.current.forEach((i) => clearInterval(i));
    };
  }, []);

  const formatTime = (ms: number) => {
    if (ms >= 60000) return (ms / 60000).toFixed(1) + "m";
    if (ms >= 1000) return (ms / 1000).toFixed(1) + "s";
    return ms + "ms";
  };

  return (
    <div className={"glass-card p-6 " + className}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-white">Chain Speed Race</h3>
          <div className="live-indicator">
            <div className="live-dot" />
            <span className="text-xs text-gray-400 uppercase tracking-wider">Live</span>
          </div>
        </div>
        <p className="text-xs text-gray-500">Block production comparison (real-time)</p>
      </div>

      <div className="space-y-4">
        {chains.map((chain) => (
          <div key={chain.name} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full pulse-dot"
                  style={{ backgroundColor: chain.color }}
                />
                <span className="text-sm font-medium text-white">{chain.name}</span>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-gray-500">
                  Avg: <span className="font-mono" style={{ color: chain.color }}>{formatTime(chain.avgBlockTime)}</span>
                </span>
                <span className="text-gray-500">
                  Blocks: <span className="font-mono text-white">{chain.currentBlock}</span>
                </span>
              </div>
            </div>

            <div className="relative h-6 bg-[#0a0a0f] rounded-lg overflow-hidden border border-white/5">
              <div className="absolute inset-0 flex">
                {chain.blocks.map((block, blockIndex) => {
                  const isCurrent = blockIndex === chain.currentBlock % MAX_BLOCKS;
                  const age = block.timestamp ? (Date.now() - block.timestamp) / 1000 : 0;
                  const opacity = block.filled ? Math.max(0.3, 1 - age / 10) : 0;

                  return (
                    <div
                      key={blockIndex}
                      className="flex-1 h-full relative"
                      style={{ padding: "2px" }}
                    >
                      {block.filled && (
                        <motion.div
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity }}
                          transition={{ duration: 0.15 }}
                          className="w-full h-full rounded-sm"
                          style={{
                            backgroundColor: chain.color,
                            boxShadow: isCurrent ? "0 0 10px " + chain.color : "none",
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="h-0.5 bg-[#1a1a2e] rounded-full overflow-hidden">
              <motion.div
                className="h-full"
                style={{ backgroundColor: chain.color }}
                animate={{ width: ((chain.currentBlock % MAX_BLOCKS) / MAX_BLOCKS * 100) + "%" }}
                transition={{ duration: 0.1 }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-[#0a0a0f] rounded-xl border border-white/5">
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-2">Aptos is faster by</p>
          <div className="flex justify-center gap-6">
            {chains.slice(1).map((chain) => (
              <div key={chain.name} className="text-center">
                <div className="text-2xl font-bold" style={{ color: "#06D6A0" }}>
                  {Math.round(chain.blockTime / chains[0].blockTime)}x
                </div>
                <div className="text-xs text-gray-500">vs {chain.name.split(" ")[0]}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
