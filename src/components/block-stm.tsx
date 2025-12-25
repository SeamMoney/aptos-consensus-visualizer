"use client";

import { useRef, useEffect, useState, memo } from "react";
import { useVisibility } from "@/hooks/useVisibility";
import { Tooltip, LearnMoreLink } from "@/components/ui/tooltip";
import { glossary } from "@/data/glossary";

interface BlockSTMProps {
  tps: number;
}

interface Transaction {
  id: number;
  progress: number; // 0-100
  phase: "queued" | "executing" | "validating" | "conflict" | "reexecuting" | "committed";
  readSet: string[];
  writeSet: string[];
  readVersions: { [key: string]: number }; // key -> version read
  conflictReason: string | null;
  reexecCount: number;
  threadId: number;
}

interface MemoryKey {
  name: string;
  versions: { version: number; txId: number; value: number }[];
  color: string;
}

const THREAD_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EC4899"];
const KEYS = ["balance_A", "balance_B", "counter", "state"];
const KEY_COLORS: { [key: string]: string } = {
  "balance_A": "#00D9A5",
  "balance_B": "#3B82F6",
  "counter": "#F59E0B",
  "state": "#EC4899",
};

const SPEED_OPTIONS = [
  { label: "0.5×", value: 0.5 },
  { label: "1×", value: 1 },
  { label: "2×", value: 2 },
];

