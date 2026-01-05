"use client";

import { memo, useEffect, useRef, useState, useCallback } from "react";
import { Application, Graphics } from "pixi.js";
import { useVisibility } from "@/hooks/useVisibility";
import { PIXI_COLORS } from "@/lib/pixi-utils";

interface StableFeesStressProps {
  className?: string;
}

// REALISTIC numbers based on actual chain behavior
// Solana: ~4K-10K TPS sustained, drops 10-30% under heavy load
// Aptos: ~30K+ TPS demonstrated, 160K theoretical, minimal drops
const CONFIG = {
  cycleDuration: 30000, // 30 second full cycle
  // Realistic transaction counts per spawn (not TPS, visual particles)
  lowLoad: 2,      // Normal: both handle fine
  mediumLoad: 4,   // Moderate: Solana starts queuing
  highLoad: 6,     // Heavy: Solana drops some (10-20%)
  peakLoad: 8,     // Peak: Solana drops more (20-30%)

  // Solana realistic behavior
  solanaThreads: 4,
  solanaQueueMax: 20,           // Reasonable queue
  solanaProcessRate: 3,         // Txs processed per frame
  solanaDropChanceAtCapacity: 0.15, // 15% drop when queue is filling
  solanaDropChanceOverflow: 0.4,    // 40% drop when queue is full

  // Aptos behavior
  aptosThreads: 12,
  aptosProcessRate: 8,          // Much higher throughput
};

interface Tx {
  id: number;
  x: number;
  y: number;
  targetY: number;
  state: "incoming" | "queued" | "executing" | "done" | "dropped";
  thread: number;
  progress: number;
  speed: number;
}

