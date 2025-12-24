"use client";

import { useRef, useEffect, useState, memo } from "react";
import { useVisibility } from "@/hooks/useVisibility";

/**
 * Move VM Execution Pipeline - Comprehensive Visualization
 *
 * Shows the complete lifecycle of a transaction through the Move VM:
 * 1. Transaction Entry → Script/Module Load
 * 2. Bytecode Deserialization (storage → memory)
 * 3. Bytecode Verification (4 stages: Stack, Type, Locals, Reference)
 * 4. Module Linking (resolve dependencies)
 * 5. Loader V2 Caching (L1 → L2 → L3)
 * 6. Execution (interpreter runs bytecode)
 * 7. State Commit (write to storage)
 *
 * Based on AIP-107 and Loader V2 architecture.
 */

interface Transaction {
  id: number;
  x: number;
  y: number;
  stage: number;
  substage: number;
  color: string;
  moduleId: string;
  cacheHit: "L1" | "L2" | "L3" | "miss";
  verifyProgress: number;
  opacity: number;
}

// Full pipeline stages
const PIPELINE_STAGES = [
  {
    id: 0,
    name: "TX ENTRY",
    shortName: "ENTRY",
    color: "#6366F1",
    substages: ["Receive", "Parse", "Validate"],
    desc: "Transaction received and validated",
    technical: "Transaction bytes decoded, signature verified, gas checked",
    mechanic: "Entry point: execute_script() or execute_function(). Deserialize TransactionPayload, verify Ed25519 signature against sender's public key, check sequence number matches account state.",
  },
  {
    id: 1,
    name: "MODULE LOAD",
    shortName: "LOAD",
    color: "#8B5CF6",
    substages: ["Fetch", "Deserialize", "Deps"],
    desc: "Load module bytecode from storage or cache",
    technical: "Check L1→L2→L3 cache, else fetch from storage + deserialize",
    mechanic: "ModuleStorage::fetch_module_bytes() returns CompiledModule. Deserialization: binary → struct with function_handles, struct_defs, code_units. Recursively load all dependencies via module imports.",
  },
  {
    id: 2,
    name: "VERIFY",
    shortName: "VERIFY",
    color: "#EC4899",
    substages: ["Stack", "Type", "Locals", "RefSafe"],
    desc: "Bytecode verification ensures safety properties",
    technical: "4-stage verifier: Stack → Type → Locals → Reference safety",
    mechanic: "StackUsageVerifier: balanced push/pop per block. TypeSafetyVerifier: correct types for all ops. LocalsSafetyVerifier: no use-before-init. ReferenceSafetyVerifier: borrow checking, no dangling refs.",
  },
  {
    id: 3,
    name: "LINK",
    shortName: "LINK",
    color: "#F59E0B",
    substages: ["Resolve", "Bind", "Check"],
    desc: "Link module with its dependencies",
    technical: "Resolve function handles, struct definitions across modules",
    mechanic: "For each FunctionHandle: resolve module_id → loaded module, resolve function_name → FunctionDefinition. Struct linking: resolve StructHandle → StructDefinition. Verify all links are satisfied.",
  },
  {
    id: 4,
    name: "CACHE",
    shortName: "CACHE",
    color: "#00D9A5",
    substages: ["L1 Check", "L2 Check", "L3/Store"],
    desc: "Loader V2 multi-level caching",
    technical: "L1: thread-local (~90%), L2: block-shared, L3: epoch-global",
    mechanic: "L1 hit: pointer lookup, lock-free, <1μs. L2 hit: RwLock read, ~5μs. L3 hit: lock-free global, ~50μs. Miss: full verify cycle, store in L2, promote to L3 at block commit.",
  },
  {
    id: 5,
    name: "EXECUTE",
    shortName: "EXEC",
    color: "#10B981",
    substages: ["Interp", "Ops", "Calls"],
    desc: "Move interpreter executes bytecode",
    technical: "Stack-based interpreter processes opcodes sequentially",
    mechanic: "Interpreter loop: fetch instruction, decode opcode, execute. Stack ops: push/pop operands. Call: push frame, set locals, jump. Return: pop frame, push return values. Global access: borrow_global, move_from, move_to.",
  },
  {
    id: 6,
    name: "COMMIT",
    shortName: "COMMIT",
    color: "#3B82F6",
    substages: ["Delta", "Merkle", "Write"],
    desc: "Commit state changes to storage",
    technical: "Compute state delta, update Jellyfish Merkle Tree",
    mechanic: "Collect WriteSet: (AccessPath, Value) pairs. Apply to MVHashMap for Block-STM. At block end: serialize deltas, update JMT nodes, compute new state root hash, persist to RocksDB.",
  },
];

