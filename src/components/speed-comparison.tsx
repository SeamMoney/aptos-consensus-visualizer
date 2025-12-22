"use client";

import { useEffect, useRef, useState } from "react";

interface Chain {
  name: string;
  blockTime: number;
  color: string;
  colorDim: string;
  blocks: number[];
  totalBlocks: number;
}

const BLOCKS_PER_ROW = 60;

export function SpeedComparison() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(Date.now());
  const progressRef = useRef<number[]>([0, 0, 0]);

  const chainsRef = useRef<Chain[]>([
    {
      name: "Aptos",
      blockTime: 94,
      color: "#00D9A5",
      colorDim: "#004d3a",
      blocks: Array(BLOCKS_PER_ROW).fill(0),
      totalBlocks: 0
    },
    {
      name: "Solana",
      blockTime: 400,
      color: "#9945FF",
      colorDim: "#3d1a66",
      blocks: Array(BLOCKS_PER_ROW).fill(0),
      totalBlocks: 0
    },
    {
      name: "Ethereum",
      blockTime: 12000,
      color: "#627EEA",
      colorDim: "#1a2040",
      blocks: Array(BLOCKS_PER_ROW).fill(0),
      totalBlocks: 0
    },
  ]);

  const [blockCounts, setBlockCounts] = useState([0, 0, 0]);
  const lastCountUpdateRef = useRef<number>(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

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
      const deltaTime = now - lastUpdateRef.current;
      lastUpdateRef.current = now;

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

      const rowHeight = height / 3;
      const padding = 8;
      const blockGap = 2;
      const blockWidth = (width - padding * 2 - blockGap * (BLOCKS_PER_ROW - 1)) / BLOCKS_PER_ROW;
      const blockHeight = rowHeight - 16;

      chainsRef.current.forEach((chain, chainIdx) => {
        // Update progress based on block time
        progressRef.current[chainIdx] += deltaTime / chain.blockTime;

        if (progressRef.current[chainIdx] >= 1) {
          const newBlocks = Math.floor(progressRef.current[chainIdx]);
          progressRef.current[chainIdx] = progressRef.current[chainIdx] % 1;

          // Add new blocks (shift left, add to right)
          for (let b = 0; b < newBlocks; b++) {
            chain.blocks.shift();
            chain.blocks.push(now + b);
            chain.totalBlocks++;
          }
        }

        const y = chainIdx * rowHeight + 8;

        // Draw block slots
        for (let i = 0; i < BLOCKS_PER_ROW; i++) {
          const x = padding + i * (blockWidth + blockGap);
          const blockTime = chain.blocks[i];

          if (blockTime > 0) {
            // Filled block
            const age = (now - blockTime) / 1000;
            let alpha = 1;
            if (age > 2) {
              alpha = Math.max(0.3, 1 - (age - 2) / 4);
            }

            ctx.globalAlpha = alpha;
            ctx.fillStyle = chain.color;
            ctx.fillRect(x, y, blockWidth, blockHeight);

            // Glow on newest blocks (rightmost)
            if (i >= BLOCKS_PER_ROW - 3 && age < 0.3) {
              ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
              ctx.fillRect(x, y, blockWidth, blockHeight);
            }
          } else {
            // Empty slot
            ctx.globalAlpha = 0.15;
            ctx.fillStyle = chain.colorDim;
            ctx.fillRect(x, y, blockWidth, blockHeight);
          }
        }

        ctx.globalAlpha = 1;

        // Draw progress indicator on the right edge
        const progressWidth = blockWidth * progressRef.current[chainIdx];
        if (progressWidth > 0) {
          ctx.fillStyle = chain.color;
          ctx.globalAlpha = 0.5;
          ctx.fillRect(width - padding - blockWidth + progressWidth, y, blockWidth - progressWidth, blockHeight);
          ctx.globalAlpha = 1;
        }
      });

      // Update counts periodically
      if (now - lastCountUpdateRef.current > 300) {
        lastCountUpdateRef.current = now;
        setBlockCounts(chainsRef.current.map(c => c.totalBlocks));
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationRef.current);
      if (canvasRef.current && container.contains(canvasRef.current)) {
        container.removeChild(canvasRef.current);
      }
    };
  }, []);

  const formatTime = (ms: number) => {
    if (ms >= 1000) return (ms / 1000).toFixed(1) + "s";
    return ms + "ms";
  };

  return (
    <div className="chrome-card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="section-title">Block Race</h3>
        <div className="live-badge">
          <span className="live-dot" />
          Live
        </div>
      </div>

      {/* Chain labels with block counts */}
      <div className="space-y-1 mb-3">
        {chainsRef.current.map((chain, i) => (
          <div key={chain.name} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-sm"
                style={{ background: chain.color }}
              />
              <span style={{ color: i === 0 ? "var(--chrome-100)" : "var(--chrome-500)" }}>
                {chain.name}
              </span>
              <span className="text-xs tabular-nums" style={{ color: "var(--chrome-600)" }}>
                {formatTime(chain.blockTime)}
              </span>
            </div>
            <span
              className="font-mono text-xs tabular-nums"
              style={{ color: chain.color }}
            >
              {blockCounts[i].toLocaleString()} blocks
            </span>
          </div>
        ))}
      </div>

      {/* Canvas with discrete blocks */}
      <div
        ref={containerRef}
        className="canvas-wrap"
        style={{ height: "120px" }}
      />

      {/* Comparison stats */}
      <div className="mt-4 pt-3 border-t" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="stat-value stat-value-accent text-lg tabular-nums">
              {Math.round(400 / 94)}x
            </div>
            <div className="stat-label">faster than Solana</div>
          </div>
          <div>
            <div className="stat-value stat-value-accent text-lg tabular-nums">
              {Math.round(12000 / 94)}x
            </div>
            <div className="stat-label">faster than Ethereum</div>
          </div>
        </div>
      </div>
    </div>
  );
}
