"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface Block {
  id: number;
  timestamp: number;
  txCount: number;
}

interface BlockStreamProps {
  className?: string;
}

export function BlockStream({ className = "" }: BlockStreamProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const blocksRef = useRef<Block[]>([]);
  const blockIdRef = useRef(0);
  const animationRef = useRef<number>(0);

  const [stats, setStats] = useState({
    blockHeight: 0,
    avgBlockTime: 94,
    tps: 0,
  });

  const VISIBLE_BLOCKS = 60;
  const BLOCK_INTERVAL = 94; // Aptos block time in ms

  const draw = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.scale(dpr, dpr);
    }

    // Clear
    ctx.fillStyle = "#222225";
    ctx.fillRect(0, 0, width, height);

    const now = Date.now();
    const blockWidth = width / VISIBLE_BLOCKS;
    const padding = 2;
    const barWidth = blockWidth - padding * 2;

    // Draw blocks as bars from bottom
    blocksRef.current.forEach((block, i) => {
      const age = (now - block.timestamp) / 1000;
      const fadeStart = 3;
      const fadeDuration = 2;

      let alpha = 1;
      if (age > fadeStart) {
        alpha = Math.max(0.2, 1 - (age - fadeStart) / fadeDuration);
      }

      const x = i * blockWidth + padding;
      const maxBarHeight = height - 20;

      // Bar height based on tx count (normalized)
      const normalizedTx = Math.min(block.txCount / 200, 1);
      const barHeight = Math.max(4, normalizedTx * maxBarHeight);
      const y = height - 10 - barHeight;

      // Color based on activity - using single accent color with varying brightness
      const intensity = normalizedTx;
      const r = Math.round(0 + intensity * 0);
      const g = Math.round(180 + intensity * 37);
      const b = Math.round(140 + intensity * 25);

      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;

      // Rounded rectangle for each bar
      const radius = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, [radius, radius, 0, 0]);
      ctx.fill();

      // Subtle highlight on recent blocks
      if (age < 0.3) {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.2 * (1 - age / 0.3)})`;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, 2, radius);
        ctx.fill();
      }
    });

    // Draw baseline
    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    ctx.fillRect(0, height - 10, width, 1);

    animationRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const canvas = document.createElement("canvas");
    canvas.style.display = "block";
    container.appendChild(canvas);
    canvasRef.current = canvas;

    // Start animation
    animationRef.current = requestAnimationFrame(draw);

    // Simulate blocks arriving
    const blockTimer = setInterval(() => {
      const txCount = Math.floor(Math.random() * 200) + 10;
      const newBlock: Block = {
        id: blockIdRef.current++,
        timestamp: Date.now(),
        txCount,
      };

      blocksRef.current.push(newBlock);

      // Keep only visible blocks
      while (blocksRef.current.length > VISIBLE_BLOCKS) {
        blocksRef.current.shift();
      }

      // Update stats smoothly
      setStats((prev) => ({
        blockHeight: newBlock.id,
        avgBlockTime: Math.round(prev.avgBlockTime * 0.9 + (94 + (Math.random() - 0.5) * 10) * 0.1),
        tps: Math.round(txCount / 0.094),
      }));
    }, BLOCK_INTERVAL);

    return () => {
      cancelAnimationFrame(animationRef.current);
      clearInterval(blockTimer);
      if (canvasRef.current && container.contains(canvasRef.current)) {
        container.removeChild(canvasRef.current);
      }
    };
  }, [draw]);

  return (
    <div className={"chrome-card p-4 sm:p-6 " + className}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="section-title">Block Stream</h3>
          <div className="live-badge">
            <span className="live-dot" />
            Live
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs sm:text-sm">
          <div>
            <span style={{ color: "var(--chrome-500)" }}>Block </span>
            <span className="stat-value text-sm">{stats.blockHeight.toLocaleString()}</span>
          </div>
          <div>
            <span style={{ color: "var(--chrome-500)" }}>TPS </span>
            <span className="stat-value stat-value-accent text-sm">{stats.tps.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="canvas-wrap"
        style={{ height: "140px" }}
      />

      {/* Legend */}
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs" style={{ color: "var(--chrome-500)" }}>
          Transaction volume per block
        </span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm" style={{ background: "rgb(0, 180, 140)" }} />
            <span className="text-xs" style={{ color: "var(--chrome-500)" }}>Low</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm" style={{ background: "rgb(0, 217, 165)" }} />
            <span className="text-xs" style={{ color: "var(--chrome-500)" }}>High</span>
          </div>
        </div>
      </div>
    </div>
  );
}
