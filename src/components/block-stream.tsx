"use client";

import { useEffect, useRef, useState } from "react";
import { useAptosStream, BlockStats } from "@/hooks/useAptosStream";

interface GridBlock {
  blockHeight: number;
  timestamp: number;
  txCount: number;
}

// Color based on transaction count - more granular gradient
function getBlockColor(txCount: number): string {
  if (txCount === 0) return "#1e1e22";
  if (txCount === 1) return "#1a3020";
  if (txCount <= 3) return "#1a3d2a";
  if (txCount <= 5) return "#1a4530";
  if (txCount <= 10) return "#1a4d3a";
  if (txCount <= 20) return "#00704a";
  if (txCount <= 30) return "#00875a";
  if (txCount <= 50) return "#00a86b";
  if (txCount <= 80) return "#00c77b";
  if (txCount <= 120) return "#00d98a";
  return "#00f5a0"; // Bright for 120+ tx
}

// Get text color that contrasts with block color
function getTextColor(txCount: number): string {
  if (txCount <= 10) return "rgba(255, 255, 255, 0.5)";
  return "rgba(0, 0, 0, 0.7)";
}

export function BlockStream() {
  const { stats, connected } = useAptosStream();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gridRef = useRef<GridBlock[][]>([]);
  const animationRef = useRef<number>(0);
  const lastBlockHeightRef = useRef<number>(0);
  const gridIndexRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0, y: 0 });
  const [hoveredBlock, setHoveredBlock] = useState<GridBlock | null>(null);

  const COLS = 50;
  const ROWS = 8;

  // Initialize grid
  useEffect(() => {
    for (let r = 0; r < ROWS; r++) {
      gridRef.current[r] = [];
      for (let c = 0; c < COLS; c++) {
        gridRef.current[r][c] = { blockHeight: 0, timestamp: 0, txCount: 0 };
      }
    }
  }, []);

  // Handle new blocks from stream
  useEffect(() => {
    if (stats.recentBlocks.length === 0) return;

    // Find new blocks we haven't processed yet
    const newBlocks = stats.recentBlocks.filter(
      (b) => b.blockHeight > lastBlockHeightRef.current
    );

    if (newBlocks.length === 0) return;

    // Update last seen block height
    lastBlockHeightRef.current = Math.max(...newBlocks.map((b) => b.blockHeight));

    // Add new blocks to grid (oldest first)
    const sortedBlocks = [...newBlocks].sort((a, b) => a.blockHeight - b.blockHeight);

    for (const block of sortedBlocks) {
      const row = gridIndexRef.current % ROWS;
      const col = Math.floor(gridIndexRef.current / ROWS) % COLS;

      gridRef.current[row][col] = {
        blockHeight: block.blockHeight,
        timestamp: Date.now(),
        txCount: block.txCount,
      };

      gridIndexRef.current = (gridIndexRef.current + 1) % (ROWS * COLS);
    }
  }, [stats.recentBlocks]);

  // Canvas rendering
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const canvas = document.createElement("canvas");
    canvas.style.display = "block";
    canvas.style.cursor = "crosshair";
    container.appendChild(canvas);
    canvasRef.current = canvas;

    // Mouse tracking for hover
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };
    canvas.addEventListener("mousemove", handleMouseMove);

    let lastResize = 0;
    let lastFrame = 0;
    const targetFPS = 24;
    const frameInterval = 1000 / targetFPS;

    const draw = (timestamp: number) => {
      if (!canvas || !container) return;

      if (timestamp - lastFrame < frameInterval) {
        animationRef.current = requestAnimationFrame(draw);
        return;
      }
      lastFrame = timestamp;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const now = Date.now();
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      if (now - lastResize > 200) {
        if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
          canvas.width = Math.floor(width * dpr);
          canvas.height = Math.floor(height * dpr);
          canvas.style.width = width + "px";
          canvas.style.height = height + "px";
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          lastResize = now;
        }
      }

      // Clear
      ctx.fillStyle = "#141416";
      ctx.fillRect(0, 0, width, height);

      const cellW = width / COLS;
      const cellH = height / ROWS;
      const gap = 1;

      // Find hovered cell
      const hoveredCol = Math.floor(mouseRef.current.x / cellW);
      const hoveredRow = Math.floor(mouseRef.current.y / cellH);
      let currentHovered: GridBlock | null = null;

      // Draw blocks
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const block = gridRef.current[r]?.[c];
          if (!block || block.timestamp === 0) {
            ctx.fillStyle = "#1a1a1d";
            ctx.fillRect(c * cellW + gap, r * cellH + gap, cellW - gap * 2, cellH - gap * 2);
            continue;
          }

          const x = c * cellW + gap;
          const y = r * cellH + gap;
          const w = cellW - gap * 2;
          const h = cellH - gap * 2;

          const isHovered = r === hoveredRow && c === hoveredCol;
          if (isHovered) currentHovered = block;

          // Block color based on tx count
          ctx.fillStyle = getBlockColor(block.txCount);
          ctx.fillRect(x, y, w, h);

          // Show tx count inside block if there's space
          if (w >= 12 && h >= 10 && block.txCount > 0) {
            ctx.fillStyle = getTextColor(block.txCount);
            ctx.font = `bold ${Math.min(9, h - 4)}px monospace`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(block.txCount), x + w / 2, y + h / 2);
          }

          // Highlight new blocks (< 2 seconds)
          const age = (now - block.timestamp) / 1000;
          if (age < 2) {
            const pulse = age < 0.5 ? 1 : 1 - (age - 0.5) / 1.5;
            ctx.strokeStyle = `rgba(0, 217, 165, ${pulse * 0.8})`;
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, w, h);

            if (age < 0.5) {
              ctx.shadowBlur = 8;
              ctx.shadowColor = "#00d9a5";
              ctx.strokeRect(x, y, w, h);
              ctx.shadowBlur = 0;
            }
          }

          // Hover highlight
          if (isHovered) {
            ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, w, h);
          }
        }
      }

      setHoveredBlock(currentHovered);
      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationRef.current);
      canvas.removeEventListener("mousemove", handleMouseMove);
      if (canvasRef.current && container.contains(canvasRef.current)) {
        container.removeChild(canvasRef.current);
      }
    };
  }, []);

  return (
    <div className="chrome-card p-4 sm:p-5 relative">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="section-title">Block River</h3>
          <div className={`live-badge ${!connected ? 'opacity-50' : ''}`}>
            <span className="live-dot" />
            {connected ? 'Live' : 'Connecting...'}
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm tabular-nums">
          <span style={{ color: "var(--chrome-500)" }}>
            TPS <span className="stat-value-accent">{stats.tps.toLocaleString()}</span>
          </span>
          <span style={{ color: "var(--chrome-500)" }}>
            Block <span style={{ color: "var(--chrome-200)" }}>{stats.blockHeight.toLocaleString()}</span>
          </span>
        </div>
      </div>

      <div
        ref={containerRef}
        className="canvas-wrap"
        style={{ height: "160px" }}
      />

      {/* Hover tooltip */}
      {hoveredBlock && hoveredBlock.blockHeight > 0 && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-black/95 border border-white/20 rounded-lg px-3 py-2 text-xs z-10 pointer-events-none">
          <div className="text-emerald-400 font-mono font-bold">
            Block #{hoveredBlock.blockHeight.toLocaleString()}
          </div>
          <div className="text-white/80 mt-1">
            <span className="text-emerald-400 font-bold">{hoveredBlock.txCount}</span> transactions
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mt-3 text-xs" style={{ color: "var(--chrome-500)" }}>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#1a4d3a" }} />
            1-10 tx
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#00875a" }} />
            10-30 tx
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#00c77b" }} />
            30-80 tx
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#00f5a0" }} />
            80+ tx
          </span>
        </div>
        <span style={{ color: "var(--chrome-600)" }}>
          ~{stats.avgBlockTime || 94}ms blocks
        </span>
      </div>
    </div>
  );
}
