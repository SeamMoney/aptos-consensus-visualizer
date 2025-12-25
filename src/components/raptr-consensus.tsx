"use client";

import { useRef, useEffect, useState, memo } from "react";
import { ConsensusStats } from "@/hooks/useAptosStream";
import { useVisibility } from "@/hooks/useVisibility";
import { Tooltip, LearnMoreLink } from "@/components/ui/tooltip";
import { glossary } from "@/data/glossary";

interface RaptrConsensusProps {
  consensus: ConsensusStats | null;
  avgBlockTime: number;
}

interface Packet {
  id: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  progress: number;
  stage: number; // 0=propose, 1=qc-vote, 2=qc-cert, 3=cc-vote
  color: string;
  label: string; // Data being transmitted
}

// Raptr 4-hop BFT consensus stages with technical details
const STAGES = [
  {
    name: "PROPOSE",
    color: "#3B82F6",
    dataLabel: "Block + Sig",
    description: "Leader broadcasts block proposal with signature to all validators",
    technical: "Leader multicasts ⟨PROPOSE, B, σ_L⟩ containing block B and leader signature. O(n) messages sent."
  },
  {
    name: "QC-VOTE",
    color: "#10B981",
    dataLabel: "Vote + ∂σ",
    description: "Validators verify and send partial signatures back to leader",
    technical: "Each validator sends ⟨VOTE, H(B), σ_i⟩ partial signature. Leader aggregates 2f+1 votes into QC."
  },
  {
    name: "QC-CERT",
    color: "#F59E0B",
    dataLabel: "QC(2f+1)",
    description: "Leader broadcasts Quorum Certificate proving 2f+1 validators saw proposal",
    technical: "Leader multicasts ⟨CERT, QC⟩ where QC = ⟨H(B), σ_agg⟩ is the aggregated threshold signature."
  },
  {
    name: "CC-VOTE",
    color: "#EF4444",
    dataLabel: "Commit",
    description: "Validators send commit votes, block is finalized after 2f+1 commits",
    technical: "Validators send ⟨COMMIT, QC, σ_i⟩. After 2f+1, CC formed and block is finalized. Total: 4 hops, O(n) complexity."
  },
];

const SPEED_OPTIONS = [
  { label: "0.25×", value: 0.25 },
  { label: "0.5×", value: 0.5 },
  { label: "1×", value: 1 },
  { label: "2×", value: 2 },
];

