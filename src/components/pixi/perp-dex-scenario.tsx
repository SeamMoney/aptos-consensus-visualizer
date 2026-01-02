"use client";

import { memo, useEffect, useRef, useState, useCallback } from "react";
import { Application, Graphics, Text, TextStyle } from "pixi.js";
import { useVisibility } from "@/hooks/useVisibility";
import {
  PIXI_COLORS,
  formatNumber,
  lerp,
  easings,
} from "@/lib/pixi-utils";

interface PerpDexScenarioProps {
  className?: string;
}

const CONFIG = {
  duration: 20000, // 20 second cycle
  startPrice: 67000,
  crashPrice: 58000,
  maxOrders: 47000,
  maxLiquidations: 12847,
  stateUpdateInterval: 50,
  maxParticles: 300,
};

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  isLiquidation: boolean;
}

export const PerpDexScenario = memo(function PerpDexScenario({
  className,
}: PerpDexScenarioProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const initAttemptedRef = useRef(false);
  const mountedRef = useRef(true);

  const isPlayingRef = useRef(true);
  const startTimeRef = useRef<number>(0);
  const lastStateUpdateRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);

  // Price history
  const priceHistoryRef = useRef<number[]>(Array(100).fill(CONFIG.startPrice));

  const graphicsRef = useRef<{
    background: Graphics | null;
    priceChart: Graphics | null;
    orderFlow: Graphics | null;
    stats: Graphics | null;
    particles: Graphics | null;
  }>({
    background: null,
    priceChart: null,
    orderFlow: null,
    stats: null,
    particles: null,
  });

  const textsRef = useRef<Text[]>([]);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentPrice, setCurrentPrice] = useState(CONFIG.startPrice);
  const [ordersPerSec, setOrdersPerSec] = useState(5000);
  const [liquidations, setLiquidations] = useState(0);
  const [phase, setPhase] = useState("STABLE");

  const isVisible = useVisibility(containerRef);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const updateAnimation = useCallback(() => {
    if (!mountedRef.current) return;
    const app = appRef.current;
    const container = containerRef.current;
    if (!app || !container) return;

    const now = performance.now();
    const elapsed = now - startTimeRef.current;
    const progress = (elapsed % CONFIG.duration) / CONFIG.duration;

    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    if (Math.abs(app.screen.width - width) > 1 || Math.abs(app.screen.height - height) > 1) {
      app.renderer.resize(width, height);
    }

    // Price pattern: stable -> sudden crash -> gradual recovery
    let price: number;
    let phaseName: string;
    let crashIntensity: number;

    if (progress < 0.2) {
      // Stable with minor fluctuations
      price = CONFIG.startPrice + Math.sin(progress * 50) * 200;
      phaseName = "STABLE";
      crashIntensity = 0;
    } else if (progress < 0.35) {
      // FLASH CRASH
      const crashProgress = (progress - 0.2) / 0.15;
      price = lerp(CONFIG.startPrice, CONFIG.crashPrice, easings.easeInQuad(crashProgress));
      phaseName = "FLASH CRASH";
      crashIntensity = crashProgress;
    } else if (progress < 0.5) {
      // Bottom with volatility
      price = CONFIG.crashPrice + Math.sin(progress * 100) * 500 + (progress - 0.35) * 10000;
      phaseName = "LIQUIDATIONS";
      crashIntensity = 1 - (progress - 0.35) / 0.15;
    } else if (progress < 0.8) {
      // Recovery
      const recoveryProgress = (progress - 0.5) / 0.3;
      price = lerp(CONFIG.crashPrice + 1500, CONFIG.startPrice - 2000, easings.easeOutQuad(recoveryProgress));
      phaseName = "RECOVERY";
      crashIntensity = 0;
    } else {
      // Stabilizing
      price = CONFIG.startPrice - 2000 + (progress - 0.8) * 10000 + Math.sin(progress * 30) * 100;
      phaseName = "STABLE";
      crashIntensity = 0;
    }

    // Calculate orders and liquidations
    const orders = crashIntensity > 0.3
      ? lerp(5000, CONFIG.maxOrders, crashIntensity)
      : lerp(5000, 15000, Math.abs(Math.sin(progress * 10)));

    const liqs = phaseName === "LIQUIDATIONS"
      ? Math.round(CONFIG.maxLiquidations * (1 - (progress - 0.35) / 0.15))
      : phaseName === "FLASH CRASH"
      ? Math.round(CONFIG.maxLiquidations * crashIntensity * 0.3)
      : 0;

    // Update price history
    if (elapsed % 80 < 16) {
      priceHistoryRef.current.shift();
      priceHistoryRef.current.push(price);
    }

    // Throttle React state updates
    if (now - lastStateUpdateRef.current > CONFIG.stateUpdateInterval) {
      lastStateUpdateRef.current = now;
      setCurrentPrice(Math.round(price));
      setOrdersPerSec(Math.round(orders));
      setLiquidations(liqs);
      setPhase(phaseName);
    }

    // Layout - responsive for mobile/desktop
    const isMobile = width < 400;
    const margin = { left: 15, right: 15, top: 10, bottom: 10 };
    const centerX = width / 2;

    const titleHeight = 35;
    const priceChartHeight = height * 0.38;
    const orderFlowHeight = height * 0.28;
    const statsHeight = height * 0.18;

    const priceChartY = margin.top + titleHeight;
    const orderFlowY = priceChartY + priceChartHeight + 10;
    const statsY = orderFlowY + orderFlowHeight + 10;

    // Draw background
    const bg = graphicsRef.current.background;
    if (bg) {
      bg.clear();
      bg.rect(0, 0, width, height);
      bg.fill({ color: 0x0a0a0b });

      // Grid
      const gridAlpha = crashIntensity > 0.5 ? 0.04 : 0.025;
      bg.setStrokeStyle({ width: 1, color: crashIntensity > 0.5 ? 0x3f1f1f : 0x1f2937, alpha: gridAlpha });
      for (let x = 0; x < width; x += 20) {
        bg.moveTo(x, 0);
        bg.lineTo(x, height);
      }
      for (let y = 0; y < height; y += 20) {
        bg.moveTo(0, y);
        bg.lineTo(width, y);
      }
      bg.stroke();

      // Flash effect during crash
      if (crashIntensity > 0.5) {
        const flash = Math.sin(elapsed * 0.02) * 0.1 + 0.1;
        bg.rect(0, 0, width, height);
        bg.fill({ color: PIXI_COLORS.danger, alpha: flash * crashIntensity });
      }
    }

    // Draw price chart
    const priceChart = graphicsRef.current.priceChart;
    if (priceChart) {
      priceChart.clear();

      // Section background
      priceChart.roundRect(margin.left, priceChartY, width - margin.left * 2, priceChartHeight, 10);
      priceChart.fill({ color: crashIntensity > 0.3 ? 0x1a0d0d : 0x0d1117, alpha: 0.95 });
      priceChart.stroke({ width: 1, color: crashIntensity > 0.3 ? PIXI_COLORS.danger : PIXI_COLORS.chrome[600], alpha: 0.5 });

      // Chart area
      const chartX = margin.left + 60;
      const chartWidth = width - margin.left * 2 - 80;
      const chartHeight = priceChartHeight - 55;
      const chartY = priceChartY + 40;

      // Chart background
      priceChart.roundRect(chartX, chartY, chartWidth, chartHeight, 6);
      priceChart.fill({ color: 0x0a0a0b, alpha: 0.8 });

      // Price range
      const minPrice = Math.min(...priceHistoryRef.current) - 500;
      const maxPrice = Math.max(...priceHistoryRef.current) + 500;
      const priceRange = maxPrice - minPrice;

      // Draw price line
      priceChart.setStrokeStyle({ width: 2, color: crashIntensity > 0.3 ? PIXI_COLORS.danger : PIXI_COLORS.primary, alpha: 0.9 });
      priceHistoryRef.current.forEach((p, i) => {
        const x = chartX + (i / 99) * chartWidth;
        const y = chartY + chartHeight - 10 - ((p - minPrice) / priceRange) * (chartHeight - 20);
        if (i === 0) {
          priceChart.moveTo(x, y);
        } else {
          priceChart.lineTo(x, y);
        }
      });
      priceChart.stroke();

      // Current price marker
      const currentY = chartY + chartHeight - 10 - ((price - minPrice) / priceRange) * (chartHeight - 20);
      priceChart.circle(chartX + chartWidth, currentY, 6);
      priceChart.fill({ color: crashIntensity > 0.3 ? PIXI_COLORS.danger : PIXI_COLORS.primary });

      // Crash zone indicator
      if (crashIntensity > 0) {
        const crashStartX = chartX + chartWidth * 0.2;
        const pulse = Math.sin(elapsed * 0.01) * 0.2 + 0.3;
        priceChart.rect(crashStartX, chartY, chartWidth * 0.3, chartHeight);
        priceChart.fill({ color: PIXI_COLORS.danger, alpha: pulse * crashIntensity });
      }

      // Price labels
      const priceY = chartY + chartHeight - 10 - ((price - minPrice) / priceRange) * (chartHeight - 20);
      priceChart.roundRect(chartX + chartWidth + 5, priceY - 12, 55, 24, 4);
      priceChart.fill({ color: 0x0d1117, alpha: 0.95 });
      priceChart.stroke({ width: 1, color: crashIntensity > 0.3 ? PIXI_COLORS.danger : PIXI_COLORS.primary, alpha: 0.5 });
    }

    // Draw order flow
    const orderFlow = graphicsRef.current.orderFlow;
    if (orderFlow) {
      orderFlow.clear();

      // Section background
      orderFlow.roundRect(margin.left, orderFlowY, width - margin.left * 2, orderFlowHeight, 10);
      orderFlow.fill({ color: 0x0d1117, alpha: 0.95 });
      orderFlow.stroke({ width: 1, color: PIXI_COLORS.chrome[600], alpha: 0.4 });

      // Order flow bar
      const barX = margin.left + 120;
      const barWidth = width - margin.left * 2 - 150;
      const barY = orderFlowY + 35;
      const barHeight = 30;

      orderFlow.roundRect(barX, barY, barWidth, barHeight, 6);
      orderFlow.fill({ color: 0x1a1a2e });

      // Order intensity fill
      const orderRatio = orders / CONFIG.maxOrders;
      const fillWidth = barWidth * orderRatio;
      const orderColor = orderRatio > 0.7 ? PIXI_COLORS.accent : PIXI_COLORS.secondary;

      orderFlow.roundRect(barX, barY, fillWidth, barHeight, 6);
      orderFlow.fill({ color: orderColor, alpha: 0.8 });

      // Pulsing edge
      if (orderRatio > 0.5) {
        const pulse = Math.sin(elapsed * 0.008) * 0.3 + 0.7;
        orderFlow.roundRect(barX + fillWidth - 8, barY + 4, 12, barHeight - 8, 3);
        orderFlow.fill({ color: 0xffffff, alpha: pulse * 0.4 });
      }

      // Liquidation progress bar (below)
      if (liqs > 0) {
        const liqBarY = barY + barHeight + 10;
        const liqBarHeight = 20;

        orderFlow.roundRect(barX, liqBarY, barWidth, liqBarHeight, 4);
        orderFlow.fill({ color: 0x1a0d0d });

        const liqRatio = liqs / CONFIG.maxLiquidations;
        orderFlow.roundRect(barX, liqBarY, barWidth * liqRatio, liqBarHeight, 4);
        orderFlow.fill({ color: PIXI_COLORS.danger, alpha: 0.9 });

        // Flash effect
        const flash = Math.sin(elapsed * 0.015) * 0.3 + 0.7;
        orderFlow.roundRect(barX, liqBarY, barWidth * liqRatio, liqBarHeight, 4);
        orderFlow.stroke({ width: 2, color: 0xffffff, alpha: flash * 0.3 });
      }
    }

    // Draw particles
    const particles = graphicsRef.current.particles;
    if (particles) {
      particles.clear();

      // Spawn particles based on activity
      const spawnRate = (orders / CONFIG.maxOrders) * 5;
      for (let i = 0; i < spawnRate; i++) {
        if (particlesRef.current.length < CONFIG.maxParticles) {
          const isLiquidation = liqs > 0 && Math.random() < 0.3;
          particlesRef.current.push({
            x: margin.left + Math.random() * 30,
            y: orderFlowY + 20 + Math.random() * (orderFlowHeight - 40),
            vx: 3 + Math.random() * 3,
            vy: (Math.random() - 0.5) * 0.5,
            size: 2 + Math.random() * 2,
            alpha: 0.9,
            isLiquidation,
          });
        }
      }

      // Update and draw particles
      particlesRef.current = particlesRef.current.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x > width - margin.right - 30) {
          p.alpha -= 0.08;
        }

        if (p.alpha > 0.1) {
          const color = p.isLiquidation ? PIXI_COLORS.danger : PIXI_COLORS.secondary;

          // Trail
          particles.setStrokeStyle({ width: p.size * 0.4, color, alpha: p.alpha * 0.3 });
          particles.moveTo(p.x - p.vx * 3, p.y);
          particles.lineTo(p.x, p.y);
          particles.stroke();

          // Core
          particles.circle(p.x, p.y, p.size);
          particles.fill({ color, alpha: p.alpha * 0.8 });
        }

        return p.x < width && p.alpha > 0.05;
      });
    }

    // Draw stats section
    const stats = graphicsRef.current.stats;
    if (stats) {
      stats.clear();

      const statSpacing = 10;
      const statWidth = (width - margin.left * 2 - statSpacing * 2) / 3;
      const statHeight = 45;

      // Gas fee box
      stats.roundRect(margin.left, statsY, statWidth, statHeight, 6);
      stats.fill({ color: 0x0d1a14, alpha: 0.95 });
      stats.stroke({ width: 1, color: PIXI_COLORS.primary, alpha: 0.4 });

      // Slippage box
      stats.roundRect(margin.left + statWidth + statSpacing, statsY, statWidth, statHeight, 6);
      stats.fill({ color: 0x0d1a14, alpha: 0.95 });
      stats.stroke({ width: 1, color: PIXI_COLORS.primary, alpha: 0.4 });

      // Failed txs box
      stats.roundRect(margin.left + (statWidth + statSpacing) * 2, statsY, statWidth, statHeight, 6);
      stats.fill({ color: 0x0d1a14, alpha: 0.95 });
      stats.stroke({ width: 1, color: PIXI_COLORS.success, alpha: 0.4 });
    }

    // Update texts
    const texts = textsRef.current;
    if (texts.length >= 16) {
      const statWidth = (width - margin.left * 2 - 20) / 3;

      // Title - left aligned on mobile to avoid overlap
      texts[0].x = margin.left + 10;
      texts[0].y = margin.top + 3;
      texts[0].anchor.set(0, 0);

      // Phase indicator - stays right
      texts[1].text = phaseName;
      texts[1].x = width - margin.right - 10;
      texts[1].y = margin.top + 3;
      texts[1].anchor.set(1, 0);
      texts[1].style.fill = crashIntensity > 0.3 ? PIXI_COLORS.danger : PIXI_COLORS.chrome[400];

      // Price section header
      texts[2].x = margin.left + 10;
      texts[2].y = priceChartY + 8;

      // Current price
      texts[3].text = `$${price.toLocaleString()}`;
      texts[3].x = width - margin.right - 55;
      texts[3].y = priceChartY + priceChartHeight / 2;
      texts[3].anchor.set(0.5, 0.5);

      // Order flow header
      texts[4].x = margin.left + 10;
      texts[4].y = orderFlowY + 8;

      // Orders/sec value
      texts[5].text = `${formatNumber(Math.round(orders))}/sec`;
      texts[5].x = margin.left + 75;
      texts[5].y = orderFlowY + 38;

      // Liquidations label
      texts[6].text = liqs > 0 ? `LIQUIDATIONS: ${formatNumber(liqs)}` : "LIQUIDATIONS: 0";
      texts[6].x = margin.left + 10;
      texts[6].y = orderFlowY + 70;
      texts[6].style.fill = liqs > 0 ? PIXI_COLORS.danger : PIXI_COLORS.chrome[500];

      // Stats labels and values - adjusted spacing
      const statSpacing = 10;
      texts[7].x = margin.left + statWidth / 2;
      texts[7].y = statsY + 8;
      texts[7].anchor.set(0.5, 0);

      texts[8].text = "$0.00012";
      texts[8].x = margin.left + statWidth / 2;
      texts[8].y = statsY + 24;
      texts[8].anchor.set(0.5, 0);

      texts[9].x = margin.left + statWidth + statSpacing + statWidth / 2;
      texts[9].y = statsY + 8;
      texts[9].anchor.set(0.5, 0);

      texts[10].text = "0.02%";
      texts[10].x = margin.left + statWidth + statSpacing + statWidth / 2;
      texts[10].y = statsY + 24;
      texts[10].anchor.set(0.5, 0);

      texts[11].x = margin.left + (statWidth + statSpacing) * 2 + statWidth / 2;
      texts[11].y = statsY + 8;
      texts[11].anchor.set(0.5, 0);

      texts[12].text = "0";
      texts[12].x = margin.left + (statWidth + statSpacing) * 2 + statWidth / 2;
      texts[12].y = statsY + 24;
      texts[12].anchor.set(0.5, 0);

      // Bottom message - hidden on very small screens
      if (width > 350) {
        texts[13].text = "Even during flash crash: fees flat, zero failed txs";
        texts[13].visible = true;
      } else {
        texts[13].visible = false;
      }
      texts[13].x = centerX;
      texts[13].y = height - margin.bottom - 3;
      texts[13].anchor.set(0.5, 1);
    }
  }, []);

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

    container.appendChild(app.canvas as HTMLCanvasElement);
    appRef.current = app;

    graphicsRef.current = {
      background: new Graphics(),
      priceChart: new Graphics(),
      orderFlow: new Graphics(),
      stats: new Graphics(),
      particles: new Graphics(),
    };

    app.stage.addChild(graphicsRef.current.background!);
    app.stage.addChild(graphicsRef.current.priceChart!);
    app.stage.addChild(graphicsRef.current.orderFlow!);
    app.stage.addChild(graphicsRef.current.particles!);
    app.stage.addChild(graphicsRef.current.stats!);

    // Text styles
    const titleStyle = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 14,
      fontWeight: "800",
      fill: 0xffffff,
      letterSpacing: 1,
    });

    const phaseStyle = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 11,
      fontWeight: "700",
      fill: PIXI_COLORS.chrome[400],
      letterSpacing: 0.5,
    });

    const headerStyle = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 11,
      fontWeight: "700",
      fill: PIXI_COLORS.chrome[400],
    });

    const priceStyle = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 14,
      fontWeight: "800",
      fill: PIXI_COLORS.primary,
    });

    const valueStyle = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 11,
      fontWeight: "700",
      fill: PIXI_COLORS.secondary,
    });

    const liqStyle = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 10,
      fontWeight: "600",
      fill: PIXI_COLORS.chrome[500],
    });

    const labelStyle = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 9,
      fontWeight: "600",
      fill: PIXI_COLORS.chrome[500],
    });

    const statValue = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 14,
      fontWeight: "800",
      fill: PIXI_COLORS.primary,
    });

    const successValue = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 14,
      fontWeight: "800",
      fill: PIXI_COLORS.success,
    });

    const messageStyle = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 10,
      fontWeight: "600",
      fill: PIXI_COLORS.chrome[400],
    });

    textsRef.current = [
      new Text({ text: "BTC FLASH CRASH: PERP DEX STRESS TEST", style: titleStyle }),
      new Text({ text: "STABLE", style: phaseStyle }),
      new Text({ text: "BTC PRICE", style: headerStyle }),
      new Text({ text: "$67,000", style: priceStyle }),
      new Text({ text: "MARKET ORDERS", style: headerStyle }),
      new Text({ text: "5,000/sec", style: valueStyle }),
      new Text({ text: "LIQUIDATIONS: 0", style: liqStyle }),
      new Text({ text: "GAS FEE", style: labelStyle }),
      new Text({ text: "$0.00012", style: statValue }),
      new Text({ text: "SLIPPAGE", style: labelStyle }),
      new Text({ text: "0.02%", style: statValue }),
      new Text({ text: "FAILED TXS", style: labelStyle }),
      new Text({ text: "0", style: successValue }),
      new Text({ text: "Even during flash crash: fees flat, zero failed transactions", style: messageStyle }),
    ];

    textsRef.current.forEach((t) => app.stage.addChild(t));

    startTimeRef.current = performance.now();
    mountedRef.current = true;
    setIsReady(true);

    app.ticker.add(updateAnimation);
  }, [updateAnimation]);

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

    // Small delay to ensure DOM is ready
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
        // Stop ticker to prevent render during cleanup
        appRef.current.ticker.stop();

        const canvas = appRef.current.canvas as HTMLCanvasElement;
        try {
          appRef.current.destroy(true, { children: true });
        } catch {
          // Ignore cleanup errors during HMR
        }
        if (canvas && container.contains(canvas)) container.removeChild(canvas);
        appRef.current = null;
      }
      graphicsRef.current = {
        background: null,
        priceChart: null,
        orderFlow: null,
        stats: null,
        particles: null,
      };
      textsRef.current = [];
      initAttemptedRef.current = false;
      setIsReady(false);
    };
  }, [initPixi]);

  useEffect(() => {
    if (!appRef.current) return;
    if (isVisible && isPlaying) {
      appRef.current.ticker.start();
      // Force a redraw when becoming visible
      updateAnimation();
    } else {
      appRef.current.ticker.stop();
    }
  }, [isVisible, isPlaying, updateAnimation]);

  const handlePlayPause = () => {
    const newState = !isPlaying;
    setIsPlaying(newState);
    if (newState) {
      startTimeRef.current = performance.now();
      particlesRef.current = [];
    }
  };

  const handleRestart = () => {
    startTimeRef.current = performance.now();
    particlesRef.current = [];
    priceHistoryRef.current = Array(100).fill(CONFIG.startPrice);
    setIsPlaying(true);
  };

  return (
    <div className={`chrome-card p-4 sm:p-6 ${className || ""}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="section-title">Perp DEX Stress Test</h3>
          <p className="text-xs" style={{ color: "var(--chrome-500)" }}>
            BTC flash crash with mass liquidations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="px-2 py-1 text-xs rounded font-semibold"
            style={{
              backgroundColor: phase === "FLASH CRASH" || phase === "LIQUIDATIONS"
                ? "rgba(239, 68, 68, 0.2)"
                : "rgba(255, 255, 255, 0.05)",
              color: phase === "FLASH CRASH" || phase === "LIQUIDATIONS"
                ? "#ef4444"
                : "var(--chrome-400)"
            }}
          >
            {phase}
          </span>
          <button
            onClick={handlePlayPause}
            className="px-3 py-1 text-sm rounded border transition-colors hover:bg-white/5"
            style={{ borderColor: "var(--chrome-700)", color: "var(--chrome-300)" }}
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button
            onClick={handleRestart}
            className="px-3 py-1 text-sm rounded border transition-colors hover:bg-white/5"
            style={{ borderColor: "var(--chrome-700)", color: "var(--chrome-300)" }}
          >
            Restart
          </button>
        </div>
      </div>

      <div className="metric-grid grid-cols-4 mb-4">
        <div className="metric-cell">
          <div className="stat-value text-lg" style={{ color: phase === "FLASH CRASH" ? "var(--danger)" : "var(--chrome-300)" }}>
            ${currentPrice.toLocaleString()}
          </div>
          <div className="stat-label">BTC Price</div>
        </div>
        <div className="metric-cell">
          <div className="stat-value text-lg" style={{ color: "var(--secondary)" }}>
            {formatNumber(ordersPerSec)}/s
          </div>
          <div className="stat-label">Orders</div>
        </div>
        <div className="metric-cell">
          <div className="stat-value text-lg" style={{ color: liquidations > 0 ? "var(--danger)" : "var(--chrome-400)" }}>
            {formatNumber(liquidations)}
          </div>
          <div className="stat-label">Liquidations</div>
        </div>
        <div className="metric-cell">
          <div className="stat-value text-lg" style={{ color: "var(--accent)" }}>
            $0.00012
          </div>
          <div className="stat-label">Gas Fee</div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="canvas-wrap relative rounded-lg overflow-hidden"
        style={{ height: "400px", backgroundColor: "#0a0a0b" }}
      >
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-sm" style={{ color: "var(--chrome-500)" }}>
              Loading visualization...
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: "rgba(0, 217, 165, 0.08)", border: "1px solid rgba(0, 217, 165, 0.2)" }}>
        <h4 className="text-sm font-bold mb-2" style={{ color: "var(--accent)" }}>
          Flash Crash Resilience
        </h4>
        <p className="text-xs" style={{ color: "var(--chrome-400)" }}>
          47,000 orders/sec during a -13% BTC crash with 12,000+ liquidations. On Aptos: fees stay at $0.00012,
          zero failed transactions, 0.02% slippage. Block-STM handles the chaos at 30% capacity.
        </p>
      </div>
    </div>
  );
});
