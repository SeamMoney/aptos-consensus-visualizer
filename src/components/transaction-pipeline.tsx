"use client";

import { useRef, useEffect, useMemo, useState, memo } from "react";
import { BlockStats, ConsensusStats } from "@/hooks/useAptosStream";
import { useVisibility } from "@/hooks/useVisibility";

interface TransactionPipelineProps {
  recentBlocks: BlockStats[];
  consensus: ConsensusStats | null;
  avgBlockTime: number;
}

// For the educational pipelining animation
interface PipelineBlock {
  id: number;
  stage: number; // 0-4 for each stage
  progress: number; // 0-1 within stage
  color: string;
}

// Raptr consensus stages
const STAGES = [
  { id: "submit", label: "SUBMIT", color: "#00D9A5", description: "TX received" },
  { id: "propose", label: "PROPOSE", color: "#6FBCF0", description: "Leader proposes" },
  { id: "vote", label: "VOTE", color: "#F59E0B", description: "Validators vote" },
  { id: "certify", label: "CERTIFY", color: "#A855F7", description: "QC formed" },
  { id: "commit", label: "COMMIT", color: "#00D9A5", description: "Finalized" },
];

interface Transaction {
  id: number;
  x: number;
  y: number;
  stage: number;
  speed: number;
  size: number;
  startTime: number;
  blockHeight: number;
}

