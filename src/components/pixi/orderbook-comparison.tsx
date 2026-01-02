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

interface OrderbookComparisonProps {
  className?: string;
}

const CONFIG = {
  duration: 20000, // 20 second cycle
  aptosCapacity: 160000,
  otherCapacity: 15, // Typical L1 TPS
  maxOrders: 50000,
  minOrders: 2000,
  aptosBaseFee: 0.0001,
  stateUpdateInterval: 50,
  maxParticles: 200,
};

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  failed: boolean;
}

export const OrderbookComparison = memo(function OrderbookComparison({
  className,
}: OrderbookComparisonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const initAttemptedRef = useRef(false);

  const isPlayingRef = useRef(true);
  const startTimeRef = useRef<number>(0);
  const particlesLeftRef = useRef<Particle[]>([]);
  const particlesRightRef = useRef<Particle[]>([]);
  const lastStateUpdateRef = useRef<number>(0);

  // Fee history for line graphs
  const otherFeeHistoryRef = useRef<number[]>(Array(60).fill(0.01));
  const aptosFeeHistoryRef = useRef<number[]>(Array(60).fill(0.0001));

  const graphicsRef = useRef<{
    background: Graphics | null;
    leftPanel: Graphics | null;
    rightPanel: Graphics | null;
    particles: Graphics | null;
    graphs: Graphics | null;
  }>({
    background: null,
    leftPanel: null,
    rightPanel: null,
    particles: null,
    graphs: null,
  });

  const textsRef = useRef<Text[]>([]);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentOrders, setCurrentOrders] = useState(CONFIG.minOrders);
  const [otherFee, setOtherFee] = useState(0.01);
  const [otherFailed, setOtherFailed] = useState(0);

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

    // Order load pattern: ramp up, peak, sustain, ramp down
    let loadIntensity: number;
    if (progress < 0.15) {
      loadIntensity = easings.easeOutQuad(progress / 0.15) * 0.3;
    } else if (progress < 0.35) {
      loadIntensity = 0.3 + easings.easeInOutCubic((progress - 0.15) / 0.2) * 0.7;
    } else if (progress < 0.7) {
      loadIntensity = 1.0 + Math.sin((progress - 0.35) * Math.PI * 6) * 0.1;
    } else {
      loadIntensity = 1.0 - easings.easeInQuad((progress - 0.7) / 0.3) * 0.7;
    }

    const orders = lerp(CONFIG.minOrders, CONFIG.maxOrders, loadIntensity);
    const otherUtilization = orders / CONFIG.otherCapacity;
    const aptosUtilization = orders / CONFIG.aptosCapacity;

    // Other chain fee calculation (EIP-1559 style - exponential under load)
    let calculatedOtherFee: number;
    if (otherUtilization > 1) {
      // Overloaded - fees spike exponentially
      const overload = Math.min(otherUtilization, 100);
      calculatedOtherFee = 0.01 * Math.pow(1.5, overload);
      calculatedOtherFee = Math.min(calculatedOtherFee, 1000); // Cap at $1000
    } else {
      calculatedOtherFee = 0.01 + otherUtilization * 0.05;
    }

    // Failed transactions on other chain
    const failRate = otherUtilization > 1 ? Math.min((otherUtilization - 1) / otherUtilization, 0.6) : 0;
    const failedCount = Math.round(orders * failRate);

    // Update fee history
    if (elapsed % 200 < 16) {
      otherFeeHistoryRef.current.shift();
      otherFeeHistoryRef.current.push(calculatedOtherFee);
      aptosFeeHistoryRef.current.shift();
      aptosFeeHistoryRef.current.push(CONFIG.aptosBaseFee);
    }

    // Throttle React state updates
    if (now - lastStateUpdateRef.current > CONFIG.stateUpdateInterval) {
      lastStateUpdateRef.current = now;
      setCurrentOrders(Math.round(orders));
      setOtherFee(calculatedOtherFee);
      setOtherFailed(failedCount);
    }

    // Layout
    const margin = { left: 15, right: 15, top: 15, bottom: 15 };
    const centerX = width / 2;
    const panelWidth = (width - margin.left * 2 - 20) / 2;
    const leftX = margin.left;
    const rightX = centerX + 10;

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

      // Center divider
      bg.setStrokeStyle({ width: 2, color: 0x374151, alpha: 0.5 });
      bg.moveTo(centerX, margin.top + 40);
      bg.lineTo(centerX, height - margin.bottom);
      bg.stroke();
    }

    // Left panel - Other Chain (bad)
    const leftPanel = graphicsRef.current.leftPanel;
    if (leftPanel) {
      leftPanel.clear();

      const panelTop = margin.top + 45;
      const panelHeight = height - panelTop - margin.bottom;

      // Panel background with danger tint if overloaded
      const isOverloaded = otherUtilization > 1;
      leftPanel.roundRect(leftX, panelTop, panelWidth, panelHeight, 10);
      leftPanel.fill({ color: isOverloaded ? 0x1a0d0d : 0x0d1117, alpha: 0.95 });
      leftPanel.stroke({ width: 2, color: isOverloaded ? PIXI_COLORS.danger : PIXI_COLORS.chrome[600], alpha: 0.6 });

      // Fee graph area
      const graphY = panelTop + 80;
      const graphHeight = 100;
      leftPanel.roundRect(leftX + 15, graphY, panelWidth - 30, graphHeight, 6);
      leftPanel.fill({ color: 0x0a0a0b, alpha: 0.8 });

      // Draw fee line graph
      const maxFee = Math.max(...otherFeeHistoryRef.current, 100);
      const graphWidth = panelWidth - 40;

      leftPanel.setStrokeStyle({ width: 2, color: PIXI_COLORS.danger, alpha: 0.9 });
      otherFeeHistoryRef.current.forEach((fee, i) => {
        const x = leftX + 20 + (i / 59) * graphWidth;
        const y = graphY + graphHeight - 10 - (Math.min(fee, maxFee) / maxFee) * (graphHeight - 20);
        if (i === 0) {
          leftPanel.moveTo(x, y);
        } else {
          leftPanel.lineTo(x, y);
        }
      });
      leftPanel.stroke();

      // Current fee marker
      const currentFeeY = graphY + graphHeight - 10 - (Math.min(calculatedOtherFee, maxFee) / maxFee) * (graphHeight - 20);
      leftPanel.circle(leftX + 20 + graphWidth, currentFeeY, 5);
      leftPanel.fill({ color: PIXI_COLORS.danger });

      // Stats boxes
      const statsY = graphY + graphHeight + 20;
      const statWidth = (panelWidth - 40) / 2;

      // Fee box
      leftPanel.roundRect(leftX + 15, statsY, statWidth - 5, 55, 6);
      leftPanel.fill({ color: isOverloaded ? 0x2d1515 : 0x1a1a2e, alpha: 0.9 });
      leftPanel.stroke({ width: 1, color: PIXI_COLORS.danger, alpha: 0.4 });

      // Failed box
      leftPanel.roundRect(leftX + 15 + statWidth + 5, statsY, statWidth - 5, 55, 6);
      leftPanel.fill({ color: isOverloaded ? 0x2d1515 : 0x1a1a2e, alpha: 0.9 });
      leftPanel.stroke({ width: 1, color: PIXI_COLORS.danger, alpha: 0.4 });

      // Capacity bar
      const capY = statsY + 70;
      leftPanel.roundRect(leftX + 15, capY, panelWidth - 30, 25, 4);
      leftPanel.fill({ color: 0x1a1a2e });

      const capFill = Math.min(otherUtilization, 1);
      leftPanel.roundRect(leftX + 15, capY, (panelWidth - 30) * capFill, 25, 4);
      leftPanel.fill({ color: PIXI_COLORS.danger, alpha: 0.9 });

      // Overflow indicator
      if (isOverloaded) {
        const pulse = Math.sin(elapsed * 0.01) * 0.3 + 0.7;
        for (let i = 0; i < 5; i++) {
          leftPanel.roundRect(leftX + panelWidth - 20 - i * 6, capY + 5, 4, 15, 2);
          leftPanel.fill({ color: 0xffffff, alpha: pulse * (0.8 - i * 0.15) });
        }
      }
    }

    // Right panel - Aptos (good)
    const rightPanel = graphicsRef.current.rightPanel;
    if (rightPanel) {
      rightPanel.clear();

      const panelTop = margin.top + 45;
      const panelHeight = height - panelTop - margin.bottom;

      // Panel background with success tint
      rightPanel.roundRect(rightX, panelTop, panelWidth, panelHeight, 10);
      rightPanel.fill({ color: 0x0d1a14, alpha: 0.95 });
      rightPanel.stroke({ width: 2, color: PIXI_COLORS.primary, alpha: 0.5 });

      // Fee graph area
      const graphY = panelTop + 80;
      const graphHeight = 100;
      rightPanel.roundRect(rightX + 15, graphY, panelWidth - 30, graphHeight, 6);
      rightPanel.fill({ color: 0x0a0a0b, alpha: 0.8 });

      // Draw flat fee line
      const graphWidth = panelWidth - 40;
      const flatY = graphY + graphHeight - 15;

      rightPanel.setStrokeStyle({ width: 2, color: PIXI_COLORS.primary, alpha: 0.9 });
      rightPanel.moveTo(rightX + 20, flatY);
      rightPanel.lineTo(rightX + 20 + graphWidth, flatY);
      rightPanel.stroke();

      // Current fee marker
      rightPanel.circle(rightX + 20 + graphWidth, flatY, 5);
      rightPanel.fill({ color: PIXI_COLORS.primary });

      // "FLAT" indicator
      rightPanel.roundRect(rightX + 20 + graphWidth / 2 - 25, flatY - 25, 50, 18, 4);
      rightPanel.fill({ color: PIXI_COLORS.primary, alpha: 0.2 });

      // Stats boxes
      const statsY = graphY + graphHeight + 20;
      const statWidth = (panelWidth - 40) / 2;

      // Fee box
      rightPanel.roundRect(rightX + 15, statsY, statWidth - 5, 55, 6);
      rightPanel.fill({ color: 0x0d1a14, alpha: 0.9 });
      rightPanel.stroke({ width: 1, color: PIXI_COLORS.primary, alpha: 0.4 });

      // Success box
      rightPanel.roundRect(rightX + 15 + statWidth + 5, statsY, statWidth - 5, 55, 6);
      rightPanel.fill({ color: 0x0d1a14, alpha: 0.9 });
      rightPanel.stroke({ width: 1, color: PIXI_COLORS.success, alpha: 0.4 });

      // Capacity bar
      const capY = statsY + 70;
      rightPanel.roundRect(rightX + 15, capY, panelWidth - 30, 25, 4);
      rightPanel.fill({ color: 0x1a1a2e });

      const capFill = aptosUtilization;
      rightPanel.roundRect(rightX + 15, capY, (panelWidth - 30) * capFill, 25, 4);
      rightPanel.fill({ color: PIXI_COLORS.primary, alpha: 0.8 });

      // Headroom stripes
      const headroomStart = rightX + 15 + (panelWidth - 30) * capFill + 5;
      const headroomWidth = (panelWidth - 30) * (1 - capFill) - 10;
      if (headroomWidth > 20) {
        for (let i = 0; i < headroomWidth; i += 10) {
          rightPanel.setStrokeStyle({ width: 1, color: PIXI_COLORS.primary, alpha: 0.15 });
          rightPanel.moveTo(headroomStart + i, capY + 20);
          rightPanel.lineTo(headroomStart + i + 12, capY + 5);
          rightPanel.stroke();
        }
      }
    }

    // Particles
    const particles = graphicsRef.current.particles;
    if (particles) {
      particles.clear();

      // Spawn particles on both sides
      const spawnRate = loadIntensity * 3;
      for (let i = 0; i < spawnRate; i++) {
        // Left side particles
        if (particlesLeftRef.current.length < CONFIG.maxParticles) {
          const failed = Math.random() < failRate;
          particlesLeftRef.current.push({
            x: leftX + Math.random() * 30,
            y: margin.top + 120 + Math.random() * 80,
            vx: 2 + Math.random() * 2,
            vy: (Math.random() - 0.5) * 0.5,
            size: 2 + Math.random() * 2,
            alpha: 0.9,
            failed,
          });
        }

        // Right side particles (never fail)
        if (particlesRightRef.current.length < CONFIG.maxParticles) {
          particlesRightRef.current.push({
            x: rightX + Math.random() * 30,
            y: margin.top + 120 + Math.random() * 80,
            vx: 3 + Math.random() * 2,
            vy: (Math.random() - 0.5) * 0.3,
            size: 2 + Math.random() * 2,
            alpha: 0.9,
            failed: false,
          });
        }
      }

      // Update and draw left particles
      particlesLeftRef.current = particlesLeftRef.current.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x > leftX + panelWidth - 30) {
          p.alpha -= p.failed ? 0.15 : 0.08;
          if (p.failed) {
            p.vy += 0.3; // Fall down if failed
          }
        }

        if (p.alpha > 0.1) {
          const color = p.failed ? PIXI_COLORS.danger : PIXI_COLORS.chrome[500];

          particles.circle(p.x, p.y, p.size);
          particles.fill({ color, alpha: p.alpha * 0.8 });

          if (p.failed && p.x > leftX + panelWidth - 50) {
            // X mark for failed
            particles.setStrokeStyle({ width: 1, color: PIXI_COLORS.danger, alpha: p.alpha });
            particles.moveTo(p.x - 3, p.y - 3);
            particles.lineTo(p.x + 3, p.y + 3);
            particles.moveTo(p.x + 3, p.y - 3);
            particles.lineTo(p.x - 3, p.y + 3);
            particles.stroke();
          }
        }

        return p.x < leftX + panelWidth && p.alpha > 0.05 && p.y < height;
      });

      // Update and draw right particles
      particlesRightRef.current = particlesRightRef.current.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x > rightX + panelWidth - 40) {
          p.alpha -= 0.06;
        }

        if (p.alpha > 0.1) {
          // Trail
          particles.setStrokeStyle({ width: p.size * 0.5, color: PIXI_COLORS.primary, alpha: p.alpha * 0.3 });
          particles.moveTo(p.x - p.vx * 3, p.y);
          particles.lineTo(p.x, p.y);
          particles.stroke();

          particles.circle(p.x, p.y, p.size);
          particles.fill({ color: PIXI_COLORS.primary, alpha: p.alpha * 0.9 });
        }

        return p.x < rightX + panelWidth && p.alpha > 0.05;
      });
    }

    // Update texts
    const texts = textsRef.current;
    if (texts.length >= 18) {
      const panelTop = margin.top + 45;
      const graphY = panelTop + 80;
      const graphHeight = 100;
      const statsY = graphY + graphHeight + 20;
      const statWidth = (panelWidth - 40) / 2;
      const capY = statsY + 70;

      // Title
      texts[0].x = centerX;
      texts[0].y = margin.top + 5;
      texts[0].anchor.set(0.5, 0);

      // Load indicator
      texts[1].text = `LOAD: ${formatNumber(Math.round(orders))}/sec`;
      texts[1].x = centerX;
      texts[1].y = margin.top + 25;
      texts[1].anchor.set(0.5, 0);

      // Left panel title
      texts[2].x = leftX + panelWidth / 2;
      texts[2].y = panelTop + 15;
      texts[2].anchor.set(0.5, 0);

      // Right panel title
      texts[3].x = rightX + panelWidth / 2;
      texts[3].y = panelTop + 15;
      texts[3].anchor.set(0.5, 0);

      // Left graph label
      texts[4].x = leftX + 20;
      texts[4].y = graphY + 5;

      // Right graph label
      texts[5].text = "FLAT";
      texts[5].x = rightX + 20 + (panelWidth - 40) / 2;
      texts[5].y = graphY + graphHeight - 35;
      texts[5].anchor.set(0.5, 0);

      // Left fee value
      const feeStr = calculatedOtherFee >= 1 ? `$${calculatedOtherFee.toFixed(0)}` : `$${calculatedOtherFee.toFixed(2)}`;
      texts[6].text = feeStr;
      texts[6].x = leftX + 15 + (statWidth - 5) / 2;
      texts[6].y = statsY + 25;
      texts[6].anchor.set(0.5, 0);

      texts[7].x = leftX + 15 + (statWidth - 5) / 2;
      texts[7].y = statsY + 8;
      texts[7].anchor.set(0.5, 0);

      // Left failed value
      texts[8].text = formatNumber(failedCount);
      texts[8].x = leftX + 15 + statWidth + 5 + (statWidth - 5) / 2;
      texts[8].y = statsY + 25;
      texts[8].anchor.set(0.5, 0);

      texts[9].x = leftX + 15 + statWidth + 5 + (statWidth - 5) / 2;
      texts[9].y = statsY + 8;
      texts[9].anchor.set(0.5, 0);

      // Right fee value
      texts[10].x = rightX + 15 + (statWidth - 5) / 2;
      texts[10].y = statsY + 25;
      texts[10].anchor.set(0.5, 0);

      texts[11].x = rightX + 15 + (statWidth - 5) / 2;
      texts[11].y = statsY + 8;
      texts[11].anchor.set(0.5, 0);

      // Right success value
      texts[12].x = rightX + 15 + statWidth + 5 + (statWidth - 5) / 2;
      texts[12].y = statsY + 25;
      texts[12].anchor.set(0.5, 0);

      texts[13].x = rightX + 15 + statWidth + 5 + (statWidth - 5) / 2;
      texts[13].y = statsY + 8;
      texts[13].anchor.set(0.5, 0);

      // Capacity labels
      texts[14].text = `${Math.round(Math.min(otherUtilization * 100, 9999))}%`;
      texts[14].x = leftX + 15 + (panelWidth - 30) / 2;
      texts[14].y = capY + 5;
      texts[14].anchor.set(0.5, 0);

      texts[15].text = otherUtilization > 1 ? "MAXED" : "CAPACITY";
      texts[15].x = leftX + panelWidth - 25;
      texts[15].y = capY + 5;
      texts[15].anchor.set(1, 0);

      texts[16].text = `${Math.round(aptosUtilization * 100)}%`;
      texts[16].x = rightX + 15 + (panelWidth - 30) / 2;
      texts[16].y = capY + 5;
      texts[16].anchor.set(0.5, 0);

      texts[17].text = `${Math.round((1 - aptosUtilization) * 100)}% FREE`;
      texts[17].x = rightX + panelWidth - 25;
      texts[17].y = capY + 5;
      texts[17].anchor.set(1, 0);
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
      leftPanel: new Graphics(),
      rightPanel: new Graphics(),
      particles: new Graphics(),
      graphs: new Graphics(),
    };

    app.stage.addChild(graphicsRef.current.background!);
    app.stage.addChild(graphicsRef.current.leftPanel!);
    app.stage.addChild(graphicsRef.current.rightPanel!);
    app.stage.addChild(graphicsRef.current.particles!);

    // Text styles
    const titleStyle = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 13,
      fontWeight: "800",
      fill: 0xffffff,
      letterSpacing: 1,
    });

    const loadStyle = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 11,
      fontWeight: "600",
      fill: PIXI_COLORS.chrome[400],
    });

    const panelTitleBad = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 12,
      fontWeight: "700",
      fill: PIXI_COLORS.danger,
      letterSpacing: 0.5,
    });

    const panelTitleGood = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 12,
      fontWeight: "700",
      fill: PIXI_COLORS.primary,
      letterSpacing: 0.5,
    });

    const graphLabel = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 9,
      fontWeight: "600",
      fill: PIXI_COLORS.chrome[500],
    });

    const flatLabel = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 10,
      fontWeight: "700",
      fill: PIXI_COLORS.primary,
    });

    const valueBad = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 16,
      fontWeight: "800",
      fill: PIXI_COLORS.danger,
    });

    const valueGood = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 16,
      fontWeight: "800",
      fill: PIXI_COLORS.primary,
    });

    const valueSuccess = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 16,
      fontWeight: "800",
      fill: PIXI_COLORS.success,
    });

    const labelStyle = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 9,
      fontWeight: "600",
      fill: PIXI_COLORS.chrome[500],
    });

    const capValueBad = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 11,
      fontWeight: "700",
      fill: PIXI_COLORS.danger,
    });

    const capValueGood = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 11,
      fontWeight: "700",
      fill: PIXI_COLORS.primary,
    });

    textsRef.current = [
      new Text({ text: "SAME LOAD • DIFFERENT OUTCOMES", style: titleStyle }),
      new Text({ text: "LOAD: 2,000/sec", style: loadStyle }),
      new Text({ text: "OTHER CHAIN (15 TPS)", style: panelTitleBad }),
      new Text({ text: "APTOS (160K TPS)", style: panelTitleGood }),
      new Text({ text: "GAS FEE", style: graphLabel }),
      new Text({ text: "FLAT", style: flatLabel }),
      new Text({ text: "$0.01", style: valueBad }),
      new Text({ text: "AVG FEE", style: labelStyle }),
      new Text({ text: "0", style: valueBad }),
      new Text({ text: "FAILED", style: labelStyle }),
      new Text({ text: "$0.0001", style: valueGood }),
      new Text({ text: "FEE", style: labelStyle }),
      new Text({ text: "100%", style: valueSuccess }),
      new Text({ text: "SUCCESS", style: labelStyle }),
      new Text({ text: "100%", style: capValueBad }),
      new Text({ text: "MAXED", style: { ...labelStyle, fill: PIXI_COLORS.danger } }),
      new Text({ text: "31%", style: capValueGood }),
      new Text({ text: "69% FREE", style: { ...labelStyle, fill: PIXI_COLORS.primary } }),
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
      particlesLeftRef.current = [];
      particlesRightRef.current = [];
    }
  };

  const handleRestart = () => {
    startTimeRef.current = performance.now();
    particlesLeftRef.current = [];
    particlesRightRef.current = [];
    otherFeeHistoryRef.current = Array(60).fill(0.01);
    aptosFeeHistoryRef.current = Array(60).fill(0.0001);
    setIsPlaying(true);
  };

  return (
    <div className={`chrome-card p-4 sm:p-6 ${className || ""}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="section-title">Chain Comparison</h3>
          <p className="text-xs" style={{ color: "var(--chrome-500)" }}>
            Same orderbook load, drastically different outcomes
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

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="metric-cell">
          <div className="stat-value text-lg sm:text-xl" style={{ color: "var(--secondary)" }}>
            {formatNumber(currentOrders)}/s
          </div>
          <div className="stat-label">Orders</div>
        </div>
        <div className="metric-cell">
          <div className="stat-value text-lg sm:text-xl" style={{ color: "var(--danger)" }}>
            ${otherFee >= 1 ? otherFee.toFixed(0) : otherFee.toFixed(2)}
          </div>
          <div className="stat-label">Other Chain Fee</div>
        </div>
        <div className="metric-cell">
          <div className="stat-value text-lg sm:text-xl" style={{ color: "var(--danger)" }}>
            {formatNumber(otherFailed)}
          </div>
          <div className="stat-label">Failed TXs</div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="canvas-wrap relative rounded-lg overflow-hidden"
        style={{ height: "420px", backgroundColor: "#0a0a0b" }}
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
            Other Chain (15 TPS)
          </h4>
          <p className="text-xs" style={{ color: "var(--chrome-400)" }}>
            50K orders = 3,333x capacity. Fees spike to $100s, 50%+ transactions fail.
          </p>
        </div>
        <div className="p-3 rounded-lg" style={{ backgroundColor: "rgba(0, 217, 165, 0.08)", border: "1px solid rgba(0, 217, 165, 0.2)" }}>
          <h4 className="text-xs font-bold mb-1" style={{ color: "var(--accent)" }}>
            Aptos (160K TPS)
          </h4>
          <p className="text-xs" style={{ color: "var(--chrome-400)" }}>
            50K orders = 31% capacity. Fees stay at $0.0001, 100% success rate.
          </p>
        </div>
      </div>
    </div>
  );
});
