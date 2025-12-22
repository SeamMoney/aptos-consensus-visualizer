"use client";

import { BlockStream } from "@/components/block-stream";
import { ConsensusStatsPanel } from "@/components/consensus-stats";
import { TpsRace } from "@/components/tps-race";
import { LatencyChart } from "@/components/latency-chart";
import { ConsensusRoundsChart } from "@/components/consensus-rounds-chart";
import { TransactionPipeline } from "@/components/transaction-pipeline";
import { ValidatorRing } from "@/components/validator-ring";
import { RaptrConsensus } from "@/components/raptr-consensus";
import { BlockSTM } from "@/components/block-stm";
import { LeaderReputation } from "@/components/leader-reputation";
import { QuorumStoreFlow } from "@/components/quorum-store-flow";
import { ShardinesView } from "@/components/shardines-view";
import { useAptosStream } from "@/hooks/useAptosStream";

export default function Home() {
  const { stats, connected } = useAptosStream();

  return (
    <main className="min-h-screen min-h-[100dvh] px-3 py-4 sm:px-6 sm:py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header - Compact and clean */}
        <header className="flex items-center justify-between mb-4 sm:mb-6">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight" style={{ color: "var(--chrome-100)" }}>
              Aptos <span style={{ color: "var(--accent)" }}>Velociraptr</span>
            </h1>
            <p className="text-xs" style={{ color: "var(--chrome-600)" }}>
              Real-time consensus visualization
            </p>
          </div>
          <div className={`live-badge ${!connected ? 'opacity-50' : ''}`}>
            <span className="live-dot" />
            {connected ? 'Mainnet' : 'Connecting...'}
          </div>
        </header>

        {/* Block Stream - Live block production */}
        <section className="mb-4">
          <BlockStream />
        </section>

        {/* TPS Race - Chain comparison with flowing particles */}
        <section className="mb-4">
          <TpsRace />
        </section>

        {/* Latency Chart - Historical E2E latency like Grafana */}
        <section className="mb-4">
          <LatencyChart avgBlockTime={stats.avgBlockTime} />
        </section>

        {/* Consensus Rounds Chart - Shows how fast consensus is progressing */}
        <section className="mb-4">
          <ConsensusRoundsChart recentBlocks={stats.recentBlocks} />
        </section>

        {/* Transaction Pipeline - Raptr consensus stages */}
        <section className="mb-4">
          <TransactionPipeline
            recentBlocks={stats.recentBlocks}
            consensus={stats.consensus}
            avgBlockTime={stats.avgBlockTime}
          />
        </section>

        {/* Stats Grid: Validator Ring + Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <ValidatorRing consensus={stats.consensus} />
          <ConsensusStatsPanel
            consensus={stats.consensus}
            recentBlocks={stats.recentBlocks}
            tps={stats.tps}
            avgBlockTime={stats.avgBlockTime}
          />
        </div>

        {/* Consensus Tech Section Header */}
        <div className="mb-4 pt-4 border-t border-white/5">
          <h2 className="text-sm font-semibold tracking-wide mb-1" style={{ color: "var(--chrome-300)" }}>
            CONSENSUS TECHNOLOGY
          </h2>
          <p className="text-xs" style={{ color: "var(--chrome-600)" }}>
            Raptr, Block-STM, Quorum Store, Shoal++, Shardines
          </p>
        </div>

        {/* Raptr 4-Hop Consensus */}
        <section className="mb-4">
          <RaptrConsensus
            consensus={stats.consensus}
            avgBlockTime={stats.avgBlockTime}
          />
        </section>

        {/* Block-STM Parallel Execution */}
        <section className="mb-4">
          <BlockSTM tps={stats.tps} />
        </section>

        {/* Quorum Store Batch Flow */}
        <section className="mb-4">
          <QuorumStoreFlow tps={stats.tps} />
        </section>

        {/* Shoal++ and Shardines Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <LeaderReputation consensus={stats.consensus} />
          <ShardinesView tps={stats.tps} />
        </div>

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
