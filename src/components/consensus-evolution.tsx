"use client";

import { useRef, useEffect, useState, memo } from "react";
import { useVisibility } from "@/hooks/useVisibility";

/**
 * Mysticeti v2 vs Archon Architecture Comparison
 *
 * Shows the fundamental difference in approach:
 * - Mysticeti v2: DAG-based, 3 message rounds (theoretical minimum), ~180ms
 * - Archon: Co-located cluster eliminates WAN latency, ~10ms
 *
 * Key insight: Mysticeti optimizes NUMBER of rounds (3 is minimum for BFT)
 *              Archon optimizes WHERE rounds happen (same datacenter = no WAN)
 */

interface DAGBlock {
  id: string;
  row: number;
  col: number;
  validator: number;
  x: number;
  y: number;
  parents: string[];
  committed: boolean;
  isAnchor: boolean;
  opacity: number;
}

const MYSTICETI_COLORS = ["#6FBCF0", "#4A9FD4", "#2E82B8", "#5BB5E5"];

export const ConsensusEvolution = memo(function ConsensusEvolution() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const [isMobile, setIsMobile] = useState(false);
  const isVisible = useVisibility(containerRef);

  // Animation state
  const frameRef = useRef(0);
  const dagBlocksRef = useRef<DAGBlock[]>([]);
  const roundRef = useRef(1);
  const mysticetiLatencyRef = useRef(0);
  const archonLatencyRef = useRef(0);
  const archonPhaseRef = useRef<"internal" | "external" | "done">("internal");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastTime = 0;
    const targetFPS = 30;
    const frameInterval = 1000 / targetFPS;

    // Initialize DAG for Mysticeti
    const initDAG = (width: number, height: number, mobile: boolean) => {
      const blocks: DAGBlock[] = [];
      const sectionWidth = mobile ? width : width / 2;
      const cols = 4; // 4 validators
      const rows = 3; // 3 rounds

      const startX = mobile ? 30 : 30;
      const endX = sectionWidth - 30;
      const startY = mobile ? 50 : 60;
      const endY = mobile ? height * 0.45 - 30 : height - 100;

      const colWidth = (endX - startX) / (cols - 1);
      const rowHeight = (endY - startY) / (rows - 1);

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const id = `${row}-${col}`;
          const parents: string[] = [];

          // Each block in row > 0 references 2-3 blocks from previous row
          if (row > 0) {
            if (col > 0) parents.push(`${row - 1}-${col - 1}`);
            parents.push(`${row - 1}-${col}`);
            if (col < cols - 1) parents.push(`${row - 1}-${col + 1}`);
          }

          blocks.push({
            id,
            row,
            col,
            validator: col,
            x: startX + col * colWidth,
            y: startY + row * rowHeight,
            parents,
            committed: false,
            isAnchor: row === 2 && col === 1, // One anchor block triggers commit
            opacity: 0,
          });
        }
      }
      return blocks;
    };

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
        dagBlocksRef.current = initDAG(width, height, mobile);
      }

      frameRef.current++;
      const frame = frameRef.current;

      // Clear
      ctx.fillStyle = "#0a0a0b";
      ctx.fillRect(0, 0, width, height);

      // Animation cycle (240 frames = 8 seconds at 30fps)
      const cycleProgress = (frame % 240) / 240;

      // Reset at cycle start
      if (frame % 240 === 0) {
        dagBlocksRef.current = initDAG(width, height, mobile);
        roundRef.current = 1;
        mysticetiLatencyRef.current = 0;
        archonLatencyRef.current = 0;
        archonPhaseRef.current = "internal";
      }

      // Mysticeti: 3 rounds, each ~60ms WAN latency
      const roundDuration = 0.25; // 25% of cycle per round
      if (cycleProgress < roundDuration) {
        roundRef.current = 1;
        mysticetiLatencyRef.current = cycleProgress * 240; // ~60ms
      } else if (cycleProgress < roundDuration * 2) {
        roundRef.current = 2;
        mysticetiLatencyRef.current = 60 + (cycleProgress - roundDuration) * 240;
      } else if (cycleProgress < roundDuration * 3) {
        roundRef.current = 3;
        mysticetiLatencyRef.current = 120 + (cycleProgress - roundDuration * 2) * 240;
      } else {
        mysticetiLatencyRef.current = 180;
      }

      // Archon: finishes in first 15% of cycle
      if (cycleProgress < 0.05) {
        archonPhaseRef.current = "internal";
        archonLatencyRef.current = cycleProgress * 100; // ~5ms
      } else if (cycleProgress < 0.12) {
        archonPhaseRef.current = "external";
        archonLatencyRef.current = 5 + (cycleProgress - 0.05) * 70; // ~5ms more
      } else {
        archonPhaseRef.current = "done";
        archonLatencyRef.current = 10;
      }

      // Update DAG block visibility based on round
      dagBlocksRef.current.forEach(block => {
        const shouldShow = block.row < roundRef.current;
        const targetOpacity = shouldShow ? 1 : 0;
        block.opacity += (targetOpacity - block.opacity) * 0.15;

        // Mark as committed in round 3 when anchor is visible
        if (roundRef.current >= 3 && block.row <= 1) {
          block.committed = true;
        }
      });

      const padding = mobile ? 10 : 20;

      if (mobile) {
        // === MOBILE: STACKED LAYOUT ===
        const dividerY = height * 0.50;

        // Draw Mysticeti section (top)
        drawMysticetiSection(ctx, 0, 0, width, dividerY - 10, padding, frame, dagBlocksRef.current, roundRef.current, mobile);

        // Divider
        ctx.strokeStyle = "rgba(255,255,255,0.15)";
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(padding, dividerY);
        ctx.lineTo(width - padding, dividerY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw Archon section (bottom)
        drawArchonSection(ctx, 0, dividerY + 5, width, height - dividerY - 45, padding, frame, mobile, archonPhaseRef.current);

        // Latency comparison at bottom
        const barY = height - 35;
        drawLatencyComparison(ctx, width, barY, mysticetiLatencyRef.current, archonLatencyRef.current, mobile);

      } else {
        // === DESKTOP: SIDE BY SIDE ===
        const halfW = width / 2;

        // Draw Mysticeti section (left)
        drawMysticetiSection(ctx, 0, 0, halfW, height - 70, padding, frame, dagBlocksRef.current, roundRef.current, mobile);

        // Divider
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(halfW, 30);
        ctx.lineTo(halfW, height - 90);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw Archon section (right)
        drawArchonSection(ctx, halfW, 0, halfW, height - 70, padding, frame, mobile, archonPhaseRef.current);

        // Latency comparison at bottom
        const barY = height - 50;
        drawLatencyComparison(ctx, width, barY, mysticetiLatencyRef.current, archonLatencyRef.current, mobile);
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
          <h3 className="text-xs sm:text-sm font-bold" style={{ color: "var(--chrome-200)" }}>
            Why Archon Is 18× Faster Than Mysticeti
          </h3>
          <p className="text-[9px] sm:text-xs" style={{ color: "var(--chrome-600)" }}>
            {isMobile ? "DAG vs cluster consensus" : "Sui Mysticeti v2 (180ms) vs Aptos Archon (10ms)"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#6FBCF0" }} />
            <span className="text-[8px] sm:text-[10px]" style={{ color: "var(--chrome-500)" }}>Sui</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#00D9A5" }} />
            <span className="text-[8px] sm:text-[10px]" style={{ color: "var(--chrome-500)" }}>Aptos</span>
          </div>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full rounded"
        style={{ height: isMobile ? "360px" : "300px" }}
      />

      {/* Protocol comparison */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="p-2 rounded bg-[#6FBCF0]/10 border border-[#6FBCF0]/20">
          <div className="text-[10px] sm:text-xs font-bold" style={{ color: "#6FBCF0" }}>
            Mysticeti v2 (Sui)
          </div>
          <div className="text-[8px] sm:text-[10px] mt-1" style={{ color: "var(--chrome-500)" }}>
            3 message rounds (BFT minimum). All validators on WAN.
          </div>
          <div className="text-xs sm:text-sm font-bold mt-1" style={{ color: "#6FBCF0" }}>
            ~180ms
          </div>
        </div>
        <div className="p-2 rounded bg-[#00D9A5]/10 border border-[#00D9A5]/20">
          <div className="text-[10px] sm:text-xs font-bold" style={{ color: "#00D9A5" }}>
            Archon (Aptos)
          </div>
          <div className="text-[8px] sm:text-[10px] mt-1" style={{ color: "var(--chrome-500)" }}>
            Same rounds, but internal = ~5ms (no WAN).
          </div>
          <div className="text-xs sm:text-sm font-bold mt-1" style={{ color: "#00D9A5" }}>
            ~10ms
          </div>
        </div>
      </div>

      {/* Key insight */}
      <div className="mt-2 p-1.5 rounded bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/20">
        <p className="text-[8px] sm:text-xs" style={{ color: "var(--chrome-400)" }}>
          <span className="font-bold" style={{ color: "#00D9A5" }}>Key insight:</span>
          {isMobile
            ? " Mysticeti optimizes rounds (3 = BFT minimum). Archon optimizes location (same DC = no WAN)."
            : " Mysticeti optimizes the NUMBER of rounds (3 is the theoretical minimum for BFT). Archon optimizes WHERE rounds happen—co-located nodes eliminate WAN latency entirely."
          }
        </p>
      </div>
    </div>
  );
});

// Draw Mysticeti DAG section
function drawMysticetiSection(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  width: number,
  height: number,
  padding: number,
  frame: number,
  blocks: DAGBlock[],
  currentRound: number,
  mobile: boolean
) {
  const titleY = offsetY + (mobile ? 16 : 25);

  // Title
  ctx.fillStyle = "#6FBCF0";
  ctx.font = mobile ? "bold 9px system-ui" : "bold 11px system-ui";
  ctx.textAlign = "left";
  ctx.fillText("MYSTICETI v2", offsetX + padding, titleY);

  // Subtitle with round counter
  ctx.fillStyle = "#6FBCF0";
  ctx.font = mobile ? "bold 7px monospace" : "bold 9px monospace";
  ctx.textAlign = "right";
  ctx.fillText(`Round ${currentRound}/3`, offsetX + width - padding, titleY);

  // Validator labels at top
  const validators = ["V1", "V2", "V3", "V4"];
  const startX = offsetX + (mobile ? 30 : 30);
  const endX = offsetX + width - 30;
  const colWidth = (endX - startX) / 3;

  validators.forEach((v, i) => {
    const x = startX + i * colWidth;
    ctx.fillStyle = MYSTICETI_COLORS[i];
    ctx.font = mobile ? "bold 6px system-ui" : "bold 7px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(v, x, offsetY + (mobile ? 32 : 42));
  });

  // "← Parallel proposals →" annotation
  ctx.fillStyle = "rgba(111, 188, 240, 0.5)";
  ctx.font = mobile ? "5px system-ui" : "6px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("← All propose in parallel →", offsetX + width / 2, offsetY + (mobile ? 42 : 52));

  // Draw DAG edges
  ctx.strokeStyle = "rgba(111, 188, 240, 0.3)";
  ctx.lineWidth = mobile ? 1 : 1.5;

  blocks.forEach(block => {
    if (block.opacity < 0.1) return;

    block.parents.forEach(parentId => {
      const parent = blocks.find(b => b.id === parentId);
      if (!parent || parent.opacity < 0.1) return;

      ctx.globalAlpha = Math.min(block.opacity, parent.opacity) * 0.6;
      ctx.beginPath();
      ctx.moveTo(parent.x, parent.y);
      ctx.lineTo(block.x, block.y);
      ctx.stroke();
    });
  });
  ctx.globalAlpha = 1;

  // Draw DAG nodes
  blocks.forEach(block => {
    if (block.opacity < 0.1) return;

    const color = MYSTICETI_COLORS[block.validator];
    const size = mobile ? 7 : 9;

    ctx.globalAlpha = block.opacity;

    // Anchor block gets special treatment
    if (block.isAnchor && block.opacity > 0.5) {
      ctx.shadowColor = "#FFD700";
      ctx.shadowBlur = 15;
      ctx.strokeStyle = "#FFD700";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(block.x, block.y, size + 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Committed blocks glow
    if (block.committed) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
    }

    ctx.fillStyle = block.committed ? color : color + "80";
    ctx.beginPath();
    ctx.arc(block.x, block.y, size, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;

    // Round label on left side
    if (block.col === 0) {
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = mobile ? "5px system-ui" : "6px system-ui";
      ctx.textAlign = "right";
      ctx.fillText(`R${block.row + 1}`, block.x - size - 5, block.y + 2);
    }
  });
  ctx.globalAlpha = 1;

  // Commit explanation at bottom
  const bottomY = offsetY + height - (mobile ? 8 : 12);
  ctx.fillStyle = "rgba(111, 188, 240, 0.6)";
  ctx.font = mobile ? "bold 5px system-ui" : "bold 6px system-ui";
  ctx.textAlign = "center";

  if (currentRound < 3) {
    ctx.fillText(`Waiting for Round ${currentRound + 1}...`, offsetX + width / 2, bottomY);
  } else {
    ctx.fillStyle = "#FFD700";
    ctx.fillText("★ Anchor block → Commit!", offsetX + width / 2, bottomY);
  }
}

// Draw Archon cluster section (same as before but with emphasis on comparison)
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

  // Phase indicator
  ctx.fillStyle = phase === "done" ? "#00D9A5" : "rgba(0, 217, 165, 0.6)";
  ctx.font = mobile ? "bold 7px monospace" : "bold 9px monospace";
  ctx.textAlign = "right";
  const phaseText = phase === "internal" ? "Internal..." : phase === "external" ? "Broadcast..." : "✓ Done!";
  ctx.fillText(phaseText, offsetX + width - padding, titleY);

  const centerX = offsetX + width / 2;
  const centerY = offsetY + height / 2 - (mobile ? 0 : 10);
  const clusterRadius = mobile ? 20 : 30;
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

  // Cluster background with "SAME DC" emphasis
  ctx.fillStyle = "rgba(0, 217, 165, 0.15)";
  ctx.beginPath();
  ctx.arc(centerX, centerY, clusterRadius + 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#00D9A5" + "40";
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.arc(centerX, centerY, clusterRadius + 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // "SAME DC" label
  ctx.fillStyle = "#00D9A5";
  ctx.font = mobile ? "bold 6px system-ui" : "bold 8px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("SAME", centerX, centerY - clusterRadius - (mobile ? 16 : 22));
  ctx.fillText("DATACENTER", centerX, centerY - clusterRadius - (mobile ? 8 : 12));

  // Cluster nodes
  const clusterCount = 5;
  const clusterNodes: { x: number; y: number }[] = [];
  for (let i = 0; i < clusterCount; i++) {
    const angle = (i / clusterCount) * Math.PI * 2 - Math.PI / 2;
    const x = centerX + Math.cos(angle) * clusterRadius;
    const y = centerY + Math.sin(angle) * clusterRadius;
    clusterNodes.push({ x, y });
  }

  // Internal messages (fast)
  if (phase === "internal") {
    ctx.strokeStyle = "#00D9A5";
    ctx.lineWidth = 2;
    const progress = ((frame % 20) / 20) * 3;

    for (let i = 0; i < clusterCount; i++) {
      for (let j = i + 1; j < clusterCount; j++) {
        const p = Math.min(progress, 1);
        const from = clusterNodes[i];
        const to = clusterNodes[j];

        ctx.globalAlpha = 0.7;
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
    const glowing = phase !== "internal" || (frame % 8) < 4;
    ctx.shadowColor = "#00D9A5";
    ctx.shadowBlur = glowing ? 15 : 8;
    ctx.fillStyle = "#00D9A5";
    ctx.beginPath();
    ctx.arc(node.x, node.y, mobile ? 6 : 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });

  // External broadcast
  if (phase === "external") {
    ctx.strokeStyle = "#00D9A5";
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.6;
    const progress = ((frame % 45) / 45) * 2;

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

  // Bottom annotation
  const bottomY = offsetY + height - (mobile ? 8 : 12);
  ctx.fillStyle = "rgba(0, 217, 165, 0.6)";
  ctx.font = mobile ? "bold 5px system-ui" : "bold 6px system-ui";
  ctx.textAlign = "center";

  if (phase === "internal") {
    ctx.fillText("Internal BFT: ~5ms (no WAN!)", centerX, bottomY);
  } else if (phase === "external") {
    ctx.fillText("Broadcast to network: ~5ms", centerX, bottomY);
  } else {
    ctx.fillStyle = "#00D9A5";
    ctx.fillText("✓ Total: ~10ms (18× faster)", centerX, bottomY);
  }
}

// Draw latency comparison
function drawLatencyComparison(
  ctx: CanvasRenderingContext2D,
  width: number,
  y: number,
  mysticetiLatency: number,
  archonLatency: number,
  mobile: boolean
) {
  const barWidth = mobile ? width * 0.35 : width * 0.2;
  const barHeight = mobile ? 10 : 14;
  const gap = mobile ? 15 : 30;

  const leftX = width / 2 - gap - barWidth;
  const rightX = width / 2 + gap;

  // Mysticeti bar
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fillRect(leftX, y, barWidth, barHeight);
  const mystFill = Math.min((mysticetiLatency / 180) * barWidth, barWidth);
  ctx.fillStyle = "#6FBCF0";
  ctx.fillRect(leftX, y, mystFill, barHeight);

  ctx.fillStyle = "#6FBCF0";
  ctx.font = mobile ? "bold 9px monospace" : "bold 11px monospace";
  ctx.textAlign = "center";
  ctx.fillText(`${Math.floor(mysticetiLatency)}ms`, leftX + barWidth / 2, y - 4);

  // Archon bar
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fillRect(rightX, y, barWidth, barHeight);
  const archonFill = (archonLatency / 10) * barWidth;
  ctx.fillStyle = "#00D9A5";
  ctx.fillRect(rightX, y, archonFill, barHeight);

  ctx.fillStyle = "#00D9A5";
  ctx.fillText(`${Math.floor(archonLatency)}ms`, rightX + barWidth / 2, y - 4);

  // Labels
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = mobile ? "5px system-ui" : "6px system-ui";
  ctx.fillText("Mysticeti", leftX + barWidth / 2, y + barHeight + (mobile ? 10 : 12));
  ctx.fillText("Archon", rightX + barWidth / 2, y + barHeight + (mobile ? 10 : 12));
}
