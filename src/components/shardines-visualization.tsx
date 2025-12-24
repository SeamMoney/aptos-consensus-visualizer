"use client";

import { useRef, useEffect, useState, memo } from "react";
import { useVisibility } from "@/hooks/useVisibility";

/**
 * Shardines: Dynamic Sharded Execution Engine
 *
 * Shows how Aptos achieves 1M+ TPS through:
 * - Dynamic hypergraph partitioning
 * - Parallel execution across shards
 * - Cross-shard coordination
 * - Micro-batching and pipelining
 */

interface Transaction {
  id: number;
  x: number;
  y: number;
  targetShard: number;
  color: string;
  state: "incoming" | "partitioning" | "executing" | "done";
  progress: number;
}

interface Shard {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  load: number; // 0-1
  txCount: number;
}

const PHASES = [
  {
    name: "PARTITION",
    title: "Dynamic Partitioning",
    desc: "Hypergraph partitioner analyzes transaction dependencies to find optimal shard assignments",
    technical: "Build hypergraph G = (V, E) where V = transactions, E = shared resource accesses. Run min-cut algorithm to partition V into k shards minimizing |E_cross| (cross-shard edges).",
    mechanic: "For each transaction: (1) Extract read/write set from Move bytecode, (2) Map resources to hypergraph nodes, (3) Add edges for overlapping accesses. Partitioner uses Kernighan-Lin or spectral methods to find balanced cuts with minimal cross-shard communication.",
  },
  {
    name: "DISTRIBUTE",
    title: "Shard Assignment",
    desc: "Load balancer routes transactions to assigned shards with dynamic rebalancing",
    technical: "Shard_i receives tx set T_i where |T_i| ≈ |T|/k ± ε. Dynamic resizing: if load(Shard_i) > 1.5 × avg, split shard. If load < 0.3 × avg, merge with neighbor.",
    mechanic: "Work-stealing scheduler ensures balanced execution: (1) Idle shards steal from overloaded neighbors, (2) Async message passing coordinates shard boundaries, (3) Consistent hashing ensures locality for frequently-accessed resources across blocks.",
  },
  {
    name: "EXECUTE",
    title: "Parallel Execution",
    desc: "Block-STM executes transactions in parallel within each shard using MVCC",
    technical: "Per-shard: Run Block-STM with thread pool. Cross-shard: Shared MVHashMap with versioned reads. Conflict = write-after-read on same resource across shards → mark for re-execution.",
    mechanic: "Each shard runs independently: (1) Optimistic execution assumes no conflicts, (2) MVCC tracks (value, version, txn_id) per location, (3) Validation phase checks read versions still valid, (4) Failed validations trigger local re-execution without blocking other shards.",
  },
  {
    name: "MERGE",
    title: "Result Aggregation",
    desc: "State deltas from all shards merged atomically with cross-shard conflict resolution",
    technical: "Collect Δ_i from each shard. Apply merge(Δ_0, Δ_1, ..., Δ_k) with deterministic ordering. Cross-shard conflicts resolved by txn ordering within block.",
    mechanic: "Merge protocol: (1) Each shard produces state delta Δ_i, (2) Coordinator collects all deltas, (3) Apply deltas in canonical order (by txn index), (4) Write-write conflicts resolved by last-writer-wins based on txn position. Final state is cryptographically committed to Jellyfish Merkle Tree.",
  },
];

const SHARD_COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Green
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#8B5CF6", // Purple
  "#EC4899", // Pink (for 6th shard)
];

