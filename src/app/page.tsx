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
import { VelociraptorProposals } from "@/components/velociraptr-proposals";
import { ShardinesVisualization } from "@/components/shardines-visualization";
import { ConsensusObserver } from "@/components/consensus-observer";
import { ZaptosPipelining } from "@/components/zaptos-pipelining";
import { MoveExecutionPipeline } from "@/components/move-execution-pipeline";
import { MoveVMPipeline } from "@/components/move-vm-pipeline";
import { LoaderV2Parallel } from "@/components/loader-v2-parallel";
import { LoaderV2Caching } from "@/components/loader-v2-caching";
import { ArchonConsensus } from "@/components/archon-consensus";
import { ConsensusEvolution } from "@/components/consensus-evolution";
import {
  StableFeesStress,
  StableFeesComparison,
  OrderbookStress,
  OrderbookComparison,
  BlockSTMExplainer,
  FeeMarketExplainer,
  PerpDexScenario,
  EncryptedMempool,
} from "@/components/pixi";
import { useAptosStream } from "@/hooks/useAptosStream";
import { LearnMoreLink } from "@/components/ui/tooltip";
import { NetworkSelector } from "@/components/network-selector";

export default function Home() {
  const { stats, connected } = useAptosStream();

  return (
    <main className="min-h-screen min-h-[100dvh] px-1.5 py-3 sm:px-6 sm:py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header - Compact and clean */}
        <header className="flex items-center justify-between mb-4 sm:mb-6">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight" style={{ color: "var(--chrome-100)" }}>
              Aptos <span style={{ color: "var(--accent)" }}>Velociraptr</span>
            </h1>
            <p className="text-xs" style={{ color: "var(--chrome-600)" }}>
              Learn how Aptos processes 160,000+ transactions per second
            </p>
          </div>
          <NetworkSelector connected={connected} />
        </header>

        {/* Block Stream - Live block production */}
        <section id="live-data" className="mb-4 scroll-mt-4">
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
        <div id="consensus" className="mb-4 pt-6 border-t border-white/5 scroll-mt-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: "#F59E0B", color: "#000" }}>2</span>
            <h2 className="text-sm font-semibold tracking-wide" style={{ color: "var(--chrome-200)" }}>
              CONSENSUS: How Validators Agree
              <LearnMoreLink href="https://aptos.dev/network/blockchain/blockchain-deep-dive" label="Aptos Consensus Deep Dive" />
            </h2>
          </div>
          <p className="text-xs ml-8" style={{ color: "var(--chrome-500)" }}>
            Before your transaction is final, ~140 validators must agree it's valid.
            These visualizations show the messaging protocol that makes that happen in ~400ms.
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

        {/* Execution Section Header */}
        <div id="execution" className="mb-4 pt-6 border-t border-white/5 scroll-mt-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: "#10B981", color: "#000" }}>3</span>
            <h2 className="text-sm font-semibold tracking-wide" style={{ color: "var(--chrome-200)" }}>
              EXECUTION: Running Your Smart Contract
              <LearnMoreLink href="https://aptos.dev/network/blockchain/execution" label="Aptos Execution Deep Dive" />
            </h2>
          </div>
          <p className="text-xs ml-8" style={{ color: "var(--chrome-500)" }}>
            Once consensus is reached, your transaction runs on the Move VM.
            These diagrams show how code goes from bytecode to state changes.
          </p>
        </div>

        {/* Move Execution Pipeline - High-level overview */}
        <section className="mb-4">
          <MoveExecutionPipeline />
        </section>

        {/* Move VM Pipeline - Detailed 7-stage execution */}
        <section className="mb-4">
          <MoveVMPipeline />
        </section>

        {/* Loader V2 Section - Caching Deep Dive */}
        <div className="mb-4 pt-6 border-t border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-1 rounded text-[10px] font-bold" style={{ backgroundColor: "#00D9A5", color: "#000" }}>DEEP DIVE</span>
            <h2 className="text-sm font-semibold tracking-wide" style={{ color: "var(--chrome-200)" }}>
              Loader V2: Why 60% Faster?
              <LearnMoreLink href="https://aptos.dev/network/blockchain/execution" label="Aptos Execution Details" />
            </h2>
          </div>
          <p className="text-xs ml-8" style={{ color: "var(--chrome-500)" }}>
            The secret sauce: multi-level code caching. Instead of reloading smart contract code for every transaction,
            Aptos keeps hot modules in memory — from per-thread (L1) to epoch-wide (L3) caches.
          </p>
        </div>

        {/* Loader V2 Caching - L1/L2/L3 hierarchy */}
        <section className="mb-4">
          <LoaderV2Caching />
        </section>

        {/* Loader V2 Parallelization - Block-STM integration */}
        <section className="mb-4">
          <LoaderV2Parallel />
        </section>

        {/* Optimizations Section Header */}
        <div id="optimizations" className="mb-4 pt-6 border-t border-white/5 scroll-mt-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: "#A855F7", color: "#fff" }}>4</span>
            <h2 className="text-sm font-semibold tracking-wide" style={{ color: "var(--chrome-200)" }}>
              OPTIMIZATIONS: Speed Innovations
              <LearnMoreLink href="https://aptos.dev/network/blockchain/aptos-white-paper" label="Aptos White Paper" />
            </h2>
          </div>
          <p className="text-xs ml-8" style={{ color: "var(--chrome-500)" }}>
            What makes Aptos the fastest blockchain? These cutting-edge techniques work together:
            optimistic proposals, parallel pipelines, dynamic sharding, and observer nodes for scale.
          </p>
        </div>

        {/* Velociraptr Optimistic Proposals */}
        <section className="mb-4">
          <VelociraptorProposals />
        </section>

        {/* Archon Consensus - Primary-Proxy Leader */}
        <section className="mb-4">
          <ArchonConsensus />
        </section>

        {/* Consensus Evolution Comparison */}
        <section className="mb-4">
          <ConsensusEvolution />
        </section>

        {/* Zaptos Parallel Pipeline */}
        <section className="mb-4">
          <ZaptosPipelining />
        </section>

        {/* Shardines Dynamic Sharding */}
        <section className="mb-4">
          <ShardinesVisualization />
        </section>

        {/* Consensus Observer */}
        <section className="mb-4">
          <ConsensusObserver />
        </section>

        {/* Gas Fees Section Header */}
        <div id="gas-fees" className="mb-4 pt-6 border-t border-white/5 scroll-mt-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: "#F59E0B", color: "#000" }}>5</span>
            <h2 className="text-sm font-semibold tracking-wide" style={{ color: "var(--chrome-200)" }}>
              GAS FEES: Stable Under Load
              <LearnMoreLink href="https://aptos.dev/concepts/gas-txn-fee" label="Aptos Gas & Fees" />
            </h2>
          </div>
          <p className="text-xs ml-8" style={{ color: "var(--chrome-500)" }}>
            Fee auction models can spike dramatically during demand surges. Aptos uses governance-set pricing&mdash;no gas wars, no priority auctions, just predictable fees regardless of network load.
          </p>
        </div>

        {/* Orderbook Stress Test - Polymarket Election Night */}
        <section className="mb-4">
          <OrderbookStress />
        </section>

        {/* Chain Comparison - Same Load Different Outcomes */}
        <section className="mb-4">
          <OrderbookComparison />
        </section>

        {/* Block-STM Parallel Execution Explainer */}
        <section className="mb-4">
          <BlockSTMExplainer />
        </section>

        {/* Fee Market Economics Explainer */}
        <section className="mb-4">
          <FeeMarketExplainer />
        </section>

        {/* Encrypted Mempool - MEV Protection */}
        <section className="mb-4" id="encrypted-mempool">
          <EncryptedMempool />
        </section>

        {/* Perp DEX Flash Crash Scenario */}
        <section className="mb-4">
          <PerpDexScenario />
        </section>

        {/* Stable Fees Under Stress (Legacy) */}
        <section className="mb-4">
          <StableFeesStress />
        </section>

        {/* Fee Comparison: Solana vs Aptos (Legacy) */}
        <section className="mb-4">
          <StableFeesComparison />
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
