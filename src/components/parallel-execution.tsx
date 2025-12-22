"use client";

import { useRef, useEffect, useMemo } from "react";
import { BlockStats } from "@/hooks/useAptosStream";

interface ParallelExecutionProps {
  recentBlocks: BlockStats[];
  tps: number;
  avgBlockTime?: number;
}

// Fast chains comparison (no slow ETH - compare similar speed chains)
const CHAINS = [
  {
    name: "Aptos",
    color: "#00D9A5",
    finality: 460, // ms - from Grafana chart
    blockTime: 94,
    consensus: "Raptr",
    parallelism: 8,
  },
  {
    name: "Sui",
    color: "#6FBCF0",
    finality: 480, // Fast path
    blockTime: 100,
    consensus: "Mysticeti",
    parallelism: 6,
  },
  {
    name: "Solana",
    color: "#14F195",
    finality: 400, // Optimistic
    blockTime: 400,
    consensus: "PoH+Tower",
    parallelism: 4,
  },
  {
    name: "megaETH",
    color: "#FF6B6B",
    finality: 100, // Claimed
    blockTime: 10,
    consensus: "Sequencer",
    parallelism: 10,
  },
];

interface Particle {
  id: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  stage: number; // 0=submit, 1=propose, 2=vote, 3=certify, 4=commit
  chainIndex: number;
  startTime: number;
  color: string;
}

interface ValidatorNode {
  x: number;
  y: number;
  angle: number;
  isProposer: boolean;
  hasVoted: boolean;
  voteTime: number;
}

