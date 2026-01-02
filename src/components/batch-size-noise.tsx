"use client";

import { useRef, useEffect, useState, memo, useCallback } from "react";
import { useVisibility } from "@/hooks/useVisibility";
import { Minus, Plus, Pause, Play, RotateCcw } from "lucide-react";

const BATCH_SIZES = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];
const BASE_NOISE = 2.0; // Noise at batch size 1
const TRUE_GRADIENT = 1.0;

interface DataPoint {
  x: number;
  y: number;
}

export const BatchSizeNoise = memo(function BatchSizeNoise() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const isVisible = useVisibility(containerRef);

  const [batchSizeIndex, setBatchSizeIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([]);
  const [currentDeviation, setCurrentDeviation] = useState(0);

  const batchSize = BATCH_SIZES[batchSizeIndex];
  const theoreticalNoise = BASE_NOISE / Math.sqrt(batchSize);

  // Calculate progress for the slider (0-1)
  const progress = batchSizeIndex / (BATCH_SIZES.length - 1);

  // Get noise level description
  const getNoiseDescription = () => {
    if (batchSize <= 2) return "High variance. Exploring widely.";
    if (batchSize <= 32) return "Balanced noise.";
    return "Low variance. Precise step.";
  };

  // Get stage label
  const getStageLabel = () => {
    if (batchSize <= 2) return "STOCHASTIC";
    if (batchSize <= 128) return "BATCH SIZE";
    return "STABLE";
  };

  // Generate noisy gradient estimate
  const generateNoisyGradient = useCallback(() => {
    const noise = (Math.random() - 0.5) * 2 * theoreticalNoise * 2;
    return TRUE_GRADIENT + noise;
  }, [theoreticalNoise]);

  // Auto-increment batch size
  useEffect(() => {
    if (!isPlaying || !isVisible) return;

    const interval = setInterval(() => {
      setBatchSizeIndex((prev) => {
        if (prev >= BATCH_SIZES.length - 1) {
          return prev; // Stay at max
        }
        return prev + 1;
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [isPlaying, isVisible]);

  // Generate data points
  useEffect(() => {
    const points: DataPoint[] = [];
    const numPoints = 100;

    for (let i = 0; i < numPoints; i++) {
      const noise = (Math.random() - 0.5) * 2 * theoreticalNoise * 2;
      points.push({
        x: i,
        y: TRUE_GRADIENT + noise,
      });
    }

    setDataPoints(points);

    // Calculate actual standard deviation
    const values = points.map((p) => p.y);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    setCurrentDeviation(Math.sqrt(variance));
  }, [batchSize, theoreticalNoise]);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastTime = 0;
    const targetFPS = 30;
    const frameInterval = 1000 / targetFPS;

    const render = (timestamp: number) => {
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

      // Clear with dark background
      ctx.fillStyle = "#0a0a0b";
      ctx.fillRect(0, 0, width, height);

      // Chart area
      const chartLeft = 40;
      const chartRight = width - 20;
      const chartTop = 20;
      const chartBottom = height - 30;
      const chartWidth = chartRight - chartLeft;
      const chartHeight = chartBottom - chartTop;

      // Y-axis range (dynamic based on noise level)
      const maxDeviation = Math.max(theoreticalNoise * 3, 0.5);
      const yMin = TRUE_GRADIENT - maxDeviation;
      const yMax = TRUE_GRADIENT + maxDeviation;

      // Draw subtle grid
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1;

      // Horizontal grid lines
      for (let i = 0; i <= 4; i++) {
        const y = chartTop + (i / 4) * chartHeight;
        ctx.beginPath();
        ctx.moveTo(chartLeft, y);
        ctx.lineTo(chartRight, y);
        ctx.stroke();
      }

      // Vertical grid lines
      for (let i = 0; i <= 10; i++) {
        const x = chartLeft + (i / 10) * chartWidth;
        ctx.beginPath();
        ctx.moveTo(x, chartTop);
        ctx.lineTo(x, chartBottom);
        ctx.stroke();
      }

      // Draw true gradient line (dashed)
      const trueY = chartBottom - ((TRUE_GRADIENT - yMin) / (yMax - yMin)) * chartHeight;
      ctx.strokeStyle = "rgba(0, 217, 165, 0.4)";
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(chartLeft, trueY);
      ctx.lineTo(chartRight, trueY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label for true gradient
      ctx.fillStyle = "rgba(0, 217, 165, 0.6)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`True Gradient (${TRUE_GRADIENT.toFixed(1)})`, chartRight - 5, trueY - 8);

      // Draw noisy line
      if (dataPoints.length >= 2) {
        ctx.beginPath();
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2;

        for (let i = 0; i < dataPoints.length; i++) {
          const point = dataPoints[i];
          const x = chartLeft + (point.x / (dataPoints.length - 1)) * chartWidth;
          const clampedY = Math.max(yMin, Math.min(yMax, point.y));
          const y = chartBottom - ((clampedY - yMin) / (yMax - yMin)) * chartHeight;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.stroke();

        // Draw glow effect
        ctx.strokeStyle = "rgba(59, 130, 246, 0.3)";
        ctx.lineWidth = 6;
        ctx.beginPath();
        for (let i = 0; i < dataPoints.length; i++) {
          const point = dataPoints[i];
          const x = chartLeft + (point.x / (dataPoints.length - 1)) * chartWidth;
          const clampedY = Math.max(yMin, Math.min(yMax, point.y));
          const y = chartBottom - ((clampedY - yMin) / (yMax - yMin)) * chartHeight;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();

        // Current point indicator
        const lastPoint = dataPoints[dataPoints.length - 1];
        const lastX = chartRight;
        const lastClampedY = Math.max(yMin, Math.min(yMax, lastPoint.y));
        const lastY = chartBottom - ((lastClampedY - yMin) / (yMax - yMin)) * chartHeight;

        ctx.beginPath();
        ctx.fillStyle = "#3b82f6";
        ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
        ctx.fill();

        // Outer glow
        ctx.beginPath();
        ctx.fillStyle = "rgba(59, 130, 246, 0.3)";
        ctx.arc(lastX, lastY, 8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Y-axis label
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.save();
      ctx.translate(12, height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "center";
      ctx.fillText("Gradient Estimate", 0, 0);
      ctx.restore();

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);

    return () => cancelAnimationFrame(animationRef.current);
  }, [dataPoints, isVisible, theoreticalNoise]);

  const handleDecrease = () => {
    setBatchSizeIndex((prev) => Math.max(0, prev - 1));
  };

  const handleIncrease = () => {
    setBatchSizeIndex((prev) => Math.min(BATCH_SIZES.length - 1, prev + 1));
  };

  const handleReset = () => {
    setBatchSizeIndex(0);
    setIsPlaying(true);
  };

  const togglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  return (
    <div ref={containerRef} className="chrome-card p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-5 h-5 rounded flex items-center justify-center text-xs"
            style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
          >
            📊
          </div>
          <div>
            <h3 className="section-title">Batch Size vs. Gradient Noise</h3>
            <p className="text-xs" style={{ color: "var(--chrome-600)" }}>
              Visualize how averaging over a batch reduces estimation variance.
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--chrome-500)" }}>
            Batch Size:
          </span>
          <button
            onClick={handleDecrease}
            className="w-7 h-7 rounded flex items-center justify-center transition-colors"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              color: "var(--chrome-400)",
            }}
          >
            <Minus size={14} />
          </button>
          <span
            className="font-mono text-sm font-semibold min-w-[3rem] text-center"
            style={{ color: "var(--accent)" }}
          >
            {batchSize}
          </span>
          <button
            onClick={handleIncrease}
            className="w-7 h-7 rounded flex items-center justify-center transition-colors"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              color: "var(--chrome-400)",
            }}
          >
            <Plus size={14} />
          </button>
          <div className="w-px h-5 mx-1" style={{ background: "var(--border-default)" }} />
          <button
            onClick={togglePlay}
            className="w-7 h-7 rounded flex items-center justify-center transition-colors"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              color: "var(--chrome-400)",
            }}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button
            onClick={handleReset}
            className="w-7 h-7 rounded flex items-center justify-center transition-colors"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              color: "var(--chrome-400)",
            }}
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Chart */}
        <div className="flex-1">
          <canvas
            ref={canvasRef}
            className="w-full rounded-lg"
            style={{ height: "280px", background: "#0a0a0b" }}
          />

          {/* Progress bar */}
          <div className="mt-4">
            <div
              className="flex items-center justify-between px-3 py-2 rounded-full text-[10px] font-semibold tracking-wider"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
            >
              <span
                style={{ color: getStageLabel() === "STOCHASTIC" ? "var(--accent)" : "var(--chrome-500)" }}
              >
                STOCHASTIC
              </span>
              <span
                style={{ color: getStageLabel() === "BATCH SIZE" ? "var(--accent)" : "var(--chrome-500)" }}
              >
                BATCH SIZE
              </span>
              <span
                style={{ color: getStageLabel() === "STABLE" ? "var(--accent)" : "var(--chrome-500)" }}
              >
                STABLE
              </span>
            </div>
            <div className="relative mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-surface)" }}>
              <div
                className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progress * 100}%`,
                  background: "linear-gradient(90deg, var(--accent), #3b82f6)",
                }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full transition-all duration-500"
                style={{
                  left: `calc(${progress * 100}% - 6px)`,
                  background: "var(--accent)",
                  boxShadow: "0 0 8px var(--accent)",
                }}
              />
            </div>
          </div>
        </div>

        {/* Stats panel */}
        <div className="lg:w-64 space-y-3">
          {/* Theoretical Noise */}
          <div
            className="p-4 rounded-lg"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
          >
            <div className="text-[10px] font-medium tracking-wider mb-1" style={{ color: "var(--chrome-500)" }}>
              THEORETICAL NOISE (σ)
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-mono font-bold" style={{ color: "var(--accent)" }}>
                {theoreticalNoise.toFixed(3)}
              </span>
              <span className="text-xs" style={{ color: "var(--chrome-500)" }}>
                ∝ 1/√B
              </span>
            </div>
            <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: "var(--bg-elevated)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, (theoreticalNoise / BASE_NOISE) * 100)}%`,
                  background: "var(--accent)",
                }}
              />
            </div>
          </div>

          {/* Current Deviation */}
          <div
            className="p-4 rounded-lg"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
          >
            <div className="text-[10px] font-medium tracking-wider mb-1" style={{ color: "var(--chrome-500)" }}>
              CURRENT DEVIATION
            </div>
            <div className="text-2xl font-mono font-bold" style={{ color: "var(--chrome-100)" }}>
              {currentDeviation.toFixed(3)}
            </div>
            <div className="text-xs mt-1" style={{ color: "var(--chrome-500)" }}>
              {getNoiseDescription()}
            </div>
          </div>

          {/* Key Insight */}
          <div
            className="p-4 rounded-lg"
            style={{
              background: "rgba(0, 217, 165, 0.05)",
              border: "1px solid rgba(0, 217, 165, 0.2)",
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span style={{ color: "var(--accent)" }}>ⓘ</span>
              <span className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
                Key Insight
              </span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "var(--chrome-300)" }}>
              Increasing batch size <strong style={{ color: "var(--chrome-100)" }}>B</strong> reduces
              gradient noise by <strong style={{ color: "var(--chrome-100)" }}>√B</strong>.
            </p>
            <p className="text-xs leading-relaxed mt-2" style={{ color: "var(--chrome-500)" }}>
              To use large batches effectively, you often need to increase the Learning Rate linearly
              or by square root to compensate for the reduced noise/variance distribution.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});
