"use client";

import { useMemo, useRef, useEffect, useState, memo } from "react";
import { ConsensusStats } from "@/hooks/useAptosStream";
import { useVisibility } from "@/hooks/useVisibility";
import { Tooltip, LearnMoreLink } from "@/components/ui/tooltip";
import { glossary } from "@/data/glossary";

interface LeaderReputationProps {
  consensus: ConsensusStats | null;
}

// For the educational animation
interface AnimatedValidator {
  id: number;
  angle: number;
  reputation: number;
  isLeader: boolean;
  glowIntensity: number;
}

export const LeaderReputation = memo(function LeaderReputation({ consensus }: LeaderReputationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const validators = consensus?.validators || [];
  const currentProposer = consensus?.currentProposer || "";
  const eduCanvasRef = useRef<HTMLCanvasElement>(null);
  const eduAnimationRef = useRef<number>(0);
  const animValidatorsRef = useRef<AnimatedValidator[]>([]);
  const currentLeaderRef = useRef(0);
  const rotationTimerRef = useRef(0);
  const [leaderIndex, setLeaderIndex] = useState(0);
  const isVisible = useVisibility(containerRef);

  // Calculate reputation scores based on voting power (proxy for actual reputation)
  const rankedValidators = useMemo(() => {
    if (validators.length === 0) return [];

    // Sort by voting power (higher = better reputation proxy)
    const sorted = [...validators]
      .sort((a, b) => b.votingPower - a.votingPower)
      .slice(0, 10); // Top 10

    const maxPower = sorted[0]?.votingPower || 1;

    return sorted.map((v, idx) => ({
      ...v,
      rank: idx + 1,
      reputationScore: Math.round((v.votingPower / maxPower) * 100),
      isCurrentProposer: v.address === currentProposer,
    }));
  }, [validators, currentProposer]);

  const formatAddress = (addr: string) => {
    if (!addr) return "...";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Educational animation - leader rotation visualization
  useEffect(() => {
    const canvas = eduCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Initialize validators in a ring
    const initValidators = (width: number, height: number) => {
      const numValidators = 8;
      const centerX = width / 2;
      const centerY = height / 2;

      animValidatorsRef.current = Array.from({ length: numValidators }, (_, i) => ({
        id: i,
        angle: (i / numValidators) * Math.PI * 2 - Math.PI / 2,
        reputation: 0.5 + Math.random() * 0.5, // Random reputation 50-100%
        isLeader: i === 0,
        glowIntensity: i === 0 ? 1 : 0,
      }));
    };

    let lastTime = 0;
    const targetFPS = 30;
    const frameInterval = 1000 / targetFPS;

    const render = (timestamp: number) => {
      // Skip rendering when off-screen
      if (!isVisible) {
        eduAnimationRef.current = requestAnimationFrame(render);
        return;
      }

      if (timestamp - lastTime < frameInterval) {
        eduAnimationRef.current = requestAnimationFrame(render);
        return;
      }
      lastTime = timestamp;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();

      if (canvas.width !== Math.floor(rect.width * dpr)) {
        canvas.width = Math.floor(rect.width * dpr);
        canvas.height = Math.floor(rect.height * dpr);
        ctx.scale(dpr, dpr);
        initValidators(rect.width, rect.height);
      }

      const width = rect.width;
      const height = rect.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) * 0.38;

      // Clear
      ctx.fillStyle = "#0a0a0b";
      ctx.fillRect(0, 0, width, height);

      // Leader rotation timer
      rotationTimerRef.current++;
      if (rotationTimerRef.current > 90) {
        rotationTimerRef.current = 0;

        // Select next leader based on weighted probability (higher reputation = higher chance)
        const totalRep = animValidatorsRef.current.reduce((sum, v) => sum + v.reputation, 0);
        let rand = Math.random() * totalRep;
        let newLeader = 0;

        for (let i = 0; i < animValidatorsRef.current.length; i++) {
          rand -= animValidatorsRef.current[i].reputation;
          if (rand <= 0) {
            newLeader = i;
            break;
          }
        }

        currentLeaderRef.current = newLeader;
        setLeaderIndex(newLeader);

        // Update leader states
        animValidatorsRef.current.forEach((v, i) => {
          v.isLeader = i === newLeader;
          // Increase reputation for successful leader, slight decay for others
          if (v.isLeader) {
            v.reputation = Math.min(1, v.reputation + 0.05);
          }
        });
      }

      // Draw connection lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1;
      animValidatorsRef.current.forEach((v1, i) => {
        animValidatorsRef.current.forEach((v2, j) => {
          if (i < j) {
            const x1 = centerX + Math.cos(v1.angle) * radius;
            const y1 = centerY + Math.sin(v1.angle) * radius;
            const x2 = centerX + Math.cos(v2.angle) * radius;
            const y2 = centerY + Math.sin(v2.angle) * radius;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
          }
        });
      });

      // Draw validators
      animValidatorsRef.current.forEach((v, i) => {
        const x = centerX + Math.cos(v.angle) * radius;
        const y = centerY + Math.sin(v.angle) * radius;
        const baseSize = 10 + v.reputation * 8;

        // Animate glow for leader
        if (v.isLeader) {
          v.glowIntensity = Math.min(1, v.glowIntensity + 0.1);
        } else {
          v.glowIntensity = Math.max(0, v.glowIntensity - 0.05);
        }

        // Glow effect
        if (v.glowIntensity > 0) {
          ctx.beginPath();
          const gradient = ctx.createRadialGradient(x, y, 0, x, y, baseSize + 15);
          gradient.addColorStop(0, `rgba(0, 217, 165, ${v.glowIntensity * 0.5})`);
          gradient.addColorStop(1, "transparent");
          ctx.fillStyle = gradient;
          ctx.arc(x, y, baseSize + 15, 0, Math.PI * 2);
          ctx.fill();
        }

        // Reputation ring (proportional to score)
        ctx.beginPath();
        ctx.strokeStyle = v.isLeader ? "#00D9A5" : "#F59E0B";
        ctx.lineWidth = 3;
        ctx.arc(x, y, baseSize + 4, -Math.PI / 2, -Math.PI / 2 + v.reputation * Math.PI * 2);
        ctx.stroke();

        // Node
        ctx.beginPath();
        ctx.fillStyle = v.isLeader ? "#00D9A5" : v.reputation > 0.7 ? "#F59E0B" : "#3B82F6";
        ctx.arc(x, y, baseSize, 0, Math.PI * 2);
        ctx.fill();

        // Label
        ctx.fillStyle = v.isLeader ? "#000" : "#fff";
        ctx.font = `bold ${v.isLeader ? 10 : 9}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(v.isLeader ? "L" : `V${i}`, x, y);

        // Reputation percentage
        ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
        ctx.font = "8px monospace";
        ctx.fillText(`${Math.round(v.reputation * 100)}%`, x, y + baseSize + 12);
      });

      // Center info
      ctx.fillStyle = "#00D9A5";
      ctx.font = "bold 11px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("Leader Rotation", centerX, centerY - 8);
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.font = "9px monospace";
      ctx.fillText(`V${currentLeaderRef.current} selected`, centerX, centerY + 8);

      eduAnimationRef.current = requestAnimationFrame(render);
    };

    eduAnimationRef.current = requestAnimationFrame(render);

    return () => cancelAnimationFrame(eduAnimationRef.current);
  }, [isVisible]);

  return (
    <div ref={containerRef} className="chrome-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="section-title">
            <Tooltip content={glossary.shoal.definition} link={glossary.shoal.link}>Shoal++</Tooltip> Leader Reputation
            <LearnMoreLink href={glossary.shoal.link} label="Shoal++ Documentation" />
          </h3>
          <p className="text-xs" style={{ color: "var(--chrome-600)" }}>
            Dynamic leader selection by reputation score
          </p>
        </div>
        <div className="text-xs font-mono" style={{ color: "var(--chrome-500)" }}>
          Top 10 validators
        </div>
      </div>

      <div className="space-y-2">
        {rankedValidators.length === 0 ? (
          <div className="text-center py-8 text-xs" style={{ color: "var(--chrome-600)" }}>
            Loading validators...
          </div>
        ) : (
          rankedValidators.map((v) => (
            <div
              key={v.address}
              className="flex items-center gap-3 py-1.5 px-2 rounded"
              style={{
                backgroundColor: v.isCurrentProposer
                  ? "rgba(0, 217, 165, 0.1)"
                  : "transparent",
              }}
            >
              {/* Rank */}
              <span
                className="w-6 text-right font-mono text-xs"
                style={{
                  color: v.rank <= 3 ? "#F59E0B" : "var(--chrome-500)",
                  fontWeight: v.rank <= 3 ? "bold" : "normal",
                }}
              >
                #{v.rank}
              </span>

              {/* Address */}
              <span
                className="font-mono text-xs w-24"
                style={{
                  color: v.isCurrentProposer ? "#00D9A5" : "var(--chrome-400)",
                }}
              >
                {formatAddress(v.address)}
              </span>

              {/* Reputation bar */}
              <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255, 255, 255, 0.1)" }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${v.reputationScore}%`,
                    backgroundColor: v.isCurrentProposer
                      ? "#00D9A5"
                      : v.rank <= 3
                      ? "#F59E0B"
                      : "#3B82F6",
                  }}
                />
              </div>

              {/* Score */}
              <span
                className="w-10 text-right font-mono text-xs"
                style={{ color: "var(--chrome-500)" }}
              >
                {v.reputationScore}%
              </span>

              {/* Current proposer indicator */}
              {v.isCurrentProposer && (
                <span
                  className="text-xs font-bold"
                  style={{ color: "#00D9A5" }}
                >
                  ⭐
                </span>
              )}
            </div>
          ))
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-white/5">
        <span className="flex items-center gap-1 text-xs" style={{ color: "var(--chrome-500)" }}>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#F59E0B" }} />
          Top 3
        </span>
        <span className="flex items-center gap-1 text-xs" style={{ color: "var(--chrome-500)" }}>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#00D9A5" }} />
          Current Leader
        </span>
        <span className="flex items-center gap-1 text-xs" style={{ color: "var(--chrome-500)" }}>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#3B82F6" }} />
          Others
        </span>
      </div>

      {/* Educational Panel - BIGGER */}
      <div className="mt-4 p-4 rounded-lg bg-white/5 border border-white/10">
        <h4 className="text-sm font-bold mb-3" style={{ color: "#F59E0B" }}>
          Why Reputation-Based Leaders?
        </h4>

        {/* Animated Leader Rotation - BIGGER */}
        <div className="mb-4">
          <canvas
            ref={eduCanvasRef}
            className="rounded w-full"
            style={{ height: "280px" }}
          />
        </div>

        {/* Simple Explanation for Non-Technical Users */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div className="p-3 rounded bg-red-500/10 border border-red-500/20">
            <div className="text-xs font-bold mb-2" style={{ color: "#EF4444" }}>
              The Problem
            </div>
            <p className="text-xs" style={{ color: "var(--chrome-400)" }}>
              In traditional blockchains, leaders are chosen randomly. If a slow or offline validator is picked,
              <span className="font-semibold text-white"> everyone waits</span> — wasting precious time.
            </p>
          </div>

          <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/20">
            <div className="text-xs font-bold mb-2" style={{ color: "#00D9A5" }}>
              The Shoal++ Solution
            </div>
            <p className="text-xs" style={{ color: "var(--chrome-400)" }}>
              Track each validator's <span className="font-semibold text-white">performance history</span>.
              Reliable validators get picked more often. Bad actors get skipped automatically.
            </p>
          </div>
        </div>

        {/* How It Works - Step by Step */}
        <div className="space-y-2 text-xs">
          <div className="flex items-start gap-2 p-2 rounded bg-white/5">
            <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold bg-blue-500 text-white">1</span>
            <div>
              <span className="font-bold" style={{ color: "#3B82F6" }}>Track Performance:</span>
              <span className="ml-1" style={{ color: "var(--chrome-500)" }}>
                Each time a validator successfully proposes a block, their reputation score increases.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2 p-2 rounded bg-white/5">
            <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold bg-amber-500 text-black">2</span>
            <div>
              <span className="font-bold" style={{ color: "#F59E0B" }}>Weighted Selection:</span>
              <span className="ml-1" style={{ color: "var(--chrome-500)" }}>
                Higher reputation = higher probability of being selected as the next leader. It's like a "credit score" for validators.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2 p-2 rounded bg-white/5">
            <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold bg-emerald-500 text-black">3</span>
            <div>
              <span className="font-bold" style={{ color: "#00D9A5" }}>Fast Anchors:</span>
              <span className="ml-1" style={{ color: "var(--chrome-500)" }}>
                Commit blocks in just 4 message hops instead of 10.5 — that's up to <span className="font-bold text-white">60% faster</span>!
              </span>
            </div>
          </div>
        </div>

        {/* Result Banner */}
        <div className="mt-4 p-3 rounded bg-gradient-to-r from-emerald-500/20 to-emerald-500/5 border border-emerald-500/30">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold" style={{ color: "#00D9A5" }}>Result:</span>
              <span className="text-xs ml-2" style={{ color: "var(--chrome-400)" }}>
                Network rewards good validators, punishes bad ones — automatically
              </span>
            </div>
            <span className="text-lg font-bold font-mono" style={{ color: "#00D9A5" }}>
              60%↓
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});
