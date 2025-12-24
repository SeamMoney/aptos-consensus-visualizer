"use client";

import { useRef, useEffect, useState, memo } from "react";
import { useVisibility } from "@/hooks/useVisibility";

/**
 * Loader V2: Parallelization Visualization
 *
 * Shows how Loader V2 enables parallel contract execution:
 * - Legacy: Each thread has own cache, 32 threads = 32x redundant loading
 * - Loader V2: Shared caches, thread-safe, lock-free reads
 * - Block-STM integration: Speculative execution + cache invalidation
 * - Module publish: Atomic bundle publish, rollback on conflict
 *
 * Based on AIP-107: 14.1x faster module publishing, 60% faster blocks
 */

interface Thread {
  id: number;
  x: number;
  y: number;
  status: "idle" | "executing" | "waiting" | "cacheHit";
  currentModule: string | null;
  cacheLevel: "L1" | "L2" | "L3" | null;
  progress: number;
}

interface ModuleLoad {
  id: number;
  moduleId: string;
  fromThread: number;
  x: number;
  y: number;
  targetCache: "L1" | "L2" | "L3";
  state: "request" | "checking" | "hit" | "loading" | "cached";
  progress: number;
}

const COMPARISON_DATA = {
  legacy: {
    title: "Legacy Loader",
    problems: [
      "Per-thread module cache (no sharing)",
      "32 threads = up to 32x redundant loads",
      "Cache discarded after each block",
      "Speculative execution corrupts cache",
    ],
    color: "#EF4444",
  },
  v2: {
    title: "Loader V2 (AIP-107)",
    solutions: [
      "Shared L1→L2→L3 cache hierarchy",
      "Thread-safe, lock-free L1 reads",
      "Epoch-persistent L3 cache",
      "Block-STM aware cache invalidation",
    ],
    color: "#00D9A5",
  },
};

const PHASES = [
  {
    name: "PARALLEL LOAD",
    title: "Multi-Thread Module Loading",
    desc: "32 Block-STM threads request the same hot module simultaneously",
    technical: "Legacy: Each thread deserializes + verifies independently → O(32 × module_size). Loader V2: First thread loads, others wait on lock-free read → O(1 × module_size).",
    mechanic: "Thread T1 acquires L2 lock, loads module, stores in L2. Threads T2-T32 spin-wait briefly, then read from L2. All 32 get pointer to same verified module. Zero redundant verification.",
  },
  {
    name: "CACHE PROMOTION",
    title: "L2 → L3 Block Commit Promotion",
    desc: "At block commit, frequently accessed modules promote to epoch cache",
    technical: "L2 entries marked with access count. High-access modules copied to L3 lock-free cache. L3 survives across blocks (up to 2hr epoch).",
    mechanic: "Block commit: iterate L2 entries. If access_count > threshold, insert into L3 (lock-free append). L3 uses epoch versioning—new epoch flushes entire cache. Hot contracts like aptos_framework persist across thousands of blocks.",
  },
  {
    name: "SPECULATIVE EXEC",
    title: "Block-STM Speculative Execution",
    desc: "Optimistic parallel execution with cache-aware conflict detection",
    technical: "Block-STM assigns transactions to threads speculatively. If Tx2 reads module published by Tx1, and Tx1 rolls back, Tx2 must re-execute.",
    mechanic: "Module publish: (1) Execute Tx1 speculatively, (2) Mark module in L2 as 'pending', (3) Tx2 reads pending module—records dependency, (4) Tx1 commits → L2 entry becomes 'committed', (5) Tx1 aborts → invalidate L2 entry, re-execute Tx2.",
  },
  {
    name: "BUNDLE PUBLISH",
    title: "Atomic Module Bundle Publishing",
    desc: "Publish multiple modules as atomic bundle (fixes init_module linking)",
    technical: "Legacy: Modules published one-by-one, init_module links to old versions. V2: Entire bundle verified + published atomically.",
    mechanic: "Module bundle [A, B, C] where A imports B, B imports C. Legacy: publish C → B links old C → A links old B. V2: verify all, then atomic insert. All imports resolve to new versions. init_module sees correct code.",
  },
];

