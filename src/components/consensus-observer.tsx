"use client";

import { useRef, useEffect, useState, memo } from "react";
import { useVisibility } from "@/hooks/useVisibility";
import { Tooltip, LearnMoreLink } from "@/components/ui/tooltip";
import { glossary } from "@/data/glossary";

/**
 * Consensus Observer (AIP-93)
 *
 * Shows how fullnodes sync blocks in parallel with validators:
 * - Validators participate in consensus
 * - Fullnodes receive ordered blocks directly
 * - Process blocks in parallel, not waiting for finality
 * - 30-50% latency reduction for fullnodes
 */

interface Block {
  id: number;
  x: number;
  y: number;
  state: "consensus" | "broadcasting" | "received" | "processing" | "done";
  validatorProgress: number;
  fullnodeProgress: number;
}

interface Node {
  id: number;
  x: number;
  y: number;
  type: "validator" | "fullnode";
  label: string;
}

const STEPS = [
  {
    title: "Block Proposed",
    desc: "Leader proposes block to validator set and simultaneously forwards to observer network",
    technical: "⟨PROPOSE, B_n, σ_L⟩ broadcast to all validators. Observers receive via P2P gossip layer with block hash + parent linkage for ordering verification.",
    mechanic: "Leader sends: (1) Block data + transactions, (2) Leader signature σ_L, (3) Parent block reference. Observers validate block hash chain before processing.",
  },
  {
    title: "Consensus + Observer",
    desc: "Validators vote on block while fullnodes begin processing in parallel—no waiting for consensus finality",
    technical: "Validators: ⟨VOTE, H(B_n), σ_i⟩ → Leader aggregates 2f+1. Observers: Start Block-STM execution immediately with speculative state.",
    mechanic: "Observer nodes skip the 4-hop Raptr voting rounds. They trust ordered delivery and begin execution as soon as block is received. Rollback if block fails finalization (rare).",
  },
  {
    title: "Parallel Execution",
    desc: "Both validators and fullnodes run Block-STM speculatively—observers are ~2-3 rounds ahead in execution",
    technical: "Block-STM: Optimistic parallel execution with MVCC. Validators execute during voting. Observers execute during QC/CC formation—gaining 30-50% latency reduction.",
    mechanic: "Each execution slot runs: (1) Transaction scheduling, (2) Parallel execution with conflict detection, (3) State delta computation. Observers complete this while validators are still voting.",
  },
  {
    title: "Commit",
    desc: "Block finalized with Commit Certificate—fullnodes already have executed state, just need to mark as committed",
    technical: "CC = aggregate(2f+1 commit votes). Validators + Observers both commit. Observer latency = Execution time only. Validator latency = Consensus + Execution.",
    mechanic: "Final state transition: (1) Apply state deltas atomically, (2) Update Jellyfish Merkle Tree root, (3) Persist to storage. Observers do this 30-50% faster by skipping consensus wait.",
  },
];

