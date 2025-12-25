"use client";

import { useRef, useEffect, useState, memo } from "react";
import { useVisibility } from "@/hooks/useVisibility";

/**
 * Mysticeti v2 vs Archon Architecture Comparison
 *
 * Two distinct visualizations:
 * - Mysticeti v2: DAG with parallel proposals, 3 rounds, anchor commits
 * - Archon: Timeline/Gantt chart showing how internal consensus + broadcast
 *   is dramatically faster than 3 WAN rounds
 *
 * Key insight: Same number of "rounds" conceptually, but Archon's internal
 * rounds happen in microseconds (same datacenter) vs Mysticeti's 60ms per round (WAN)
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
  const archonProgressRef = useRef(0);

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

      // Animation cycle (300 frames = 10 seconds at 30fps)
      const cycleProgress = (frame % 300) / 300;

      // Reset at cycle start
      if (frame % 300 === 0) {
        dagBlocksRef.current = initDAG(width, height, mobile);
        roundRef.current = 1;
        mysticetiLatencyRef.current = 0;
        archonProgressRef.current = 0;
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

      // Archon progress (completes in first 10% of cycle)
      archonProgressRef.current = Math.min(cycleProgress * 10, 1);

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

        // Draw Archon timeline section (bottom)
        drawArchonTimelineSection(ctx, 0, dividerY + 5, width, height - dividerY - 55, padding, frame, mobile, archonProgressRef.current, mysticetiLatencyRef.current);

        // Latency comparison at bottom
        const barY = height - 40;
        drawLatencyComparison(ctx, width, barY, mysticetiLatencyRef.current, archonProgressRef.current * 10, mobile);

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

        // Draw Archon timeline section (right)
        drawArchonTimelineSection(ctx, halfW, 0, halfW, height - 80, padding, frame, mobile, archonProgressRef.current, mysticetiLatencyRef.current);

        // Latency comparison at bottom
        const barY = height - 55;
        drawLatencyComparison(ctx, width, barY, mysticetiLatencyRef.current, archonProgressRef.current * 10, mobile);
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
            {isMobile ? "DAG rounds vs timeline" : "Sui Mysticeti v2 (180ms) vs Aptos Archon (10ms)"}
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
        style={{ height: isMobile ? "340px" : "320px" }}
      />

      {/* Protocol comparison */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="p-2 rounded bg-[#6FBCF0]/10 border border-[#6FBCF0]/20">
          <div className="text-[10px] sm:text-xs font-bold" style={{ color: "#6FBCF0" }}>
            Mysticeti v2 (Sui)
          </div>
          <div className="text-[8px] sm:text-[10px] mt-1" style={{ color: "var(--chrome-500)" }}>
            DAG: 3 rounds × ~60ms WAN = 180ms
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
            Cluster BFT ~5ms + broadcast ~5ms
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
            : " Both need ~3 message rounds for BFT. But Mysticeti's rounds cross the WAN (60ms each), while Archon's internal rounds happen in microseconds (same datacenter)."
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
    ctx.fillText(`Round ${currentRound}: ~60ms WAN latency each`, offsetX + width / 2, bottomY);
  } else {
    ctx.fillStyle = "#FFD700";
    ctx.fillText("★ Anchor block → Commit!", offsetX + width / 2, bottomY);
  }
}

