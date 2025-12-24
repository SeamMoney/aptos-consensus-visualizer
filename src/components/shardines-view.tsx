"use client";

import { useRef, useEffect, useState, memo } from "react";
import { useVisibility } from "@/hooks/useVisibility";

interface ShardinesViewProps {
  tps: number;
}

/**
 * Shardines View - Mobile-responsive visualization showing:
 * - Desktop: Horizontal layout (Resource Graph → Partitioner → Shards → Merge)
 * - Mobile: Vertical stacked layout with simplified elements
 */

interface Transaction {
  id: number;
  x: number;
  y: number;
  targetShard: number;
  resources: number[];
  phase: "incoming" | "partitioning" | "assigned" | "executing" | "merging" | "done";
  progress: number;
  color: string;
  isCrossShard: boolean;
  executionProgress: number;
}

interface Shard {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  load: number;
  color: string;
  threads: Thread[];
}

interface Thread {
  id: number;
  busy: boolean;
  txId: number | null;
  progress: number;
}

interface Resource {
  id: number;
  x: number;
  y: number;
  name: string;
  color: string;
  accessCount: number;
}

const SHARD_COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Green
  "#F59E0B", // Amber
  "#EF4444", // Red
];

const RESOURCE_NAMES = ["coin", "nft", "swap", "stake", "acct", "event"];

const PHASES = [
  {
    name: "PARTITION",
    title: "Hypergraph Partitioning",
    desc: "Analyze transaction dependencies by shared resources",
    detail: "Build graph where TXs are nodes, shared resources are hyperedges",
  },
  {
    name: "ASSIGN",
    title: "Shard Assignment",
    desc: "Route transactions to shards to minimize cross-shard access",
    detail: "Min-cut algorithm groups related TXs into same shard",
  },
  {
    name: "EXECUTE",
    title: "Parallel Execution",
    desc: "Each shard runs Block-STM with multiple threads",
    detail: "MVCC enables optimistic parallel execution per shard",
  },
  {
    name: "MERGE",
    title: "State Merge",
    desc: "Aggregate state deltas from all shards atomically",
    detail: "Deterministic ordering resolves cross-shard conflicts",
  },
];

