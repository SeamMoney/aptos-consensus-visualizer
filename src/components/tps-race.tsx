"use client";

import { useRef, useEffect } from "react";

// All chains with theoretical max TPS for fair comparison
const CHAINS = [
  { name: "Aptos", color: "#00D9A5", theoreticalTps: 160000 }, // Block-STM parallel execution
  { name: "Sui", color: "#6FBCF0", theoreticalTps: 120000 },
  { name: "megaETH", color: "#FF6B6B", theoreticalTps: 100000 },
  { name: "Solana", color: "#14F195", theoreticalTps: 65000 },
];

interface Particle {
  x: number;
  y: number;
  speed: number;
  size: number;
}

export function TpsRace() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const particlesRef = useRef<Map<string, Particle[]>>(new Map());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Initialize particle arrays
    CHAINS.forEach((chain) => {
      if (!particlesRef.current.has(chain.name)) {
        particlesRef.current.set(chain.name, []);
      }
    });

    let lastTime = 0;
    const targetFPS = 60;
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

      // Clear
      ctx.fillStyle = "#0a0a0b";
      ctx.fillRect(0, 0, width, height);

      const pipeHeight = 24;
      const pipeGap = 16;
      const startY = 30;
      const pipeStartX = 80;
      const pipeEndX = width - 100;
      const pipeLength = pipeEndX - pipeStartX;

      // Find max for scaling
      const maxTps = Math.max(...CHAINS.map(c => c.theoreticalTps));

      CHAINS.forEach((chain, i) => {
        const y = startY + i * (pipeHeight + pipeGap);
        const particles = particlesRef.current.get(chain.name) || [];
        particlesRef.current.set(chain.name, particles);

        const tpsScaled = chain.theoreticalTps / 1000; // Show as "k"

        // Chain label
        ctx.fillStyle = chain.color;
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(chain.name, pipeStartX - 10, y + pipeHeight / 2);

        // Pipe background
        ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
        ctx.beginPath();
        ctx.roundRect(pipeStartX, y, pipeLength, pipeHeight, 4);
        ctx.fill();

        // Pipe border
        ctx.strokeStyle = chain.color + "40";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(pipeStartX, y, pipeLength, pipeHeight, 4);
        ctx.stroke();

        // Spawn particles based on TPS (more TPS = more particles)
        const spawnRate = (chain.theoreticalTps / maxTps) * 0.5;

        if (Math.random() < spawnRate) {
          particles.push({
            x: pipeStartX + 5,
            y: y + pipeHeight / 2 + (Math.random() - 0.5) * (pipeHeight - 8),
            speed: 2 + (chain.theoreticalTps / maxTps) * 4,
            size: 3 + Math.random() * 2,
          });
        }

        // Update and draw particles
        for (let j = particles.length - 1; j >= 0; j--) {
          const p = particles[j];
          p.x += p.speed;

          if (p.x > pipeEndX) {
            particles.splice(j, 1);
            continue;
          }

          // Draw particle with glow
          ctx.beginPath();
          const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
          gradient.addColorStop(0, chain.color);
          gradient.addColorStop(0.5, chain.color + "80");
          gradient.addColorStop(1, "transparent");
          ctx.fillStyle = gradient;
          ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
          ctx.fill();

          // Bright core
          ctx.beginPath();
          ctx.fillStyle = "#fff";
          ctx.arc(p.x, p.y, p.size * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }

        // TPS label at end
        ctx.fillStyle = chain.color;
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "left";
        ctx.fillText(`${tpsScaled}k TPS`, pipeEndX + 8, y + pipeHeight / 2 + 1);
      });

      // Title
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "left";
      ctx.fillText("THEORETICAL THROUGHPUT", pipeStartX, 15);

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <div className="chrome-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="section-title">Throughput Comparison</h3>
          <p className="text-xs" style={{ color: "var(--chrome-600)" }}>
            Theoretical max TPS (all chains)
          </p>
        </div>
        <div className="text-xs font-mono" style={{ color: "var(--chrome-500)" }}>
          Block-STM parallel execution
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full rounded"
        style={{ height: "180px" }}
      />
    </div>
  );
}