export function ParallelExecution({ recentBlocks, tps, avgBlockTime = 94 }: ParallelExecutionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const nodesRef = useRef<ValidatorNode[]>([]);
  const txIdRef = useRef(0);
  const lastSpawnRef = useRef(0);
  const currentProposerRef = useRef(0);

  // Calculate real finality from recent blocks
  const realFinality = useMemo(() => {
    if (recentBlocks.length < 2) return 460;
    // Approximate E2E latency (block time * ~5 for full finality)
    return Math.round(avgBlockTime * 5);
  }, [recentBlocks, avgBlockTime]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Initialize validator nodes in a ring
    if (nodesRef.current.length === 0) {
      const nodeCount = 12; // Simplified representation
      for (let i = 0; i < nodeCount; i++) {
        const angle = (i / nodeCount) * Math.PI * 2 - Math.PI / 2;
        nodesRef.current.push({
          x: 0, // Will be calculated in render
          y: 0,
          angle,
          isProposer: i === 0,
          hasVoted: false,
          voteTime: 0,
        });
      }
    }

    let lastTime = 0;
    const targetFPS = 30;
    const frameInterval = 1000 / targetFPS;

    const render = (timestamp: number) => {
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
      const now = Date.now();

      // Clear
      ctx.fillStyle = "#0a0a0b";
      ctx.fillRect(0, 0, width, height);

      // Layout: Left side = node ring animation, Right side = chain comparison bars
      const ringCenterX = width * 0.28;
      const ringCenterY = height * 0.5;
      const ringRadius = Math.min(width * 0.22, height * 0.38);

      // ===== LEFT SIDE: DATA PROPAGATION ANIMATION =====

      // Draw the consensus stages as concentric rings
      const stages = [
        { radius: ringRadius * 0.3, label: "TX", color: "rgba(0, 217, 165, 0.1)" },
        { radius: ringRadius * 0.55, label: "PROPOSE", color: "rgba(0, 217, 165, 0.08)" },
        { radius: ringRadius * 0.75, label: "VOTE", color: "rgba(0, 217, 165, 0.05)" },
        { radius: ringRadius * 1.0, label: "COMMIT", color: "rgba(0, 217, 165, 0.03)" },
      ];

      stages.forEach((stage, i) => {
        ctx.beginPath();
        ctx.arc(ringCenterX, ringCenterY, stage.radius, 0, Math.PI * 2);
        ctx.fillStyle = stage.color;
        ctx.fill();
        ctx.strokeStyle = "rgba(0, 217, 165, 0.15)";
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Update validator node positions
      nodesRef.current.forEach((node, i) => {
        node.x = ringCenterX + Math.cos(node.angle) * ringRadius;
        node.y = ringCenterY + Math.sin(node.angle) * ringRadius;
      });

      // Draw connections between nodes (network topology)
      ctx.strokeStyle = "rgba(0, 217, 165, 0.08)";
      ctx.lineWidth = 1;
      nodesRef.current.forEach((node, i) => {
        // Connect to next 2 nodes (simplified mesh)
        for (let j = 1; j <= 2; j++) {
          const nextNode = nodesRef.current[(i + j) % nodesRef.current.length];
          ctx.beginPath();
          ctx.moveTo(node.x, node.y);
          ctx.lineTo(nextNode.x, nextNode.y);
          ctx.stroke();
        }
      });

      // Draw validator nodes
      nodesRef.current.forEach((node, i) => {
        const isProposer = i === currentProposerRef.current % nodesRef.current.length;
        const nodeSize = isProposer ? 10 : 6;

        // Node glow
        if (isProposer || node.hasVoted) {
          ctx.beginPath();
          const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, nodeSize * 2);
          gradient.addColorStop(0, isProposer ? "rgba(245, 158, 11, 0.4)" : "rgba(0, 217, 165, 0.3)");
          gradient.addColorStop(1, "transparent");
          ctx.fillStyle = gradient;
          ctx.arc(node.x, node.y, nodeSize * 2, 0, Math.PI * 2);
          ctx.fill();
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeSize, 0, Math.PI * 2);
        ctx.fillStyle = isProposer ? "#f59e0b" : node.hasVoted ? "#00D9A5" : "rgba(100, 100, 100, 0.6)";
        ctx.fill();

        // Reset vote status after 500ms
        if (node.hasVoted && now - node.voteTime > 500) {
          node.hasVoted = false;
        }
      });

      // Spawn new transaction particles
      if (now - lastSpawnRef.current > 300) {
        lastSpawnRef.current = now;
        txIdRef.current++;

        // Create particle at center (transaction submitted)
        particlesRef.current.push({
          id: txIdRef.current,
          x: ringCenterX,
          y: ringCenterY,
          targetX: ringCenterX,
          targetY: ringCenterY,
          stage: 0,
          chainIndex: 0, // Aptos
          startTime: now,
          color: "#00D9A5",
        });

        // Rotate proposer
        currentProposerRef.current++;
      }

      // Update and draw particles
      particlesRef.current = particlesRef.current.filter((p) => {
        const elapsed = now - p.startTime;
        const stageDuration = 150; // ms per stage

        // Determine current stage
        const newStage = Math.min(Math.floor(elapsed / stageDuration), 4);

        if (newStage !== p.stage) {
          p.stage = newStage;

          if (p.stage === 1) {
            // Move to proposer
            const proposer = nodesRef.current[currentProposerRef.current % nodesRef.current.length];
            p.targetX = proposer.x;
            p.targetY = proposer.y;
          } else if (p.stage === 2) {
            // Broadcast to validators - trigger votes
            nodesRef.current.forEach((node) => {
              node.hasVoted = true;
              node.voteTime = now;
            });
          } else if (p.stage === 3) {
            // Move to outer ring (committed)
            const angle = Math.random() * Math.PI * 2;
            p.targetX = ringCenterX + Math.cos(angle) * ringRadius * 1.2;
            p.targetY = ringCenterY + Math.sin(angle) * ringRadius * 1.2;
          }
        }

        // Interpolate position
        p.x += (p.targetX - p.x) * 0.15;
        p.y += (p.targetY - p.y) * 0.15;

        // Draw particle
        const size = 4 + (4 - p.stage);
        const alpha = p.stage < 4 ? 1 : Math.max(0, 1 - (elapsed - stageDuration * 4) / 200);

        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 217, 165, ${alpha})`;
        ctx.fill();

        // Glow
        if (p.stage < 3) {
          ctx.beginPath();
          const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 3);
          glow.addColorStop(0, `rgba(0, 217, 165, ${alpha * 0.4})`);
          glow.addColorStop(1, "transparent");
          ctx.fillStyle = glow;
          ctx.arc(p.x, p.y, size * 3, 0, Math.PI * 2);
          ctx.fill();
        }

        return elapsed < stageDuration * 5;
      });

      // Stage labels
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.font = "9px monospace";
      ctx.textAlign = "center";
      ctx.fillText("TX", ringCenterX, ringCenterY - ringRadius * 0.15);
      ctx.fillText("PROPOSE", ringCenterX, ringCenterY - ringRadius * 0.45);
      ctx.fillText("VOTE", ringCenterX, ringCenterY - ringRadius * 0.65);
      ctx.fillText("COMMIT", ringCenterX, ringCenterY - ringRadius * 0.9);

      // ===== RIGHT SIDE: CHAIN COMPARISON BARS =====

      const barStartX = width * 0.52;
      const barWidth = width * 0.42;
      const barHeight = 28;
      const barGap = 12;
      const barsStartY = height * 0.15;

      // Title
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "left";
      ctx.fillText("E2E LATENCY COMPARISON", barStartX, barsStartY - 15);

      // Find max finality for scaling
      const maxFinality = Math.max(...CHAINS.map((c) => c.finality));

      CHAINS.forEach((chain, i) => {
        const y = barsStartY + i * (barHeight + barGap);
        const barFillWidth = (chain.finality / maxFinality) * barWidth * 0.85;

        // Chain name
        ctx.fillStyle = chain.color;
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "right";
        ctx.fillText(chain.name, barStartX - 8, y + barHeight / 2 + 3);

        // Bar background
        ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
        ctx.fillRect(barStartX, y, barWidth, barHeight);

        // Bar fill with animation
        const animOffset = (now / 20) % barFillWidth;
        ctx.fillStyle = chain.color + "40";
        ctx.fillRect(barStartX, y, barFillWidth, barHeight);

        // Animated pulse
        ctx.fillStyle = chain.color + "60";
        ctx.fillRect(barStartX, y, barFillWidth * (0.8 + 0.2 * Math.sin(now / 200 + i)), barHeight);

        // Finality time label
        ctx.fillStyle = chain.color;
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "left";
        ctx.fillText(`${chain.finality}ms`, barStartX + barFillWidth + 8, y + barHeight / 2 + 4);

        // Consensus label
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.font = "9px monospace";
        ctx.fillText(chain.consensus, barStartX + 6, y + barHeight / 2 + 3);

        // Parallelism indicator
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        ctx.textAlign = "right";
        ctx.fillText(`${chain.parallelism}x parallel`, barStartX + barWidth - 4, y + barHeight / 2 + 3);
      });

      // Bottom stats
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.font = "9px monospace";
      ctx.textAlign = "center";
      ctx.fillText(
        `Aptos: ${avgBlockTime}ms blocks · ${realFinality}ms finality`,
        width / 2,
        height - 12
      );

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [avgBlockTime, realFinality]);

  return (
    <div className="chrome-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="section-title">Data Propagation & Latency</h3>
          <p className="text-xs" style={{ color: "var(--chrome-600)" }}>
            Raptr consensus: TX → Propose → Vote → Commit (~{realFinality}ms)
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono">
          <span style={{ color: "#00D9A5" }}>
            {tps > 0 ? `${tps} TPS` : `${avgBlockTime}ms blocks`}
          </span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full rounded"
        style={{ height: "260px" }}
      />

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-3 text-xs" style={{ color: "var(--chrome-500)" }}>
        {CHAINS.map((chain) => (
          <span key={chain.name} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: chain.color }} />
            {chain.name}
          </span>
        ))}
      </div>
    </div>
  );
}
