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
  const animationRef = useRef<number>(0);
  const shardsRef = useRef<Shard[]>([]);
  const [totalTps, setTotalTps] = useState(0);
  const [crossShardPct, setCrossShardPct] = useState(2.3);

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
    </div>
  );
}
