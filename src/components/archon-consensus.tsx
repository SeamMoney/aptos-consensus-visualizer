"use client";

import { useRef, useEffect, useState, memo } from "react";
import { useVisibility } from "@/hooks/useVisibility";
import { Tooltip, LearnMoreLink } from "@/components/ui/tooltip";
import { glossary } from "@/data/glossary";

/**
 * Velociraptr vs Archon Consensus Comparison
 *
 * Velociraptr: Shows pipelined 4-hop consensus with rotating leader
 * Archon: Shows detailed PBFT-like internal consensus flow:
 *   1. PRIMARY proposes to cluster
 *   2. Cluster nodes send PREPARE votes
 *   3. Threshold reached → COMMIT
 *   4. Broadcast to external validators
 *   5. External ACKs
 */

const VALIDATORS = [
  { name: "NYC", color: "#3B82F6", angle: -Math.PI / 2 },
  { name: "TKY", color: "#F59E0B", angle: 0 },
  { name: "LON", color: "#10B981", angle: Math.PI / 2 },
  { name: "SYD", color: "#EF4444", angle: Math.PI },
];

// Archon internal PBFT phases
type ArchonPhase = "propose" | "prepare" | "commit" | "broadcast" | "ack" | "done";

export const ArchonConsensus = memo(function ArchonConsensus() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const [isMobile, setIsMobile] = useState(false);
  const isVisible = useVisibility(containerRef);

  // Animation state
  const frameRef = useRef(0);
  const archonPhaseRef = useRef<ArchonPhase>("propose");
  const phaseProgressRef = useRef(0);

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

      frameRef.current++;
      const frame = frameRef.current;

      // Clear
      ctx.fillStyle = "#0a0a0b";
      ctx.fillRect(0, 0, width, height);

      // Animation cycle (300 frames = 10 seconds at 30fps)
      const cycleFrame = frame % 300;

      // Archon phases with timing (total ~300 frames)
      // Phase durations simulate the relative time:
      // Internal (propose+prepare+commit) = ~60 frames (fast)
      // External (broadcast+ack) = ~60 frames
      // Done = ~180 frames (pause to show result)
      let phase: ArchonPhase;
      let progress: number;
      let latency: number;

      if (cycleFrame < 20) {
        phase = "propose";
        progress = cycleFrame / 20;
        latency = progress * 1.5;
      } else if (cycleFrame < 40) {
        phase = "prepare";
        progress = (cycleFrame - 20) / 20;
        latency = 1.5 + progress * 2;
      } else if (cycleFrame < 60) {
        phase = "commit";
        progress = (cycleFrame - 40) / 20;
        latency = 3.5 + progress * 1.5;
      } else if (cycleFrame < 90) {
        phase = "broadcast";
        progress = (cycleFrame - 60) / 30;
        latency = 5 + progress * 3;
      } else if (cycleFrame < 120) {
        phase = "ack";
        progress = (cycleFrame - 90) / 30;
        latency = 8 + progress * 2;
      } else {
        phase = "done";
        progress = 1;
        latency = 10;
      }

      archonPhaseRef.current = phase;
      phaseProgressRef.current = progress;

      // Velociraptr latency (60ms over first half of cycle)
      const veloLatency = Math.min(cycleFrame / 3, 60);

      const padding = mobile ? 10 : 20;

      if (mobile) {
        // === MOBILE: STACKED LAYOUT ===
        const dividerY = height * 0.48;

        // Draw Velociraptr section (top)
        drawVelociraptorSection(ctx, 0, 0, width, dividerY, padding, frame, mobile);

        // Divider
        ctx.strokeStyle = "rgba(255,255,255,0.15)";
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(padding, dividerY);
        ctx.lineTo(width - padding, dividerY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = "bold 8px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("vs", width / 2, dividerY + 4);

        // Draw Archon section (bottom)
        drawArchonPBFTSection(ctx, 0, dividerY, width, height - dividerY - 35, padding, frame, mobile, phase, progress);

        // Latency comparison at bottom
        const barY = height - 30;
        drawLatencyBars(ctx, width, barY, veloLatency, latency, mobile);

      } else {
        // === DESKTOP: SIDE BY SIDE ===
        const halfW = width / 2;

        // Draw Velociraptr section (left)
        drawVelociraptorSection(ctx, 0, 0, halfW, height - 60, padding, frame, mobile);

        // Divider
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(halfW, 30);
        ctx.lineTo(halfW, height - 80);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.font = "bold 12px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("vs", halfW, height / 2 - 20);

        // Draw Archon section (right)
        drawArchonPBFTSection(ctx, halfW, 0, halfW, height - 60, padding, frame, mobile, phase, progress);

        // Latency comparison at bottom
        const barY = height - 45;
        drawLatencyBars(ctx, width, barY, veloLatency, latency, mobile);
      }

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationRef.current);
  }, [isVisible]);

  return (
    <div ref={containerRef} className="chrome-card p-2 sm:p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="px-1.5 py-0.5 rounded text-[8px] sm:text-[10px] font-bold"
              style={{ backgroundColor: "#F59E0B", color: "#000" }}
            >
              2026
            </span>
            <h3 className="text-xs sm:text-sm font-bold" style={{ color: "var(--chrome-200)" }}>
              <Tooltip eli5={glossary.archon.eli5} technical={glossary.archon.technical} link={glossary.archon.link}>Archon</Tooltip>: Primary-Proxy Consensus
              <LearnMoreLink href={glossary.archon.link} label="Docs" />
            </h3>
          </div>
          <p className="text-[9px] sm:text-xs" style={{ color: "var(--chrome-600)" }}>
            {isMobile ? "4 WAN hops → 2-phase internal BFT" : "From 4 global WAN hops to fast internal BFT + 1 broadcast"}
          </p>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full rounded"
        style={{ height: isMobile ? "380px" : "320px" }}
      />

      {/* Protocol comparison */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20">
          <div className="text-[10px] sm:text-xs font-bold" style={{ color: "#3B82F6" }}>
            Velociraptr (AIP-131)
          </div>
          <div className="text-[8px] sm:text-[10px] mt-1" style={{ color: "var(--chrome-500)" }}>
            Leader rotates globally. Each hop crosses WAN (~15ms).
          </div>
          <div className="text-xs sm:text-sm font-bold mt-1" style={{ color: "#3B82F6" }}>
            4 hops × ~15ms = ~60ms
          </div>
        </div>
        <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20">
          <div className="text-[10px] sm:text-xs font-bold" style={{ color: "#00D9A5" }}>
            Archon
          </div>
          <div className="text-[8px] sm:text-[10px] mt-1" style={{ color: "var(--chrome-500)" }}>
            Cluster runs internal BFT (&lt;5ms). Then 1 broadcast.
          </div>
          <div className="text-xs sm:text-sm font-bold mt-1" style={{ color: "#00D9A5" }}>
            5ms internal + 5ms broadcast = ~10ms
          </div>
        </div>
      </div>

      {/* Key insight */}
      <div className="mt-2 p-1.5 rounded bg-white/5">
        <p className="text-[8px] sm:text-xs" style={{ color: "var(--chrome-500)" }}>
          <span className="font-bold" style={{ color: "#00D9A5" }}>Key insight:</span>
          {isMobile
            ? " Co-located cluster reaches BFT consensus internally before broadcasting."
            : " The co-located cluster (same datacenter) runs full PBFT-style consensus in microseconds, then broadcasts the certified block once to external validators."
          }
        </p>
      </div>
    </div>
  );
});

