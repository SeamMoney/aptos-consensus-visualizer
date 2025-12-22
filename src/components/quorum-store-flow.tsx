"use client";

import { useRef, useEffect, useState } from "react";

interface QuorumStoreFlowProps {
  tps: number;
}

interface Batch {
  id: number;
  x: number;
  stage: number; // 0=mempool, 1=batching, 2=dissemination, 3=consensus
  quorumProgress: number; // 0 to 1 (for dissemination stage)
  txCount: number;
}

const STAGES = [
  { name: "MEMPOOL", color: "#6B7280", x: 0.1 },
  { name: "BATCH", color: "#3B82F6", x: 0.3 },
  { name: "DISSEMINATE", color: "#F59E0B", x: 0.55 },
  { name: "CONSENSUS", color: "#00D9A5", x: 0.85 },
];

export function QuorumStoreFlow({ tps }: QuorumStoreFlowProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const batchesRef = useRef<Batch[]>([]);
  const batchIdRef = useRef<number>(0);
  const [batchCount, setBatchCount] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastTime = 0;
    let lastSpawnTime = 0;
    const targetFPS = 30;
    const frameInterval = 1000 / targetFPS;
    const spawnInterval = 800;

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

      // Clear
      ctx.fillStyle = "#0a0a0b";
      ctx.fillRect(0, 0, width, height);

      const pipeY = height / 2;
      const pipeHeight = 50;

      // Spawn new batch
      if (timestamp - lastSpawnTime > spawnInterval) {
        lastSpawnTime = timestamp;
        batchesRef.current.push({
          id: batchIdRef.current++,
          x: 0,
          stage: 0,
          quorumProgress: 0,
          txCount: 50 + Math.floor(Math.random() * 100),
        });
        setBatchCount(batchIdRef.current);
      }

      // Draw pipeline stages
      STAGES.forEach((stage, idx) => {
        const stageX = stage.x * width;
        const stageWidth = idx < 3 ? (STAGES[idx + 1].x - stage.x) * width - 10 : width * 0.12;

        // Stage background
        ctx.fillStyle = stage.color + "20";
        ctx.beginPath();
        ctx.roundRect(stageX, pipeY - pipeHeight / 2, stageWidth, pipeHeight, 8);
        ctx.fill();

        // Stage border
        ctx.strokeStyle = stage.color + "40";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(stageX, pipeY - pipeHeight / 2, stageWidth, pipeHeight, 8);
        ctx.stroke();

        // Stage label
        ctx.fillStyle = stage.color;
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(stage.name, stageX + stageWidth / 2, pipeY - pipeHeight / 2 - 10);

        // Arrow between stages
        if (idx < 3) {
          const arrowX = stageX + stageWidth + 5;
          ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
          ctx.beginPath();
          ctx.moveTo(arrowX, pipeY - 5);
          ctx.lineTo(arrowX + 8, pipeY);
          ctx.lineTo(arrowX, pipeY + 5);
          ctx.fill();
        }
      });

      // Limit max batches to prevent clutter
      if (batchesRef.current.length > 8) {
        batchesRef.current = batchesRef.current.slice(-8);
      }

      // Update and draw batches
      for (let i = batchesRef.current.length - 1; i >= 0; i--) {
        const batch = batchesRef.current[i];

        // Move batch through stages
        const targetX = STAGES[Math.min(batch.stage, 3)].x * width + 20;

        if (batch.x < targetX) {
          batch.x += 3; // Faster movement
        } else {
          if (batch.stage === 2) {
            batch.quorumProgress += 0.03;
            if (batch.quorumProgress >= 1) {
              batch.stage++;
            }
          } else if (batch.stage < 3) {
            batch.stage++;
          } else {
            if (batch.x > width * 0.92) {
              batchesRef.current.splice(i, 1);
              continue;
            }
            batch.x += 3;
          }
        }

        // Draw batch - smaller, cleaner
        const batchSize = 12 + batch.txCount / 20;
        const batchY = pipeY;

        // Glow
        ctx.beginPath();
        const gradient = ctx.createRadialGradient(batch.x, batchY, 0, batch.x, batchY, batchSize);
        const stageColor = STAGES[Math.min(batch.stage, 3)].color;
        gradient.addColorStop(0, stageColor);
        gradient.addColorStop(0.5, stageColor + "60");
        gradient.addColorStop(1, "transparent");
        ctx.fillStyle = gradient;
        ctx.arc(batch.x, batchY, batchSize, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.fillStyle = "#fff";
        ctx.arc(batch.x, batchY, 4, 0, Math.PI * 2);
        ctx.fill();

        // Only show quorum progress for dissemination stage (no TX labels to avoid clutter)
        if (batch.stage === 2 && batch.quorumProgress < 1) {
          const barWidth = 30;
          const barHeight = 4;
          const barX = batch.x - barWidth / 2;
          const barY = batchY - batchSize - 8;

          ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
          ctx.beginPath();
          ctx.roundRect(barX, barY, barWidth, barHeight, 2);
          ctx.fill();

          ctx.fillStyle = batch.quorumProgress >= 0.67 ? "#10B981" : "#F59E0B";
          ctx.beginPath();
          ctx.roundRect(barX, barY, barWidth * batch.quorumProgress, barHeight, 2);
          ctx.fill();
        }
      }

      // Title
      ctx.fillStyle = "#F59E0B";
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("Quorum Store - Data Availability", 20, 25);

      // Stats
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.font = "10px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`Batches: ${batchCount}`, width - 20, 25);

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);

    return () => cancelAnimationFrame(animationRef.current);
  }, [tps]);

  return (
    <div className="chrome-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="section-title">Quorum Store</h3>
          <p className="text-xs" style={{ color: "var(--chrome-600)" }}>
            Batch dissemination for data availability (2/3 quorum)
          </p>
        </div>
        <div className="text-xs font-mono" style={{ color: "var(--chrome-500)" }}>
          Narwhal-based batching
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full rounded"
        style={{ height: "160px" }}
      />
    </div>
  );
}
