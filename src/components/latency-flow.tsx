"use client";

import { useEffect, useRef, useState } from "react";

interface Particle {
  x: number;
  y: number;
  speed: number;
  stage: number;
  opacity: number;
  size: number;
  trail: { x: number; y: number; opacity: number }[];
}

interface LatencyFlowProps {
  className?: string;
}

const STAGES = [
  { name: "Network", color: "#06D6A0", width: 0.4 },
  { name: "Processing", color: "#f39c12", width: 0.2 },
  { name: "Client", color: "#ff428e", width: 0.4 },
];

export function LatencyFlow({ className = "" }: LatencyFlowProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>(0);
  const [stats, setStats] = useState({
    networkLatency: 94,
    processingTime: 2,
    clientLatency: 15,
    totalLatency: 111,
    blocksInTransit: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const spawnParticle = () => {
      const rect = canvas.getBoundingClientRect();
      particlesRef.current.push({
        x: 0,
        y: rect.height / 2 + (Math.random() - 0.5) * 20,
        speed: 2 + Math.random() * 1.5,
        stage: 0,
        opacity: 1,
        size: 4 + Math.random() * 3,
        trail: [],
      });
    };

    // Spawn particles periodically
    const spawnInterval = setInterval(spawnParticle, 100);

    const animate = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      // Draw stage backgrounds
      let xOffset = 0;
      STAGES.forEach((stage, i) => {
        const width = stage.width * rect.width;
        ctx.fillStyle = `${stage.color}10`;
        ctx.fillRect(xOffset, 0, width, rect.height);

        // Stage separator
        if (i > 0) {
          ctx.strokeStyle = `${stage.color}40`;
          ctx.lineWidth = 1;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(xOffset, 0);
          ctx.lineTo(xOffset, rect.height);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Stage label
        ctx.fillStyle = "#ffffff60";
        ctx.font = "11px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(stage.name, xOffset + width / 2, 20);

        xOffset += width;
      });

      // Draw center line
      ctx.strokeStyle = "#ffffff15";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, rect.height / 2);
      ctx.lineTo(rect.width, rect.height / 2);
      ctx.stroke();

      // Update and draw particles
      particlesRef.current = particlesRef.current.filter((p) => {
        // Update trail
        p.trail.unshift({ x: p.x, y: p.y, opacity: 1 });
        if (p.trail.length > 15) p.trail.pop();

        // Move particle
        p.x += p.speed;
        p.y += Math.sin(p.x * 0.02) * 0.5;

        // Determine stage
        const stageWidths = STAGES.map((s) => s.width * rect.width);
        let accumulated = 0;
        for (let i = 0; i < stageWidths.length; i++) {
          accumulated += stageWidths[i];
          if (p.x < accumulated) {
            p.stage = i;
            break;
          }
        }

        const color = STAGES[p.stage]?.color || STAGES[0].color;

        // Draw trail
        p.trail.forEach((t, i) => {
          const trailOpacity = (1 - i / p.trail.length) * 0.5;
          ctx.beginPath();
          ctx.arc(t.x, t.y, p.size * (1 - i / p.trail.length * 0.5), 0, Math.PI * 2);
          ctx.fillStyle = `${color}${Math.floor(trailOpacity * 255).toString(16).padStart(2, "0")}`;
          ctx.fill();
          t.opacity *= 0.95;
        });

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Glow effect
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
        gradient.addColorStop(0, `${color}60`);
        gradient.addColorStop(1, `${color}00`);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        return p.x < rect.width + 50;
      });

      // Update stats
      setStats((prev) => ({
        ...prev,
        blocksInTransit: particlesRef.current.length,
        networkLatency: 90 + Math.floor(Math.random() * 10),
        processingTime: 1 + Math.floor(Math.random() * 3),
        clientLatency: 12 + Math.floor(Math.random() * 8),
        totalLatency: 90 + 1 + 12 + Math.floor(Math.random() * 15),
      }));

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      clearInterval(spawnInterval);
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <div className={`glass-card p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-white">Latency Monitor</h3>
          <div className="live-indicator">
            <div className="live-dot" />
            <span className="text-xs text-gray-400 uppercase tracking-wider">Live</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="stat-card">
          <div className="stat-value" style={{ color: "#06D6A0" }}>{stats.networkLatency}ms</div>
          <div className="stat-label">Network Latency</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "#f39c12" }}>{stats.processingTime}ms</div>
          <div className="stat-label">Processing</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "#ff428e" }}>{stats.clientLatency}ms</div>
          <div className="stat-label">Client Latency</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.totalLatency}ms</div>
          <div className="stat-label">Total End-to-End</div>
        </div>
      </div>

      {/* Canvas Visualization */}
      <div className="canvas-container" style={{ height: "120px" }}>
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "100%" }}
        />
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-6 mt-4">
        {STAGES.map((stage) => (
          <div key={stage.name} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: stage.color }}
            />
            <span className="text-xs text-gray-400">{stage.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
