"use client";

import { useRef, useEffect, useState, memo } from "react";
import { useVisibility } from "@/hooks/useVisibility";

/**
 * Mysticeti v2 vs Archon Architecture Comparison
 *
 * Shows the fundamental architectural differences:
 * - Mysticeti v2: DAG-based parallel proposals, commit by depth
 * - Archon: Co-located cluster, ultra-fast internal consensus
 */

interface DAGBlock {
  id: number;
  x: number;
  y: number;
  validator: number;
  parents: number[];
  depth: number;
  committed: boolean;
  opacity: number;
}

interface ClusterNode {
  x: number;
  y: number;
  angle: number;
  isCluster: boolean;
  label: string;
}

export const ConsensusEvolution = memo(function ConsensusEvolution() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const [isMobile, setIsMobile] = useState(false);
  const isVisible = useVisibility(containerRef);

  // Animation state
  const frameRef = useRef(0);
  const dagBlocksRef = useRef<DAGBlock[]>([]);
  const clusterPhaseRef = useRef(0);
  const messageProgressRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastTime = 0;
    const targetFPS = 30;
    const frameInterval = 1000 / targetFPS;

    // DAG colors for validators
    const dagColors = ["#6FBCF0", "#4A9FD4", "#2E82B8", "#5BB5E5"];

    // Initialize DAG blocks
    const initDAG = (width: number, height: number, mobile: boolean) => {
      const blocks: DAGBlock[] = [];
      const halfW = mobile ? width : width / 2;
      const startX = mobile ? 20 : 20;
      const endX = halfW - 20;
      const startY = mobile ? 50 : 60;
      const endY = mobile ? height * 0.45 - 20 : height - 80;

      const cols = mobile ? 4 : 5;
      const rows = mobile ? 3 : 4;
      const colWidth = (endX - startX) / cols;
      const rowHeight = (endY - startY) / rows;

      let id = 0;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const validator = col % 4;
          const parents: number[] = [];

          // Connect to blocks in previous row
          if (row > 0) {
            const prevRowStart = (row - 1) * cols;
            // Each block connects to 2-3 parents
            if (col > 0) parents.push(prevRowStart + col - 1);
            parents.push(prevRowStart + col);
            if (col < cols - 1) parents.push(prevRowStart + col + 1);
          }

          blocks.push({
            id,
            x: startX + col * colWidth + colWidth / 2 + (Math.random() - 0.5) * 10,
            y: startY + row * rowHeight + rowHeight / 2,
            validator,
            parents,
            depth: row,
            committed: row < rows - 2,
            opacity: 0,
          });
          id++;
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

      const padding = mobile ? 10 : 20;

      if (mobile) {
        // === MOBILE: STACKED LAYOUT ===
        const dividerY = height * 0.48;

        // Mysticeti section (top)
        drawMysticetiSection(ctx, 0, 0, width, dividerY, padding, frame, dagBlocksRef.current, dagColors, true);

        // Divider
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.beginPath();
        ctx.moveTo(padding, dividerY);
        ctx.lineTo(width - padding, dividerY);
        ctx.stroke();

        // Archon section (bottom)
        drawArchonSection(ctx, 0, dividerY, width, height - dividerY, padding, frame, true);

      } else {
        // === DESKTOP: SIDE BY SIDE ===
        const halfW = width / 2;

        // Mysticeti section (left)
        drawMysticetiSection(ctx, 0, 0, halfW, height, padding, frame, dagBlocksRef.current, dagColors, false);

        // Divider
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.beginPath();
        ctx.moveTo(halfW, padding + 30);
        ctx.lineTo(halfW, height - padding);
        ctx.stroke();

        // Archon section (right)
        drawArchonSection(ctx, halfW, 0, halfW, height, padding, frame, false);
      }

      // Update DAG block opacity
      dagBlocksRef.current.forEach((block, i) => {
        const targetOpacity = ((frame / 3) % 60 > i * 3) ? 1 : 0;
        block.opacity += (targetOpacity - block.opacity) * 0.1;
      });

      // Cycle animation
      if (frame % 180 === 0) {
        dagBlocksRef.current = initDAG(width, height, mobile);
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
            Consensus Architecture
          </h3>
          <p className="text-[9px] sm:text-xs" style={{ color: "var(--chrome-600)" }}>
            {isMobile ? "DAG vs Cluster consensus" : "Sui Mysticeti v2 (DAG) vs Aptos Archon (Cluster)"}
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
        style={{ height: isMobile ? "380px" : "300px" }}
      />

      {/* Architecture summary */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="p-2 rounded bg-[#6FBCF0]/10 border border-[#6FBCF0]/20">
          <div className="text-[10px] sm:text-xs font-bold" style={{ color: "#6FBCF0" }}>
            Mysticeti v2
          </div>
          <div className="text-[8px] sm:text-[10px] mt-1" style={{ color: "var(--chrome-500)" }}>
            Parallel proposals form DAG. Commit when certified by 2f+1 validators.
          </div>
          <div className="text-xs sm:text-sm font-bold mt-1" style={{ color: "#6FBCF0" }}>
            ~180ms
          </div>
        </div>
        <div className="p-2 rounded bg-[#00D9A5]/10 border border-[#00D9A5]/20">
          <div className="text-[10px] sm:text-xs font-bold" style={{ color: "#00D9A5" }}>
            Archon
          </div>
          <div className="text-[8px] sm:text-[10px] mt-1" style={{ color: "var(--chrome-500)" }}>
            Co-located cluster reaches consensus in ~5ms, then broadcasts once.
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
            ? " Mysticeti parallelizes proposals. Archon eliminates network latency within the cluster."
            : " Mysticeti achieves speed through parallel DAG proposals. Archon achieves 18× faster blocks by eliminating network latency—cluster nodes in same datacenter reach consensus in microseconds."
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
  colors: string[],
  mobile: boolean
) {
  const titleY = offsetY + (mobile ? 18 : 25);

  // Title
  ctx.fillStyle = "#6FBCF0";
  ctx.font = mobile ? "bold 9px system-ui" : "bold 11px system-ui";
  ctx.textAlign = "left";
  ctx.fillText("MYSTICETI v2", offsetX + padding, titleY);

  // Subtitle
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = mobile ? "6px system-ui" : "8px system-ui";
  ctx.textAlign = "right";
  ctx.fillText("DAG Parallel Consensus", offsetX + width - padding, titleY);

  // Draw DAG edges first
  ctx.strokeStyle = "rgba(111, 188, 240, 0.2)";
  ctx.lineWidth = 1;
  blocks.forEach(block => {
    if (block.opacity < 0.1) return;
    block.parents.forEach(parentId => {
      const parent = blocks[parentId];
      if (!parent || parent.opacity < 0.1) return;

      ctx.globalAlpha = Math.min(block.opacity, parent.opacity) * 0.5;
      ctx.beginPath();
      ctx.moveTo(offsetX + parent.x, offsetY + parent.y);
      ctx.lineTo(offsetX + block.x, offsetY + block.y);
      ctx.stroke();
    });
  });
  ctx.globalAlpha = 1;

  // Draw DAG nodes
  blocks.forEach(block => {
    if (block.opacity < 0.1) return;

    const color = colors[block.validator];
    const size = mobile ? 6 : 8;

    ctx.globalAlpha = block.opacity;

    // Committed glow
    if (block.committed) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
    }

    ctx.fillStyle = block.committed ? color : color + "80";
    ctx.beginPath();
    ctx.arc(offsetX + block.x, offsetY + block.y, size, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
  });
  ctx.globalAlpha = 1;

  // Validator legend
  const legendY = offsetY + height - (mobile ? 25 : 35);
  ctx.font = mobile ? "6px system-ui" : "7px system-ui";
  ctx.textAlign = "center";

  for (let i = 0; i < 4; i++) {
    const x = offsetX + padding + 20 + i * (mobile ? 35 : 45);
    ctx.fillStyle = colors[i];
    ctx.beginPath();
    ctx.arc(x, legendY, mobile ? 3 : 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillText(`V${i + 1}`, x, legendY + (mobile ? 10 : 12));
  }

  // "Parallel" annotation
  const annotY = offsetY + (mobile ? 35 : 45);
  ctx.fillStyle = "rgba(111, 188, 240, 0.6)";
  ctx.font = mobile ? "bold 7px system-ui" : "bold 8px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("← Parallel proposals →", offsetX + width / 2, annotY);
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
  mobile: boolean
) {
  const titleY = offsetY + (mobile ? 18 : 25);

  // Title
  ctx.fillStyle = "#00D9A5";
  ctx.font = mobile ? "bold 9px system-ui" : "bold 11px system-ui";
  ctx.textAlign = "left";
  ctx.fillText("ARCHON", offsetX + padding, titleY);

  // Subtitle
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = mobile ? "6px system-ui" : "8px system-ui";
  ctx.textAlign = "right";
  ctx.fillText("Co-located Cluster", offsetX + width - padding, titleY);

  const centerX = offsetX + width / 2;
  const centerY = offsetY + height / 2 + (mobile ? 5 : 10);
  const clusterRadius = mobile ? 25 : 35;
  const externalRadius = mobile ? 55 : 80;

  // Animation phase
  const phase = (frame % 90) / 90;
  const internalPhase = phase < 0.3 ? phase / 0.3 : 1;
  const externalPhase = phase > 0.3 ? (phase - 0.3) / 0.7 : 0;

  // Draw external validators ring
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

    ctx.fillStyle = "#00D9A5" + "60";
    ctx.beginPath();
    ctx.arc(x, y, mobile ? 5 : 7, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cluster background
  ctx.fillStyle = "rgba(0, 217, 165, 0.1)";
  ctx.beginPath();
  ctx.arc(centerX, centerY, clusterRadius + 10, 0, Math.PI * 2);
  ctx.fill();

  // "SAME DC" label
  ctx.fillStyle = "rgba(0, 217, 165, 0.4)";
  ctx.font = mobile ? "bold 6px system-ui" : "bold 7px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("SAME DC", centerX, centerY - clusterRadius - (mobile ? 15 : 20));

  // Cluster nodes
  const clusterCount = 5;
  const clusterNodes: { x: number; y: number }[] = [];
  for (let i = 0; i < clusterCount; i++) {
    const angle = (i / clusterCount) * Math.PI * 2 - Math.PI / 2;
    const x = centerX + Math.cos(angle) * clusterRadius;
    const y = centerY + Math.sin(angle) * clusterRadius;
    clusterNodes.push({ x, y });
  }

  // Internal consensus messages (fast)
  if (internalPhase > 0 && internalPhase < 1) {
    ctx.strokeStyle = "#00D9A5";
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;

    for (let i = 0; i < clusterCount; i++) {
      for (let j = i + 1; j < clusterCount; j++) {
        const progress = Math.min(internalPhase * 3, 1);
        const fromNode = clusterNodes[i];
        const toNode = clusterNodes[j];

        const dx = toNode.x - fromNode.x;
        const dy = toNode.y - fromNode.y;

        ctx.beginPath();
        ctx.moveTo(fromNode.x, fromNode.y);
        ctx.lineTo(fromNode.x + dx * progress, fromNode.y + dy * progress);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
  }

  // Draw cluster nodes (on top of messages)
  clusterNodes.forEach((node, i) => {
    ctx.shadowColor = "#00D9A5";
    ctx.shadowBlur = internalPhase >= 1 ? 12 : 6;
    ctx.fillStyle = "#00D9A5";
    ctx.beginPath();
    ctx.arc(node.x, node.y, mobile ? 6 : 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });

  // External broadcast (after internal consensus)
  if (externalPhase > 0) {
    ctx.strokeStyle = "#00D9A5";
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.5;

    externalNodes.forEach((extNode, i) => {
      const delay = i * 0.1;
      const progress = Math.max(0, Math.min((externalPhase - delay) * 2, 1));

      if (progress > 0) {
        const dx = extNode.x - centerX;
        const dy = extNode.y - centerY;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + dx * progress, centerY + dy * progress);
        ctx.stroke();
      }
    });
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
  }

  // Phase indicator
  const phaseY = offsetY + height - (mobile ? 25 : 30);
  ctx.font = mobile ? "bold 7px monospace" : "bold 9px monospace";
  ctx.textAlign = "center";

  if (phase < 0.3) {
    ctx.fillStyle = "#00D9A5";
    ctx.fillText("Internal: ~5ms", centerX, phaseY);
  } else {
    ctx.fillStyle = "rgba(0, 217, 165, 0.6)";
    ctx.fillText("Broadcast: 1 round", centerX, phaseY);
  }

  // Timing annotation
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.font = mobile ? "5px system-ui" : "6px system-ui";
  ctx.fillText("(vs N×N in traditional BFT)", centerX, phaseY + (mobile ? 10 : 12));
}
