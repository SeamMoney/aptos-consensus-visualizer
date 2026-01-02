"use client";

import { memo, useEffect, useRef, useState, useCallback } from "react";
import { Application, Graphics, Text, TextStyle } from "pixi.js";
import { useVisibility } from "@/hooks/useVisibility";
import {
  PIXI_COLORS,
  formatFee,
  lerp,
  easings,
} from "@/lib/pixi-utils";

interface StableFeesComparisonProps {
  className?: string;
}

const CONFIG = {
  duration: 20000, // Longer cycle for more drama
  peakTime: 0.20,  // Start spike earlier (at 4s)
  peakDuration: 0.55, // Much longer spike phase (11s)
  stateUpdateInterval: 80,
  maxParticles: 300,
  auction: {
    baseFee: 0.00001,
    peakFee: 2.5,
    dropRate: 0.52,
    color: 0x9945ff,
  },
  aptos: {
    baseFee: 0.0005,
    peakFee: 0.00055,
    dropRate: 0,
    color: PIXI_COLORS.primary,
  },
};

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  failed: boolean;
  side: "left" | "right";
  size: number;
  trail: { x: number; y: number }[];
}

export const StableFeesComparison = memo(function StableFeesComparison({
  className,
}: StableFeesComparisonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const initAttemptedRef = useRef(false);
  const mountedRef = useRef(true);

  const isPlayingRef = useRef(true);
  const startTimeRef = useRef<number>(0);
  const leftDataRef = useRef<{ time: number; fee: number }[]>([]);
  const rightDataRef = useRef<{ time: number; fee: number }[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const lastStateUpdateRef = useRef<number>(0);

  const graphicsRef = useRef<{
    background: Graphics | null;
    leftChart: Graphics | null;
    rightChart: Graphics | null;
    divider: Graphics | null;
    particles: Graphics | null;
    effects: Graphics | null;
  }>({
    background: null,
    leftChart: null,
    rightChart: null,
    divider: null,
    particles: null,
    effects: null,
  });

  const textsRef = useRef<Text[]>([]);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [auctionFee, setAuctionFee] = useState(CONFIG.auction.baseFee);
  const [aptosFee, setAptosFee] = useState(CONFIG.aptos.baseFee);
  const [loadProgress, setLoadProgress] = useState(0);

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

    // Get actual container dimensions for proper sizing
    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const halfWidth = width / 2;

    // Ensure renderer matches container
    if (Math.abs(app.screen.width - width) > 1 || Math.abs(app.screen.height - height) > 1) {
      app.renderer.resize(width, height);
    }

    // Calculate spike intensity with sustained peak
    let spikeIntensity = 0;
    if (progress >= CONFIG.peakTime && progress < CONFIG.peakTime + CONFIG.peakDuration) {
      const spikeProgress = (progress - CONFIG.peakTime) / CONFIG.peakDuration;
      // Ramp up (15%), sustain at peak (55%), ramp down (30%)
      if (spikeProgress < 0.15) {
        // Quick ramp up
        spikeIntensity = easings.easeOutQuad(spikeProgress / 0.15);
      } else if (spikeProgress < 0.70) {
        // SUSTAINED PEAK - this is the important part people need to see
        // Add slight oscillation to make it feel alive
        const oscillation = Math.sin(spikeProgress * Math.PI * 8) * 0.08;
        spikeIntensity = 0.92 + oscillation;
      } else {
        // Slower decay
        spikeIntensity = easings.easeInQuad(1 - (spikeProgress - 0.70) / 0.30);
      }
    }

    // Calculate fees
    const aucFee = lerp(CONFIG.auction.baseFee, CONFIG.auction.peakFee, spikeIntensity);
    const aptFee = CONFIG.aptos.baseFee + (Math.random() - 0.5) * 0.00005;

    // Store data
    leftDataRef.current.push({ time: elapsed, fee: aucFee });
    rightDataRef.current.push({ time: elapsed, fee: aptFee });
    if (leftDataRef.current.length > 300) leftDataRef.current.shift();
    if (rightDataRef.current.length > 300) rightDataRef.current.shift();

    // Throttle state updates
    if (now - lastStateUpdateRef.current > CONFIG.stateUpdateInterval) {
      lastStateUpdateRef.current = now;
      setAuctionFee(aucFee);
      setAptosFee(aptFee);
      setLoadProgress(spikeIntensity);
    }

    // Layout - FULL CANVAS (proper scaling)
    const isMobile = width < 400;
    const margin = isMobile ? 10 : 15;
    const chartTop = 15;
    const chartHeight = height * 0.65;
    const chartWidth = halfWidth - margin * 2 - 5;
    const particleZoneY = chartTop + chartHeight + 15;
    const particleZoneHeight = height - particleZoneY - 25;

    // Draw background with animated elements
    const bg = graphicsRef.current.background;
    if (bg) {
      bg.clear();
      bg.rect(0, 0, width, height);
      bg.fill({ color: 0x0a0a0b });

      // Animated scanlines
      const scanOffset = (elapsed * 0.05) % 4;
      bg.setStrokeStyle({ width: 1, color: 0x1f2937, alpha: 0.12 });
      for (let y = scanOffset; y < height; y += 4) {
        bg.moveTo(0, y);
        bg.lineTo(width, y);
      }
      bg.stroke();

      // Left side - danger zone during spike
      if (spikeIntensity > 0.1) {
        const dangerAlpha = spikeIntensity * 0.12;
        bg.rect(0, 0, halfWidth, height);
        bg.fill({ color: PIXI_COLORS.danger, alpha: dangerAlpha });

        // Pulsing warning border
        const pulse = Math.sin(elapsed * 0.01) * 0.3 + 0.7;
        bg.roundRect(margin - 3, chartTop - 3, chartWidth + 6, chartHeight + 6, 8);
        bg.stroke({ width: 2, color: PIXI_COLORS.danger, alpha: spikeIntensity * pulse * 0.7 });
      }

      // Left chart background - FULL HEIGHT
      bg.roundRect(margin, chartTop, chartWidth, chartHeight, 6);
      bg.fill({ color: 0x0d1117, alpha: 0.9 });
      bg.stroke({ width: 1, color: spikeIntensity > 0.3 ? PIXI_COLORS.danger : CONFIG.auction.color, alpha: 0.5 });

      // Right chart background - FULL HEIGHT
      bg.roundRect(halfWidth + margin, chartTop, chartWidth, chartHeight, 6);
      bg.fill({ color: 0x0d1117, alpha: 0.9 });
      bg.stroke({ width: 1, color: CONFIG.aptos.color, alpha: 0.5 });

      // Success glow on right side
      bg.roundRect(halfWidth + margin - 2, chartTop - 2, chartWidth + 4, chartHeight + 4, 8);
      bg.stroke({ width: 2, color: CONFIG.aptos.color, alpha: 0.15 });
    }

    // Draw center divider with animation
    const divider = graphicsRef.current.divider;
    if (divider) {
      divider.clear();

      // Glowing divider line
      divider.setStrokeStyle({ width: 4, color: 0x374151, alpha: 0.3 });
      divider.moveTo(halfWidth, 0);
      divider.lineTo(halfWidth, height);
      divider.stroke();

      divider.setStrokeStyle({ width: 2, color: 0x6b7280, alpha: 0.6 });
      divider.moveTo(halfWidth, 0);
      divider.lineTo(halfWidth, height);
      divider.stroke();

      // VS indicator
      const vsY = chartTop + chartHeight / 2;
      divider.circle(halfWidth, vsY, 20);
      divider.fill({ color: 0x1f2937 });
      divider.stroke({ width: 2, color: 0x374151 });
    }

    // Draw LEFT chart - Fee Auction (DRAMATIC SPIKE) - FULL HEIGHT
    const leftChart = graphicsRef.current.leftChart;
    if (leftChart && leftDataRef.current.length > 1) {
      leftChart.clear();
      const points = leftDataRef.current;
      const maxFee = CONFIG.auction.peakFee * 1.2;

      // Grid lines
      leftChart.setStrokeStyle({ width: 1, color: 0x374151, alpha: 0.25 });
      for (let i = 0; i <= 5; i++) {
        const y = chartTop + (chartHeight / 5) * i;
        leftChart.moveTo(margin, y);
        leftChart.lineTo(margin + chartWidth, y);
      }
      leftChart.stroke();

      // Danger zone at top
      if (spikeIntensity > 0.5) {
        const dangerZoneHeight = chartHeight * 0.3;
        leftChart.rect(margin, chartTop, chartWidth, dangerZoneHeight);
        leftChart.fill({ color: PIXI_COLORS.danger, alpha: 0.08 });
      }

      // Filled area with gradient layers
      for (let layer = 4; layer >= 0; layer--) {
        const alpha = 0.04 + layer * 0.03;
        const yOffset = layer * 2;

        leftChart.moveTo(margin, chartTop + chartHeight);
        for (let i = 0; i < points.length; i++) {
          const xRatio = i / points.length;
          const yRatio = Math.min(points[i].fee / maxFee, 1);
          const x = margin + xRatio * chartWidth;
          const y = chartTop + chartHeight - yRatio * (chartHeight - yOffset);
          leftChart.lineTo(x, y);
        }
        leftChart.lineTo(margin + chartWidth, chartTop + chartHeight);
        leftChart.closePath();

        const color = spikeIntensity > 0.5 ? PIXI_COLORS.danger : CONFIG.auction.color;
        leftChart.fill({ color, alpha });
      }

      // Glow line
      const lineColor = spikeIntensity > 0.5 ? PIXI_COLORS.danger : CONFIG.auction.color;
      leftChart.setStrokeStyle({ width: 3, color: lineColor, alpha: 0.35 });
      for (let i = 0; i < points.length; i++) {
        const xRatio = i / points.length;
        const yRatio = Math.min(points[i].fee / maxFee, 1);
        const x = margin + xRatio * chartWidth;
        const y = chartTop + chartHeight - yRatio * chartHeight;
        if (i === 0) leftChart.moveTo(x, y);
        else leftChart.lineTo(x, y);
      }
      leftChart.stroke();

      // Sharp line
      leftChart.setStrokeStyle({ width: 2, color: lineColor });
      for (let i = 0; i < points.length; i++) {
        const xRatio = i / points.length;
        const yRatio = Math.min(points[i].fee / maxFee, 1);
        const x = margin + xRatio * chartWidth;
        const y = chartTop + chartHeight - yRatio * chartHeight;
        if (i === 0) leftChart.moveTo(x, y);
        else leftChart.lineTo(x, y);
      }
      leftChart.stroke();

      // Current position
      const lastPoint = points[points.length - 1];
      const currentX = margin + chartWidth;
      const currentY = chartTop + chartHeight - Math.min(lastPoint.fee / maxFee, 1) * chartHeight;

      if (spikeIntensity > 0.3) {
        const pulse = Math.sin(elapsed * 0.015) * 0.5 + 0.5;
        leftChart.circle(currentX, currentY, 20 * pulse);
        leftChart.fill({ color: PIXI_COLORS.danger, alpha: 0.12 });
        leftChart.circle(currentX, currentY, 12 * pulse);
        leftChart.fill({ color: PIXI_COLORS.danger, alpha: 0.2 });
      }
      leftChart.circle(currentX, currentY, 6);
      leftChart.fill({ color: lineColor, alpha: 0.5 });
      leftChart.circle(currentX, currentY, 4);
      leftChart.fill({ color: lineColor });

      // Fee spike indicator badge
      if (spikeIntensity > 0.3) {
        leftChart.roundRect(currentX - 40, currentY - 25, 80, 18, 4);
        leftChart.fill({ color: PIXI_COLORS.danger, alpha: 0.85 });
      }
    }

    // Draw RIGHT chart - Aptos (FLAT, STABLE) - FULL HEIGHT
    const rightChart = graphicsRef.current.rightChart;
    if (rightChart && rightDataRef.current.length > 1) {
      rightChart.clear();
      const points = rightDataRef.current;
      const feeMin = CONFIG.aptos.baseFee * 0.7;
      const feeMax = CONFIG.aptos.baseFee * 1.3;

      // Grid lines
      rightChart.setStrokeStyle({ width: 1, color: 0x374151, alpha: 0.25 });
      for (let i = 0; i <= 5; i++) {
        const y = chartTop + (chartHeight / 5) * i;
        rightChart.moveTo(halfWidth + margin, y);
        rightChart.lineTo(halfWidth + margin + chartWidth, y);
      }
      rightChart.stroke();

      // Stable zone highlight
      const stableTop = chartTop + chartHeight * 0.35;
      const stableH = chartHeight * 0.3;
      rightChart.rect(halfWidth + margin, stableTop, chartWidth, stableH);
      rightChart.fill({ color: CONFIG.aptos.color, alpha: 0.06 });

      // Filled area
      for (let layer = 3; layer >= 0; layer--) {
        const alpha = 0.05 + layer * 0.03;

        rightChart.moveTo(halfWidth + margin, chartTop + chartHeight);
        for (let i = 0; i < points.length; i++) {
          const xRatio = i / points.length;
          const yRatio = (points[i].fee - feeMin) / (feeMax - feeMin);
          const x = halfWidth + margin + xRatio * chartWidth;
          const y = chartTop + chartHeight - yRatio * chartHeight;
          rightChart.lineTo(x, y);
        }
        rightChart.lineTo(halfWidth + margin + chartWidth, chartTop + chartHeight);
        rightChart.fill({ color: CONFIG.aptos.color, alpha });
      }

      // Glow line
      rightChart.setStrokeStyle({ width: 3, color: CONFIG.aptos.color, alpha: 0.35 });
      for (let i = 0; i < points.length; i++) {
        const xRatio = i / points.length;
        const yRatio = (points[i].fee - feeMin) / (feeMax - feeMin);
        const x = halfWidth + margin + xRatio * chartWidth;
        const y = chartTop + chartHeight - yRatio * chartHeight;
        if (i === 0) rightChart.moveTo(x, y);
        else rightChart.lineTo(x, y);
      }
      rightChart.stroke();

      // Sharp line
      rightChart.setStrokeStyle({ width: 2, color: CONFIG.aptos.color });
      for (let i = 0; i < points.length; i++) {
        const xRatio = i / points.length;
        const yRatio = (points[i].fee - feeMin) / (feeMax - feeMin);
        const x = halfWidth + margin + xRatio * chartWidth;
        const y = chartTop + chartHeight - yRatio * chartHeight;
        if (i === 0) rightChart.moveTo(x, y);
        else rightChart.lineTo(x, y);
      }
      rightChart.stroke();

      // Current position
      const lastFee = points[points.length - 1].fee;
      const currentX = halfWidth + margin + chartWidth;
      const currentY = chartTop + chartHeight - ((lastFee - feeMin) / (feeMax - feeMin)) * chartHeight;

      rightChart.circle(currentX, currentY, 8);
      rightChart.fill({ color: CONFIG.aptos.color, alpha: 0.3 });
      rightChart.circle(currentX, currentY, 5);
      rightChart.fill({ color: CONFIG.aptos.color });

      // Stable badge
      rightChart.roundRect(currentX - 30, currentY - 22, 60, 17, 4);
      rightChart.fill({ color: CONFIG.aptos.color, alpha: 0.85 });
    }

    // PARTICLES - Transaction flow comparison - FULL WIDTH
    const particles = graphicsRef.current.particles;
    if (particles) {
      particles.clear();

      // Spawn particles for both sides
      const spawnRate = 0.5 + spikeIntensity * 0.4;
      if (Math.random() < spawnRate) {
        // Left side particles - some fail during spike
        const willFail = spikeIntensity > 0.2 && Math.random() < CONFIG.auction.dropRate * spikeIntensity;
        for (let i = 0; i < 4; i++) {
          if (particlesRef.current.length < CONFIG.maxParticles) {
            const lane = Math.random();
            particlesRef.current.push({
              x: margin + Math.random() * 20,
              y: particleZoneY + 8 + lane * (particleZoneHeight - 16),
              vx: 2.5 + Math.random() * 2.5,
              vy: (Math.random() - 0.5) * 0.6,
              alpha: 0.8,
              failed: willFail && Math.random() < 0.5,
              side: "left",
              size: 2 + Math.random() * 2,
              trail: [],
            });
          }
        }

        // Right side particles - never fail
        for (let i = 0; i < 4; i++) {
          if (particlesRef.current.length < CONFIG.maxParticles) {
            const lane = Math.random();
            particlesRef.current.push({
              x: halfWidth + margin + Math.random() * 20,
              y: particleZoneY + 8 + lane * (particleZoneHeight - 16),
              vx: 3 + Math.random() * 2.5,
              vy: (Math.random() - 0.5) * 0.4,
              alpha: 0.8,
              failed: false,
              side: "right",
              size: 2 + Math.random() * 2,
              trail: [],
            });
          }
        }
      }

      // Update and draw particles
      particlesRef.current = particlesRef.current.filter((p) => {
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 6) p.trail.shift();

        p.x += p.vx;
        p.y += p.vy + Math.sin(p.x * 0.03 + p.size) * 0.2;

        const maxX = p.side === "left" ? halfWidth - margin - 10 : width - margin;
        const midX = p.side === "left" ? margin + chartWidth * 0.6 : halfWidth + margin + chartWidth * 0.6;

        // Failed particles fall and fade
        if (p.failed && p.x > midX) {
          p.vy += 0.12;
          p.alpha -= 0.025;
        }

        // Fade at edges
        if (p.x > maxX - 25) {
          p.alpha -= 0.05;
        }

        if (p.alpha > 0.1) {
          const color = p.failed ? PIXI_COLORS.danger : (p.side === "left" ? CONFIG.auction.color : CONFIG.aptos.color);

          // Trail
          if (p.trail.length > 2) {
            particles.setStrokeStyle({ width: p.size * 0.4, color, alpha: p.alpha * 0.3 });
            particles.moveTo(p.trail[0].x, p.trail[0].y);
            for (let i = 1; i < p.trail.length; i++) {
              particles.lineTo(p.trail[i].x, p.trail[i].y);
            }
            particles.stroke();
          }

          // Glow
          particles.circle(p.x, p.y, p.size * 2);
          particles.fill({ color, alpha: p.alpha * 0.12 });

          // Core
          particles.circle(p.x, p.y, p.size);
          particles.fill({ color, alpha: p.alpha * 0.7 });

          // Bright center
          particles.circle(p.x, p.y, p.size * 0.3);
          particles.fill({ color: 0xffffff, alpha: p.alpha * 0.5 });
        }

        return p.x < width && p.alpha > 0.05 && p.y < height + 20;
      });

      // Load bars at bottom of particle zone
      const barY = particleZoneY + particleZoneHeight - 10;
      const barWidth = chartWidth * 0.7;

      // Left load bar
      particles.roundRect(margin + (chartWidth - barWidth) / 2, barY, barWidth, 6, 3);
      particles.fill({ color: 0x1f2937 });
      const leftLoad = 0.3 + spikeIntensity * 0.7;
      particles.roundRect(margin + (chartWidth - barWidth) / 2, barY, barWidth * leftLoad, 6, 3);
      particles.fill({ color: spikeIntensity > 0.5 ? PIXI_COLORS.danger : CONFIG.auction.color, alpha: 0.8 });

      // Right load bar
      particles.roundRect(halfWidth + margin + (chartWidth - barWidth) / 2, barY, barWidth, 6, 3);
      particles.fill({ color: 0x1f2937 });
      particles.roundRect(halfWidth + margin + (chartWidth - barWidth) / 2, barY, barWidth * leftLoad, 6, 3);
      particles.fill({ color: CONFIG.aptos.color, alpha: 0.8 });
    }

    // Update text labels
    const texts = textsRef.current;
    if (texts.length >= 8) {
      // Adjust font sizes for mobile
      const titleFontSize = isMobile ? 9 : 12;
      const feeFontSize = isMobile ? 16 : 20;
      const statusFontSize = isMobile ? 9 : 11;
      const labelFontSize = isMobile ? 8 : 10;

      // Left title - center it properly
      texts[0].style.fontSize = titleFontSize;
      texts[0].text = isMobile ? "FEE AUCTION" : "FEE AUCTION MODEL";
      texts[0].x = margin + chartWidth / 2;
      texts[0].y = chartTop + 8;
      texts[0].anchor.set(0.5, 0);
      texts[0].style.fill = spikeIntensity > 0.3 ? PIXI_COLORS.danger : CONFIG.auction.color;

      // Left fee value
      texts[1].style.fontSize = feeFontSize;
      texts[1].text = formatFee(aucFee);
      texts[1].x = margin + 8;
      texts[1].y = chartTop + chartHeight - 28;
      texts[1].style.fill = spikeIntensity > 0.3 ? PIXI_COLORS.danger : 0xffffff;

      // Left status
      texts[2].style.fontSize = statusFontSize;
      const multiplier = Math.round(aucFee / CONFIG.auction.baseFee);
      texts[2].text = spikeIntensity > 0.1 ? `${multiplier.toLocaleString()}x SPIKE!` : "";
      texts[2].x = margin + 8;
      texts[2].y = chartTop + 28;

      // Left dropped
      texts[3].style.fontSize = labelFontSize;
      const dropped = Math.round(spikeIntensity * CONFIG.auction.dropRate * 100);
      texts[3].text = `Dropped: ${dropped}%`;
      texts[3].x = margin + 8;
      texts[3].y = particleZoneY - 14;
      texts[3].style.fill = dropped > 0 ? PIXI_COLORS.danger : 0x6b7280;

      // Right title - center it properly
      texts[4].style.fontSize = titleFontSize;
      texts[4].text = isMobile ? "APTOS" : "APTOS (FLAT)";
      texts[4].x = halfWidth + margin + chartWidth / 2;
      texts[4].y = chartTop + 8;
      texts[4].anchor.set(0.5, 0);

      // Right fee value
      texts[5].style.fontSize = feeFontSize;
      texts[5].text = formatFee(aptFee);
      texts[5].x = halfWidth + margin + 8;
      texts[5].y = chartTop + chartHeight - 28;

      // Right status
      texts[6].style.fontSize = statusFontSize;
      texts[6].text = "STABLE";
      texts[6].x = halfWidth + margin + 8;
      texts[6].y = chartTop + 28;

      // Right dropped
      texts[7].style.fontSize = labelFontSize;
      texts[7].text = "Dropped: 0%";
      texts[7].x = halfWidth + margin + 8;
      texts[7].y = particleZoneY - 14;

      // VS text
      if (texts[8]) {
        texts[8].x = halfWidth - 10;
        texts[8].y = chartTop + chartHeight / 2 - 8;
      }
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
      leftChart: new Graphics(),
      rightChart: new Graphics(),
      divider: new Graphics(),
      particles: new Graphics(),
      effects: new Graphics(),
    };

    app.stage.addChild(graphicsRef.current.background!);
    app.stage.addChild(graphicsRef.current.divider!);
    app.stage.addChild(graphicsRef.current.leftChart!);
    app.stage.addChild(graphicsRef.current.rightChart!);
    app.stage.addChild(graphicsRef.current.particles!);
    app.stage.addChild(graphicsRef.current.effects!);

    // Text styles
    const titleStyle = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 12,
      fontWeight: "700",
      fill: CONFIG.auction.color,
    });

    const feeStyle = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 20,
      fontWeight: "bold",
      fill: 0xffffff,
    });

    const statusStyle = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 11,
      fontWeight: "600",
      fill: PIXI_COLORS.danger,
    });

    const labelStyle = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 10,
      fill: 0x6b7280,
    });

    const vsStyle = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 14,
      fontWeight: "bold",
      fill: 0x6b7280,
    });

    textsRef.current = [
      new Text({ text: "FEE AUCTION MODEL", style: titleStyle }),
      new Text({ text: "$0.00001", style: feeStyle }),
      new Text({ text: "", style: statusStyle }),
      new Text({ text: "Dropped: 0%", style: labelStyle }),
      new Text({ text: "APTOS (FLAT)", style: { ...titleStyle, fill: CONFIG.aptos.color } }),
      new Text({ text: "$0.0005", style: { ...feeStyle, fill: CONFIG.aptos.color } }),
      new Text({ text: "STABLE", style: { ...statusStyle, fill: CONFIG.aptos.color } }),
      new Text({ text: "Dropped: 0%", style: { ...labelStyle, fill: CONFIG.aptos.color } }),
      new Text({ text: "VS", style: vsStyle }),
    ];

    textsRef.current.forEach(t => app.stage.addChild(t));

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
        leftChart: null,
        rightChart: null,
        divider: null,
        particles: null,
        effects: null,
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
      leftDataRef.current = [];
      rightDataRef.current = [];
    }
  };

  const handleRestart = () => {
    startTimeRef.current = performance.now();
    leftDataRef.current = [];
    rightDataRef.current = [];
    particlesRef.current = [];
    setIsPlaying(true);
  };

  return (
    <div className={`chrome-card p-4 sm:p-6 ${className || ""}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-title">Fee Comparison: Same Load</h3>
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

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center p-3 rounded-lg" style={{ backgroundColor: loadProgress > 0.3 ? "rgba(239, 68, 68, 0.15)" : "rgba(153, 69, 255, 0.08)" }}>
          <div className="text-xs mb-1" style={{ color: loadProgress > 0.3 ? "#ef4444" : "#9945ff" }}>
            Fee Auction Model
          </div>
          <div className="text-2xl font-bold" style={{ color: loadProgress > 0.3 ? "#ef4444" : "#ffffff" }}>
            {formatFee(auctionFee)}
          </div>
          {loadProgress > 0.1 && (
            <div className="text-sm mt-1 font-semibold" style={{ color: "#ef4444" }}>
              {Math.round(auctionFee / CONFIG.auction.baseFee).toLocaleString()}x surge!
            </div>
          )}
        </div>
        <div className="text-center p-3 rounded-lg" style={{ backgroundColor: "rgba(0, 217, 165, 0.08)" }}>
          <div className="text-xs mb-1" style={{ color: "var(--accent)" }}>
            Aptos (Governance-Set)
          </div>
          <div className="text-2xl font-bold" style={{ color: "#ffffff" }}>
            {formatFee(aptosFee)}
          </div>
          <div className="text-sm mt-1 font-semibold" style={{ color: "var(--accent)" }}>
            Stable
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="canvas-wrap relative rounded-lg overflow-hidden"
        style={{ height: "380px", backgroundColor: "#0a0a0b" }}
      >
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-sm" style={{ color: "var(--chrome-500)" }}>
              Loading visualization...
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: "rgba(0, 217, 165, 0.05)" }}>
        <p className="text-xs" style={{ color: "var(--chrome-400)" }}>
          <span style={{ color: "var(--accent)", fontWeight: 600 }}>Illustrative scenario:</span>{" "}
          During high demand, fee auction models can spike dramatically as users bid for priority.
          Aptos uses governance-set pricing&mdash;your fee stays the same regardless of network load.
        </p>
      </div>
    </div>
  );
});
