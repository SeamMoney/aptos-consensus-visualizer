"use client";

import { useEffect, useRef, useState } from "react";

interface Block {
  id: number;
  timestamp: number;
  txCount: number;
}

// Color based on transaction count (like miniblocks)
function getBlockColor(txCount: number): string {
  if (txCount === 0) return "#1e1e22";
  if (txCount < 20) return "#1a4d3a";
  if (txCount < 50) return "#00875a";
  if (txCount < 100) return "#00a86b";
  if (txCount < 150) return "#00c77b";
  return "#00d9a5";
}

export function BlockStream() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const blocksRef = useRef<Block[][]>([]);
  const blockIdRef = useRef(0);
  const colIndexRef = useRef(0);
  const animationRef = useRef<number>(0);
  const lastStatUpdateRef = useRef<number>(0);

  // Stable stats - only update every 500ms to prevent flickering
  const [stats, setStats] = useState({
    blockHeight: 0,
    tps: 1200,
  });

  const COLS = 50;
  const ROWS = 8;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Initialize grid
    for (let r = 0; r < ROWS; r++) {
      blocksRef.current[r] = [];
      for (let c = 0; c < COLS; c++) {
        blocksRef.current[r][c] = { id: 0, timestamp: 0, txCount: 0 };
      }
    }

    const canvas = document.createElement("canvas");
    canvas.style.display = "block";
    container.appendChild(canvas);
    canvasRef.current = canvas;

    let lastResize = 0;
    const draw = () => {
      if (!canvas || !container) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const now = Date.now();
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      // Only resize occasionally
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

      // Draw blocks
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const block = blocksRef.current[r]?.[c];
          if (!block || block.timestamp === 0) continue;

          const age = (now - block.timestamp) / 1000;
          let alpha = 1;
          if (age > 4) {
            alpha = Math.max(0.15, 1 - (age - 4) / 6);
          }

          const x = c * cellW + gap;
          const y = r * cellH + gap;
          const w = cellW - gap * 2;
          const h = cellH - gap * 2;

          ctx.globalAlpha = alpha;
          ctx.fillStyle = getBlockColor(block.txCount);
          ctx.fillRect(x, y, w, h);

          // Glow on new blocks
          if (age < 0.2) {
            ctx.fillStyle = "rgba(0, 217, 165, 0.4)";
            ctx.fillRect(x, y, w, h);
          }
        }
      }
      ctx.globalAlpha = 1;

      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);

    // Add blocks at Aptos block time
    const blockTimer = setInterval(() => {
      const row = colIndexRef.current % ROWS;
      const col = Math.floor(colIndexRef.current / ROWS) % COLS;

      // Varying tx counts
      const busy = Math.sin(Date.now() / 3000) > 0;
      const txCount = busy
        ? Math.floor(Math.random() * 180) + 20
        : Math.floor(Math.random() * 60) + 5;

      blocksRef.current[row][col] = {
        id: blockIdRef.current++,
        timestamp: Date.now(),
        txCount,
      };

      colIndexRef.current = (colIndexRef.current + 1) % (ROWS * COLS);

      // Update stats less frequently (every 500ms)
      const now = Date.now();
      if (now - lastStatUpdateRef.current > 500) {
        lastStatUpdateRef.current = now;
        setStats({
          blockHeight: blockIdRef.current,
          tps: Math.round(1000 + Math.random() * 400),
        });
      }
    }, 94);

    return () => {
      cancelAnimationFrame(animationRef.current);
      clearInterval(blockTimer);
      if (canvasRef.current && container.contains(canvasRef.current)) {
        container.removeChild(canvasRef.current);
      }
    };
  }, []);

  return (
    <div className="chrome-card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="section-title">Block River</h3>
          <div className="live-badge">
            <span className="live-dot" />
            Live
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

      <div className="flex items-center justify-center gap-4 mt-3 text-xs" style={{ color: "var(--chrome-500)" }}>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#1a4d3a" }} />
          Low
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#00a86b" }} />
          Med
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#00d9a5" }} />
          High
        </span>
      </div>
    </div>
  );
}
