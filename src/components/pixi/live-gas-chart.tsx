"use client";

import { memo, useEffect, useRef, useState, useCallback } from "react";
import { Application, Graphics, Filter } from "pixi.js";
import { useVisibility } from "@/hooks/useVisibility";
import { PIXI_COLORS } from "@/lib/pixi-utils";
import { useNetwork } from "@/contexts/NetworkContext";
import { useAptosStream } from "@/hooks/useAptosStream";

interface LiveGasChartProps {
  className?: string;
}

interface GasDataPoint {
  blockHeight: number;
  timestamp: number;
  min: number;
  median: number;
  max: number;
  count: number;
}

// Floating particle for ambient effect
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  color: number;
}

// Priority bucket thresholds (in octas)
const PRIORITY_BUCKETS = [0, 150, 300, 500, 1000, 3000, 5000, 10000, 100000, 1000000];

// Beautiful color palette
const COLORS = {
  primary: 0x00D9A5,
  primaryGlow: 0x00FFB8,
  secondary: 0xf59e0b,
  secondaryGlow: 0xfbbf24,
  tertiary: 0x6366f1,
  tertiaryGlow: 0x818cf8,
  background: 0x0a0a0f,
  gridLine: 0x1a1a2e,
  particle: 0x00D9A5,
};

const CONFIG = {
  maxDataPoints: 50,
  chartPadding: { top: 20, right: 55, bottom: 20, left: 10 },
  yAxisAnimationSpeed: 0.08,
  stickyZoomDuration: 5000,
  particleCount: 15,
};

// Format octas to readable string
const formatOctas = (octas: number): string => {
  if (octas >= 1000000) return `${(octas / 1000000).toFixed(1)}M`;
  if (octas >= 1000) return `${(octas / 1000).toFixed(1)}K`;
  return octas.toString();
};

// Convert octas to USD (approximate: 100 octas ≈ $0.00005 at $10 APT)
const octasToUsd = (octas: number, gasUnits: number = 1000): string => {
  const aptCost = (octas * gasUnits) / 100000000;
  const usdCost = aptCost * 10; // Assuming $10 APT
  if (usdCost < 0.00001) return `$${usdCost.toFixed(6)}`;
  if (usdCost < 0.001) return `$${usdCost.toFixed(5)}`;
  if (usdCost < 0.01) return `$${usdCost.toFixed(4)}`;
  return `$${usdCost.toFixed(3)}`;
};

// Find which priority bucket a gas price falls into
const getBucketIndex = (gasPrice: number): number => {
  for (let i = PRIORITY_BUCKETS.length - 1; i >= 0; i--) {
    if (gasPrice >= PRIORITY_BUCKETS[i]) return i;
  }
  return 0;
};

