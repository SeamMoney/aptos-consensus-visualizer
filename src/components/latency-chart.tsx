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

      // Dynamic Y-axis with clean round numbers
      const allLatencies = dataPoints.map(p => p.e2eLatencyMs);
      const dataMin = allLatencies.length > 0 ? Math.min(...allLatencies) : 465;
      const dataMax = allLatencies.length > 0 ? Math.max(...allLatencies) : 475;

      // Calculate range and determine appropriate rounding unit
      const rawRange = dataMax - dataMin;
      const padding = Math.max(5, rawRange * 0.15);

      // Pick rounding unit based on range size (larger range = coarser rounding)
      const roundUnit = rawRange > 500 ? 100 : rawRange > 100 ? 50 : rawRange > 50 ? 10 : 5;
      const yMin = Math.floor((dataMin - padding) / roundUnit) * roundUnit;
      const yMax = Math.ceil((dataMax + padding) / roundUnit) * roundUnit;
      const yRange = Math.max(yMax - yMin, 20);

      // Step sizing - always aim for 4-5 grid lines max
      const stepOptions = [5, 10, 20, 50, 100, 200, 500, 1000, 2000];
      const rawStep = yRange / 4;
      const yStep = stepOptions.find(s => s >= rawStep) || Math.ceil(rawStep / 100) * 100;

      // Draw horizontal grid lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;

      const startVal = Math.ceil(yMin / yStep) * yStep;
      for (let value = startVal; value <= yMax; value += yStep) {
        const y = chartBottom - ((value - yMin) / yRange) * chartHeight;

        ctx.beginPath();
        ctx.moveTo(chartLeft, y);
        ctx.lineTo(chartRight, y);
        ctx.stroke();

        // Y-axis labels with "ms" suffix
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.font = "10px monospace";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(`${value}ms`, chartLeft - 6, y);
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

        // Current endpoint - use last data point position (not currentLatency)
        const last = dataPoints[dataPoints.length - 1];
        const cx = chartRight;
        const clampedLast = Math.max(yMin, Math.min(yMax, last.e2eLatencyMs));
        const cy = chartBottom - ((clampedLast - yMin) / yRange) * chartHeight;

        // Subtle pulsing glow
        const pulse = Math.sin(timestamp / 500) * 0.3 + 0.7; // Slower, gentler pulse
        const glowGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 12);
        glowGradient.addColorStop(0, `rgba(0, 217, 165, ${0.5 * pulse})`);
        glowGradient.addColorStop(1, "rgba(0, 217, 165, 0)");
        ctx.beginPath();
        ctx.fillStyle = glowGradient;
        ctx.arc(cx, cy, 12, 0, Math.PI * 2);
        ctx.fill();

        // Solid center point
        ctx.beginPath();
        ctx.fillStyle = "#00D9A5";
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fill();

        // Live value label
        ctx.fillStyle = "#00D9A5";
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "right";
        ctx.fillText(`${last.e2eLatencyMs}ms`, cx - 8, cy - 8);
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
              {dataPoints.length > 0 ? dataPoints[dataPoints.length - 1].e2eLatencyMs : currentLatency}ms
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
