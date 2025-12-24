"use client";

import { useRef, useEffect, useState, memo } from "react";
import { useVisibility } from "@/hooks/useVisibility";

/**
 * Archon Consensus Visualization - Redesigned
 *
 * Shows WHY a co-located cluster makes consensus faster:
 * - Desktop: Side-by-side comparison (Traditional vs Archon)
 * - Mobile: Stacked vertically for better readability
 */

interface TraditionalValidator {
  id: number;
  x: number;
  y: number;
  city: string;
  color: string;
}

interface TraditionalMessage {
  id: number;
  fromId: number;
  toId: number;
  progress: number;
  color: string;
}

interface ClusterNode {
  id: number;
  x: number;
  y: number;
  angle: number;
}

interface ExternalValidator {
  id: number;
  x: number;
  y: number;
  angle: number;
  hasBlock: boolean;
}

interface ClusterMessage {
  id: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  progress: number;
  type: "internal" | "external";
}

const PHASES = [
  {
    title: "Traditional BFT: The Problem",
    desc: "Every validator must message every other. Intercontinental latency: 100-300ms per round."
  },
  {
    title: "Archon Cluster Forms",
    desc: "5 validators co-located in same datacenter. Internal latency: <5ms."
  },
  {
    title: "Fast Internal Consensus",
    desc: "Cluster reaches BFT agreement in ~5ms. No waiting for distant validators."
  },
  {
    title: "Single Broadcast to Network",
    desc: "Cluster proposes as ONE entity. Result: ~10ms blocks vs ~130ms traditional."
  },
];

const CITIES = [
  { name: "NYC", color: "#3B82F6" },
  { name: "LON", color: "#10B981" },
  { name: "TKY", color: "#F59E0B" },
  { name: "SYD", color: "#EF4444" },
  { name: "SFO", color: "#A855F7" },
  { name: "SGP", color: "#06B6D4" },
];

