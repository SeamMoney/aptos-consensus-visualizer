"use client";

import { useRef, useEffect, useMemo } from "react";
import { BlockStats, ConsensusStats } from "@/hooks/useAptosStream";

interface ConsensusFlowProps {
  recentBlocks: BlockStats[];
  consensus: ConsensusStats | null;
}

interface BlockParticle {
  blockHeight: number;
  txCount: number;
  blockTimeMs: number;
  startTime: number;
}

export function ConsensusFlow({ recentBlocks, consensus }: ConsensusFlowProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const particlesRef = useRef<BlockParticle[]>([]);
  const lastBlockRef = useRef<number>(0);

  // Calculate actual stats
  const { avgBlockTime, latestBlockTime } = useMemo(() => {
    if (recentBlocks.length === 0) return { avgBlockTime: 94, latestBlockTime: 94 };

    const avg = Math.round(
      recentBlocks.slice(0, 10).reduce((sum, b) => sum + b.blockTimeMs, 0) /
        Math.min(recentBlocks.length, 10)
    );
    const latest = Math.round(recentBlocks[0]?.blockTimeMs || 94);

    return { avgBlockTime: avg, latestBlockTime: latest };
  }, [recentBlocks]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastTime = 0;
    const targetFPS = 15; // Low FPS for smoother performance
    const frameInterval = 1000 / targetFPS;

    // Stage definitions
    const stages = [
      { label: "PROPOSE", color: "#10b981" },
      { label: "VOTE", color: "#3b82f6" },
      { label: "CERTIFY", color: "#8b5cf6" },
      { label: "COMMIT", color: "#f59e0b" },
    ];

    const render = (timestamp: number) => {
      // Throttle FPS
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

      ctx.clearRect(0, 0, width, height);

      // Calculate stage positions
      const stagePositions = stages.map((_, i) => ({
        x: width * (0.12 + i * 0.25),
        y: height * 0.5,
      }));

      // Draw connection line
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(stagePositions[0].x, stagePositions[0].y);
      stagePositions.forEach((pos) => ctx.lineTo(pos.x, pos.y));
      ctx.stroke();

      // Draw stage circles
      stages.forEach((stage, i) => {
        const pos = stagePositions[i];

        // Circle
        ctx.beginPath();
        const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 20);
        gradient.addColorStop(0, stage.color);
        gradient.addColorStop(1, `${stage.color}30`);
        ctx.fillStyle = gradient;
        ctx.arc(pos.x, pos.y, 16, 0, Math.PI * 2);
        ctx.fill();

        // Number
        ctx.fillStyle = "#000";
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(i + 1), pos.x, pos.y);

        // Label
        ctx.fillStyle = stage.color;
        ctx.font = "bold 8px monospace";
        ctx.fillText(stage.label, pos.x, pos.y + 30);

        // Timing between stages
        if (i < stages.length - 1) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
          ctx.font = "7px monospace";
          const midX = (stagePositions[i].x + stagePositions[i + 1].x) / 2;
          ctx.fillText("~25ms", midX, pos.y - 18);
        }
      });

      const now = Date.now();

      // Add new particle for new blocks
      const currentBlock = recentBlocks[0];
      if (currentBlock && currentBlock.blockHeight > lastBlockRef.current) {
        particlesRef.current.push({
          blockHeight: currentBlock.blockHeight,
          txCount: currentBlock.txCount,
          blockTimeMs: currentBlock.blockTimeMs,
          startTime: now,
        });
        // Keep max 5 particles
        if (particlesRef.current.length > 5) {
          particlesRef.current.shift();
        }
        lastBlockRef.current = currentBlock.blockHeight;
      }

      // Draw particles - SLOWER animation (500ms per stage = 2 seconds total)
      const timePerStage = 500; // 500ms per stage
      const totalTime = timePerStage * 4;

      particlesRef.current = particlesRef.current.filter((p) => {
        const elapsed = now - p.startTime;

        if (elapsed > totalTime + 300) {
          return false; // Remove after completion
        }

        // Calculate position
        const progress = Math.min(elapsed / totalTime, 1);
        const stageFloat = progress * 4;
        const currentStage = Math.min(Math.floor(stageFloat), 3);
        const stageProgress = stageFloat - currentStage;

        const fromPos = stagePositions[currentStage];
        const toPos = stagePositions[Math.min(currentStage + 1, 3)];
        const x = fromPos.x + (toPos.x - fromPos.x) * stageProgress;
        const y = fromPos.y;

        // Particle size based on tx count
        const size = 4 + Math.min(p.txCount / 15, 4);

        // Color based on current stage
        const color = stages[currentStage].color;

        // Draw trail
        ctx.beginPath();
        ctx.strokeStyle = `${color}40`;
        ctx.lineWidth = 2;
        ctx.moveTo(fromPos.x, y);
        ctx.lineTo(x, y);
        ctx.stroke();

        // Draw particle
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();

        // Glow
        ctx.beginPath();
        const glow = ctx.createRadialGradient(x, y, 0, x, y, size + 6);
        glow.addColorStop(0, `${color}50`);
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.arc(x, y, size + 6, 0, Math.PI * 2);
        ctx.fill();

        // Block info label (only for latest particle)
        if (p === particlesRef.current[particlesRef.current.length - 1] && elapsed < totalTime) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
          ctx.font = "7px monospace";
          ctx.textAlign = "center";
          ctx.fillText(`#${p.blockHeight}`, x, y - 14);
          ctx.fillText(`${p.txCount} tx`, x, y + 18);
        }

        return true;
      });

      // Title
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.fillText("BABY RAPTR CONSENSUS", width / 2, 14);

      // Footer
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.font = "8px monospace";
      ctx.fillText(`4 Network Hops | ${avgBlockTime}ms avg block time`, width / 2, height - 8);

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [recentBlocks, avgBlockTime]);

  const latestBlock = recentBlocks[0];
  const voteParticipation = consensus?.voteParticipation ?? 100;

  return (
    <div className="bg-black/30 rounded-xl p-4 border border-white/10">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-white/80">Consensus Pipeline</h3>
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-emerald-400">
            {latestBlock?.txCount || 0} txns
          </span>
          <span className="text-blue-400">
            {voteParticipation}% voted
          </span>
          <span className="text-purple-400">
            {latestBlockTime}ms
          </span>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ height: "120px" }}
      />
    </div>
  );
}
