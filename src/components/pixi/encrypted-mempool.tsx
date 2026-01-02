"use client";

import { memo, useEffect, useRef, useState, useCallback } from "react";
import { Application, Graphics, Text, TextStyle, Container } from "pixi.js";
import { useVisibility } from "@/hooks/useVisibility";
import { PIXI_COLORS, lerp } from "@/lib/pixi-utils";

interface EncryptedMempoolProps {
  className?: string;
  loopMs?: number;
  packetCount?: number;
}

const CONFIG = {
  duration: 12000, // 12 second loop
  packetCount: 24,
  validatorCount: 6,
  botCount: 3,
  stateUpdateInterval: 50,
};

// Phase timing (in normalized 0-1 progress)
const PHASES = {
  transparent_mempool: { start: 0, duration: 0.18 },      // 2.2s
  encrypt: { start: 0.18, duration: 0.13 },               // 1.6s
  encrypted_mempool: { start: 0.31, duration: 0.20 },     // 2.4s
  batch_decrypt: { start: 0.51, duration: 0.18 },         // 2.2s
  execute: { start: 0.69, duration: 0.17 },               // 2.0s
  buffer: { start: 0.86, duration: 0.14 },                // 1.6s buffer/reset
};

type Phase = keyof typeof PHASES;

interface Packet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  state: "clear" | "encrypting" | "ciphertext" | "decrypting" | "decrypted";
  targetX: number;
  targetY: number;
  angle: number;
  size: number;
}

interface Bot {
  x: number;
  y: number;
  scanX: number;
  active: boolean;
  opacity: number;
}

interface Validator {
  x: number;
  y: number;
  angle: number;
  phase: "idle" | "share" | "decrypt";
  beamOpacity: number;
}

