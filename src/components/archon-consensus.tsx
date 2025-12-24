"use client";

import { useRef, useEffect, useState, memo } from "react";
import { useVisibility } from "@/hooks/useVisibility";

/**
 * Velociraptr vs Archon Consensus Comparison
 *
 * Shows the evolution from Velociraptr (current, ~60ms) to Archon (future, ~10ms):
 * - Velociraptr: Pipelined proposals, 4 network hops per block
 * - Archon: Co-located cluster eliminates WAN latency for internal consensus
 */

// Pipeline block states
interface PipelineBlock {
  id: number;
  stage: "proposed" | "voting" | "committing" | "committed";
  progress: number;
  leader: number;
}

// Cluster message for Archon
interface ClusterMessage {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  progress: number;
  type: "internal" | "external";
}

const VALIDATORS = [
  { name: "NYC", color: "#3B82F6" },
  { name: "TKY", color: "#F59E0B" },
  { name: "LON", color: "#10B981" },
  { name: "SYD", color: "#EF4444" },
];

export const ArchonConsensus = memo(function ArchonConsensus() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const [isMobile, setIsMobile] = useState(false);
  const isVisible = useVisibility(containerRef);

  // Animation state
  const frameRef = useRef(0);
  const pipelineBlocksRef = useRef<PipelineBlock[]>([]);
  const clusterMessagesRef = useRef<ClusterMessage[]>([]);
  const archonPhaseRef = useRef<"internal" | "external" | "done">("internal");
  const veloLatencyRef = useRef(0);
  const archonLatencyRef = useRef(0);
  const blockIdRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastTime = 0;
    const targetFPS = 30;
    const frameInterval = 1000 / targetFPS;

    // Initialize pipeline blocks
    const initPipeline = () => {
      pipelineBlocksRef.current = [
        { id: blockIdRef.current++, stage: "committed", progress: 1, leader: 0 },
        { id: blockIdRef.current++, stage: "committing", progress: 0.5, leader: 1 },
        { id: blockIdRef.current++, stage: "voting", progress: 0.3, leader: 2 },
        { id: blockIdRef.current++, stage: "proposed", progress: 0, leader: 3 },
      ];
    };

    initPipeline();

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

      // Animation cycle (180 frames = 6 seconds at 30fps)
      const cycleProgress = (frame % 180) / 180;

      // Reset latencies at cycle start
      if (frame % 180 === 0) {
        veloLatencyRef.current = 0;
        archonLatencyRef.current = 0;
        archonPhaseRef.current = "internal";
        clusterMessagesRef.current = [];
      }

      // Update latencies
      veloLatencyRef.current = Math.min(cycleProgress * 90, 60);
      if (cycleProgress < 0.15) {
        archonLatencyRef.current = cycleProgress * 33; // ~5ms internal
        archonPhaseRef.current = "internal";
      } else if (cycleProgress < 0.3) {
        archonLatencyRef.current = 5 + (cycleProgress - 0.15) * 33; // +5ms external
        archonPhaseRef.current = "external";
      } else {
        archonLatencyRef.current = 10;
        archonPhaseRef.current = "done";
      }

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
        drawArchonSection(ctx, 0, dividerY, width, height - dividerY, padding, frame, mobile, archonPhaseRef.current);

        // Latency comparison at very bottom
        const barY = height - 30;
        drawLatencyBars(ctx, width, barY, veloLatencyRef.current, archonLatencyRef.current, mobile);

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
        drawArchonSection(ctx, halfW, 0, halfW, height - 60, padding, frame, mobile, archonPhaseRef.current);

        // Latency comparison at bottom
        const barY = height - 45;
        drawLatencyBars(ctx, width, barY, veloLatencyRef.current, archonLatencyRef.current, mobile);
      }

      // Update pipeline blocks
      pipelineBlocksRef.current.forEach(block => {
        block.progress += 0.008;
        if (block.progress >= 1) {
          // Advance stage
          if (block.stage === "proposed") block.stage = "voting";
          else if (block.stage === "voting") block.stage = "committing";
          else if (block.stage === "committing") block.stage = "committed";
          block.progress = 0;
        }
      });

      // Recycle committed blocks
      if (frame % 60 === 0) {
        const committed = pipelineBlocksRef.current.filter(b => b.stage === "committed" && b.progress > 0.5);
        committed.forEach(block => {
          block.id = blockIdRef.current++;
          block.stage = "proposed";
          block.progress = 0;
          block.leader = (block.leader + 1) % 4;
        });
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
              Archon: 6× Faster Than Velociraptr
            </h3>
          </div>
          <p className="text-[9px] sm:text-xs" style={{ color: "var(--chrome-600)" }}>
            {isMobile ? "Pipeline vs co-located cluster" : "Pipelined proposals (60ms) vs co-located cluster (10ms)"}
          </p>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full rounded"
        style={{ height: isMobile ? "340px" : "280px" }}
      />

      {/* Protocol comparison */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20">
          <div className="text-[10px] sm:text-xs font-bold" style={{ color: "#3B82F6" }}>
            Velociraptr (AIP-131)
          </div>
          <div className="text-[8px] sm:text-[10px] mt-1" style={{ color: "var(--chrome-500)" }}>
            4 network hops per block. Blocks overlap in pipeline.
          </div>
          <div className="text-xs sm:text-sm font-bold mt-1" style={{ color: "#3B82F6" }}>
            ~60ms
          </div>
        </div>
        <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20">
          <div className="text-[10px] sm:text-xs font-bold" style={{ color: "#00D9A5" }}>
            Archon
          </div>
          <div className="text-[8px] sm:text-[10px] mt-1" style={{ color: "var(--chrome-500)" }}>
            Internal consensus ~5ms. 1 external broadcast.
          </div>
          <div className="text-xs sm:text-sm font-bold mt-1" style={{ color: "#00D9A5" }}>
            ~10ms
          </div>
        </div>
      </div>

      {/* Key insight */}
      <div className="mt-2 p-1.5 rounded bg-white/5">
        <p className="text-[8px] sm:text-xs" style={{ color: "var(--chrome-500)" }}>
          <span className="font-bold" style={{ color: "#00D9A5" }}>Key insight:</span>
          {isMobile
            ? " Velociraptr pipelines blocks. Archon eliminates WAN latency entirely."
            : " Velociraptr overlaps block stages but still needs 4 WAN hops. Archon's co-located cluster reaches consensus in ~5ms (no WAN), then broadcasts once."
          }
        </p>
      </div>
    </div>
  );
});