const VERIFY_SUBSTAGES = [
  { name: "Stack", desc: "Verify stack usage is balanced", color: "#EC4899" },
  { name: "Type", desc: "Verify type correctness", color: "#F472B6" },
  { name: "Locals", desc: "Verify local variable safety", color: "#FB7185" },
  { name: "RefSafe", desc: "Borrow checker (no dangling refs)", color: "#FDA4AF" },
];

export const MoveVMPipeline = memo(function MoveVMPipeline() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const transactionsRef = useRef<Transaction[]>([]);
  const [currentStage, setCurrentStage] = useState(0);
  const [showDetails, setShowDetails] = useState(true);
  const stageTimerRef = useRef(0);
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

      // Stage timer
      stageTimerRef.current++;
      const stageDuration = 60;

      if (stageTimerRef.current > stageDuration) {
        stageTimerRef.current = 0;
        const nextStage = (currentStage + 1) % PIPELINE_STAGES.length;
        setCurrentStage(nextStage);

        // Spawn new transaction
        if (nextStage === 0) {
          const cacheRand = Math.random();
          const cacheHit: "L1" | "L2" | "L3" | "miss" =
            cacheRand < 0.90 ? "L1" :
            cacheRand < 0.98 ? "L2" :
            cacheRand < 0.999 ? "L3" : "miss";

          transactionsRef.current.push({
            id: txIdRef.current++,
            x: 20,
            y: height / 2,
            stage: 0,
            substage: 0,
            color: "#6366F1",
            moduleId: `0x${Math.random().toString(16).slice(2, 6)}::${["coin", "nft", "swap", "stake"][Math.floor(Math.random() * 4)]}`,
            cacheHit,
            verifyProgress: 0,
            opacity: 1,
          });
        }
      }

      // Pipeline layout
      const pipelineY = 50;
      const pipelineHeight = 80;
      const stageWidth = (width - 60) / PIPELINE_STAGES.length;
      const stageGap = 4;

      // Draw pipeline stages
      PIPELINE_STAGES.forEach((stage, i) => {
        const x = 30 + i * stageWidth;
        const isActive = currentStage === i;
        const isPast = currentStage > i;

        // Stage background
        ctx.fillStyle = stage.color + (isActive ? "30" : isPast ? "15" : "08");
        ctx.beginPath();
        ctx.roundRect(x, pipelineY, stageWidth - stageGap, pipelineHeight, 6);
        ctx.fill();

        // Stage border
        ctx.strokeStyle = stage.color + (isActive ? "90" : "40");
        ctx.lineWidth = isActive ? 2 : 1;
        ctx.stroke();

        // Stage number
        ctx.fillStyle = stage.color;
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`${i + 1}`, x + (stageWidth - stageGap) / 2, pipelineY + 18);

        // Stage name
        ctx.fillStyle = isActive ? "#fff" : "rgba(255,255,255,0.6)";
        ctx.font = "bold 9px system-ui";
        ctx.fillText(stage.shortName, x + (stageWidth - stageGap) / 2, pipelineY + 35);

        // Substages indicator
        if (isActive) {
          const substageWidth = (stageWidth - stageGap - 10) / stage.substages.length;
          stage.substages.forEach((sub, si) => {
            const subX = x + 5 + si * substageWidth;
            const subProgress = stageTimerRef.current / stageDuration;
            const subActive = subProgress > si / stage.substages.length;

            ctx.fillStyle = subActive ? stage.color : "rgba(255,255,255,0.1)";
            ctx.fillRect(subX, pipelineY + pipelineHeight - 20, substageWidth - 2, 6);
          });

          // Current substage label
          const currentSubIdx = Math.min(
            Math.floor((stageTimerRef.current / stageDuration) * stage.substages.length),
            stage.substages.length - 1
          );
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.font = "7px monospace";
          ctx.fillText(stage.substages[currentSubIdx], x + (stageWidth - stageGap) / 2, pipelineY + pipelineHeight - 5);
        }

        // Arrow to next stage
        if (i < PIPELINE_STAGES.length - 1) {
          const arrowX = x + stageWidth - stageGap / 2;
          ctx.strokeStyle = "rgba(255,255,255,0.3)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(arrowX - 3, pipelineY + pipelineHeight / 2 - 4);
          ctx.lineTo(arrowX + 3, pipelineY + pipelineHeight / 2);
          ctx.lineTo(arrowX - 3, pipelineY + pipelineHeight / 2 + 4);
          ctx.stroke();
        }
      });

      // Draw verification detail section (when on VERIFY stage)
      const verifyY = pipelineY + pipelineHeight + 20;
      if (currentStage === 2) {
        const verifyHeight = 50;
        ctx.fillStyle = "rgba(236, 72, 153, 0.1)";
        ctx.beginPath();
        ctx.roundRect(30, verifyY, width - 60, verifyHeight, 6);
        ctx.fill();
        ctx.strokeStyle = "rgba(236, 72, 153, 0.3)";
        ctx.stroke();

        ctx.fillStyle = "#EC4899";
        ctx.font = "bold 9px system-ui";
        ctx.textAlign = "left";
        ctx.fillText("BYTECODE VERIFIER PIPELINE", 40, verifyY + 15);

        // Draw 4 verification substages
        const verifyStageWidth = (width - 100) / 4;
        VERIFY_SUBSTAGES.forEach((vs, i) => {
          const vx = 45 + i * verifyStageWidth;
          const progress = stageTimerRef.current / stageDuration;
          const isVerifyActive = progress > i / 4 && progress <= (i + 1) / 4;
          const isVerifyDone = progress > (i + 1) / 4;

          ctx.fillStyle = isVerifyDone ? vs.color : isVerifyActive ? vs.color + "80" : "rgba(255,255,255,0.1)";
          ctx.beginPath();
          ctx.roundRect(vx, verifyY + 22, verifyStageWidth - 10, 20, 4);
          ctx.fill();

          ctx.fillStyle = isVerifyDone || isVerifyActive ? "#000" : "rgba(255,255,255,0.5)";
          ctx.font = "bold 8px monospace";
          ctx.textAlign = "center";
          ctx.fillText(vs.name, vx + (verifyStageWidth - 10) / 2, verifyY + 35);

          // Arrow
          if (i < 3) {
            ctx.fillStyle = "rgba(255,255,255,0.3)";
            ctx.beginPath();
            ctx.moveTo(vx + verifyStageWidth - 8, verifyY + 32);
            ctx.lineTo(vx + verifyStageWidth - 4, verifyY + 32);
            ctx.lineTo(vx + verifyStageWidth - 6, verifyY + 30);
            ctx.moveTo(vx + verifyStageWidth - 4, verifyY + 32);
            ctx.lineTo(vx + verifyStageWidth - 6, verifyY + 34);
            ctx.stroke();
          }
        });
      }

      // Draw cache detail section (when on CACHE stage)
      if (currentStage === 4) {
        const cacheY = verifyY;
        const cacheHeight = 50;
        ctx.fillStyle = "rgba(0, 217, 165, 0.1)";
        ctx.beginPath();
        ctx.roundRect(30, cacheY, width - 60, cacheHeight, 6);
        ctx.fill();
        ctx.strokeStyle = "rgba(0, 217, 165, 0.3)";
        ctx.stroke();

        ctx.fillStyle = "#00D9A5";
        ctx.font = "bold 9px system-ui";
        ctx.textAlign = "left";
        ctx.fillText("LOADER V2 CACHE HIERARCHY", 40, cacheY + 15);

        // Draw cache levels
        const cacheLevels = [
          { name: "L1", desc: "Thread-local", hit: "~90%", latency: "<1μs", color: "#00D9A5" },
          { name: "L2", desc: "Block-shared", hit: "~8%", latency: "~5μs", color: "#3B82F6" },
          { name: "L3", desc: "Epoch-global", hit: "~1.9%", latency: "~50μs", color: "#F59E0B" },
        ];
        const cacheStageWidth = (width - 100) / 3;
        const progress = stageTimerRef.current / stageDuration;

        cacheLevels.forEach((cl, i) => {
          const cx = 45 + i * cacheStageWidth;
          const isCacheActive = progress > i / 3 && progress <= (i + 1) / 3;
          const isCacheDone = progress > (i + 1) / 3;

          ctx.fillStyle = isCacheDone ? cl.color + "40" : isCacheActive ? cl.color + "60" : "rgba(255,255,255,0.05)";
          ctx.beginPath();
          ctx.roundRect(cx, cacheY + 22, cacheStageWidth - 15, 22, 4);
          ctx.fill();
          ctx.strokeStyle = cl.color + (isCacheActive ? "80" : "30");
          ctx.stroke();

          ctx.fillStyle = cl.color;
          ctx.font = "bold 9px monospace";
          ctx.textAlign = "center";
          ctx.fillText(cl.name, cx + (cacheStageWidth - 15) / 2 - 20, cacheY + 36);

          ctx.fillStyle = "rgba(255,255,255,0.6)";
          ctx.font = "7px monospace";
          ctx.fillText(`${cl.hit}`, cx + (cacheStageWidth - 15) / 2 + 15, cacheY + 36);
        });
      }

      // Animate transactions through pipeline
      transactionsRef.current = transactionsRef.current.filter((tx) => {
        const targetStage = Math.min(currentStage, PIPELINE_STAGES.length - 1);
        const targetX = 30 + targetStage * stageWidth + (stageWidth - stageGap) / 2;

        tx.x += (targetX - tx.x) * 0.1;
        tx.stage = targetStage;
        tx.color = PIPELINE_STAGES[targetStage].color;

        // Draw transaction particle
        const txY = pipelineY + pipelineHeight / 2;
        const size = 6;

        // Glow
        ctx.beginPath();
        const gradient = ctx.createRadialGradient(tx.x, txY, 0, tx.x, txY, size * 3);
        gradient.addColorStop(0, tx.color + "60");
        gradient.addColorStop(1, "transparent");
        ctx.fillStyle = gradient;
        ctx.arc(tx.x, txY, size * 3, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.fillStyle = tx.color;
        ctx.arc(tx.x, txY, size, 0, Math.PI * 2);
        ctx.fill();

        // Trail
        ctx.strokeStyle = tx.color + "40";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(tx.x - 20, txY);
        ctx.lineTo(tx.x - 5, txY);
        ctx.stroke();

        // Remove old transactions
        return tx.stage < PIPELINE_STAGES.length - 1 || currentStage < PIPELINE_STAGES.length - 1;
      });

      // Title
      ctx.fillStyle = "#6366F1";
      ctx.font = "bold 11px system-ui";
      ctx.textAlign = "left";
      ctx.fillText("MOVE VM EXECUTION PIPELINE", 15, 20);

      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "9px monospace";
      ctx.textAlign = "right";
      ctx.fillText("7 stages · Block-STM parallel", width - 15, 20);

      // Progress indicator
      const overallProgress = (currentStage + stageTimerRef.current / stageDuration) / PIPELINE_STAGES.length;
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fillRect(15, 30, width - 30, 3);
      ctx.fillStyle = PIPELINE_STAGES[currentStage].color;
      ctx.fillRect(15, 30, (width - 30) * overallProgress, 3);

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationRef.current);
  }, [currentStage, isVisible]);

  const stage = PIPELINE_STAGES[currentStage];
  const substageIdx = Math.min(
    Math.floor((stageTimerRef.current / 60) * stage.substages.length),
    stage.substages.length - 1
  );

  return (
    <div ref={containerRef} className="chrome-card p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="section-title">Move VM Execution Pipeline</h3>
          <p className="text-xs" style={{ color: "var(--chrome-600)" }}>
            Complete transaction lifecycle through the Move virtual machine
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-mono px-2 py-1 rounded"
            style={{ backgroundColor: stage.color + "20", color: stage.color }}
          >
            Stage {currentStage + 1}/{PIPELINE_STAGES.length}
          </span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full rounded"
        style={{ height: currentStage === 2 || currentStage === 4 ? "250px" : "200px" }}
      />

      {/* Stage explanation */}
      <div className="mt-4 p-3 rounded-lg bg-white/5 border border-white/10">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="px-2 py-0.5 rounded text-xs font-bold"
            style={{ backgroundColor: stage.color, color: "#000" }}
          >
            {stage.name}
          </span>
          <span className="text-xs font-mono" style={{ color: "var(--chrome-500)" }}>
            → {stage.substages[substageIdx]}
          </span>
        </div>

        <p className="text-xs mb-3" style={{ color: "var(--chrome-400)" }}>
          {stage.desc}
        </p>

        <div className="space-y-2">
          <div className="p-2 rounded bg-white/5">
            <div className="text-[10px] font-bold mb-1" style={{ color: stage.color }}>Technical:</div>
            <p className="text-xs font-mono" style={{ color: "var(--chrome-500)" }}>
              {stage.technical}
            </p>
          </div>

          <div className="p-2 rounded bg-white/5">
            <div className="text-[10px] font-bold mb-1" style={{ color: "#00D9A5" }}>Mechanics:</div>
            <p className="text-xs" style={{ color: "var(--chrome-500)" }}>
              {stage.mechanic}
            </p>
          </div>
        </div>

        {/* Substage progress */}
        <div className="flex items-center gap-1 mt-3">
          {stage.substages.map((sub, i) => (
            <div key={i} className="flex-1">
              <div
                className="h-1.5 rounded-full transition-all"
                style={{
                  backgroundColor: i <= substageIdx ? stage.color : "rgba(255,255,255,0.1)",
                }}
              />
              <div className="text-[7px] mt-1 text-center truncate" style={{ color: "var(--chrome-600)" }}>
                {sub}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Key insight based on current stage */}
      <div className="mt-2 p-2 rounded bg-white/5">
        <p className="text-xs" style={{ color: "var(--chrome-500)" }}>
          <span className="font-bold" style={{ color: stage.color }}>
            {currentStage === 2 ? "Safety Guarantee:" :
             currentStage === 4 ? "Performance:" :
             currentStage === 5 ? "Parallelism:" : "Pipeline:"}
          </span>
          {" "}
          {currentStage === 2 && "Bytecode verifier runs 4 static analysis passes. Once verified, code is guaranteed memory-safe and type-safe—no runtime checks needed."}
          {currentStage === 4 && "Loader V2 achieves ~90% L1 hit rate. Thread-local pointers avoid locks entirely. Block-to-epoch promotion ensures hot modules stay cached."}
          {currentStage === 5 && "Block-STM runs multiple transactions in parallel. MVCC tracks read/write sets. Conflicts trigger re-execution, not blocking."}
          {currentStage !== 2 && currentStage !== 4 && currentStage !== 5 && "Each stage is optimized for minimal latency. Pipelining allows next block to start while current commits."}
        </p>
      </div>
    </div>
  );
});
