"use client";

import { useRef, useEffect, useState } from "react";

interface ShardinesViewProps {
  tps: number;
}

interface Shard {
  id: number;
  throughput: number;
  targetThroughput: number;
  color: string;
}

// For the educational animation
interface EduTransaction {
  id: number;
  x: number;
  y: number;
  targetShard: number;
  progress: number;
  isCrossShard: boolean;
  color: string;
}

interface EduShard {
  id: number;
  x: number;
  y: number;
  width: number;
  load: number;
  color: string;
}

const SHARD_COLORS = [
  "#00D9A5", // Green
  "#3B82F6", // Blue
  "#F59E0B", // Amber
  "#EC4899", // Pink
  "#8B5CF6", // Purple
  "#06B6D4", // Cyan
];

export function ShardinesView({ tps }: ShardinesViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const eduCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const eduAnimationRef = useRef<number>(0);
  const shardsRef = useRef<Shard[]>([]);
  const [totalTps, setTotalTps] = useState(0);
  const [crossShardPct, setCrossShardPct] = useState(2.3);

  // Educational animation state
  const eduShardsRef = useRef<EduShard[]>([]);
  const eduTransactionsRef = useRef<EduTransaction[]>([]);
  const eduTxIdRef = useRef(0);
  const [partitionPhase, setPartitionPhase] = useState<"partition" | "execute" | "merge">("partition");

  // Initialize shards
  useEffect(() => {
    const numShards = 6;
    const baseTps = 160000 / numShards; // Distribute theoretical max

    shardsRef.current = Array.from({ length: numShards }, (_, i) => ({
      id: i,
      throughput: 0,
      targetThroughput: baseTps + (Math.random() - 0.5) * baseTps * 0.3,
      color: SHARD_COLORS[i % SHARD_COLORS.length],
    }));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastTime = 0;
    const targetFPS = 20;
    const frameInterval = 1000 / targetFPS;

    const render = (timestamp: number) => {
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

      const barHeight = 22;
      const barGap = 10;
      const startY = 45;
      const labelWidth = 70;
      const statsWidth = 80;
      const barMaxWidth = width - labelWidth - statsWidth - 40;

      // Update shard throughputs with smooth animation
      let total = 0;
      shardsRef.current.forEach((shard) => {
        // Animate toward target with some variation
        const variance = (Math.random() - 0.5) * 2000;
        shard.targetThroughput = Math.max(20000, Math.min(35000, shard.targetThroughput + variance));
        shard.throughput += (shard.targetThroughput - shard.throughput) * 0.1;
        total += shard.throughput;
      });

      setTotalTps(Math.round(total));

      // Vary cross-shard percentage
      setCrossShardPct(prev => {
        const newVal = prev + (Math.random() - 0.5) * 0.2;
        return Math.max(1.5, Math.min(4, newVal));
      });

      const maxThroughput = Math.max(...shardsRef.current.map(s => s.throughput));

      // Draw shards
      shardsRef.current.forEach((shard, i) => {
        const y = startY + i * (barHeight + barGap);

        // Shard label
        ctx.fillStyle = shard.color;
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "left";
        ctx.fillText(`SHARD ${shard.id}`, 20, y + barHeight / 2 + 4);

        // Bar background
        ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
        ctx.beginPath();
        ctx.roundRect(labelWidth, y, barMaxWidth, barHeight, 4);
        ctx.fill();

        // Progress bar
        const barWidth = (shard.throughput / maxThroughput) * barMaxWidth * 0.9;
        ctx.fillStyle = shard.color;
        ctx.beginPath();
        ctx.roundRect(labelWidth, y, barWidth, barHeight, 4);
        ctx.fill();

        // Throughput label
        const tpsK = Math.round(shard.throughput / 1000);
        ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        ctx.font = "10px monospace";
        ctx.textAlign = "right";
        ctx.fillText(`${tpsK}k TPS`, width - 20, y + barHeight / 2 + 4);
      });

      // Divider line
      const dividerY = startY + shardsRef.current.length * (barHeight + barGap) + 5;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(labelWidth, dividerY);
      ctx.lineTo(width - 20, dividerY);
      ctx.stroke();

      // Total row
      const totalY = dividerY + 15;
      ctx.fillStyle = "#00D9A5";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "left";
      ctx.fillText("TOTAL", 20, totalY + 4);

      ctx.fillStyle = "#00D9A5";
      ctx.font = "bold 12px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`${Math.round(total / 1000)}k TPS`, width - 20, totalY + 4);

      // Cross-shard indicator
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`Cross-shard: ${crossShardPct.toFixed(1)}%`, width / 2, totalY + 4);

      // Title
      ctx.fillStyle = "#8B5CF6";
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("Shardines - Parallel Shards", 20, 25);

      // Linear scaling indicator
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.font = "10px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`${shardsRef.current.length} shards · ~linear scaling`, width - 20, 25);

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);

    return () => cancelAnimationFrame(animationRef.current);
  }, [crossShardPct]);

  // Educational animation - dynamic partitioning visualization
  useEffect(() => {
    const canvas = eduCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Initialize educational shards
    const initEduShards = (width: number, height: number) => {
      const numShards = 4;
      const shardHeight = 35;
      const shardGap = 12;
      const startY = 50;
      const shardWidth = width - 40;

      eduShardsRef.current = Array.from({ length: numShards }, (_, i) => ({
        id: i,
        x: 20,
        y: startY + i * (shardHeight + shardGap),
        width: shardWidth,
        load: 0.3 + Math.random() * 0.4,
        color: SHARD_COLORS[i],
      }));
    };

    let lastTime = 0;
    let frameCount = 0;
    const targetFPS = 30;
    const frameInterval = 1000 / targetFPS;

    const render = (timestamp: number) => {
      if (timestamp - lastTime < frameInterval) {
        eduAnimationRef.current = requestAnimationFrame(render);
        return;
      }
      lastTime = timestamp;
      frameCount++;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();

      if (canvas.width !== Math.floor(rect.width * dpr)) {
        canvas.width = Math.floor(rect.width * dpr);
        canvas.height = Math.floor(rect.height * dpr);
        ctx.scale(dpr, dpr);
        initEduShards(rect.width, rect.height);
      }

      const width = rect.width;
      const height = rect.height;

      // Clear
      ctx.fillStyle = "#0a0a0b";
      ctx.fillRect(0, 0, width, height);

      // Spawn new transactions
      if (frameCount % 20 === 0 && eduTransactionsRef.current.length < 15) {
        const targetShard = Math.floor(Math.random() * eduShardsRef.current.length);
        const isCrossShard = Math.random() < 0.1; // 10% cross-shard

        eduTransactionsRef.current.push({
          id: eduTxIdRef.current++,
          x: 0,
          y: 25,
          targetShard,
          progress: 0,
          isCrossShard,
          color: isCrossShard ? "#EC4899" : SHARD_COLORS[targetShard],
        });
      }

      // Draw partitioner zone
      ctx.fillStyle = "rgba(139, 92, 246, 0.1)";
      ctx.fillRect(0, 0, width, 40);
      ctx.fillStyle = "#8B5CF6";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.fillText("DYNAMIC PARTITIONER", width / 2, 15);
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.font = "8px monospace";
      ctx.fillText("Minimizes cross-shard transactions", width / 2, 28);

      // Draw shards
      eduShardsRef.current.forEach((shard, i) => {
        // Shard background
        ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
        ctx.beginPath();
        ctx.roundRect(shard.x, shard.y, shard.width, 35, 4);
        ctx.fill();

        // Load bar
        shard.load += (Math.random() - 0.5) * 0.02;
        shard.load = Math.max(0.2, Math.min(0.9, shard.load));

        ctx.fillStyle = shard.color + "40";
        ctx.beginPath();
        ctx.roundRect(shard.x, shard.y, shard.width * shard.load, 35, 4);
        ctx.fill();

        // Shard label
        ctx.fillStyle = shard.color;
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "left";
        ctx.fillText(`SHARD ${i}`, shard.x + 8, shard.y + 22);

        // Load percentage
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.font = "9px monospace";
        ctx.textAlign = "right";
        ctx.fillText(`${Math.round(shard.load * 100)}%`, shard.x + shard.width - 8, shard.y + 22);
      });

      // Update and draw transactions
      eduTransactionsRef.current = eduTransactionsRef.current.filter(tx => {
        tx.progress += 0.02;

        const targetShard = eduShardsRef.current[tx.targetShard];
        if (!targetShard) return false;

        // Calculate position along path
        const partitionerY = 35;
        const shardY = targetShard.y + 17;

        let x: number, y: number;

        if (tx.progress < 0.3) {
          // Moving to partitioner
          x = 20 + tx.progress * 3 * (width / 2 - 20);
          y = partitionerY;
        } else if (tx.progress < 0.5) {
          // In partitioner
          x = width / 2;
          y = partitionerY;
        } else if (tx.progress < 0.8) {
          // Moving to shard
          const shardProgress = (tx.progress - 0.5) / 0.3;
          x = width / 2 + shardProgress * (targetShard.x + 50 - width / 2);
          y = partitionerY + shardProgress * (shardY - partitionerY);
        } else {
          // In shard, moving right
          const inShardProgress = (tx.progress - 0.8) / 0.2;
          x = targetShard.x + 50 + inShardProgress * (targetShard.width - 80);
          y = shardY;
        }

        if (tx.progress >= 1) return false;

        // Draw transaction
        ctx.beginPath();
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, 8);
        gradient.addColorStop(0, tx.color);
        gradient.addColorStop(0.5, tx.color + "80");
        gradient.addColorStop(1, "transparent");
        ctx.fillStyle = gradient;
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = "#fff";
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();

        // Cross-shard indicator
        if (tx.isCrossShard && tx.progress > 0.5 && tx.progress < 0.8) {
          ctx.fillStyle = "#EC4899";
          ctx.font = "bold 7px monospace";
          ctx.textAlign = "center";
          ctx.fillText("X", x, y - 10);
        }

        return true;
      });

      // Draw cross-shard connections when they occur
      const crossShardTxs = eduTransactionsRef.current.filter(tx => tx.isCrossShard && tx.progress > 0.6);
      crossShardTxs.forEach(tx => {
        const sourceShard = eduShardsRef.current[tx.targetShard];
        const destShard = eduShardsRef.current[(tx.targetShard + 1) % eduShardsRef.current.length];
        if (sourceShard && destShard) {
          ctx.strokeStyle = "#EC489940";
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(sourceShard.x + sourceShard.width - 20, sourceShard.y + 17);
          ctx.lineTo(destShard.x + destShard.width - 20, destShard.y + 17);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });

      eduAnimationRef.current = requestAnimationFrame(render);
    };

    eduAnimationRef.current = requestAnimationFrame(render);

    return () => cancelAnimationFrame(eduAnimationRef.current);
  }, []);

  return (
    <div className="chrome-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="section-title">Shardines Execution</h3>
          <p className="text-xs" style={{ color: "var(--chrome-600)" }}>
            Parallel shards with near-linear scaling
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono">
          <span style={{ color: "var(--chrome-500)" }}>
            Cross-shard: <span style={{ color: "#F59E0B" }}>{crossShardPct.toFixed(1)}%</span>
          </span>
          <span style={{ color: "#00D9A5", fontWeight: "bold" }}>
            {Math.round(totalTps / 1000)}k TPS
          </span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full rounded"
        style={{ height: "240px" }}
      />

      {/* Educational Panel */}
      <div className="mt-4 p-4 rounded-lg bg-white/5 border border-white/10">
        <div className="flex items-start gap-4">
          {/* Animated Partitioning Diagram */}
          <div className="flex-shrink-0">
            <canvas
              ref={eduCanvasRef}
              className="rounded"
              style={{ width: "260px", height: "200px" }}
            />
          </div>

          {/* Explanation */}
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold mb-2" style={{ color: "#8B5CF6" }}>
              Sharding Without Breaking State
            </h4>

            <div className="space-y-2 text-xs" style={{ color: "var(--chrome-400)" }}>
              <div>
                <span className="font-semibold" style={{ color: "#EF4444" }}>Traditional Sharding:</span>
                <ul className="mt-1 ml-4 space-y-0.5 list-disc">
                  <li>Split state across different chains</li>
                  <li>Cross-shard communication is complex & slow</li>
                </ul>
              </div>

              <div>
                <span className="font-semibold" style={{ color: "#8B5CF6" }}>Shardines Approach:</span>
                <ul className="mt-1 ml-4 space-y-0.5 list-disc">
                  <li>Scale WITHIN a single validator cluster</li>
                  <li>Dynamic partitioner minimizes cross-shard txs</li>
                  <li>Hypergraph partitioning reduces communication</li>
                </ul>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-white/10 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: "var(--chrome-500)" }}>
                  <span className="font-semibold" style={{ color: "#00D9A5" }}>Lab results:</span> 1,000,000 TPS
                </span>
                <span className="font-mono" style={{ color: "var(--chrome-600)" }}>
                  30-machine cluster
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#EC4899" }} />
                <span style={{ color: "var(--chrome-500)" }}>Cross-shard txs typically &lt;5%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
