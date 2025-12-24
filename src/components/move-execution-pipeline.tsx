"use client";

import { useRef, useEffect, useState, memo } from "react";
import { useVisibility } from "@/hooks/useVisibility";

/**
 * Move Execution Pipeline: Complete Transaction Flow
 *
 * Shows the complete journey from Move contract to chain:
 * 1. Move Module: Contract code with dependencies
 * 2. Transaction: User invokes entry function
 * 3. Block-STM: Parallel execution with MVCC
 * 4. Loader V2: Multi-level code caching (L1→L2→L3)
 * 5. State Commit: Write-set applied to chain state
 *
 * Based on AIP-107 and Block-STM research.
 */

interface Transaction {
  id: number;
  x: number;
  y: number;
  stage: "pending" | "loading" | "executing" | "validating" | "committing" | "done";
  worker: number;
  moduleHit: "L1" | "L2" | "L3" | "storage";
  readSet: string[];
  writeSet: string[];
  color: string;
  conflicted: boolean;
  progress: number;
}

interface ModuleNode {
  name: string;
  address: string;
  deps: string[];
  functions: string[];
  cached: "L1" | "L2" | "L3" | "none";
}

const PIPELINE_STAGES = [
  {
    id: "module",
    name: "MOVE MODULE",
    color: "#A855F7",
    x: 0.08,
    desc: "Smart contract bytecode",
  },
  {
    id: "tx",
    name: "TRANSACTION",
    color: "#3B82F6",
    x: 0.22,
    desc: "Entry function call",
  },
  {
    id: "blockstm",
    name: "BLOCK-STM",
    color: "#00D9A5",
    x: 0.42,
    desc: "Parallel execution",
  },
  {
    id: "loader",
    name: "LOADER V2",
    color: "#F59E0B",
    x: 0.62,
    desc: "Module caching",
  },
  {
    id: "state",
    name: "STATE",
    color: "#EF4444",
    x: 0.82,
    desc: "Chain commit",
  },
];

const PHASES = [
  {
    phase: 1,
    title: "Module Definition",
    desc: "Move module defines entry functions and dependencies",
    technical: "module 0x1::coin { use 0x1::account; public entry fun transfer(...) }",
  },
  {
    phase: 2,
    title: "Transaction Submitted",
    desc: "User calls entry function, transaction enters mempool",
    technical: "⟨TX, 0x1::coin::transfer, [sender, receiver, amount], gas⟩",
  },
  {
    phase: 3,
    title: "Block-STM Assignment",
    desc: "Transaction assigned to worker thread for parallel execution",
    technical: "Worker N executes TX optimistically, tracks read/write set via MVCC",
  },
  {
    phase: 4,
    title: "Loader V2 Cache Lookup",
    desc: "VM requests module bytecode through cache hierarchy",
    technical: "L1 (thread) → L2 (block) → L3 (epoch) → Storage. ~90% L1 hit rate.",
  },
  {
    phase: 5,
    title: "Execution & Validation",
    desc: "VM executes bytecode, Block-STM validates for conflicts",
    technical: "If read-set changed → abort & re-execute. Else → mark ready to commit.",
  },
  {
    phase: 6,
    title: "State Commitment",
    desc: "Write-set applied atomically, state root updated",
    technical: "Rolling commit: TX committed when all prior TXs validated. JMT update.",
  },
];

const SAMPLE_MODULES: ModuleNode[] = [
  {
    name: "coin",
    address: "0x1",
    deps: ["account", "signer"],
    functions: ["transfer", "mint", "burn"],
    cached: "L1",
  },
  {
    name: "account",
    address: "0x1",
    deps: ["signer", "event"],
    functions: ["create", "exists"],
    cached: "L1",
  },
  {
    name: "token",
    address: "0x3",
    deps: ["coin", "account", "string"],
    functions: ["create_collection", "mint_token"],
    cached: "L2",
  },
];

const TX_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#A855F7", "#00D9A5"];

