"use client";

import { useRef, useEffect, useState, memo } from "react";
import { useVisibility } from "@/hooks/useVisibility";

/**
 * Archon Consensus Visualization - Redesigned
 *
 * Shows WHY a co-located cluster makes consensus faster:
 * - Side-by-side comparison: Traditional BFT vs Archon
 * - Geographic visualization of latency problem
 * - N×N communication vs cluster + broadcast
 *
 * Key insight: You can't reduce network latency (physics).
 * But you CAN reduce the NUMBER of round-trips.
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
    desc: "Every validator must message every other. Intercontinental latency: 100-300ms per round. 3 rounds = slow blocks."
  },
  {
    title: "Archon Cluster Forms",
    desc: "5 validators co-located in same datacenter. Internal latency: <5ms. They act as ONE 'super-validator'."
  },
  {
    title: "Fast Internal Consensus",
    desc: "Cluster reaches BFT agreement in ~5ms (not 100-300ms). No waiting for distant validators."
  },
  {
    title: "Single Broadcast to Network",
    desc: "Cluster proposes as ONE entity. 5× fewer round-trips. Result: ~10ms blocks vs ~130ms traditional."
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

        // Initialize traditional validators (left side)
        const leftCenterX = width * 0.25;
        const leftCenterY = height * 0.48;
        const tradRadius = mobile ? 50 : 75;

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

        // Initialize Archon cluster (right side center)
        const rightCenterX = width * 0.75;
        const rightCenterY = height * 0.48;
        const clusterRadius = mobile ? 20 : 28;

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

        // Initialize external validators (ring around cluster)
        const externalRadius = mobile ? 65 : 90;
        const numExternal = mobile ? 8 : 12;

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

      // Clear
      ctx.fillStyle = "#0a0a0b";
      ctx.fillRect(0, 0, width, height);

      const leftCenterX = width * 0.25;
      const leftCenterY = height * 0.48;
      const rightCenterX = width * 0.75;
      const rightCenterY = height * 0.48;
      const midX = width * 0.5;

      // Phase timer - faster animation
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

      // Update latency counters based on phase - faster
      if (currentPhase === 0) {
        latencyCounterRef.current = Math.min(latencyCounterRef.current + 3, 130);
      } else if (currentPhase >= 2) {
        archonLatencyRef.current = Math.min(archonLatencyRef.current + 0.8, 10);
      }

      // Spawn traditional messages in phase 0
      if (currentPhase === 0 && phaseTimerRef.current % 8 === 0) {
        const validators = traditionalValidatorsRef.current;
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

      // Spawn cluster messages in phase 2
      if (currentPhase === 2 && phaseTimerRef.current % 4 === 0) {
        const cluster = clusterNodesRef.current;
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

      // Spawn external messages in phase 3
      if (currentPhase === 3 && phaseTimerRef.current === 10) {
        externalValidatorsRef.current.forEach((ext, i) => {
          setTimeout(() => {
            clusterMessagesRef.current.push({
              id: messageIdRef.current++,
              fromX: rightCenterX,
              fromY: rightCenterY,
              toX: ext.x,
              toY: ext.y,
              progress: 0,
              type: "external",
            });
          }, i * 30);
        });
      }

      // Draw divider
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(midX, 30);
      ctx.lineTo(midX, height - 60);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw "VS" label
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = mobile ? "bold 10px system-ui" : "bold 12px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("vs", midX, height * 0.48);

      // === LEFT SIDE: Traditional BFT ===

      // Title
      ctx.fillStyle = currentPhase === 0 ? "#EF4444" : "rgba(255,255,255,0.5)";
      ctx.font = mobile ? "bold 8px system-ui" : "bold 10px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("TRADITIONAL BFT", leftCenterX, mobile ? 16 : 22);

      // Draw traditional validators
      const tradValidators = traditionalValidatorsRef.current;

      // Draw connection lines (show N×N complexity)
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

      // Draw validators with city labels
      tradValidators.forEach((v) => {
        const size = mobile ? 5 : 7;
        const isActive = currentPhase === 0;

        ctx.fillStyle = isActive ? v.color : "rgba(255,255,255,0.3)";
        ctx.beginPath();
        ctx.arc(v.x, v.y, size, 0, Math.PI * 2);
        ctx.fill();

        // City label
        ctx.fillStyle = isActive ? v.color : "rgba(255,255,255,0.3)";
        ctx.font = mobile ? "5px monospace" : "7px monospace";
        ctx.textAlign = "center";
        ctx.fillText(v.city, v.x, v.y + size + (mobile ? 8 : 12));
      });

      // Draw and update traditional messages
      traditionalMessagesRef.current = traditionalMessagesRef.current.filter((msg) => {
        msg.progress += 0.015; // Slow!

        const from = tradValidators[msg.fromId];
        const to = tradValidators[msg.toId];
        const x = from.x + (to.x - from.x) * msg.progress;
        const y = from.y + (to.y - from.y) * msg.progress;
        const size = mobile ? 2 : 3;

        ctx.fillStyle = msg.color + "80";
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();

        return msg.progress < 1;
      });

      // Traditional latency bar
      const tradBarY = height - (mobile ? 45 : 55);
      const barWidth = width * 0.2;
      const barHeight = mobile ? 8 : 12;

      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fillRect(leftCenterX - barWidth / 2, tradBarY, barWidth, barHeight);

      const tradFill = (latencyCounterRef.current / 130) * barWidth;
      ctx.fillStyle = "#EF4444";
      ctx.fillRect(leftCenterX - barWidth / 2, tradBarY, tradFill, barHeight);

      ctx.fillStyle = "#EF4444";
      ctx.font = mobile ? "bold 10px monospace" : "bold 12px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${Math.floor(latencyCounterRef.current)}ms`, leftCenterX, tradBarY - 5);

      // "Waiting for..." label
      if (currentPhase === 0 && latencyCounterRef.current < 130) {
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = mobile ? "6px system-ui" : "8px system-ui";
        ctx.fillText("Waiting for all validators...", leftCenterX, tradBarY + barHeight + (mobile ? 10 : 14));
      }

      // === RIGHT SIDE: Archon ===

      // Title
      ctx.fillStyle = currentPhase >= 1 ? "#00D9A5" : "rgba(255,255,255,0.5)";
      ctx.font = mobile ? "bold 8px system-ui" : "bold 10px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("ARCHON", rightCenterX, mobile ? 16 : 22);

      // Draw cluster boundary
      const clusterRadius = mobile ? 32 : 45;
      const clusterActive = currentPhase >= 1;

      ctx.strokeStyle = clusterActive ? "#00D9A5" + "60" : "rgba(255,255,255,0.1)";
      ctx.lineWidth = clusterActive ? 2 : 1;
      ctx.beginPath();
      ctx.arc(rightCenterX, rightCenterY, clusterRadius, 0, Math.PI * 2);
      ctx.stroke();

      // "Same Datacenter" label
      if (clusterActive) {
        ctx.fillStyle = "#00D9A5" + "80";
        ctx.font = mobile ? "bold 5px system-ui" : "bold 7px system-ui";
        ctx.fillText("SAME DATACENTER", rightCenterX, rightCenterY - clusterRadius - (mobile ? 8 : 12));
      }

      // Draw cluster internal connections
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

      // Draw cluster nodes
      cluster.forEach((node, i) => {
        const size = mobile ? 5 : 6;
        const isActive = currentPhase >= 1;

        // Glow for active
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

      // Draw external validator ring
      const externalRadius = mobile ? 65 : 90;
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.arc(rightCenterX, rightCenterY, externalRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // "Global Network" label
      if (currentPhase >= 3) {
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = mobile ? "5px system-ui" : "6px system-ui";
        ctx.fillText("GLOBAL NETWORK", rightCenterX, rightCenterY + externalRadius + (mobile ? 10 : 14));
      }

      // Draw external validators
      externalValidatorsRef.current.forEach((ext) => {
        const size = mobile ? 3 : 4;
        const isActive = currentPhase >= 3;

        ctx.fillStyle = ext.hasBlock ? "#00D9A5" : (isActive ? "#3B82F6" : "rgba(255,255,255,0.2)");
        ctx.beginPath();
        ctx.arc(ext.x, ext.y, size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw and update cluster messages
      clusterMessagesRef.current = clusterMessagesRef.current.filter((msg) => {
        const speed = msg.type === "internal" ? 0.15 : 0.04; // Internal is FAST
        msg.progress += speed;

        const x = msg.fromX + (msg.toX - msg.fromX) * msg.progress;
        const y = msg.fromY + (msg.toY - msg.fromY) * msg.progress;
        const size = mobile ? 2 : 3;

        ctx.fillStyle = msg.type === "internal" ? "#00D9A5" : "#3B82F6";
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();

        // Mark external validator as received
        if (msg.type === "external" && msg.progress >= 0.95) {
          externalValidatorsRef.current.forEach(ext => {
            if (Math.abs(ext.x - msg.toX) < 5 && Math.abs(ext.y - msg.toY) < 5) {
              ext.hasBlock = true;
            }
          });
        }

        return msg.progress < 1;
      });

      // Archon latency bar
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fillRect(rightCenterX - barWidth / 2, tradBarY, barWidth, barHeight);

      const archonFill = (archonLatencyRef.current / 10) * barWidth;
      ctx.fillStyle = "#00D9A5";
      ctx.fillRect(rightCenterX - barWidth / 2, tradBarY, archonFill, barHeight);

      ctx.fillStyle = "#00D9A5";
      ctx.font = mobile ? "bold 10px monospace" : "bold 12px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${Math.floor(archonLatencyRef.current)}ms`, rightCenterX, tradBarY - 5);

      // "Cluster ready" label
      if (currentPhase >= 2) {
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = mobile ? "6px system-ui" : "8px system-ui";
        ctx.fillText(currentPhase === 2 ? "Internal consensus: ~5ms" : "Cluster broadcasts as ONE", rightCenterX, tradBarY + barHeight + (mobile ? 10 : 14));
      }

      // Bottom comparison
      if (currentPhase === 3 && phaseTimerRef.current > 60) {
        const compY = height - (mobile ? 18 : 22);
        ctx.fillStyle = "#00D9A5";
        ctx.font = mobile ? "bold 7px system-ui" : "bold 9px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("13× FASTER: Fewer round-trips, not faster light", width / 2, compY);
      }

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
              COMING 2026
            </span>
            <h3 className="text-xs sm:text-sm font-bold" style={{ color: "var(--chrome-200)" }}>
              Archon: The Innovation
            </h3>
          </div>
          <p className="text-[9px] sm:text-xs" style={{ color: "var(--chrome-600)" }}>
            {isMobile ? "Why co-located clusters = 13× faster" : "Why co-located validator clusters enable 13× faster consensus"}
          </p>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full rounded"
        style={{ height: isMobile ? "240px" : "320px" }}
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
          <span className="font-bold" style={{ color: "#F59E0B" }}>Key Insight:</span>
          {isMobile
            ? " You can't speed up light. But you CAN reduce round-trips by delegating internal consensus to a co-located cluster."
            : " You can't reduce network latency (physics-limited). But you CAN reduce the NUMBER of round-trips. The cluster absorbs N×N validator communication into fast internal consensus, then broadcasts as ONE entity."
          }
        </p>
      </div>

      {/* Comparison stats */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="p-2 rounded bg-red-500/10 border border-red-500/20 text-center">
          <div className="text-xs sm:text-sm font-bold" style={{ color: "#EF4444" }}>Traditional</div>
          <div className="text-lg sm:text-xl font-bold" style={{ color: "#EF4444" }}>~130ms</div>
          <div className="text-[8px] sm:text-[10px]" style={{ color: "var(--chrome-500)" }}>N×N messages, 3 rounds</div>
        </div>
        <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-center">
          <div className="text-xs sm:text-sm font-bold" style={{ color: "#00D9A5" }}>Archon</div>
          <div className="text-lg sm:text-xl font-bold" style={{ color: "#00D9A5" }}>~10ms</div>
          <div className="text-[8px] sm:text-[10px]" style={{ color: "var(--chrome-500)" }}>Cluster + 1 broadcast</div>
        </div>
      </div>
    </div>
  );
});