export const ConsensusObserver = memo(function ConsensusObserver() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const [currentStep, setCurrentStep] = useState(0);
  const stepTimerRef = useRef(0);
  const blockIdRef = useRef(0);
  const blocksRef = useRef<Block[]>([]);
  const isVisible = useVisibility(containerRef);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastTime = 0;
    const targetFPS = 30;
    const frameInterval = 1000 / targetFPS;

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

      // Step timer
      stepTimerRef.current++;
      const stepDuration = 80;

      if (stepTimerRef.current > stepDuration) {
        stepTimerRef.current = 0;
        const nextStep = (currentStep + 1) % 4;
        setCurrentStep(nextStep);

        // Spawn new block at step 0
        if (nextStep === 0) {
          blocksRef.current = [{
            id: blockIdRef.current++,
            x: width * 0.15,
            y: height * 0.3,
            state: "consensus",
            validatorProgress: 0,
            fullnodeProgress: 0,
          }];
        }
      }

      // Layout
      const leaderX = width * 0.15;
      const leaderY = height * 0.3;
      const validatorCenterX = width * 0.5;
      const validatorY = height * 0.3;
      const fullnodeY = height * 0.7;

      // Draw network separation line
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(0, height * 0.5);
      ctx.lineTo(width, height * 0.5);
      ctx.stroke();
      ctx.setLineDash([]);

      // Labels for network sections
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "9px monospace";
      ctx.textAlign = "left";
      ctx.fillText("CONSENSUS LAYER", 15, height * 0.5 - 8);
      ctx.fillText("OBSERVER LAYER", 15, height * 0.5 + 16);

      // Draw leader node
      ctx.beginPath();
      ctx.fillStyle = "rgba(0, 217, 165, 0.2)";
      ctx.arc(leaderX, leaderY, 28, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = "#00D9A5";
      ctx.arc(leaderX, leaderY, 18, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#000";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("L", leaderX, leaderY);

      ctx.fillStyle = "#00D9A5";
      ctx.font = "bold 8px monospace";
      ctx.fillText("LEADER", leaderX, leaderY - 30);

      // Draw validators
      const numValidators = 4;
      const validatorSpacing = 45;
      for (let i = 0; i < numValidators; i++) {
        const vx = validatorCenterX + (i - (numValidators - 1) / 2) * validatorSpacing;
        const vy = validatorY;

        // Node
        ctx.beginPath();
        const isActive = currentStep >= 1;
        ctx.fillStyle = isActive ? "#3B82F6" : "rgba(59, 130, 246, 0.4)";
        ctx.arc(vx, vy, 12, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = isActive ? "#fff" : "rgba(255,255,255,0.5)";
        ctx.font = "bold 8px monospace";
        ctx.fillText(`V${i + 1}`, vx, vy);

        // Voting indicator
        if (currentStep === 1) {
          ctx.beginPath();
          ctx.fillStyle = "#F59E0B";
          ctx.arc(vx + 10, vy - 10, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        if (currentStep >= 2) {
          ctx.fillStyle = "#10B981";
          ctx.font = "8px monospace";
          ctx.fillText("✓", vx + 14, vy - 8);
        }
      }

      // Validator label
      ctx.fillStyle = "#3B82F6";
      ctx.font = "bold 8px monospace";
      ctx.fillText("VALIDATORS", validatorCenterX, validatorY - 28);

      // Draw fullnodes
      const numFullnodes = 3;
      const fullnodeSpacing = 60;
      for (let i = 0; i < numFullnodes; i++) {
        const fx = validatorCenterX + (i - (numFullnodes - 1) / 2) * fullnodeSpacing;
        const fy = fullnodeY;

        // Node with different shape (square-ish)
        ctx.beginPath();
        const isActive = currentStep >= 1;
        ctx.fillStyle = isActive ? "#A855F7" : "rgba(168, 85, 247, 0.4)";
        ctx.roundRect(fx - 12, fy - 12, 24, 24, 4);
        ctx.fill();

        ctx.fillStyle = isActive ? "#fff" : "rgba(255,255,255,0.5)";
        ctx.font = "bold 8px monospace";
        ctx.fillText(`FN${i + 1}`, fx, fy);

        // Processing indicator
        if (currentStep >= 2) {
          const progress = Math.min(1, (stepTimerRef.current / stepDuration) + (currentStep - 2));
          ctx.strokeStyle = "#00D9A5";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(fx, fy, 16, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
          ctx.stroke();
        }
      }

      // Fullnode label
      ctx.fillStyle = "#A855F7";
      ctx.font = "bold 8px monospace";
      ctx.textAlign = "center";
      ctx.fillText("FULLNODES (OBSERVERS)", validatorCenterX, fullnodeY - 28);

      // Draw message flows based on step
      if (currentStep >= 0) {
        // Leader to validators
        ctx.strokeStyle = currentStep === 0 ? "#00D9A5" : "rgba(0, 217, 165, 0.3)";
        ctx.lineWidth = currentStep === 0 ? 2 : 1;
        for (let i = 0; i < numValidators; i++) {
          const vx = validatorCenterX + (i - (numValidators - 1) / 2) * validatorSpacing;
          ctx.beginPath();
          ctx.moveTo(leaderX + 20, leaderY);
          ctx.lineTo(vx - 14, validatorY);
          ctx.stroke();
        }
      }

      if (currentStep >= 1) {
        // Leader/validators to fullnodes (parallel path)
        ctx.strokeStyle = currentStep === 1 ? "#A855F7" : "rgba(168, 85, 247, 0.3)";
        ctx.lineWidth = currentStep === 1 ? 2 : 1;
        for (let i = 0; i < numFullnodes; i++) {
          const fx = validatorCenterX + (i - (numFullnodes - 1) / 2) * fullnodeSpacing;
          ctx.beginPath();
          ctx.moveTo(leaderX, leaderY + 20);
          ctx.quadraticCurveTo(leaderX, height * 0.5, fx, fullnodeY - 14);
          ctx.stroke();
        }
      }

      // Draw animated block packets
      blocksRef.current.forEach((block) => {
        const phase = currentStep;

        if (phase === 0) {
          // Block moving from leader to validators
          const progress = stepTimerRef.current / stepDuration;
          for (let i = 0; i < numValidators; i++) {
            const vx = validatorCenterX + (i - (numValidators - 1) / 2) * validatorSpacing;
            const bx = leaderX + (vx - leaderX) * progress;
            const by = leaderY + (validatorY - leaderY) * progress;

            ctx.beginPath();
            ctx.fillStyle = "#00D9A5";
            ctx.arc(bx, by, 5, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (phase === 1) {
          // Block going to fullnodes in parallel
          const progress = stepTimerRef.current / stepDuration;
          for (let i = 0; i < numFullnodes; i++) {
            const fx = validatorCenterX + (i - (numFullnodes - 1) / 2) * fullnodeSpacing;
            // Curved path
            const t = progress;
            const bx = leaderX + (fx - leaderX) * t;
            const by = leaderY + (height * 0.5 - leaderY) * t * 0.5 + (fullnodeY - height * 0.5) * Math.max(0, t - 0.5) * 2;

            ctx.beginPath();
            ctx.fillStyle = "#A855F7";
            ctx.arc(bx, Math.min(by, fullnodeY), 5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });

      // Timing comparison
      const comparisonX = width - 100;
      const comparisonY = height * 0.3;

      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.beginPath();
      ctx.roundRect(comparisonX - 35, comparisonY - 30, 90, 80, 6);
      ctx.fill();

      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "bold 8px monospace";
      ctx.textAlign = "center";
      ctx.fillText("LATENCY", comparisonX + 10, comparisonY - 15);

      // Traditional bar
      ctx.fillStyle = "#EF4444";
      ctx.fillRect(comparisonX - 25, comparisonY, 60, 10);
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "7px monospace";
      ctx.textAlign = "left";
      ctx.fillText("Traditional", comparisonX - 25, comparisonY + 22);

      // Observer bar (shorter)
      const observerWidth = currentStep >= 2 ? 35 : 60 * (stepTimerRef.current / stepDuration);
      ctx.fillStyle = "#00D9A5";
      ctx.fillRect(comparisonX - 25, comparisonY + 30, observerWidth, 10);
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillText("Observer", comparisonX - 25, comparisonY + 52);

      // Title
      ctx.fillStyle = "#A855F7";
      ctx.font = "bold 11px system-ui";
      ctx.textAlign = "left";
      ctx.fillText("CONSENSUS OBSERVER (AIP-93)", 15, 20);

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationRef.current);
  }, [currentStep, isVisible]);

  return (
    <div ref={containerRef} className="chrome-card p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="section-title">
            <Tooltip eli5={glossary["consensus-observer"].eli5} technical={glossary["consensus-observer"].technical} link={glossary["consensus-observer"].link}>Consensus Observer</Tooltip>
            <LearnMoreLink href={glossary["consensus-observer"].link} label="Docs" />
          </h3>
          <p className="text-xs" style={{ color: "var(--chrome-600)" }}>
            Parallel fullnode sync for 30-50% lower latency
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-2 py-1 rounded bg-white/10" style={{ color: "#A855F7" }}>
            AIP-93
          </span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full rounded"
        style={{ height: "300px" }}
      />

      {/* Step explanation */}
      <div className="mt-4 p-3 rounded-lg bg-white/5 border border-white/10">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="px-2 py-0.5 rounded text-xs font-bold"
            style={{ backgroundColor: "#A855F7", color: "#fff" }}
          >
            Step {currentStep + 1}/4
          </span>
          <span className="text-sm font-bold" style={{ color: "#A855F7" }}>
            {STEPS[currentStep].title}
          </span>
        </div>

        <p className="text-xs mb-2" style={{ color: "var(--chrome-400)" }}>
          {STEPS[currentStep].desc}
        </p>

        <div className="space-y-2 mt-3">
          <div className="p-2 rounded bg-white/5">
            <div className="text-[10px] font-bold mb-1" style={{ color: "#A855F7" }}>Protocol Messages:</div>
            <p className="text-xs font-mono" style={{ color: "var(--chrome-500)" }}>
              {STEPS[currentStep].technical}
            </p>
          </div>

          <div className="p-2 rounded bg-white/5">
            <div className="text-[10px] font-bold mb-1" style={{ color: "#00D9A5" }}>How It Works:</div>
            <p className="text-xs" style={{ color: "var(--chrome-500)" }}>
              {STEPS[currentStep].mechanic}
            </p>
          </div>
        </div>

        {/* Timeline */}
        <div className="flex items-center gap-1 mt-3">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="flex-1 h-1.5 rounded-full transition-all"
              style={{
                backgroundColor: i <= currentStep ? "#A855F7" : "rgba(255,255,255,0.1)",
              }}
            />
          ))}
        </div>
      </div>

      {/* Key insight */}
      <div className="mt-2 p-2 rounded bg-white/5">
        <p className="text-xs" style={{ color: "var(--chrome-500)" }}>
          <span className="font-bold" style={{ color: "#A855F7" }}>Key Innovation:</span>
          {" "}Observers receive ordered blocks directly from validators via P2P gossip and execute speculatively. Since block ordering is guaranteed by the consensus layer, observers can safely process blocks before finalization—rolling back only in rare fork cases (&lt;0.01%).
        </p>
      </div>
    </div>
  );
});
