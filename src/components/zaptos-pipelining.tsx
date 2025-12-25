"use client";

import { useRef, useEffect, useState, memo } from "react";
import { useVisibility } from "@/hooks/useVisibility";
import { Tooltip, LearnMoreLink } from "@/components/ui/tooltip";
import { glossary } from "@/data/glossary";

/**
 * Zaptos: Parallel Pipelined Architecture
 *
 * Shows how Aptos overlaps multiple stages:
 * - Consensus (proposing/voting)
 * - Execution (Block-STM parallel processing)
 * - Certification (signing state roots)
 * - Storage (persisting to disk)
 *
 * Multiple blocks are processed simultaneously at different stages.
 */

interface PipelineBlock {
  id: number;
  round: number;
  stages: {
    consensus: number; // 0-1 progress
    execution: number;
    certification: number;
    storage: number;
  };
  color: string;
}

const STAGES = [
  {
    name: "CONSENSUS",
    color: "#3B82F6",
    desc: "Block proposed and voted on",
    detail: "Raptr 4-hop BFT",
  },
  {
    name: "EXECUTION",
    color: "#10B981",
    desc: "Block-STM parallel processing",
    detail: "Optimistic MVCC",
  },
  {
    name: "CERTIFY",
    color: "#F59E0B",
    desc: "State root signatures aggregated",
    detail: "Threshold signing",
  },
  {
    name: "STORAGE",
    color: "#EF4444",
    desc: "State committed to disk",
    detail: "JMT persistence",
  },
];

const BLOCK_COLORS = ["#00D9A5", "#3B82F6", "#F59E0B", "#A855F7", "#EF4444"];