// Draw Velociraptr pipeline section
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
  ctx.fillText("Pipelined (4 hops)", offsetX + width - padding, titleY);

  const centerX = offsetX + width / 2;
  const centerY = offsetY + height / 2 + (mobile ? 5 : 10);

  // Draw 4 validators in a ring
  const validatorRadius = mobile ? 50 : 70;
  const validatorSize = mobile ? 6 : 8;

  // Current leader (rotates)
  const currentLeader = Math.floor((frame / 45) % 4);

  VALIDATORS.forEach((v, i) => {
    const angle = (i / 4) * Math.PI * 2 - Math.PI / 2;
    const x = centerX + Math.cos(angle) * validatorRadius;
    const y = centerY + Math.sin(angle) * validatorRadius;
    const isLeader = i === currentLeader;

    // Leader glow
    if (isLeader) {
      ctx.shadowColor = v.color;
      ctx.shadowBlur = 15;
    }

    ctx.fillStyle = isLeader ? v.color : v.color + "60";
    ctx.beginPath();
    ctx.arc(x, y, validatorSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Label
    ctx.fillStyle = isLeader ? v.color : "rgba(255,255,255,0.4)";
    ctx.font = mobile ? "5px monospace" : "7px monospace";
    ctx.textAlign = "center";
    ctx.fillText(v.name, x, y + validatorSize + (mobile ? 8 : 12));

    // Leader indicator
    if (isLeader) {
      ctx.fillStyle = v.color;
      ctx.font = mobile ? "bold 5px system-ui" : "bold 6px system-ui";
      ctx.fillText("LEADER", x, y - validatorSize - 4);
    }
  });

  // Draw pipeline stages in center
  const stageColors = {
    proposed: "#3B82F6",
    voting: "#F59E0B",
    committing: "#A855F7",
    committed: "#00D9A5",
  };

  const stageLabels = {
    proposed: "PROPOSE",
    voting: "VOTE",
    committing: "COMMIT",
    committed: "DONE",
  };

  // Pipeline visualization (vertical stack in center)
  const pipelineY = centerY - (mobile ? 25 : 35);
  const stageHeight = mobile ? 14 : 18;
  const stageWidth = mobile ? 50 : 70;

  const stages: Array<"proposed" | "voting" | "committing" | "committed"> = ["proposed", "voting", "committing", "committed"];

  stages.forEach((stage, i) => {
    const y = pipelineY + i * (stageHeight + 4);

    // Stage background
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.beginPath();
    ctx.roundRect(centerX - stageWidth / 2, y, stageWidth, stageHeight, 3);
    ctx.fill();

    // Stage fill (animated)
    const progress = ((frame / 30 + i * 0.25) % 1);
    ctx.fillStyle = stageColors[stage] + "40";
    ctx.beginPath();
    ctx.roundRect(centerX - stageWidth / 2, y, stageWidth * progress, stageHeight, 3);
    ctx.fill();

    // Block indicator
    ctx.fillStyle = stageColors[stage];
    ctx.beginPath();
    ctx.arc(centerX - stageWidth / 2 + stageWidth * progress, y + stageHeight / 2, mobile ? 3 : 4, 0, Math.PI * 2);
    ctx.fill();

    // Label
    ctx.fillStyle = stageColors[stage];
    ctx.font = mobile ? "bold 5px system-ui" : "bold 6px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(stageLabels[stage], centerX, y + stageHeight / 2 + 2);
  });

  // Arrow connecting stages
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const y1 = pipelineY + i * (stageHeight + 4) + stageHeight;
    const y2 = pipelineY + (i + 1) * (stageHeight + 4);
    ctx.beginPath();
    ctx.moveTo(centerX, y1);
    ctx.lineTo(centerX, y2);
    ctx.stroke();
  }

  // "4 hops" annotation
  ctx.fillStyle = "rgba(59, 130, 246, 0.6)";
  ctx.font = mobile ? "bold 6px system-ui" : "bold 7px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("4 network hops per block", centerX, offsetY + height - (mobile ? 10 : 15));
}

