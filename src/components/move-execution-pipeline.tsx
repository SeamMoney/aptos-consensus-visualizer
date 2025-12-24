"use client";

import { useRef, useEffect, useState, memo } from "react";
import { useVisibility } from "@/hooks/useVisibility";

/**
 * Move Execution Pipeline - Mobile-optimized
 */

interface Transaction {
  id: number;
  x: number;
  y: number;
  stage: "pending" | "loading" | "executing" | "validating" | "committing" | "done";
  worker: number;
  moduleHit: "L1" | "L2" | "L3" | "storage";
  color: string;
  progress: number;
}

const PIPELINE_STAGES = [
  { id: "module", name: "MODULE", short: "MOD", color: "#A855F7", x: 0.08 },
  { id: "tx", name: "TX", short: "TX", color: "#3B82F6", x: 0.26 },
  { id: "blockstm", name: "BLOCK-STM", short: "STM", color: "#00D9A5", x: 0.44 },
  { id: "loader", name: "LOADER", short: "L2", color: "#F59E0B", x: 0.62 },
  { id: "state", name: "STATE", short: "ST", color: "#EF4444", x: 0.80 },
];

const PHASES = [
  { phase: 1, title: "Module Definition", desc: "Move module defines entry functions" },
  { phase: 2, title: "TX Submitted", desc: "User calls entry function" },
  { phase: 3, title: "Block-STM", desc: "Parallel execution with MVCC" },
  { phase: 4, title: "Loader V2", desc: "Cache lookup: L1→L2→L3" },
  { phase: 5, title: "Validation", desc: "Check for conflicts" },
  { phase: 6, title: "Commit", desc: "Write-set applied" },
];

const TX_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#A855F7", "#00D9A5"];