export const ShardinesView = memo(function ShardinesView({ tps }: ShardinesViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const isVisible = useVisibility(containerRef);

  const [currentPhase, setCurrentPhase] = useState(0);
  const [stats, setStats] = useState({ totalTps: 0, crossShardPct: 2.3 });
  const [isMobile, setIsMobile] = useState(false);
  const phaseTimerRef = useRef(0);

  const transactionsRef = useRef<Transaction[]>([]);
  const shardsRef = useRef<Shard[]>([]);
  const resourcesRef = useRef<Resource[]>([]);
  const txIdRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastTime = 0;
    const targetFPS = 30;
    const frameInterval = 1000 / targetFPS;

    const render = (timestamp: number) => {
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
      const width = rect.width;
      const height = rect.height;

      // Detect mobile (width < 500px)
      const mobile = width < 500;
      setIsMobile(mobile);

      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);

        // Initialize resources
        resourcesRef.current = RESOURCE_NAMES.slice(0, mobile ? 4 : 6).map((name, i) => ({
          id: i,
          x: 0,
          y: 0,
          name,
          color: SHARD_COLORS[i % SHARD_COLORS.length],
          accessCount: 0,
        }));

        // Initialize shards
        shardsRef.current = Array.from({ length: 4 }, (_, i) => ({
          id: i,
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          load: 0,
          color: SHARD_COLORS[i],
          threads: Array.from({ length: mobile ? 2 : 4 }, (_, t) => ({
            id: t,
            busy: false,
            txId: null,
            progress: 0,
          })),
        }));
      }

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

        if (nextPhase === 0) {
          transactionsRef.current = [];
          shardsRef.current.forEach(s => {
            s.threads.forEach(t => { t.busy = false; t.txId = null; t.progress = 0; });
          });
        }
      }

      // Spawn transactions
      if (currentPhase === 0 && phaseTimerRef.current % 15 === 0 && transactionsRef.current.length < (mobile ? 8 : 16)) {
        const numResources = 1 + Math.floor(Math.random() * 2);
        const resources = Array.from({ length: numResources }, () =>
          Math.floor(Math.random() * resourcesRef.current.length)
        ).filter((v, i, a) => a.indexOf(v) === i);

        const isCrossShard = resources.length > 1 && Math.random() < 0.15;
        const targetShard = Math.floor(Math.random() * shardsRef.current.length);

        transactionsRef.current.push({
          id: txIdRef.current++,
          x: 20,
          y: height / 2,
          targetShard,
          resources,
          phase: "incoming",
          progress: 0,
          color: SHARD_COLORS[targetShard],
          isCrossShard,
          executionProgress: 0,
        });
      }

      if (mobile) {
        renderMobile(ctx, width, height, timestamp);
      } else {
        renderDesktop(ctx, width, height, timestamp);
      }

      // Update stats
      const crossShardCount = transactionsRef.current.filter(t => t.isCrossShard).length;
      setStats({
        totalTps: Math.round(160000 + (Math.random() - 0.5) * 10000),
        crossShardPct: crossShardCount > 0 ? (crossShardCount / Math.max(1, transactionsRef.current.length) * 100) : 2.3,
      });

      animationRef.current = requestAnimationFrame(render);
    };

    // ========== MOBILE LAYOUT ==========
    const renderMobile = (ctx: CanvasRenderingContext2D, width: number, height: number, timestamp: number) => {
      const padding = 10;
      const sectionGap = 8;

      // Title
      ctx.fillStyle = "#8B5CF6";
      ctx.font = "bold 11px system-ui";
      ctx.textAlign = "left";
      ctx.fillText("SHARDINES", padding, 18);

      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.font = "8px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`${stats.crossShardPct.toFixed(1)}% cross-shard`, width - padding, 18);

      // Layout: Vertical stack
      // [Resources + Partitioner] row (small)
      // [Shards 2x2 grid] (main area)
      // [Merge zone] (small)
      // [Phase bar] (bottom)

      const topRowY = 30;
      const topRowHeight = 80;
      const shardAreaY = topRowY + topRowHeight + sectionGap;
      const shardAreaHeight = height - shardAreaY - 50;
      const phaseBarY = height - 38;

      // === Top Row: Resources + Partitioner ===
      const resourceAreaWidth = width * 0.6 - padding;
      const partitionerWidth = width * 0.4 - padding;

      // Resources section
      ctx.fillStyle = currentPhase === 0 ? "rgba(139, 92, 246, 0.1)" : "rgba(255, 255, 255, 0.03)";
      ctx.beginPath();
      ctx.roundRect(padding, topRowY, resourceAreaWidth, topRowHeight, 6);
      ctx.fill();
      ctx.strokeStyle = currentPhase === 0 ? "#8B5CF680" : "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = currentPhase === 0 ? "#8B5CF6" : "rgba(255, 255, 255, 0.4)";
      ctx.font = "bold 8px monospace";
      ctx.textAlign = "center";
      ctx.fillText("RESOURCES", padding + resourceAreaWidth / 2, topRowY + 12);

      // Draw resources in a row
      const numResources = resourcesRef.current.length;
      const resCenterY = topRowY + topRowHeight / 2 + 8;
      resourcesRef.current.forEach((res, i) => {
        const resX = padding + 15 + (i * (resourceAreaWidth - 30) / (numResources - 1 || 1));
        res.x = resX;
        res.y = resCenterY;

        const nodeSize = 12 + res.accessCount;
        ctx.beginPath();
        ctx.fillStyle = res.color + "40";
        ctx.arc(res.x, res.y, nodeSize, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = res.color;
        ctx.arc(res.x, res.y, nodeSize - 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#fff";
        ctx.font = "bold 6px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(res.name, res.x, res.y);

        res.accessCount = Math.max(0, res.accessCount - 0.03);
      });

      // Partitioner section
      const partX = padding + resourceAreaWidth + sectionGap;
      ctx.fillStyle = currentPhase <= 1 ? "rgba(0, 217, 165, 0.1)" : "rgba(255, 255, 255, 0.03)";
      ctx.beginPath();
      ctx.roundRect(partX, topRowY, partitionerWidth - sectionGap, topRowHeight, 6);
      ctx.fill();
      ctx.strokeStyle = currentPhase <= 1 ? "#00D9A580" : "rgba(255, 255, 255, 0.1)";
      ctx.stroke();

      ctx.fillStyle = currentPhase <= 1 ? "#00D9A5" : "rgba(255, 255, 255, 0.4)";
      ctx.font = "bold 8px monospace";
      ctx.textAlign = "center";
      ctx.fillText("PARTITIONER", partX + (partitionerWidth - sectionGap) / 2, topRowY + 12);

      // Mini partitioner visualization
      if (currentPhase <= 1) {
        const pCenterX = partX + (partitionerWidth - sectionGap) / 2;
        const pCenterY = resCenterY;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.fillStyle = SHARD_COLORS[i] + "60";
          ctx.arc(pCenterX - 12 + i * 12, pCenterY, 5, 0, Math.PI * 2);
          ctx.fill();
        }
        if (currentPhase === 1) {
          ctx.strokeStyle = "#00D9A5";
          ctx.lineWidth = 2;
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.moveTo(pCenterX - 18, pCenterY + Math.sin(timestamp / 200) * 8);
          ctx.lineTo(pCenterX + 18, pCenterY + Math.sin(timestamp / 200) * 8);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // === Shards: 2x2 Grid ===
      const shardCols = 2;
      const shardRows = 2;
      const shardGap = 6;
      const shardW = (width - padding * 2 - shardGap) / shardCols;
      const shardH = (shardAreaHeight - shardGap) / shardRows;

      shardsRef.current.forEach((shard, idx) => {
        const col = idx % shardCols;
        const row = Math.floor(idx / shardCols);
        shard.x = padding + col * (shardW + shardGap);
        shard.y = shardAreaY + row * (shardH + shardGap);
        shard.width = shardW;
        shard.height = shardH;

        const isActive = currentPhase >= 2;

        ctx.fillStyle = isActive ? shard.color + "15" : "rgba(255, 255, 255, 0.03)";
        ctx.beginPath();
        ctx.roundRect(shard.x, shard.y, shard.width, shard.height, 6);
        ctx.fill();
        ctx.strokeStyle = isActive ? shard.color + "60" : "rgba(255, 255, 255, 0.1)";
        ctx.lineWidth = isActive ? 2 : 1;
        ctx.stroke();

        // Label
        ctx.fillStyle = shard.color;
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "left";
        ctx.fillText(`S${idx}`, shard.x + 6, shard.y + 14);

        // Threads
        const threadWidth = (shard.width - 30) / shard.threads.length;
        const threadY = shard.y + 22;
        const threadH = shard.height - 30;

        shard.threads.forEach((thread, ti) => {
          const tx = shard.x + 24 + ti * threadWidth;
          ctx.fillStyle = thread.busy ? shard.color + "30" : "rgba(255, 255, 255, 0.03)";
          ctx.beginPath();
          ctx.roundRect(tx, threadY, threadWidth - 3, threadH, 3);
          ctx.fill();

          if (thread.busy && thread.progress > 0) {
            ctx.fillStyle = shard.color;
            const progressH = threadH * Math.min(thread.progress, 1);
            ctx.fillRect(tx + 2, threadY + threadH - progressH, threadWidth - 7, progressH);
          }

          if (thread.busy) {
            thread.progress += 0.04;
            if (thread.progress >= 1) {
              thread.busy = false;
              thread.txId = null;
              thread.progress = 0;
            }
          }
        });

        // Load indicator
        shard.load = shard.threads.filter(t => t.busy).length / shard.threads.length;
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
        ctx.fillRect(shard.x + 6, shard.y + shard.height - 8, 14, 3);
        ctx.fillStyle = shard.color;
        ctx.fillRect(shard.x + 6, shard.y + shard.height - 8, 14 * shard.load, 3);
      });

      // === Phase Bar ===
      const phaseWidth = (width - padding * 2 - 6) / 4;
      PHASES.forEach((phase, i) => {
        const px = padding + i * (phaseWidth + 2);
        const isActive = currentPhase === i;
        const isPast = currentPhase > i;

        ctx.fillStyle = isActive ?
          (i === 0 ? "#8B5CF6" : i === 1 ? "#00D9A5" : i === 2 ? "#F59E0B" : "#3B82F6") :
          isPast ? "rgba(255, 255, 255, 0.15)" : "rgba(255, 255, 255, 0.05)";
        ctx.beginPath();
        ctx.roundRect(px, phaseBarY, phaseWidth, 24, 4);
        ctx.fill();

        ctx.fillStyle = isActive ? "#fff" : "rgba(255, 255, 255, 0.4)";
        ctx.font = isActive ? "bold 8px monospace" : "7px monospace";
        ctx.textAlign = "center";
        ctx.fillText(phase.name.slice(0, 5), px + phaseWidth / 2, phaseBarY + 10);

        if (isActive) {
          const progress = phaseTimerRef.current / 90;
          ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
          ctx.fillRect(px + 3, phaseBarY + 17, (phaseWidth - 6) * progress, 3);
        }
      });

      // === Draw Transactions ===
      updateAndDrawTransactions(ctx, width, height, timestamp, true);
    };

    // ========== DESKTOP LAYOUT ==========
    const renderDesktop = (ctx: CanvasRenderingContext2D, width: number, height: number, timestamp: number) => {
      // Title
      ctx.fillStyle = "#8B5CF6";
      ctx.font = "bold 12px system-ui";
      ctx.textAlign = "left";
      ctx.fillText("SHARDINES: EXECUTION SHARDING", 20, 25);

      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.font = "9px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`4 Shards · ${stats.crossShardPct.toFixed(1)}% cross-shard`, width - 20, 25);

      // Layout calculations
      const resourceAreaX = 20;
      const resourceAreaWidth = width * 0.22;
      const partitionerX = resourceAreaX + resourceAreaWidth + 12;
      const partitionerWidth = 45;
      const shardAreaX = partitionerX + partitionerWidth + 12;
      const shardAreaWidth = width * 0.40;
      const mergeX = shardAreaX + shardAreaWidth + 12;
      const mergeWidth = width - mergeX - 15;

      const contentTop = 50;
      const contentHeight = height - 100;
      const phaseBarY = height - 40;

      // === Resource Graph ===
      ctx.fillStyle = currentPhase === 0 ? "rgba(139, 92, 246, 0.08)" : "rgba(255, 255, 255, 0.02)";
      ctx.beginPath();
      ctx.roundRect(resourceAreaX, contentTop, resourceAreaWidth, contentHeight, 8);
      ctx.fill();
      ctx.strokeStyle = currentPhase === 0 ? "#8B5CF680" : "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = currentPhase === 0 ? 2 : 1;
      ctx.stroke();

      ctx.fillStyle = currentPhase === 0 ? "#8B5CF6" : "rgba(255, 255, 255, 0.4)";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.fillText("RESOURCE GRAPH", resourceAreaX + resourceAreaWidth / 2, contentTop + 15);

      // Draw resources in circle
      const resCenterX = resourceAreaX + resourceAreaWidth / 2;
      const resCenterY = contentTop + contentHeight / 2;
      const resRadius = Math.min(resourceAreaWidth, contentHeight - 60) * 0.32;

      resourcesRef.current.forEach((res, i) => {
        const angle = (i / resourcesRef.current.length) * Math.PI * 2 - Math.PI / 2;
        res.x = resCenterX + Math.cos(angle) * resRadius;
        res.y = resCenterY + Math.sin(angle) * resRadius;

        const nodeSize = 16 + res.accessCount * 2;
        ctx.beginPath();
        ctx.fillStyle = res.color + "30";
        ctx.arc(res.x, res.y, nodeSize, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = res.color;
        ctx.arc(res.x, res.y, nodeSize - 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#fff";
        ctx.font = "bold 7px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(res.name, res.x, res.y);

        res.accessCount = Math.max(0, res.accessCount - 0.02);
      });

      // === Partitioner ===
      ctx.fillStyle = currentPhase <= 1 ? "rgba(0, 217, 165, 0.1)" : "rgba(255, 255, 255, 0.02)";
      ctx.beginPath();
      ctx.roundRect(partitionerX, contentTop, partitionerWidth, contentHeight, 8);
      ctx.fill();
      ctx.strokeStyle = currentPhase <= 1 ? "#00D9A580" : "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = currentPhase <= 1 ? 2 : 1;
      ctx.stroke();

      ctx.save();
      ctx.translate(partitionerX + partitionerWidth / 2, contentTop + contentHeight / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = currentPhase <= 1 ? "#00D9A5" : "rgba(255, 255, 255, 0.4)";
      ctx.font = "bold 8px monospace";
      ctx.textAlign = "center";
      ctx.fillText("PARTITIONER", 0, 0);
      ctx.restore();

      if (currentPhase <= 1) {
        const pCenterY = contentTop + contentHeight / 2;
        for (let i = 0; i < 3; i++) {
          const py = pCenterY - 20 + i * 20;
          ctx.beginPath();
          ctx.fillStyle = SHARD_COLORS[i] + "60";
          ctx.arc(partitionerX + partitionerWidth / 2, py, 5, 0, Math.PI * 2);
          ctx.fill();
        }
        if (currentPhase === 1) {
          const cutY = pCenterY + Math.sin(timestamp / 200) * 15;
          ctx.strokeStyle = "#00D9A5";
          ctx.lineWidth = 2;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(partitionerX + 5, cutY);
          ctx.lineTo(partitionerX + partitionerWidth - 5, cutY);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // === Shards ===
      const shardHeight = (contentHeight - 24) / 4;

      shardsRef.current.forEach((shard, idx) => {
        shard.x = shardAreaX;
        shard.y = contentTop + idx * (shardHeight + 8);
        shard.width = shardAreaWidth;
        shard.height = shardHeight;

        const isActive = currentPhase >= 2;

        ctx.fillStyle = isActive ? shard.color + "15" : "rgba(255, 255, 255, 0.03)";
        ctx.beginPath();
        ctx.roundRect(shard.x, shard.y, shard.width, shard.height, 6);
        ctx.fill();
        ctx.strokeStyle = isActive ? shard.color + "60" : "rgba(255, 255, 255, 0.1)";
        ctx.lineWidth = isActive ? 2 : 1;
        ctx.stroke();

        ctx.fillStyle = shard.color;
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "left";
        ctx.fillText(`SHARD ${idx}`, shard.x + 8, shard.y + 14);

        // Threads
        const threadWidth = (shard.width - 70) / shard.threads.length;
        const threadY = shard.y + 20;
        const threadH = shard.height - 28;

        shard.threads.forEach((thread, ti) => {
          const tx = shard.x + 55 + ti * threadWidth;
          ctx.fillStyle = thread.busy ? shard.color + "30" : "rgba(255, 255, 255, 0.03)";
          ctx.beginPath();
          ctx.roundRect(tx, threadY, threadWidth - 4, threadH, 3);
          ctx.fill();

          ctx.fillStyle = thread.busy ? "#fff" : "rgba(255, 255, 255, 0.3)";
          ctx.font = "7px monospace";
          ctx.textAlign = "center";
          ctx.fillText(`T${ti}`, tx + (threadWidth - 4) / 2, threadY + 10);

          if (thread.busy && thread.progress > 0) {
            ctx.fillStyle = shard.color;
            const progressH = (threadH - 15) * Math.min(thread.progress, 1);
            ctx.fillRect(tx + 3, threadY + threadH - progressH - 2, threadWidth - 10, progressH);
          }

          if (thread.busy) {
            thread.progress += 0.03;
            if (thread.progress >= 1) {
              thread.busy = false;
              thread.txId = null;
              thread.progress = 0;
            }
          }
        });

        shard.load = shard.threads.filter(t => t.busy).length / shard.threads.length;
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
        ctx.fillRect(shard.x + 8, shard.y + shard.height - 8, 35, 4);
        ctx.fillStyle = shard.color;
        ctx.fillRect(shard.x + 8, shard.y + shard.height - 8, 35 * shard.load, 4);
      });

      // === Merge Zone ===
      ctx.fillStyle = currentPhase === 3 ? "rgba(59, 130, 246, 0.1)" : "rgba(255, 255, 255, 0.02)";
      ctx.beginPath();
      ctx.roundRect(mergeX, contentTop, mergeWidth, contentHeight, 8);
      ctx.fill();
      ctx.strokeStyle = currentPhase === 3 ? "#3B82F680" : "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = currentPhase === 3 ? 2 : 1;
      ctx.stroke();

      ctx.save();
      ctx.translate(mergeX + mergeWidth / 2, contentTop + contentHeight / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = currentPhase === 3 ? "#3B82F6" : "rgba(255, 255, 255, 0.4)";
      ctx.font = "bold 8px monospace";
      ctx.textAlign = "center";
      ctx.fillText("STATE MERGE", 0, 0);
      ctx.restore();

      if (currentPhase === 3) {
        const mergedCount = transactionsRef.current.filter(t => t.phase === "done").length;
        ctx.fillStyle = "#3B82F6";
        ctx.font = "bold 18px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`${mergedCount}`, mergeX + mergeWidth / 2, contentTop + contentHeight / 2 - 5);
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.font = "7px monospace";
        ctx.fillText("MERGED", mergeX + mergeWidth / 2, contentTop + contentHeight / 2 + 10);
      }

      // === Phase Bar ===
      const phaseWidth = (width - 40) / 4;
      PHASES.forEach((phase, i) => {
        const px = 20 + i * phaseWidth;
        const isActive = currentPhase === i;
        const isPast = currentPhase > i;

        ctx.fillStyle = isActive ?
          (i === 0 ? "#8B5CF6" : i === 1 ? "#00D9A5" : i === 2 ? "#F59E0B" : "#3B82F6") :
          isPast ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.05)";
        ctx.beginPath();
        ctx.roundRect(px, phaseBarY, phaseWidth - 4, 28, 4);
        ctx.fill();

        ctx.fillStyle = isActive ? "#fff" : "rgba(255, 255, 255, 0.4)";
        ctx.font = isActive ? "bold 9px monospace" : "8px monospace";
        ctx.textAlign = "center";
        ctx.fillText(phase.name, px + phaseWidth / 2 - 2, phaseBarY + 12);

        if (isActive) {
          const progress = phaseTimerRef.current / 90;
          ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
          ctx.fillRect(px + 4, phaseBarY + 20, (phaseWidth - 12) * progress, 4);
        }
      });

      // === Draw Transactions ===
      updateAndDrawTransactions(ctx, width, height, timestamp, false);
    };

    // ========== TRANSACTION UPDATE/DRAW ==========
    const updateAndDrawTransactions = (ctx: CanvasRenderingContext2D, width: number, height: number, timestamp: number, mobile: boolean) => {
      const resCenterX = mobile ? width * 0.3 : 20 + width * 0.11;
      const resCenterY = mobile ? 70 : height / 2;
      const partCenterX = mobile ? width * 0.8 : 20 + width * 0.22 + 35;
      const mergeCenterX = mobile ? width / 2 : width - 40;

      transactionsRef.current.forEach(tx => {
        // Phase transitions
        if (currentPhase === 0 && tx.phase === "incoming") {
          tx.phase = "partitioning";
          tx.resources.forEach(rid => {
            if (resourcesRef.current[rid]) {
              resourcesRef.current[rid].accessCount += 1;
            }
          });
        } else if (currentPhase === 1 && tx.phase === "partitioning") {
          tx.phase = "assigned";
        } else if (currentPhase === 2 && tx.phase === "assigned") {
          tx.phase = "executing";
          const shard = shardsRef.current[tx.targetShard];
          const freeThread = shard?.threads.find(t => !t.busy);
          if (freeThread) {
            freeThread.busy = true;
            freeThread.txId = tx.id;
            freeThread.progress = 0;
          }
        } else if (currentPhase === 3 && tx.phase === "executing") {
          tx.phase = "merging";
        } else if (tx.phase === "merging") {
          tx.progress += 0.03;
          if (tx.progress >= 1) {
            tx.phase = "done";
          }
        }

        // Calculate target position
        let targetX = tx.x, targetY = tx.y;

        if (tx.phase === "incoming" || tx.phase === "partitioning") {
          targetX = resCenterX;
          targetY = resCenterY;
        } else if (tx.phase === "assigned") {
          const shard = shardsRef.current[tx.targetShard];
          targetX = partCenterX;
          targetY = shard ? shard.y + shard.height / 2 : height / 2;
        } else if (tx.phase === "executing") {
          const shard = shardsRef.current[tx.targetShard];
          if (shard) {
            targetX = shard.x + shard.width / 2;
            targetY = shard.y + shard.height / 2;
          }
        } else if (tx.phase === "merging" || tx.phase === "done") {
          targetX = mergeCenterX;
          targetY = mobile ? height - 80 : height / 2;
        }

        tx.x += (targetX - tx.x) * 0.08;
        tx.y += (targetY - tx.y) * 0.08;

        // Draw
        if (tx.phase !== "done") {
          const size = mobile ? 4 : (tx.phase === "executing" ? 6 : 5);

          ctx.beginPath();
          const gradient = ctx.createRadialGradient(tx.x, tx.y, 0, tx.x, tx.y, size * 2);
          gradient.addColorStop(0, tx.color + "80");
          gradient.addColorStop(1, "transparent");
          ctx.fillStyle = gradient;
          ctx.arc(tx.x, tx.y, size * 2, 0, Math.PI * 2);
          ctx.fill();

          ctx.beginPath();
          ctx.fillStyle = tx.isCrossShard ? "#EC4899" : tx.color;
          ctx.arc(tx.x, tx.y, size, 0, Math.PI * 2);
          ctx.fill();

          if (tx.isCrossShard && !mobile) {
            ctx.fillStyle = "#fff";
            ctx.font = "bold 5px monospace";
            ctx.textAlign = "center";
            ctx.fillText("X", tx.x, tx.y + 2);
          }
        }
      });

      // Cross-shard connections (desktop only)
      if (!mobile && currentPhase >= 2) {
        const crossShardTxs = transactionsRef.current.filter(t => t.isCrossShard && t.phase === "executing");
        crossShardTxs.forEach(tx => {
          const sourceShard = shardsRef.current[tx.targetShard];
          const destShard = shardsRef.current[(tx.targetShard + 1) % shardsRef.current.length];
          if (sourceShard && destShard) {
            ctx.strokeStyle = "#EC489940";
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(sourceShard.x + sourceShard.width - 8, sourceShard.y + sourceShard.height / 2);
            ctx.quadraticCurveTo(
              sourceShard.x + sourceShard.width + 15,
              (sourceShard.y + destShard.y) / 2 + sourceShard.height / 2,
              destShard.x + destShard.width - 8,
              destShard.y + destShard.height / 2
            );
            ctx.stroke();
            ctx.setLineDash([]);
          }
        });
      }
    };

    animationRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationRef.current);
  }, [currentPhase, isVisible, stats.crossShardPct]);

  return (
    <div ref={containerRef} className="chrome-card p-3 sm:p-4">
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <div>
          <h3 className="section-title text-sm sm:text-base">Shardines: Parallel Execution</h3>
          <p className="text-[10px] sm:text-xs" style={{ color: "var(--chrome-600)" }}>
            {isMobile ? "Horizontal scaling" : "Hypergraph partitioning for horizontal scalability"}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs font-mono">
          <span style={{ color: "#00D9A5", fontWeight: "bold" }}>
            {Math.round(stats.totalTps / 1000)}k TPS
          </span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full rounded"
        style={{ height: isMobile ? "320px" : "360px" }}
      />

      {/* Phase explanation - simplified on mobile */}
      <div className="mt-3 sm:mt-4 p-2 sm:p-3 rounded-lg bg-white/5 border border-white/10">
        <div className="flex items-center gap-2 mb-1 sm:mb-2">
          <span
            className="px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold"
            style={{
              backgroundColor: currentPhase === 0 ? "#8B5CF6" :
                               currentPhase === 1 ? "#00D9A5" :
                               currentPhase === 2 ? "#F59E0B" : "#3B82F6",
              color: "#000"
            }}
          >
            {PHASES[currentPhase].name}
          </span>
          <span className="text-xs sm:text-sm font-bold" style={{
            color: currentPhase === 0 ? "#8B5CF6" :
                   currentPhase === 1 ? "#00D9A5" :
                   currentPhase === 2 ? "#F59E0B" : "#3B82F6"
          }}>
            {PHASES[currentPhase].title}
          </span>
        </div>

        <p className="text-[10px] sm:text-xs" style={{ color: "var(--chrome-400)" }}>
          {PHASES[currentPhase].desc}
        </p>

        {!isMobile && (
          <p className="text-xs font-mono mt-1" style={{ color: "var(--chrome-600)" }}>
            {PHASES[currentPhase].detail}
          </p>
        )}
      </div>

      {/* Key stats - smaller on mobile */}
      <div className="mt-2 sm:mt-3 grid grid-cols-4 gap-1 sm:gap-2">
        {[
          { label: "Shards", value: "4", color: "#8B5CF6" },
          { label: "Threads", value: isMobile ? "2" : "4", color: "#F59E0B" },
          { label: "X-shard", value: `<5%`, color: "#EC4899" },
          { label: "Peak", value: "1M+", color: "#00D9A5" },
        ].map((stat) => (
          <div key={stat.label} className="p-1.5 sm:p-2 rounded bg-white/5 text-center">
            <div className="text-sm sm:text-lg font-bold font-mono" style={{ color: stat.color }}>
              {stat.value}
            </div>
            <div className="text-[8px] sm:text-[9px]" style={{ color: "var(--chrome-600)" }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
