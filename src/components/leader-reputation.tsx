"use client";

import { useMemo } from "react";
import { ConsensusStats } from "@/hooks/useAptosStream";

interface LeaderReputationProps {
  consensus: ConsensusStats | null;
}

export function LeaderReputation({ consensus }: LeaderReputationProps) {
  const validators = consensus?.validators || [];
  const currentProposer = consensus?.currentProposer || "";

  // Calculate reputation scores based on voting power (proxy for actual reputation)
  const rankedValidators = useMemo(() => {
    if (validators.length === 0) return [];

    // Sort by voting power (higher = better reputation proxy)
    const sorted = [...validators]
      .sort((a, b) => b.votingPower - a.votingPower)
      .slice(0, 10); // Top 10

    const maxPower = sorted[0]?.votingPower || 1;

    return sorted.map((v, idx) => ({
      ...v,
      rank: idx + 1,
      reputationScore: Math.round((v.votingPower / maxPower) * 100),
      isCurrentProposer: v.address === currentProposer,
    }));
  }, [validators, currentProposer]);

  const formatAddress = (addr: string) => {
    if (!addr) return "...";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="chrome-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="section-title">Shoal++ Leader Reputation</h3>
          <p className="text-xs" style={{ color: "var(--chrome-600)" }}>
            Dynamic leader selection by reputation score
          </p>
        </div>
        <div className="text-xs font-mono" style={{ color: "var(--chrome-500)" }}>
          Top 10 validators
        </div>
      </div>

      <div className="space-y-2">
        {rankedValidators.length === 0 ? (
          <div className="text-center py-8 text-xs" style={{ color: "var(--chrome-600)" }}>
            Loading validators...
          </div>
        ) : (
          rankedValidators.map((v) => (
            <div
              key={v.address}
              className="flex items-center gap-3 py-1.5 px-2 rounded"
              style={{
                backgroundColor: v.isCurrentProposer
                  ? "rgba(0, 217, 165, 0.1)"
                  : "transparent",
              }}
            >
              {/* Rank */}
              <span
                className="w-6 text-right font-mono text-xs"
                style={{
                  color: v.rank <= 3 ? "#F59E0B" : "var(--chrome-500)",
                  fontWeight: v.rank <= 3 ? "bold" : "normal",
                }}
              >
                #{v.rank}
              </span>

              {/* Address */}
              <span
                className="font-mono text-xs w-24"
                style={{
                  color: v.isCurrentProposer ? "#00D9A5" : "var(--chrome-400)",
                }}
              >
                {formatAddress(v.address)}
              </span>

              {/* Reputation bar */}
              <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255, 255, 255, 0.1)" }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${v.reputationScore}%`,
                    backgroundColor: v.isCurrentProposer
                      ? "#00D9A5"
                      : v.rank <= 3
                      ? "#F59E0B"
                      : "#3B82F6",
                  }}
                />
              </div>

              {/* Score */}
              <span
                className="w-10 text-right font-mono text-xs"
                style={{ color: "var(--chrome-500)" }}
              >
                {v.reputationScore}%
              </span>

              {/* Current proposer indicator */}
              {v.isCurrentProposer && (
                <span
                  className="text-xs font-bold"
                  style={{ color: "#00D9A5" }}
                >
                  ⭐
                </span>
              )}
            </div>
          ))
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-white/5">
        <span className="flex items-center gap-1 text-xs" style={{ color: "var(--chrome-500)" }}>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#F59E0B" }} />
          Top 3
        </span>
        <span className="flex items-center gap-1 text-xs" style={{ color: "var(--chrome-500)" }}>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#00D9A5" }} />
          Current Leader
        </span>
        <span className="flex items-center gap-1 text-xs" style={{ color: "var(--chrome-500)" }}>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#3B82F6" }} />
          Others
        </span>
      </div>
    </div>
  );
}
