"use client";

import { memo, useEffect, useRef, useState, useCallback } from "react";
import { Application, Graphics, Text, TextStyle } from "pixi.js";
import { useVisibility } from "@/hooks/useVisibility";
import {
  PIXI_COLORS,
  lerp,
} from "@/lib/pixi-utils";

interface BlockSTMExplainerProps {
  className?: string;
}

const CONFIG = {
  duration: 12000, // 12 second cycle
  numTransactions: 8,
  numLanes: 8, // Parallel execution lanes
  stateUpdateInterval: 50,
};

interface Transaction {
  id: number;
  progress: number; // 0-1
  lane: number;
  startTime: number;
  duration: number;
  status: "waiting" | "executing" | "conflict" | "done";
  hasConflict: boolean;
  conflictResolved: boolean;
}

export const BlockSTMExplainer = memo(function BlockSTMExplainer({
  className,
}: BlockSTMExplainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const initAttemptedRef = useRef(false);
  const mountedRef = useRef(true);

  const isPlayingRef = useRef(true);
  const startTimeRef = useRef<number>(0);
  const lastStateUpdateRef = useRef<number>(0);

  // Sequential transactions
  const seqTransactionsRef = useRef<Transaction[]>([]);
  // Parallel transactions
  const parTransactionsRef = useRef<Transaction[]>([]);

  const graphicsRef = useRef<{
    background: Graphics | null;
    sequential: Graphics | null;
    parallel: Graphics | null;
    timeline: Graphics | null;
  }>({
    background: null,
    sequential: null,
    parallel: null,
    timeline: null,
  });

  const textsRef = useRef<Text[]>([]);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [seqCompleted, setSeqCompleted] = useState(0);
  const [parCompleted, setParCompleted] = useState(0);
  const [seqTime, setSeqTime] = useState(0);
  const [parTime, setParTime] = useState(0);

  const isVisible = useVisibility(containerRef);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const initTransactions = useCallback(() => {
    // Initialize sequential transactions (one at a time)
    seqTransactionsRef.current = Array(CONFIG.numTransactions).fill(null).map((_, i) => ({
      id: i + 1,
      progress: 0,
      lane: 0,
      startTime: i * 0.12, // Sequential start times
      duration: 0.08 + Math.random() * 0.04,
      status: "waiting" as const,
      hasConflict: false,
      conflictResolved: false,
    }));

    // Initialize parallel transactions (all at once, with some conflicts)
    parTransactionsRef.current = Array(CONFIG.numTransactions).fill(null).map((_, i) => ({
      id: i + 1,
      progress: 0,
      lane: i % CONFIG.numLanes,
      startTime: 0,
      duration: 0.03 + Math.random() * 0.02,
      status: "waiting" as const,
      hasConflict: i === 2 || i === 5, // Txn 3 and 6 have conflicts
      conflictResolved: false,
    }));
  }, []);

  const updateAnimation = useCallback(() => {
    if (!mountedRef.current) return;
    const app = appRef.current;
    const container = containerRef.current;
    if (!app || !container) return;

    const now = performance.now();
    const elapsed = now - startTimeRef.current;
    const progress = (elapsed % CONFIG.duration) / CONFIG.duration;

    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    if (Math.abs(app.screen.width - width) > 1 || Math.abs(app.screen.height - height) > 1) {
      app.renderer.resize(width, height);
    }

    // Reset at cycle start
    if (progress < 0.02 && seqTransactionsRef.current[0]?.status !== "waiting") {
      initTransactions();
    }

    // Update sequential transactions
    let seqDone = 0;
    let seqCurrentTime = 0;
    seqTransactionsRef.current.forEach((tx, i) => {
      const prevDone = i === 0 || seqTransactionsRef.current[i - 1].status === "done";

      if (prevDone && progress >= tx.startTime) {
        const txProgress = (progress - tx.startTime) / tx.duration;
        tx.progress = Math.min(txProgress, 1);

        if (txProgress < 0) {
          tx.status = "waiting";
        } else if (txProgress < 1) {
          tx.status = "executing";
          seqCurrentTime = tx.startTime + tx.duration * tx.progress;
        } else {
          tx.status = "done";
          seqDone++;
        }
      }
    });

    // Update parallel transactions
    let parDone = 0;
    let parCurrentTime = 0;
    const parStartTime = 0.02; // Start parallel execution slightly after beginning
    parTransactionsRef.current.forEach((tx) => {
      if (progress >= parStartTime) {
        const txProgress = (progress - parStartTime) / tx.duration;

        if (tx.hasConflict && !tx.conflictResolved) {
          // Conflict detected at 70% progress
          if (txProgress > 0.7 && txProgress < 1.2) {
            tx.status = "conflict";
            tx.progress = 0.7;
          } else if (txProgress >= 1.2) {
            // Re-execute after conflict
            tx.conflictResolved = true;
            tx.progress = Math.min((txProgress - 0.5) / tx.duration, 1);
            tx.status = tx.progress >= 1 ? "done" : "executing";
          }
        } else {
          tx.progress = Math.min(txProgress, 1);
          if (txProgress < 0) {
            tx.status = "waiting";
          } else if (txProgress < 1) {
            tx.status = "executing";
          } else {
            tx.status = "done";
          }
        }

        if (tx.status === "done") {
          parDone++;
        }

        if (tx.status === "executing" || tx.status === "conflict") {
          parCurrentTime = Math.max(parCurrentTime, parStartTime + tx.duration * Math.min(tx.progress, 1));
        }
      }
    });

    // Throttle React state updates
    if (now - lastStateUpdateRef.current > CONFIG.stateUpdateInterval) {
      lastStateUpdateRef.current = now;
      setSeqCompleted(seqDone);
      setParCompleted(parDone);
      setSeqTime(Math.round(seqCurrentTime * 1000));
      setParTime(Math.round(parCurrentTime * 100));
    }

    // Layout
    const margin = { left: 20, right: 20, top: 15, bottom: 15 };
    const centerX = width / 2;

    const titleHeight = 45;
    const sectionHeight = (height - margin.top - margin.bottom - titleHeight - 80) / 2;

    const seqY = margin.top + titleHeight;
    const parY = seqY + sectionHeight + 40;

    // Draw background
    const bg = graphicsRef.current.background;
    if (bg) {
      bg.clear();
      bg.rect(0, 0, width, height);
      bg.fill({ color: 0x0a0a0b });

      // Grid
      const gridAlpha = 0.025;
      bg.setStrokeStyle({ width: 1, color: 0x1f2937, alpha: gridAlpha });
      for (let x = 0; x < width; x += 25) {
        bg.moveTo(x, 0);
        bg.lineTo(x, height);
      }
      for (let y = 0; y < height; y += 25) {
        bg.moveTo(0, y);
        bg.lineTo(width, y);
      }
      bg.stroke();
    }

    // Draw sequential section
    const seq = graphicsRef.current.sequential;
    if (seq) {
      seq.clear();

      // Section background
      seq.roundRect(margin.left, seqY, width - margin.left * 2, sectionHeight, 10);
      seq.fill({ color: 0x0d1117, alpha: 0.95 });
      seq.stroke({ width: 1, color: PIXI_COLORS.chrome[700], alpha: 0.5 });

      // Transaction visualization area
      const txAreaX = margin.left + 120;
      const txAreaWidth = width - margin.left * 2 - 150;
      const txHeight = 20;
      const txGap = 8;
      const startY = seqY + 35;

      // Draw transactions
      seqTransactionsRef.current.forEach((tx, i) => {
        const y = startY + i * (txHeight + txGap);

        // Transaction background track
        seq.roundRect(txAreaX, y, txAreaWidth, txHeight, 4);
        seq.fill({ color: 0x1a1a2e, alpha: 0.6 });

        // Progress bar
        if (tx.progress > 0) {
          const barWidth = txAreaWidth * tx.progress;
          const color = tx.status === "done" ? PIXI_COLORS.chrome[500] : PIXI_COLORS.chrome[400];

          seq.roundRect(txAreaX, y, barWidth, txHeight, 4);
          seq.fill({ color, alpha: tx.status === "done" ? 0.6 : 0.9 });

          // Executing indicator
          if (tx.status === "executing") {
            const pulse = Math.sin(elapsed * 0.01) * 0.3 + 0.7;
            seq.roundRect(txAreaX + barWidth - 5, y + 3, 8, txHeight - 6, 2);
            seq.fill({ color: 0xffffff, alpha: pulse * 0.5 });
          }
        }

        // Waiting indicator
        if (tx.status === "waiting") {
          seq.setStrokeStyle({ width: 1, color: PIXI_COLORS.chrome[600], alpha: 0.5 });
          seq.moveTo(txAreaX + 10, y + txHeight / 2);
          seq.lineTo(txAreaX + txAreaWidth - 10, y + txHeight / 2);
          seq.stroke();
        }
      });

      // Time indicator line
      const timeX = txAreaX + txAreaWidth * Math.min(progress / 0.95, 1);
      seq.setStrokeStyle({ width: 2, color: PIXI_COLORS.danger, alpha: 0.7 });
      seq.moveTo(timeX, startY - 10);
      seq.lineTo(timeX, startY + CONFIG.numTransactions * (txHeight + txGap) + 5);
      seq.stroke();

      // Time indicator dot
      seq.circle(timeX, startY - 12, 4);
      seq.fill({ color: PIXI_COLORS.danger });
    }

    // Draw parallel section
    const par = graphicsRef.current.parallel;
    if (par) {
      par.clear();

      // Section background
      par.roundRect(margin.left, parY, width - margin.left * 2, sectionHeight, 10);
      par.fill({ color: 0x0d1a14, alpha: 0.95 });
      par.stroke({ width: 1, color: PIXI_COLORS.primary, alpha: 0.4 });

      // Transaction lanes
      const txAreaX = margin.left + 120;
      const txAreaWidth = width - margin.left * 2 - 150;
      const laneHeight = 20;
      const laneGap = 6;
      const startY = parY + 35;

      // Draw lanes
      parTransactionsRef.current.forEach((tx, i) => {
        const y = startY + tx.lane * (laneHeight + laneGap);

        // Lane background
        par.roundRect(txAreaX, y, txAreaWidth, laneHeight, 4);
        par.fill({ color: 0x1a1a2e, alpha: 0.4 });

        // Progress bar
        if (tx.progress > 0) {
          const barWidth = txAreaWidth * tx.progress;
          let color: number = PIXI_COLORS.primary;
          let alpha = 0.9;

          if (tx.status === "conflict") {
            color = PIXI_COLORS.accent;
            alpha = 0.8 + Math.sin(elapsed * 0.02) * 0.2;
          } else if (tx.status === "done") {
            alpha = 0.6;
          }

          par.roundRect(txAreaX, y, barWidth, laneHeight, 4);
          par.fill({ color, alpha });

          // Conflict indicator
          if (tx.status === "conflict") {
            const cx = txAreaX + barWidth - 10;
            const cy = y + laneHeight / 2;

            // Warning flash
            par.circle(cx, cy, 8);
            par.fill({ color: PIXI_COLORS.accent, alpha: 0.4 });

            // Exclamation mark
            par.setStrokeStyle({ width: 2, color: 0xffffff });
            par.moveTo(cx, cy - 4);
            par.lineTo(cx, cy + 1);
            par.stroke();
            par.circle(cx, cy + 4, 1);
            par.fill({ color: 0xffffff });
          }

          // Executing indicator
          if (tx.status === "executing") {
            par.roundRect(txAreaX + barWidth - 4, y + 3, 6, laneHeight - 6, 2);
            par.fill({ color: 0xffffff, alpha: 0.4 });
          }
        }

        // Transaction ID label
        par.roundRect(txAreaX - 30, y + 2, 25, laneHeight - 4, 3);
        par.fill({ color: PIXI_COLORS.primary, alpha: 0.15 });
      });

      // Lane separators
      for (let i = 1; i < CONFIG.numLanes; i++) {
        const laneY = startY + i * (laneHeight + laneGap) - laneGap / 2;
        par.setStrokeStyle({ width: 1, color: PIXI_COLORS.chrome[700], alpha: 0.2 });
        par.moveTo(txAreaX - 35, laneY);
        par.lineTo(txAreaX + txAreaWidth + 10, laneY);
        par.stroke();
      }

      // Time indicator line (much faster)
      const parProgress = Math.min((progress - 0.02) / 0.15, 1);
      if (parProgress > 0) {
        const timeX = txAreaX + txAreaWidth * parProgress;
        par.setStrokeStyle({ width: 2, color: PIXI_COLORS.primary, alpha: 0.7 });
        par.moveTo(timeX, startY - 10);
        par.lineTo(timeX, startY + CONFIG.numLanes * (laneHeight + laneGap) + 5);
        par.stroke();

        par.circle(timeX, startY - 12, 4);
        par.fill({ color: PIXI_COLORS.primary });
      }
    }

    // Draw timeline comparison
    const timeline = graphicsRef.current.timeline;
    if (timeline) {
      timeline.clear();

      const timelineY = height - margin.bottom - 45;
      const timelineWidth = width - margin.left * 2 - 100;
      const timelineX = margin.left + 50;

      // Timeline background
      timeline.roundRect(margin.left, timelineY - 10, width - margin.left * 2, 50, 8);
      timeline.fill({ color: 0x0d1117, alpha: 0.9 });

      // Sequential time bar
      const seqProgress = Math.min(progress / 0.95, 1);
      timeline.roundRect(timelineX, timelineY, timelineWidth * seqProgress, 12, 4);
      timeline.fill({ color: PIXI_COLORS.chrome[500], alpha: 0.8 });

      // Parallel time bar (much shorter)
      const parProgress2 = Math.min((progress - 0.02) / 0.15, 1);
      if (parProgress2 > 0) {
        timeline.roundRect(timelineX, timelineY + 18, timelineWidth * parProgress2 * 0.16, 12, 4);
        timeline.fill({ color: PIXI_COLORS.primary, alpha: 0.8 });
      }

      // Time markers
      [0, 0.25, 0.5, 0.75, 1].forEach((pct) => {
        const x = timelineX + timelineWidth * pct;
        timeline.setStrokeStyle({ width: 1, color: PIXI_COLORS.chrome[600], alpha: 0.4 });
        timeline.moveTo(x, timelineY - 5);
        timeline.lineTo(x, timelineY + 35);
        timeline.stroke();
      });
    }

    // Update texts
    const texts = textsRef.current;
    if (texts.length >= 12) {
      const txAreaX = margin.left + 120;
      const startY = seqY + 35;
      const txHeight = 20;
      const txGap = 8;
      const parStartY = parY + 35;
      const laneHeight = 20;
      const laneGap = 6;

      // Title
      texts[0].x = centerX;
      texts[0].y = margin.top + 5;
      texts[0].anchor.set(0.5, 0);

      // Sequential header
      texts[1].x = margin.left + 15;
      texts[1].y = seqY + 10;

      // Parallel header
      texts[2].x = margin.left + 15;
      texts[2].y = parY + 10;

      // Sequential transaction labels
      seqTransactionsRef.current.forEach((tx, i) => {
        if (texts[3 + i]) {
          texts[3 + i].text = `TX ${tx.id}`;
          texts[3 + i].x = margin.left + 25;
          texts[3 + i].y = startY + i * (txHeight + txGap) + 3;
        }
      });

      // Parallel transaction labels (reuse some)
      parTransactionsRef.current.forEach((tx, i) => {
        if (texts[3 + i]) {
          // Already drawn in graphics
        }
      });

      // Comparison labels
      texts[11].text = `Sequential: ~800ms for ${CONFIG.numTransactions} txns`;
      texts[11].x = margin.left + 60;
      texts[11].y = height - margin.bottom - 40;

      texts[12].text = `Block-STM: ~30ms for ${CONFIG.numTransactions} txns (26x faster)`;
      texts[12].x = margin.left + 60;
      texts[12].y = height - margin.bottom - 22;
    }
  }, [initTransactions]);

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
      backgroundColor: PIXI_COLORS.background,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    container.appendChild(app.canvas as HTMLCanvasElement);
    appRef.current = app;

    graphicsRef.current = {
      background: new Graphics(),
      sequential: new Graphics(),
      parallel: new Graphics(),
      timeline: new Graphics(),
    };

    app.stage.addChild(graphicsRef.current.background!);
    app.stage.addChild(graphicsRef.current.sequential!);
    app.stage.addChild(graphicsRef.current.parallel!);
    app.stage.addChild(graphicsRef.current.timeline!);

    // Text styles
    const titleStyle = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 14,
      fontWeight: "800",
      fill: 0xffffff,
      letterSpacing: 1,
    });

    const headerBad = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 11,
      fontWeight: "700",
      fill: PIXI_COLORS.chrome[400],
      letterSpacing: 0.5,
    });

    const headerGood = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 11,
      fontWeight: "700",
      fill: PIXI_COLORS.primary,
      letterSpacing: 0.5,
    });

    const txLabel = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 9,
      fontWeight: "600",
      fill: PIXI_COLORS.chrome[500],
    });

    const comparisonBad = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 10,
      fontWeight: "600",
      fill: PIXI_COLORS.chrome[400],
    });

    const comparisonGood = new TextStyle({
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 10,
      fontWeight: "700",
      fill: PIXI_COLORS.primary,
    });

    textsRef.current = [
      new Text({ text: "SEQUENTIAL VS PARALLEL EXECUTION", style: titleStyle }),
      new Text({ text: "TRADITIONAL (SEQUENTIAL)", style: headerBad }),
      new Text({ text: "BLOCK-STM (PARALLEL)", style: headerGood }),
      new Text({ text: "TX 1", style: txLabel }),
      new Text({ text: "TX 2", style: txLabel }),
      new Text({ text: "TX 3", style: txLabel }),
      new Text({ text: "TX 4", style: txLabel }),
      new Text({ text: "TX 5", style: txLabel }),
      new Text({ text: "TX 6", style: txLabel }),
      new Text({ text: "TX 7", style: txLabel }),
      new Text({ text: "TX 8", style: txLabel }),
      new Text({ text: "Sequential: ~800ms", style: comparisonBad }),
      new Text({ text: "Block-STM: ~30ms (26x faster)", style: comparisonGood }),
    ];

    textsRef.current.forEach((t) => app.stage.addChild(t));

    initTransactions();
    startTimeRef.current = performance.now();
    mountedRef.current = true;
    setIsReady(true);

    app.ticker.add(updateAnimation);
  }, [updateAnimation, initTransactions]);

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

    // Small delay to ensure DOM is ready
    const initTimeout = setTimeout(() => {
      if (!appRef.current && !initAttemptedRef.current) {
        initPixi();
      }
    }, 100);

    initPixi();

    return () => {
      mountedRef.current = false;
      clearTimeout(initTimeout);
      resizeObserver.disconnect();
      if (appRef.current) {
        // Stop ticker to prevent render during cleanup
        appRef.current.ticker.stop();

        const canvas = appRef.current.canvas as HTMLCanvasElement;
        try {
          appRef.current.destroy(true, { children: true });
        } catch {
          // Ignore cleanup errors during HMR
        }
        if (canvas && container.contains(canvas)) container.removeChild(canvas);
        appRef.current = null;
      }
      graphicsRef.current = {
        background: null,
        sequential: null,
        parallel: null,
        timeline: null,
      };
      textsRef.current = [];
      initAttemptedRef.current = false;
      setIsReady(false);
    };
  }, [initPixi]);

  useEffect(() => {
    if (!appRef.current) return;
    if (isVisible && isPlaying) {
      appRef.current.ticker.start();
      // Force a redraw when becoming visible
      updateAnimation();
    } else {
      appRef.current.ticker.stop();
    }
  }, [isVisible, isPlaying, updateAnimation]);

  const handlePlayPause = () => {
    const newState = !isPlaying;
    setIsPlaying(newState);
    if (newState) {
      startTimeRef.current = performance.now();
      initTransactions();
    }
  };

  const handleRestart = () => {
    startTimeRef.current = performance.now();
    initTransactions();
    setIsPlaying(true);
  };

  return (
    <div className={`chrome-card p-4 sm:p-6 ${className || ""}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="section-title">Block-STM Parallel Execution</h3>
          <p className="text-xs" style={{ color: "var(--chrome-500)" }}>
            How Aptos achieves 160,000+ TPS
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePlayPause}
            className="px-3 py-1 text-sm rounded border transition-colors hover:bg-white/5"
            style={{ borderColor: "var(--chrome-700)", color: "var(--chrome-300)" }}
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button
            onClick={handleRestart}
            className="px-3 py-1 text-sm rounded border transition-colors hover:bg-white/5"
            style={{ borderColor: "var(--chrome-700)", color: "var(--chrome-300)" }}
          >
            Restart
          </button>
        </div>
      </div>

      <div className="metric-grid grid-cols-4 mb-4">
        <div className="metric-cell">
          <div className="stat-value text-lg" style={{ color: "var(--chrome-400)" }}>
            {seqCompleted}/{CONFIG.numTransactions}
          </div>
          <div className="stat-label">Seq Done</div>
        </div>
        <div className="metric-cell">
          <div className="stat-value text-lg" style={{ color: "var(--accent)" }}>
            {parCompleted}/{CONFIG.numTransactions}
          </div>
          <div className="stat-label">Par Done</div>
        </div>
        <div className="metric-cell">
          <div className="stat-value text-lg" style={{ color: "var(--chrome-400)" }}>
            ~800ms
          </div>
          <div className="stat-label">Seq Time</div>
        </div>
        <div className="metric-cell">
          <div className="stat-value text-lg" style={{ color: "var(--accent)" }}>
            ~30ms
          </div>
          <div className="stat-label">Par Time</div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="canvas-wrap relative rounded-lg overflow-hidden"
        style={{ height: "380px", backgroundColor: "#0a0a0b" }}
      >
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-sm" style={{ color: "var(--chrome-500)" }}>
              Loading visualization...
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: "rgba(0, 217, 165, 0.08)", border: "1px solid rgba(0, 217, 165, 0.2)" }}>
        <h4 className="text-sm font-bold mb-2" style={{ color: "var(--accent)" }}>
          Optimistic Parallel Execution
        </h4>
        <div className="grid grid-cols-2 gap-3 text-xs" style={{ color: "var(--chrome-400)" }}>
          <div>
            <span className="font-bold" style={{ color: "var(--chrome-300)" }}>1.</span> Execute ALL transactions in parallel (assume no conflicts)
          </div>
          <div>
            <span className="font-bold" style={{ color: "var(--chrome-300)" }}>2.</span> Detect conflicts automatically during execution
          </div>
          <div>
            <span className="font-bold" style={{ color: "var(--chrome-300)" }}>3.</span> Re-execute only conflicting transactions
          </div>
          <div>
            <span className="font-bold" style={{ color: "var(--chrome-300)" }}>4.</span> Repeat until all resolve (usually 1-2 rounds)
          </div>
        </div>
      </div>
    </div>
  );
});
