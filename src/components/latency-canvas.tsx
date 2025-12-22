"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import p5 from "p5";

interface LatencyCanvasProps {
  networkLatency?: number;
  processingTime?: number;
  clientLatency?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  phase: number;
  size: number;
  alpha: number;
}

export function LatencyCanvas({
  networkLatency = 94,
  processingTime = 2,
  clientLatency = 15,
}: LatencyCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>(0);

  const [displayStats, setDisplayStats] = useState({
    network: networkLatency,
    processing: processingTime,
    client: clientLatency,
    total: networkLatency + processingTime + clientLatency,
  });

  // Smooth number transitions
  const targetStatsRef = useRef(displayStats);
  useEffect(() => {
    targetStatsRef.current = {
      network: networkLatency,
      processing: processingTime,
      client: clientLatency,
      total: networkLatency + processingTime + clientLatency,
    };
  }, [networkLatency, processingTime, clientLatency]);

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

    // Resize canvas if needed
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.scale(dpr, dpr);
    }

    // Clear with slight fade for trail effect
    ctx.fillStyle = "rgba(34, 34, 37, 1)";
    ctx.fillRect(0, 0, width, height);

    const total = targetStatsRef.current.total || 111;
    const networkW = (targetStatsRef.current.network / total) * width;
    const processingW = (targetStatsRef.current.processing / total) * width;
    const clientW = (targetStatsRef.current.client / total) * width;

    // Draw subtle section dividers
    ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(networkW, 0);
    ctx.lineTo(networkW, height);
    ctx.moveTo(networkW + processingW, 0);
    ctx.lineTo(networkW + processingW, height);
    ctx.stroke();

    // Spawn new particles
    if (Math.random() < 0.15) {
      particlesRef.current.push({
        x: 0,
        y: height / 2 + (Math.random() - 0.5) * height * 0.4,
        vx: 1.5 + Math.random() * 0.5,
        phase: 0,
        size: 3 + Math.random() * 2,
        alpha: 1,
      });
    }

    // Update and draw particles
    const accent = { r: 0, g: 217, b: 165 };

    particlesRef.current = particlesRef.current.filter((p) => {
      p.x += p.vx;
      p.y += Math.sin(p.x * 0.015 + p.phase) * 0.3;

      // Determine phase color
      let color = accent;
      if (p.x < networkW) {
        p.phase = 0;
      } else if (p.x < networkW + processingW) {
        p.phase = 1;
        color = { r: 161, g: 161, b: 170 }; // Grey for processing
      } else {
        p.phase = 2;
      }

      // Fade out near edges
      if (p.x > width - 50) {
        p.alpha = Math.max(0, (width - p.x) / 50);
      }

      // Draw particle with glow
      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
      gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${p.alpha * 0.8})`);
      gradient.addColorStop(0.5, `rgba(${color.r}, ${color.g}, ${color.b}, ${p.alpha * 0.3})`);
      gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Core
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${p.alpha})`;
      ctx.fill();

      return p.x < width + 20 && p.alpha > 0;
    });

    // Smooth stat transitions
    setDisplayStats((prev) => ({
      network: Math.round(prev.network + (targetStatsRef.current.network - prev.network) * 0.1),
      processing: Math.round(prev.processing + (targetStatsRef.current.processing - prev.processing) * 0.1),
      client: Math.round(prev.client + (targetStatsRef.current.client - prev.client) * 0.1),
      total: Math.round(prev.total + (targetStatsRef.current.total - prev.total) * 0.1),
    }));

    animationRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Create canvas
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

  return (
    <div className="chrome-card p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-title">Latency Flow</h3>
        <div className="live-badge">
          <span className="live-dot" />
          Live
        </div>
      </div>

      {/* Stats row */}
      <div className="metric-grid grid-cols-4 mb-4">
        <div className="metric-cell">
          <div className="stat-value stat-value-accent text-base sm:text-lg">
            {displayStats.network}ms
          </div>
          <div className="stat-label">Network</div>
        </div>
        <div className="metric-cell">
          <div className="stat-value text-base sm:text-lg" style={{ color: "var(--chrome-400)" }}>
            {displayStats.processing}ms
          </div>
          <div className="stat-label">Processing</div>
        </div>
        <div className="metric-cell">
          <div className="stat-value stat-value-accent text-base sm:text-lg">
            {displayStats.client}ms
          </div>
          <div className="stat-label">Client</div>
        </div>
        <div className="metric-cell">
          <div className="stat-value text-base sm:text-lg">
            {displayStats.total}ms
          </div>
          <div className="stat-label">Total</div>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="canvas-wrap"
        style={{ height: "100px" }}
      />

      {/* Labels */}
      <div className="flex justify-between mt-3 text-xs" style={{ color: "var(--chrome-500)" }}>
        <span>Network</span>
        <span>Processing</span>
        <span>Client</span>
      </div>
    </div>
  );
}