export const ZaptosPipelining = memo(function ZaptosPipelining() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const blocksRef = useRef<PipelineBlock[]>([]);
  const [currentRound, setCurrentRound] = useState(1);
  const roundTimerRef = useRef(0);
  const blockIdRef = useRef(0);
  const isVisible = useVisibility(containerRef);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Initialize with some blocks in pipeline
    if (blocksRef.current.length === 0) {
      for (let i = 0; i < 4; i++) {
        blocksRef.current.push({
          id: blockIdRef.current++,
          round: i + 1,
          stages: {
            consensus: i >= 0 ? 1 : 0,
            execution: i >= 1 ? 1 : 0,
            certification: i >= 2 ? 1 : 0,
            storage: i >= 3 ? 1 : 0,
          },
          color: BLOCK_COLORS[i % BLOCK_COLORS.length],
        });
      }
    }

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

      // Round timer - advance pipeline
      roundTimerRef.current++;
      const roundDuration = 60;

      if (roundTimerRef.current > roundDuration) {
        roundTimerRef.current = 0;
        setCurrentRound((r) => r + 1);

        // Advance all blocks in pipeline
        blocksRef.current.forEach((block) => {
          if (block.stages.storage < 1) {
            if (block.stages.certification >= 1) block.stages.storage = 0;
            if (block.stages.execution >= 1) block.stages.certification = 0;
            if (block.stages.consensus >= 1) block.stages.execution = 0;
          }
        });

        // Add new block
        const newBlock: PipelineBlock = {
          id: blockIdRef.current++,
          round: currentRound + 1,
          stages: {
            consensus: 0,
            execution: 0,
            certification: 0,
            storage: 0,
          },
          color: BLOCK_COLORS[blockIdRef.current % BLOCK_COLORS.length],
        };
        blocksRef.current.push(newBlock);

        // Remove fully completed blocks
        blocksRef.current = blocksRef.current.filter(
          (b) => b.stages.storage < 1 || b.id >= blockIdRef.current - 5
        );
      }

      // Animate block progress
      const progressSpeed = 0.03;
      blocksRef.current.forEach((block) => {
        // Progress through stages
        if (block.stages.consensus < 1) {
          block.stages.consensus = Math.min(1, block.stages.consensus + progressSpeed);
        } else if (block.stages.execution < 1) {
          block.stages.execution = Math.min(1, block.stages.execution + progressSpeed);
        } else if (block.stages.certification < 1) {
          block.stages.certification = Math.min(1, block.stages.certification + progressSpeed);
        } else if (block.stages.storage < 1) {
          block.stages.storage = Math.min(1, block.stages.storage + progressSpeed);
        }
      });

      // Layout
      const stageHeight = (height - 80) / 4;
      const pipelineLeft = 100;
      const pipelineRight = width - 30;
      const pipelineWidth = pipelineRight - pipelineLeft;

      // Draw stage lanes
      STAGES.forEach((stage, i) => {
        const y = 50 + i * stageHeight;

        // Stage background
        ctx.fillStyle = stage.color + "08";
        ctx.fillRect(pipelineLeft, y, pipelineWidth, stageHeight - 5);

        // Stage border
        ctx.strokeStyle = stage.color + "30";
        ctx.lineWidth = 1;
        ctx.strokeRect(pipelineLeft, y, pipelineWidth, stageHeight - 5);

        // Stage label on left
        ctx.fillStyle = stage.color;
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(stage.name, pipelineLeft - 10, y + stageHeight / 2 - 2);

        // Stage detail
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.font = "7px monospace";
        ctx.fillText(stage.detail, pipelineLeft - 10, y + stageHeight / 2 + 10);
      });

      // Draw blocks in pipeline
      const visibleBlocks = blocksRef.current.slice(-6);
      visibleBlocks.forEach((block, idx) => {
        // Determine which stage(s) this block is in
        const stages = block.stages;
        const blockWidth = 50;
        const blockHeight = stageHeight - 20;

        // Draw block in each active stage
        [
          { progress: stages.consensus, stageIdx: 0 },
          { progress: stages.execution, stageIdx: 1 },
          { progress: stages.certification, stageIdx: 2 },
          { progress: stages.storage, stageIdx: 3 },
        ].forEach(({ progress, stageIdx }) => {
          if (progress > 0 && progress <= 1) {
            const stageY = 50 + stageIdx * stageHeight;
            const blockX = pipelineLeft + 10 + progress * (pipelineWidth - blockWidth - 20);

            // Block shadow/glow
            ctx.fillStyle = block.color + "30";
            ctx.beginPath();
            ctx.roundRect(blockX - 2, stageY + 10 - 2, blockWidth + 4, blockHeight + 4, 6);
            ctx.fill();

            // Block body
            const gradient = ctx.createLinearGradient(blockX, stageY, blockX, stageY + blockHeight);
            gradient.addColorStop(0, block.color);
            gradient.addColorStop(1, block.color + "80");
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.roundRect(blockX, stageY + 10, blockWidth, blockHeight, 4);
            ctx.fill();

            // Block label
            ctx.fillStyle = "#000";
            ctx.font = "bold 9px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(`B${block.round}`, blockX + blockWidth / 2, stageY + 10 + blockHeight / 2);

            // Progress indicator within stage
            if (progress < 1) {
              ctx.fillStyle = "rgba(255,255,255,0.3)";
              ctx.fillRect(blockX, stageY + blockHeight + 8, blockWidth, 2);
              ctx.fillStyle = "#fff";
              ctx.fillRect(blockX, stageY + blockHeight + 8, blockWidth * progress, 2);
            }
          }
        });
      });

      // Pipeline flow arrows
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);

      for (let i = 0; i < 3; i++) {
        const y1 = 50 + i * stageHeight + stageHeight - 5;
        const y2 = 50 + (i + 1) * stageHeight;
        ctx.beginPath();
        ctx.moveTo(width / 2, y1);
        ctx.lineTo(width / 2, y2);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Title
      ctx.fillStyle = "#00D9A5";
      ctx.font = "bold 11px system-ui";
      ctx.textAlign = "left";
      ctx.fillText("ZAPTOS: PARALLEL PIPELINE", 15, 20);

      // Pipeline stats
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "9px monospace";
      ctx.textAlign = "right";
      const inPipeline = blocksRef.current.filter((b) => b.stages.storage < 1).length;
      ctx.fillText(`${inPipeline} blocks in pipeline`, width - 15, 20);

      // Round indicator
      ctx.fillStyle = "#00D9A5";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`Round ${currentRound}`, 15, 38);

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationRef.current);
  }, [currentRound, isVisible]);

  return (
    <div ref={containerRef} className="chrome-card p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="section-title">
            <Tooltip eli5={glossary.zaptos.eli5} technical={glossary.zaptos.technical} link={glossary.zaptos.link}>Zaptos</Tooltip>: Parallel Pipeline
            <LearnMoreLink href={glossary.zaptos.link} label="Docs" />
          </h3>
          <p className="text-xs" style={{ color: "var(--chrome-600)" }}>
            Multiple blocks processed simultaneously at different stages
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono" style={{ color: "var(--chrome-500)" }}>
          <span>Round:</span>
          <span style={{ color: "#00D9A5" }}>{currentRound}</span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full rounded"
        style={{ height: "320px" }}
      />

      {/* Stage descriptions */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {STAGES.map((stage, i) => (
          <div
            key={stage.name}
            className="p-2 rounded bg-white/5 border-l-2"
            style={{ borderColor: stage.color }}
          >
            <div className="text-xs font-bold mb-1" style={{ color: stage.color }}>
              {stage.name}
            </div>
            <p className="text-[10px]" style={{ color: "var(--chrome-500)" }}>
              {stage.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Key insight */}
      <div className="mt-3 p-2 rounded bg-white/5">
        <p className="text-xs" style={{ color: "var(--chrome-500)" }}>
          <span className="font-bold" style={{ color: "#00D9A5" }}>Key Innovation:</span>
          {" "}Unlike sequential processing, Zaptos overlaps consensus, execution, certification, and storage. While block N is being stored, block N+1 is certifying, N+2 is executing, and N+3 is in consensus.
        </p>
      </div>
    </div>
  );
});
