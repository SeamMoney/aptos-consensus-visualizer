"use client";

import { useRef, useEffect, memo } from "react";
import { useLatencyStorage } from "@/hooks/useLatencyStorage";
import { useVisibility } from "@/hooks/useVisibility";
import { useNetwork } from "@/contexts/NetworkContext";

interface LatencyChartProps {
  avgBlockTime: number;
}

export const LatencyChart = memo(function LatencyChart({ avgBlockTime }: LatencyChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const isVisible = useVisibility(containerRef);
  const { network } = useNetwork();

  const { dataPoints, currentLatency, currentP50, currentP95, stats } = useLatencyStorage(avgBlockTime, network);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastTime = 0;
    const targetFPS = 30; // Higher FPS for smooth real-time feel
    const frameInterval = 1000 / targetFPS;

    const render = (timestamp: number) => {
      // Skip rendering when off-screen
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

      // Chart area
      const chartLeft = 65;
      const chartRight = width - 20;
      const chartTop = 35;
      const chartBottom = height - 45;
      const chartWidth = chartRight - chartLeft;
      const chartHeight = chartBottom - chartTop;

      // Dynamic Y-axis based on data (with reasonable bounds)
      const allLatencies = dataPoints.map(p => p.e2eLatencyMs);
      const dataMin = allLatencies.length > 0 ? Math.min(...allLatencies) : 460;
      const dataMax = allLatencies.length > 0 ? Math.max(...allLatencies) : 500;
      const padding = Math.max(10, (dataMax - dataMin) * 0.2);
      const yMin = Math.floor((dataMin - padding) / 10) * 10;
      const yMax = Math.ceil((dataMax + padding) / 10) * 10;
      const yRange = Math.max(yMax - yMin, 40);

      // Smart step sizing - aim for 4-5 grid lines max
      const rawStep = yRange / 5;
      const stepOptions = [10, 20, 25, 50, 100];
      const yStep = stepOptions.find(s => s >= rawStep) || 50;

      // Draw grid lines (limited to ~5)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
      ctx.lineWidth = 1;

      const startVal = Math.ceil(yMin / yStep) * yStep;
      for (let value = startVal; value <= yMax; value += yStep) {
        const y = chartBottom - ((value - yMin) / yRange) * chartHeight;

        ctx.beginPath();
        ctx.moveTo(chartLeft, y);
        ctx.lineTo(chartRight, y);
        ctx.stroke();

        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.font = "10px monospace";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(`${value}`, chartLeft - 8, y);
      }

      // Draw line from data points
      if (dataPoints.length >= 2) {
        ctx.beginPath();
        ctx.strokeStyle = "#00D9A5";
        ctx.lineWidth = 1.5;

        for (let i = 0; i < dataPoints.length; i++) {
          const point = dataPoints[i];
          // Simple index-based X position
          const x = chartLeft + (i / (dataPoints.length - 1)) * chartWidth;
          // Clamp Y to visible range
          const clampedVal = Math.max(yMin, Math.min(yMax, point.e2eLatencyMs));
          const y = chartBottom - ((clampedVal - yMin) / yRange) * chartHeight;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.stroke();

        // Live current point with pulsing glow
        const cx = chartRight;
        const clampedLive = Math.max(yMin, Math.min(yMax, currentLatency));
        const cy = chartBottom - ((clampedLive - yMin) / yRange) * chartHeight;

        // Pulsing glow effect
        const pulse = Math.sin(timestamp / 300) * 0.3 + 0.7; // 0.4 to 1.0
        const glowRadius = 12 * pulse;

        // Outer glow
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
        gradient.addColorStop(0, `rgba(0, 217, 165, ${0.6 * pulse})`);
        gradient.addColorStop(1, "rgba(0, 217, 165, 0)");
        ctx.beginPath();
        ctx.fillStyle = gradient;
        ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // Solid center point
        ctx.beginPath();
        ctx.fillStyle = "#00D9A5";
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fill();

        // Live value label next to point
        ctx.fillStyle = "#00D9A5";
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "right";
        ctx.fillText(`${currentLatency}ms`, cx - 10, cy - 10);
      } else {
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        ctx.font = "12px monospace";
        ctx.textAlign = "center";
        ctx.fillText("Collecting latency data...", width / 2, height / 2);
      }

      // X-axis labels - show "Xm ago" format for real-time feel
      if (dataPoints.length > 0) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.font = "10px monospace";
        ctx.textAlign = "center";

        const now = Date.now();
        const oldest = dataPoints[0].timestamp;
        const minutesAgo = Math.round((now - oldest) / 60000);

        // Left label: oldest data point
        ctx.fillText(`${minutesAgo}m ago`, chartLeft + 30, chartBottom + 20);

        // Right label: "now" with live indicator
        ctx.fillStyle = "#00D9A5";
        ctx.fillText("now", chartRight - 20, chartBottom + 20);
      }

      // Title
      ctx.fillStyle = "#00D9A5";
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("E2E Latency with Finality (p50)", chartLeft, 20);

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);

    return () => cancelAnimationFrame(animationRef.current);
  }, [dataPoints, currentLatency, isVisible]);

  return (
    <div ref={containerRef} className="chrome-card p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-3">
        <div>
          <h3 className="section-title">E2E Latency with Finality</h3>
          <p className="text-xs" style={{ color: "var(--chrome-600)" }}>
            p50 median · {stats.count} samples · <span className="uppercase">{network}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-xs font-mono">
          <span style={{ color: "var(--chrome-500)" }}>
            p50: <span style={{ color: "#00D9A5" }}>{currentP50}ms</span>
          </span>
          <span style={{ color: "var(--chrome-500)" }}>
            p95: <span style={{ color: "#00D9A5" }}>{currentP95}ms</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="live-badge" style={{ width: 6, height: 6 }} />
            <span style={{ color: "#00D9A5", fontWeight: "bold" }}>
              {currentLatency}ms
            </span>
          </span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full rounded"
        style={{ height: "220px" }}
      />
    </div>
  );
});
