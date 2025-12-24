"use client";

import { useRef, useEffect, useState, memo } from "react";
import { useVisibility } from "@/hooks/useVisibility";

/**
 * Archon Consensus Visualization
 *
 * Archon introduces a Primary-Proxy Leader Architecture:
 * - A small, co-located cluster of validators acts as a single stable BFT leader
 * - Eliminates latency from frequent leader rotations in traditional BFT
 * - Targets ~10ms block times (down from ~50ms with Velociraptr)
 * - ~30ms deterministic transaction inclusion/finality
 *
 * Builds on Velociraptr (AIP-131) and AptosBFT
 */

interface ClusterNode {
  id: number;
  x: number;
  y: number;
  angle: number;
  isPrimary: boolean;
  pulsePhase: number;
}

interface ExternalValidator {
  id: number;
  x: number;
  y: number;
  angle: number;
  receiveProgress: number;
  hasBlock: boolean;
}

interface MessageParticle {
  id: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  progress: number;
  type: "internal" | "external";
  color: string;
}

const PHASES = [
  {
    phase: 1,
    title: "Cluster Formation",
    desc: "Co-located validators form a stable leader cluster with ultra-low internal latency"
  },
  {
    phase: 2,
    title: "Internal BFT",
    desc: "Cluster reaches internal consensus in microseconds due to geographic proximity"
  },
  {
    phase: 3,
    title: "Block Proposal",
    desc: "Unified cluster proposes block to full validator set as single logical leader"
  },
  {
    phase: 4,
    title: "Network Consensus",
    desc: "External validators vote; ~10ms block time, ~30ms inclusion proof"
  },
];

const COMPARISON = [
  { label: "Traditional BFT", time: "100-150ms", hops: "4 hops", issue: "Leader rotation overhead" },
  { label: "Velociraptr", time: "~50ms", hops: "3 hops", issue: "Still rotates leaders" },
  { label: "Archon", time: "~10ms", hops: "Stable", issue: "Clustered stability" },
];