export const ShardinesVisualization = memo(function ShardinesVisualization() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const transactionsRef = useRef<Transaction[]>([]);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [numShards, setNumShards] = useState(4);
  const phaseTimerRef = useRef(0);
  const txIdRef = useRef(0);
  const isVisible = useVisibility(containerRef);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastTime = 0;
    const targetFPS = 30;
    const frameInterval = 1000 / targetFPS;

    const render = (timestamp: number) => {
      // Skip rendering when off-screen
      if (!isVisible) {
        animationRef.current = requestAnimationFrame(render);
        return;
      }

      if (timestamp - lastTime < frameInterval) {
        animationRef.current = requestAnimationFrame(render);
        return;
      }
      lastTime = timestamp;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();

      if (canvas.width !== Math.floor(rect.width * dpr)) {
        canvas.width = Math.floor(rect.width * dpr);
        canvas.height = Math.floor(rect.height * dpr);
        ctx.scale(dpr, dpr);
      }

      const width = rect.width;
      const height = rect.height;

      // Clear
      ctx.fillStyle = "#0a0a0b";
      ctx.fillRect(0, 0, width, height);

      // Phase timer
      phaseTimerRef.current++;
      const phaseDuration = 90;

      if (phaseTimerRef.current > phaseDuration) {
        phaseTimerRef.current = 0;
        const nextPhase = (currentPhase + 1) % 4;
        setCurrentPhase(nextPhase);

        // Spawn new transactions at phase 0
        if (nextPhase === 0) {
          transactionsRef.current = [];
          const txCount = 12 + Math.floor(Math.random() * 8);
          for (let i = 0; i < txCount; i++) {
            transactionsRef.current.push({
              id: txIdRef.current++,
              x: 30 + Math.random() * 40,
              y: 40 + (i / txCount) * (height - 100),
              targetShard: Math.floor(Math.random() * numShards),
              color: SHARD_COLORS[Math.floor(Math.random() * numShards)],
              state: "incoming",
              progress: 0,
            });
          }
        }
      }

      // Layout calculations
      const partitionerX = width * 0.25;
      const shardsStartX = width * 0.45;
      const shardsEndX = width * 0.85;
      const shardWidth = (shardsEndX - shardsStartX) / numShards - 10;
      const shardHeight = height - 100;

      // Draw shards
      const shards: Shard[] = [];
      for (let i = 0; i < numShards; i++) {
        const shard: Shard = {
          id: i,
          x: shardsStartX + i * (shardWidth + 10),
          y: 50,
          width: shardWidth,
          height: shardHeight,
          load: 0,
          txCount: 0,
        };
        shards.push(shard);

        // Count transactions in this shard
        transactionsRef.current.forEach((tx) => {
          if (tx.targetShard === i && (tx.state === "executing" || tx.state === "done")) {
            shard.txCount++;
          }
        });
        shard.load = Math.min(1, shard.txCount / 5);

        // Shard background
        const gradient = ctx.createLinearGradient(shard.x, shard.y, shard.x, shard.y + shard.height);
        gradient.addColorStop(0, SHARD_COLORS[i] + "20");
        gradient.addColorStop(1, SHARD_COLORS[i] + "05");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(shard.x, shard.y, shard.width, shard.height, 6);
        ctx.fill();

        // Shard border
        ctx.strokeStyle = currentPhase >= 2 ? SHARD_COLORS[i] + "80" : SHARD_COLORS[i] + "30";
        ctx.lineWidth = currentPhase >= 2 ? 2 : 1;
        ctx.stroke();

        // Shard label
        ctx.fillStyle = SHARD_COLORS[i];
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`SHARD ${i}`, shard.x + shard.width / 2, shard.y + 15);

        // Load bar
        if (shard.load > 0) {
          const loadBarWidth = shard.width - 10;
          const loadBarHeight = 4;
          ctx.fillStyle = "rgba(255,255,255,0.1)";
          ctx.fillRect(shard.x + 5, shard.y + shard.height - 15, loadBarWidth, loadBarHeight);
          ctx.fillStyle = SHARD_COLORS[i];
          ctx.fillRect(shard.x + 5, shard.y + shard.height - 15, loadBarWidth * shard.load, loadBarHeight);
        }
      }

      // Draw partitioner box
      ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
      ctx.strokeStyle = currentPhase === 0 ? "#00D9A5" : "rgba(255,255,255,0.2)";
      ctx.lineWidth = currentPhase === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(partitionerX - 30, 50, 60, shardHeight, 6);
      ctx.fill();
      ctx.stroke();

      // Partitioner label
      ctx.save();
      ctx.translate(partitionerX, height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = currentPhase === 0 ? "#00D9A5" : "rgba(255,255,255,0.5)";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.fillText("HYPERGRAPH PARTITIONER", 0, 0);
      ctx.restore();

      // Update and draw transactions
      transactionsRef.current.forEach((tx) => {
        const targetShard = shards[tx.targetShard];
        tx.progress += 0.02;

        // State transitions based on phase
        if (currentPhase === 0) {
          tx.state = "incoming";
          // Move toward partitioner
          tx.x += (partitionerX - tx.x) * 0.05;
        } else if (currentPhase === 1) {
          tx.state = "partitioning";
          // Move toward assigned shard
          const targetX = targetShard.x + targetShard.width / 2;
          tx.x += (targetX - tx.x) * 0.08;
          tx.color = SHARD_COLORS[tx.targetShard];
        } else if (currentPhase === 2) {
          tx.state = "executing";
          // Stay within shard, slight movement to show execution
          const targetX = targetShard.x + targetShard.width / 2;
          tx.x = targetX + Math.sin(timestamp / 200 + tx.id) * 5;
        } else {
          tx.state = "done";
          // Move to right side (merge)
          tx.x += (width - 20 - tx.x) * 0.05;
        }

        // Draw transaction
        const size = tx.state === "executing" ? 6 : 4;

        // Glow
        ctx.beginPath();
        const gradient = ctx.createRadialGradient(tx.x, tx.y, 0, tx.x, tx.y, size * 2);
        gradient.addColorStop(0, tx.color + "80");
        gradient.addColorStop(1, "transparent");
        ctx.fillStyle = gradient;
        ctx.arc(tx.x, tx.y, size * 2, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.fillStyle = tx.color;
        ctx.arc(tx.x, tx.y, size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw flow arrows
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      // Incoming arrow
      ctx.beginPath();
      ctx.moveTo(40, height / 2);
      ctx.lineTo(partitionerX - 35, height / 2);
      ctx.stroke();

      // Partitioner to shards arrows
      for (let i = 0; i < numShards; i++) {
        const shard = shards[i];
        ctx.beginPath();
        ctx.moveTo(partitionerX + 35, height / 2);
        ctx.lineTo(shard.x - 5, 50 + shard.height / 2);
        ctx.stroke();
      }

      ctx.setLineDash([]);

      // Title
      ctx.fillStyle = "#00D9A5";
      ctx.font = "bold 11px system-ui";
      ctx.textAlign = "left";
      ctx.fillText("SHARDINES: DYNAMIC EXECUTION", 15, 20);

      // TPS indicator
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`${numShards} Shards · 1M+ TPS`, width - 15, 20);

      // Phase indicator
      ctx.fillStyle = "#00D9A5";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`Phase: ${PHASES[currentPhase].name}`, 15, 38);

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationRef.current);
  }, [currentPhase, numShards, isVisible]);

  return (
    <div ref={containerRef} className="chrome-card p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="section-title">Shardines: Sharded Execution</h3>
          <p className="text-xs" style={{ color: "var(--chrome-600)" }}>
            Dynamic partitioning for horizontal scalability
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--chrome-500)" }}>Shards:</span>
          {[2, 4, 6].map((n) => (
            <button
              key={n}
              onClick={() => setNumShards(n)}
              className={`px-2 py-1 text-xs font-mono rounded transition-colors ${
                numShards === n ? "bg-[#00D9A5] text-black" : "bg-white/10 text-white/60"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full rounded"
        style={{ height: "320px" }}
      />

      {/* Phase explanation */}
      <div className="mt-4 p-3 rounded-lg bg-white/5 border border-white/10">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="px-2 py-0.5 rounded text-xs font-bold"
            style={{ backgroundColor: "#00D9A5", color: "#000" }}
          >
            Phase {currentPhase + 1}/4
          </span>
          <span className="text-sm font-bold" style={{ color: "#00D9A5" }}>
            {PHASES[currentPhase].title}
          </span>
        </div>

        <p className="text-xs mb-2" style={{ color: "var(--chrome-400)" }}>
          {PHASES[currentPhase].desc}
        </p>

        <div className="space-y-2 mt-3">
          <div className="p-2 rounded bg-white/5">
            <div className="text-[10px] font-bold mb-1" style={{ color: "#3B82F6" }}>Algorithm:</div>
            <p className="text-xs font-mono" style={{ color: "var(--chrome-500)" }}>
              {PHASES[currentPhase].technical}
            </p>
          </div>

          <div className="p-2 rounded bg-white/5">
            <div className="text-[10px] font-bold mb-1" style={{ color: "#00D9A5" }}>How It Works:</div>
            <p className="text-xs" style={{ color: "var(--chrome-500)" }}>
              {PHASES[currentPhase].mechanic}
            </p>
          </div>
        </div>

        {/* Timeline */}
        <div className="flex items-center gap-1 mt-3">
          {PHASES.map((phase, i) => (
            <div key={i} className="flex-1">
              <div
                className="h-1.5 rounded-full transition-all"
                style={{
                  backgroundColor: i <= currentPhase ? "#00D9A5" : "rgba(255,255,255,0.1)",
                }}
              />
              <div className="text-[8px] mt-1 text-center" style={{ color: "var(--chrome-600)" }}>
                {phase.name}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Key insight */}
      <div className="mt-2 p-2 rounded bg-white/5">
        <p className="text-xs" style={{ color: "var(--chrome-500)" }}>
          <span className="font-bold" style={{ color: "#00D9A5" }}>Key Innovation:</span>
          {" "}Shardines combines hypergraph partitioning (minimize cross-shard edges) with Block-STM per shard (optimistic parallel execution). Workloads automatically rebalance: shards split when overloaded, merge when idle. Cross-shard coordination uses lock-free MVHashMap with versioned reads—conflicts are rare (&lt;5% for typical DeFi workloads) and resolved by deterministic re-execution.
        </p>
      </div>
    </div>
  );
});
