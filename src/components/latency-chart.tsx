"use client";

import { useRef, useEffect } from "react";
import { useLatencyStorage } from "@/hooks/useLatencyStorage";

interface LatencyChartProps {
  avgBlockTime: number;
}

export function LatencyChart({ avgBlockTime }: LatencyChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  const { dataPoints, currentP50, currentP95, stats } = useLatencyStorage(avgBlockTime);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastTime = 0;
    const targetFPS = 10;
    const frameInterval = 1000 / targetFPS;

    const render = (timestamp: number) => {
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

        // Current point
        const last = dataPoints[dataPoints.length - 1];
        const cx = chartRight;
        const clampedLast = Math.max(yMin, Math.min(yMax, last.e2eLatencyMs));
        const cy = chartBottom - ((clampedLast - yMin) / yRange) * chartHeight;

        ctx.beginPath();
        ctx.fillStyle = "#00D9A5";
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        ctx.font = "12px monospace";
        ctx.textAlign = "center";
        ctx.fillText("Collecting latency data...", width / 2, height / 2);
      }

      // X-axis labels
      if (dataPoints.length > 0) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.font = "10px monospace";
        ctx.textAlign = "center";

        const oldest = new Date(dataPoints[0].timestamp);
        const newest = new Date(dataPoints[dataPoints.length - 1].timestamp);

        const fmt = (d: Date) => {
          const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          const date = `${d.getMonth() + 1}/${d.getDate()}`;
          return `${time}\n${date}`;
        };

        ctx.fillText(fmt(oldest).split('\n')[0], chartLeft + 40, chartBottom + 16);
        ctx.fillText(fmt(oldest).split('\n')[1], chartLeft + 40, chartBottom + 30);

        ctx.fillText(fmt(newest).split('\n')[0], chartRight - 40, chartBottom + 16);
        ctx.fillText(fmt(newest).split('\n')[1], chartRight - 40, chartBottom + 30);
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
  }, [dataPoints]);

  return (
    <div className="chrome-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="section-title">E2E Latency with Finality</h3>
          <p className="text-xs" style={{ color: "var(--chrome-600)" }}>
            p50 median · {stats.count} samples
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <span style={{ color: "var(--chrome-500)" }}>
            p50: <span style={{ color: "#00D9A5" }}>{currentP50}ms</span>
          </span>
          <span style={{ color: "var(--chrome-500)" }}>
            p95: <span style={{ color: "#00D9A5" }}>{currentP95}ms</span>
          </span>
          <span style={{ color: "#00D9A5", fontWeight: "bold" }}>
            ~{Math.round(avgBlockTime * 5)}ms
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
}
