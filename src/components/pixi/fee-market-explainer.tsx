"use client";

import { memo, useEffect, useRef, useState, useCallback } from "react";
import { Application, Graphics, Text, TextStyle } from "pixi.js";
import { useVisibility } from "@/hooks/useVisibility";
import {
  PIXI_COLORS,
  lerp,
  easings,
} from "@/lib/pixi-utils";

interface FeeMarketExplainerProps {
  className?: string;
}

const CONFIG = {
  duration: 15000, // 15 second cycle
  maxDemand: 100, // Percentage of capacity
  stateUpdateInterval: 50,
};

export const FeeMarketExplainer = memo(function FeeMarketExplainer({
  className,
}: FeeMarketExplainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const initAttemptedRef = useRef(false);

  const isPlayingRef = useRef(true);
  const startTimeRef = useRef<number>(0);
  const lastStateUpdateRef = useRef<number>(0);

  // Fee history for charts
  const auctionFeeHistoryRef = useRef<number[]>(Array(80).fill(0.01));
  const flatFeeHistoryRef = useRef<number[]>(Array(80).fill(0.0001));
  const demandHistoryRef = useRef<number[]>(Array(80).fill(10));

  const graphicsRef = useRef<{
    background: Graphics | null;
    auctionModel: Graphics | null;
    flatModel: Graphics | null;
    formula: Graphics | null;
  }>({
    background: null,
    auctionModel: null,
    flatModel: null,
    formula: null,
  });

  const textsRef = useRef<Text[]>([]);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentDemand, setCurrentDemand] = useState(10);
  const [auctionFee, setAuctionFee] = useState(0.01);

  const isVisible = useVisibility(containerRef);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const updateAnimation = useCallback(() => {
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

    // Demand pattern: ramp up, spike, sustain, drop
    let demand: number;
    if (progress < 0.2) {
      demand = lerp(10, 40, easings.easeOutQuad(progress / 0.2));
    } else if (progress < 0.4) {
      demand = lerp(40, 95, easings.easeInOutCubic((progress - 0.2) / 0.2));
    } else if (progress < 0.6) {
      demand = 95 + Math.sin((progress - 0.4) * Math.PI * 10) * 5;
    } else if (progress < 0.8) {
      demand = lerp(95, 50, easings.easeOutQuad((progress - 0.6) / 0.2));
    } else {
      demand = lerp(50, 10, easings.easeInQuad((progress - 0.8) / 0.2));
    }

    // EIP-1559 style fee calculation (exponential at high utilization)
    let calculatedAuctionFee: number;
    if (demand > 100) {
      // Way over capacity - fees explode
      calculatedAuctionFee = 0.01 * Math.pow(1.125, demand);
    } else if (demand > 80) {
      // Approaching capacity - fees start climbing
      calculatedAuctionFee = 0.01 * Math.pow(1.05, (demand - 50));
    } else if (demand > 50) {
      // Moderate - some fee pressure
      calculatedAuctionFee = 0.01 * (1 + (demand - 50) * 0.02);
    } else {
      // Low utilization - base fee
      calculatedAuctionFee = 0.01;
    }

    // Update histories
    if (elapsed % 100 < 16) {
      auctionFeeHistoryRef.current.shift();
      auctionFeeHistoryRef.current.push(calculatedAuctionFee);
      flatFeeHistoryRef.current.shift();
      flatFeeHistoryRef.current.push(0.0001);
      demandHistoryRef.current.shift();
      demandHistoryRef.current.push(demand);
    }

    // Throttle React state updates
    if (now - lastStateUpdateRef.current > CONFIG.stateUpdateInterval) {
      lastStateUpdateRef.current = now;
      setCurrentDemand(Math.round(demand));
      setAuctionFee(calculatedAuctionFee);
    }

    // Layout
    const margin = { left: 20, right: 20, top: 15, bottom: 15 };
    const centerX = width / 2;

    const titleHeight = 40;
    const modelHeight = (height - margin.top - margin.bottom - titleHeight - 100) / 2;

    const auctionY = margin.top + titleHeight;
    const flatY = auctionY + modelHeight + 30;
    const formulaY = flatY + modelHeight + 20;

    // Draw background
    const bg = graphicsRef.current.background;
    if (bg) {
      bg.clear();
      bg.rect(0, 0, width, height);
      bg.fill({ color: 0x0a0a0b });

      // Grid
      const gridAlpha = 0.025;
      bg.setStrokeStyle({ width: 1, color: 0x1f2937, alpha: gridAlpha });
      for (let x = 0; x < width; x += 20) {
        bg.moveTo(x, 0);
        bg.lineTo(x, height);
      }
      for (let y = 0; y < height; y += 20) {
        bg.moveTo(0, y);
        bg.lineTo(width, y);
      }
      bg.stroke();

      // Demand indicator bar at top
      const demandBarWidth = width - margin.left * 2 - 200;
      const demandBarX = margin.left + 100;
      const demandBarY = margin.top + 8;

      bg.roundRect(demandBarX, demandBarY, demandBarWidth, 16, 4);
      bg.fill({ color: 0x1a1a2e });

      const demandFill = (demand / 100) * demandBarWidth;
      const demandColor = demand > 80 ? PIXI_COLORS.danger : demand > 50 ? PIXI_COLORS.accent : PIXI_COLORS.secondary;
      bg.roundRect(demandBarX, demandBarY, demandFill, 16, 4);
      bg.fill({ color: demandColor, alpha: 0.8 });
    }

    // Draw auction model section
    const auction = graphicsRef.current.auctionModel;
    if (auction) {
      auction.clear();

      // Section background (red tint when high demand)
      const isHighDemand = demand > 80;
      auction.roundRect(margin.left, auctionY, width - margin.left * 2, modelHeight, 10);
      auction.fill({ color: isHighDemand ? 0x1a0d0d : 0x0d1117, alpha: 0.95 });
      auction.stroke({ width: 1, color: isHighDemand ? PIXI_COLORS.danger : PIXI_COLORS.chrome[600], alpha: 0.5 });

      // Fee chart
      const chartX = margin.left + 100;
      const chartWidth = width - margin.left * 2 - 180;
      const chartHeight = modelHeight - 60;
      const chartY = auctionY + 45;

      // Chart background
      auction.roundRect(chartX, chartY, chartWidth, chartHeight, 6);
      auction.fill({ color: 0x0a0a0b, alpha: 0.8 });

      // Y-axis scale lines
      const maxFee = Math.max(...auctionFeeHistoryRef.current, 1);
      [0.25, 0.5, 0.75, 1].forEach((pct) => {
        const y = chartY + chartHeight - chartHeight * pct;
        auction.setStrokeStyle({ width: 1, color: PIXI_COLORS.chrome[700], alpha: 0.3 });
        auction.moveTo(chartX, y);
        auction.lineTo(chartX + chartWidth, y);
        auction.stroke();
      });

      // Draw fee line
      auction.setStrokeStyle({ width: 2, color: PIXI_COLORS.danger, alpha: 0.9 });
      auctionFeeHistoryRef.current.forEach((fee, i) => {
        const x = chartX + (i / 79) * chartWidth;
        const normalizedFee = Math.min(fee / maxFee, 1);
        const y = chartY + chartHeight - 5 - normalizedFee * (chartHeight - 10);
        if (i === 0) {
          auction.moveTo(x, y);
        } else {
          auction.lineTo(x, y);
        }
      });
      auction.stroke();

      // Current fee marker
      const currentFeeY = chartY + chartHeight - 5 - (Math.min(calculatedAuctionFee / maxFee, 1) * (chartHeight - 10));
      auction.circle(chartX + chartWidth, currentFeeY, 5);
      auction.fill({ color: PIXI_COLORS.danger });

      // Fee spike indicator
      if (calculatedAuctionFee > 0.5) {
        const pulse = Math.sin(elapsed * 0.01) * 0.3 + 0.7;
        auction.circle(chartX + chartWidth, currentFeeY, 12);
        auction.fill({ color: PIXI_COLORS.danger, alpha: pulse * 0.3 });
      }

      // Current fee value box
      const feeBoxWidth = 70;
      auction.roundRect(chartX + chartWidth + 10, currentFeeY - 12, feeBoxWidth, 24, 4);
      auction.fill({ color: 0x0d1117, alpha: 0.95 });
      auction.stroke({ width: 1, color: PIXI_COLORS.danger, alpha: 0.5 });
    }

    // Draw flat model section
    const flat = graphicsRef.current.flatModel;
    if (flat) {
      flat.clear();

      // Section background (always calm green tint)
      flat.roundRect(margin.left, flatY, width - margin.left * 2, modelHeight, 10);
      flat.fill({ color: 0x0d1a14, alpha: 0.95 });
      flat.stroke({ width: 1, color: PIXI_COLORS.primary, alpha: 0.4 });

      // Fee chart
      const chartX = margin.left + 100;
      const chartWidth = width - margin.left * 2 - 180;
      const chartHeight = modelHeight - 60;
      const chartY = flatY + 45;

      // Chart background
      flat.roundRect(chartX, chartY, chartWidth, chartHeight, 6);
      flat.fill({ color: 0x0a0a0b, alpha: 0.8 });

      // Draw FLAT fee line
      const flatLineY = chartY + chartHeight - 15;
      flat.setStrokeStyle({ width: 3, color: PIXI_COLORS.primary, alpha: 0.9 });
      flat.moveTo(chartX + 5, flatLineY);
      flat.lineTo(chartX + chartWidth - 5, flatLineY);
      flat.stroke();

      // "FLAT" label
      flat.roundRect(chartX + chartWidth / 2 - 30, flatLineY - 25, 60, 18, 4);
      flat.fill({ color: PIXI_COLORS.primary, alpha: 0.2 });

      // Current fee marker
      flat.circle(chartX + chartWidth, flatLineY, 5);
      flat.fill({ color: PIXI_COLORS.primary });

      // Current fee value box
      const feeBoxWidth = 70;
      flat.roundRect(chartX + chartWidth + 10, flatLineY - 12, feeBoxWidth, 24, 4);
      flat.fill({ color: 0x0d1117, alpha: 0.95 });
      flat.stroke({ width: 1, color: PIXI_COLORS.primary, alpha: 0.5 });
    }

    // Draw formula section
    const formula = graphicsRef.current.formula;
    if (formula) {
      formula.clear();

      // Formula box
      formula.roundRect(margin.left, formulaY, width - margin.left * 2, 55, 10);
      formula.fill({ color: 0x0d1117, alpha: 0.9 });
      formula.stroke({ width: 2, color: PIXI_COLORS.primary, alpha: 0.3 });

      // Arrow indicator
      const arrowX = centerX;
      const arrowY = formulaY + 27;
      formula.setStrokeStyle({ width: 2, color: PIXI_COLORS.primary });
      formula.moveTo(arrowX - 50, arrowY);
      formula.lineTo(arrowX - 10, arrowY);
      formula.moveTo(arrowX - 20, arrowY - 6);
      formula.lineTo(arrowX - 10, arrowY);
      formula.lineTo(arrowX - 20, arrowY + 6);
      formula.stroke();

      formula.moveTo(arrowX + 10, arrowY);
      formula.lineTo(arrowX + 50, arrowY);
      formula.moveTo(arrowX + 40, arrowY - 6);
      formula.lineTo(arrowX + 50, arrowY);
      formula.lineTo(arrowX + 40, arrowY + 6);
      formula.stroke();
    }

    // Update texts
    const texts = textsRef.current;
    if (texts.length >= 15) {
      const chartX = margin.left + 100;
      const chartWidth = width - margin.left * 2 - 180;
      const chartHeight = modelHeight - 60;
      const auctionChartY = auctionY + 45;
      const flatChartY = flatY + 45;

      // Title
      texts[0].x = centerX;
      texts[0].y = margin.top - 2;
      texts[0].anchor.set(0.5, 0);

      // Demand label
      texts[1].text = `DEMAND: ${Math.round(demand)}%`;
      texts[1].x = margin.left + 60;
      texts[1].y = margin.top + 9;
      texts[1].anchor.set(0, 0);

      // Auction model header
      texts[2].x = margin.left + 15;
      texts[2].y = auctionY + 12;

      // Auction description
      texts[3].x = margin.left + 15;
      texts[3].y = auctionY + 28;

      // Auction Y-axis label
      texts[4].x = chartX - 10;
      texts[4].y = auctionChartY + chartHeight / 2;
      texts[4].anchor.set(1, 0.5);
      texts[4].rotation = -Math.PI / 2;

      // Auction current fee
      const feeStr = calculatedAuctionFee >= 100 ? `$${calculatedAuctionFee.toFixed(0)}` :
                     calculatedAuctionFee >= 1 ? `$${calculatedAuctionFee.toFixed(1)}` :
                     `$${calculatedAuctionFee.toFixed(2)}`;
      texts[5].text = feeStr;
      texts[5].x = chartX + chartWidth + 45;
      const maxFee = Math.max(...auctionFeeHistoryRef.current, 1);
      const currentFeeY = auctionChartY + chartHeight - 5 - (Math.min(calculatedAuctionFee / maxFee, 1) * (chartHeight - 10));
      texts[5].y = currentFeeY;
      texts[5].anchor.set(0.5, 0.5);

      // Flat model header
      texts[6].x = margin.left + 15;
      texts[6].y = flatY + 12;

      // Flat description
      texts[7].x = margin.left + 15;
      texts[7].y = flatY + 28;

      // Flat "FLAT" label
      texts[8].x = chartX + chartWidth / 2;
      texts[8].y = flatChartY + chartHeight - 25;
      texts[8].anchor.set(0.5, 0);

      // Flat current fee
      texts[9].text = "$0.0001";
      texts[9].x = chartX + chartWidth + 45;
      texts[9].y = flatChartY + chartHeight - 15;
      texts[9].anchor.set(0.5, 0.5);

      // Formula texts
      texts[10].text = "capacity >> demand";
      texts[10].x = centerX - 120;
      texts[10].y = formulaY + 18;
      texts[10].anchor.set(0.5, 0);

      texts[11].text = "no congestion";
      texts[11].x = centerX;
      texts[11].y = formulaY + 18;
      texts[11].anchor.set(0.5, 0);

      texts[12].text = "flat fees";
      texts[12].x = centerX + 120;
      texts[12].y = formulaY + 18;
      texts[12].anchor.set(0.5, 0);

      texts[13].text = "160,000 TPS";
      texts[13].x = centerX - 120;
      texts[13].y = formulaY + 35;
      texts[13].anchor.set(0.5, 0);

      texts[14].text = "$0.0001 always";
      texts[14].x = centerX + 120;
      texts[14].y = formulaY + 35;
      texts[14].anchor.set(0.5, 0);
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
      auctionModel: new Graphics(),
      flatModel: new Graphics(),
      formula: new Graphics(),
    };

    app.stage.addChild(graphicsRef.current.background!);
    app.stage.addChild(graphicsRef.current.auctionModel!);
    app.stage.addChild(graphicsRef.current.flatModel!);
    app.stage.addChild(graphicsRef.current.formula!);

    // Text styles
    const titleStyle = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 13,
      fontWeight: "800",
      fill: 0xffffff,
      letterSpacing: 1,
    });

    const demandStyle = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 10,
      fontWeight: "600",
      fill: PIXI_COLORS.chrome[400],
    });

    const headerBad = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 11,
      fontWeight: "700",
      fill: PIXI_COLORS.danger,
      letterSpacing: 0.5,
    });

    const headerGood = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 11,
      fontWeight: "700",
      fill: PIXI_COLORS.primary,
      letterSpacing: 0.5,
    });

    const descStyle = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 9,
      fontWeight: "500",
      fill: PIXI_COLORS.chrome[500],
    });

    const axisStyle = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 9,
      fontWeight: "600",
      fill: PIXI_COLORS.chrome[500],
    });

    const feeBad = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 12,
      fontWeight: "800",
      fill: PIXI_COLORS.danger,
    });

    const feeGood = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 12,
      fontWeight: "800",
      fill: PIXI_COLORS.primary,
    });

    const flatLabel = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 10,
      fontWeight: "700",
      fill: PIXI_COLORS.primary,
    });

    const formulaStyle = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 12,
      fontWeight: "700",
      fill: PIXI_COLORS.primary,
    });

    const formulaSubStyle = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 9,
      fontWeight: "600",
      fill: PIXI_COLORS.chrome[400],
    });

    textsRef.current = [
      new Text({ text: "WHY APTOS FEES DON'T SPIKE", style: titleStyle }),
      new Text({ text: "DEMAND: 10%", style: demandStyle }),
      new Text({ text: "FEE AUCTION MODEL (EIP-1559)", style: headerBad }),
      new Text({ text: "Block space scarce (15-30 TPS). Users bid for inclusion.", style: descStyle }),
      new Text({ text: "FEE $", style: axisStyle }),
      new Text({ text: "$0.01", style: feeBad }),
      new Text({ text: "FIXED FLOOR MODEL (APTOS)", style: headerGood }),
      new Text({ text: "Block space abundant (160K TPS). No auction needed.", style: descStyle }),
      new Text({ text: "FLAT", style: flatLabel }),
      new Text({ text: "$0.0001", style: feeGood }),
      new Text({ text: "capacity >> demand", style: formulaStyle }),
      new Text({ text: "no congestion", style: formulaStyle }),
      new Text({ text: "flat fees", style: formulaStyle }),
      new Text({ text: "160,000 TPS", style: formulaSubStyle }),
      new Text({ text: "$0.0001 always", style: formulaSubStyle }),
    ];

    textsRef.current.forEach((t) => app.stage.addChild(t));

    startTimeRef.current = performance.now();
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
    initPixi();

    return () => {
      resizeObserver.disconnect();
      if (appRef.current) {
        const canvas = appRef.current.canvas as HTMLCanvasElement;
        appRef.current.destroy(true, { children: true });
        if (canvas && container.contains(canvas)) container.removeChild(canvas);
        appRef.current = null;
      }
      initAttemptedRef.current = false;
      setIsReady(false);
    };
  }, [initPixi]);

  useEffect(() => {
    if (!appRef.current) return;
    if (isVisible && isPlaying) {
      appRef.current.ticker.start();
    } else {
      appRef.current.ticker.stop();
    }
  }, [isVisible, isPlaying]);

  const handlePlayPause = () => {
    const newState = !isPlaying;
    setIsPlaying(newState);
    if (newState) {
      startTimeRef.current = performance.now();
    }
  };

  const handleRestart = () => {
    startTimeRef.current = performance.now();
    auctionFeeHistoryRef.current = Array(80).fill(0.01);
    flatFeeHistoryRef.current = Array(80).fill(0.0001);
    demandHistoryRef.current = Array(80).fill(10);
    setIsPlaying(true);
  };

  return (
    <div className={`chrome-card p-4 sm:p-6 ${className || ""}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="section-title">Fee Market Economics</h3>
          <p className="text-xs" style={{ color: "var(--chrome-500)" }}>
            Why capacity matters more than fee market design
          </p>
        </div>
        <div className="flex items-center gap-2">
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

      <div className="metric-grid grid-cols-3 mb-4">
        <div className="metric-cell">
          <div className="stat-value text-lg" style={{ color: currentDemand > 80 ? "var(--danger)" : "var(--secondary)" }}>
            {currentDemand}%
          </div>
          <div className="stat-label">Network Demand</div>
        </div>
        <div className="metric-cell">
          <div className="stat-value text-lg" style={{ color: "var(--danger)" }}>
            ${auctionFee >= 100 ? auctionFee.toFixed(0) : auctionFee >= 1 ? auctionFee.toFixed(1) : auctionFee.toFixed(2)}
          </div>
          <div className="stat-label">Auction Fee</div>
        </div>
        <div className="metric-cell">
          <div className="stat-value text-lg" style={{ color: "var(--accent)" }}>
            $0.0001
          </div>
          <div className="stat-label">Aptos Fee</div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="canvas-wrap relative rounded-lg overflow-hidden"
        style={{ height: "360px", backgroundColor: "#0a0a0b" }}
      >
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-sm" style={{ color: "var(--chrome-500)" }}>
              Loading visualization...
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="p-3 rounded-lg" style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
          <h4 className="text-xs font-bold mb-1" style={{ color: "var(--danger)" }}>
            Fee Auction Model
          </h4>
          <p className="text-xs" style={{ color: "var(--chrome-400)" }}>
            When demand approaches capacity, users bid against each other. Fees spike exponentially with EIP-1559.
          </p>
        </div>
        <div className="p-3 rounded-lg" style={{ backgroundColor: "rgba(0, 217, 165, 0.08)", border: "1px solid rgba(0, 217, 165, 0.2)" }}>
          <h4 className="text-xs font-bold mb-1" style={{ color: "var(--accent)" }}>
            Fixed Floor Model
          </h4>
          <p className="text-xs" style={{ color: "var(--chrome-400)" }}>
            When capacity vastly exceeds demand, no auction is needed. Governance sets a flat minimum fee.
          </p>
        </div>
      </div>
    </div>
  );
});
