"use client";

import { useEffect, useRef, useState } from "react";

interface Block {
  id: number;
  txCount: number;
  gasUsed: number;
  timestamp: number;
  opacity: number;
}

interface BlockRiverProps {
  className?: string;
}

// Color gradient based on transaction count
function getBlockColor(txCount: number): string {
  if (txCount === 0) return "#1a1a2e";
  if (txCount < 10) return "#06D6A0";
  if (txCount < 50) return "#4ecdc4";
  if (txCount < 100) return "#ffd700";
  if (txCount < 200) return "#ff9dc1";
  return "#ff428e";
}

export function BlockRiver({ className = "" }: BlockRiverProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const blocksRef = useRef<Block[][]>([]);
  const animationRef = useRef<number>(0);
  const blockIdRef = useRef(0);
  const columnIndexRef = useRef(0);
  const [stats, setStats] = useState({
    tps: 0,
    avgGas: 0,
    blockHeight: 0,
  });

  const ROWS = 10;
  const COLS = 100;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Initialize grid
    for (let i = 0; i < ROWS; i++) {
      blocksRef.current[i] = [];
      for (let j = 0; j < COLS; j++) {
        blocksRef.current[i][j] = {
          id: 0,
          txCount: 0,
          gasUsed: 0,
          timestamp: 0,
          opacity: 0,
        };
      }
    }

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Simulate new blocks arriving
    const blockInterval = setInterval(() => {
      const row = columnIndexRef.current % ROWS;
      const col = Math.floor(columnIndexRef.current / ROWS) % COLS;

      // Simulate realistic transaction counts (higher during "busy" periods)
      const busyPeriod = Math.sin(Date.now() / 5000) > 0.3;
      const txCount = busyPeriod
        ? Math.floor(Math.random() * 300)
        : Math.floor(Math.random() * 50);

      blocksRef.current[row][col] = {
        id: blockIdRef.current++,
        txCount,
        gasUsed: txCount * (1000 + Math.random() * 500),
        timestamp: Date.now(),
        opacity: 1,
      };

      columnIndexRef.current = (columnIndexRef.current + 1) % (ROWS * COLS);

      // Update stats
      setStats({
        tps: Math.floor(txCount / 0.094), // ~94ms block time
        avgGas: Math.floor(txCount * 1250),
        blockHeight: blockIdRef.current,
      });
    }, 94); // Aptos block time

    const animate = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.fillStyle = "#0a0a0f";
      ctx.fillRect(0, 0, rect.width, rect.height);

      const blockWidth = rect.width / COLS;
      const blockHeight = rect.height / ROWS;
      const padding = 1;
      const now = Date.now();

      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          const block = blocksRef.current[row][col];
          if (!block || block.timestamp === 0) continue;

          // Fade out over time
          const age = (now - block.timestamp) / 1000;
          const fadeStart = 5; // Start fading after 5 seconds
          const fadeDuration = 10; // Fade over 10 seconds

          let opacity = 1;
          if (age > fadeStart) {
            opacity = Math.max(0, 1 - (age - fadeStart) / fadeDuration);
          }

          if (opacity <= 0) continue;

          const x = col * blockWidth + padding;
          const y = row * blockHeight + padding;
          const w = blockWidth - padding * 2;
          const h = blockHeight - padding * 2;

          const color = getBlockColor(block.txCount);

          // Draw block with rounded corners
          ctx.beginPath();
          ctx.roundRect(x, y, w, h, 2);
          ctx.fillStyle = color + Math.floor(opacity * 255).toString(16).padStart(2, "0");
          ctx.fill();

          // Glow effect for high-activity blocks
          if (block.txCount > 100 && opacity > 0.5) {
            ctx.shadowColor = color;
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      clearInterval(blockInterval);
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <div className={`glass-card p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-white">Block River</h3>
          <div className="live-indicator">
            <div className="live-dot" />
            <span className="text-xs text-gray-400 uppercase tracking-wider">Live</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div>
            <span className="text-gray-500">TPS: </span>
            <span className="font-mono text-[#06D6A0]">{stats.tps.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-gray-500">Block: </span>
            <span className="font-mono text-white">{stats.blockHeight.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Canvas Visualization */}
      <div className="canvas-container" style={{ height: "200px" }}>
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "100%" }}
        />
      </div>

      {/* Color Legend */}
      <div className="flex justify-center gap-4 mt-4 flex-wrap">
        {[
          { label: "Empty", color: "#1a1a2e" },
          { label: "<10 tx", color: "#06D6A0" },
          { label: "<50 tx", color: "#4ecdc4" },
          { label: "<100 tx", color: "#ffd700" },
          { label: "<200 tx", color: "#ff9dc1" },
          { label: "200+ tx", color: "#ff428e" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-xs text-gray-500">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