// Draw Archon as a timeline/Gantt chart - DIFFERENT from the PBFT view
function drawArchonTimelineSection(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  width: number,
  height: number,
  padding: number,
  frame: number,
  mobile: boolean,
  progress: number,
  mysticetiLatency: number
) {
  const titleY = offsetY + (mobile ? 16 : 25);

  // Title
  ctx.fillStyle = "#00D9A5";
  ctx.font = mobile ? "bold 9px system-ui" : "bold 11px system-ui";
  ctx.textAlign = "left";
  ctx.fillText("ARCHON", offsetX + padding, titleY);

  // Status
  const done = progress >= 1;
  ctx.fillStyle = done ? "#00D9A5" : "rgba(0, 217, 165, 0.7)";
  ctx.font = mobile ? "bold 7px monospace" : "bold 9px monospace";
  ctx.textAlign = "right";
  ctx.fillText(done ? "✓ DONE" : "Processing...", offsetX + width - padding, titleY);

  // Timeline visualization
  const timelineY = offsetY + (mobile ? 35 : 55);
  const timelineHeight = mobile ? 80 : 110;
  const timelineLeft = offsetX + padding + 40;
  const timelineRight = offsetX + width - padding - 10;
  const timelineWidth = timelineRight - timelineLeft;

  // Time scale label
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.font = mobile ? "5px system-ui" : "6px system-ui";
  ctx.textAlign = "left";
  ctx.fillText("Time →", timelineLeft, timelineY - 8);

  // Draw time scale (0ms to 180ms to show comparison)
  const timeMarks = [0, 60, 120, 180];
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1;

  timeMarks.forEach(ms => {
    const x = timelineLeft + (ms / 180) * timelineWidth;
    ctx.beginPath();
    ctx.moveTo(x, timelineY);
    ctx.lineTo(x, timelineY + timelineHeight);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = mobile ? "5px monospace" : "6px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${ms}ms`, x, timelineY + timelineHeight + 12);
  });

  // === MYSTICETI TIMELINE (for comparison) ===
  const mystRow = timelineY + 12;
  const rowHeight = mobile ? 20 : 26;

  // Mysticeti label
  ctx.fillStyle = "#6FBCF0";
  ctx.font = mobile ? "bold 6px system-ui" : "bold 7px system-ui";
  ctx.textAlign = "right";
  ctx.fillText("Mysticeti", timelineLeft - 5, mystRow + rowHeight / 2 + 2);

  // 3 rounds, each 60ms
  for (let r = 0; r < 3; r++) {
    const roundX = timelineLeft + (r * 60 / 180) * timelineWidth;
    const roundWidth = (60 / 180) * timelineWidth;
    const roundProgress = Math.max(0, Math.min(1, (mysticetiLatency - r * 60) / 60));

    // Background
    ctx.fillStyle = "rgba(111, 188, 240, 0.15)";
    ctx.fillRect(roundX, mystRow, roundWidth - 2, rowHeight);

    // Fill based on progress
    if (roundProgress > 0) {
      ctx.fillStyle = "#6FBCF0";
      ctx.fillRect(roundX, mystRow, (roundWidth - 2) * roundProgress, rowHeight);
    }

    // Round label
    ctx.fillStyle = roundProgress > 0.5 ? "#fff" : "#6FBCF0";
    ctx.font = mobile ? "bold 6px system-ui" : "bold 7px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(`R${r + 1}`, roundX + roundWidth / 2, mystRow + rowHeight / 2 + 3);
  }

  // WAN latency annotations
  ctx.fillStyle = "rgba(111, 188, 240, 0.5)";
  ctx.font = mobile ? "4px system-ui" : "5px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("60ms WAN", timelineLeft + (30 / 180) * timelineWidth, mystRow - 4);
  ctx.fillText("60ms WAN", timelineLeft + (90 / 180) * timelineWidth, mystRow - 4);
  ctx.fillText("60ms WAN", timelineLeft + (150 / 180) * timelineWidth, mystRow - 4);

  // === ARCHON TIMELINE ===
  const archRow = mystRow + rowHeight + 15;

  // Archon label
  ctx.fillStyle = "#00D9A5";
  ctx.font = mobile ? "bold 6px system-ui" : "bold 7px system-ui";
  ctx.textAlign = "right";
  ctx.fillText("Archon", timelineLeft - 5, archRow + rowHeight / 2 + 2);

  // Internal BFT phase (~5ms, very narrow)
  const internalWidth = (5 / 180) * timelineWidth;
  const internalProgress = Math.min(progress * 2, 1);

  // Internal background
  ctx.fillStyle = "rgba(0, 217, 165, 0.15)";
  ctx.fillRect(timelineLeft, archRow, internalWidth, rowHeight);

  // Internal fill
  if (internalProgress > 0) {
    ctx.fillStyle = "#00D9A5";
    ctx.fillRect(timelineLeft, archRow, internalWidth * internalProgress, rowHeight);
  }

  // Broadcast phase (~5ms)
  const broadcastX = timelineLeft + internalWidth + 2;
  const broadcastWidth = (5 / 180) * timelineWidth;
  const broadcastProgress = Math.max(0, Math.min(1, (progress - 0.5) * 2));

  // Broadcast background
  ctx.fillStyle = "rgba(0, 217, 165, 0.15)";
  ctx.fillRect(broadcastX, archRow, broadcastWidth, rowHeight);

  // Broadcast fill
  if (broadcastProgress > 0) {
    ctx.fillStyle = "#00D9A5" + "CC";
    ctx.fillRect(broadcastX, archRow, broadcastWidth * broadcastProgress, rowHeight);
  }

  // Phase labels (if wide enough)
  if (!mobile) {
    ctx.fillStyle = internalProgress > 0.5 ? "#000" : "#00D9A5";
    ctx.font = "bold 5px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("BFT", timelineLeft + internalWidth / 2, archRow + rowHeight / 2 + 2);

    ctx.fillStyle = broadcastProgress > 0.5 ? "#000" : "#00D9A5";
    ctx.fillText("BC", broadcastX + broadcastWidth / 2, archRow + rowHeight / 2 + 2);
  }

  // Archon completion marker
  if (done) {
    const doneX = broadcastX + broadcastWidth + 10;
    ctx.fillStyle = "#00D9A5";
    ctx.font = mobile ? "bold 8px system-ui" : "bold 10px system-ui";
    ctx.textAlign = "left";
    ctx.fillText("✓ 10ms", doneX, archRow + rowHeight / 2 + 3);
  }

  // === SPEEDUP VISUALIZATION ===
  const speedupRow = archRow + rowHeight + 18;

  // Arrow showing 18× speedup
  if (done) {
    const mystEndX = timelineLeft + timelineWidth;
    const archEndX = broadcastX + broadcastWidth;

    // Draw bracket showing time saved
    ctx.strokeStyle = "rgba(0, 217, 165, 0.5)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);

    // Horizontal line at Archon's completion
    ctx.beginPath();
    ctx.moveTo(archEndX, archRow + rowHeight / 2);
    ctx.lineTo(archEndX, speedupRow);
    ctx.stroke();

    // Horizontal line at Mysticeti's completion (when done)
    if (mysticetiLatency >= 180) {
      ctx.beginPath();
      ctx.moveTo(mystEndX, mystRow + rowHeight / 2);
      ctx.lineTo(mystEndX, speedupRow);
      ctx.stroke();

      // Connecting line with "18× faster" label
      ctx.beginPath();
      ctx.moveTo(archEndX, speedupRow);
      ctx.lineTo(mystEndX, speedupRow);
      ctx.stroke();

      ctx.setLineDash([]);

      // 18× faster label
      const midX = (archEndX + mystEndX) / 2;
      ctx.fillStyle = "#00D9A5";
      ctx.font = mobile ? "bold 8px system-ui" : "bold 10px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("18× FASTER", midX, speedupRow - 5);

      // Time saved
      ctx.fillStyle = "rgba(0, 217, 165, 0.6)";
      ctx.font = mobile ? "6px system-ui" : "7px system-ui";
      ctx.fillText("170ms saved", midX, speedupRow + 12);
    }

    ctx.setLineDash([]);
  }

  // Bottom annotation
  const bottomY = offsetY + height - (mobile ? 8 : 12);
  ctx.fillStyle = "rgba(0, 217, 165, 0.6)";
  ctx.font = mobile ? "bold 5px system-ui" : "bold 6px system-ui";
  ctx.textAlign = "center";

  if (!done) {
    ctx.fillText("Co-located cluster: internal rounds in microseconds", offsetX + width / 2, bottomY);
  } else {
    ctx.fillStyle = "#00D9A5";
    ctx.fillText("Same 3 BFT rounds, but internal = no WAN latency!", offsetX + width / 2, bottomY);
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
