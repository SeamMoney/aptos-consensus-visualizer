"use client";

import { useRef, useEffect, useState, memo } from "react";
import { useVisibility } from "@/hooks/useVisibility";

/**
 * Consensus Evolution Comparison
 *
 * Shows the evolution of Aptos consensus:
 * AptosBFT (100ms) → Baby Raptr (80ms) → Velociraptr (60ms) → Archon (10ms)
 *
 * Plus comparison to competitors:
 * - Solana Tower BFT (400ms blocks, 12.8s finality)
 * - Sui Mysticeti v2 (250-300ms blocks)
 */

interface ConsensusProtocol {
  name: string;
  blockTime: number;
  finality: number;
  color: string;
  year: string;
  innovation: string;
  chain: "aptos" | "solana" | "sui";
}

const PROTOCOLS: ConsensusProtocol[] = [
  // Aptos evolution
  { name: "AptosBFT v4", blockTime: 100, finality: 1500, color: "#6B7280", year: "2023", innovation: "Jolteon 2-chain", chain: "aptos" },
  { name: "Baby Raptr", blockTime: 80, finality: 1000, color: "#8B5CF6", year: "2024", innovation: "Optimistic QS", chain: "aptos" },
  { name: "Velociraptr", blockTime: 60, finality: 800, color: "#3B82F6", year: "2025", innovation: "Pipelined proposals", chain: "aptos" },
  { name: "Archon", blockTime: 10, finality: 30, color: "#00D9A5", year: "2026", innovation: "Co-located cluster", chain: "aptos" },
  // Competitors
  { name: "Solana Tower", blockTime: 400, finality: 12800, color: "#9945FF", year: "Current", innovation: "PoH + 32-layer", chain: "solana" },
  { name: "Sui Mysticeti", blockTime: 180, finality: 250, color: "#6FBCF0", year: "2025", innovation: "DAG parallel", chain: "sui" },
];

const APTOS_PROTOCOLS = PROTOCOLS.filter(p => p.chain === "aptos");
const COMPETITOR_PROTOCOLS = PROTOCOLS.filter(p => p.chain !== "aptos");