export const MoveExecutionPipeline = memo(function MoveExecutionPipeline() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const transactionsRef = useRef<Transaction[]>([]);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [selectedView, setSelectedView] = useState<"pipeline" | "blockstm" | "loader">("pipeline");
  const phaseTimerRef = useRef(0);
  const txIdRef = useRef(0);
  const isVisible = useVisibility(containerRef);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastTime = 0;
    const targetFPS = 30;
    const frameInterval = 1000 / targetFPS;

    const render = (timestamp: number) => {
      // Skip rendering when off-screen for performance
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

      // Phase timer
      phaseTimerRef.current++;
      const phaseDuration = 80;

      if (phaseTimerRef.current > phaseDuration) {
        phaseTimerRef.current = 0;
        const nextPhase = (currentPhase + 1) % 6;
        setCurrentPhase(nextPhase);

        // Spawn new transaction at phase 1
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
            readSet: ["0x1::coin::balance", "0x1::account::sequence"],
            writeSet: ["0x1::coin::balance"],
            color: TX_COLORS[txIdRef.current % TX_COLORS.length],
            conflicted: Math.random() < 0.15, // 15% conflict rate
            progress: 0,
          });
        }
      }

      if (selectedView === "pipeline") {
        drawPipelineView(ctx, width, height, timestamp);
      } else if (selectedView === "blockstm") {
        drawBlockSTMView(ctx, width, height, timestamp);
      } else {
        drawLoaderView(ctx, width, height, timestamp);
      }

      animationRef.current = requestAnimationFrame(render);
    };

    const drawPipelineView = (ctx: CanvasRenderingContext2D, width: number, height: number, timestamp: number) => {
      // Draw pipeline stages
      const stageY = 50;
      const stageHeight = height - 120;

      PIPELINE_STAGES.forEach((stage, i) => {
        const x = width * stage.x;
        const stageWidth = width * 0.14;

        // Stage box
        const isActive = currentPhase === i || currentPhase === i + 1;
        ctx.fillStyle = stage.color + (isActive ? "20" : "08");
        ctx.beginPath();
        ctx.roundRect(x, stageY, stageWidth, stageHeight, 8);
        ctx.fill();

        ctx.strokeStyle = stage.color + (isActive ? "80" : "30");
        ctx.lineWidth = isActive ? 2 : 1;
        ctx.stroke();

        // Stage label
        ctx.fillStyle = stage.color;
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "center";
        ctx.fillText(stage.name, x + stageWidth / 2, stageY + 18);

        // Stage description
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = "7px system-ui";
        ctx.fillText(stage.desc, x + stageWidth / 2, stageY + 32);

        // Draw internal details based on stage
        if (stage.id === "module") {
          drawModuleDetails(ctx, x + 5, stageY + 45, stageWidth - 10, stageHeight - 60);
        } else if (stage.id === "blockstm") {
          drawBlockSTMDetails(ctx, x + 5, stageY + 45, stageWidth - 10, stageHeight - 60);
        } else if (stage.id === "loader") {
          drawLoaderDetails(ctx, x + 5, stageY + 45, stageWidth - 10, stageHeight - 60);
        } else if (stage.id === "state") {
          drawStateDetails(ctx, x + 5, stageY + 45, stageWidth - 10, stageHeight - 60);
        }

        // Flow arrows between stages
        if (i < PIPELINE_STAGES.length - 1) {
          const nextX = width * PIPELINE_STAGES[i + 1].x;
          ctx.strokeStyle = "rgba(255,255,255,0.2)";
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(x + stageWidth + 5, height / 2);
          ctx.lineTo(nextX - 5, height / 2);
          ctx.stroke();
          ctx.setLineDash([]);

          // Arrowhead
          ctx.beginPath();
          ctx.fillStyle = "rgba(255,255,255,0.3)";
          ctx.moveTo(nextX - 5, height / 2);
          ctx.lineTo(nextX - 12, height / 2 - 4);
          ctx.lineTo(nextX - 12, height / 2 + 4);
          ctx.closePath();
          ctx.fill();
        }
      });

      // Animate transactions through pipeline
      transactionsRef.current = transactionsRef.current.filter((tx) => {
        tx.progress += 0.015;

        // Determine target position based on current phase
        let targetX = width * 0.15;
        if (currentPhase >= 1) targetX = width * 0.29;
        if (currentPhase >= 2) targetX = width * 0.49;
        if (currentPhase >= 3) targetX = width * 0.69;
        if (currentPhase >= 4) targetX = width * 0.89;

        tx.x += (targetX - tx.x) * 0.05;

        // Draw transaction
        const size = 6;
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

        // TX label
        ctx.fillStyle = "#000";
        ctx.font = "bold 6px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`T${tx.id % 100}`, tx.x, tx.y);

        return tx.progress < 3;
      });

      // Title
      ctx.fillStyle = "#00D9A5";
      ctx.font = "bold 11px system-ui";
      ctx.textAlign = "left";
      ctx.fillText("MOVE EXECUTION PIPELINE", 15, 20);

      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "9px monospace";
      ctx.textAlign = "right";
      ctx.fillText("Contract → Chain", width - 15, 20);
    };

    const drawModuleDetails = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
      // Draw module structure
      ctx.fillStyle = "rgba(168, 85, 247, 0.3)";
      ctx.beginPath();
      ctx.roundRect(x, y, w, 35, 4);
      ctx.fill();

      ctx.fillStyle = "#A855F7";
      ctx.font = "bold 7px monospace";
      ctx.textAlign = "left";
      ctx.fillText("0x1::coin", x + 4, y + 12);

      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "6px monospace";
      ctx.fillText("transfer()", x + 4, y + 24);

      // Dependencies
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = "6px monospace";
      ctx.textAlign = "center";
      ctx.fillText("uses:", x + w / 2, y + 50);

      const deps = ["account", "signer"];
      deps.forEach((dep, i) => {
        ctx.fillStyle = "rgba(168, 85, 247, 0.2)";
        ctx.beginPath();
        ctx.roundRect(x + 2 + i * (w / 2 - 2), y + 55, w / 2 - 6, 18, 3);
        ctx.fill();

        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.font = "5px monospace";
        ctx.fillText(dep, x + 2 + i * (w / 2 - 2) + (w / 4 - 3), y + 66);
      });
    };

    const drawBlockSTMDetails = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
      // Draw worker threads
      const numWorkers = 4;
      const workerH = (h - 30) / numWorkers;

      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = "6px monospace";
      ctx.textAlign = "center";
      ctx.fillText("WORKERS", x + w / 2, y + 8);

      for (let i = 0; i < numWorkers; i++) {
        const wy = y + 15 + i * workerH;
        const isActive = transactionsRef.current.some((tx) => tx.worker === i);

        ctx.fillStyle = isActive ? "rgba(0, 217, 165, 0.3)" : "rgba(255,255,255,0.05)";
        ctx.beginPath();
        ctx.roundRect(x, wy, w, workerH - 4, 3);
        ctx.fill();

        ctx.fillStyle = isActive ? "#00D9A5" : "rgba(255,255,255,0.4)";
        ctx.font = "6px monospace";
        ctx.textAlign = "left";
        ctx.fillText(`W${i}`, x + 3, wy + workerH / 2);

        // MVCC indicator
        if (isActive) {
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.font = "5px monospace";
          ctx.fillText("R/W", x + w - 15, wy + workerH / 2);
        }
      }
    };

    const drawLoaderDetails = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
      // Draw cache levels
      const levels = [
        { name: "L1", color: "#00D9A5", hit: "90%" },
        { name: "L2", color: "#3B82F6", hit: "8%" },
        { name: "L3", color: "#F59E0B", hit: "2%" },
      ];

      const levelH = (h - 10) / 3;

      levels.forEach((level, i) => {
        const ly = y + i * levelH;
        const isHit = transactionsRef.current.some((tx) => {
          const hitLevel = tx.moduleHit === "L1" ? 0 : tx.moduleHit === "L2" ? 1 : 2;
          return hitLevel === i && currentPhase === 3;
        });

        ctx.fillStyle = level.color + (isHit ? "40" : "15");
        ctx.beginPath();
        ctx.roundRect(x, ly, w, levelH - 4, 3);
        ctx.fill();

        ctx.fillStyle = level.color;
        ctx.font = "bold 7px monospace";
        ctx.textAlign = "left";
        ctx.fillText(level.name, x + 3, ly + 10);

        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = "5px monospace";
        ctx.textAlign = "right";
        ctx.fillText(level.hit, x + w - 3, ly + 10);

        if (isHit) {
          ctx.fillStyle = "#00D9A5";
          ctx.font = "bold 6px monospace";
          ctx.textAlign = "center";
          ctx.fillText("HIT", x + w / 2, ly + levelH / 2 + 5);
        }
      });
    };

    const drawStateDetails = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
      // Draw state tree representation
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = "6px monospace";
      ctx.textAlign = "center";
      ctx.fillText("JMT ROOT", x + w / 2, y + 10);

      // Draw mini tree
      const centerX = x + w / 2;
      ctx.strokeStyle = "rgba(239, 68, 68, 0.5)";
      ctx.lineWidth = 1;

      // Root
      ctx.beginPath();
      ctx.fillStyle = "#EF4444";
      ctx.arc(centerX, y + 25, 5, 0, Math.PI * 2);
      ctx.fill();

      // Children
      ctx.beginPath();
      ctx.moveTo(centerX, y + 30);
      ctx.lineTo(centerX - 15, y + 50);
      ctx.moveTo(centerX, y + 30);
      ctx.lineTo(centerX + 15, y + 50);
      ctx.stroke();

      ctx.beginPath();
      ctx.fillStyle = "rgba(239, 68, 68, 0.6)";
      ctx.arc(centerX - 15, y + 55, 4, 0, Math.PI * 2);
      ctx.arc(centerX + 15, y + 55, 4, 0, Math.PI * 2);
      ctx.fill();

      // Write set indicator
      if (currentPhase >= 5) {
        ctx.fillStyle = "#00D9A5";
        ctx.font = "5px monospace";
        ctx.fillText("COMMIT", centerX, y + h - 10);
      }
    };

    const drawBlockSTMView = (ctx: CanvasRenderingContext2D, width: number, height: number, timestamp: number) => {
      // Detailed Block-STM view with MVCC
      ctx.fillStyle = "#00D9A5";
      ctx.font = "bold 11px system-ui";
      ctx.textAlign = "left";
      ctx.fillText("BLOCK-STM: PARALLEL EXECUTION", 15, 20);

      // Worker threads
      const numWorkers = 6;
      const workerWidth = (width - 40) / numWorkers;
      const workerY = 50;
      const workerH = height - 150;

      for (let i = 0; i < numWorkers; i++) {
        const wx = 20 + i * workerWidth;

        // Worker column
        ctx.fillStyle = "rgba(0, 217, 165, 0.08)";
        ctx.beginPath();
        ctx.roundRect(wx, workerY, workerWidth - 5, workerH, 6);
        ctx.fill();

        ctx.strokeStyle = "rgba(0, 217, 165, 0.3)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Worker label
        ctx.fillStyle = "#00D9A5";
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`Worker ${i}`, wx + workerWidth / 2 - 2, workerY + 18);

        // VM instance
        ctx.fillStyle = "rgba(168, 85, 247, 0.2)";
        ctx.beginPath();
        ctx.roundRect(wx + 5, workerY + 30, workerWidth - 15, 25, 4);
        ctx.fill();

        ctx.fillStyle = "#A855F7";
        ctx.font = "7px monospace";
        ctx.fillText("MoveVM", wx + workerWidth / 2 - 2, workerY + 45);

        // Transaction slots
        const txInWorker = transactionsRef.current.filter((tx) => tx.worker === i);
        txInWorker.forEach((tx, ti) => {
          const txY = workerY + 65 + ti * 35;
          if (txY > workerY + workerH - 40) return;

          ctx.fillStyle = tx.conflicted ? "rgba(239, 68, 68, 0.2)" : "rgba(0, 217, 165, 0.15)";
          ctx.beginPath();
          ctx.roundRect(wx + 5, txY, workerWidth - 15, 30, 4);
          ctx.fill();

          ctx.fillStyle = tx.color;
          ctx.font = "bold 7px monospace";
          ctx.textAlign = "left";
          ctx.fillText(`TX${tx.id}`, wx + 10, txY + 12);

          // Read/Write set
          ctx.fillStyle = "rgba(255,255,255,0.4)";
          ctx.font = "5px monospace";
          ctx.fillText(`R: ${tx.readSet.length} W: ${tx.writeSet.length}`, wx + 10, txY + 23);

          if (tx.conflicted) {
            ctx.fillStyle = "#EF4444";
            ctx.font = "bold 6px monospace";
            ctx.textAlign = "right";
            ctx.fillText("RETRY", wx + workerWidth - 20, txY + 18);
          }
        });
      }

      // MVCC explanation
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.beginPath();
      ctx.roundRect(20, height - 90, width - 40, 50, 6);
      ctx.fill();

      ctx.fillStyle = "#F59E0B";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "left";
      ctx.fillText("MVCC (Multi-Version Concurrency Control)", 30, height - 72);

      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "8px monospace";
      ctx.fillText("Optimistic execution → Track read/write sets → Validate → Re-execute on conflict", 30, height - 55);
    };

    const drawLoaderView = (ctx: CanvasRenderingContext2D, width: number, height: number, timestamp: number) => {
      // Detailed Loader V2 view
      ctx.fillStyle = "#F59E0B";
      ctx.font = "bold 11px system-ui";
      ctx.textAlign = "left";
      ctx.fillText("LOADER V2: MODULE CACHE HIERARCHY", 15, 20);

      const cacheY = 50;
      const cacheH = height - 140;
      const cacheW = (width - 80) / 3;

      const caches = [
        { level: "L1", name: "Thread-Local", color: "#00D9A5", hit: "~90%", latency: "<1μs", lifetime: "TX batch" },
        { level: "L2", name: "Block Cache", color: "#3B82F6", hit: "~8%", latency: "~5μs", lifetime: "Block" },
        { level: "L3", name: "Epoch Cache", color: "#F59E0B", hit: "~2%", latency: "~50μs", lifetime: "Epoch (2h)" },
      ];

      caches.forEach((cache, i) => {
        const cx = 30 + i * (cacheW + 20);

        // Cache box
        ctx.fillStyle = cache.color + "15";
        ctx.beginPath();
        ctx.roundRect(cx, cacheY, cacheW, cacheH, 8);
        ctx.fill();

        ctx.strokeStyle = cache.color + "60";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Cache header
        ctx.fillStyle = cache.color;
        ctx.font = "bold 16px monospace";
        ctx.textAlign = "center";
        ctx.fillText(cache.level, cx + cacheW / 2, cacheY + 30);

        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = "bold 10px system-ui";
        ctx.fillText(cache.name, cx + cacheW / 2, cacheY + 50);

        // Stats
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "9px monospace";
        ctx.fillText(`Hit Rate: ${cache.hit}`, cx + cacheW / 2, cacheY + 75);
        ctx.fillText(`Latency: ${cache.latency}`, cx + cacheW / 2, cacheY + 92);
        ctx.fillText(`Lifetime: ${cache.lifetime}`, cx + cacheW / 2, cacheY + 109);

        // Cached modules representation
        const numModules = [8, 4, 2][i];
        const moduleSize = 20;
        const startY = cacheY + 130;

        for (let m = 0; m < numModules; m++) {
          const mx = cx + 10 + (m % 3) * (moduleSize + 5);
          const my = startY + Math.floor(m / 3) * (moduleSize + 5);

          if (my + moduleSize > cacheY + cacheH - 10) continue;

          ctx.fillStyle = cache.color + "40";
          ctx.beginPath();
          ctx.roundRect(mx, my, moduleSize, moduleSize, 3);
          ctx.fill();

          ctx.fillStyle = cache.color;
          ctx.font = "6px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(`M${m}`, mx + moduleSize / 2, my + moduleSize / 2);
        }

        // Arrow to next cache (miss path)
        if (i < 2) {
          ctx.strokeStyle = "rgba(255,255,255,0.2)";
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(cx + cacheW + 5, cacheY + cacheH / 2);
          ctx.lineTo(cx + cacheW + 15, cacheY + cacheH / 2);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = "rgba(255,255,255,0.3)";
          ctx.font = "6px monospace";
          ctx.textAlign = "center";
          ctx.fillText("miss", cx + cacheW + 10, cacheY + cacheH / 2 - 8);
        }
      });

      // Lookup flow
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.beginPath();
      ctx.roundRect(20, height - 80, width - 40, 45, 6);
      ctx.fill();

      ctx.fillStyle = "#00D9A5";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "left";
      ctx.fillText("Lookup Flow:", 30, height - 62);

      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "8px monospace";
      ctx.fillText("VM::load_module(addr) → L1 check → L2 check → L3 check → Storage (deserialize + verify)", 30, height - 45);
    };

    animationRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationRef.current);
  }, [currentPhase, selectedView, isVisible]);

  return (
    <div ref={containerRef} className="chrome-card p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="section-title">Move Execution Pipeline</h3>
          <p className="text-xs" style={{ color: "var(--chrome-600)" }}>
            Complete flow: Contract → Block-STM → Loader V2 → Chain
          </p>
        </div>
        <div className="flex items-center gap-1">
          {(["pipeline", "blockstm", "loader"] as const).map((view) => (
            <button
              key={view}
              onClick={() => setSelectedView(view)}
              className={`px-2 py-1 text-xs font-mono rounded transition-colors ${
                selectedView === view ? "bg-[#00D9A5] text-black" : "bg-white/10 text-white/60"
              }`}
            >
              {view === "pipeline" ? "Pipeline" : view === "blockstm" ? "Block-STM" : "Loader V2"}
            </button>
          ))}
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full rounded"
        style={{ height: "320px" }}
      />

      {/* Phase explanation */}
      <div className="mt-4 p-3 rounded-lg bg-white/5 border border-white/10">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="px-2 py-0.5 rounded text-xs font-bold"
            style={{ backgroundColor: "#00D9A5", color: "#000" }}
          >
            {currentPhase + 1}/6
          </span>
          <span className="text-sm font-bold" style={{ color: "#00D9A5" }}>
            {PHASES[currentPhase].title}
          </span>
        </div>

        <p className="text-xs mb-2" style={{ color: "var(--chrome-400)" }}>
          {PHASES[currentPhase].desc}
        </p>

        <p className="text-xs font-mono break-all" style={{ color: "var(--chrome-600)" }}>
          {PHASES[currentPhase].technical}
        </p>

        {/* Phase timeline */}
        <div className="flex items-center gap-1 mt-3">
          {PHASES.map((_, i) => (
            <div
              key={i}
              className="flex-1 h-1.5 rounded-full transition-all"
              style={{
                backgroundColor: i <= currentPhase ? "#00D9A5" : "rgba(255,255,255,0.1)",
              }}
            />
          ))}
        </div>
      </div>

      {/* Architecture summary */}
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Parallel Workers", value: "16+", color: "#00D9A5" },
          { label: "L1 Cache Hit", value: "~90%", color: "#00D9A5" },
          { label: "Conflict Rate", value: "~15%", color: "#F59E0B" },
          { label: "Speedup", value: "16x", color: "#3B82F6" },
        ].map((stat) => (
          <div key={stat.label} className="p-2 rounded bg-white/5 text-center">
            <div className="text-lg font-bold" style={{ color: stat.color }}>
              {stat.value}
            </div>
            <div className="text-[9px]" style={{ color: "var(--chrome-600)" }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