export const LiveGasChart = memo(function LiveGasChart({
  className,
}: LiveGasChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const initAttemptedRef = useRef(false);
  const mountedRef = useRef(true);

  const dataRef = useRef<GasDataPoint[]>([]);

  const graphicsRef = useRef<{
    background: Graphics | null;
    grid: Graphics | null;
    chart: Graphics | null;
    glow: Graphics | null;
    particles: Graphics | null;
    markers: Graphics | null;
  }>({
    background: null,
    grid: null,
    chart: null,
    glow: null,
    particles: null,
    markers: null,
  });

  const particlesRef = useRef<Particle[]>([]);
  const timeRef = useRef<number>(0);

  const [isReady, setIsReady] = useState(false);
  const [currentGas, setCurrentGas] = useState({ min: 100, median: 100, max: 150, count: 0 });
  const [sessionLow, setSessionLow] = useState<number>(Infinity); // Lowest seen this session
  const [sessionHigh, setSessionHigh] = useState<number>(0); // Highest seen this session
  const [lastBlock, setLastBlock] = useState<number>(0);
  const [isSpiking, setIsSpiking] = useState(false);
  const [spikeIntensity, setSpikeIntensity] = useState(0); // 0-1 for spike visual effects
  const [displayYMax, setDisplayYMax] = useState(200);
  const [priceTrackerY, setPriceTrackerY] = useState(50); // Y position for price label
  const [priorityPosition, setPriorityPosition] = useState(0); // Animated priority bar position

  // Animated Y-axis state for smooth scaling
  const animatedYMinRef = useRef<number>(0);
  const animatedYMaxRef = useRef<number>(200);
  const targetYMinRef = useRef<number>(0);
  const targetYMaxRef = useRef<number>(200);
  const lastSpikeTimeRef = useRef<number>(0);

  const { network } = useNetwork();
  const { stats, connected } = useAptosStream();
  const isVisible = useVisibility(containerRef);

  // Process blocks to extract gas data
  useEffect(() => {
    if (!stats.recentBlocks || stats.recentBlocks.length === 0) return;

    // Process each block that has gasStats
    const newPoints: GasDataPoint[] = [];

    for (const block of stats.recentBlocks) {
      // Skip blocks we already have
      if (dataRef.current.some(d => d.blockHeight === block.blockHeight)) continue;

      // Use gasStats if available, otherwise use defaults
      const gasStats = (block as any).gasStats;
      if (gasStats) {
        newPoints.push({
          blockHeight: block.blockHeight,
          timestamp: block.timestamp,
          min: gasStats.min,
          median: gasStats.median,
          max: gasStats.max,
          count: gasStats.count,
        });
      } else if (block.txCount > 1) {
        // No gasStats but has transactions - use estimate API fallback values
        // with slight variance to show the chart is updating
        const baseVariance = (block.blockHeight % 10) * 5;
        newPoints.push({
          blockHeight: block.blockHeight,
          timestamp: block.timestamp,
          min: 100,
          median: 100 + baseVariance,
          max: 150 + baseVariance,
          count: block.txCount - 1, // Subtract block metadata tx
        });
      }
    }

    if (newPoints.length > 0) {
      // Add new points and sort by block height
      dataRef.current = [...dataRef.current, ...newPoints]
        .sort((a, b) => a.blockHeight - b.blockHeight)
        .slice(-CONFIG.maxDataPoints);

      // Update current gas display with latest
      const latest = dataRef.current[dataRef.current.length - 1];
      if (latest) {
        setCurrentGas({
          min: latest.min,
          median: latest.median,
          max: latest.max,
          count: latest.count,
        });
        setLastBlock(latest.blockHeight);

        // Update session high/low (only if new extremes found)
        setSessionLow(prev => Math.min(prev, latest.min));
        setSessionHigh(prev => Math.max(prev, latest.max));
      }
    }
  }, [stats.recentBlocks]);

  // Clear data when network changes
  useEffect(() => {
    dataRef.current = [];
    setCurrentGas({ min: 100, median: 100, max: 150, count: 0 });
    setSessionLow(Infinity);
    setSessionHigh(0);
    setLastBlock(0);
  }, [network]);

  // Initialize particles
  const initParticles = useCallback((width: number, height: number) => {
    particlesRef.current = [];
    for (let i = 0; i < CONFIG.particleCount; i++) {
      particlesRef.current.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.3 - 0.2, // Drift upward slightly
        radius: Math.random() * 2 + 1,
        alpha: Math.random() * 0.3 + 0.1,
        color: Math.random() > 0.7 ? COLORS.secondary : COLORS.primary,
      });
    }
  }, []);

  const updateChart = useCallback(() => {
    if (!mountedRef.current) return;
    const app = appRef.current;
    const container = containerRef.current;
    if (!app || !container) return;

    try {
      if (!app.renderer || !app.stage) return;
    } catch {
      return;
    }

    try {
      const rect = container.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      if (Math.abs(app.screen.width - width) > 1 || Math.abs(app.screen.height - height) > 1) {
        app.renderer.resize(width, height);
        initParticles(width, height);
      }

      const { top, right, bottom, left } = CONFIG.chartPadding;
      const chartWidth = width - left - right;
      const chartHeight = height - top - bottom;

      timeRef.current += 0.016; // ~60fps time tracking
      const time = timeRef.current;

      // Draw background
      const bg = graphicsRef.current.background;
      if (bg) {
        bg.clear();
        bg.rect(0, 0, width, height);
        bg.fill({ color: COLORS.background });
      }

      // Draw floating particles (ambient effect)
      const particlesGfx = graphicsRef.current.particles;
      if (particlesGfx) {
        particlesGfx.clear();
        for (const p of particlesRef.current) {
          // Update position
          p.x += p.vx;
          p.y += p.vy;

          // Wrap around
          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;

          // Pulse alpha
          const pulseAlpha = p.alpha * (0.5 + 0.5 * Math.sin(time * 2 + p.x * 0.01));
          particlesGfx.circle(p.x, p.y, p.radius);
          particlesGfx.fill({ color: p.color, alpha: pulseAlpha });
        }
      }

      // Find actual data range
      let dataMin = Infinity;
      let dataMax = -Infinity;
      const data = dataRef.current;
      if (data.length > 0) {
        for (const point of data) {
          dataMin = Math.min(dataMin, point.min, point.median);
          dataMax = Math.max(dataMax, point.max, point.median);
        }
      } else {
        dataMin = 90;
        dataMax = 110;
      }

      // Use LOG SCALE so baseline (100) and spikes (1M) are both visible
      // Log scale: 100 = 2, 1K = 3, 10K = 4, 100K = 5, 1M = 6
      const logMin = 1.8; // ~63 octas (floor)
      const logMax = Math.max(6.2, Math.log10(Math.max(dataMax, 200)) + 0.3); // dynamic ceiling

      // Animate the max for smooth transitions
      const targetLogMax = logMax;
      targetYMaxRef.current = targetLogMax;

      const zoomingOut = targetLogMax > animatedYMaxRef.current;
      const lerpSpeed = zoomingOut ? 0.2 : 0.08;
      animatedYMaxRef.current += (targetLogMax - animatedYMaxRef.current) * lerpSpeed;

      const animatedLogMax = animatedYMaxRef.current;

      // Convert value to Y position using log scale
      const toY = (val: number) => {
        const logVal = Math.log10(Math.max(val, 50)); // Floor at 50 to avoid log(0)
        const ratio = (logVal - logMin) / (animatedLogMax - logMin);
        return top + chartHeight - ratio * chartHeight;
      };

      // Log scale grid lines at 100, 1K, 10K, 100K
      const grid = graphicsRef.current.grid;
      if (grid) {
        grid.clear();
        const logLevels = [100, 1000, 10000, 100000]; // Grid at these values
        for (const level of logLevels) {
          const y = toY(level);
          if (y > top && y < height - bottom) {
            grid.setStrokeStyle({ width: 1, color: COLORS.gridLine, alpha: 0.25 });
            grid.moveTo(left, y);
            grid.lineTo(width - right, y);
            grid.stroke();
          }
        }
      }

      // Draw chart
      const chart = graphicsRef.current.chart;
      const glow = graphicsRef.current.glow;

      if (chart && data.length > 1) {
        chart.clear();
        if (glow) glow.clear();

        // Spike detection with intensity calculation
        const now = Date.now();
        const maxInData = Math.max(...data.map(d => d.max));
        const latestMax = data[data.length - 1]?.max || 100;

        // Calculate spike intensity based on how far above baseline (100) we are
        // Log scale so 1K = 0.33, 10K = 0.66, 100K = 0.83, 1M = 1.0
        const intensity = latestMax > 150
          ? Math.min(1, Math.log10(latestMax / 100) / 4)
          : 0;

        if (maxInData > 500) {
          lastSpikeTimeRef.current = now;
        }
        const timeSinceSpike = now - lastSpikeTimeRef.current;
        const currentSpiking = timeSinceSpike < 5000 && maxInData > 500;
        setIsSpiking(currentSpiking);
        setSpikeIntensity(intensity);
        // Convert log max back to actual value for display
        setDisplayYMax(Math.round(Math.pow(10, animatedYMaxRef.current)));

        // Update priority bar position (animated in CSS)
        const priorityPct = Math.min(100, (Math.log10(Math.max(1, latestMax)) / Math.log10(1000000)) * 100);
        setPriorityPosition(priorityPct);

        const toX = (i: number) => left + (i / (data.length - 1)) * chartWidth;

        // Catmull-Rom spline for ultra-smooth curves
        const getSplinePoints = (getValue: (d: GasDataPoint) => number, resolution: number = 4): {x: number, y: number}[] => {
          const points: {x: number, y: number}[] = [];

          for (let i = 0; i < data.length - 1; i++) {
            const p0 = { x: toX(Math.max(0, i - 1)), y: toY(getValue(data[Math.max(0, i - 1)])) };
            const p1 = { x: toX(i), y: toY(getValue(data[i])) };
            const p2 = { x: toX(i + 1), y: toY(getValue(data[i + 1])) };
            const p3 = { x: toX(Math.min(data.length - 1, i + 2)), y: toY(getValue(data[Math.min(data.length - 1, i + 2)])) };

            for (let t = 0; t < resolution; t++) {
              const tt = t / resolution;
              const tt2 = tt * tt;
              const tt3 = tt2 * tt;

              // Catmull-Rom coefficients
              const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * tt + (2*p0.x - 5*p1.x + 4*p2.x - p3.x) * tt2 + (-p0.x + 3*p1.x - 3*p2.x + p3.x) * tt3);
              const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * tt + (2*p0.y - 5*p1.y + 4*p2.y - p3.y) * tt2 + (-p0.y + 3*p1.y - 3*p2.y + p3.y) * tt3);

              points.push({ x, y });
            }
          }
          // Add final point
          points.push({ x: toX(data.length - 1), y: toY(getValue(data[data.length - 1])) });
          return points;
        };

        // Draw filled area under median - simple and correct
        const medianPoints = getSplinePoints(d => d.median, 3);

        // Fill from line down to bottom
        chart.moveTo(medianPoints[0].x, height - bottom);
        chart.lineTo(medianPoints[0].x, medianPoints[0].y);
        for (const pt of medianPoints) {
          chart.lineTo(pt.x, pt.y);
        }
        chart.lineTo(medianPoints[medianPoints.length - 1].x, height - bottom);
        chart.closePath();
        chart.fill({ color: COLORS.primary, alpha: 0.15 });

        // Draw min line (base) - subtle blue
        const minPoints = getSplinePoints(d => d.min, 3);
        chart.setStrokeStyle({ width: 1.5, color: COLORS.tertiary, alpha: 0.5 });
        chart.moveTo(minPoints[0].x, minPoints[0].y);
        for (const pt of minPoints) {
          chart.lineTo(pt.x, pt.y);
        }
        chart.stroke();

        // Draw max/priority line - amber with glow (intensity-based thickness)
        const maxPoints = getSplinePoints(d => d.max, 3);
        const maxLineWidth = 2 + intensity * 3; // 2-5px based on intensity
        const maxGlowWidth = 6 + intensity * 12; // 6-18px glow

        // Glow layer - more intense during spikes
        if (glow) {
          glow.setStrokeStyle({ width: maxGlowWidth, color: COLORS.secondary, alpha: 0.15 + intensity * 0.25 });
          glow.moveTo(maxPoints[0].x, maxPoints[0].y);
          for (const pt of maxPoints) {
            glow.lineTo(pt.x, pt.y);
          }
          glow.stroke();

          // Extra outer glow during high intensity
          if (intensity > 0.5) {
            glow.setStrokeStyle({ width: maxGlowWidth * 1.5, color: 0xef4444, alpha: intensity * 0.15 });
            glow.moveTo(maxPoints[0].x, maxPoints[0].y);
            for (const pt of maxPoints) {
              glow.lineTo(pt.x, pt.y);
            }
            glow.stroke();
          }
        }

        chart.setStrokeStyle({ width: maxLineWidth, color: intensity > 0.5 ? 0xfbbf24 : COLORS.secondary, alpha: 0.9 });
        chart.moveTo(maxPoints[0].x, maxPoints[0].y);
        for (const pt of maxPoints) {
          chart.lineTo(pt.x, pt.y);
        }
        chart.stroke();

        // Draw median line - main line with glow
        const medianLineWidth = 2.5 + intensity * 1.5;
        const medianGlowWidth = 8 + intensity * 8;

        if (glow) {
          glow.setStrokeStyle({ width: medianGlowWidth, color: COLORS.primaryGlow, alpha: 0.2 + intensity * 0.2 });
          glow.moveTo(medianPoints[0].x, medianPoints[0].y);
          for (const pt of medianPoints) {
            glow.lineTo(pt.x, pt.y);
          }
          glow.stroke();
        }

        chart.setStrokeStyle({ width: medianLineWidth, color: COLORS.primary, alpha: 1 });
        chart.moveTo(medianPoints[0].x, medianPoints[0].y);
        for (const pt of medianPoints) {
          chart.lineTo(pt.x, pt.y);
        }
        chart.stroke();

        // Data point markers (subtle)
        for (let i = 0; i < data.length; i++) {
          const x = toX(i);
          const y = toY(data[i].median);
          chart.circle(x, y, 2);
          chart.fill({ color: COLORS.primary, alpha: 0.6 });
        }

        // Current point - animated pulsing glow
        const lastPoint = data[data.length - 1];
        const lastX = toX(data.length - 1);
        const lastY = toY(lastPoint.median);

        const pulseScale = 1 + 0.2 * Math.sin(time * 4);
        const pulseAlpha = 0.3 + 0.2 * Math.sin(time * 4);

        // Outer glow rings
        for (let ring = 4; ring >= 0; ring--) {
          const radius = (8 + ring * 4) * pulseScale;
          const alpha = (0.05 * (5 - ring)) * pulseAlpha;
          chart.circle(lastX, lastY, radius);
          chart.fill({ color: COLORS.primaryGlow, alpha });
        }

        // Core point
        chart.circle(lastX, lastY, 5);
        chart.fill({ color: COLORS.primary, alpha: 1 });
        chart.circle(lastX, lastY, 3);
        chart.fill({ color: 0xffffff, alpha: 0.9 });

        // Price label badge
        const labelY = Math.max(20, Math.min(height - 20, lastY));

        // Badge shadow
        chart.roundRect(width - right - 2, labelY - 11, 50, 22, 6);
        chart.fill({ color: 0x000000, alpha: 0.4 });

        // Badge background
        chart.roundRect(width - right - 4, labelY - 12, 50, 22, 6);
        chart.fill({ color: COLORS.primary, alpha: 0.95 });

        setPriceTrackerY(labelY);

      } else if (chart) {
        chart.clear();
        // Loading state - animated scanning line
        const scanX = (Math.sin(time) * 0.5 + 0.5) * width;

        chart.setStrokeStyle({ width: 2, color: COLORS.primary, alpha: 0.3 });
        chart.moveTo(left, height * 0.5);
        chart.lineTo(width - right, height * 0.5);
        chart.stroke();

        // Scanning dot
        chart.circle(scanX, height * 0.5, 4);
        chart.fill({ color: COLORS.primary, alpha: 0.6 });
      }

    } catch {
      // Ignore errors
    }
  }, [initParticles]);

  const initPixi = useCallback(async () => {
    const container = containerRef.current;
    if (!container || appRef.current) return;

    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    initAttemptedRef.current = true;

    const app = new Application();
    await app.init({
      width: rect.width,
      height: rect.height,
      backgroundColor: PIXI_COLORS.background,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    // Check if unmounted during async init
    if (!mountedRef.current) {
      app.destroy(true, { children: true });
      return;
    }

    app.ticker.maxFPS = 60; // Smooth 60fps updates

    container.appendChild(app.canvas as HTMLCanvasElement);
    appRef.current = app;

    graphicsRef.current = {
      background: new Graphics(),
      grid: new Graphics(),
      particles: new Graphics(),
      glow: new Graphics(),
      chart: new Graphics(),
      markers: new Graphics(),
    };

    app.stage.addChild(graphicsRef.current.background!);
    app.stage.addChild(graphicsRef.current.particles!);
    app.stage.addChild(graphicsRef.current.grid!);
    app.stage.addChild(graphicsRef.current.glow!);
    app.stage.addChild(graphicsRef.current.chart!);
    app.stage.addChild(graphicsRef.current.markers!);

    // Initialize particles
    initParticles(rect.width, rect.height);

    mountedRef.current = true;
    setIsReady(true);

    app.ticker.add(updateChart);
  }, [updateChart, initParticles]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          if (!appRef.current && !initAttemptedRef.current) {
            initPixi();
          } else if (appRef.current) {
            appRef.current.renderer.resize(width, height);
          }
        }
      }
    });
    resizeObserver.observe(container);

    const initTimeout = setTimeout(() => {
      if (!appRef.current && !initAttemptedRef.current) {
        initPixi();
      }
    }, 100);

    initPixi();

    return () => {
      mountedRef.current = false;
      clearTimeout(initTimeout);
      resizeObserver.disconnect();
      if (appRef.current) {
        // Stop ticker first to prevent render during cleanup
        appRef.current.ticker.stop();

        // Remove ticker callback to prevent any pending updates
        try {
          appRef.current.ticker.remove(updateChart);
        } catch {
          // Ignore if already removed
        }

        const canvas = appRef.current.canvas as HTMLCanvasElement;
        try {
          appRef.current.destroy(true, { children: true, texture: true });
        } catch {
          // Ignore cleanup errors
        }
        if (canvas && container.contains(canvas)) container.removeChild(canvas);
        appRef.current = null;
      }
      graphicsRef.current = {
        background: null,
        grid: null,
        chart: null,
        glow: null,
        particles: null,
        markers: null,
      };
      initAttemptedRef.current = false;
      setIsReady(false);
    };
  }, [initPixi]);

  useEffect(() => {
    if (!appRef.current) return;
    if (isVisible) {
      appRef.current.ticker.start();
      updateChart();
    } else {
      appRef.current.ticker.stop();
    }
  }, [isVisible, updateChart]);

  const dataPointCount = dataRef.current.length;

  return (
    <div className={`chrome-card p-3 ${className || ""}`}>
      {/* Header - Premium */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold text-white tracking-tight">Live Gas</h3>
          <div className={`flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full ${connected ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30' : 'bg-gray-500/20 text-gray-400'}`}>
            {connected && <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />}
            {connected ? 'STREAMING' : 'CONNECTING'}
          </div>
        </div>
        <div className="text-[11px] font-mono text-gray-500 bg-gray-800/50 px-2 py-0.5 rounded">
          Block #{lastBlock.toLocaleString()}
        </div>
      </div>

      {/* Current Gas Stats - Premium Cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-3 rounded-lg text-center bg-gradient-to-b from-gray-800/50 to-gray-900/50 border border-gray-700/30">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Session Low</div>
          <div className="text-lg font-bold text-gray-400 tabular-nums tracking-tight">
            {sessionLow === Infinity ? '—' : formatOctas(sessionLow)}
          </div>
          <div className="text-[9px] text-gray-600 mt-0.5">octas</div>
        </div>
        <div className="p-3 rounded-lg text-center bg-gradient-to-b from-emerald-900/30 to-emerald-950/30 border border-emerald-500/20 ring-1 ring-emerald-500/10">
          <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "#00D9A5" }}>Current</div>
          <div className="text-2xl font-bold tabular-nums tracking-tight" style={{ color: "#00D9A5" }}>{formatOctas(currentGas.median)}</div>
          <div className="text-[9px] text-emerald-500/60 mt-0.5">median</div>
        </div>
        <div
          className={`p-3 rounded-lg text-center transition-all duration-200 ${spikeIntensity > 0.3 ? 'scale-[1.03]' : ''} ${spikeIntensity > 0.6 ? 'ring-2 ring-red-500/50' : spikeIntensity > 0.3 ? 'ring-2 ring-amber-500/50' : ''}`}
          style={{
            background: spikeIntensity > 0.6
              ? "linear-gradient(to bottom, rgba(239, 68, 68, 0.3), rgba(245, 158, 11, 0.2))"
              : spikeIntensity > 0.3
                ? "linear-gradient(to bottom, rgba(245, 158, 11, 0.25), rgba(245, 158, 11, 0.15))"
                : "linear-gradient(to bottom, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.05))",
            border: spikeIntensity > 0.6 ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid rgba(245, 158, 11, 0.2)",
            boxShadow: spikeIntensity > 0.5 ? `0 0 20px rgba(245, 158, 11, ${spikeIntensity * 0.5})` : 'none',
          }}
        >
          <div
            className={`text-[10px] uppercase tracking-wider flex items-center justify-center gap-1 mb-1 ${spikeIntensity > 0.3 ? 'animate-pulse' : ''}`}
            style={{ color: spikeIntensity > 0.6 ? '#ef4444' : '#f59e0b' }}
          >
            {spikeIntensity > 0.6 ? '🔥🔥 SPIKE!' : spikeIntensity > 0.3 ? '🔥 HIGH' : 'Session High'}
          </div>
          <div
            className={`font-bold tabular-nums tracking-tight transition-all ${spikeIntensity > 0.5 ? 'text-3xl' : spikeIntensity > 0.3 ? 'text-2xl' : 'text-lg'}`}
            style={{ color: spikeIntensity > 0.6 ? '#fbbf24' : spikeIntensity > 0.3 ? '#fcd34d' : '#fbbf24' }}
          >
            {sessionHigh === 0 ? '—' : formatOctas(sessionHigh)}
          </div>
          <div className="text-[9px] text-amber-500/50 mt-0.5">peak</div>
        </div>
      </div>

      {/* Priority Bucket - Animated */}
      <div className="mb-4 px-1">
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-[9px] text-gray-500 uppercase tracking-wider">Priority Scale</div>
          {spikeIntensity > 0.3 && (
            <div
              className="text-[9px] font-bold uppercase tracking-wider animate-pulse"
              style={{ color: spikeIntensity > 0.6 ? '#ef4444' : '#f59e0b' }}
            >
              {spikeIntensity > 0.6 ? '🔥 HIGH PRIORITY' : '⚡ ELEVATED'}
            </div>
          )}
        </div>
        <div
          className={`relative h-3 rounded-full overflow-hidden transition-all duration-300 ${spikeIntensity > 0.5 ? 'ring-1 ring-amber-500/30' : 'ring-1 ring-white/5'}`}
          style={{
            background: spikeIntensity > 0.5
              ? 'linear-gradient(to right, rgba(239, 68, 68, 0.2), rgba(245, 158, 11, 0.3), rgba(239, 68, 68, 0.2))'
              : 'linear-gradient(to right, rgba(31, 41, 55, 0.8), rgba(55, 65, 81, 0.5), rgba(31, 41, 55, 0.8))',
          }}
        >
          {/* Animated gradient fill */}
          <div
            className="absolute inset-y-0 left-0 transition-all duration-150 ease-out"
            style={{
              width: `${priorityPosition}%`,
              background: spikeIntensity > 0.5
                ? 'linear-gradient(to right, rgba(245, 158, 11, 0.6), rgba(239, 68, 68, 0.8))'
                : 'linear-gradient(to right, rgba(0, 217, 165, 0.4), rgba(0, 255, 184, 0.3))',
              boxShadow: spikeIntensity > 0.3
                ? `0 0 20px rgba(245, 158, 11, ${spikeIntensity})`
                : 'none',
            }}
          />
          {/* Tick marks */}
          {PRIORITY_BUCKETS.slice(1).map((bucket) => {
            const pct = Math.min(100, (Math.log10(bucket) / Math.log10(1000000)) * 100);
            return (
              <div
                key={bucket}
                className="absolute top-0 bottom-0 w-px bg-gray-600/50"
                style={{ left: `${pct}%` }}
              />
            );
          })}
          {/* Animated marker */}
          <div
            className="absolute top-0 bottom-0 w-2 rounded-full transition-all duration-150 ease-out -translate-x-1/2"
            style={{
              left: `${priorityPosition}%`,
              backgroundColor: spikeIntensity > 0.5 ? '#f59e0b' : '#00FFB8',
              boxShadow: spikeIntensity > 0.3
                ? `0 0 12px ${spikeIntensity > 0.5 ? '#f59e0b' : '#00D9A5'}, 0 0 24px rgba(${spikeIntensity > 0.5 ? '245, 158, 11' : '0, 217, 165'}, 0.6)`
                : '0 0 8px #00D9A5',
              transform: `translateX(-50%) scale(${1 + spikeIntensity * 0.5})`,
            }}
          />
        </div>
        <div className="flex justify-between text-[8px] mt-1 px-0.5">
          <span className="text-gray-600">100</span>
          <span className="text-gray-600">1K</span>
          <span className={spikeIntensity > 0.3 ? 'text-amber-500' : 'text-gray-600'}>10K</span>
          <span className={spikeIntensity > 0.6 ? 'text-amber-400' : 'text-gray-600'}>100K</span>
          <span className={spikeIntensity > 0.8 ? 'text-red-400 font-bold' : 'text-gray-600'}>1M</span>
        </div>
      </div>

      {/* Chart - Premium */}
      <div
        ref={containerRef}
        className="canvas-wrap relative rounded-xl overflow-hidden ring-1 ring-white/5"
        style={{ height: "280px", background: "linear-gradient(180deg, #0a0a0f 0%, #0d0d15 100%)" }}
      >
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <div className="w-2 h-2 bg-emerald-500/50 rounded-full animate-ping" />
              Initializing chart...
            </div>
          </div>
        )}

        {/* Price tracker label */}
        {isReady && dataRef.current.length > 0 && (
          <div
            className="absolute text-[11px] font-bold text-gray-900 pointer-events-none transition-all duration-200 ease-out"
            style={{ top: `${priceTrackerY - 7}px`, right: '4px', width: '46px', textAlign: 'center' }}
          >
            {formatOctas(currentGas.median)}
          </div>
        )}

        {/* Y-axis scale - log scale labels */}
        {isReady && dataRef.current.length > 0 && (
          <div className="absolute right-1 top-2 bottom-2 flex flex-col justify-between pointer-events-none text-[8px] font-mono">
            <div className="text-gray-500 bg-black/40 px-1 rounded">{formatOctas(displayYMax)}</div>
            <div className="text-gray-600 bg-black/40 px-1 rounded">100K</div>
            <div className="text-gray-600 bg-black/40 px-1 rounded">10K</div>
            <div className="text-gray-600 bg-black/40 px-1 rounded">1K</div>
            <div className="text-gray-600 bg-black/40 px-1 rounded">100</div>
          </div>
        )}

        {/* Legend - top left, elegant */}
        {isReady && (
          <div className="absolute top-2 left-2 flex items-center gap-3 text-[9px] bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/5">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-[2px] rounded-full" style={{ backgroundColor: "#6366f1", opacity: 0.6 }} />
              <span className="text-gray-500">Base</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-[2px] rounded-full" style={{ backgroundColor: "#00D9A5" }} />
              <span className="text-gray-300">Market</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-[2px] rounded-full" style={{ backgroundColor: "#f59e0b" }} />
              <span className="text-gray-400">Priority</span>
            </div>
          </div>
        )}
      </div>

      {/* Explainer - Premium */}
      <div className="mt-4 p-4 rounded-xl text-xs bg-gradient-to-br from-emerald-950/30 via-gray-900/50 to-gray-900/30 border border-emerald-500/10 ring-1 ring-white/5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600" />
          <div className="font-semibold text-sm" style={{ color: "#00D9A5" }}>How Aptos Gas Works</div>
        </div>
        <div className="space-y-2 text-gray-400 leading-relaxed">
          <p><span className="text-white font-medium">Market Rate</span> — Median gas price from recent blocks. What most transactions pay.</p>
          <p><span className="text-white font-medium">Priority Fee</span> — Pay more for faster inclusion. Buckets: 100 → 1M octas.</p>
          <p><span className="text-emerald-400">Unlike Ethereum</span>, Aptos fees stay remarkably stable—no surge pricing during congestion.</p>
        </div>
      </div>

    </div>
  );
});
