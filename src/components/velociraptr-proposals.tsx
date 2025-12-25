"use client";

import { useRef, useEffect, useState, memo } from "react";
import { useVisibility } from "@/hooks/useVisibility";
import { Tooltip, LearnMoreLink } from "@/components/ui/tooltip";
import { glossary } from "@/data/glossary";

/**
 * Velociraptr Optimistic Proposals Visualization
 *
 * Shows the key innovation: Leaders can propose new blocks without waiting
 * for the parent block's Quorum Certificate (QC).
 *
 * Regular Raptr: Block time = T1 + T2 (propose + vote aggregation)
 * Velociraptr: Block time = T2 (propose and vote aggregation pipelined)
 *
 * This results in ~40% faster block times.
 */

interface MessagePacket {
  id: number;
  type: "proposal" | "vote" | "qc";
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  progress: number;
  color: string;
  label: string;
  round: number;
}

const STAGES = [
  { name: "PROPOSE", color: "#3B82F6", desc: "Leader broadcasts block" },
  { name: "VOTE", color: "#F59E0B", desc: "Validators send votes" },
  { name: "QC", color: "#10B981", desc: "Quorum Certificate formed" },
  { name: "NEXT", color: "#A855F7", desc: "Next block proposed" },
];

export const VelociraptorProposals = memo(function VelociraptorProposals() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const packetsRef = useRef<MessagePacket[]>([]);
  const [mode, setMode] = useState<"regular" | "optimistic">("optimistic");
  const [currentStep, setCurrentStep] = useState(0);
  const [currentRound, setCurrentRound] = useState(1);
  const stepTimerRef = useRef(0);
  const packetIdRef = useRef(0);
  const isVisible = useVisibility(containerRef);

  // Step descriptions for educational display
  const regularSteps = [
    { step: 1, title: "Round N: Leader Proposes Block", desc: "Leader broadcasts ⟨PROPOSE, B_n⟩ to all validators", time: "T1" },
    { step: 2, title: "Round N: Validators Vote", desc: "Validators verify and send ⟨VOTE, H(B_n), σ_i⟩ back", time: "T2" },
    { step: 3, title: "Round N: QC Formed", desc: "Leader aggregates 2f+1 votes into QC_n", time: "—" },
    { step: 4, title: "Round N+1: Wait Complete", desc: "NOW leader can propose next block with QC_n", time: "T1" },
  ];

  const optimisticSteps = [
    { step: 1, title: "Round N: Leader Proposes", desc: "Leader broadcasts ⟨PROPOSE, B_n⟩ immediately", time: "—" },
    { step: 2, title: "Pipelined: Vote + Propose", desc: "Vote aggregation AND next proposal happen in parallel!", time: "T2" },
    { step: 3, title: "Round N+1: Already Proposed", desc: "Next block proposed without waiting for QC_n", time: "—" },
    { step: 4, title: "Continuous Pipeline", desc: "Blocks stream every network hop, not every two", time: "T2" },
  ];

  const steps = mode === "regular" ? regularSteps : optimisticSteps;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const NUM_VALIDATORS = 8;

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

      // Layout
      const centerX = width / 2;
      const centerY = height / 2;
      const ringRadius = Math.min(width, height) * 0.38;

      // Step timer
      stepTimerRef.current++;
      const stepDuration = mode === "regular" ? 90 : 70; // Optimistic is faster

      if (stepTimerRef.current > stepDuration) {
        stepTimerRef.current = 0;
        const nextStep = (currentStep + 1) % 4;
        setCurrentStep(nextStep);

        if (nextStep === 0) {
          setCurrentRound(r => r + 1);
          packetsRef.current = [];
        }

        // Spawn packets based on step
        if (mode === "regular") {
          if (nextStep === 0) {
            // Step 1: Leader proposes to all
            for (let i = 1; i < NUM_VALIDATORS; i++) {
              const angle = (i / NUM_VALIDATORS) * Math.PI * 2 - Math.PI / 2;
              packetsRef.current.push({
                id: packetIdRef.current++,
                type: "proposal",
                fromX: centerX,
                fromY: centerY - ringRadius,
                toX: centerX + Math.cos(angle) * ringRadius,
                toY: centerY + Math.sin(angle) * ringRadius,
                progress: 0,
                color: "#3B82F6",
                label: "B_n",
                round: currentRound,
              });
            }
          } else if (nextStep === 1) {
            // Step 2: Validators vote back
            for (let i = 1; i < NUM_VALIDATORS; i++) {
              const angle = (i / NUM_VALIDATORS) * Math.PI * 2 - Math.PI / 2;
              packetsRef.current.push({
                id: packetIdRef.current++,
                type: "vote",
                fromX: centerX + Math.cos(angle) * ringRadius,
                fromY: centerY + Math.sin(angle) * ringRadius,
                toX: centerX,
                toY: centerY - ringRadius,
                progress: 0,
                color: "#F59E0B",
                label: "σ_i",
                round: currentRound,
              });
            }
          }
        } else {
          // Optimistic mode - pipelined
          if (nextStep === 0) {
            // Propose current round
            for (let i = 1; i < NUM_VALIDATORS; i++) {
              const angle = (i / NUM_VALIDATORS) * Math.PI * 2 - Math.PI / 2;
              packetsRef.current.push({
                id: packetIdRef.current++,
                type: "proposal",
                fromX: centerX,
                fromY: centerY - ringRadius,
                toX: centerX + Math.cos(angle) * ringRadius,
                toY: centerY + Math.sin(angle) * ringRadius,
                progress: 0,
                color: "#3B82F6",
                label: `B_${currentRound}`,
                round: currentRound,
              });
            }
          } else if (nextStep === 1) {
            // Pipelined: votes AND next proposal simultaneously
            for (let i = 1; i < NUM_VALIDATORS; i++) {
              const angle = (i / NUM_VALIDATORS) * Math.PI * 2 - Math.PI / 2;
              // Votes going back
              packetsRef.current.push({
                id: packetIdRef.current++,
                type: "vote",
                fromX: centerX + Math.cos(angle) * ringRadius,
                fromY: centerY + Math.sin(angle) * ringRadius,
                toX: centerX,
                toY: centerY - ringRadius,
                progress: 0,
                color: "#F59E0B",
                label: "σ",
                round: currentRound,
              });
              // Next proposal going out (purple for distinction)
              packetsRef.current.push({
                id: packetIdRef.current++,
                type: "proposal",
                fromX: centerX,
                fromY: centerY - ringRadius,
                toX: centerX + Math.cos(angle) * ringRadius,
                toY: centerY + Math.sin(angle) * ringRadius,
                progress: 0.1 + Math.random() * 0.1, // Slightly delayed
                color: "#A855F7",
                label: `B_${currentRound + 1}`,
                round: currentRound + 1,
              });
            }
          }
        }
      }

      // Draw validator ring
      for (let i = 0; i < NUM_VALIDATORS; i++) {
        const angle = (i / NUM_VALIDATORS) * Math.PI * 2 - Math.PI / 2;
        const x = centerX + Math.cos(angle) * ringRadius;
        const y = centerY + Math.sin(angle) * ringRadius;
        const isLeader = i === 0;
        const nodeSize = isLeader ? 16 : 11;

        // Glow for leader
        if (isLeader) {
          ctx.beginPath();
          ctx.fillStyle = "rgba(0, 217, 165, 0.2)";
          ctx.arc(x, y, nodeSize + 12, 0, Math.PI * 2);
          ctx.fill();
        }

        // Node
        ctx.beginPath();
        ctx.fillStyle = isLeader ? "#00D9A5" : "rgba(255, 255, 255, 0.5)";
        ctx.arc(x, y, nodeSize, 0, Math.PI * 2);
        ctx.fill();

        // Label
        ctx.fillStyle = isLeader ? "#000" : "rgba(0,0,0,0.7)";
        ctx.font = `bold ${isLeader ? 9 : 7}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(isLeader ? "L" : `V${i}`, x, y);

        if (isLeader && width > 350) {
          ctx.fillStyle = "#00D9A5";
          ctx.font = "bold 8px monospace";
          ctx.fillText("LEADER", x, y - nodeSize - 12);
        }
      }

      // Draw and update packets
      packetsRef.current = packetsRef.current.filter(p => {
        p.progress += 0.025;
        if (p.progress >= 1) return false;

        const x = p.fromX + (p.toX - p.fromX) * p.progress;
        const y = p.fromY + (p.toY - p.fromY) * p.progress;

        // Trail
        ctx.strokeStyle = p.color + "40";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.fromX, p.fromY);
        ctx.lineTo(x, y);
        ctx.stroke();

        // Packet glow
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
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();

        // Label (sparse)
        if (p.id % 4 === 0 && width > 300) {
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.font = "bold 7px monospace";
          ctx.textAlign = "center";
          ctx.fillText(p.label, x, y - 12);
        }

        return true;
      });

      // Center info
      ctx.textAlign = "center";
      ctx.fillStyle = mode === "optimistic" ? "#00D9A5" : "#F59E0B";
      ctx.font = "bold 11px system-ui";
      ctx.fillText(mode === "optimistic" ? "OPTIMISTIC" : "REGULAR", centerX, centerY - 10);
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "9px monospace";
      ctx.fillText(`Round ${currentRound}`, centerX, centerY + 6);

      // Title
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.font = "bold 10px system-ui";
      ctx.textAlign = "left";
      ctx.fillText("VELOCIRAPTR PROPOSALS", 15, 18);

      // Block time comparison
      ctx.textAlign = "right";
      ctx.fillStyle = mode === "optimistic" ? "#00D9A5" : "#F59E0B";
      ctx.font = "bold 9px monospace";
      const blockTimeText = mode === "optimistic" ? "Block Time: T₂" : "Block Time: T₁+T₂";
      ctx.fillText(blockTimeText, width - 15, 18);

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationRef.current);
  }, [mode, currentStep, currentRound, isVisible]);

  return (
    <div ref={containerRef} className="chrome-card p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="section-title">
            <Tooltip content={glossary.velociraptr.definition} link={glossary.velociraptr.link}>Velociraptr</Tooltip>: Optimistic Proposals
            <LearnMoreLink href={glossary.velociraptr.link} label="Velociraptr Blog Post" />
          </h3>
          <p className="text-xs" style={{ color: "var(--chrome-600)" }}>
            ~40% faster block times via pipelined proposals (AIP-131)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setMode("regular"); setCurrentStep(0); setCurrentRound(1); packetsRef.current = []; }}
            className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
              mode === "regular" ? "bg-[#F59E0B] text-black" : "bg-white/10 text-white/60"
            }`}
          >
            Regular
          </button>
          <button
            onClick={() => { setMode("optimistic"); setCurrentStep(0); setCurrentRound(1); packetsRef.current = []; }}
            className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
              mode === "optimistic" ? "bg-[#00D9A5] text-black" : "bg-white/10 text-white/60"
            }`}
          >
            Optimistic
          </button>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full rounded"
        style={{ height: "300px" }}
      />

      {/* Step-by-step explanation */}
      <div className="mt-4 p-3 rounded-lg bg-white/5 border border-white/10">
        <div className="flex items-center gap-2 mb-3">
          <span
            className="px-2 py-0.5 rounded text-xs font-bold"
            style={{ backgroundColor: mode === "optimistic" ? "#00D9A5" : "#F59E0B", color: "#000" }}
          >
            Step {currentStep + 1}/4
          </span>
          <span className="text-sm font-bold" style={{ color: mode === "optimistic" ? "#00D9A5" : "#F59E0B" }}>
            {steps[currentStep].title}
          </span>
        </div>

        <p className="text-xs mb-3" style={{ color: "var(--chrome-400)" }}>
          {steps[currentStep].desc}
        </p>

        {/* Timeline visualization */}
        <div className="flex items-center gap-1 mb-3">
          {steps.map((s, i) => (
            <div key={i} className="flex-1">
              <div
                className="h-2 rounded-full transition-all"
                style={{
                  backgroundColor: i <= currentStep
                    ? (mode === "optimistic" ? "#00D9A5" : "#F59E0B")
                    : "rgba(255,255,255,0.1)"
                }}
              />
              <div className="text-[9px] mt-1 text-center" style={{ color: "var(--chrome-600)" }}>
                {s.time}
              </div>
            </div>
          ))}
        </div>

        {/* Key insight */}
        <div className="pt-3 border-t border-white/10">
          <div className="text-xs" style={{ color: "var(--chrome-500)" }}>
            <span className="font-bold" style={{ color: mode === "optimistic" ? "#00D9A5" : "#F59E0B" }}>
              {mode === "optimistic" ? "Key Innovation:" : "Limitation:"}
            </span>
            {mode === "optimistic"
              ? " Vote aggregation for round N happens in parallel with proposal for round N+1. Block time = max(T₁, T₂) ≈ T₂"
              : " Must wait for QC before proposing next block. Block time = T₁ + T₂ (sequential)"}
          </div>
        </div>
      </div>
    </div>
  );
});