export const ConsensusEvolution = memo(function ConsensusEvolution() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const [activeProtocol, setActiveProtocol] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const isVisible = useVisibility(containerRef);
  const phaseTimerRef = useRef(0);
  const animProgressRef = useRef(0);

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
      const width = rect.width;
      const height = rect.height;
      const mobile = width < 500;
      setIsMobile(mobile);

      if (canvas.width !== Math.floor(width * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
      }

      // Clear
      ctx.fillStyle = "#0a0a0b";
      ctx.fillRect(0, 0, width, height);

      // Phase timer for cycling through protocols
      phaseTimerRef.current++;
      if (phaseTimerRef.current > 60) {
        phaseTimerRef.current = 0;
        setActiveProtocol((prev) => (prev + 1) % APTOS_PROTOCOLS.length);
        animProgressRef.current = 0;
      }

      // Animate progress
      animProgressRef.current = Math.min(animProgressRef.current + 0.03, 1);
      const easeOut = 1 - Math.pow(1 - animProgressRef.current, 3);

      const padding = mobile ? 10 : 20;
      const titleY = mobile ? 18 : 25;

      // Title
      ctx.fillStyle = "#00D9A5";
      ctx.font = mobile ? "bold 9px system-ui" : "bold 11px system-ui";
      ctx.textAlign = "left";
      ctx.fillText("CONSENSUS EVOLUTION", padding, titleY);

      // Subtitle showing active protocol
      const activeProto = APTOS_PROTOCOLS[activeProtocol];
      ctx.fillStyle = activeProto.color;
      ctx.font = mobile ? "bold 7px monospace" : "bold 9px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`${activeProto.name}: ${activeProto.blockTime}ms`, width - padding, titleY);

      // === APTOS EVOLUTION SECTION ===
      const sectionY = mobile ? 35 : 45;
      const barHeight = mobile ? 16 : 22;
      const barGap = mobile ? 6 : 10;
      const maxBlockTime = 120; // Scale for Aptos protocols
      const barMaxWidth = width - padding * 2 - (mobile ? 70 : 100);

      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = mobile ? "bold 7px system-ui" : "bold 9px system-ui";
      ctx.textAlign = "left";
      ctx.fillText("APTOS", padding, sectionY);

      APTOS_PROTOCOLS.forEach((proto, i) => {
        const y = sectionY + 10 + i * (barHeight + barGap);
        const isActive = i === activeProtocol;
        const barWidth = (proto.blockTime / maxBlockTime) * barMaxWidth;
        const animatedWidth = i <= activeProtocol ? barWidth * easeOut : barWidth;

        // Label
        ctx.fillStyle = isActive ? proto.color : "rgba(255,255,255,0.5)";
        ctx.font = mobile ? "6px system-ui" : "8px system-ui";
        ctx.textAlign = "left";
        ctx.fillText(proto.name, padding, y + barHeight / 2 + 3);

        // Bar background
        const barX = padding + (mobile ? 55 : 75);
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.beginPath();
        ctx.roundRect(barX, y, barMaxWidth, barHeight, 3);
        ctx.fill();

        // Bar fill
        ctx.fillStyle = proto.color + (isActive ? "" : "80");
        ctx.beginPath();
        ctx.roundRect(barX, y, animatedWidth, barHeight, 3);
        ctx.fill();

        // Glow for active
        if (isActive) {
          ctx.shadowColor = proto.color;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.roundRect(barX, y, animatedWidth, barHeight, 3);
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        // Block time label
        ctx.fillStyle = isActive ? "#fff" : "rgba(255,255,255,0.6)";
        ctx.font = mobile ? "bold 8px monospace" : "bold 10px monospace";
        ctx.textAlign = "left";
        ctx.fillText(`${proto.blockTime}ms`, barX + animatedWidth + 8, y + barHeight / 2 + 4);

        // Innovation tag for active
        if (isActive && !mobile) {
          ctx.fillStyle = "rgba(255,255,255,0.4)";
          ctx.font = "6px system-ui";
          ctx.textAlign = "right";
          ctx.fillText(proto.innovation, width - padding, y + barHeight / 2 + 2);
        }
      });

      // === COMPETITOR COMPARISON ===
      const compY = sectionY + (APTOS_PROTOCOLS.length + 1) * (barHeight + barGap) + (mobile ? 15 : 25);
      const compMaxBlockTime = 450; // Scale for competitors
      const compBarMaxWidth = width - padding * 2 - (mobile ? 70 : 100);

      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = mobile ? "bold 7px system-ui" : "bold 9px system-ui";
      ctx.textAlign = "left";
      ctx.fillText("COMPETITORS", padding, compY);

      // Add Archon to competitor view for comparison
      const comparisonProtocols = [
        APTOS_PROTOCOLS[3], // Archon
        ...COMPETITOR_PROTOCOLS,
      ];

      comparisonProtocols.forEach((proto, i) => {
        const y = compY + 10 + i * (barHeight + barGap);
        const barWidth = Math.min((proto.blockTime / compMaxBlockTime) * compBarMaxWidth, compBarMaxWidth);
        const isArchon = proto.name === "Archon";

        // Label
        ctx.fillStyle = proto.color;
        ctx.font = mobile ? "6px system-ui" : "8px system-ui";
        ctx.textAlign = "left";
        ctx.fillText(proto.name, padding, y + barHeight / 2 + 3);

        // Bar background
        const barX = padding + (mobile ? 55 : 75);
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.beginPath();
        ctx.roundRect(barX, y, compBarMaxWidth, barHeight, 3);
        ctx.fill();

        // Bar fill
        ctx.fillStyle = proto.color + (isArchon ? "" : "80");
        ctx.beginPath();
        ctx.roundRect(barX, y, barWidth, barHeight, 3);
        ctx.fill();

        // Block time label
        ctx.fillStyle = isArchon ? "#fff" : "rgba(255,255,255,0.6)";
        ctx.font = mobile ? "bold 8px monospace" : "bold 10px monospace";
        ctx.textAlign = "left";

        const timeLabel = proto.blockTime >= 1000
          ? `${(proto.blockTime / 1000).toFixed(1)}s`
          : `${proto.blockTime}ms`;
        ctx.fillText(timeLabel, barX + barWidth + 8, y + barHeight / 2 + 4);

        // Chain logo/indicator
        if (proto.chain === "solana") {
          ctx.fillStyle = proto.color + "40";
          ctx.font = mobile ? "5px system-ui" : "6px system-ui";
          ctx.textAlign = "right";
          ctx.fillText("SOL", width - padding, y + barHeight / 2 + 2);
        } else if (proto.chain === "sui") {
          ctx.fillStyle = proto.color + "40";
          ctx.font = mobile ? "5px system-ui" : "6px system-ui";
          ctx.textAlign = "right";
          ctx.fillText("SUI", width - padding, y + barHeight / 2 + 2);
        }
      });

      // Speedup callout at bottom
      const calloutY = height - (mobile ? 18 : 25);
      const speedupVsVelo = Math.round(60 / 10);
      const speedupVsSolana = Math.round(400 / 10);

      ctx.fillStyle = "#00D9A5";
      ctx.font = mobile ? "bold 8px system-ui" : "bold 10px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(
        mobile
          ? `Archon: ${speedupVsVelo}× faster than Velociraptr`
          : `Archon: ${speedupVsVelo}× faster than Velociraptr, ${speedupVsSolana}× faster than Solana`,
        width / 2,
        calloutY
      );

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationRef.current);
  }, [activeProtocol, isVisible]);

  return (
    <div ref={containerRef} className="chrome-card p-2 sm:p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="min-w-0">
          <h3 className="text-xs sm:text-sm font-bold" style={{ color: "var(--chrome-200)" }}>
            Block Time Comparison
          </h3>
          <p className="text-[9px] sm:text-xs" style={{ color: "var(--chrome-600)" }}>
            {isMobile ? "Aptos evolution vs competitors" : "Aptos consensus evolution vs Solana & Sui"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {APTOS_PROTOCOLS.map((proto, i) => (
            <div
              key={proto.name}
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: proto.color,
                opacity: i === activeProtocol ? 1 : 0.3,
              }}
            />
          ))}
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full rounded"
        style={{ height: isMobile ? "260px" : "320px" }}
      />

      {/* Protocol details */}
      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {APTOS_PROTOCOLS.map((proto, i) => (
          <div
            key={proto.name}
            className={`p-1.5 rounded text-center transition-all ${
              i === activeProtocol ? "bg-white/10 border border-white/20" : "bg-white/5"
            }`}
          >
            <div
              className="text-[10px] sm:text-xs font-bold"
              style={{ color: proto.color }}
            >
              {proto.name}
            </div>
            <div className="text-sm sm:text-lg font-bold" style={{ color: proto.color }}>
              {proto.blockTime}ms
            </div>
            <div className="text-[7px] sm:text-[9px]" style={{ color: "var(--chrome-600)" }}>
              {proto.year}
            </div>
          </div>
        ))}
      </div>

      {/* Key insight */}
      <div className="mt-2 p-1.5 rounded bg-white/5">
        <p className="text-[8px] sm:text-xs" style={{ color: "var(--chrome-500)" }}>
          <span className="font-bold" style={{ color: "#00D9A5" }}>Evolution:</span>
          {isMobile
            ? " AptosBFT→Velociraptr: 40% faster. Velociraptr→Archon: 6× faster. Total: 10× improvement."
            : " AptosBFT to Velociraptr achieved 40% speedup via pipelining. Archon achieves 6× more via co-located consensus cluster. Solana's 400ms slots make Archon 40× faster."
          }
        </p>
      </div>
    </div>
  );
});
