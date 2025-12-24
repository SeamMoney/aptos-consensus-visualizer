"use client";

import { useRef, useEffect, useState, memo } from "react";
import { BlockStats } from "@/hooks/useAptosStream";
import { useVisibility } from "@/hooks/useVisibility";

interface ConsensusRoundsChartProps {
  recentBlocks: BlockStats[];
}

interface RoundDataPoint {
  timestamp: number;
  round: number;
  roundsPerSecond: number;
}

export const ConsensusRoundsChart = memo(function ConsensusRoundsChart({ recentBlocks }: ConsensusRoundsChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const [dataPoints, setDataPoints] = useState<RoundDataPoint[]>([]);
  const lastProcessedRef = useRef<number>(0);
  const isVisible = useVisibility(containerRef);

  // Process blocks to calculate rounds per second
  useEffect(() => {
    if (!recentBlocks || recentBlocks.length < 2) return;

    const now = Date.now();
    // Only update every 5 seconds
    if (now - lastProcessedRef.current < 5000) return;
    lastProcessedRef.current = now;

    // Get blocks with round data, sorted by height
    const blocksWithRounds = recentBlocks
      .filter(b => b.round !== undefined && b.round > 0)
      .sort((a, b) => a.blockHeight - b.blockHeight);

    if (blocksWithRounds.length < 2) return;

    // Calculate rounds per second from recent blocks
    const recent = blocksWithRounds.slice(-10);
    const firstBlock = recent[0];
    const lastBlock = recent[recent.length - 1];

    const roundDiff = lastBlock.round! - firstBlock.round!;
    const timeDiffMs = (lastBlock.timestamp - firstBlock.timestamp);
    const roundsPerSecond = timeDiffMs > 0 ? (roundDiff / timeDiffMs) * 1000 : 10;

    setDataPoints(prev => {
      const newPoint: RoundDataPoint = {
        timestamp: now,
        round: lastBlock.round!,
        roundsPerSecond: Math.round(roundsPerSecond * 10) / 10, // 1 decimal
      };
      return [...prev, newPoint].slice(-40); // Keep 40 points (~3 minutes at 5s intervals)
    });
  }, [recentBlocks]);

  // Get current values
  const currentRound = recentBlocks.find(b => b.round)?.round || 0;
  const currentRps = dataPoints.length > 0
    ? dataPoints[dataPoints.length - 1].roundsPerSecond
    : 10;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastTime = 0;
    const targetFPS = 10;
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
      const chartLeft = 55;
      const chartRight = width - 20;
      const chartTop = 35;
      const chartBottom = height - 45;
      const chartWidth = chartRight - chartLeft;
      const chartHeight = chartBottom - chartTop;

      // Dynamic Y-axis range based on data (with padding)
      const allValues = dataPoints.map(p => p.roundsPerSecond);
      const dataMin = allValues.length > 0 ? Math.min(...allValues) : 8;
      const dataMax = allValues.length > 0 ? Math.max(...allValues) : 12;
      const padding = Math.max(2, (dataMax - dataMin) * 0.2);
      const yMin = Math.floor(dataMin - padding);
      const yMax = Math.ceil(dataMax + padding);
      const yRange = Math.max(yMax - yMin, 4); // Minimum range of 4

      // Draw grid - more lines for detail
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;

      const yStep = yRange > 10 ? 2 : 1; // Smaller steps for more detail
      for (let value = yMin; value <= yMax; value += yStep) {
        const y = chartBottom - ((value - yMin) / yRange) * chartHeight;

        ctx.beginPath();
        ctx.moveTo(chartLeft, y);
        ctx.lineTo(chartRight, y);
        ctx.stroke();

        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.font = "11px monospace";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(`${value}`, chartLeft - 10, y);
      }

      // Draw rounds/sec line
      if (dataPoints.length >= 2) {
        ctx.beginPath();
        ctx.strokeStyle = "#F59E0B"; // Amber color
        ctx.lineWidth = 2;

        for (let i = 0; i < dataPoints.length; i++) {
          const point = dataPoints[i];
          const x = chartLeft + (i / (dataPoints.length - 1)) * chartWidth;
          const clampedVal = Math.max(yMin, Math.min(yMax, point.roundsPerSecond));
          const y = chartBottom - ((clampedVal - yMin) / yRange) * chartHeight;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.stroke();

        // Current point with glow
        const last = dataPoints[dataPoints.length - 1];
        const cx = chartRight;
        const clampedLast = Math.max(yMin, Math.min(yMax, last.roundsPerSecond));
        const cy = chartBottom - ((clampedLast - yMin) / yRange) * chartHeight;

        // Glow
        ctx.beginPath();
        ctx.fillStyle = "rgba(245, 158, 11, 0.3)";
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = "#F59E0B";
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        ctx.font = "12px monospace";
        ctx.textAlign = "center";
        ctx.fillText("Collecting rounds data...", width / 2, height / 2);
      }

      // X-axis labels
      if (dataPoints.length > 0) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.font = "10px monospace";
        ctx.textAlign = "center";

        const oldest = new Date(dataPoints[0].timestamp);
        const newest = new Date(dataPoints[dataPoints.length - 1].timestamp);

        const fmt = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

        ctx.fillText(fmt(oldest), chartLeft + 50, chartBottom + 20);
        ctx.fillText(fmt(newest), chartRight - 50, chartBottom + 20);
      }

      // Y-axis label
      ctx.save();
      ctx.translate(15, height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText("rounds/sec", 0, 0);
      ctx.restore();

      // Title
      ctx.fillStyle = "#F59E0B";
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("Consensus Rounds Progress", chartLeft, 20);

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);

    return () => cancelAnimationFrame(animationRef.current);
  }, [dataPoints, isVisible]);

  return (
    <div ref={containerRef} className="chrome-card p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-3">
        <div>
          <h3 className="section-title">Consensus Rounds</h3>
          <p className="text-xs" style={{ color: "var(--chrome-600)" }}>
            Velociraptr 4-hop consensus speed
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-xs font-mono">
          <span style={{ color: "var(--chrome-500)" }}>
            Round: <span style={{ color: "#F59E0B" }}>{currentRound.toLocaleString()}</span>
          </span>
          <span style={{ color: "#F59E0B", fontWeight: "bold" }}>
            {currentRps} r/s
          </span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full rounded"
        style={{ height: "180px" }}
      />
    </div>
  );
});