export const TransactionPipeline = memo(function TransactionPipeline({
  recentBlocks,
  consensus,
  avgBlockTime,
}: TransactionPipelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const eduCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const eduAnimationRef = useRef<number>(0);
  const transactionsRef = useRef<Transaction[]>([]);
  const txIdRef = useRef(0);
  const lastBlockHeightRef = useRef(0);
  const isVisible = useVisibility(containerRef);

  // Educational animation state
  const pipelineBlocksRef = useRef<PipelineBlock[]>([]);
  const pipelineBlockIdRef = useRef(0);
  const [activeBlocks, setActiveBlocks] = useState(0);

  // Get the latest block info
  const latestBlock = recentBlocks[0];
  const currentRound = consensus?.round ?? latestBlock?.round ?? 0;
  const currentEpoch = consensus?.epoch ?? latestBlock?.epoch ?? 0;
  const currentProposer = consensus?.currentProposer ?? latestBlock?.proposer ?? "";

  // Calculate real finality estimate
  const estimatedFinality = Math.round(avgBlockTime * 5);

  // Spawn transactions when new blocks arrive
  useEffect(() => {
    if (!latestBlock) return;

    // Check if this is a new block
    if (latestBlock.blockHeight > lastBlockHeightRef.current) {
      const txCount = latestBlock.txCount;
      const now = Date.now();

      // Spawn particles based on actual tx count (max 20 for performance)
      const particlesToSpawn = Math.min(txCount, 20);

      for (let i = 0; i < particlesToSpawn; i++) {
        txIdRef.current++;
        transactionsRef.current.push({
          id: txIdRef.current,
          x: 0, // Will be set in render
          y: 0,
          stage: 0,
          speed: 1.2 + Math.random() * 0.8,
          size: 3 + Math.random() * 2,
          startTime: now + i * 30, // Stagger spawn times
          blockHeight: latestBlock.blockHeight,
        });
      }

      lastBlockHeightRef.current = latestBlock.blockHeight;
    }
  }, [latestBlock]);

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
      const now = Date.now();

      // Clear
      ctx.fillStyle = "#0a0a0b";
      ctx.fillRect(0, 0, width, height);

      // Pipeline layout - responsive for mobile
      const pipelineY = height * 0.5;
      const pipelineStartX = Math.max(10, width * 0.08); // Responsive start
      const pipelineEndX = width - Math.max(10, width * 0.03); // Responsive end
      const pipelineWidth = pipelineEndX - pipelineStartX;
      const stageWidth = pipelineWidth / STAGES.length;
      const pipeHeight = 40;

      // Draw stage backgrounds
      STAGES.forEach((stage, i) => {
        const x = pipelineStartX + i * stageWidth;

        // Stage background
        ctx.fillStyle = stage.color + "15";
        ctx.fillRect(x, pipelineY - pipeHeight / 2, stageWidth - 2, pipeHeight);

        // Stage border
        ctx.strokeStyle = stage.color + "40";
        ctx.lineWidth = 1;
        ctx.strokeRect(x, pipelineY - pipeHeight / 2, stageWidth - 2, pipeHeight);

        // Stage label
        ctx.fillStyle = stage.color;
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(stage.label, x + stageWidth / 2 - 1, pipelineY - pipeHeight / 2 - 15);

        // Stage description
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.font = "8px monospace";
        ctx.fillText(stage.description, x + stageWidth / 2 - 1, pipelineY + pipeHeight / 2 + 12);

        // Connection arrow (except last)
        if (i < STAGES.length - 1) {
          const arrowX = x + stageWidth - 1;
          ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
          ctx.beginPath();
          ctx.moveTo(arrowX - 4, pipelineY - 5);
          ctx.lineTo(arrowX + 4, pipelineY);
          ctx.lineTo(arrowX - 4, pipelineY + 5);
          ctx.closePath();
          ctx.fill();
        }
      });

      // Update and draw transactions
      transactionsRef.current = transactionsRef.current.filter((tx) => {
        const elapsed = now - tx.startTime;
        if (elapsed < 0) return true; // Not started yet

        // Move transaction - scale speed based on pipeline width for consistent timing
        const speedScale = pipelineWidth / 400; // Normalize to base width
        tx.x = pipelineStartX + (elapsed / 1000) * tx.speed * 60 * speedScale;

        // Clamp to pipeline bounds for visual consistency
        tx.x = Math.min(tx.x, pipelineEndX + 10);

        // Determine current stage
        const relativeX = tx.x - pipelineStartX;
        tx.stage = Math.max(0, Math.min(4, Math.floor(relativeX / stageWidth)));

        // Remove if past pipeline
        if (tx.x > pipelineEndX + 5) {
          return false;
        }

        // Get stage color
        const stageColor = STAGES[tx.stage]?.color || "#00D9A5";

        // Calculate y position (slight wave)
        const y = pipelineY + Math.sin(tx.id * 0.5 + elapsed / 200) * (pipeHeight * 0.25);

        // Glow
        ctx.beginPath();
        const glow = ctx.createRadialGradient(tx.x, y, 0, tx.x, y, tx.size * 2.5);
        glow.addColorStop(0, stageColor + "80");
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.arc(tx.x, y, tx.size * 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.fillStyle = stageColor;
        ctx.arc(tx.x, y, tx.size, 0, Math.PI * 2);
        ctx.fill();

        // Center dot
        ctx.beginPath();
        ctx.fillStyle = "#fff";
        ctx.arc(tx.x, y, tx.size * 0.4, 0, Math.PI * 2);
        ctx.fill();

        return true;
      });

      // Title
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "left";
      ctx.fillText("RAPTR CONSENSUS PIPELINE", pipelineStartX, 18);

      // Stats - show real data
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.font = "9px monospace";
      ctx.textAlign = "right";

      if (latestBlock) {
        ctx.fillText(
          `Block ${latestBlock.blockHeight} · ${latestBlock.txCount} TXs`,
          pipelineEndX,
          18
        );
      }

      // Timing info
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.font = "9px monospace";
      ctx.textAlign = "center";
      ctx.fillText(
        `Round ${currentRound} · Epoch ${currentEpoch} · ~${avgBlockTime}ms block time · ~${estimatedFinality}ms finality`,
        width / 2,
        height - 10
      );

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [avgBlockTime, estimatedFinality, currentRound, currentEpoch, latestBlock, isVisible]);

  // Educational animation - pipelining visualization
  useEffect(() => {
    const canvas = eduCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastTime = 0;
    let frameCount = 0;
    const targetFPS = 30;
    const frameInterval = 1000 / targetFPS;

    const blockColors = ["#00D9A5", "#6FBCF0", "#F59E0B", "#A855F7", "#EC4899"];

    const render = (timestamp: number) => {
      // Skip rendering when off-screen
      if (!isVisible) {
        eduAnimationRef.current = requestAnimationFrame(render);
        return;
      }

      if (timestamp - lastTime < frameInterval) {
        eduAnimationRef.current = requestAnimationFrame(render);
        return;
      }
      lastTime = timestamp;
      frameCount++;

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

      const stageHeight = 22;
      const stageGap = 4;
      const startY = 30;
      const stageWidth = width - 85;
      const stageStartX = 75;

      // Spawn new block every ~40 frames
      if (frameCount % 40 === 0 && pipelineBlocksRef.current.length < 8) {
        pipelineBlocksRef.current.push({
          id: pipelineBlockIdRef.current++,
          stage: 0,
          progress: 0,
          color: blockColors[pipelineBlockIdRef.current % blockColors.length],
        });
      }

      // Draw stage labels
      const stageLabels = ["SUBMIT", "PROPOSE", "VOTE", "CERTIFY", "COMMIT"];
      stageLabels.forEach((label, i) => {
        const y = startY + i * (stageHeight + stageGap);
        ctx.fillStyle = STAGES[i].color;
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "right";
        ctx.fillText(label, stageStartX - 8, y + stageHeight / 2 + 3);

        // Stage track
        ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
        ctx.beginPath();
        ctx.roundRect(stageStartX, y, stageWidth, stageHeight, 4);
        ctx.fill();
      });

      // Update and draw blocks
      let activeCount = 0;
      pipelineBlocksRef.current = pipelineBlocksRef.current.filter(block => {
        block.progress += 0.015;

        if (block.progress >= 1) {
          block.stage++;
          block.progress = 0;
        }

        if (block.stage >= 5) return false;

        activeCount++;

        const y = startY + block.stage * (stageHeight + stageGap);
        const x = stageStartX + block.progress * stageWidth;
        const blockWidth = 30;

        // Draw block trail
        ctx.fillStyle = block.color + "20";
        ctx.beginPath();
        ctx.roundRect(stageStartX, y + 2, x - stageStartX, stageHeight - 4, 3);
        ctx.fill();

        // Draw block
        ctx.fillStyle = block.color;
        ctx.beginPath();
        ctx.roundRect(x - blockWidth / 2, y + 2, blockWidth, stageHeight - 4, 3);
        ctx.fill();

        // Block label
        ctx.fillStyle = "#000";
        ctx.font = "bold 8px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`B${block.id}`, x, y + stageHeight / 2 + 3);

        return true;
      });

      setActiveBlocks(activeCount);

      // Title
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      ctx.font = "bold 10px system-ui";
      ctx.textAlign = "left";
      ctx.fillText("PIPELINING: Multiple blocks in flight", stageStartX, 18);

      // Legend
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.font = "9px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`${activeCount} blocks active`, width - 10, 18);

      eduAnimationRef.current = requestAnimationFrame(render);
    };

    eduAnimationRef.current = requestAnimationFrame(render);

    return () => cancelAnimationFrame(eduAnimationRef.current);
  }, [isVisible]);

  return (
    <div ref={containerRef} className="chrome-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="section-title">Transaction Pipeline</h3>
          <p className="text-xs" style={{ color: "var(--chrome-600)" }}>
            Raptr 4-hop consensus · Particles spawn from real blocks
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono">
          {latestBlock && (
            <>
              <span style={{ color: "var(--chrome-500)" }}>
                Block: <span style={{ color: "#00D9A5" }}>{latestBlock.blockHeight}</span>
              </span>
              <span style={{ color: "var(--chrome-500)" }}>
                TXs: <span style={{ color: "#00D9A5" }}>{latestBlock.txCount}</span>
              </span>
            </>
          )}
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full rounded"
        style={{ height: "140px" }}
      />

      {/* Educational Panel */}
      <div className="mt-4 p-3 sm:p-4 rounded-lg bg-white/5 border border-white/10">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-4">
          {/* Animated Pipelining Diagram */}
          <div className="w-full sm:w-auto sm:flex-shrink-0">
            <canvas
              ref={eduCanvasRef}
              className="rounded w-full sm:w-[300px]"
              style={{ height: "180px" }}
            />
          </div>

          {/* Explanation */}
          <div className="flex-1 min-w-0 w-full">
            <h4 className="text-sm font-bold mb-2" style={{ color: "#00D9A5" }}>
              The 4-Hop Journey
            </h4>

            <div className="space-y-1.5 text-xs" style={{ color: "var(--chrome-400)" }}>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#00D9A5" }} />
                <span><strong>SUBMIT:</strong> TX enters mempool</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#6FBCF0" }} />
                <span><strong>PROPOSE:</strong> Leader bundles into block</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#F59E0B" }} />
                <span><strong>VOTE:</strong> Validators verify & sign (2f+1)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#A855F7" }} />
                <span><strong>CERTIFY:</strong> Quorum Certificate formed</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#00D9A5" }} />
                <span><strong>COMMIT:</strong> Block finalized</span>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-white/10 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: "var(--chrome-500)" }}>
                  <span className="font-semibold" style={{ color: "#00D9A5" }}>Why so fast?</span> Pipelining!
                </span>
                <span className="font-mono" style={{ color: "var(--chrome-600)" }}>
                  ~{estimatedFinality}ms finality
                </span>
              </div>
              <p className="text-xs" style={{ color: "var(--chrome-500)" }}>
                Multiple blocks process concurrently through all stages, not sequentially.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