export const StableFeesStress = memo(function StableFeesStress({
  className,
}: StableFeesStressProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const initAttemptedRef = useRef(false);
  const mountedRef = useRef(true);

  const startTimeRef = useRef<number>(0);
  const lastSpawnRef = useRef(0);
  const txIdRef = useRef(0);
  const solanaTxsRef = useRef<Tx[]>([]);
  const aptosTxsRef = useRef<Tx[]>([]);
  const solanaQueueRef = useRef<Tx[]>([]);

  const graphicsRef = useRef<{
    bg: Graphics | null;
    solana: Graphics | null;
    aptos: Graphics | null;
  }>({ bg: null, solana: null, aptos: null });

  const [isReady, setIsReady] = useState(false);
  const [solanaConfirmed, setSolanaConfirmed] = useState(0);
  const [solanaDropped, setSolanaDropped] = useState(0);
  const [currentTPS, setCurrentTPS] = useState(0);

  const isVisible = useVisibility(containerRef);

  const updateAnimation = useCallback(() => {
    if (!mountedRef.current) return;
    const app = appRef.current;
    if (!app) return;

    try {
      if (!app.renderer || !app.stage) return;
    } catch { return; }

    const now = performance.now();
    const elapsed = now - startTimeRef.current;
    const cycleProgress = (elapsed % CONFIG.cycleDuration) / CONFIG.cycleDuration;

    const width = app.screen.width;
    const height = app.screen.height;
    if (width < 10 || height < 10) return;

    // TPS simulation - realistic ranges
    // Solana handles ~5-10K TPS normally, struggles above 10K
    let tps: number;
    let spawnCount: number;

    if (cycleProgress < 0.25) {
      // Normal: 5K TPS
      tps = 5000;
      spawnCount = CONFIG.lowLoad;
    } else if (cycleProgress < 0.5) {
      // Busy: 10K TPS (Solana's limit)
      tps = 10000;
      spawnCount = CONFIG.mediumLoad;
    } else if (cycleProgress < 0.75) {
      // Heavy: 20K TPS (over Solana capacity)
      tps = 20000;
      spawnCount = CONFIG.highLoad;
    } else if (cycleProgress < 0.9) {
      // Peak: 30K TPS (way over Solana)
      tps = 30000;
      spawnCount = CONFIG.peakLoad;
    } else {
      // Cool down
      tps = 10000;
      spawnCount = CONFIG.mediumLoad;
    }
    setCurrentTPS(tps);

    const halfWidth = width / 2;
    const padding = 20;

    // Layout - cleaner spacing
    const solanaStart = padding;
    const solanaQueue = 80;
    const solanaExecStart = 140;
    const solanaExecEnd = halfWidth - padding - 10;
    const threadHeight = (height - 80) / CONFIG.solanaThreads;

    const aptosStart = halfWidth + padding;
    const aptosDispatch = halfWidth + 60;
    const aptosExecStart = halfWidth + 100;
    const aptosExecEnd = width - padding - 10;
    const aptosThreadHeight = (height - 60) / CONFIG.aptosThreads;

    // ===== SPAWN =====
    const spawnInterval = 150; // Spawn every 150ms - much calmer
    if (now - lastSpawnRef.current > spawnInterval) {
      lastSpawnRef.current = now;

      for (let i = 0; i < spawnCount; i++) {
        const txId = txIdRef.current++;

        // Solana tx
        solanaTxsRef.current.push({
          id: txId,
          x: solanaStart,
          y: height / 2 + (Math.random() - 0.5) * 120,
          targetY: 0,
          state: "incoming",
          thread: -1,
          progress: 0,
          speed: 2 + Math.random(),
        });

        // Aptos tx - assigned to thread immediately
        const aptosThread = Math.floor(Math.random() * CONFIG.aptosThreads);
        aptosTxsRef.current.push({
          id: txId,
          x: aptosStart,
          y: 40 + aptosThread * aptosThreadHeight + aptosThreadHeight / 2,
          targetY: 40 + aptosThread * aptosThreadHeight + aptosThreadHeight / 2,
          state: "incoming",
          thread: aptosThread,
          progress: 0,
          speed: 3 + Math.random(),
        });
      }
    }

    // ===== BACKGROUND =====
    const bg = graphicsRef.current.bg;
    if (bg) {
      bg.clear();
      bg.rect(0, 0, width, height);
      bg.fill({ color: 0x0a0a0f });

      // Divider
      bg.rect(halfWidth - 1, 0, 2, height);
      bg.fill({ color: 0x1f2937 });
    }

    // ===== SOLANA =====
    const solana = graphicsRef.current.solana;
    if (solana) {
      solana.clear();

      // Queue box
      const queueFill = solanaQueueRef.current.length / CONFIG.solanaQueueMax;
      const queueColor = queueFill > 0.8 ? 0xef4444 : queueFill > 0.5 ? 0xfbbf24 : 0x3b82f6;

      solana.roundRect(solanaQueue - 15, 50, 30, height - 100, 6);
      solana.fill({ color: queueColor, alpha: 0.15 });
      solana.stroke({ color: queueColor, width: 2, alpha: 0.6 });

      // Queue fill level
      if (queueFill > 0) {
        const fillHeight = (height - 110) * queueFill;
        solana.roundRect(solanaQueue - 12, height - 55 - fillHeight, 24, fillHeight, 4);
        solana.fill({ color: queueColor, alpha: 0.4 });
      }

      // Execution threads
      for (let i = 0; i < CONFIG.solanaThreads; i++) {
        const ty = 50 + i * threadHeight + threadHeight / 2;
        solana.roundRect(solanaExecStart, ty - 5, solanaExecEnd - solanaExecStart, 10, 3);
        solana.fill({ color: 0x1e293b });
      }

      // Process incoming -> queue or drop
      const queuePressure = solanaQueueRef.current.length / CONFIG.solanaQueueMax;

      solanaTxsRef.current.forEach(tx => {
        if (tx.state === "incoming") {
          tx.x += tx.speed;

          if (tx.x >= solanaQueue - 20) {
            // Decide: queue or drop based on realistic probability
            let dropChance = 0;
            if (queuePressure > 0.9) {
              dropChance = CONFIG.solanaDropChanceOverflow;
            } else if (queuePressure > 0.6) {
              dropChance = CONFIG.solanaDropChanceAtCapacity * queuePressure;
            }

            if (Math.random() < dropChance) {
              tx.state = "dropped";
              setSolanaDropped(prev => prev + 1);
            } else if (solanaQueueRef.current.length < CONFIG.solanaQueueMax) {
              tx.state = "queued";
              solanaQueueRef.current.push(tx);
            } else {
              tx.state = "dropped";
              setSolanaDropped(prev => prev + 1);
            }
          }
        }
      });

      // Process queue -> execution (limited rate)
      const busyThreads = new Set(
        solanaTxsRef.current.filter(t => t.state === "executing").map(t => t.thread)
      );

      let processed = 0;
      while (solanaQueueRef.current.length > 0 && processed < CONFIG.solanaProcessRate) {
        let freeThread = -1;
        for (let t = 0; t < CONFIG.solanaThreads; t++) {
          if (!busyThreads.has(t)) { freeThread = t; break; }
        }
        if (freeThread === -1) break;

        const tx = solanaQueueRef.current.shift()!;
        tx.state = "executing";
        tx.thread = freeThread;
        tx.x = solanaExecStart;
        tx.targetY = 50 + freeThread * threadHeight + threadHeight / 2;
        busyThreads.add(freeThread);
        processed++;
      }

      // Update queue positions
      solanaQueueRef.current.forEach((tx, i) => {
        tx.x = solanaQueue;
        tx.y = height - 60 - i * 8;
      });

      // Draw and update txs
      solanaTxsRef.current = solanaTxsRef.current.filter(tx => {
        if (tx.state === "incoming") {
          solana.circle(tx.x, tx.y, 5);
          solana.fill({ color: 0x60a5fa, alpha: 0.9 });
          return true;
        }

        if (tx.state === "queued") {
          solana.circle(tx.x, tx.y, 4);
          solana.fill({ color: 0xfbbf24, alpha: 0.9 });
          return true;
        }

        if (tx.state === "executing") {
          tx.y += (tx.targetY - tx.y) * 0.15;
          tx.x += 2;
          tx.progress = (tx.x - solanaExecStart) / (solanaExecEnd - solanaExecStart);

          solana.circle(tx.x, tx.y, 5);
          solana.fill({ color: 0x22c55e, alpha: 0.9 });

          // Trail
          const trailLen = Math.min(tx.x - solanaExecStart, 40);
          solana.rect(tx.x - trailLen, tx.y - 2, trailLen, 4);
          solana.fill({ color: 0x22c55e, alpha: 0.3 });

          if (tx.progress >= 1) {
            tx.state = "done";
            setSolanaConfirmed(prev => prev + 1);
          }
          return true;
        }

        if (tx.state === "dropped") {
          tx.y += 3;
          tx.x -= 1;
          solana.circle(tx.x, tx.y, 4);
          solana.fill({ color: 0xef4444, alpha: Math.max(0, 1 - (tx.y - height/2) / 200) });
          return tx.y < height + 20;
        }

        return false;
      });
    }

    // ===== APTOS =====
    const aptos = graphicsRef.current.aptos;
    if (aptos) {
      aptos.clear();

      // Dispatcher (no bottleneck visual)
      aptos.roundRect(aptosDispatch - 12, 40, 24, height - 80, 6);
      aptos.fill({ color: PIXI_COLORS.primary, alpha: 0.1 });
      aptos.stroke({ color: PIXI_COLORS.primary, width: 2, alpha: 0.4 });

      // Threads
      for (let i = 0; i < CONFIG.aptosThreads; i++) {
        const ty = 40 + i * aptosThreadHeight + aptosThreadHeight / 2;
        aptos.roundRect(aptosExecStart, ty - 4, aptosExecEnd - aptosExecStart, 8, 3);
        aptos.fill({ color: 0x1e293b });
      }

      // Process Aptos txs - straight through, no queue
      aptosTxsRef.current = aptosTxsRef.current.filter(tx => {
        if (tx.state === "incoming") {
          tx.x += tx.speed;
          if (tx.x >= aptosDispatch) {
            tx.state = "executing";
            tx.x = aptosExecStart;
          }
          aptos.circle(tx.x, tx.y, 5);
          aptos.fill({ color: PIXI_COLORS.primary, alpha: 0.9 });
          return true;
        }

        if (tx.state === "executing") {
          tx.x += 2.5;
          tx.progress = (tx.x - aptosExecStart) / (aptosExecEnd - aptosExecStart);

          aptos.circle(tx.x, tx.y, 5);
          aptos.fill({ color: PIXI_COLORS.primary, alpha: 0.9 });

          // Trail
          const trailLen = Math.min(tx.x - aptosExecStart, 40);
          aptos.rect(tx.x - trailLen, tx.y - 2, trailLen, 4);
          aptos.fill({ color: PIXI_COLORS.primary, alpha: 0.3 });

          if (tx.progress >= 1) {
            tx.state = "done";
          }
          return true;
        }

        return false;
      });
    }
  }, []);

  const initPixi = useCallback(async () => {
    const container = containerRef.current;
    if (!container || appRef.current) return;

    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    initAttemptedRef.current = true;

    const app = new Application();
    await app.init({
      width: rect.width,
      height: rect.height,
      backgroundColor: 0x0a0a0f,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    container.appendChild(app.canvas as HTMLCanvasElement);
    appRef.current = app;

    graphicsRef.current = {
      bg: new Graphics(),
      solana: new Graphics(),
      aptos: new Graphics(),
    };

    app.stage.addChild(graphicsRef.current.bg!);
    app.stage.addChild(graphicsRef.current.solana!);
    app.stage.addChild(graphicsRef.current.aptos!);

    startTimeRef.current = performance.now();
    mountedRef.current = true;
    setIsReady(true);

    app.ticker.add(updateAnimation);
    app.ticker.start();
  }, [updateAnimation]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          if (!appRef.current && !initAttemptedRef.current) {
            initPixi();
          } else if (appRef.current) {
            appRef.current.renderer.resize(width, height);
          }
        }
      }
    });
    resizeObserver.observe(container);

    const initTimeout = setTimeout(() => {
      if (!appRef.current && !initAttemptedRef.current) initPixi();
    }, 100);

    initPixi();

    return () => {
      mountedRef.current = false;
      clearTimeout(initTimeout);
      resizeObserver.disconnect();
      if (appRef.current) {
        appRef.current.ticker.stop();
        const canvas = appRef.current.canvas as HTMLCanvasElement;
        try { appRef.current.destroy(true, { children: true }); } catch {}
        if (canvas && container.contains(canvas)) container.removeChild(canvas);
        appRef.current = null;
      }
      graphicsRef.current = { bg: null, solana: null, aptos: null };
      initAttemptedRef.current = false;
      setIsReady(false);
    };
  }, [initPixi]);

  useEffect(() => {
    if (!appRef.current) return;
    if (isVisible) appRef.current.ticker.start();
    else appRef.current.ticker.stop();
  }, [isVisible]);

  const totalSolana = solanaConfirmed + solanaDropped;
  const dropRate = totalSolana > 0 ? Math.round((solanaDropped / totalSolana) * 100) : 0;

  // TPS color coding
  const tpsColor = currentTPS >= 30000 ? "#ef4444"
    : currentTPS >= 20000 ? "#f97316"
    : currentTPS >= 10000 ? "#fbbf24"
    : "#22c55e";

  return (
    <div className={`chrome-card p-4 sm:p-6 ${className || ""}`}>
      <div className="mb-4">
        <h3 className="section-title">Transaction Flow Under Load</h3>
        <p className="text-xs" style={{ color: "var(--chrome-500)" }}>
          How each chain handles increasing transaction demand
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-4 text-center text-xs">
        <div className="p-3 rounded-lg" style={{ backgroundColor: `${tpsColor}15`, border: `1px solid ${tpsColor}40` }}>
          <div className="text-xl font-bold" style={{ color: tpsColor }}>{(currentTPS / 1000).toFixed(0)}K</div>
          <div className="text-[10px] mt-1 mb-2" style={{ color: "var(--chrome-500)" }}>TPS Demand</div>
          {/* TPS Gauge */}
          <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(100, (currentTPS / 30000) * 100)}%`,
                backgroundColor: tpsColor,
              }}
            />
          </div>
          <div className="flex justify-between mt-1 text-[8px]" style={{ color: "var(--chrome-600)" }}>
            <span>0</span>
            <span>30K</span>
          </div>
        </div>
        <div className="p-3 rounded-lg" style={{ backgroundColor: "rgba(96, 165, 250, 0.1)", border: "1px solid rgba(96, 165, 250, 0.2)" }}>
          <div className="text-xl font-bold" style={{ color: "#60a5fa" }}>{solanaConfirmed}</div>
          <div className="text-[10px] mt-1" style={{ color: "var(--chrome-500)" }}>Solana Processed</div>
        </div>
        <div className="p-3 rounded-lg" style={{ backgroundColor: solanaDropped > 0 ? "rgba(239, 68, 68, 0.15)" : "rgba(255,255,255,0.03)", border: `1px solid ${solanaDropped > 0 ? "rgba(239, 68, 68, 0.3)" : "rgba(255,255,255,0.05)"}` }}>
          <div className="text-xl font-bold" style={{ color: solanaDropped > 0 ? "#ef4444" : "#6b7280" }}>{solanaDropped}</div>
          <div className="text-[10px] mt-1" style={{ color: "var(--chrome-500)" }}>Solana Dropped</div>
        </div>
        <div className="p-3 rounded-lg" style={{ backgroundColor: dropRate > 10 ? "rgba(239, 68, 68, 0.15)" : "rgba(255,255,255,0.03)", border: `1px solid ${dropRate > 10 ? "rgba(239, 68, 68, 0.3)" : "rgba(255,255,255,0.05)"}` }}>
          <div className="text-xl font-bold" style={{ color: dropRate > 10 ? "#ef4444" : dropRate > 0 ? "#fbbf24" : "#22c55e" }}>{dropRate}%</div>
          <div className="text-[10px] mt-1" style={{ color: "var(--chrome-500)" }}>Drop Rate</div>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative">
        <div
          ref={containerRef}
          className="canvas-wrap relative rounded-lg overflow-hidden"
          style={{ height: "340px", backgroundColor: "#0a0a0f" }}
        >
          {!isReady && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-sm" style={{ color: "var(--chrome-500)" }}>Loading...</div>
            </div>
          )}
        </div>

        {/* Labels */}
        {isReady && (
          <>
            <div className="absolute top-3 left-4 flex items-center gap-2">
              <span className="text-[11px] font-bold" style={{ color: "#60a5fa" }}>SOLANA</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(96, 165, 250, 0.2)", color: "#93c5fd" }}>
                Queue → 4 threads
              </span>
            </div>
            <div className="absolute top-3 right-4 flex items-center gap-2">
              <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(0, 217, 165, 0.2)", color: "#00D9A5" }}>
                Parallel 12 threads
              </span>
              <span className="text-[11px] font-bold" style={{ color: "#00D9A5" }}>APTOS</span>
            </div>
          </>
        )}
      </div>

      {/* Explanation */}
      <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
        <div className="p-3 rounded-lg" style={{ backgroundColor: "rgba(96, 165, 250, 0.05)", border: "1px solid rgba(96, 165, 250, 0.15)" }}>
          <div className="font-semibold mb-2" style={{ color: "#60a5fa" }}>Solana Under Load</div>
          <ul className="space-y-1" style={{ color: "var(--chrome-400)" }}>
            <li>• Transactions queue at scheduler</li>
            <li>• 4-6 execution threads process queue</li>
            <li>• Heavy load → 15-30% drops</li>
            <li>• Dropped txs must be retried</li>
          </ul>
        </div>
        <div className="p-3 rounded-lg" style={{ backgroundColor: "rgba(0, 217, 165, 0.05)", border: "1px solid rgba(0, 217, 165, 0.15)" }}>
          <div className="font-semibold mb-2" style={{ color: "#00D9A5" }}>Aptos Parallel Execution</div>
          <ul className="space-y-1" style={{ color: "var(--chrome-400)" }}>
            <li>• Block-STM: no scheduling queue</li>
            <li>• 32+ threads execute in parallel</li>
            <li>• Handles load without drops</li>
            <li>• Conflicts resolved automatically</li>
          </ul>
        </div>
      </div>
    </div>
  );
});