export const EncryptedMempool = memo(function EncryptedMempool({
  className,
  loopMs = CONFIG.duration,
  packetCount = CONFIG.packetCount,
}: EncryptedMempoolProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const initAttemptedRef = useRef(false);

  const isPlayingRef = useRef(true);
  const startTimeRef = useRef<number>(0);
  const lastStateUpdateRef = useRef<number>(0);

  const packetsRef = useRef<Packet[]>([]);
  const botsRef = useRef<Bot[]>([]);
  const validatorsRef = useRef<Validator[]>([]);

  const graphicsRef = useRef<{
    background: Graphics | null;
    mempool: Graphics | null;
    packets: Graphics | null;
    bots: Graphics | null;
    validators: Graphics | null;
    effects: Graphics | null;
  }>({
    background: null,
    mempool: null,
    packets: null,
    bots: null,
    validators: null,
    effects: null,
  });

  const textsRef = useRef<Text[]>([]);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentPhase, setCurrentPhase] = useState<Phase>("transparent_mempool");
  const [phaseLabel, setPhaseLabel] = useState("MEV Risk");

  const isVisible = useVisibility(containerRef);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const getPhase = useCallback((progress: number): Phase => {
    for (const [phase, timing] of Object.entries(PHASES)) {
      if (progress >= timing.start && progress < timing.start + timing.duration) {
        return phase as Phase;
      }
    }
    return "transparent_mempool";
  }, []);

  const getPhaseProgress = useCallback((progress: number, phase: Phase): number => {
    const timing = PHASES[phase];
    return Math.max(0, Math.min(1, (progress - timing.start) / timing.duration));
  }, []);

  const initEntities = useCallback((width: number, height: number) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const mempoolRadius = Math.min(width, height) * 0.25;

    // Initialize packets in a circular pattern around mempool
    packetsRef.current = Array(packetCount).fill(null).map((_, i) => {
      const angle = (i / packetCount) * Math.PI * 2 + Math.random() * 0.3;
      const dist = mempoolRadius * (0.3 + Math.random() * 0.5);
      return {
        id: i,
        x: centerX + Math.cos(angle) * dist,
        y: centerY + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        state: "clear" as const,
        targetX: centerX + Math.cos(angle) * dist,
        targetY: centerY + Math.sin(angle) * dist,
        angle: angle,
        size: 8 + Math.random() * 6,
      };
    });

    // Initialize MEV bots on the left side
    botsRef.current = Array(CONFIG.botCount).fill(null).map((_, i) => ({
      x: 60,
      y: centerY - 60 + i * 60,
      scanX: 60,
      active: true,
      opacity: 1,
    }));

    // Initialize validators in a ring
    validatorsRef.current = Array(CONFIG.validatorCount).fill(null).map((_, i) => {
      const angle = (i / CONFIG.validatorCount) * Math.PI * 2 - Math.PI / 2;
      return {
        x: centerX + Math.cos(angle) * (mempoolRadius + 80),
        y: centerY + Math.sin(angle) * (mempoolRadius + 80),
        angle,
        phase: "idle" as const,
        beamOpacity: 0,
      };
    });
  }, [packetCount]);

  const updateAnimation = useCallback(() => {
    const app = appRef.current;
    const container = containerRef.current;
    if (!app || !container) return;

    const now = performance.now();
    const elapsed = now - startTimeRef.current;
    const progress = (elapsed % loopMs) / loopMs;
    const phase = getPhase(progress);
    const phaseProgress = getPhaseProgress(progress, phase);

    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    if (Math.abs(app.screen.width - width) > 1 || Math.abs(app.screen.height - height) > 1) {
      app.renderer.resize(width, height);
    }

    const centerX = width / 2;
    const centerY = height / 2;
    const mempoolRadius = Math.min(width, height) * 0.25;

    // Reset at cycle start
    if (progress < 0.02 && packetsRef.current[0]?.state !== "clear") {
      initEntities(width, height);
    }

    // Update packets based on phase
    packetsRef.current.forEach((packet, i) => {
      switch (phase) {
        case "transparent_mempool":
          packet.state = "clear";
          // Gentle floating motion
          packet.x += packet.vx;
          packet.y += packet.vy;
          // Keep within mempool bounds
          const dist = Math.sqrt((packet.x - centerX) ** 2 + (packet.y - centerY) ** 2);
          if (dist > mempoolRadius * 0.8) {
            packet.vx *= -0.8;
            packet.vy *= -0.8;
          }
          break;

        case "encrypt":
          // Morph to ciphertext
          packet.state = phaseProgress < 0.5 ? "encrypting" : "ciphertext";
          // Slight inward pull
          packet.x = lerp(packet.x, centerX + Math.cos(packet.angle) * mempoolRadius * 0.5, 0.02);
          packet.y = lerp(packet.y, centerY + Math.sin(packet.angle) * mempoolRadius * 0.5, 0.02);
          break;

        case "encrypted_mempool":
          packet.state = "ciphertext";
          // Slow orbit
          packet.angle += 0.003;
          const orbitDist = mempoolRadius * (0.3 + (i % 3) * 0.15);
          packet.x = lerp(packet.x, centerX + Math.cos(packet.angle) * orbitDist, 0.03);
          packet.y = lerp(packet.y, centerY + Math.sin(packet.angle) * orbitDist, 0.03);
          break;

        case "batch_decrypt":
          packet.state = phaseProgress < 0.6 ? "ciphertext" : "decrypting";
          if (phaseProgress > 0.8) {
            packet.state = "decrypted";
          }
          break;

        case "execute":
          packet.state = "decrypted";
          // Move packets to execution area (right side)
          const executionX = width - 100;
          const executionY = centerY + (i - packetCount / 2) * 6;
          packet.x = lerp(packet.x, executionX, 0.05);
          packet.y = lerp(packet.y, executionY, 0.05);
          break;

        case "buffer":
          // Reset for next cycle
          packet.state = "clear";
          const resetAngle = (i / packetCount) * Math.PI * 2;
          const resetDist = mempoolRadius * (0.3 + Math.random() * 0.5);
          packet.x = lerp(packet.x, centerX + Math.cos(resetAngle) * resetDist, 0.1);
          packet.y = lerp(packet.y, centerY + Math.sin(resetAngle) * resetDist, 0.1);
          packet.angle = resetAngle;
          break;
      }
    });

    // Update bots
    botsRef.current.forEach((bot, i) => {
      const scanSpeed = 3;
      const maxScan = phase === "transparent_mempool" ? centerX + mempoolRadius : 80;

      if (phase === "transparent_mempool") {
        bot.active = true;
        bot.opacity = lerp(bot.opacity, 1, 0.1);
        bot.scanX += scanSpeed;
        if (bot.scanX > maxScan) bot.scanX = 60;
      } else {
        bot.active = false;
        bot.opacity = lerp(bot.opacity, 0.2, 0.05);
        bot.scanX = lerp(bot.scanX, 60, 0.1);
      }
    });

    // Update validators
    validatorsRef.current.forEach((validator, i) => {
      if (phase === "batch_decrypt") {
        validator.phase = phaseProgress < 0.3 ? "share" : "decrypt";
        validator.beamOpacity = phaseProgress < 0.8
          ? Math.sin(phaseProgress * Math.PI * 2) * 0.8 + 0.2
          : lerp(validator.beamOpacity, 0, 0.1);
      } else {
        validator.phase = "idle";
        validator.beamOpacity = lerp(validator.beamOpacity, 0, 0.1);
      }
    });

    // Throttle React state updates
    if (now - lastStateUpdateRef.current > CONFIG.stateUpdateInterval) {
      lastStateUpdateRef.current = now;
      setCurrentPhase(phase);

      switch (phase) {
        case "transparent_mempool":
          setPhaseLabel("MEV Risk: Visible Transactions");
          break;
        case "encrypt":
          setPhaseLabel("Encrypting Intent...");
          break;
        case "encrypted_mempool":
          setPhaseLabel("Ciphertext Only - Bots Blinded");
          break;
        case "batch_decrypt":
          setPhaseLabel("Threshold Decryption (<20ms)");
          break;
        case "execute":
          setPhaseLabel("Execute After Ordering");
          break;
        case "buffer":
          setPhaseLabel("Cycle Complete");
          break;
      }
    }

    // Draw background
    const bg = graphicsRef.current.background;
    if (bg) {
      bg.clear();
      bg.rect(0, 0, width, height);
      bg.fill({ color: 0x0a0a0b });

      // Grid
      const gridAlpha = 0.02;
      bg.setStrokeStyle({ width: 1, color: 0x1f2937, alpha: gridAlpha });
      for (let x = 0; x < width; x += 30) {
        bg.moveTo(x, 0);
        bg.lineTo(x, height);
      }
      for (let y = 0; y < height; y += 30) {
        bg.moveTo(0, y);
        bg.lineTo(width, y);
      }
      bg.stroke();
    }

    // Draw mempool area
    const mempool = graphicsRef.current.mempool;
    if (mempool) {
      mempool.clear();

      // Mempool container circle
      const mempoolColor = phase === "encrypted_mempool" || phase === "batch_decrypt"
        ? 0x00d9a5 // Cyan for encrypted
        : 0x4a5568; // Gray for transparent

      mempool.circle(centerX, centerY, mempoolRadius);
      mempool.fill({ color: mempoolColor, alpha: 0.08 });
      mempool.stroke({ width: 2, color: mempoolColor, alpha: 0.4 });

      // Label
      const labelText = phase === "transparent_mempool"
        ? "TRANSPARENT MEMPOOL"
        : phase === "encrypt"
        ? "ENCRYPTING..."
        : "ENCRYPTED MEMPOOL";

      // Inner glow effect for encrypted state
      if (phase === "encrypted_mempool" || phase === "batch_decrypt") {
        const glowPulse = Math.sin(elapsed * 0.003) * 0.1 + 0.15;
        mempool.circle(centerX, centerY, mempoolRadius * 0.9);
        mempool.fill({ color: 0x00d9a5, alpha: glowPulse });
      }
    }

    // Draw packets
    const packets = graphicsRef.current.packets;
    if (packets) {
      packets.clear();

      packetsRef.current.forEach((packet) => {
        let color: number;
        let alpha = 0.9;
        let showLock = false;

        switch (packet.state) {
          case "clear":
            color = 0xffffff; // Warm white
            break;
          case "encrypting":
            color = 0x00d9a5; // Transitioning to cyan
            alpha = 0.6 + Math.sin(elapsed * 0.02) * 0.3;
            showLock = true;
            break;
          case "ciphertext":
            color = 0x00ffff; // Neon cyan
            showLock = true;
            break;
          case "decrypting":
            color = 0x00ffaa;
            alpha = 0.7 + Math.sin(elapsed * 0.03) * 0.3;
            showLock = true;
            break;
          case "decrypted":
            color = 0x00d9a5; // Aptos teal
            break;
          default:
            color = 0xffffff;
        }

        // Packet body
        if (showLock) {
          // Draw lock shape for ciphertext
          const lockSize = packet.size * 0.7;

          // Lock body (rectangle)
          packets.roundRect(
            packet.x - lockSize / 2,
            packet.y - lockSize / 4,
            lockSize,
            lockSize * 0.8,
            2
          );
          packets.fill({ color, alpha });

          // Lock shackle (arc)
          packets.setStrokeStyle({ width: 2, color, alpha });
          packets.arc(
            packet.x,
            packet.y - lockSize / 4,
            lockSize / 3,
            Math.PI,
            0
          );
          packets.stroke();
        } else {
          // Clear packet - simple circle with glyph
          packets.circle(packet.x, packet.y, packet.size / 2);
          packets.fill({ color, alpha });

          // Inner detail
          packets.circle(packet.x, packet.y, packet.size / 4);
          packets.fill({ color: 0x0a0a0b, alpha: 0.5 });
        }
      });
    }

    // Draw MEV bots
    const bots = graphicsRef.current.bots;
    if (bots) {
      bots.clear();

      botsRef.current.forEach((bot, i) => {
        const botColor = 0xff6b35; // Red/orange

        // Bot body
        bots.roundRect(bot.x - 15, bot.y - 12, 30, 24, 4);
        bots.fill({ color: botColor, alpha: bot.opacity * 0.8 });

        // Bot eyes
        bots.circle(bot.x - 5, bot.y - 2, 3);
        bots.circle(bot.x + 5, bot.y - 2, 3);
        bots.fill({ color: 0xffffff, alpha: bot.opacity });

        // Antenna
        bots.setStrokeStyle({ width: 2, color: botColor, alpha: bot.opacity });
        bots.moveTo(bot.x, bot.y - 12);
        bots.lineTo(bot.x, bot.y - 18);
        bots.stroke();
        bots.circle(bot.x, bot.y - 20, 3);
        bots.fill({ color: bot.active ? 0x00ff00 : 0xff0000, alpha: bot.opacity });

        // Scan beam
        if (bot.active && phase === "transparent_mempool") {
          bots.setStrokeStyle({ width: 1, color: botColor, alpha: 0.3 });
          bots.moveTo(bot.x + 15, bot.y);
          bots.lineTo(bot.scanX, bot.y - 15);
          bots.lineTo(bot.scanX, bot.y + 15);
          bots.lineTo(bot.x + 15, bot.y);
          bots.stroke();
          bots.fill({ color: botColor, alpha: 0.1 });
        }

        // "NO DATA" indicator when encrypted
        if (!bot.active && (phase === "encrypted_mempool" || phase === "batch_decrypt")) {
          bots.setStrokeStyle({ width: 2, color: 0xff0000, alpha: 0.6 });
          bots.circle(bot.x + 40, bot.y, 12);
          bots.stroke();
          bots.moveTo(bot.x + 32, bot.y - 8);
          bots.lineTo(bot.x + 48, bot.y + 8);
          bots.stroke();
        }
      });
    }

    // Draw validators
    const validators = graphicsRef.current.validators;
    if (validators) {
      validators.clear();

      validatorsRef.current.forEach((validator, i) => {
        const validatorColor = 0x00d9a5; // Aptos teal/green

        // Validator node
        validators.circle(validator.x, validator.y, 18);
        validators.fill({
          color: validator.phase === "idle" ? 0x1a1a2e : validatorColor,
          alpha: 0.9
        });
        validators.stroke({
          width: 2,
          color: validatorColor,
          alpha: validator.phase === "idle" ? 0.4 : 1
        });

        // "V" label
        validators.setStrokeStyle({ width: 2, color: 0xffffff, alpha: 0.8 });
        validators.moveTo(validator.x - 6, validator.y - 5);
        validators.lineTo(validator.x, validator.y + 5);
        validators.lineTo(validator.x + 6, validator.y - 5);
        validators.stroke();

        // Key share beam during batch_decrypt
        if (validator.beamOpacity > 0.01) {
          const beamColor = 0x00ffff;
          validators.setStrokeStyle({
            width: 3,
            color: beamColor,
            alpha: validator.beamOpacity
          });
          validators.moveTo(validator.x, validator.y);
          validators.lineTo(centerX, centerY);
          validators.stroke();

          // Beam particles
          const particleCount = 3;
          for (let p = 0; p < particleCount; p++) {
            const t = ((elapsed * 0.002 + p / particleCount) % 1);
            const px = lerp(validator.x, centerX, t);
            const py = lerp(validator.y, centerY, t);
            validators.circle(px, py, 4);
            validators.fill({ color: beamColor, alpha: validator.beamOpacity * (1 - t) });
          }
        }
      });

      // Central decrypt burst during batch_decrypt
      if (phase === "batch_decrypt" && phaseProgress > 0.6) {
        const burstAlpha = Math.sin((phaseProgress - 0.6) * Math.PI / 0.4) * 0.6;
        const burstRadius = mempoolRadius * (0.5 + (phaseProgress - 0.6) * 2);

        validators.circle(centerX, centerY, burstRadius);
        validators.fill({ color: 0x00ffff, alpha: burstAlpha * 0.3 });
        validators.stroke({ width: 3, color: 0x00ffff, alpha: burstAlpha });
      }
    }

    // Draw effects (execution area)
    const effects = graphicsRef.current.effects;
    if (effects) {
      effects.clear();

      if (phase === "execute") {
        // Execution area on the right
        const execX = width - 80;
        const execWidth = 60;
        const execHeight = height * 0.6;
        const execY = (height - execHeight) / 2;

        effects.roundRect(execX - execWidth / 2, execY, execWidth, execHeight, 8);
        effects.fill({ color: 0x00d9a5, alpha: 0.1 });
        effects.stroke({ width: 2, color: 0x00d9a5, alpha: 0.5 });

        // Block seal animation
        const sealProgress = phaseProgress;
        if (sealProgress > 0.5) {
          const sealAlpha = (sealProgress - 0.5) * 2;
          effects.roundRect(execX - 25, execY + execHeight - 50, 50, 40, 6);
          effects.fill({ color: 0x00d9a5, alpha: sealAlpha * 0.8 });

          // Checkmark
          effects.setStrokeStyle({ width: 3, color: 0xffffff, alpha: sealAlpha });
          effects.moveTo(execX - 10, execY + execHeight - 30);
          effects.lineTo(execX - 2, execY + execHeight - 22);
          effects.lineTo(execX + 12, execY + execHeight - 38);
          effects.stroke();
        }
      }

      // Wallet icon on the left during encrypt phase
      if (phase === "encrypt") {
        const walletX = 50;
        const walletY = centerY;

        // Wallet shape
        effects.roundRect(walletX - 20, walletY - 15, 40, 30, 5);
        effects.fill({ color: 0x3b82f6, alpha: 0.8 });
        effects.stroke({ width: 2, color: 0x60a5fa, alpha: 1 });

        // Arrow to mempool
        const arrowPulse = Math.sin(elapsed * 0.01) * 0.3 + 0.7;
        effects.setStrokeStyle({ width: 2, color: 0x00d9a5, alpha: arrowPulse });
        effects.moveTo(walletX + 25, walletY);
        effects.lineTo(centerX - mempoolRadius - 20, walletY);
        effects.stroke();

        // Arrow head
        effects.moveTo(centerX - mempoolRadius - 20, walletY);
        effects.lineTo(centerX - mempoolRadius - 30, walletY - 8);
        effects.lineTo(centerX - mempoolRadius - 30, walletY + 8);
        effects.closePath();
        effects.fill({ color: 0x00d9a5, alpha: arrowPulse });
      }
    }

    // Update texts
    const texts = textsRef.current;
    if (texts.length >= 6) {
      // Title
      texts[0].x = centerX;
      texts[0].y = 15;

      // Phase indicator
      texts[1].text = phaseLabel;
      texts[1].x = centerX;
      texts[1].y = height - 80;

      // Mempool label
      texts[2].x = centerX;
      texts[2].y = centerY + mempoolRadius + 20;
      texts[2].text = phase === "transparent_mempool"
        ? "TRANSPARENT"
        : phase === "encrypt"
        ? "ENCRYPTING"
        : "ENCRYPTED";

      // Bot status
      texts[3].x = 60;
      texts[3].y = centerY + 80;
      texts[3].text = phase === "transparent_mempool"
        ? "BOTS: SCANNING"
        : "BOTS: BLINDED";
      texts[3].style.fill = phase === "transparent_mempool" ? 0xff6b35 : 0x4a5568;

      // Validator status
      texts[4].x = width - 80;
      texts[4].y = 60;
      texts[4].visible = phase === "batch_decrypt";
      texts[4].text = "DECRYPTING";

      // Overhead label
      texts[5].x = centerX;
      texts[5].y = height - 50;
      texts[5].visible = phase === "batch_decrypt";
    }
  }, [loopMs, getPhase, getPhaseProgress, initEntities, phaseLabel]);

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
      mempool: new Graphics(),
      packets: new Graphics(),
      bots: new Graphics(),
      validators: new Graphics(),
      effects: new Graphics(),
    };

    app.stage.addChild(graphicsRef.current.background!);
    app.stage.addChild(graphicsRef.current.mempool!);
    app.stage.addChild(graphicsRef.current.effects!);
    app.stage.addChild(graphicsRef.current.packets!);
    app.stage.addChild(graphicsRef.current.bots!);
    app.stage.addChild(graphicsRef.current.validators!);

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
      fontSize: 13,
      fontWeight: "700",
      fill: 0x00d9a5,
      letterSpacing: 0.5,
    });

    const labelStyle = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 10,
      fontWeight: "600",
      fill: 0x9ca3af,
      letterSpacing: 0.5,
    });

    const statusStyle = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 9,
      fontWeight: "700",
      fill: 0xff6b35,
      letterSpacing: 0.5,
    });

    const overheadStyle = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 11,
      fontWeight: "600",
      fill: 0x00ffff,
      letterSpacing: 0.5,
    });

    textsRef.current = [
      new Text({ text: "ENCRYPTED MEMPOOL", style: titleStyle }),
      new Text({ text: "MEV Risk: Visible Transactions", style: phaseStyle }),
      new Text({ text: "TRANSPARENT", style: labelStyle }),
      new Text({ text: "BOTS: SCANNING", style: statusStyle }),
      new Text({ text: "DECRYPTING", style: labelStyle }),
      new Text({ text: "Overhead: <20ms (batched threshold decryption)", style: overheadStyle }),
    ];

    textsRef.current.forEach((t) => {
      t.anchor.set(0.5, 0);
      app.stage.addChild(t);
    });

    initEntities(rect.width, rect.height);
    startTimeRef.current = performance.now();
    setIsReady(true);

    app.ticker.add(updateAnimation);
  }, [updateAnimation, initEntities]);

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
            initEntities(width, height);
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
      clearTimeout(initTimeout);
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
  }, [initPixi, initEntities]);

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
    }
  };

  const handleRestart = () => {
    startTimeRef.current = performance.now();
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      initEntities(rect.width, rect.height);
    }
    setIsPlaying(true);
  };

  return (
    <div className={`chrome-card p-4 sm:p-6 ${className || ""}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="section-title">Encrypted Mempool</h3>
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: "rgba(59, 130, 246, 0.2)",
                color: "#60a5fa",
                border: "1px solid rgba(59, 130, 246, 0.3)"
              }}
            >
              GOVERNANCE-PENDING
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--chrome-500)" }}>
            MEV protection via threshold encryption
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

      <div className="metric-grid grid-cols-4 mb-4">
        <div className="metric-cell">
          <div
            className="stat-value text-lg"
            style={{
              color: currentPhase === "transparent_mempool" ? "#ff6b35" : "var(--accent)"
            }}
          >
            {currentPhase === "transparent_mempool" ? "VISIBLE" : "HIDDEN"}
          </div>
          <div className="stat-label">Intent</div>
        </div>
        <div className="metric-cell">
          <div
            className="stat-value text-lg"
            style={{
              color: currentPhase === "transparent_mempool" ? "#ff6b35" : "var(--chrome-500)"
            }}
          >
            {currentPhase === "transparent_mempool" ? "ACTIVE" : "BLOCKED"}
          </div>
          <div className="stat-label">MEV Bots</div>
        </div>
        <div className="metric-cell">
          <div className="stat-value text-lg" style={{ color: "var(--accent)" }}>
            &lt;20ms
          </div>
          <div className="stat-label">Decrypt Time</div>
        </div>
        <div className="metric-cell">
          <div className="stat-value text-lg" style={{ color: "var(--accent)" }}>
            ~14%
          </div>
          <div className="stat-label">Overhead</div>
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

      <div
        className="mt-4 p-4 rounded-lg"
        style={{
          backgroundColor: "rgba(0, 217, 165, 0.08)",
          border: "1px solid rgba(0, 217, 165, 0.2)"
        }}
      >
        <h4 className="text-sm font-bold mb-2" style={{ color: "var(--accent)" }}>
          How It Works
        </h4>
        <div className="grid grid-cols-2 gap-3 text-xs" style={{ color: "var(--chrome-400)" }}>
          <div>
            <span className="font-bold" style={{ color: "var(--chrome-300)" }}>1.</span> Users encrypt transactions as ciphertext before submission
          </div>
          <div>
            <span className="font-bold" style={{ color: "var(--chrome-300)" }}>2.</span> Validators see only encrypted payloads - no MEV extraction
          </div>
          <div>
            <span className="font-bold" style={{ color: "var(--chrome-300)" }}>3.</span> After ordering, validators batch-decrypt using threshold shares
          </div>
          <div>
            <span className="font-bold" style={{ color: "var(--chrome-300)" }}>4.</span> Order first, reveal later - fair execution guaranteed
          </div>
        </div>
      </div>

      <div
        className="mt-3 text-xs text-center"
        style={{ color: "var(--chrome-600)" }}
      >
        Governance-pending. Sources: Aptos Foundation + TrX paper (IACR 2025/2032)
      </div>
    </div>
  );
});