export const BlockSTM = memo(function BlockSTM({ tps }: BlockSTMProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const isVisible = useVisibility(containerRef);
  const txRef = useRef<Transaction[]>([]);
  const memoryRef = useRef<MemoryKey[]>([
    { name: "balance_A", versions: [{ version: 0, txId: 0, value: 1000 }], color: KEY_COLORS["balance_A"] },
    { name: "balance_B", versions: [{ version: 0, txId: 0, value: 500 }], color: KEY_COLORS["balance_B"] },
    { name: "counter", versions: [{ version: 0, txId: 0, value: 0 }], color: KEY_COLORS["counter"] },
  ]);
  const txIdRef = useRef<number>(1);
  const lastSpawnRef = useRef<number>(0);
  const speedRef = useRef<number>(1);

  const [speed, setSpeed] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [stats, setStats] = useState({ committed: 0, conflicts: 0 });
  const [currentEvent, setCurrentEvent] = useState<string>("Waiting for transactions...");

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

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

      ctx.fillStyle = "#0a0a0b";
      ctx.fillRect(0, 0, width, height);

      const now = Date.now();
      const spawnInterval = 1200 / speedRef.current;

      // Spawn new transactions
      if (!isPaused && now - lastSpawnRef.current > spawnInterval && txRef.current.length < 6) {
        lastSpawnRef.current = now;

        // Generate realistic read/write sets
        const numReads = 1 + Math.floor(Math.random() * 2);
        const readSet = KEYS.slice().sort(() => Math.random() - 0.5).slice(0, numReads);
        const writeSet = Math.random() > 0.3 ? [readSet[0]] : [];

        const readVersions: { [key: string]: number } = {};
        readSet.forEach(key => {
          const mem = memoryRef.current.find(m => m.name === key);
          if (mem) {
            readVersions[key] = mem.versions[mem.versions.length - 1].version;
          }
        });

        txRef.current.push({
          id: txIdRef.current++,
          progress: 0,
          phase: "queued",
          readSet,
          writeSet,
          readVersions,
          conflictReason: null,
          reexecCount: 0,
          threadId: Math.floor(Math.random() * 4),
        });

        setCurrentEvent(`TX${txIdRef.current - 1} queued → reads {${readSet.join(", ")}}`);
      }

      // ===== EXECUTION TIMELINE (Left side) =====
      const timelineWidth = width * 0.48;
      const barHeight = 32;
      const barGap = 8;
      const startY = 55;

      // Section header
      ctx.fillStyle = "#00D9A5";
      ctx.font = "bold 11px system-ui";
      ctx.textAlign = "left";
      ctx.fillText("TRANSACTION EXECUTION", 20, 30);

      // Phase markers
      const phases = [
        { name: "EXEC", x: 0.15, color: "#3B82F6" },
        { name: "VALID", x: 0.55, color: "#F59E0B" },
        { name: "COMMIT", x: 0.85, color: "#10B981" },
      ];

      phases.forEach(phase => {
        const x = 20 + phase.x * (timelineWidth - 40);
        ctx.fillStyle = phase.color + "40";
        ctx.font = "8px monospace";
        ctx.textAlign = "center";
        ctx.fillText(phase.name, x, 45);
      });

      let newCommits = 0;
      let newConflicts = 0;

      // Process and draw transactions
      txRef.current.forEach((tx, idx) => {
        const y = startY + idx * (barHeight + barGap);
        if (y > height - 80) return; // Don't draw off-screen

        // Update transaction state
        if (!isPaused) {
          const progressSpeed = 1.2 * speedRef.current;

          if (tx.phase === "queued") {
            tx.phase = "executing";
            setCurrentEvent(`TX${tx.id} executing on thread ${tx.threadId}`);
          } else if (tx.phase === "executing") {
            tx.progress += progressSpeed;
            if (tx.progress >= 50) {
              tx.phase = "validating";
              setCurrentEvent(`TX${tx.id} validating read set...`);
            }
          } else if (tx.phase === "validating") {
            tx.progress += progressSpeed * 0.7;
            if (tx.progress >= 70) {
              // Check for conflicts
              let conflict = false;
              let conflictKey = "";

              for (const key of tx.readSet) {
                const mem = memoryRef.current.find(m => m.name === key);
                if (mem) {
                  const currentVersion = mem.versions[mem.versions.length - 1].version;
                  const readVersion = tx.readVersions[key];
                  if (currentVersion > readVersion && Math.random() < 0.25) {
                    conflict = true;
                    conflictKey = key;
                    break;
                  }
                }
              }

              if (conflict && tx.reexecCount < 2) {
                tx.phase = "conflict";
                tx.conflictReason = `${conflictKey} changed: v${tx.readVersions[conflictKey]} → v${tx.readVersions[conflictKey] + 1}`;
                newConflicts++;
                setCurrentEvent(`⚠️ TX${tx.id} CONFLICT: read stale ${conflictKey}`);
              } else {
                tx.phase = "committed";
                newCommits++;

                // Write new versions
                tx.writeSet.forEach(key => {
                  const mem = memoryRef.current.find(m => m.name === key);
                  if (mem) {
                    const newVer = mem.versions[mem.versions.length - 1].version + 1;
                    if (mem.versions.length >= 4) mem.versions.shift();
                    mem.versions.push({ version: newVer, txId: tx.id, value: Math.floor(Math.random() * 1000) });
                  }
                });
                setCurrentEvent(`✓ TX${tx.id} committed${tx.writeSet.length > 0 ? ` → wrote ${tx.writeSet[0]}` : ""}`);
              }
            }
          } else if (tx.phase === "conflict") {
            tx.progress -= progressSpeed * 1.5;
            if (tx.progress <= 30) {
              tx.phase = "reexecuting";
              tx.reexecCount++;
              // Re-read current versions
              tx.readSet.forEach(key => {
                const mem = memoryRef.current.find(m => m.name === key);
                if (mem) tx.readVersions[key] = mem.versions[mem.versions.length - 1].version;
              });
              setCurrentEvent(`↻ TX${tx.id} re-executing with fresh data...`);
            }
          } else if (tx.phase === "reexecuting") {
            tx.progress += progressSpeed * 1.3;
            if (tx.progress >= 90) {
              tx.phase = "committed";
              newCommits++;
              tx.writeSet.forEach(key => {
                const mem = memoryRef.current.find(m => m.name === key);
                if (mem) {
                  const newVer = mem.versions[mem.versions.length - 1].version + 1;
                  if (mem.versions.length >= 4) mem.versions.shift();
                  mem.versions.push({ version: newVer, txId: tx.id, value: Math.floor(Math.random() * 1000) });
                }
              });
              setCurrentEvent(`✓ TX${tx.id} committed after re-execution`);
            }
          } else if (tx.phase === "committed") {
            tx.progress += progressSpeed;
          }
        }

        // Draw transaction bar
        const barWidth = timelineWidth - 40;

        // Background track
        ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
        ctx.beginPath();
        ctx.roundRect(20, y, barWidth, barHeight, 6);
        ctx.fill();

        // Progress fill
        const fillWidth = Math.min(tx.progress / 100, 1) * barWidth;
        let fillColor = THREAD_COLORS[tx.threadId];
        if (tx.phase === "validating") fillColor = "#F59E0B";
        if (tx.phase === "conflict") fillColor = "#EF4444";
        if (tx.phase === "reexecuting") fillColor = "#F59E0B";
        if (tx.phase === "committed") fillColor = "#10B981";

        ctx.fillStyle = fillColor;
        ctx.beginPath();
        ctx.roundRect(20, y, fillWidth, barHeight, 6);
        ctx.fill();

        // TX ID
        ctx.fillStyle = "#fff";
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "left";
        ctx.fillText(`TX${tx.id}`, 28, y + 13);

        // Read/Write set indicators
        ctx.font = "8px monospace";
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        const rwText = `R:{${tx.readSet.map(k => k.split("_")[0]).join(",")}}`;
        ctx.fillText(rwText, 28, y + 25);

        if (tx.writeSet.length > 0) {
          ctx.fillStyle = "#F59E0B";
          ctx.fillText(`W:{${tx.writeSet.map(k => k.split("_")[0]).join(",")}}`, 90, y + 25);
        }

        // Status badge
        ctx.textAlign = "right";
        if (tx.phase === "conflict") {
          ctx.fillStyle = "#EF4444";
          ctx.font = "bold 9px monospace";
          ctx.fillText("CONFLICT ↻", barWidth + 10, y + 20);
        } else if (tx.phase === "reexecuting") {
          ctx.fillStyle = "#F59E0B";
          ctx.font = "9px monospace";
          ctx.fillText(`RE-EXEC #${tx.reexecCount}`, barWidth + 10, y + 20);
        } else if (tx.phase === "committed") {
          ctx.fillStyle = "#10B981";
          ctx.font = "bold 10px monospace";
          ctx.fillText("✓", barWidth + 10, y + 20);
        }
      });

      // Clean up completed transactions
      txRef.current = txRef.current.filter(tx => tx.progress < 110);

      // ===== MULTI-VERSION MEMORY (Right side) =====
      const memX = timelineWidth + 25;
      const memWidth = width - memX - 20;
      const maxRightEdge = width - 15;

      // Section header - truncate if too long
      ctx.fillStyle = "#3B82F6";
      ctx.font = "bold 11px system-ui";
      ctx.textAlign = "left";
      const headerText = memWidth > 180 ? "MULTI-VERSION DATA STRUCTURE" : "MVCC DATA";
      ctx.fillText(headerText, memX, 30);

      // Draw memory visualization
      const memStartY = 55;
      const rowHeight = 50;

      // Calculate box dimensions based on available width
      const boxGap = 4;
      const maxVersionsToShow = Math.min(4, Math.floor((memWidth - 10) / 40));
      const boxWidth = Math.min(38, (memWidth - (maxVersionsToShow - 1) * boxGap) / maxVersionsToShow);
      const boxHeight = 24;

      memoryRef.current.forEach((mem, idx) => {
        const y = memStartY + idx * rowHeight;

        // Key name - truncate if needed
        ctx.fillStyle = mem.color;
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "left";
        const keyName = memWidth < 150 ? mem.name.split("_")[0] : mem.name;
        ctx.fillText(keyName, memX, y + 10);

        // Version boxes - only show last N versions that fit
        const versionsToShow = mem.versions.slice(-maxVersionsToShow);
        const boxStartX = memX;

        versionsToShow.forEach((ver, vIdx) => {
          const bx = boxStartX + vIdx * (boxWidth + boxGap);

          // Don't draw if it would go past the edge
          if (bx + boxWidth > maxRightEdge) return;

          const by = y + 16;
          const isLatest = vIdx === versionsToShow.length - 1;

          // Box
          ctx.fillStyle = isLatest ? mem.color + "30" : "rgba(255,255,255,0.05)";
          ctx.strokeStyle = isLatest ? mem.color : "rgba(255,255,255,0.15)";
          ctx.lineWidth = isLatest ? 2 : 1;
          ctx.beginPath();
          ctx.roundRect(bx, by, boxWidth, boxHeight, 4);
          ctx.fill();
          ctx.stroke();

          // Version label
          ctx.fillStyle = isLatest ? "#fff" : "rgba(255,255,255,0.5)";
          ctx.font = isLatest ? "bold 8px monospace" : "8px monospace";
          ctx.textAlign = "center";
          ctx.fillText(`v${ver.version}`, bx + boxWidth / 2, by + 10);

          // TX that wrote it
          ctx.fillStyle = "rgba(255,255,255,0.4)";
          ctx.font = "6px monospace";
          const txLabel = ver.txId === 0 ? "init" : `TX${ver.txId}`;
          ctx.fillText(txLabel, bx + boxWidth / 2, by + 19);

          // Arrow to next
          if (vIdx < versionsToShow.length - 1) {
            const nextBx = boxStartX + (vIdx + 1) * (boxWidth + boxGap);
            if (nextBx + boxWidth <= maxRightEdge) {
              ctx.strokeStyle = "rgba(255,255,255,0.2)";
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(bx + boxWidth + 1, by + boxHeight / 2);
              ctx.lineTo(bx + boxWidth + boxGap - 1, by + boxHeight / 2);
              ctx.stroke();
            }
          }
        });
      });

      // MVCC explanation - only show if there's room
      const explainY = memStartY + memoryRef.current.length * rowHeight + 5;
      if (explainY < height - 40) {
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = "8px monospace";
        ctx.textAlign = "left";

        // Truncate text to fit within bounds
        const explainTexts = memWidth > 180
          ? ["• TXs read from specific versions", "• Writes create new versions", "• Conflicts: read version < current"]
          : ["• Read specific versions", "• Writes create versions", "• Conflicts → retry"];

        explainTexts.forEach((text, i) => {
          if (explainY + i * 12 < height - 10) {
            ctx.fillText(text, memX, explainY + i * 12);
          }
        });
      }

      // Update stats
      if (newCommits > 0 || newConflicts > 0) {
        setStats(prev => ({
          committed: prev.committed + newCommits,
          conflicts: prev.conflicts + newConflicts,
        }));
      }

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationRef.current);
  }, [isPaused, isVisible]);

  return (
    <div ref={containerRef} className="chrome-card p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-3">
        <div>
          <h3 className="section-title">
            <Tooltip eli5={glossary["block-stm"].eli5} technical={glossary["block-stm"].technical} link={glossary["block-stm"].link}>Block-STM</Tooltip> Parallel Execution
            <LearnMoreLink href={glossary["block-stm"].link} label="Docs" />
          </h3>
          <p className="text-xs" style={{ color: "var(--chrome-600)" }}>
            Software Transactional Memory with <Tooltip eli5={glossary.mvcc.eli5} technical={glossary.mvcc.technical} link={glossary.mvcc.link}>MVCC</Tooltip>
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Speed Controls */}
          <div className="flex items-center gap-1 bg-white/5 rounded px-2 py-1">
            <button
              onClick={() => setIsPaused(!isPaused)}
              className={`px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-mono rounded transition-colors ${
                isPaused ? "bg-[#F59E0B] text-black" : "text-white/50 hover:text-white/80"
              }`}
            >
              {isPaused ? "▶" : "⏸"}
            </button>
            {SPEED_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSpeed(opt.value)}
                className={`px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-mono rounded transition-colors ${
                  speed === opt.value
                    ? "bg-[#00D9A5] text-black"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {/* Stats */}
          <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs font-mono">
            <span style={{ color: "var(--chrome-500)" }}>
              <span style={{ color: "#10B981" }}>{stats.committed}</span> commits
            </span>
            <span style={{ color: "var(--chrome-500)" }}>
              <span style={{ color: "#EF4444" }}>{stats.conflicts}</span> conflicts
            </span>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full rounded"
        style={{ height: "280px" }}
      />

      {/* Live Event Log */}
      <div className="mt-2 px-3 py-2 rounded bg-white/5 font-mono text-xs" style={{ color: "var(--chrome-400)" }}>
        {currentEvent}
      </div>

      {/* How It Works Panel */}
      <div className="mt-3 p-2 sm:p-3 rounded bg-white/5">
        <div className="text-xs font-bold mb-2" style={{ color: "var(--chrome-300)" }}>
          HOW BLOCK-STM WORKS
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-xs">
          <div className="p-2 rounded bg-white/5">
            <div className="font-bold mb-1 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#3B82F6]"></span>
              <span style={{ color: "#3B82F6" }}>Execute</span>
            </div>
            <p className="text-[10px] sm:text-xs" style={{ color: "var(--chrome-500)" }}>
              Run TX optimistically, record all reads & writes
            </p>
          </div>
          <div className="p-2 rounded bg-white/5">
            <div className="font-bold mb-1 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#F59E0B]"></span>
              <span style={{ color: "#F59E0B" }}>Validate</span>
            </div>
            <p className="text-[10px] sm:text-xs" style={{ color: "var(--chrome-500)" }}>
              Check if read versions are still current
            </p>
          </div>
          <div className="p-2 rounded bg-white/5">
            <div className="font-bold mb-1 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#EF4444]"></span>
              <span style={{ color: "#EF4444" }}>Conflict?</span>
            </div>
            <p className="text-[10px] sm:text-xs" style={{ color: "var(--chrome-500)" }}>
              Earlier TX wrote to key we read → abort & retry
            </p>
          </div>
          <div className="p-2 rounded bg-white/5">
            <div className="font-bold mb-1 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#10B981]"></span>
              <span style={{ color: "#10B981" }}>Commit</span>
            </div>
            <p className="text-[10px] sm:text-xs" style={{ color: "var(--chrome-500)" }}>
              Write new versions, TX is finalized
            </p>
          </div>
        </div>
      </div>

      {/* Technical Details */}
      <div className="mt-2 p-3 rounded bg-white/5 text-xs" style={{ color: "var(--chrome-500)" }}>
        <div className="font-bold mb-1" style={{ color: "var(--chrome-400)" }}>Key Innovation</div>
        <p>
          Block-STM uses <strong style={{ color: "#00D9A5" }}>Multi-Version Concurrency Control (MVCC)</strong> where
          each key maintains multiple versions. TXs are pre-ordered (TX1 &lt; TX2 &lt; TX3...) and execute speculatively
          in parallel. If TX5 reads <code className="bg-white/10 px-1 rounded">balance_A@v2</code> but TX3 later writes
          <code className="bg-white/10 px-1 rounded">balance_A@v3</code>, TX5 must re-execute with fresh data.
          This achieves <strong style={{ color: "#00D9A5" }}>8-16x speedup</strong> over sequential execution with
          typically &lt;5% conflict rate.
        </p>
      </div>
    </div>
  );
});
