"use client";

import { useRef, useEffect, useMemo } from "react";
import { BlockStats, ConsensusStats } from "@/hooks/useAptosStream";

interface TransactionPipelineProps {
  recentBlocks: BlockStats[];
  consensus: ConsensusStats | null;
  avgBlockTime: number;
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

export function TransactionPipeline({
  recentBlocks,
  consensus,
  avgBlockTime,
}: TransactionPipelineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const transactionsRef = useRef<Transaction[]>([]);
  const txIdRef = useRef(0);
  const lastBlockHeightRef = useRef(0);

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

      // Pipeline layout
      const pipelineY = height * 0.5;
      const pipelineStartX = 60;
      const pipelineEndX = width - 30;
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

        // Move transaction
        tx.x = pipelineStartX + (elapsed / 1000) * tx.speed * 80;

        // Determine current stage
        const relativeX = tx.x - pipelineStartX;
        tx.stage = Math.max(0, Math.min(4, Math.floor(relativeX / stageWidth)));

        // Remove if past pipeline
        if (tx.x > pipelineEndX + 30) {
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
  }, [avgBlockTime, estimatedFinality, currentRound, currentEpoch, latestBlock]);

  return (
    <div className="chrome-card p-4">
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
    </div>
  );
}
