"use client";

import { useRef, useEffect, useState, memo } from "react";
import { useVisibility } from "@/hooks/useVisibility";

/**
 * Loader V2: Multi-Level Code Caching
 *
 * Shows how Aptos achieves 60% faster execution through:
 * - L1: Thread-local cache (hot path, per-worker)
 * - L2: Block-level cache (shared within block execution)
 * - L3: Epoch cache (persisted across blocks)
 *
 * Cache lookups avoid expensive module deserialization and verification.
 */

interface CacheRequest {
  id: number;
  moduleId: string;
  x: number;
  y: number;
  targetLevel: 1 | 2 | 3 | "miss";
  state: "checking" | "hit" | "miss" | "loading" | "done";
  progress: number;
}

const CACHE_LEVELS = [
  {
    level: "L1",
    name: "Thread Cache",
    color: "#00D9A5",
    hitRate: "~90%",
    latency: "<1μs",
    desc: "Per-worker thread-local cache for hot modules",
    size: "Small",
  },
  {
    level: "L2",
    name: "Block Cache",
    color: "#3B82F6",
    hitRate: "~8%",
    latency: "~5μs",
    desc: "Shared cache within block execution context",
    size: "Medium",
  },
  {
    level: "L3",
    name: "Epoch Cache",
    color: "#F59E0B",
    hitRate: "~1.9%",
    latency: "~50μs",
    desc: "Persistent cache across entire epoch",
    size: "Large",
  },
];

const STEPS = [
  {
    title: "Cache Lookup",
    desc: "Transaction needs module code for execution",
    technical: "VM requests module bytecode via ModuleStorage trait",
    mechanic: "Move interpreter hits CALL opcode → needs FunctionDefinition → resolver queries ModuleStorage::fetch_module(address, module_name). Returns Arc<CompiledModule> if cached, else triggers load pipeline.",
  },
  {
    title: "L1 Check (Thread)",
    desc: "Check thread-local cache first (fastest path)",
    technical: "Thread-local HashMap lookup, ~90% hit rate, <1μs",
    mechanic: "L1 stores raw pointers to verified modules. Zero synchronization—each Block-STM thread has private L1. On hit: return pointer directly. On miss: fall through to L2. Hot modules (aptos_framework, coin) almost always hit L1.",
  },
  {
    title: "L2 Check (Block)",
    desc: "Check block-level shared cache",
    technical: "RwLock<HashMap> lookup, shared across 32 workers, ~5μs",
    mechanic: "L2 uses concurrent HashMap with RwLock. Read lock acquired → O(1) lookup. On miss: write lock acquired → load from L3 or storage → insert → release lock. Other threads waiting will find entry after release.",
  },
  {
    title: "L3/Load",
    desc: "Check epoch cache or load from storage",
    technical: "Lock-free epoch cache (~50μs) or full deserialize + verify cycle (~500μs)",
    mechanic: "L3 is lock-free (epoch versioning). On hit: atomic read. On miss: fetch from RocksDB → deserialize BCS bytes → run 4-stage verifier (Stack, Type, Locals, RefSafe) → link dependencies → store in L2 → promote to L3 at block commit.",
  },
];