export const MoveExecutionPipeline = memo(function MoveExecutionPipeline() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const transactionsRef = useRef<Transaction[]>([]);
  const [currentPhase, setCurrentPhase] = useState(0);
  const phaseTimerRef = useRef(0);
  const txIdRef = useRef(0);
  const isVisible = useVisibility(containerRef);
  const [isMobile, setIsMobile] = useState(false);

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

      // Clear
      ctx.fillStyle = "#0a0a0b";
      ctx.fillRect(0, 0, width, height);

      // Phase timer
      phaseTimerRef.current++;
      if (phaseTimerRef.current > 80) {
        phaseTimerRef.current = 0;
        const nextPhase = (currentPhase + 1) % 6;
        setCurrentPhase(nextPhase);

        if (nextPhase === 1) {
          const hitRand = Math.random();
          const moduleHit: "L1" | "L2" | "L3" | "storage" =
            hitRand < 0.90 ? "L1" : hitRand < 0.98 ? "L2" : hitRand < 0.999 ? "L3" : "storage";

          transactionsRef.current.push({
            id: txIdRef.current++,
            x: width * 0.15,
            y: height * 0.5,
            stage: "pending",
            worker: Math.floor(Math.random() * 4),
            moduleHit,
            color: TX_COLORS[txIdRef.current % TX_COLORS.length],
            progress: 0,
          });
        }
      }

      // Draw pipeline stages
      const stageY = mobile ? 35 : 45;
      const stageHeight = height - (mobile ? 70 : 90);
      const stageWidth = mobile ? width * 0.16 : width * 0.15;
      const padding = mobile ? 5 : 10;

      PIPELINE_STAGES.forEach((stage, i) => {
        const x = padding + i * ((width - padding * 2) / 5);

        const isActive = currentPhase === i || currentPhase === i + 1;
        ctx.fillStyle = stage.color + (isActive ? "20" : "08");
        ctx.beginPath();
        ctx.roundRect(x, stageY, stageWidth, stageHeight, mobile ? 4 : 6);
        ctx.fill();

        ctx.strokeStyle = stage.color + (isActive ? "80" : "30");
        ctx.lineWidth = isActive ? 2 : 1;
        ctx.stroke();

        // Label - use short names on mobile
        ctx.fillStyle = stage.color;
        ctx.font = mobile ? "bold 7px monospace" : "bold 9px monospace";
        ctx.textAlign = "center";
        ctx.fillText(mobile ? stage.short : stage.name, x + stageWidth / 2, stageY + (mobile ? 12 : 16));

        // Internal details (simplified on mobile)
        if (stage.id === "blockstm") {
          const numWorkers = mobile ? 2 : 4;
          const workerH = (stageHeight - 30) / numWorkers;
          for (let w = 0; w < numWorkers; w++) {
            const wy = stageY + 22 + w * workerH;
            const isWorkerActive = transactionsRef.current.some((tx) => tx.worker === w);
            ctx.fillStyle = isWorkerActive ? "rgba(0, 217, 165, 0.3)" : "rgba(255,255,255,0.05)";
            ctx.beginPath();
            ctx.roundRect(x + 3, wy, stageWidth - 6, workerH - 3, 2);
            ctx.fill();
            ctx.fillStyle = isWorkerActive ? "#00D9A5" : "rgba(255,255,255,0.3)";
            ctx.font = mobile ? "5px monospace" : "6px monospace";
            ctx.textAlign = "left";
            ctx.fillText(`W${w}`, x + 5, wy + workerH / 2);
          }
        } else if (stage.id === "loader") {
          const levels = ["L1", "L2", "L3"];
          const levelH = (stageHeight - 25) / 3;
          levels.forEach((lvl, li) => {
            const ly = stageY + 20 + li * levelH;
            const colors = ["#00D9A5", "#3B82F6", "#F59E0B"];
            ctx.fillStyle = colors[li] + "20";
            ctx.beginPath();
            ctx.roundRect(x + 3, ly, stageWidth - 6, levelH - 2, 2);
            ctx.fill();
            ctx.fillStyle = colors[li];
            ctx.font = mobile ? "bold 6px monospace" : "bold 7px monospace";
            ctx.textAlign = "center";
            ctx.fillText(lvl, x + stageWidth / 2, ly + levelH / 2 + 2);
          });
        }

        // Flow arrows
        if (i < PIPELINE_STAGES.length - 1 && !mobile) {
          const nextX = padding + (i + 1) * ((width - padding * 2) / 5);
          ctx.strokeStyle = "rgba(255,255,255,0.15)";
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(x + stageWidth + 2, height / 2);
          ctx.lineTo(nextX - 2, height / 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });

      // Animate transactions
      transactionsRef.current = transactionsRef.current.filter((tx) => {
        tx.progress += 0.015;

        let targetX = width * 0.15;
        if (currentPhase >= 1) targetX = width * 0.33;
        if (currentPhase >= 2) targetX = width * 0.51;
        if (currentPhase >= 3) targetX = width * 0.69;
        if (currentPhase >= 4) targetX = width * 0.87;

        tx.x += (targetX - tx.x) * 0.05;

        const size = mobile ? 4 : 5;
        ctx.beginPath();
        const gradient = ctx.createRadialGradient(tx.x, tx.y, 0, tx.x, tx.y, size * 2);
        gradient.addColorStop(0, tx.color + "80");
        gradient.addColorStop(1, "transparent");
        ctx.fillStyle = gradient;
        ctx.arc(tx.x, tx.y, size * 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = tx.color;
        ctx.arc(tx.x, tx.y, size, 0, Math.PI * 2);
        ctx.fill();

        return tx.progress < 3;
      });

      // Title
      ctx.fillStyle = "#00D9A5";
      ctx.font = mobile ? "bold 9px system-ui" : "bold 11px system-ui";
      ctx.textAlign = "left";
      ctx.fillText(mobile ? "MOVE PIPELINE" : "MOVE EXECUTION PIPELINE", padding, mobile ? 14 : 18);

      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = mobile ? "7px monospace" : "9px monospace";
      ctx.textAlign = "right";
      ctx.fillText("Contract→Chain", width - padding, mobile ? 14 : 18);

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationRef.current);
  }, [currentPhase, isVisible]);

  return (
    <div ref={containerRef} className="chrome-card p-2 sm:p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="min-w-0">
          <h3 className="text-xs sm:text-sm font-bold" style={{ color: "var(--chrome-200)" }}>
            Move Execution Pipeline
          </h3>
          <p className="text-[9px] sm:text-xs truncate" style={{ color: "var(--chrome-600)" }}>
            {isMobile ? "Contract→Chain" : "Contract → Block-STM → Loader V2 → Chain"}
          </p>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full rounded"
        style={{ height: isMobile ? "200px" : "280px" }}
      />

      {/* Phase explanation - compact on mobile */}
      <div className="mt-2 p-2 rounded-lg bg-white/5 border border-white/10">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="px-1.5 py-0.5 rounded text-[9px] sm:text-xs font-bold flex-shrink-0"
            style={{ backgroundColor: "#00D9A5", color: "#000" }}
          >
            {currentPhase + 1}/6
          </span>
          <span className="text-[10px] sm:text-sm font-bold truncate" style={{ color: "#00D9A5" }}>
            {PHASES[currentPhase].title}
          </span>
        </div>
        <p className="text-[9px] sm:text-xs" style={{ color: "var(--chrome-400)" }}>
          {PHASES[currentPhase].desc}
        </p>
      </div>

      {/* Stats - full width, smaller on mobile */}
      <div className="mt-2 grid grid-cols-4 gap-1">
        {[
          { label: "Workers", value: "16+", color: "#00D9A5" },
          { label: "L1 Hit", value: "90%", color: "#00D9A5" },
          { label: "Conflicts", value: "15%", color: "#F59E0B" },
          { label: "Speedup", value: "16x", color: "#3B82F6" },
        ].map((stat) => (
          <div key={stat.label} className="p-1.5 rounded bg-white/5 text-center">
            <div className="text-sm sm:text-lg font-bold" style={{ color: stat.color }}>
              {stat.value}
            </div>
            <div className="text-[7px] sm:text-[9px]" style={{ color: "var(--chrome-600)" }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
