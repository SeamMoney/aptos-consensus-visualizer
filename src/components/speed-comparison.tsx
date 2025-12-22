"use client";

import { useEffect, useRef, useCallback } from "react";

interface Chain {
  name: string;
  blockTime: number;
  color: string;
  progress: number;
  blocks: number;
}

export function SpeedComparison() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chainsRef = useRef<Chain[]>([
    { name: "Aptos", blockTime: 94, color: "#00D9A5", progress: 0, blocks: 0 },
    { name: "Solana", blockTime: 400, color: "#71717a", progress: 0, blocks: 0 },
    { name: "Ethereum", blockTime: 12000, color: "#52525b", progress: 0, blocks: 0 },
  ]);
  const animationRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(Date.now());

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

    const now = Date.now();
    const deltaTime = now - lastUpdateRef.current;
    lastUpdateRef.current = now;

    // Clear
    ctx.fillStyle = "#222225";
    ctx.fillRect(0, 0, width, height);

    const rowHeight = height / chainsRef.current.length;
    const trackPadding = 16;
    const trackWidth = width - trackPadding * 2;

    chainsRef.current.forEach((chain, i) => {
      const y = i * rowHeight;
      const trackY = y + rowHeight / 2;

      // Update progress
      chain.progress += deltaTime / chain.blockTime;
      if (chain.progress >= 1) {
        chain.blocks += Math.floor(chain.progress);
        chain.progress = chain.progress % 1;
      }

      // Track background
      ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
      ctx.beginPath();
      ctx.roundRect(trackPadding, trackY - 4, trackWidth, 8, 4);
      ctx.fill();

      // Progress bar
      const barWidth = chain.progress * trackWidth;
      if (barWidth > 0) {
        ctx.fillStyle = chain.color;
        ctx.beginPath();
        ctx.roundRect(trackPadding, trackY - 4, Math.max(8, barWidth), 8, 4);
        ctx.fill();

        // Glow effect for Aptos
        if (i === 0) {
          ctx.shadowColor = chain.color;
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      // Pulse at the head
      if (barWidth > 8) {
        const pulseAlpha = 0.3 + Math.sin(now * 0.01) * 0.2;
        ctx.fillStyle = `rgba(255, 255, 255, ${pulseAlpha})`;
        ctx.beginPath();
        ctx.arc(trackPadding + barWidth, trackY, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    animationRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const canvas = document.createElement("canvas");
    canvas.style.display = "block";
    container.appendChild(canvas);
    canvasRef.current = canvas;

    animationRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationRef.current);
      if (canvasRef.current && container.contains(canvasRef.current)) {
        container.removeChild(canvasRef.current);
      }
    };
  }, [draw]);

  const formatTime = (ms: number) => {
    if (ms >= 1000) return (ms / 1000).toFixed(1) + "s";
    return ms + "ms";
  };

  return (
    <div className="chrome-card p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-title">Block Production Speed</h3>
        <span className="section-subtitle">Real-time comparison</span>
      </div>

      {/* Labels */}
      <div className="space-y-2 mb-3">
        {chainsRef.current.map((chain, i) => (
          <div key={chain.name} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: chain.color }}
              />
              <span style={{ color: i === 0 ? "var(--chrome-100)" : "var(--chrome-500)" }}>
                {chain.name}
              </span>
            </div>
            <span
              className="font-mono text-xs"
              style={{ color: chain.color }}
            >
              {formatTime(chain.blockTime)}
            </span>
          </div>
        ))}
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="canvas-wrap"
        style={{ height: "90px" }}
      />

      {/* Comparison stats */}
      <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="stat-value stat-value-accent text-xl">
              {Math.round(400 / 94)}x
            </div>
            <div className="stat-label">faster than Solana</div>
          </div>
          <div>
            <div className="stat-value stat-value-accent text-xl">
              {Math.round(12000 / 94)}x
            </div>
            <div className="stat-label">faster than Ethereum</div>
          </div>
        </div>
      </div>
    </div>
  );
}
