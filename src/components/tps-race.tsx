"use client";

import { useRef, useEffect, useState } from "react";

// All chains with theoretical max TPS and technical explanation
const CHAINS = [
  {
    name: "Aptos",
    color: "#00D9A5",
    theoreticalTps: 160000,
    tech: "Block-STM",
    description: "Optimistic parallel execution without pre-declared dependencies",
    advantage: "8-16x speedup over sequential",
  },
  {
    name: "Sui",
    color: "#6FBCF0",
    theoreticalTps: 120000,
    tech: "Object-centric",
    description: "Owned objects execute in parallel without consensus",
    advantage: "Simple transactions bypass BFT",
  },
  {
    name: "megaETH",
    color: "#FF6B6B",
    theoreticalTps: 100000,
    tech: "Real-time",
    description: "10ms block times with streaming proofs",
    advantage: "Optimized for latency over throughput",
  },
  {
    name: "Solana",
    color: "#14F195",
    theoreticalTps: 65000,
    tech: "Sealevel",
    description: "Transactions pre-declare account access lists",
    advantage: "Enables parallel scheduling",
  },
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
  const [selectedChain, setSelectedChain] = useState(0); // Default to Aptos

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

      {/* Educational Panel - Chain Comparison */}
      <div className="mt-4 p-4 rounded-lg bg-white/5 border border-white/10">
        <h4 className="text-sm font-bold mb-3" style={{ color: "var(--chrome-300)" }}>
          Why Each Chain Achieves Its Throughput
        </h4>

        {/* Chain Selector */}
        <div className="flex gap-2 mb-4">
          {CHAINS.map((chain, i) => (
            <button
              key={chain.name}
              onClick={() => setSelectedChain(i)}
              className="px-3 py-1.5 rounded-lg text-xs font-mono transition-all"
              style={{
                backgroundColor: selectedChain === i ? chain.color + "30" : "rgba(255, 255, 255, 0.05)",
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: selectedChain === i ? chain.color : "rgba(255, 255, 255, 0.1)",
                color: selectedChain === i ? chain.color : "var(--chrome-400)",
              }}
            >
              {chain.name}
            </button>
          ))}
        </div>

        {/* Selected Chain Details */}
        <div className="p-3 rounded-lg" style={{ backgroundColor: "rgba(255, 255, 255, 0.03)" }}>
          <div className="flex items-center gap-3 mb-2">
            <span
              className="px-2 py-0.5 rounded text-xs font-bold"
              style={{ backgroundColor: CHAINS[selectedChain].color, color: "#000" }}
            >
              {CHAINS[selectedChain].tech}
            </span>
            <span className="text-sm font-bold" style={{ color: CHAINS[selectedChain].color }}>
              {(CHAINS[selectedChain].theoreticalTps / 1000).toLocaleString()}k TPS
            </span>
          </div>

          <p className="text-xs mb-2" style={{ color: "var(--chrome-400)" }}>
            {CHAINS[selectedChain].description}
          </p>

          <div className="flex items-center gap-2 text-xs">
            <span style={{ color: "var(--chrome-600)" }}>Key advantage:</span>
            <span style={{ color: "var(--chrome-300)" }}>{CHAINS[selectedChain].advantage}</span>
          </div>
        </div>

        {/* Aptos Highlight */}
        {selectedChain === 0 && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <p className="text-xs" style={{ color: "var(--chrome-500)" }}>
              <span className="font-semibold" style={{ color: "#00D9A5" }}>Block-STM Innovation:</span>
              {" "}Unlike Solana&apos;s Sealevel which requires transactions to pre-declare dependencies,
              Block-STM speculatively executes all transactions in parallel and only re-executes on conflict.
              This eliminates upfront overhead while maintaining deterministic results.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