export const ArchonConsensus = memo(function ArchonConsensus() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const isVisible = useVisibility(containerRef);

  const clusterNodesRef = useRef<ClusterNode[]>([]);
  const externalValidatorsRef = useRef<ExternalValidator[]>([]);
  const particlesRef = useRef<MessageParticle[]>([]);
  const phaseTimerRef = useRef(0);
  const particleIdRef = useRef(0);

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

        // Initialize cluster nodes (5 co-located validators)
        const clusterCenterX = width * 0.35;
        const clusterCenterY = height * 0.5;
        const clusterRadius = mobile ? 35 : 50;

        clusterNodesRef.current = [];
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
          clusterNodesRef.current.push({
            id: i,
            x: clusterCenterX + Math.cos(angle) * clusterRadius,
            y: clusterCenterY + Math.sin(angle) * clusterRadius,
            angle,
            isPrimary: i === 0,
            pulsePhase: i * 0.2,
          });
        }

        // Initialize external validators (ring around the cluster)
        const externalCenterX = width * 0.35;
        const externalCenterY = height * 0.5;
        const externalRadius = mobile ? 90 : 130;
        const numExternal = mobile ? 12 : 20;

        externalValidatorsRef.current = [];
        for (let i = 0; i < numExternal; i++) {
          const angle = (i / numExternal) * Math.PI * 2 - Math.PI / 2;
          externalValidatorsRef.current.push({
            id: i,
            x: externalCenterX + Math.cos(angle) * externalRadius,
            y: externalCenterY + Math.sin(angle) * externalRadius,
            angle,
            receiveProgress: 0,
            hasBlock: false,
          });
        }
      }

      // Clear
      ctx.fillStyle = "#0a0a0b";
      ctx.fillRect(0, 0, width, height);

      // Phase timer
      phaseTimerRef.current++;
      if (phaseTimerRef.current > 90) {
        phaseTimerRef.current = 0;
        const nextPhase = (currentPhase + 1) % 4;
        setCurrentPhase(nextPhase);

        // Reset external validators
        externalValidatorsRef.current.forEach(v => {
          v.hasBlock = false;
          v.receiveProgress = 0;
        });

        // Spawn particles based on phase
        if (nextPhase === 1) {
          // Internal cluster messaging
          const cluster = clusterNodesRef.current;
          for (let i = 0; i < cluster.length; i++) {
            for (let j = i + 1; j < cluster.length; j++) {
              particlesRef.current.push({
                id: particleIdRef.current++,
                fromX: cluster[i].x,
                fromY: cluster[i].y,
                toX: cluster[j].x,
                toY: cluster[j].y,
                progress: Math.random() * 0.3,
                type: "internal",
                color: "#00D9A5",
              });
            }
          }
        } else if (nextPhase === 2 || nextPhase === 3) {
          // Cluster to external validators
          const primary = clusterNodesRef.current[0];
          externalValidatorsRef.current.forEach((ext, i) => {
            setTimeout(() => {
              particlesRef.current.push({
                id: particleIdRef.current++,
                fromX: primary.x,
                fromY: primary.y,
                toX: ext.x,
                toY: ext.y,
                progress: 0,
                type: "external",
                color: "#3B82F6",
              });
            }, i * 20);
          });
        }
      }

      const clusterCenterX = width * 0.35;
      const clusterCenterY = height * 0.5;
      const clusterRadius = mobile ? 35 : 50;
      const externalRadius = mobile ? 90 : 130;

      // Draw title
      ctx.fillStyle = "#00D9A5";
      ctx.font = mobile ? "bold 9px system-ui" : "bold 11px system-ui";
      ctx.textAlign = "left";
      ctx.fillText("ARCHON: PRIMARY-PROXY LEADER", mobile ? 8 : 15, mobile ? 14 : 20);

      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = mobile ? "7px monospace" : "9px monospace";
      ctx.textAlign = "right";
      ctx.fillText("~10ms blocks", width - (mobile ? 8 : 15), mobile ? 14 : 20);

      // Draw external validator ring (background)
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 6]);
      ctx.beginPath();
      ctx.arc(clusterCenterX, clusterCenterY, externalRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw cluster boundary (highlight during phase 0-1)
      const clusterActive = currentPhase <= 1;
      ctx.strokeStyle = clusterActive ? "#00D9A5" + "60" : "rgba(255,255,255,0.1)";
      ctx.lineWidth = clusterActive ? 2 : 1;
      ctx.setLineDash(clusterActive ? [] : [2, 4]);
      ctx.beginPath();
      ctx.arc(clusterCenterX, clusterCenterY, clusterRadius + 15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw "CO-LOCATED" label for cluster
      if (clusterActive) {
        ctx.fillStyle = "#00D9A5" + "80";
        ctx.font = mobile ? "bold 6px system-ui" : "bold 8px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("CO-LOCATED", clusterCenterX, clusterCenterY - clusterRadius - (mobile ? 22 : 28));
        ctx.fillText("CLUSTER", clusterCenterX, clusterCenterY - clusterRadius - (mobile ? 14 : 18));
      }

      // Draw internal cluster connections
      const cluster = clusterNodesRef.current;
      ctx.strokeStyle = currentPhase === 1 ? "#00D9A5" + "40" : "rgba(255,255,255,0.05)";
      ctx.lineWidth = 1;
      for (let i = 0; i < cluster.length; i++) {
        for (let j = i + 1; j < cluster.length; j++) {
          ctx.beginPath();
          ctx.moveTo(cluster[i].x, cluster[i].y);
          ctx.lineTo(cluster[j].x, cluster[j].y);
          ctx.stroke();
        }
      }

      // Draw cluster nodes
      cluster.forEach((node, i) => {
        node.pulsePhase += 0.05;
        const pulse = currentPhase <= 1 ? Math.sin(node.pulsePhase) * 0.3 + 1 : 1;
        const size = (mobile ? 6 : 8) * pulse;

        // Glow
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, size * 3);
        gradient.addColorStop(0, (node.isPrimary ? "#00D9A5" : "#3B82F6") + "60");
        gradient.addColorStop(1, "transparent");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(node.x, node.y, size * 3, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.fillStyle = node.isPrimary ? "#00D9A5" : "#3B82F6";
        ctx.beginPath();
        ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
        ctx.fill();

        // Primary label
        if (node.isPrimary) {
          ctx.fillStyle = "#00D9A5";
          ctx.font = mobile ? "bold 5px monospace" : "bold 6px monospace";
          ctx.textAlign = "center";
          ctx.fillText("P", node.x, node.y + (mobile ? 2 : 2.5));
        }
      });

      // Draw external validators
      externalValidatorsRef.current.forEach((ext) => {
        const isReceiving = currentPhase >= 2;
        if (isReceiving && !ext.hasBlock) {
          ext.receiveProgress += 0.02;
          if (ext.receiveProgress > 1) ext.hasBlock = true;
        }

        const size = mobile ? 4 : 5;
        const color = ext.hasBlock ? "#00D9A5" : (isReceiving ? "#F59E0B" : "rgba(255,255,255,0.3)");

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(ext.x, ext.y, size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw and update particles
      particlesRef.current = particlesRef.current.filter((p) => {
        p.progress += p.type === "internal" ? 0.08 : 0.04;

        const x = p.fromX + (p.toX - p.fromX) * p.progress;
        const y = p.fromY + (p.toY - p.fromY) * p.progress;
        const size = mobile ? 2 : 3;

        // Trail
        const trailGradient = ctx.createRadialGradient(x, y, 0, x, y, size * 2);
        trailGradient.addColorStop(0, p.color + "80");
        trailGradient.addColorStop(1, "transparent");
        ctx.fillStyle = trailGradient;
        ctx.beginPath();
        ctx.arc(x, y, size * 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();

        return p.progress < 1;
      });

      // Draw comparison section on right side
      const compX = width * (mobile ? 0.68 : 0.72);
      const compY = mobile ? 35 : 50;
      const compWidth = mobile ? width * 0.30 : width * 0.25;
      const rowHeight = mobile ? 28 : 38;

      ctx.fillStyle = "rgba(255,255,255,0.03)";
      ctx.beginPath();
      ctx.roundRect(compX - 8, compY - 5, compWidth + 16, rowHeight * 3 + 15, 6);
      ctx.fill();

      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = mobile ? "bold 7px system-ui" : "bold 9px system-ui";
      ctx.textAlign = "left";
      ctx.fillText("LATENCY EVOLUTION", compX, compY + 6);

      COMPARISON.forEach((item, i) => {
        const y = compY + 18 + i * rowHeight;
        const isArchon = i === 2;
        const isActive = (i === 0 && currentPhase === 0) ||
                        (i === 1 && currentPhase === 1) ||
                        (i === 2 && currentPhase >= 2);

        // Background
        if (isActive) {
          ctx.fillStyle = isArchon ? "rgba(0, 217, 165, 0.15)" : "rgba(255,255,255,0.05)";
          ctx.beginPath();
          ctx.roundRect(compX - 4, y - 8, compWidth + 8, rowHeight - 4, 3);
          ctx.fill();
        }

        // Label
        ctx.fillStyle = isArchon ? "#00D9A5" : "rgba(255,255,255,0.7)";
        ctx.font = mobile ? "bold 6px system-ui" : "bold 8px system-ui";
        ctx.fillText(item.label, compX, y + 2);

        // Time
        ctx.fillStyle = isArchon ? "#00D9A5" : "#3B82F6";
        ctx.font = mobile ? "bold 8px monospace" : "bold 10px monospace";
        ctx.textAlign = "right";
        ctx.fillText(item.time, compX + compWidth, y + 2);
        ctx.textAlign = "left";

        // Subtext
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = mobile ? "5px system-ui" : "6px system-ui";
        ctx.fillText(item.issue, compX, y + (mobile ? 10 : 12));
      });

      // Draw bottom stats bar
      const statsY = height - (mobile ? 22 : 30);
      const stats = [
        { label: "Block Time", value: "~10ms", color: "#00D9A5" },
        { label: "Finality", value: "~30ms", color: "#3B82F6" },
        { label: "Cluster Size", value: "5 nodes", color: "#F59E0B" },
        { label: "Validators", value: "140+", color: "#A855F7" },
      ];

      const statWidth = (width - 20) / stats.length;
      stats.forEach((stat, i) => {
        const x = 10 + i * statWidth;

        ctx.fillStyle = stat.color;
        ctx.font = mobile ? "bold 9px monospace" : "bold 11px monospace";
        ctx.textAlign = "center";
        ctx.fillText(stat.value, x + statWidth / 2, statsY);

        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = mobile ? "5px system-ui" : "7px system-ui";
        ctx.fillText(stat.label, x + statWidth / 2, statsY + (mobile ? 10 : 12));
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
              COMING SOON
            </span>
            <h3 className="text-xs sm:text-sm font-bold" style={{ color: "var(--chrome-200)" }}>
              Archon: Next-Gen Consensus
            </h3>
          </div>
          <p className="text-[9px] sm:text-xs" style={{ color: "var(--chrome-600)" }}>
            {isMobile ? "10ms blocks via stable leader cluster" : "Primary-proxy leader architecture for ~10ms block times"}
          </p>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full rounded"
        style={{ height: isMobile ? "220px" : "300px" }}
      />

      {/* Phase explanation */}
      <div className="mt-2 p-2 rounded-lg bg-white/5 border border-white/10">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="px-1.5 py-0.5 rounded text-[8px] sm:text-xs font-bold flex-shrink-0"
            style={{ backgroundColor: "#00D9A5", color: "#000" }}
          >
            {currentPhase + 1}/4
          </span>
          <span className="text-[10px] sm:text-sm font-bold truncate" style={{ color: "#00D9A5" }}>
            {PHASES[currentPhase].title}
          </span>
        </div>
        <p className="text-[9px] sm:text-xs" style={{ color: "var(--chrome-400)" }}>
          {PHASES[currentPhase].desc}
        </p>
      </div>

      {/* Key innovation explanation */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="p-2 rounded bg-white/5">
          <div className="text-[10px] sm:text-xs font-bold mb-1" style={{ color: "#00D9A5" }}>
            Why Faster?
          </div>
          <p className="text-[8px] sm:text-[10px]" style={{ color: "var(--chrome-500)" }}>
            {isMobile
              ? "Co-located cluster eliminates rotation delays"
              : "Small co-located cluster acts as stable BFT leader, eliminating rotation overhead"
            }
          </p>
        </div>
        <div className="p-2 rounded bg-white/5">
          <div className="text-[10px] sm:text-xs font-bold mb-1" style={{ color: "#3B82F6" }}>
            Still Decentralized
          </div>
          <p className="text-[8px] sm:text-[10px]" style={{ color: "var(--chrome-500)" }}>
            {isMobile
              ? "Full BFT security, no trust assumptions"
              : "Cluster rotates internally; full 140+ validator network maintains BFT security"
            }
          </p>
        </div>
      </div>

      {/* Technical context */}
      <div className="mt-2 p-1.5 rounded bg-white/5">
        <p className="text-[8px] sm:text-xs" style={{ color: "var(--chrome-500)" }}>
          <span className="font-bold" style={{ color: "#F59E0B" }}>Builds on:</span>
          {isMobile
            ? " Velociraptr (50ms) → Archon (10ms). Integrates with Block-STM v2 & Encrypted Mempool."
            : " Velociraptr (AIP-131) achieved ~50ms blocks. Archon targets ~10ms via primary-proxy leader model. Integrates with Block-STM v2, Encrypted Mempool, and Event-Driven Transactions for CEX-level responsiveness."
          }
        </p>
      </div>
    </div>
  );
});
