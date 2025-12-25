"use client";

import { useRef, useEffect, useState, memo } from "react";
import { useVisibility } from "@/hooks/useVisibility";
import { Tooltip, LearnMoreLink } from "@/components/ui/tooltip";
import { glossary } from "@/data/glossary";

/**
 * Loader V2: Multi-Level Code Caching - Mobile-optimized
 */

interface CacheRequest {
  id: number;
  moduleId: string;
  x: number;
  y: number;
  targetLevel: 1 | 2 | 3 | "miss";
  state: "checking" | "hit" | "miss" | "done";
  progress: number;
}

const CACHE_LEVELS = [
  { level: "L1", name: "Thread", color: "#00D9A5", hitRate: "90%", latency: "<1μs" },
  { level: "L2", name: "Block", color: "#3B82F6", hitRate: "8%", latency: "5μs" },
  { level: "L3", name: "Epoch", color: "#F59E0B", hitRate: "2%", latency: "50μs" },
];

const STEPS = [
  { title: "Cache Lookup", desc: "TX needs module code" },
  { title: "L1 Check", desc: "Thread-local ~90% hit" },
  { title: "L2 Check", desc: "Block cache ~8% hit" },
  { title: "L3/Load", desc: "Epoch cache or storage" },
];

export const LoaderV2Caching = memo(function LoaderV2Caching() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const requestsRef = useRef<CacheRequest[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [stats, setStats] = useState({ l1Hits: 0, l2Hits: 0, l3Hits: 0, misses: 0 });
  const isVisible = useVisibility(containerRef);
  const [isMobile, setIsMobile] = useState(false);
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

      // Step timer
      stepTimerRef.current++;
      if (stepTimerRef.current > 50) {
        stepTimerRef.current = 0;
        const nextStep = (currentStep + 1) % 4;
        setCurrentStep(nextStep);

        if (nextStep === 0) {
          const rand = Math.random();
          let targetLevel: 1 | 2 | 3 | "miss";
          if (rand < 0.90) targetLevel = 1;
          else if (rand < 0.98) targetLevel = 2;
          else if (rand < 0.999) targetLevel = 3;
          else targetLevel = "miss";

          requestsRef.current.push({
            id: requestIdRef.current++,
            moduleId: `0x${Math.random().toString(16).slice(2, 6)}`,
            x: 30,
            y: height / 2,
            targetLevel,
            state: "checking",
            progress: 0,
          });

          setStats((s) => ({
            l1Hits: s.l1Hits + (targetLevel === 1 ? 1 : 0),
            l2Hits: s.l2Hits + (targetLevel === 2 ? 1 : 0),
            l3Hits: s.l3Hits + (targetLevel === 3 ? 1 : 0),
            misses: s.misses + (targetLevel === "miss" ? 1 : 0),
          }));
        }
      }

      // Layout - use more screen width
      const padding = mobile ? 5 : 15;
      const vmWidth = mobile ? 35 : 50;
      const cacheStartX = padding + vmWidth + 10;
      const cacheEndX = width - padding;
      const cacheGap = mobile ? 5 : 12;
      const cacheWidth = (cacheEndX - cacheStartX - cacheGap * 2) / 3;
      const cacheHeight = height - (mobile ? 60 : 80);
      const cacheY = mobile ? 30 : 45;

      // Draw VM request source
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.beginPath();
      ctx.roundRect(padding, cacheY, vmWidth, cacheHeight, 4);
      ctx.fill();

      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = mobile ? "bold 7px monospace" : "bold 8px monospace";
      ctx.textAlign = "center";
      ctx.fillText("VM", padding + vmWidth / 2, cacheY + (mobile ? 15 : 20));

      // Draw cache levels
      CACHE_LEVELS.forEach((cache, i) => {
        const x = cacheStartX + i * (cacheWidth + cacheGap);

        const isActive = currentStep === i + 1;
        ctx.fillStyle = cache.color + (isActive ? "20" : "08");
        ctx.beginPath();
        ctx.roundRect(x, cacheY, cacheWidth, cacheHeight, mobile ? 4 : 6);
        ctx.fill();

        ctx.strokeStyle = cache.color + (isActive ? "80" : "30");
        ctx.lineWidth = isActive ? 2 : 1;
        ctx.stroke();

        // Cache level label
        ctx.fillStyle = cache.color;
        ctx.font = mobile ? "bold 10px monospace" : "bold 14px monospace";
        ctx.textAlign = "center";
        ctx.fillText(cache.level, x + cacheWidth / 2, cacheY + (mobile ? 18 : 25));

        // Cache name
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.font = mobile ? "bold 7px system-ui" : "bold 9px system-ui";
        ctx.fillText(cache.name, x + cacheWidth / 2, cacheY + (mobile ? 32 : 42));

        // Stats
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = mobile ? "6px monospace" : "8px monospace";
        ctx.fillText(cache.hitRate, x + cacheWidth / 2, cacheY + (mobile ? 48 : 58));
        ctx.fillText(cache.latency, x + cacheWidth / 2, cacheY + (mobile ? 60 : 72));

        // Size bar
        const barWidth = cacheWidth - (mobile ? 10 : 16);
        const fillRatio = [0.3, 0.5, 0.8][i];
        ctx.fillStyle = "rgba(255,255,255,0.1)";
        ctx.fillRect(x + (cacheWidth - barWidth) / 2, cacheY + cacheHeight - (mobile ? 18 : 22), barWidth, mobile ? 5 : 6);
        ctx.fillStyle = cache.color + "60";
        ctx.fillRect(x + (cacheWidth - barWidth) / 2, cacheY + cacheHeight - (mobile ? 18 : 22), barWidth * fillRatio, mobile ? 5 : 6);
      });

      // Draw and update requests
      requestsRef.current = requestsRef.current.filter((req) => {
        req.progress += 0.03;

        let targetX = cacheStartX;
        if (req.targetLevel === 1) {
          targetX = cacheStartX + cacheWidth / 2;
        } else if (req.targetLevel === 2) {
          targetX = cacheStartX + cacheWidth + cacheGap + cacheWidth / 2;
        } else if (req.targetLevel === 3 || req.targetLevel === "miss") {
          targetX = cacheStartX + 2 * (cacheWidth + cacheGap) + cacheWidth / 2;
        }

        req.x += (targetX - req.x) * 0.08;

        const reachedTarget = Math.abs(req.x - targetX) < 5;
        if (reachedTarget && req.state === "checking") {
          req.state = req.targetLevel === "miss" ? "miss" : "hit";
        }

        const size = req.state === "hit" ? (mobile ? 6 : 8) : (mobile ? 4 : 5);
        let color = "#fff";
        if (req.state === "hit") {
          color = req.targetLevel === 1 ? "#00D9A5" : req.targetLevel === 2 ? "#3B82F6" : "#F59E0B";
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

        // Hit/miss label
        if (reachedTarget) {
          ctx.fillStyle = req.state === "hit" ? "#00D9A5" : "#EF4444";
          ctx.font = mobile ? "bold 7px monospace" : "bold 9px monospace";
          ctx.fillText(req.state === "hit" ? "HIT" : "MISS", req.x, req.y - (mobile ? 10 : 14));
        }

        return req.progress < 2;
      });

      // Title
      ctx.fillStyle = "#00D9A5";
      ctx.font = mobile ? "bold 8px system-ui" : "bold 11px system-ui";
      ctx.textAlign = "left";
      ctx.fillText(mobile ? "LOADER V2 CACHE" : "LOADER V2: MULTI-LEVEL CACHING", padding, mobile ? 12 : 18);

      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = mobile ? "6px monospace" : "9px monospace";
      ctx.textAlign = "right";
      ctx.fillText("60% faster", width - padding, mobile ? 12 : 18);

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationRef.current);
  }, [currentStep, isVisible]);

  const totalRequests = stats.l1Hits + stats.l2Hits + stats.l3Hits + stats.misses;
  const l1Rate = totalRequests > 0 ? ((stats.l1Hits / totalRequests) * 100).toFixed(0) : "0";

  return (
    <div ref={containerRef} className="chrome-card p-2 sm:p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="min-w-0">
          <h3 className="text-xs sm:text-sm font-bold" style={{ color: "var(--chrome-200)" }}>
            Loader V2: Code Caching
          </h3>
          <p className="text-[9px] sm:text-xs" style={{ color: "var(--chrome-600)" }}>
            {isMobile ? "L1→L2→L3 cache" : "Multi-level bytecode caching"}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[9px] sm:text-xs font-mono flex-shrink-0">
          <span style={{ color: "#00D9A5" }}>L1:{l1Rate}%</span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full rounded"
        style={{ height: isMobile ? "160px" : "220px" }}
      />

      {/* Step explanation - very compact on mobile */}
      <div className="mt-2 p-2 rounded-lg bg-white/5 border border-white/10">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="px-1.5 py-0.5 rounded text-[8px] sm:text-xs font-bold flex-shrink-0"
            style={{ backgroundColor: "#00D9A5", color: "#000" }}
          >
            {currentStep + 1}/4
          </span>
          <span className="text-[10px] sm:text-sm font-bold" style={{ color: "#00D9A5" }}>
            {STEPS[currentStep].title}
          </span>
        </div>
        <p className="text-[9px] sm:text-xs" style={{ color: "var(--chrome-400)" }}>
          {STEPS[currentStep].desc}
        </p>
      </div>

      {/* Stats grid - full width */}
      <div className="mt-2 grid grid-cols-3 gap-1">
        {CACHE_LEVELS.map((cache, i) => (
          <div key={cache.level} className="p-1.5 rounded bg-white/5 text-center">
            <div className="text-sm sm:text-lg font-bold" style={{ color: cache.color }}>
              {cache.level}
            </div>
            <div className="text-[8px] sm:text-[10px]" style={{ color: "var(--chrome-500)" }}>
              {cache.hitRate} · {cache.latency}
            </div>
          </div>
        ))}
      </div>

      {/* Key insight - shorter on mobile */}
      <div className="mt-2 p-1.5 rounded bg-white/5">
        <p className="text-[8px] sm:text-xs" style={{ color: "var(--chrome-500)" }}>
          <span className="font-bold" style={{ color: "#00D9A5" }}>AIP-107:</span>
          {isMobile
            ? " 90% L1 hit → 60% faster execution"
            : " ~90% L1 hit rate. L2→L3 promotion at block commit. Result: 60% faster, 14x faster module publishing."
          }
        </p>
      </div>
    </div>
  );
});