export const ArchonConsensus = memo(function ArchonConsensus() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const isVisible = useVisibility(containerRef);

  const traditionalValidatorsRef = useRef<TraditionalValidator[]>([]);
  const traditionalMessagesRef = useRef<TraditionalMessage[]>([]);
  const clusterNodesRef = useRef<ClusterNode[]>([]);
  const externalValidatorsRef = useRef<ExternalValidator[]>([]);
  const clusterMessagesRef = useRef<ClusterMessage[]>([]);

  const phaseTimerRef = useRef(0);
  const messageIdRef = useRef(0);
  const latencyCounterRef = useRef(0);
  const archonLatencyRef = useRef(0);
  const lastWidthRef = useRef(0);

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

      // Reinitialize if width changed significantly
      const widthChanged = Math.abs(width - lastWidthRef.current) > 50;

      if (canvas.width !== Math.floor(width * dpr) || widthChanged) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        lastWidthRef.current = width;

        if (mobile) {
          // MOBILE: Stacked layout
          // Traditional on top half
          const topCenterX = width * 0.5;
          const topCenterY = height * 0.22;
          const tradRadius = 45;

          traditionalValidatorsRef.current = CITIES.map((city, i) => {
            const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
            return {
              id: i,
              x: topCenterX + Math.cos(angle) * tradRadius,
              y: topCenterY + Math.sin(angle) * tradRadius,
              city: city.name,
              color: city.color,
            };
          });

          // Archon on bottom half
          const bottomCenterX = width * 0.5;
          const bottomCenterY = height * 0.68;
          const clusterRadius = 18;

          clusterNodesRef.current = [];
          for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
            clusterNodesRef.current.push({
              id: i,
              x: bottomCenterX + Math.cos(angle) * clusterRadius,
              y: bottomCenterY + Math.sin(angle) * clusterRadius,
              angle,
            });
          }

          const externalRadius = 55;
          const numExternal = 8;
          externalValidatorsRef.current = [];
          for (let i = 0; i < numExternal; i++) {
            const angle = (i / numExternal) * Math.PI * 2 - Math.PI / 2;
            externalValidatorsRef.current.push({
              id: i,
              x: bottomCenterX + Math.cos(angle) * externalRadius,
              y: bottomCenterY + Math.sin(angle) * externalRadius,
              angle,
              hasBlock: false,
            });
          }
        } else {
          // DESKTOP: Side-by-side layout
          const leftCenterX = width * 0.25;
          const leftCenterY = height * 0.45;
          const tradRadius = 75;

          traditionalValidatorsRef.current = CITIES.map((city, i) => {
            const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
            return {
              id: i,
              x: leftCenterX + Math.cos(angle) * tradRadius,
              y: leftCenterY + Math.sin(angle) * tradRadius,
              city: city.name,
              color: city.color,
            };
          });

          const rightCenterX = width * 0.75;
          const rightCenterY = height * 0.45;
          const clusterRadius = 28;

          clusterNodesRef.current = [];
          for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
            clusterNodesRef.current.push({
              id: i,
              x: rightCenterX + Math.cos(angle) * clusterRadius,
              y: rightCenterY + Math.sin(angle) * clusterRadius,
              angle,
            });
          }

          const externalRadius = 90;
          const numExternal = 12;
          externalValidatorsRef.current = [];
          for (let i = 0; i < numExternal; i++) {
            const angle = (i / numExternal) * Math.PI * 2 - Math.PI / 2;
            externalValidatorsRef.current.push({
              id: i,
              x: rightCenterX + Math.cos(angle) * externalRadius,
              y: rightCenterY + Math.sin(angle) * externalRadius,
              angle,
              hasBlock: false,
            });
          }
        }
      }

      // Clear
      ctx.fillStyle = "#0a0a0b";
      ctx.fillRect(0, 0, width, height);

      // Phase timer
      phaseTimerRef.current++;
      if (phaseTimerRef.current > 70) {
        phaseTimerRef.current = 0;
        const nextPhase = (currentPhase + 1) % 4;
        setCurrentPhase(nextPhase);
        latencyCounterRef.current = 0;
        archonLatencyRef.current = 0;
        traditionalMessagesRef.current = [];
        clusterMessagesRef.current = [];
        externalValidatorsRef.current.forEach(v => v.hasBlock = false);
      }

      // Update latency counters
      if (currentPhase === 0) {
        latencyCounterRef.current = Math.min(latencyCounterRef.current + 3, 130);
      } else if (currentPhase >= 2) {
        archonLatencyRef.current = Math.min(archonLatencyRef.current + 0.8, 10);
      }

      // Get centers based on layout
      const tradCenterX = mobile ? width * 0.5 : width * 0.25;
      const tradCenterY = mobile ? height * 0.22 : height * 0.45;
      const archonCenterX = mobile ? width * 0.5 : width * 0.75;
      const archonCenterY = mobile ? height * 0.68 : height * 0.45;

      // Spawn traditional messages
      if (currentPhase === 0 && phaseTimerRef.current % 8 === 0) {
        const validators = traditionalValidatorsRef.current;
        if (validators.length > 0) {
          const fromIdx = Math.floor(Math.random() * validators.length);
          let toIdx = Math.floor(Math.random() * validators.length);
          while (toIdx === fromIdx) toIdx = Math.floor(Math.random() * validators.length);
          traditionalMessagesRef.current.push({
            id: messageIdRef.current++,
            fromId: fromIdx,
            toId: toIdx,
            progress: 0,
            color: validators[fromIdx].color,
          });
        }
      }

      // Spawn cluster messages
      if (currentPhase === 2 && phaseTimerRef.current % 4 === 0) {
        const cluster = clusterNodesRef.current;
        if (cluster.length > 0) {
          const fromIdx = Math.floor(Math.random() * cluster.length);
          let toIdx = Math.floor(Math.random() * cluster.length);
          while (toIdx === fromIdx) toIdx = Math.floor(Math.random() * cluster.length);
          clusterMessagesRef.current.push({
            id: messageIdRef.current++,
            fromX: cluster[fromIdx].x,
            fromY: cluster[fromIdx].y,
            toX: cluster[toIdx].x,
            toY: cluster[toIdx].y,
            progress: 0,
            type: "internal",
          });
        }
      }

      // Spawn external messages
      if (currentPhase === 3 && phaseTimerRef.current === 10) {
        externalValidatorsRef.current.forEach((ext, i) => {
          setTimeout(() => {
            clusterMessagesRef.current.push({
              id: messageIdRef.current++,
              fromX: archonCenterX,
              fromY: archonCenterY,
              toX: ext.x,
              toY: ext.y,
              progress: 0,
              type: "external",
            });
          }, i * 30);
        });
      }

      if (mobile) {
        // === MOBILE: STACKED LAYOUT ===

        // Horizontal divider
        const dividerY = height * 0.44;
        ctx.strokeStyle = "rgba(255,255,255,0.15)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(20, dividerY);
        ctx.lineTo(width - 20, dividerY);
        ctx.stroke();
        ctx.setLineDash([]);

        // "VS" in middle
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = "bold 10px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("vs", width / 2, dividerY + 4);

        // TOP: Traditional BFT
        ctx.fillStyle = currentPhase === 0 ? "#EF4444" : "rgba(255,255,255,0.5)";
        ctx.font = "bold 9px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("TRADITIONAL BFT", tradCenterX, 14);

        // BOTTOM: Archon
        ctx.fillStyle = currentPhase >= 1 ? "#00D9A5" : "rgba(255,255,255,0.5)";
        ctx.fillText("ARCHON", archonCenterX, dividerY + 18);

        // Traditional latency bar (top section)
        const tradBarY = height * 0.38;
        const barWidth = width * 0.5;
        const barHeight = 8;

        ctx.fillStyle = "rgba(255,255,255,0.1)";
        ctx.fillRect(tradCenterX - barWidth / 2, tradBarY, barWidth, barHeight);
        const tradFill = (latencyCounterRef.current / 130) * barWidth;
        ctx.fillStyle = "#EF4444";
        ctx.fillRect(tradCenterX - barWidth / 2, tradBarY, tradFill, barHeight);

        ctx.fillStyle = "#EF4444";
        ctx.font = "bold 11px monospace";
        ctx.fillText(`${Math.floor(latencyCounterRef.current)}ms`, tradCenterX, tradBarY - 6);

        // Archon latency bar (bottom section)
        const archonBarY = height * 0.88;
        ctx.fillStyle = "rgba(255,255,255,0.1)";
        ctx.fillRect(archonCenterX - barWidth / 2, archonBarY, barWidth, barHeight);
        const archonFill = (archonLatencyRef.current / 10) * barWidth;
        ctx.fillStyle = "#00D9A5";
        ctx.fillRect(archonCenterX - barWidth / 2, archonBarY, archonFill, barHeight);

        ctx.fillStyle = "#00D9A5";
        ctx.font = "bold 11px monospace";
        ctx.fillText(`${Math.floor(archonLatencyRef.current)}ms`, archonCenterX, archonBarY - 6);

        // Cluster label
        if (currentPhase >= 1) {
          ctx.fillStyle = "#00D9A5" + "80";
          ctx.font = "bold 6px system-ui";
          ctx.fillText("SAME DATACENTER", archonCenterX, archonCenterY - 30);
        }

      } else {
        // === DESKTOP: SIDE-BY-SIDE LAYOUT ===

        // Vertical divider
        const midX = width * 0.5;
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(midX, 30);
        ctx.lineTo(midX, height - 50);
        ctx.stroke();
        ctx.setLineDash([]);

        // "VS"
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.font = "bold 12px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("vs", midX, height * 0.45);

        // Titles
        ctx.fillStyle = currentPhase === 0 ? "#EF4444" : "rgba(255,255,255,0.5)";
        ctx.font = "bold 10px system-ui";
        ctx.fillText("TRADITIONAL BFT", tradCenterX, 22);

        ctx.fillStyle = currentPhase >= 1 ? "#00D9A5" : "rgba(255,255,255,0.5)";
        ctx.fillText("ARCHON", archonCenterX, 22);

        // Latency bars
        const barY = height - 45;
        const barWidth = width * 0.2;
        const barHeight = 12;

        // Traditional bar
        ctx.fillStyle = "rgba(255,255,255,0.1)";
        ctx.fillRect(tradCenterX - barWidth / 2, barY, barWidth, barHeight);
        const tradFill = (latencyCounterRef.current / 130) * barWidth;
        ctx.fillStyle = "#EF4444";
        ctx.fillRect(tradCenterX - barWidth / 2, barY, tradFill, barHeight);

        ctx.fillStyle = "#EF4444";
        ctx.font = "bold 12px monospace";
        ctx.fillText(`${Math.floor(latencyCounterRef.current)}ms`, tradCenterX, barY - 5);

        if (currentPhase === 0 && latencyCounterRef.current < 130) {
          ctx.fillStyle = "rgba(255,255,255,0.4)";
          ctx.font = "8px system-ui";
          ctx.fillText("Waiting for all validators...", tradCenterX, barY + barHeight + 14);
        }

        // Archon bar
        ctx.fillStyle = "rgba(255,255,255,0.1)";
        ctx.fillRect(archonCenterX - barWidth / 2, barY, barWidth, barHeight);
        const archonFill = (archonLatencyRef.current / 10) * barWidth;
        ctx.fillStyle = "#00D9A5";
        ctx.fillRect(archonCenterX - barWidth / 2, barY, archonFill, barHeight);

        ctx.fillStyle = "#00D9A5";
        ctx.font = "bold 12px monospace";
        ctx.fillText(`${Math.floor(archonLatencyRef.current)}ms`, archonCenterX, barY - 5);

        if (currentPhase >= 2) {
          ctx.fillStyle = "rgba(255,255,255,0.4)";
          ctx.font = "8px system-ui";
          ctx.fillText(currentPhase === 2 ? "Internal consensus: ~5ms" : "Cluster broadcasts as ONE", archonCenterX, barY + barHeight + 14);
        }

        // Cluster label
        if (currentPhase >= 1) {
          ctx.fillStyle = "#00D9A5" + "80";
          ctx.font = "bold 7px system-ui";
          ctx.fillText("SAME DATACENTER", archonCenterX, archonCenterY - 50);
        }
      }

      // Draw traditional validators
      const tradValidators = traditionalValidatorsRef.current;

      // Connection lines
      if (currentPhase === 0) {
        ctx.strokeStyle = "rgba(255,255,255,0.05)";
        ctx.lineWidth = 0.5;
        for (let i = 0; i < tradValidators.length; i++) {
          for (let j = i + 1; j < tradValidators.length; j++) {
            ctx.beginPath();
            ctx.moveTo(tradValidators[i].x, tradValidators[i].y);
            ctx.lineTo(tradValidators[j].x, tradValidators[j].y);
            ctx.stroke();
          }
        }
      }

      // Validators with city labels
      tradValidators.forEach((v) => {
        const size = mobile ? 5 : 7;
        const isActive = currentPhase === 0;

        ctx.fillStyle = isActive ? v.color : "rgba(255,255,255,0.3)";
        ctx.beginPath();
        ctx.arc(v.x, v.y, size, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = isActive ? v.color : "rgba(255,255,255,0.3)";
        ctx.font = mobile ? "5px monospace" : "7px monospace";
        ctx.textAlign = "center";
        ctx.fillText(v.city, v.x, v.y + size + (mobile ? 8 : 12));
      });

      // Traditional messages
      traditionalMessagesRef.current = traditionalMessagesRef.current.filter((msg) => {
        msg.progress += 0.015;
        const from = tradValidators[msg.fromId];
        const to = tradValidators[msg.toId];
        if (!from || !to) return false;
        const x = from.x + (to.x - from.x) * msg.progress;
        const y = from.y + (to.y - from.y) * msg.progress;

        ctx.fillStyle = msg.color + "80";
        ctx.beginPath();
        ctx.arc(x, y, mobile ? 2 : 3, 0, Math.PI * 2);
        ctx.fill();

        return msg.progress < 1;
      });

      // Cluster boundary
      const clusterRadius = mobile ? 30 : 45;
      const clusterActive = currentPhase >= 1;

      ctx.strokeStyle = clusterActive ? "#00D9A5" + "60" : "rgba(255,255,255,0.1)";
      ctx.lineWidth = clusterActive ? 2 : 1;
      ctx.beginPath();
      ctx.arc(archonCenterX, archonCenterY, clusterRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Cluster internal connections
      const cluster = clusterNodesRef.current;
      if (currentPhase === 2) {
        ctx.strokeStyle = "#00D9A5" + "30";
        ctx.lineWidth = 1;
        for (let i = 0; i < cluster.length; i++) {
          for (let j = i + 1; j < cluster.length; j++) {
            ctx.beginPath();
            ctx.moveTo(cluster[i].x, cluster[i].y);
            ctx.lineTo(cluster[j].x, cluster[j].y);
            ctx.stroke();
          }
        }
      }

      // Cluster nodes
      cluster.forEach((node) => {
        const size = mobile ? 5 : 6;
        const isActive = currentPhase >= 1;

        if (isActive && currentPhase === 2) {
          const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, size * 2);
          glow.addColorStop(0, "#00D9A5" + "40");
          glow.addColorStop(1, "transparent");
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(node.x, node.y, size * 2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = isActive ? "#00D9A5" : "rgba(255,255,255,0.3)";
        ctx.beginPath();
        ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
        ctx.fill();
      });

      // External validator ring
      const externalRadius = mobile ? 55 : 90;
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.arc(archonCenterX, archonCenterY, externalRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // External validators
      externalValidatorsRef.current.forEach((ext) => {
        const size = mobile ? 3 : 4;
        const isActive = currentPhase >= 3;

        ctx.fillStyle = ext.hasBlock ? "#00D9A5" : (isActive ? "#3B82F6" : "rgba(255,255,255,0.2)");
        ctx.beginPath();
        ctx.arc(ext.x, ext.y, size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Cluster messages
      clusterMessagesRef.current = clusterMessagesRef.current.filter((msg) => {
        const speed = msg.type === "internal" ? 0.15 : 0.04;
        msg.progress += speed;

        const x = msg.fromX + (msg.toX - msg.fromX) * msg.progress;
        const y = msg.fromY + (msg.toY - msg.fromY) * msg.progress;

        ctx.fillStyle = msg.type === "internal" ? "#00D9A5" : "#3B82F6";
        ctx.beginPath();
        ctx.arc(x, y, mobile ? 2 : 3, 0, Math.PI * 2);
        ctx.fill();

        if (msg.type === "external" && msg.progress >= 0.95) {
          externalValidatorsRef.current.forEach(ext => {
            if (Math.abs(ext.x - msg.toX) < 5 && Math.abs(ext.y - msg.toY) < 5) {
              ext.hasBlock = true;
            }
          });
        }

        return msg.progress < 1;
      });

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationRef.current);
  }, [currentPhase, isVisible]);

  return (
    <div ref={containerRef} className="chrome-card p-2 sm:p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="px-1.5 py-0.5 rounded text-[8px] sm:text-[10px] font-bold"
              style={{ backgroundColor: "#F59E0B", color: "#000" }}
            >
              2026
            </span>
            <h3 className="text-xs sm:text-sm font-bold" style={{ color: "var(--chrome-200)" }}>
              Archon: Primary-Proxy Consensus
            </h3>
          </div>
          <p className="text-[9px] sm:text-xs" style={{ color: "var(--chrome-600)" }}>
            {isMobile ? "Co-located cluster = 13× faster" : "Co-located validator cluster enables 13× faster consensus"}
          </p>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full rounded"
        style={{ height: isMobile ? "320px" : "300px" }}
      />

      {/* Phase explanation */}
      <div className="mt-2 p-2 rounded-lg bg-white/5 border border-white/10">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="px-1.5 py-0.5 rounded text-[8px] sm:text-xs font-bold flex-shrink-0"
            style={{ backgroundColor: currentPhase === 0 ? "#EF4444" : "#00D9A5", color: currentPhase === 0 ? "#fff" : "#000" }}
          >
            {currentPhase + 1}/4
          </span>
          <span className="text-[10px] sm:text-sm font-bold truncate" style={{ color: currentPhase === 0 ? "#EF4444" : "#00D9A5" }}>
            {PHASES[currentPhase].title}
          </span>
        </div>
        <p className="text-[9px] sm:text-xs" style={{ color: "var(--chrome-400)" }}>
          {PHASES[currentPhase].desc}
        </p>
      </div>

      {/* Key insight */}
      <div className="mt-2 p-2 rounded bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20">
        <p className="text-[9px] sm:text-xs" style={{ color: "var(--chrome-400)" }}>
          <span className="font-bold" style={{ color: "#F59E0B" }}>Key:</span>
          {" You can't speed up light. But you CAN reduce round-trips by using a co-located cluster."}
        </p>
      </div>

      {/* Comparison stats */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="p-2 rounded bg-red-500/10 border border-red-500/20 text-center">
          <div className="text-[10px] sm:text-xs font-bold" style={{ color: "#EF4444" }}>Traditional</div>
          <div className="text-base sm:text-xl font-bold" style={{ color: "#EF4444" }}>~130ms</div>
        </div>
        <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-center">
          <div className="text-[10px] sm:text-xs font-bold" style={{ color: "#00D9A5" }}>Archon</div>
          <div className="text-base sm:text-xl font-bold" style={{ color: "#00D9A5" }}>~10ms</div>
        </div>
      </div>
    </div>
  );
});