// Draw Archon cluster section
function drawArchonSection(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  width: number,
  height: number,
  padding: number,
  frame: number,
  mobile: boolean,
  phase: "internal" | "external" | "done"
) {
  const titleY = offsetY + (mobile ? 16 : 25);

  // Title
  ctx.fillStyle = "#00D9A5";
  ctx.font = mobile ? "bold 9px system-ui" : "bold 11px system-ui";
  ctx.textAlign = "left";
  ctx.fillText("ARCHON", offsetX + padding, titleY);

  // Subtitle
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = mobile ? "5px system-ui" : "8px system-ui";
  ctx.textAlign = "right";
  ctx.fillText("Cluster (2-3 hops)", offsetX + width - padding, titleY);

  const centerX = offsetX + width / 2;
  const centerY = offsetY + height / 2;
  const clusterRadius = mobile ? 18 : 28;
  const externalRadius = mobile ? 50 : 75;

  // External validators ring
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(centerX, centerY, externalRadius, 0, Math.PI * 2);
  ctx.stroke();

  // External validators
  const externalCount = mobile ? 6 : 8;
  const externalNodes: { x: number; y: number }[] = [];
  for (let i = 0; i < externalCount; i++) {
    const angle = (i / externalCount) * Math.PI * 2 - Math.PI / 2;
    const x = centerX + Math.cos(angle) * externalRadius;
    const y = centerY + Math.sin(angle) * externalRadius;
    externalNodes.push({ x, y });

    const lit = phase === "done" || (phase === "external" && (frame % 60) > 30);
    ctx.fillStyle = lit ? "#00D9A5" : "#00D9A5" + "40";
    ctx.beginPath();
    ctx.arc(x, y, mobile ? 4 : 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cluster background
  ctx.fillStyle = "rgba(0, 217, 165, 0.1)";
  ctx.beginPath();
  ctx.arc(centerX, centerY, clusterRadius + 10, 0, Math.PI * 2);
  ctx.fill();

  // "SAME DC" label
  ctx.fillStyle = "rgba(0, 217, 165, 0.6)";
  ctx.font = mobile ? "bold 5px system-ui" : "bold 7px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("SAME DC", centerX, centerY - clusterRadius - (mobile ? 14 : 18));

  // Cluster nodes
  const clusterCount = 5;
  const clusterNodes: { x: number; y: number }[] = [];
  for (let i = 0; i < clusterCount; i++) {
    const angle = (i / clusterCount) * Math.PI * 2 - Math.PI / 2;
    const x = centerX + Math.cos(angle) * clusterRadius;
    const y = centerY + Math.sin(angle) * clusterRadius;
    clusterNodes.push({ x, y });
  }

  // Internal messages (fast, during internal phase)
  if (phase === "internal") {
    ctx.strokeStyle = "#00D9A5";
    ctx.lineWidth = 2;
    const progress = ((frame % 30) / 30) * 3; // Very fast

    for (let i = 0; i < clusterCount; i++) {
      for (let j = i + 1; j < clusterCount; j++) {
        const p = Math.min(progress, 1);
        const from = clusterNodes[i];
        const to = clusterNodes[j];

        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(from.x + (to.x - from.x) * p, from.y + (to.y - from.y) * p);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
  }

  // Draw cluster nodes
  clusterNodes.forEach((node) => {
    const glowing = phase !== "internal" || (frame % 10) < 5;
    ctx.shadowColor = "#00D9A5";
    ctx.shadowBlur = glowing ? 12 : 6;
    ctx.fillStyle = "#00D9A5";
    ctx.beginPath();
    ctx.arc(node.x, node.y, mobile ? 5 : 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });

  // External broadcast (during external phase)
  if (phase === "external") {
    ctx.strokeStyle = "#00D9A5";
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.5;
    const progress = ((frame % 60) / 60) * 2;

    externalNodes.forEach((ext) => {
      const p = Math.min(progress, 1);
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(centerX + (ext.x - centerX) * p, centerY + (ext.y - centerY) * p);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
  }

  // Phase indicator
  const phaseY = offsetY + height - (mobile ? 10 : 15);
  ctx.font = mobile ? "bold 6px monospace" : "bold 8px monospace";
  ctx.textAlign = "center";

  if (phase === "internal") {
    ctx.fillStyle = "#00D9A5";
    ctx.fillText("Internal: ~5ms", centerX, phaseY);
  } else if (phase === "external") {
    ctx.fillStyle = "#00D9A5" + "80";
    ctx.fillText("Broadcast: ~5ms", centerX, phaseY);
  } else {
    ctx.fillStyle = "#00D9A5";
    ctx.fillText("✓ Total: ~10ms", centerX, phaseY);
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
