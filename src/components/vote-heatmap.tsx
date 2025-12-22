"use client";

import { useMemo } from "react";
import { BlockStats, ConsensusStats } from "@/hooks/useAptosStream";

interface VoteHeatmapProps {
  recentBlocks: BlockStats[];
  consensus: ConsensusStats | null;
}

interface ValidatorRow {
  originalIndex: number;
  address: string;
  votingPower: number;
  voted: boolean;
  rank: number;
}

export function VoteHeatmap({ recentBlocks, consensus }: VoteHeatmapProps) {
  // Get top 20 validators by voting power with their vote status
  const { topValidators, votedCount, totalValidators } = useMemo(() => {
    const validators = consensus?.validators || [];
    const votes = consensus?.validatorVotes || [];
    const totalValidators = consensus?.totalValidators || 138;

    if (validators.length === 0) {
      // No validator data yet - show placeholder
      return {
        topValidators: [],
        votedCount: 0,
        totalValidators,
      };
    }

    // Combine validators with their votes using original index
    const combined = validators.map((v, i) => ({
      originalIndex: i,
      address: v.address,
      votingPower: v.votingPower,
      voted: votes[i]?.voted ?? true, // Default to voted if no data
    }));

    // Sort by voting power descending
    combined.sort((a, b) => b.votingPower - a.votingPower);

    // Take top 20 with rank
    const topValidators: ValidatorRow[] = combined.slice(0, 20).map((v, i) => ({
      ...v,
      rank: i + 1,
    }));

    // Count how many voted overall
    const votedCount = votes.filter((v) => v?.voted).length || totalValidators;

    return { topValidators, votedCount, totalValidators };
  }, [consensus]);

  const currentProposer = consensus?.currentProposer || "";

  return (
    <div className="bg-black/30 rounded-xl p-4 border border-white/10">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-white/80">Validator Votes</h3>
        <div className="text-xs font-mono">
          <span className="text-emerald-400">{votedCount}</span>
          <span className="text-white/40">/{totalValidators} voted</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 text-xs text-white/50">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-emerald-500/80" />
          Voted
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-red-500/60" />
          No Vote
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-amber-500/80" />
          Proposer
        </span>
      </div>

      {/* Validator list */}
      {topValidators.length === 0 ? (
        <div className="text-center py-8 text-white/30 text-sm">
          Loading validators...
        </div>
      ) : (
        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {topValidators.map((validator) => {
            const isProposer = validator.address === currentProposer;

            return (
              <div
                key={validator.address}
                className="flex items-center gap-2 py-0.5"
              >
                {/* Rank */}
                <div className="w-5 text-right text-xs text-white/30 font-mono">
                  {validator.rank}
                </div>

                {/* Vote status indicator */}
                <div
                  className={`w-4 h-4 rounded-sm flex-shrink-0 ${
                    isProposer
                      ? "bg-amber-500/80"
                      : validator.voted
                      ? "bg-emerald-500/80"
                      : "bg-red-500/60"
                  }`}
                />

                {/* Address */}
                <div className="flex-1 text-xs font-mono text-white/50 truncate">
                  {validator.address.slice(0, 8)}...{validator.address.slice(-4)}
                </div>

                {/* Voting power */}
                <div className="text-xs font-mono text-white/30 tabular-nums">
                  {(validator.votingPower / 1e8).toFixed(0)}M
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary */}
      <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
        <span className="text-white/40">
          +{Math.max(0, totalValidators - 20)} other validators
        </span>
        <span className="text-white/50">
          Block #{recentBlocks[0]?.blockHeight?.toLocaleString() || "—"}
        </span>
      </div>
    </div>
  );
}