export const LoaderV2Parallel = memo(function LoaderV2Parallel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const threadsRef = useRef<Thread[]>([]);
  const loadsRef = useRef<ModuleLoad[]>([]);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [showLegacy, setShowLegacy] = useState(false);
  const phaseTimerRef = useRef(0);
  const loadIdRef = useRef(0);
  const isVisible = useVisibility(containerRef);

  // Initialize threads
  useEffect(() => {
    threadsRef.current = Array.from({ length: 8 }, (_, i) => ({
      id: i,
      x: 0,
      y: 0,
      status: "idle",
      currentModule: null,
      cacheLevel: null,
      progress: 0,
    }));
  }, []);

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

      // Phase timer
      phaseTimerRef.current++;
      const phaseDuration = 90;

      if (phaseTimerRef.current > phaseDuration) {
        phaseTimerRef.current = 0;
        setCurrentPhase((p) => (p + 1) % PHASES.length);
      }

      const progress = phaseTimerRef.current / phaseDuration;

      // Layout
      const threadAreaX = 30;
      const threadAreaWidth = 80;
      const cacheAreaX = width * 0.35;
      const cacheAreaWidth = width * 0.55;
      const threadSpacing = (height - 80) / 8;

      // Draw thread pool
      ctx.fillStyle = "rgba(99, 102, 241, 0.1)";
      ctx.beginPath();
      ctx.roundRect(threadAreaX - 10, 40, threadAreaWidth + 20, height - 60, 8);
      ctx.fill();
      ctx.strokeStyle = "rgba(99, 102, 241, 0.3)";
      ctx.stroke();

      ctx.fillStyle = "#6366F1";
      ctx.font = "bold 9px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("BLOCK-STM", threadAreaX + threadAreaWidth / 2, 55);
      ctx.font = "7px monospace";
      ctx.fillText("8 THREADS", threadAreaX + threadAreaWidth / 2, 67);

      // Draw threads
      threadsRef.current.forEach((thread, i) => {
        const ty = 80 + i * threadSpacing;
        thread.y = ty;
        thread.x = threadAreaX + threadAreaWidth / 2;

        // Thread status based on phase
        const phaseProgress = progress;
        if (currentPhase === 0) {
          // Parallel load - all threads request same module
          thread.status = phaseProgress < 0.3 ? "executing" :
                         phaseProgress < 0.5 ? "waiting" :
                         "cacheHit";
          thread.cacheLevel = phaseProgress > 0.5 ? (i === 0 ? "L2" : "L1") : null;
        } else if (currentPhase === 1) {
          // Cache promotion
          thread.status = "executing";
          thread.cacheLevel = phaseProgress > 0.5 ? "L3" : "L2";
        } else if (currentPhase === 2) {
          // Speculative execution
          thread.status = i < 4 ? "executing" : phaseProgress > 0.7 ? "executing" : "waiting";
        } else {
          // Bundle publish
          thread.status = phaseProgress > 0.6 ? "cacheHit" : "waiting";
        }

        // Thread circle
        const statusColor =
          thread.status === "executing" ? "#10B981" :
          thread.status === "waiting" ? "#F59E0B" :
          thread.status === "cacheHit" ? "#00D9A5" : "#6B7280";

        ctx.beginPath();
        ctx.fillStyle = statusColor + "30";
        ctx.arc(thread.x, ty, 14, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = statusColor;
        ctx.arc(thread.x, ty, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#000";
        ctx.font = "bold 8px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`T${i}`, thread.x, ty);

        // Draw connection line to cache
        if (thread.status === "cacheHit") {
          const cacheX = thread.cacheLevel === "L1" ? cacheAreaX + 50 :
                        thread.cacheLevel === "L2" ? cacheAreaX + cacheAreaWidth / 2 :
                        cacheAreaX + cacheAreaWidth - 50;

          ctx.strokeStyle = statusColor + "40";
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(thread.x + 15, ty);
          ctx.lineTo(cacheX, ty);
          ctx.stroke();
          ctx.setLineDash([]);

          // Animated dot
          const dotProgress = (timestamp / 500 + i * 0.1) % 1;
          const dotX = thread.x + 15 + (cacheX - thread.x - 15) * dotProgress;
          ctx.beginPath();
          ctx.fillStyle = statusColor;
          ctx.arc(dotX, ty, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Draw cache hierarchy
      const cacheY = 50;
      const cacheHeight = height - 80;
      const cacheLevelWidth = cacheAreaWidth / 3 - 10;

      const cacheLevels = [
        { name: "L1", desc: "Thread-Local", color: "#00D9A5", fill: 0.9 },
        { name: "L2", desc: "Block-Shared", color: "#3B82F6", fill: 0.5 },
        { name: "L3", desc: "Epoch-Global", color: "#F59E0B", fill: 0.3 },
      ];

      cacheLevels.forEach((cache, i) => {
        const cx = cacheAreaX + i * (cacheLevelWidth + 10);
        const isActive = (currentPhase === 0 && i <= 1) ||
                        (currentPhase === 1 && i >= 1) ||
                        (currentPhase === 2) ||
                        (currentPhase === 3 && i === 1);

        // Cache box
        ctx.fillStyle = cache.color + (isActive ? "20" : "08");
        ctx.beginPath();
        ctx.roundRect(cx, cacheY, cacheLevelWidth, cacheHeight, 8);
        ctx.fill();

        ctx.strokeStyle = cache.color + (isActive ? "80" : "30");
        ctx.lineWidth = isActive ? 2 : 1;
        ctx.stroke();

        // Cache label
        ctx.fillStyle = cache.color;
        ctx.font = "bold 14px monospace";
        ctx.textAlign = "center";
        ctx.fillText(cache.name, cx + cacheLevelWidth / 2, cacheY + 25);

        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.font = "8px system-ui";
        ctx.fillText(cache.desc, cx + cacheLevelWidth / 2, cacheY + 42);

        // Module entries visualization
        const entryHeight = 12;
        const entryGap = 4;
        const numEntries = Math.floor((cacheHeight - 80) / (entryHeight + entryGap));
        const filledEntries = Math.floor(numEntries * cache.fill * (0.5 + progress * 0.5));

        for (let e = 0; e < numEntries; e++) {
          const ey = cacheY + 60 + e * (entryHeight + entryGap);
          const isFilled = e < filledEntries;
          const isNew = e === filledEntries - 1 && progress > 0.5;

          ctx.fillStyle = isFilled ? cache.color + (isNew ? "80" : "40") : "rgba(255,255,255,0.05)";
          ctx.beginPath();
          ctx.roundRect(cx + 8, ey, cacheLevelWidth - 16, entryHeight, 3);
          ctx.fill();

          if (isFilled) {
            ctx.fillStyle = "rgba(255,255,255,0.5)";
            ctx.font = "6px monospace";
            ctx.textAlign = "left";
            ctx.fillText(`0x${(e * 1234).toString(16).slice(0, 4)}::mod`, cx + 12, ey + 8);
          }
        }

        // Promotion arrow (L2 → L3)
        if (i === 1 && currentPhase === 1 && progress > 0.5) {
          const arrowX = cx + cacheLevelWidth + 5;
          ctx.strokeStyle = "#F59E0B";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(arrowX - 3, cacheY + cacheHeight / 2);
          ctx.lineTo(arrowX + 8, cacheY + cacheHeight / 2);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(arrowX + 5, cacheY + cacheHeight / 2 - 4);
          ctx.lineTo(arrowX + 10, cacheY + cacheHeight / 2);
          ctx.lineTo(arrowX + 5, cacheY + cacheHeight / 2 + 4);
          ctx.stroke();

          ctx.fillStyle = "#F59E0B";
          ctx.font = "7px monospace";
          ctx.textAlign = "center";
          ctx.fillText("PROMOTE", arrowX + 3, cacheY + cacheHeight / 2 - 10);
        }
      });

      // Title
      ctx.fillStyle = "#00D9A5";
      ctx.font = "bold 11px system-ui";
      ctx.textAlign = "left";
      ctx.fillText("LOADER V2: PARALLEL EXECUTION", 15, 20);

      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "9px monospace";
      ctx.textAlign = "right";
      ctx.fillText("AIP-107 · 14.1x faster publishing", width - 15, 20);

      // Phase indicator
      ctx.fillStyle = "#00D9A5";
      ctx.font = "bold 8px monospace";
      ctx.textAlign = "left";
      ctx.fillText(PHASES[currentPhase].name, 15, 35);

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationRef.current);
  }, [currentPhase, isVisible]);

  const phase = PHASES[currentPhase];

  return (
    <div ref={containerRef} className="chrome-card p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="section-title">Loader V2: Parallelization</h3>
          <p className="text-xs" style={{ color: "var(--chrome-600)" }}>
            How shared caching enables parallel contract execution
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-2 py-1 rounded bg-white/10" style={{ color: "#00D9A5" }}>
            AIP-107
          </span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full rounded"
        style={{ height: "280px" }}
      />

      {/* Phase explanation */}
      <div className="mt-4 p-3 rounded-lg bg-white/5 border border-white/10">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="px-2 py-0.5 rounded text-xs font-bold"
            style={{ backgroundColor: "#00D9A5", color: "#000" }}
          >
            Phase {currentPhase + 1}/4
          </span>
          <span className="text-sm font-bold" style={{ color: "#00D9A5" }}>
            {phase.title}
          </span>
        </div>

        <p className="text-xs mb-3" style={{ color: "var(--chrome-400)" }}>
          {phase.desc}
        </p>

        <div className="space-y-2">
          <div className="p-2 rounded bg-white/5">
            <div className="text-[10px] font-bold mb-1" style={{ color: "#3B82F6" }}>Technical:</div>
            <p className="text-xs font-mono" style={{ color: "var(--chrome-500)" }}>
              {phase.technical}
            </p>
          </div>

          <div className="p-2 rounded bg-white/5">
            <div className="text-[10px] font-bold mb-1" style={{ color: "#00D9A5" }}>Mechanics:</div>
            <p className="text-xs" style={{ color: "var(--chrome-500)" }}>
              {phase.mechanic}
            </p>
          </div>
        </div>

        {/* Timeline */}
        <div className="flex items-center gap-1 mt-3">
          {PHASES.map((p, i) => (
            <div key={i} className="flex-1">
              <div
                className="h-1.5 rounded-full transition-all"
                style={{
                  backgroundColor: i <= currentPhase ? "#00D9A5" : "rgba(255,255,255,0.1)",
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Comparison: Legacy vs V2 */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="p-2 rounded bg-red-500/10 border border-red-500/20">
          <div className="text-[10px] font-bold mb-1" style={{ color: "#EF4444" }}>Legacy Loader</div>
          <ul className="text-[9px] space-y-0.5" style={{ color: "var(--chrome-500)" }}>
            <li>• Per-thread cache (no sharing)</li>
            <li>• 32x redundant loading</li>
            <li>• Cache discarded per block</li>
          </ul>
        </div>
        <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20">
          <div className="text-[10px] font-bold mb-1" style={{ color: "#00D9A5" }}>Loader V2</div>
          <ul className="text-[9px] space-y-0.5" style={{ color: "var(--chrome-500)" }}>
            <li>• Shared L1→L2→L3 hierarchy</li>
            <li>• Lock-free reads (~90% L1)</li>
            <li>• Epoch-persistent cache</li>
          </ul>
        </div>
      </div>
    </div>
  );
});
