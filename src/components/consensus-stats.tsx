"use client";

import { ConsensusStats, BlockStats } from "@/hooks/useAptosStream";

interface ConsensusStatsProps {
  consensus: ConsensusStats | null;
  recentBlocks: BlockStats[];
  tps: number;
  avgBlockTime: number;
}

export function ConsensusStatsPanel({
  consensus,
  recentBlocks,
  tps,
  avgBlockTime,
}: ConsensusStatsProps) {
  const latestBlock = recentBlocks[0];

  return (
    <div className="bg-black/30 rounded-xl p-4 border border-white/10">
      <h3 className="text-sm font-medium text-white/80 mb-4">Network Stats</h3>

      <div className="grid grid-cols-2 gap-4">
        {/* Epoch */}
        <div className="bg-black/20 rounded-lg p-3">
          <div className="text-xs text-white/40 mb-1">EPOCH</div>
          <div
            className="text-2xl font-mono text-emerald-400"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {consensus?.epoch?.toLocaleString() || "---"}
          </div>
        </div>

        {/* Round */}
        <div className="bg-black/20 rounded-lg p-3">
          <div className="text-xs text-white/40 mb-1">ROUND</div>
          <div
            className="text-2xl font-mono text-blue-400"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {consensus?.round?.toLocaleString() || "---"}
          </div>
        </div>

        {/* TPS */}
        <div className="bg-black/20 rounded-lg p-3">
          <div className="text-xs text-white/40 mb-1">TPS</div>
          <div
            className="text-2xl font-mono text-purple-400"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {tps.toLocaleString()}
          </div>
        </div>

        {/* Block Time */}
        <div className="bg-black/20 rounded-lg p-3">
          <div className="text-xs text-white/40 mb-1">BLOCK TIME</div>
          <div
            className="text-2xl font-mono text-amber-400"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {avgBlockTime}ms
          </div>
        </div>
      </div>

      {/* Validator Stats */}
      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/40">Active Validators</span>
          <span className="text-emerald-400 font-mono">
            {consensus?.activeValidators || consensus?.totalValidators || 138}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2">
          <span className="text-white/40">Vote Participation</span>
          <span
            className={`font-mono ${
              (consensus?.voteParticipation || 100) > 90
                ? "text-emerald-400"
                : (consensus?.voteParticipation || 100) > 66
                ? "text-amber-400"
                : "text-red-400"
            }`}
          >
            {consensus?.voteParticipation || 100}%
          </span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2">
          <span className="text-white/40">Total Stake</span>
          <span className="text-blue-400 font-mono">
            {consensus?.totalVotingPower
              ? `${(consensus.totalVotingPower / 1e8).toFixed(0)}M APT`
              : "---"}
          </span>
        </div>
      </div>

      {/* Recent Block Info */}
      {latestBlock && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="text-xs text-white/40 mb-2">LATEST BLOCK</div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/60">Height</span>
            <span className="text-white font-mono">
              #{latestBlock.blockHeight.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm mt-1">
            <span className="text-white/60">Transactions</span>
            <span className="text-emerald-400 font-mono">{latestBlock.txCount}</span>
          </div>
          {latestBlock.proposer && (
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-white/60">Proposer</span>
              <span className="text-purple-400 font-mono text-xs">
                {latestBlock.proposer.slice(0, 6)}...{latestBlock.proposer.slice(-4)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
