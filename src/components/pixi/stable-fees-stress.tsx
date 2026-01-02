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

interface StableFeesStressProps {
  className?: string;
}

// The real story: massive capacity prevents congestion
const CONFIG = {
  duration: 25000, // 25 second cycle
  aptosCapacity: 160000, // Block-STM theoretical max
  ethCapacity: 30, // ETH L1 for comparison
  demandMin: 5000,
  demandMax: 120000, // Peak demand during stress test
  baseFee: 0.0001, // $0.0001
  stateUpdateInterval: 80,
  maxParticles: 500,
};

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  processed: boolean;
  lane: number;
}

export const StableFeesStress = memo(function StableFeesStress({
  className,
}: StableFeesStressProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const initAttemptedRef = useRef(false);

  const isPlayingRef = useRef(true);
  const startTimeRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const lastStateUpdateRef = useRef<number>(0);

  const graphicsRef = useRef<{
    background: Graphics | null;
    capacityBar: Graphics | null;
    demandBar: Graphics | null;
    comparison: Graphics | null;
    particles: Graphics | null;
    effects: Graphics | null;
  }>({
    background: null,
    capacityBar: null,
    demandBar: null,
    comparison: null,
    particles: null,
    effects: null,
  });

  const textsRef = useRef<Text[]>([]);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentDemand, setCurrentDemand] = useState(CONFIG.demandMin);
  const [utilization, setUtilization] = useState(0);

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

    // Get actual container dimensions
    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Ensure renderer matches container
    if (Math.abs(app.screen.width - width) > 1 || Math.abs(app.screen.height - height) > 1) {
      app.renderer.resize(width, height);
    }

    // Demand follows a stress test pattern: ramp up, sustain, ease down
    let demandProgress: number;
    if (progress < 0.1) {
      demandProgress = easings.easeOutQuad(progress / 0.1) * 0.3;
    } else if (progress < 0.4) {
      demandProgress = 0.3 + easings.easeInOutCubic((progress - 0.1) / 0.3) * 0.5;
    } else if (progress < 0.7) {
      demandProgress = 0.8 + Math.sin((progress - 0.4) * Math.PI * 3) * 0.15;
    } else {
      demandProgress = 0.8 - easings.easeInQuad((progress - 0.7) / 0.3) * 0.5;
    }

    const demand = lerp(CONFIG.demandMin, CONFIG.demandMax, demandProgress);
    const util = (demand / CONFIG.aptosCapacity) * 100;

    // Throttle React state updates
    if (now - lastStateUpdateRef.current > CONFIG.stateUpdateInterval) {
      lastStateUpdateRef.current = now;
      setCurrentDemand(Math.round(demand));
      setUtilization(Math.round(util));
    }

    // Layout - FULL CANVAS
    const margin = { left: 20, right: 20, top: 20, bottom: 20 };
    const centerX = width / 2;

    // Section heights
    const titleHeight = 50;
    const capacitySection = height * 0.35;
    const comparisonSection = height * 0.30;
    const particleSection = height * 0.25;

    const capacityY = margin.top + titleHeight;
    const comparisonY = capacityY + capacitySection + 20;
    const particleY = comparisonY + comparisonSection + 10;

    // Draw background
    const bg = graphicsRef.current.background;
    if (bg) {
      bg.clear();
      bg.rect(0, 0, width, height);
      bg.fill({ color: 0x0a0a0b });

      // Animated grid
      const gridAlpha = 0.04 + Math.sin(elapsed * 0.001) * 0.01;
      bg.setStrokeStyle({ width: 1, color: 0x1f2937, alpha: gridAlpha });
      const gridSpacing = 30;
      const offset = (elapsed * 0.015) % gridSpacing;
      for (let x = -offset; x < width + gridSpacing; x += gridSpacing) {
        bg.moveTo(x, 0);
        bg.lineTo(x, height);
      }
      for (let y = 0; y < height; y += gridSpacing) {
        bg.moveTo(0, y);
        bg.lineTo(width, y);
      }
      bg.stroke();

      // Section backgrounds
      bg.roundRect(margin.left, capacityY, width - margin.left * 2, capacitySection, 12);
      bg.fill({ color: 0x0d1117, alpha: 0.9 });
      bg.stroke({ width: 1, color: PIXI_COLORS.primary, alpha: 0.3 });

      bg.roundRect(margin.left, comparisonY, width - margin.left * 2, comparisonSection, 12);
      bg.fill({ color: 0x0d1117, alpha: 0.9 });
      bg.stroke({ width: 1, color: 0x374151, alpha: 0.3 });
    }

    // Draw capacity visualization
    const capacityBar = graphicsRef.current.capacityBar;
    if (capacityBar) {
      capacityBar.clear();

      const barPadding = 40;
      const barWidth = width - margin.left * 2 - barPadding * 2;
      const barHeight = 60;
      const barX = margin.left + barPadding;
      const barY = capacityY + 70;

      // Capacity container (the ceiling)
      capacityBar.roundRect(barX, barY, barWidth, barHeight, 8);
      capacityBar.fill({ color: 0x1a1a2e, alpha: 0.8 });
      capacityBar.stroke({ width: 2, color: PIXI_COLORS.primary, alpha: 0.5 });

      // Capacity ceiling line with glow
      const ceilingY = barY + 5;
      capacityBar.setStrokeStyle({ width: 3, color: PIXI_COLORS.primary, alpha: 0.3 });
      capacityBar.moveTo(barX + 5, ceilingY);
      capacityBar.lineTo(barX + barWidth - 5, ceilingY);
      capacityBar.stroke();

      capacityBar.setStrokeStyle({ width: 2, color: PIXI_COLORS.primary, alpha: 0.8 });
      capacityBar.moveTo(barX + 5, ceilingY);
      capacityBar.lineTo(barX + barWidth - 5, ceilingY);
      capacityBar.stroke();

      // Demand fill (animated)
      const demandRatio = demand / CONFIG.aptosCapacity;
      const demandWidth = (barWidth - 10) * demandRatio;
      const demandHeight = barHeight - 15;

      // Gradient effect for demand bar
      for (let layer = 4; layer >= 0; layer--) {
        const layerAlpha = 0.15 + layer * 0.08;
        const layerOffset = layer * 2;
        capacityBar.roundRect(
          barX + 5,
          barY + 10 + layerOffset,
          demandWidth,
          demandHeight - layerOffset * 2,
          4
        );
        capacityBar.fill({ color: PIXI_COLORS.secondary, alpha: layerAlpha });
      }

      // Main demand bar
      capacityBar.roundRect(barX + 5, barY + 10, demandWidth, demandHeight, 4);
      capacityBar.fill({ color: PIXI_COLORS.secondary, alpha: 0.9 });

      // Pulsing edge effect
      const pulse = Math.sin(elapsed * 0.008) * 0.3 + 0.7;
      capacityBar.roundRect(barX + 5 + demandWidth - 4, barY + 10, 8, demandHeight, 2);
      capacityBar.fill({ color: 0xffffff, alpha: 0.3 * pulse });

      // Headroom indicator (the gap = why fees stay low)
      const headroomX = barX + 5 + demandWidth + 10;
      const headroomWidth = barWidth - demandWidth - 20;
      if (headroomWidth > 50) {
        capacityBar.setStrokeStyle({ width: 1, color: PIXI_COLORS.primary, alpha: 0.4 });
        capacityBar.rect(headroomX, barY + 15, headroomWidth, demandHeight - 10);
        capacityBar.stroke();

        // Diagonal lines to show "available space"
        for (let i = 0; i < headroomWidth; i += 15) {
          capacityBar.setStrokeStyle({ width: 1, color: PIXI_COLORS.primary, alpha: 0.2 });
          capacityBar.moveTo(headroomX + i, barY + demandHeight);
          capacityBar.lineTo(headroomX + i + 20, barY + 15);
          capacityBar.stroke();
        }
      }

      // Utilization percentage badge
      const badgeX = barX + demandWidth / 2 - 30;
      const badgeY = barY + barHeight / 2 - 12;
      capacityBar.roundRect(badgeX, badgeY, 60, 24, 6);
      capacityBar.fill({ color: 0x0d1117, alpha: 0.95 });
      capacityBar.stroke({ width: 1, color: PIXI_COLORS.secondary, alpha: 0.6 });

      // Scale markers
      const markers = [0, 25, 50, 75, 100];
      markers.forEach((pct) => {
        const markerX = barX + 5 + ((barWidth - 10) * pct) / 100;
        capacityBar.setStrokeStyle({ width: 1, color: 0x4b5563, alpha: 0.5 });
        capacityBar.moveTo(markerX, barY + barHeight - 5);
        capacityBar.lineTo(markerX, barY + barHeight + 5);
        capacityBar.stroke();
      });
    }

    // Draw comparison section
    const comparison = graphicsRef.current.comparison;
    if (comparison) {
      comparison.clear();

      const compPadding = 30;
      const boxWidth = (width - margin.left * 2 - compPadding * 3) / 2;
      const boxHeight = comparisonSection - 50;
      const aptosBoxX = margin.left + compPadding;
      const ethBoxX = aptosBoxX + boxWidth + compPadding;
      const boxY = comparisonY + 25;

      // Aptos box - SUCCESS
      comparison.roundRect(aptosBoxX, boxY, boxWidth, boxHeight, 10);
      comparison.fill({ color: 0x0d2818, alpha: 0.8 });
      comparison.stroke({ width: 2, color: PIXI_COLORS.primary, alpha: 0.6 });

      // Aptos utilization bar
      const aptosBarY = boxY + 55;
      const aptosBarHeight = 30;
      comparison.roundRect(aptosBoxX + 15, aptosBarY, boxWidth - 30, aptosBarHeight, 6);
      comparison.fill({ color: 0x1a1a2e });

      const aptosUtil = demand / CONFIG.aptosCapacity;
      comparison.roundRect(aptosBoxX + 15, aptosBarY, (boxWidth - 30) * aptosUtil, aptosBarHeight, 6);
      comparison.fill({ color: PIXI_COLORS.primary, alpha: 0.9 });

      // Aptos checkmark
      const checkX = aptosBoxX + boxWidth - 40;
      const checkY = boxY + 15;
      comparison.circle(checkX, checkY, 15);
      comparison.fill({ color: PIXI_COLORS.primary, alpha: 0.3 });
      comparison.setStrokeStyle({ width: 3, color: PIXI_COLORS.primary });
      comparison.moveTo(checkX - 7, checkY);
      comparison.lineTo(checkX - 2, checkY + 6);
      comparison.lineTo(checkX + 8, checkY - 5);
      comparison.stroke();

      // ETH box - CONGESTED (same demand would overflow)
      const ethUtil = demand / CONFIG.ethCapacity; // Will be >> 100%
      const isOverloaded = ethUtil > 1;

      comparison.roundRect(ethBoxX, boxY, boxWidth, boxHeight, 10);
      comparison.fill({ color: isOverloaded ? 0x2d1515 : 0x1a1a2e, alpha: 0.8 });
      comparison.stroke({ width: 2, color: isOverloaded ? PIXI_COLORS.danger : 0x6b7280, alpha: 0.6 });

      // ETH utilization bar (overflowing!)
      comparison.roundRect(ethBoxX + 15, aptosBarY, boxWidth - 30, aptosBarHeight, 6);
      comparison.fill({ color: 0x1a1a2e });

      // The bar overflows with danger color
      const ethBarWidth = Math.min(boxWidth - 30, (boxWidth - 30) * Math.min(ethUtil, 1));
      comparison.roundRect(ethBoxX + 15, aptosBarY, ethBarWidth, aptosBarHeight, 6);
      comparison.fill({ color: PIXI_COLORS.danger, alpha: 0.9 });

      // Overflow indicator
      if (isOverloaded) {
        const overflowPulse = Math.sin(elapsed * 0.01) * 0.3 + 0.7;
        comparison.roundRect(ethBoxX + 15 + ethBarWidth - 5, aptosBarY, 10, aptosBarHeight, 3);
        comparison.fill({ color: 0xffffff, alpha: overflowPulse * 0.5 });

        // Warning stripes
        for (let i = 0; i < 3; i++) {
          comparison.roundRect(
            ethBoxX + boxWidth - 15 - i * 8,
            aptosBarY + 5,
            4,
            aptosBarHeight - 10,
            2
          );
          comparison.fill({ color: PIXI_COLORS.danger, alpha: 0.6 - i * 0.15 });
        }
      }

      // ETH X mark
      const xX = ethBoxX + boxWidth - 40;
      const xY = boxY + 15;
      comparison.circle(xX, xY, 15);
      comparison.fill({ color: PIXI_COLORS.danger, alpha: 0.3 });
      comparison.setStrokeStyle({ width: 3, color: PIXI_COLORS.danger });
      comparison.moveTo(xX - 6, xY - 6);
      comparison.lineTo(xX + 6, xY + 6);
      comparison.moveTo(xX + 6, xY - 6);
      comparison.lineTo(xX - 6, xY + 6);
      comparison.stroke();

      // Fee comparison boxes
      const feeBoxY = aptosBarY + aptosBarHeight + 15;
      const feeBoxHeight = 35;

      // Aptos fee
      comparison.roundRect(aptosBoxX + 15, feeBoxY, boxWidth - 30, feeBoxHeight, 6);
      comparison.fill({ color: PIXI_COLORS.primary, alpha: 0.15 });
      comparison.stroke({ width: 1, color: PIXI_COLORS.primary, alpha: 0.4 });

      // ETH fee (spikes with congestion)
      const ethFee = isOverloaded ? Math.min(ethUtil * 10, 500) : 0.1;
      comparison.roundRect(ethBoxX + 15, feeBoxY, boxWidth - 30, feeBoxHeight, 6);
      comparison.fill({ color: PIXI_COLORS.danger, alpha: isOverloaded ? 0.25 : 0.1 });
      comparison.stroke({ width: 1, color: isOverloaded ? PIXI_COLORS.danger : 0x6b7280, alpha: 0.4 });
    }

    // Particle flow (transaction throughput visualization)
    const particles = graphicsRef.current.particles;
    if (particles) {
      particles.clear();

      const particleZoneWidth = width - margin.left * 2;
      const particleZoneHeight = particleSection - 30;
      const particleZoneX = margin.left;
      const particleZoneYStart = particleY + 15;

      // Background for particle zone
      particles.roundRect(particleZoneX, particleZoneYStart, particleZoneWidth, particleZoneHeight, 8);
      particles.fill({ color: 0x0d1117, alpha: 0.6 });

      // Spawn particles based on demand (more demand = more particles)
      const spawnRate = (demand / CONFIG.aptosCapacity) * 12;
      const spawnCount = Math.floor(spawnRate);

      for (let i = 0; i < spawnCount; i++) {
        if (particlesRef.current.length < CONFIG.maxParticles) {
          const lane = Math.floor(Math.random() * 8);
          const laneY = particleZoneYStart + 10 + (lane / 8) * (particleZoneHeight - 20);

          particlesRef.current.push({
            x: particleZoneX + 10 + Math.random() * 30,
            y: laneY + (Math.random() - 0.5) * 8,
            vx: 4 + Math.random() * 4 + (demand / CONFIG.aptosCapacity) * 4,
            vy: (Math.random() - 0.5) * 0.4,
            size: 2 + Math.random() * 3,
            alpha: 0.8,
            processed: false,
            lane,
          });
        }
      }

      // Lane separators
      for (let i = 1; i < 8; i++) {
        const laneY = particleZoneYStart + (i / 8) * particleZoneHeight;
        particles.setStrokeStyle({ width: 1, color: 0x374151, alpha: 0.2 });
        particles.moveTo(particleZoneX + 10, laneY);
        particles.lineTo(particleZoneX + particleZoneWidth - 10, laneY);
        particles.stroke();
      }

      // Update and draw particles
      particlesRef.current = particlesRef.current.filter((p) => {
        p.x += p.vx;
        p.y += p.vy + Math.sin(p.x * 0.02) * 0.2;

        const maxX = particleZoneX + particleZoneWidth - 20;

        // Processing effect at 80% across
        if (!p.processed && p.x > particleZoneX + particleZoneWidth * 0.8) {
          p.processed = true;
          p.vx *= 1.5; // Speed boost when "processed"
        }

        if (p.x > maxX - 40) {
          p.alpha -= 0.06;
        }

        if (p.alpha > 0.1) {
          const color = p.processed ? PIXI_COLORS.primary : PIXI_COLORS.secondary;

          // Trail
          particles.setStrokeStyle({ width: p.size * 0.4, color, alpha: p.alpha * 0.3 });
          particles.moveTo(p.x - p.vx * 3, p.y);
          particles.lineTo(p.x, p.y);
          particles.stroke();

          // Glow
          particles.circle(p.x, p.y, p.size * 2);
          particles.fill({ color, alpha: p.alpha * 0.15 });

          // Core
          particles.circle(p.x, p.y, p.size);
          particles.fill({ color, alpha: p.alpha * 0.8 });

          // Bright center
          if (p.processed) {
            particles.circle(p.x, p.y, p.size * 0.4);
            particles.fill({ color: 0xffffff, alpha: p.alpha * 0.6 });
          }
        }

        return p.x < particleZoneX + particleZoneWidth && p.alpha > 0.05;
      });

      // Processing zone indicator
      const processX = particleZoneX + particleZoneWidth * 0.8;
      particles.setStrokeStyle({ width: 2, color: PIXI_COLORS.primary, alpha: 0.3 });
      particles.moveTo(processX, particleZoneYStart + 5);
      particles.lineTo(processX, particleZoneYStart + particleZoneHeight - 5);
      particles.stroke();

      // Throughput indicator
      const throughputWidth = 120;
      const throughputX = particleZoneX + particleZoneWidth - throughputWidth - 15;
      const throughputY = particleZoneYStart + particleZoneHeight - 25;
      particles.roundRect(throughputX, throughputY, throughputWidth, 20, 4);
      particles.fill({ color: 0x0d1117, alpha: 0.9 });
      particles.stroke({ width: 1, color: PIXI_COLORS.primary, alpha: 0.5 });
    }

    // Update text labels
    const texts = textsRef.current;
    if (texts.length >= 12) {
      const compPadding = 30;
      const boxWidth = (width - margin.left * 2 - compPadding * 3) / 2;
      const aptosBoxX = margin.left + compPadding;
      const ethBoxX = aptosBoxX + boxWidth + compPadding;
      const boxY = comparisonY + 25;

      // Title
      texts[0].x = centerX;
      texts[0].y = margin.top + 15;
      texts[0].anchor.set(0.5, 0);

      // Capacity label
      texts[1].x = margin.left + 45;
      texts[1].y = capacityY + 20;

      // Capacity value
      texts[2].text = "160,000 TPS";
      texts[2].x = width - margin.right - 45;
      texts[2].y = capacityY + 20;
      texts[2].anchor.set(1, 0);

      // Demand label
      texts[3].text = `CURRENT DEMAND: ${formatNumber(Math.round(demand))} TPS`;
      texts[3].x = margin.left + 45;
      texts[3].y = capacityY + 45;

      // Utilization
      texts[4].text = `${Math.round(util)}%`;
      const barPadding = 40;
      const barX = margin.left + barPadding;
      const barWidth = width - margin.left * 2 - barPadding * 2;
      const demandRatio = demand / CONFIG.aptosCapacity;
      texts[4].x = barX + 5 + (barWidth - 10) * demandRatio / 2;
      texts[4].y = capacityY + 88;
      texts[4].anchor.set(0.5, 0.5);

      // Headroom label
      texts[5].text = `${Math.round(100 - util)}% HEADROOM`;
      texts[5].x = width - margin.right - 60;
      texts[5].y = capacityY + capacitySection - 25;
      texts[5].anchor.set(1, 0);

      // Aptos label
      texts[6].x = aptosBoxX + 15;
      texts[6].y = boxY + 12;

      // ETH label
      texts[7].x = ethBoxX + 15;
      texts[7].y = boxY + 12;

      // Aptos fee
      texts[8].text = "$0.0001";
      texts[8].x = aptosBoxX + boxWidth / 2;
      texts[8].y = boxY + 115;
      texts[8].anchor.set(0.5, 0.5);

      // ETH fee
      const ethUtil = demand / CONFIG.ethCapacity;
      const ethFee = ethUtil > 1 ? Math.min(ethUtil * 5, 200).toFixed(0) : "0.10";
      texts[9].text = `$${ethFee}+`;
      texts[9].x = ethBoxX + boxWidth / 2;
      texts[9].y = boxY + 115;
      texts[9].anchor.set(0.5, 0.5);
      texts[9].style.fill = ethUtil > 1 ? PIXI_COLORS.danger : 0x6b7280;

      // Aptos status
      texts[10].text = `${Math.round((demand / CONFIG.aptosCapacity) * 100)}% utilized`;
      texts[10].x = aptosBoxX + boxWidth / 2;
      texts[10].y = boxY + 70;
      texts[10].anchor.set(0.5, 0.5);

      // ETH status
      const ethPercent = Math.round((demand / CONFIG.ethCapacity) * 100);
      texts[11].text = ethPercent > 100 ? `${ethPercent.toLocaleString()}% OVERLOADED` : `${ethPercent}% utilized`;
      texts[11].x = ethBoxX + boxWidth / 2;
      texts[11].y = boxY + 70;
      texts[11].anchor.set(0.5, 0.5);
      texts[11].style.fill = ethPercent > 100 ? PIXI_COLORS.danger : 0x9ca3af;
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
      capacityBar: new Graphics(),
      demandBar: new Graphics(),
      comparison: new Graphics(),
      particles: new Graphics(),
      effects: new Graphics(),
    };

    app.stage.addChild(graphicsRef.current.background!);
    app.stage.addChild(graphicsRef.current.capacityBar!);
    app.stage.addChild(graphicsRef.current.comparison!);
    app.stage.addChild(graphicsRef.current.particles!);
    app.stage.addChild(graphicsRef.current.effects!);

    // Text styles
    const titleStyle = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 14,
      fontWeight: "700",
      fill: 0xffffff,
      letterSpacing: 1,
    });

    const labelStyle = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 11,
      fontWeight: "600",
      fill: 0x9ca3af,
    });

    const valueStyle = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 12,
      fontWeight: "700",
      fill: PIXI_COLORS.primary,
    });

    const bigValueStyle = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 16,
      fontWeight: "800",
      fill: 0xffffff,
    });

    const chainLabelStyle = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 13,
      fontWeight: "700",
      fill: PIXI_COLORS.primary,
    });

    const feeStyle = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 18,
      fontWeight: "800",
      fill: PIXI_COLORS.primary,
    });

    textsRef.current = [
      new Text({ text: "WHY FEES STAY FLAT: CAPACITY >> DEMAND", style: titleStyle }),
      new Text({ text: "BLOCK-STM CAPACITY", style: labelStyle }),
      new Text({ text: "160,000 TPS", style: valueStyle }),
      new Text({ text: "CURRENT DEMAND: 5,000 TPS", style: labelStyle }),
      new Text({ text: "3%", style: bigValueStyle }),
      new Text({ text: "97% HEADROOM", style: { ...labelStyle, fill: PIXI_COLORS.primary } }),
      new Text({ text: "APTOS", style: chainLabelStyle }),
      new Text({ text: "ETH-STYLE (30 TPS)", style: { ...chainLabelStyle, fill: 0x6b7280 } }),
      new Text({ text: "$0.0001", style: feeStyle }),
      new Text({ text: "$0.10", style: { ...feeStyle, fill: 0x6b7280 } }),
      new Text({ text: "3% utilized", style: { ...labelStyle, fontSize: 10 } }),
      new Text({ text: "16,667% OVERLOADED", style: { ...labelStyle, fontSize: 10, fill: PIXI_COLORS.danger } }),
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
      particlesRef.current = [];
    }
  };

  const handleRestart = () => {
    startTimeRef.current = performance.now();
    particlesRef.current = [];
    setIsPlaying(true);
  };

  return (
    <div className={`chrome-card p-4 sm:p-6 ${className || ""}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="section-title">The Real Reason Fees Stay Flat</h3>
          <p className="text-xs" style={{ color: "var(--chrome-500)" }}>
            Block-STM provides 5000x more capacity than needed
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
          <div className="stat-value text-xl sm:text-2xl" style={{ color: "var(--accent)" }}>
            {formatNumber(currentDemand)} TPS
          </div>
          <div className="stat-label">Current Demand</div>
        </div>
        <div className="metric-cell">
          <div className="stat-value text-xl sm:text-2xl" style={{ color: utilization < 80 ? "var(--accent)" : "#f59e0b" }}>
            {utilization}%
          </div>
          <div className="stat-label">Capacity Used</div>
        </div>
        <div className="metric-cell">
          <div className="stat-value text-xl sm:text-2xl" style={{ color: "var(--accent)" }}>
            $0.0001
          </div>
          <div className="stat-label">Fee (always)</div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="canvas-wrap relative rounded-lg overflow-hidden"
        style={{ height: "500px", backgroundColor: "#0a0a0b" }}
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
          The Secret: Block-STM Parallel Execution
        </h4>
        <p className="text-xs mb-2" style={{ color: "var(--chrome-400)" }}>
          Aptos doesn&apos;t use fancy fee market tricks. It &quot;solves&quot; fee stability by having so much capacity that congestion rarely happens:
        </p>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-2 rounded" style={{ backgroundColor: "rgba(0, 217, 165, 0.1)" }}>
            <div className="font-bold" style={{ color: "var(--accent)" }}>Block-STM</div>
            <div style={{ color: "var(--chrome-400)" }}>160,000+ TPS capacity via parallel execution</div>
          </div>
          <div className="p-2 rounded" style={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}>
            <div className="font-bold" style={{ color: "var(--chrome-300)" }}>Governance Floor</div>
            <div style={{ color: "var(--chrome-400)" }}>Fixed minimum: 100 octas/gas (no auto-increase)</div>
          </div>
        </div>
      </div>
    </div>
  );
});