export const LoaderV2Caching = memo(function LoaderV2Caching() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const requestsRef = useRef<CacheRequest[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [stats, setStats] = useState({ l1Hits: 0, l2Hits: 0, l3Hits: 0, misses: 0 });
  const isVisible = useVisibility(containerRef);
  const stepTimerRef = useRef(0);
  const requestIdRef = useRef(0);

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

      // Clear
      ctx.fillStyle = "#0a0a0b";
      ctx.fillRect(0, 0, width, height);

      // Step timer
      stepTimerRef.current++;
      const stepDuration = 50;

      if (stepTimerRef.current > stepDuration) {
        stepTimerRef.current = 0;
        const nextStep = (currentStep + 1) % 4;
        setCurrentStep(nextStep);

        // Spawn new request at step 0
        if (nextStep === 0) {
          // Determine cache hit level based on realistic distribution
          const rand = Math.random();
          let targetLevel: 1 | 2 | 3 | "miss";
          if (rand < 0.90) targetLevel = 1;
          else if (rand < 0.98) targetLevel = 2;
          else if (rand < 0.999) targetLevel = 3;
          else targetLevel = "miss";

          requestsRef.current.push({
            id: requestIdRef.current++,
            moduleId: `0x${Math.random().toString(16).slice(2, 6)}::module`,
            x: 30,
            y: height / 2,
            targetLevel,
            state: "checking",
            progress: 0,
          });

          // Update stats
          setStats((s) => ({
            l1Hits: s.l1Hits + (targetLevel === 1 ? 1 : 0),
            l2Hits: s.l2Hits + (targetLevel === 2 ? 1 : 0),
            l3Hits: s.l3Hits + (targetLevel === 3 ? 1 : 0),
            misses: s.misses + (targetLevel === "miss" ? 1 : 0),
          }));
        }
      }

      // Layout
      const cacheStartX = width * 0.25;
      const cacheEndX = width * 0.85;
      const cacheWidth = (cacheEndX - cacheStartX) / 3 - 15;
      const cacheHeight = height - 100;
      const cacheY = 50;

      // Draw cache levels
      CACHE_LEVELS.forEach((cache, i) => {
        const x = cacheStartX + i * (cacheWidth + 15);

        // Cache box
        const isActive = currentStep === i + 1;
        ctx.fillStyle = cache.color + (isActive ? "20" : "08");
        ctx.beginPath();
        ctx.roundRect(x, cacheY, cacheWidth, cacheHeight, 8);
        ctx.fill();

        ctx.strokeStyle = cache.color + (isActive ? "80" : "30");
        ctx.lineWidth = isActive ? 2 : 1;
        ctx.stroke();

        // Cache level label
        ctx.fillStyle = cache.color;
        ctx.font = "bold 14px monospace";
        ctx.textAlign = "center";
        ctx.fillText(cache.level, x + cacheWidth / 2, cacheY + 25);

        // Cache name
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = "bold 9px system-ui";
        ctx.fillText(cache.name, x + cacheWidth / 2, cacheY + 42);

        // Cache stats
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = "8px monospace";
        ctx.fillText(`Hit: ${cache.hitRate}`, x + cacheWidth / 2, cacheY + 60);
        ctx.fillText(`Latency: ${cache.latency}`, x + cacheWidth / 2, cacheY + 75);

        // Size indicator (bars)
        const barWidth = cacheWidth - 20;
        const barHeight = 8;
        const fillRatio = [0.3, 0.5, 0.8][i];
        ctx.fillStyle = "rgba(255,255,255,0.1)";
        ctx.fillRect(x + 10, cacheY + cacheHeight - 25, barWidth, barHeight);
        ctx.fillStyle = cache.color + "60";
        ctx.fillRect(x + 10, cacheY + cacheHeight - 25, barWidth * fillRatio, barHeight);

        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.font = "7px monospace";
        ctx.fillText(cache.size, x + cacheWidth / 2, cacheY + cacheHeight - 8);
      });

      // Draw request source
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.beginPath();
      ctx.roundRect(20, cacheY, 60, cacheHeight, 6);
      ctx.fill();

      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "bold 8px monospace";
      ctx.textAlign = "center";
      ctx.fillText("VM", 50, cacheY + 20);
      ctx.fillText("REQUEST", 50, cacheY + 32);

      // Draw and update requests
      requestsRef.current = requestsRef.current.filter((req) => {
        req.progress += 0.03;

        // Determine target X based on which cache level will hit
        let targetX = cacheStartX;
        if (req.targetLevel === 1) {
          targetX = cacheStartX + cacheWidth / 2;
        } else if (req.targetLevel === 2) {
          targetX = cacheStartX + cacheWidth + 15 + cacheWidth / 2;
        } else if (req.targetLevel === 3) {
          targetX = cacheStartX + 2 * (cacheWidth + 15) + cacheWidth / 2;
        } else {
          targetX = cacheEndX + 30;
        }

        // Animate position
        req.x += (targetX - req.x) * 0.08;

        // Determine state based on position
        const reachedTarget = Math.abs(req.x - targetX) < 5;

        if (reachedTarget && req.state === "checking") {
          req.state = req.targetLevel === "miss" ? "miss" : "hit";
        }

        // Draw request
        const size = req.state === "hit" ? 8 : 5;
        let color = "#fff";
        if (req.state === "hit") {
          color =
            req.targetLevel === 1
              ? CACHE_LEVELS[0].color
              : req.targetLevel === 2
              ? CACHE_LEVELS[1].color
              : CACHE_LEVELS[2].color;
        } else if (req.state === "miss") {
          color = "#EF4444";
        }

        // Glow
        ctx.beginPath();
        const gradient = ctx.createRadialGradient(req.x, req.y, 0, req.x, req.y, size * 2);
        gradient.addColorStop(0, color + "80");
        gradient.addColorStop(1, "transparent");
        ctx.fillStyle = gradient;
        ctx.arc(req.x, req.y, size * 2, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.arc(req.x, req.y, size, 0, Math.PI * 2);
        ctx.fill();

        // Hit/miss indicator
        if (reachedTarget) {
          ctx.fillStyle = req.state === "hit" ? "#00D9A5" : "#EF4444";
          ctx.font = "bold 10px monospace";
          ctx.fillText(req.state === "hit" ? "HIT" : "MISS", req.x, req.y - 15);
        }

        return req.progress < 2;
      });

      // Draw flow arrows
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);

      ctx.beginPath();
      ctx.moveTo(85, height / 2);
      ctx.lineTo(cacheStartX - 10, height / 2);
      ctx.stroke();

      for (let i = 0; i < 2; i++) {
        const x1 = cacheStartX + i * (cacheWidth + 15) + cacheWidth + 5;
        const x2 = x1 + 10;
        ctx.beginPath();
        ctx.moveTo(x1, height / 2);
        ctx.lineTo(x2, height / 2);
        ctx.stroke();
      }

      ctx.setLineDash([]);

      // Title
      ctx.fillStyle = "#00D9A5";
      ctx.font = "bold 11px system-ui";
      ctx.textAlign = "left";
      ctx.fillText("LOADER V2: MULTI-LEVEL CACHING", 15, 20);

      // Performance stat
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "right";
      ctx.fillText("60% faster execution", width - 15, 20);

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationRef.current);
  }, [currentStep, isVisible]);

  const totalRequests = stats.l1Hits + stats.l2Hits + stats.l3Hits + stats.misses;
  const l1Rate = totalRequests > 0 ? ((stats.l1Hits / totalRequests) * 100).toFixed(0) : "0";
  const l2Rate = totalRequests > 0 ? ((stats.l2Hits / totalRequests) * 100).toFixed(0) : "0";
  const l3Rate = totalRequests > 0 ? ((stats.l3Hits / totalRequests) * 100).toFixed(0) : "0";

  return (
    <div ref={containerRef} className="chrome-card p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="section-title">Loader V2: Code Caching</h3>
          <p className="text-xs" style={{ color: "var(--chrome-600)" }}>
            Multi-level caching for module bytecode
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono">
          <span style={{ color: CACHE_LEVELS[0].color }}>L1: {l1Rate}%</span>
          <span style={{ color: CACHE_LEVELS[1].color }}>L2: {l2Rate}%</span>
          <span style={{ color: CACHE_LEVELS[2].color }}>L3: {l3Rate}%</span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full rounded"
        style={{ height: "240px" }}
      />

      {/* Step explanation */}
      <div className="mt-4 p-3 rounded-lg bg-white/5 border border-white/10">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="px-2 py-0.5 rounded text-xs font-bold"
            style={{ backgroundColor: "#00D9A5", color: "#000" }}
          >
            Step {currentStep + 1}/4
          </span>
          <span className="text-sm font-bold" style={{ color: "#00D9A5" }}>
            {STEPS[currentStep].title}
          </span>
        </div>

        <p className="text-xs mb-3" style={{ color: "var(--chrome-400)" }}>
          {STEPS[currentStep].desc}
        </p>

        <div className="space-y-2">
          <div className="p-2 rounded bg-white/5">
            <div className="text-[10px] font-bold mb-1" style={{ color: "#3B82F6" }}>Technical:</div>
            <p className="text-xs font-mono" style={{ color: "var(--chrome-500)" }}>
              {STEPS[currentStep].technical}
            </p>
          </div>

          <div className="p-2 rounded bg-white/5">
            <div className="text-[10px] font-bold mb-1" style={{ color: "#00D9A5" }}>How It Works:</div>
            <p className="text-xs" style={{ color: "var(--chrome-500)" }}>
              {STEPS[currentStep].mechanic}
            </p>
          </div>
        </div>

        {/* Timeline */}
        <div className="flex items-center gap-1 mt-3">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="flex-1 h-1.5 rounded-full transition-all"
              style={{
                backgroundColor: i <= currentStep ? "#00D9A5" : "rgba(255,255,255,0.1)",
              }}
            />
          ))}
        </div>
      </div>

      {/* Key insight */}
      <div className="mt-2 p-2 rounded bg-white/5">
        <p className="text-xs" style={{ color: "var(--chrome-500)" }}>
          <span className="font-bold" style={{ color: "#00D9A5" }}>Key Innovation (AIP-107):</span>
          {" "}~90% of module requests hit L1 (thread-local pointers), avoiding all locks and deserialization. L2→L3 promotion at block commit ensures hot modules persist across blocks. Module bundle publishing fixes init_module linking issues. Result: 60% faster block execution, 14.1x faster module publishing.
        </p>
      </div>
    </div>
  );
});
