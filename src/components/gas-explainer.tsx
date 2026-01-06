"use client";

import { memo, useState } from "react";
import { Info, ChevronDown } from "lucide-react";

export const GasExplainer = memo(function GasExplainer() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="chrome-card p-4">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <span className="text-xl">⛽</span>
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-white">Aptos Gas Fees</h3>
            <p className="text-xs text-gray-500">Always ~$0.001 per transaction</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium">
            100 octas
          </div>
          <ChevronDown
            className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* The key insight */}
          <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
            <p className="text-sm text-gray-300">
              <span className="text-emerald-400 font-medium">Unlike Ethereum</span>, Aptos has no fee market.
              Gas stays at <span className="text-white font-mono">100 octas</span> regardless of network load.
            </p>
          </div>

          {/* Comparison */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700/30">
              <div className="text-xs text-gray-500 mb-2">Ethereum</div>
              <div className="space-y-1.5 text-xs text-gray-400">
                <div className="flex items-center gap-2">
                  <span className="text-red-400">✗</span>
                  <span>Base fee fluctuates 10-500+ gwei</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-red-400">✗</span>
                  <span>NFT mints spike fees for everyone</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-red-400">✗</span>
                  <span>Must time txns for cheap gas</span>
                </div>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-emerald-900/20 border border-emerald-500/20">
              <div className="text-xs text-emerald-400 mb-2">Aptos</div>
              <div className="space-y-1.5 text-xs text-gray-400">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span>Always 100 octas (~$0.001)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span>160K TPS prevents congestion</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span>No timing games needed</span>
                </div>
              </div>
            </div>
          </div>

          {/* Technical details */}
          <div className="space-y-2 text-xs text-gray-500">
            <div className="flex items-start gap-2">
              <Info className="w-3 h-3 mt-0.5 text-gray-600" />
              <p>
                <span className="text-gray-400">Priority fees:</span> You can optionally pay more (up to 1M octas)
                for faster inclusion, but it's rarely needed.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Info className="w-3 h-3 mt-0.5 text-gray-600" />
              <p>
                <span className="text-gray-400">Fair ordering:</span> Aptos shuffles transactions within blocks
                to prevent MEV and front-running.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