export const RaptrConsensus = memo(function RaptrConsensus({ consensus, avgBlockTime }: RaptrConsensusProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const packetsRef = useRef<Packet[]>([]);
  const stageRef = useRef<number>(0);
  const lastStageTimeRef = useRef<number>(0);
  const packetIdRef = useRef<number>(0);
  const speedRef = useRef<number>(1);

  const [currentStage, setCurrentStage] = useState(0);
  const [speed, setSpeed] = useState(1);
  const currentRound = consensus?.round || 0;
  const isVisible = useVisibility(containerRef);

  // Update speed ref when state changes
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const NUM_VALIDATORS = 12;
    let lastTime = 0;
    const targetFPS = 30;
    const frameInterval = 1000 / targetFPS;

    // Base stage timing (~100ms per stage for 4 stages = ~400ms total round)
    const baseStageIntervalMs = 800; // Slow enough to observe at 1x speed

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

      const centerX = width / 2;
      const centerY = height / 2 + 10;
      const ringRadius = Math.min(width, height) / 2 - 50;

      // Advance stage based on time (adjusted by speed)
      const now = Date.now();
      const adjustedInterval = baseStageIntervalMs / speedRef.current;
      if (now - lastStageTimeRef.current > adjustedInterval) {
        lastStageTimeRef.current = now;
        stageRef.current = (stageRef.current + 1) % 4;
        setCurrentStage(stageRef.current);

        const stage = stageRef.current;
        const stageColor = STAGES[stage].color;
        const dataLabel = STAGES[stage].dataLabel;

        // Spawn packets for this stage
        if (stage === 0 || stage === 2) {
          // Leader sends to all validators (PROPOSE, QC-CERT)
          for (let i = 1; i < NUM_VALIDATORS; i++) {
            const angle = (i / NUM_VALIDATORS) * Math.PI * 2 - Math.PI / 2;
            const toX = centerX + Math.cos(angle) * ringRadius;
            const toY = centerY + Math.sin(angle) * ringRadius;
            packetsRef.current.push({
              id: packetIdRef.current++,
              fromX: centerX,
              fromY: centerY - ringRadius, // Leader at top
              toX,
              toY,
              progress: 0,
              stage,
              color: stageColor,
              label: dataLabel,
            });
          }
        } else {
          // Validators send to leader (QC-VOTE, CC-VOTE)
          for (let i = 1; i < NUM_VALIDATORS; i++) {
            const angle = (i / NUM_VALIDATORS) * Math.PI * 2 - Math.PI / 2;
            const fromX = centerX + Math.cos(angle) * ringRadius;
            const fromY = centerY + Math.sin(angle) * ringRadius;
            packetsRef.current.push({
              id: packetIdRef.current++,
              fromX,
              fromY,
              toX: centerX,
              toY: centerY - ringRadius, // Leader at top
              progress: 0,
              stage,
              color: stageColor,
              label: dataLabel,
            });
          }
        }
      }

      // Draw validator nodes
      for (let i = 0; i < NUM_VALIDATORS; i++) {
        const angle = (i / NUM_VALIDATORS) * Math.PI * 2 - Math.PI / 2;
        const x = centerX + Math.cos(angle) * ringRadius;
        const y = centerY + Math.sin(angle) * ringRadius;

        const isLeader = i === 0;
        const nodeSize = isLeader ? 14 : 10;

        // Glow for leader
        if (isLeader) {
          ctx.beginPath();
          ctx.fillStyle = "rgba(0, 217, 165, 0.2)";
          ctx.arc(x, y, nodeSize + 10, 0, Math.PI * 2);
          ctx.fill();
        }

        // Node
        ctx.beginPath();
        ctx.fillStyle = isLeader ? "#00D9A5" : "rgba(255, 255, 255, 0.6)";
        ctx.arc(x, y, nodeSize, 0, Math.PI * 2);
        ctx.fill();

        // Label
        ctx.fillStyle = isLeader ? "#000" : "rgba(0, 0, 0, 0.8)";
        ctx.font = `bold ${isLeader ? 9 : 7}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(isLeader ? "L" : `V${i}`, x, y);

        // Leader label above
        if (isLeader && width > 300) {
          ctx.fillStyle = "#00D9A5";
          ctx.font = "bold 8px monospace";
          ctx.fillText("LEADER", x, y - nodeSize - 14);
        }
      }

      // Center label showing message flow direction
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.font = "8px system-ui";
      ctx.textAlign = "center";
      const flowLabel = stageRef.current === 0 || stageRef.current === 2 ? "L → V" : "V → L";
      ctx.fillText(flowLabel, centerX, centerY - 5);
      ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
      ctx.font = "7px monospace";
      ctx.fillText(stageRef.current === 0 || stageRef.current === 2 ? "broadcast" : "aggregate", centerX, centerY + 8);

      // Update and draw packets
      for (let i = packetsRef.current.length - 1; i >= 0; i--) {
        const p = packetsRef.current[i];
        p.progress += 0.025 * speedRef.current; // Speed adjusted by multiplier

        if (p.progress >= 1) {
          packetsRef.current.splice(i, 1);
          continue;
        }

        // Interpolate position
        const x = p.fromX + (p.toX - p.fromX) * p.progress;
        const y = p.fromY + (p.toY - p.fromY) * p.progress;

        // Draw connection line (faded)
        ctx.beginPath();
        ctx.strokeStyle = p.color + "20";
        ctx.lineWidth = 1;
        ctx.moveTo(p.fromX, p.fromY);
        ctx.lineTo(p.toX, p.toY);
        ctx.stroke();

        // Draw packet with glow
        ctx.beginPath();
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, 10);
        gradient.addColorStop(0, p.color);
        gradient.addColorStop(0.5, p.color + "80");
        gradient.addColorStop(1, "transparent");
        ctx.fillStyle = gradient;
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.fillStyle = "#fff";
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();

        // Draw data label for a few packets (avoid clutter)
        if (i % 3 === 0 && speedRef.current <= 1) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
          ctx.font = "bold 8px monospace";
          ctx.textAlign = "center";
          ctx.fillText(p.label, x, y - 14);
        }
      }

      // Stage indicator at bottom
      const stageWidth = (width - 40) / 4;
      for (let i = 0; i < 4; i++) {
        const sx = 20 + i * stageWidth;
        const sy = height - 40;

        // Background
        ctx.fillStyle = i === stageRef.current ? STAGES[i].color : "rgba(255, 255, 255, 0.08)";
        ctx.beginPath();
        ctx.roundRect(sx, sy, stageWidth - 6, 32, 4);
        ctx.fill();

        // Stage name
        ctx.fillStyle = i === stageRef.current ? "#fff" : "rgba(255, 255, 255, 0.4)";
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(STAGES[i].name, sx + (stageWidth - 6) / 2, sy + 10);

        // Data label
        ctx.fillStyle = i === stageRef.current ? "rgba(255,255,255,0.8)" : "rgba(255, 255, 255, 0.25)";
        ctx.font = "8px monospace";
        ctx.fillText(STAGES[i].dataLabel, sx + (stageWidth - 6) / 2, sy + 23);

        // Arrow between stages
        if (i < 3) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
          ctx.beginPath();
          ctx.moveTo(sx + stageWidth - 8, sy + 16);
          ctx.lineTo(sx + stageWidth - 2, sy + 16);
          ctx.lineTo(sx + stageWidth - 5, sy + 12);
          ctx.moveTo(sx + stageWidth - 2, sy + 16);
          ctx.lineTo(sx + stageWidth - 5, sy + 20);
          ctx.stroke();
        }
      }

      // Title and hop count
      ctx.fillStyle = "#00D9A5";
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("Raptr 4-Hop BFT Consensus", 20, 20);

      // Latency info
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.font = "10px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`~${Math.round(avgBlockTime * 4)}ms round time`, width - 20, 20);

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);

    return () => cancelAnimationFrame(animationRef.current);
  }, [avgBlockTime, isVisible]);

  return (
    <div ref={containerRef} className="chrome-card p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-3">
        <div>
          <h3 className="section-title">
            <Tooltip eli5={glossary.raptr.eli5} technical={glossary.raptr.technical} link={glossary.raptr.link}>Raptr</Tooltip> Consensus
            <LearnMoreLink href={glossary.raptr.link} label="Docs" />
          </h3>
          <p className="text-xs" style={{ color: "var(--chrome-600)" }}>
            4-hop <Tooltip eli5={glossary.bft.eli5} technical={glossary.bft.technical} link={glossary.bft.link}>BFT</Tooltip>: Propose → Vote → Certify → Commit (~{Math.round(avgBlockTime * 4)}ms)
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Speed Controls */}
          <div className="flex items-center gap-1 bg-white/5 rounded px-2 py-1">
            {SPEED_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSpeed(opt.value)}
                className={`px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-mono rounded transition-colors ${
                  speed === opt.value
                    ? "bg-[#00D9A5] text-black"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {/* Round info */}
          <span className="text-[10px] sm:text-xs font-mono" style={{ color: "var(--chrome-500)" }}>
            Round: <span style={{ color: "#00D9A5" }}>{currentRound.toLocaleString()}</span>
          </span>
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full rounded"
        style={{ height: "280px" }}
      />

      {/* Technical Info Panel */}
      <div className="mt-3 p-3 rounded bg-white/5">
        <div className="flex items-start gap-3">
          <div
            className="w-3 h-3 rounded-full mt-0.5 flex-shrink-0"
            style={{ backgroundColor: STAGES[currentStage].color }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-sm font-bold font-mono"
                style={{ color: STAGES[currentStage].color }}
              >
                {STAGES[currentStage].name}
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 font-mono" style={{ color: "var(--chrome-400)" }}>
                Hop {currentStage + 1}/4
              </span>
            </div>
            <p className="text-xs mb-1.5" style={{ color: "var(--chrome-400)" }}>
              {STAGES[currentStage].description}
            </p>
            <p className="text-xs font-mono" style={{ color: "var(--chrome-600)" }}>
              {STAGES[currentStage].technical}
            </p>
          </div>
        </div>
      </div>

      {/* Protocol Summary */}
      <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-0 text-xs" style={{ color: "var(--chrome-600)" }}>
        <span>
          Based on HotStuff-2 with optimistic linear communication
        </span>
        <span className="font-mono text-[10px] sm:text-xs">
          O(n) message complexity · <Tooltip eli5={glossary["quorum-certificate"].eli5} technical={glossary["quorum-certificate"].technical} link={glossary["quorum-certificate"].link}>2f+1 quorum</Tooltip>
        </span>
      </div>
    </div>
  );
});
