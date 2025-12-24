"use client";

import { useRef, useEffect, useState, useMemo, memo } from "react";
import { ConsensusStats } from "@/hooks/useAptosStream";
import { useVisibility } from "@/hooks/useVisibility";

interface ValidatorRingProps {
  consensus: ConsensusStats | null;
}

interface TopValidator {
  originalIndex: number;
  address: string;
  votingPower: number;
  voted: boolean;
  isProposer: boolean;
  normalizedPower: number;
}

export const ValidatorRing = memo(function ValidatorRing({ consensus }: ValidatorRingProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const [hoveredValidator, setHoveredValidator] = useState<TopValidator | null>(null);
  const mousePos = useRef({ x: 0, y: 0 });
  const isVisible = useVisibility(containerRef);

  // Process validators - get top 20 by voting power
  const { topValidators, otherStats } = useMemo(() => {
    const validators = consensus?.validators || [];
    const votes = consensus?.validatorVotes || [];

    if (validators.length === 0) {
      return { topValidators: [], otherStats: { count: 118, votedCount: 118 } };
    }

    // Create combined array with original indices
    const combined = validators.map((v, i) => ({
      originalIndex: i,
      address: v.address,
      votingPower: v.votingPower,
      voted: votes[i]?.voted ?? true, // Default to true if no vote data
      isProposer: v.address === consensus?.currentProposer,
    }));

    // Sort by voting power
    combined.sort((a, b) => b.votingPower - a.votingPower);

    const top20 = combined.slice(0, 20);
    const others = combined.slice(20);

    // Normalize voting power for sizing
    const maxPower = top20[0]?.votingPower || 1;
    const minPower = top20[top20.length - 1]?.votingPower || 0;
    const range = maxPower - minPower || 1;

    const topValidators: TopValidator[] = top20.map((v) => ({
      ...v,
      normalizedPower: (v.votingPower - minPower) / range,
    }));

    const otherStats = {
      count: others.length,
      votedCount: others.filter((v) => v.voted).length,
    };

    return { topValidators, otherStats };
  }, [consensus]);

  // Canvas rendering with lower frame rate
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let pulsePhase = 0;
    let lastTime = 0;
    const targetFPS = 20; // Lower FPS for performance
    const frameInterval = 1000 / targetFPS;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mousePos.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    canvas.addEventListener("mousemove", handleMouseMove);

    const render = (timestamp: number) => {
      // Skip rendering when off-screen
      if (!isVisible) {
        animationRef.current = requestAnimationFrame(render);
        return;
      }

      // Throttle to target FPS
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

      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2 - 10;
      const ringRadius = Math.min(centerX, centerY) - 35;

      pulsePhase += 0.1;

      // Draw top 20 validators as dots in a ring
      let hoveredVal: TopValidator | null = null;

      for (let i = 0; i < topValidators.length; i++) {
        const validator = topValidators[i];
        const angle = (i / 20) * Math.PI * 2 - Math.PI / 2;
        const x = centerX + Math.cos(angle) * ringRadius;
        const y = centerY + Math.sin(angle) * ringRadius;

        // Size based on voting power (min 5, max 12)
        const baseSize = 5 + validator.normalizedPower * 7;
        let dotSize = baseSize;

        // Check hover
        const dx = mousePos.current.x - x;
        const dy = mousePos.current.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < dotSize + 8) {
          hoveredVal = validator;
          dotSize = baseSize + 3;
        }

        // Color based on status
        if (validator.isProposer) {
          // Current proposer - amber with pulse
          const pulse = Math.sin(pulsePhase) * 0.3 + 0.7;
          ctx.fillStyle = `rgba(245, 158, 11, ${pulse})`;
          dotSize = baseSize + 2 + Math.sin(pulsePhase) * 2;

          // Glow
          ctx.beginPath();
          ctx.fillStyle = "rgba(245, 158, 11, 0.2)";
          ctx.arc(x, y, dotSize + 8, 0, Math.PI * 2);
          ctx.fill();
        } else if (validator.voted) {
          ctx.fillStyle = "rgba(16, 185, 129, 0.9)";
        } else {
          ctx.fillStyle = "rgba(239, 68, 68, 0.8)";
        }

        // Draw dot
        ctx.beginPath();
        ctx.arc(x, y, dotSize, 0, Math.PI * 2);
        ctx.fill();

        // Rank label for top 5
        if (i < 5) {
          ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
          ctx.font = "bold 8px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(i + 1), x, y);
        }
      }

      setHoveredValidator(hoveredVal);

      // Center text
      ctx.fillStyle = "#10b981";
      ctx.font = "bold 28px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(consensus?.totalValidators || 138), centerX, centerY - 12);

      ctx.fillStyle = "rgba(150, 150, 150, 0.8)";
      ctx.font = "10px monospace";
      ctx.fillText("VALIDATORS", centerX, centerY + 10);

      // Vote percentage
      const participation = consensus?.voteParticipation ?? 100;
      ctx.fillStyle = participation > 90 ? "#10b981" : participation > 66 ? "#f59e0b" : "#ef4444";
      ctx.font = "bold 16px monospace";
      ctx.fillText(`${participation}%`, centerX, centerY + 32);

      ctx.fillStyle = "rgba(100, 100, 100, 0.8)";
      ctx.font = "8px monospace";
      ctx.fillText("VOTED", centerX, centerY + 46);

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationRef.current);
      canvas.removeEventListener("mousemove", handleMouseMove);
    };
  }, [topValidators, otherStats, consensus, isVisible]);

  return (
    <div ref={containerRef} className="bg-black/30 rounded-xl p-4 border border-white/10 relative">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-white/80">Validator Ring</h3>
        <span className="text-xs text-emerald-400/60">Top 20 by Stake</span>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ height: "260px" }}
      />

      {/* Tooltip */}
      {hoveredValidator && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-black/95 border border-white/20 rounded-lg px-3 py-2 text-xs z-10 whitespace-nowrap">
          <div className="text-emerald-400 font-mono">
            {hoveredValidator.address.slice(0, 10)}...{hoveredValidator.address.slice(-6)}
          </div>
          <div className="text-white/60 mt-1">
            Stake: {(hoveredValidator.votingPower / 1e8).toFixed(0)}M APT
          </div>
          <div className={hoveredValidator.voted ? "text-emerald-400" : "text-red-400"}>
            {hoveredValidator.voted ? "Voted" : "Did not vote"}
          </div>
          {hoveredValidator.isProposer && (
            <div className="text-amber-400">Current Proposer</div>
          )}
        </div>
      )}

    </div>
  );
});