// Draw Velociraptr pipeline section - 4 global hops
function drawVelociraptorSection(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  width: number,
  height: number,
  padding: number,
  frame: number,
  mobile: boolean
) {
  const titleY = offsetY + (mobile ? 16 : 25);

  // Title
  ctx.fillStyle = "#3B82F6";
  ctx.font = mobile ? "bold 9px system-ui" : "bold 11px system-ui";
  ctx.textAlign = "left";
  ctx.fillText("VELOCIRAPTR", offsetX + padding, titleY);

  // Subtitle
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = mobile ? "5px system-ui" : "8px system-ui";
  ctx.textAlign = "right";
  ctx.fillText("4 Global WAN Hops", offsetX + width - padding, titleY);

  const centerX = offsetX + width / 2;
  const centerY = offsetY + height / 2 + (mobile ? 5 : 10);
  const validatorRadius = mobile ? 55 : 75;
  const validatorSize = mobile ? 7 : 9;

  // Current hop in animation
  const hopCycle = (frame % 120);
  const currentHop = Math.floor(hopCycle / 30);
  const hopProgress = (hopCycle % 30) / 30;

  // Draw globe/network lines
  ctx.strokeStyle = "rgba(59, 130, 246, 0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(centerX, centerY, validatorRadius, 0, Math.PI * 2);
  ctx.stroke();

  // Draw WAN latency arcs between validators
  ctx.strokeStyle = "rgba(59, 130, 246, 0.1)";
  ctx.setLineDash([2, 2]);
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const a1 = VALIDATORS[i].angle;
      const a2 = VALIDATORS[j].angle;
      const x1 = centerX + Math.cos(a1) * validatorRadius;
      const y1 = centerY + Math.sin(a1) * validatorRadius;
      const x2 = centerX + Math.cos(a2) * validatorRadius;
      const y2 = centerY + Math.sin(a2) * validatorRadius;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);

  // Current leader
  const currentLeader = Math.floor((frame / 120) % 4);

  // Draw validators
  VALIDATORS.forEach((v, i) => {
    const x = centerX + Math.cos(v.angle) * validatorRadius;
    const y = centerY + Math.sin(v.angle) * validatorRadius;
    const isLeader = i === currentLeader;
    const isActive = currentHop === i || (currentHop === (i + 1) % 4);

    // Glow for active validators
    if (isLeader || isActive) {
      ctx.shadowColor = v.color;
      ctx.shadowBlur = isLeader ? 20 : 10;
    }

    ctx.fillStyle = isLeader ? v.color : (isActive ? v.color + "CC" : v.color + "60");
    ctx.beginPath();
    ctx.arc(x, y, validatorSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Label
    ctx.fillStyle = isLeader ? v.color : "rgba(255,255,255,0.5)";
    ctx.font = mobile ? "bold 6px monospace" : "bold 8px monospace";
    ctx.textAlign = "center";
    ctx.fillText(v.name, x, y + validatorSize + (mobile ? 10 : 14));

    // Leader crown
    if (isLeader) {
      ctx.fillStyle = "#FFD700";
      ctx.font = mobile ? "8px system-ui" : "10px system-ui";
      ctx.fillText("👑", x, y - validatorSize - 4);
    }
  });

  // Animated message between validators (showing WAN hop)
  const fromIdx = currentHop % 4;
  const toIdx = (currentHop + 1) % 4;
  const fromV = VALIDATORS[fromIdx];
  const toV = VALIDATORS[toIdx];
  const fromX = centerX + Math.cos(fromV.angle) * validatorRadius;
  const fromY = centerY + Math.sin(fromV.angle) * validatorRadius;
  const toX = centerX + Math.cos(toV.angle) * validatorRadius;
  const toY = centerY + Math.sin(toV.angle) * validatorRadius;

  // Draw traveling message
  const msgX = fromX + (toX - fromX) * hopProgress;
  const msgY = fromY + (toY - fromY) * hopProgress;

  // Message trail
  ctx.strokeStyle = fromV.color;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(msgX, msgY);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Message dot
  ctx.fillStyle = "#fff";
  ctx.shadowColor = fromV.color;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(msgX, msgY, mobile ? 4 : 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Hop counter in center
  const hopLabels = ["PROPOSE", "VOTE", "CERTIFY", "COMMIT"];
  ctx.fillStyle = VALIDATORS[currentHop % 4].color;
  ctx.font = mobile ? "bold 7px system-ui" : "bold 9px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(`Hop ${currentHop + 1}: ${hopLabels[currentHop]}`, centerX, centerY - 5);

  // ~15ms per hop annotation
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = mobile ? "5px system-ui" : "6px system-ui";
  ctx.fillText("~15ms per WAN hop", centerX, centerY + 8);

  // Bottom annotation
  ctx.fillStyle = "rgba(59, 130, 246, 0.6)";
  ctx.font = mobile ? "bold 6px system-ui" : "bold 7px system-ui";
  ctx.fillText("Leaders rotate globally → each hop crosses oceans", centerX, offsetY + height - (mobile ? 10 : 15));
}

// Draw Archon PBFT-style internal consensus
function drawArchonPBFTSection(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  width: number,
  height: number,
  padding: number,
  frame: number,
  mobile: boolean,
  phase: ArchonPhase,
  progress: number
) {
  const titleY = offsetY + (mobile ? 16 : 25);

  // Title
  ctx.fillStyle = "#00D9A5";
  ctx.font = mobile ? "bold 9px system-ui" : "bold 11px system-ui";
  ctx.textAlign = "left";
  ctx.fillText("ARCHON", offsetX + padding, titleY);

  // Phase indicator
  const phaseLabels: Record<ArchonPhase, string> = {
    propose: "1. PROPOSE",
    prepare: "2. PREPARE",
    commit: "3. COMMIT",
    broadcast: "4. BROADCAST",
    ack: "5. ACK",
    done: "✓ COMMITTED",
  };

  ctx.fillStyle = phase === "done" ? "#00D9A5" : "rgba(0, 217, 165, 0.7)";
  ctx.font = mobile ? "bold 7px monospace" : "bold 9px monospace";
  ctx.textAlign = "right";
  ctx.fillText(phaseLabels[phase], offsetX + width - padding, titleY);

  const centerX = offsetX + width / 2;
  const centerY = offsetY + height / 2 - (mobile ? 5 : 0);
  const clusterRadius = mobile ? 28 : 40;
  const externalRadius = mobile ? 60 : 85;

  // Draw datacenter boundary
  ctx.fillStyle = "rgba(0, 217, 165, 0.08)";
  ctx.beginPath();
  ctx.arc(centerX, centerY, clusterRadius + 18, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#00D9A5" + "30";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(centerX, centerY, clusterRadius + 18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // "SAME DATACENTER" label
  ctx.fillStyle = "#00D9A5";
  ctx.font = mobile ? "bold 5px system-ui" : "bold 7px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("SAME DATACENTER", centerX, centerY - clusterRadius - (mobile ? 22 : 30));
  ctx.fillStyle = "rgba(0, 217, 165, 0.5)";
  ctx.font = mobile ? "4px system-ui" : "5px system-ui";
  ctx.fillText("<1ms between nodes", centerX, centerY - clusterRadius - (mobile ? 14 : 22));

  // External ring (only visible during broadcast/ack/done)
  if (phase === "broadcast" || phase === "ack" || phase === "done") {
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, externalRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // External validators
  const externalCount = mobile ? 8 : 12;
  const externalNodes: { x: number; y: number }[] = [];
  for (let i = 0; i < externalCount; i++) {
    const angle = (i / externalCount) * Math.PI * 2 - Math.PI / 2;
    const x = centerX + Math.cos(angle) * externalRadius;
    const y = centerY + Math.sin(angle) * externalRadius;
    externalNodes.push({ x, y });

    if (phase === "broadcast" || phase === "ack" || phase === "done") {
      const lit = phase === "done" || (phase === "ack" && progress > 0.3);
      ctx.fillStyle = lit ? "#00D9A5" : "#00D9A5" + "40";
      ctx.beginPath();
      ctx.arc(x, y, mobile ? 3 : 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Cluster nodes (5 nodes: 1 primary + 4 backups)
  const clusterCount = 5;
  const clusterNodes: { x: number; y: number; isPrimary: boolean }[] = [];
  for (let i = 0; i < clusterCount; i++) {
    const angle = (i / clusterCount) * Math.PI * 2 - Math.PI / 2;
    const x = centerX + Math.cos(angle) * clusterRadius;
    const y = centerY + Math.sin(angle) * clusterRadius;
    clusterNodes.push({ x, y, isPrimary: i === 0 });
  }

  // Draw internal messages based on phase
  ctx.lineWidth = mobile ? 1.5 : 2;

  if (phase === "propose") {
    // Primary (node 0) sends to all others
    const primary = clusterNodes[0];
    ctx.strokeStyle = "#00D9A5";
    for (let i = 1; i < clusterCount; i++) {
      const target = clusterNodes[i];
      const p = Math.min(progress * 2, 1);
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.moveTo(primary.x, primary.y);
      ctx.lineTo(primary.x + (target.x - primary.x) * p, primary.y + (target.y - primary.y) * p);
      ctx.stroke();

      // Arrow head
      if (p > 0.8) {
        const tipX = primary.x + (target.x - primary.x) * p;
        const tipY = primary.y + (target.y - primary.y) * p;
        const angle = Math.atan2(target.y - primary.y, target.x - primary.x);
        ctx.fillStyle = "#00D9A5";
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX - 6 * Math.cos(angle - 0.4), tipY - 6 * Math.sin(angle - 0.4));
        ctx.lineTo(tipX - 6 * Math.cos(angle + 0.4), tipY - 6 * Math.sin(angle + 0.4));
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  if (phase === "prepare") {
    // All nodes send PREPARE votes back to primary
    const primary = clusterNodes[0];
    ctx.strokeStyle = "#F59E0B";
    for (let i = 1; i < clusterCount; i++) {
      const from = clusterNodes[i];
      const p = Math.min(progress * 2, 1);
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(from.x + (primary.x - from.x) * p, from.y + (primary.y - from.y) * p);
      ctx.stroke();

      // Arrow head
      if (p > 0.8) {
        const tipX = from.x + (primary.x - from.x) * p;
        const tipY = from.y + (primary.y - from.y) * p;
        const angle = Math.atan2(primary.y - from.y, primary.x - from.x);
        ctx.fillStyle = "#F59E0B";
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX - 5 * Math.cos(angle - 0.4), tipY - 5 * Math.sin(angle - 0.4));
        ctx.lineTo(tipX - 5 * Math.cos(angle + 0.4), tipY - 5 * Math.sin(angle + 0.4));
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // Show vote count
    const voteCount = Math.min(Math.floor(progress * 4) + 1, 4);
    ctx.fillStyle = "#F59E0B";
    ctx.font = mobile ? "bold 6px system-ui" : "bold 8px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(`${voteCount}/4 votes`, centerX, centerY + clusterRadius + (mobile ? 28 : 35));
  }

  if (phase === "commit") {
    // Primary broadcasts COMMIT to all
    const primary = clusterNodes[0];
    ctx.strokeStyle = "#A855F7";
    for (let i = 1; i < clusterCount; i++) {
      const target = clusterNodes[i];
      const p = Math.min(progress * 2, 1);
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.moveTo(primary.x, primary.y);
      ctx.lineTo(primary.x + (target.x - primary.x) * p, primary.y + (target.y - primary.y) * p);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // "2f+1 THRESHOLD MET" label
    if (progress > 0.5) {
      ctx.fillStyle = "#A855F7";
      ctx.font = mobile ? "bold 6px system-ui" : "bold 8px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("✓ 2f+1 THRESHOLD", centerX, centerY + clusterRadius + (mobile ? 28 : 35));
    }
  }

  if (phase === "broadcast") {
    // Cluster broadcasts to external validators
    ctx.strokeStyle = "#00D9A5";
    ctx.lineWidth = 1.5;
    const p = Math.min(progress * 1.5, 1);
    ctx.globalAlpha = 0.5;

    externalNodes.forEach((ext) => {
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(centerX + (ext.x - centerX) * p, centerY + (ext.y - centerY) * p);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    // "CERTIFIED BLOCK" label
    ctx.fillStyle = "#00D9A5";
    ctx.font = mobile ? "bold 6px system-ui" : "bold 8px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Broadcasting certified block...", centerX, centerY + clusterRadius + (mobile ? 28 : 35));
  }

  if (phase === "ack") {
    // External validators send ACKs back
    ctx.strokeStyle = "#00D9A5" + "80";
    ctx.lineWidth = 1;
    const p = Math.min(progress * 1.5, 1);
    ctx.globalAlpha = 0.4;

    externalNodes.forEach((ext) => {
      ctx.beginPath();
      ctx.moveTo(ext.x, ext.y);
      ctx.lineTo(ext.x + (centerX - ext.x) * p, ext.y + (centerY - ext.y) * p);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    ctx.fillStyle = "#00D9A5";
    ctx.font = mobile ? "bold 6px system-ui" : "bold 8px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Receiving ACKs...", centerX, centerY + clusterRadius + (mobile ? 28 : 35));
  }

  // Draw cluster nodes
  clusterNodes.forEach((node, i) => {
    const isActive =
      (phase === "propose" && i === 0) ||
      (phase === "prepare" && i > 0) ||
      (phase === "commit") ||
      (phase === "broadcast" || phase === "ack" || phase === "done");

    ctx.shadowColor = "#00D9A5";
    ctx.shadowBlur = isActive ? 15 : 8;

    // Primary gets special color
    if (node.isPrimary) {
      ctx.fillStyle = "#FFD700";
      ctx.shadowColor = "#FFD700";
    } else {
      ctx.fillStyle = isActive ? "#00D9A5" : "#00D9A5" + "80";
    }

    ctx.beginPath();
    ctx.arc(node.x, node.y, mobile ? 6 : 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Primary label
    if (node.isPrimary) {
      ctx.fillStyle = "#FFD700";
      ctx.font = mobile ? "bold 5px system-ui" : "bold 6px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("PRIMARY", node.x, node.y - (mobile ? 10 : 14));
    }
  });

  // Bottom annotation
  const bottomY = offsetY + height - (mobile ? 8 : 12);
  ctx.fillStyle = "rgba(0, 217, 165, 0.6)";
  ctx.font = mobile ? "bold 5px system-ui" : "bold 6px system-ui";
  ctx.textAlign = "center";

  if (phase === "propose" || phase === "prepare" || phase === "commit") {
    ctx.fillText("Internal BFT: ~5ms total (no WAN latency)", centerX, bottomY);
  } else if (phase === "broadcast" || phase === "ack") {
    ctx.fillText("External broadcast: ~5ms (1 round-trip)", centerX, bottomY);
  } else {
    ctx.fillStyle = "#00D9A5";
    ctx.fillText("✓ Block committed in ~10ms", centerX, bottomY);
  }
}

// Draw latency comparison bars
function drawLatencyBars(
  ctx: CanvasRenderingContext2D,
  width: number,
  y: number,
  veloLatency: number,
  archonLatency: number,
  mobile: boolean
) {
  const barWidth = mobile ? width * 0.35 : width * 0.18;
  const barHeight = mobile ? 10 : 14;
  const gap = mobile ? 20 : 40;

  const leftX = width / 2 - gap - barWidth;
  const rightX = width / 2 + gap;

  // Velociraptr bar
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fillRect(leftX, y, barWidth, barHeight);
  const veloFill = (veloLatency / 60) * barWidth;
  ctx.fillStyle = "#3B82F6";
  ctx.fillRect(leftX, y, veloFill, barHeight);

  ctx.fillStyle = "#3B82F6";
  ctx.font = mobile ? "bold 9px monospace" : "bold 11px monospace";
  ctx.textAlign = "center";
  ctx.fillText(`${Math.floor(veloLatency)}ms`, leftX + barWidth / 2, y - 4);

  // Archon bar
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fillRect(rightX, y, barWidth, barHeight);
  const archonFill = (archonLatency / 10) * barWidth;
  ctx.fillStyle = "#00D9A5";
  ctx.fillRect(rightX, y, archonFill, barHeight);

  ctx.fillStyle = "#00D9A5";
  ctx.fillText(`${Math.floor(archonLatency)}ms`, rightX + barWidth / 2, y - 4);
}
