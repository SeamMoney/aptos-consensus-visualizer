"use client";

import { useRef, useEffect, useState } from "react";

interface QuorumStoreFlowProps {
  tps: number;
}

interface Batch {
  id: number;
  x: number;
  stage: number; // 0=mempool, 1=batching, 2=dissemination, 3=consensus
  quorumProgress: number; // 0 to 1 (for dissemination stage)
  txCount: number;
}

// For the educational animation
interface ValidatorNode {
  id: number;
  x: number;
  y: number;
  hasData: boolean;
  isSigning: boolean;
  signatureProgress: number;
}

interface StreamingBatch {
  id: number;
  fromValidator: number;
  toValidator: number;
  progress: number;
  color: string;
}

const STAGES = [
  { name: "MEMPOOL", color: "#6B7280", x: 0.1 },
  { name: "BATCH", color: "#3B82F6", x: 0.3 },
  { name: "DISSEMINATE", color: "#F59E0B", x: 0.55 },
  { name: "CONSENSUS", color: "#00D9A5", x: 0.85 },
];

export function QuorumStoreFlow({ tps }: QuorumStoreFlowProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const eduCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const eduAnimationRef = useRef<number>(0);
  const batchesRef = useRef<Batch[]>([]);
  const batchIdRef = useRef<number>(0);
  const [batchCount, setBatchCount] = useState(0);
  const [signatures, setSignatures] = useState(0);
  const [proofOfStore, setProofOfStore] = useState(false);

  // Educational animation state
  const validatorsRef = useRef<ValidatorNode[]>([]);
  const streamingBatchesRef = useRef<StreamingBatch[]>([]);
  const eduPhaseRef = useRef<number>(0); // 0=streaming, 1=signing, 2=proof formed
  const phaseTimerRef = useRef<number>(0);
  const streamBatchIdRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastTime = 0;
    let lastSpawnTime = 0;
    const targetFPS = 30;
    const frameInterval = 1000 / targetFPS;
    const spawnInterval = 800;

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

      const pipeY = height / 2;
      const pipeHeight = 50;

      // Spawn new batch
      if (timestamp - lastSpawnTime > spawnInterval) {
        lastSpawnTime = timestamp;
        batchesRef.current.push({
          id: batchIdRef.current++,
          x: 0,
          stage: 0,
          quorumProgress: 0,
          txCount: 50 + Math.floor(Math.random() * 100),
        });
        setBatchCount(batchIdRef.current);
      }

      // Draw pipeline stages
      STAGES.forEach((stage, idx) => {
        const stageX = stage.x * width;
        const stageWidth = idx < 3 ? (STAGES[idx + 1].x - stage.x) * width - 10 : width * 0.12;

        // Stage background
        ctx.fillStyle = stage.color + "20";
        ctx.beginPath();
        ctx.roundRect(stageX, pipeY - pipeHeight / 2, stageWidth, pipeHeight, 8);
        ctx.fill();

        // Stage border
        ctx.strokeStyle = stage.color + "40";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(stageX, pipeY - pipeHeight / 2, stageWidth, pipeHeight, 8);
        ctx.stroke();

        // Stage label
        ctx.fillStyle = stage.color;
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(stage.name, stageX + stageWidth / 2, pipeY - pipeHeight / 2 - 10);

        // Arrow between stages
        if (idx < 3) {
          const arrowX = stageX + stageWidth + 5;
          ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
          ctx.beginPath();
          ctx.moveTo(arrowX, pipeY - 5);
          ctx.lineTo(arrowX + 8, pipeY);
          ctx.lineTo(arrowX, pipeY + 5);
          ctx.fill();
        }
      });

      // Limit max batches to prevent clutter
      if (batchesRef.current.length > 8) {
        batchesRef.current = batchesRef.current.slice(-8);
      }

      // Update and draw batches
      for (let i = batchesRef.current.length - 1; i >= 0; i--) {
        const batch = batchesRef.current[i];

        // Move batch through stages
        const targetX = STAGES[Math.min(batch.stage, 3)].x * width + 20;

        if (batch.x < targetX) {
          batch.x += 3; // Faster movement
        } else {
          if (batch.stage === 2) {
            batch.quorumProgress += 0.03;
            if (batch.quorumProgress >= 1) {
              batch.stage++;
            }
          } else if (batch.stage < 3) {
            batch.stage++;
          } else {
            if (batch.x > width * 0.92) {
              batchesRef.current.splice(i, 1);
              continue;
            }
            batch.x += 3;
          }
        }

        // Draw batch - smaller, cleaner
        const batchSize = 12 + batch.txCount / 20;
        const batchY = pipeY;

        // Glow
        ctx.beginPath();
        const gradient = ctx.createRadialGradient(batch.x, batchY, 0, batch.x, batchY, batchSize);
        const stageColor = STAGES[Math.min(batch.stage, 3)].color;
        gradient.addColorStop(0, stageColor);
        gradient.addColorStop(0.5, stageColor + "60");
        gradient.addColorStop(1, "transparent");
        ctx.fillStyle = gradient;
        ctx.arc(batch.x, batchY, batchSize, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.fillStyle = "#fff";
        ctx.arc(batch.x, batchY, 4, 0, Math.PI * 2);
        ctx.fill();

        // Only show quorum progress for dissemination stage (no TX labels to avoid clutter)
        if (batch.stage === 2 && batch.quorumProgress < 1) {
          const barWidth = 30;
          const barHeight = 4;
          const barX = batch.x - barWidth / 2;
          const barY = batchY - batchSize - 8;

          ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
          ctx.beginPath();
          ctx.roundRect(barX, barY, barWidth, barHeight, 2);
          ctx.fill();

          ctx.fillStyle = batch.quorumProgress >= 0.67 ? "#10B981" : "#F59E0B";
          ctx.beginPath();
          ctx.roundRect(barX, barY, barWidth * batch.quorumProgress, barHeight, 2);
          ctx.fill();
        }
      }

      // Title
      ctx.fillStyle = "#F59E0B";
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("Quorum Store - Data Availability", 20, 25);

      // Stats
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.font = "10px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`Batches: ${batchCount}`, width - 20, 25);

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);

    return () => cancelAnimationFrame(animationRef.current);
  }, [tps]);

  // Educational animation - validator network with parallel batch streaming
  useEffect(() => {
    const canvas = eduCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Initialize validators in a network layout
    const initValidators = (width: number, height: number) => {
      const numValidators = 7;
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) * 0.35;

      validatorsRef.current = Array.from({ length: numValidators }, (_, i) => {
        const angle = (i / numValidators) * Math.PI * 2 - Math.PI / 2;
        return {
          id: i,
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius,
          hasData: i === 0, // First validator (leader) has data initially
          isSigning: false,
          signatureProgress: 0,
        };
      });
    };

    let lastTime = 0;
    const targetFPS = 30;
    const frameInterval = 1000 / targetFPS;

    const render = (timestamp: number) => {
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
      const now = Date.now();

      // Clear
      ctx.fillStyle = "#0a0a0b";
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;

      // Phase management
      phaseTimerRef.current++;

      // Phase 0: Streaming batches between validators
      if (eduPhaseRef.current === 0) {
        // Spawn new streaming batches periodically
        if (phaseTimerRef.current % 15 === 0 && streamingBatchesRef.current.length < 10) {
          const fromV = Math.floor(Math.random() * validatorsRef.current.length);
          let toV = Math.floor(Math.random() * validatorsRef.current.length);
          while (toV === fromV) toV = Math.floor(Math.random() * validatorsRef.current.length);

          streamingBatchesRef.current.push({
            id: streamBatchIdRef.current++,
            fromValidator: fromV,
            toValidator: toV,
            progress: 0,
            color: ["#3B82F6", "#F59E0B", "#00D9A5", "#EC4899"][Math.floor(Math.random() * 4)],
          });
        }

        // After enough streaming, move to signing phase
        if (phaseTimerRef.current > 120) {
          eduPhaseRef.current = 1;
          phaseTimerRef.current = 0;
          // Mark all validators as having data
          validatorsRef.current.forEach(v => {
            v.hasData = true;
            v.isSigning = true;
          });
        }
      }

      // Phase 1: Validators signing
      if (eduPhaseRef.current === 1) {
        let signedCount = 0;
        validatorsRef.current.forEach(v => {
          if (v.isSigning) {
            v.signatureProgress += 0.02 + Math.random() * 0.02;
            if (v.signatureProgress >= 1) {
              signedCount++;
            }
          }
        });
        setSignatures(signedCount);

        // 2f+1 = 5 out of 7 validators
        if (signedCount >= 5) {
          eduPhaseRef.current = 2;
          phaseTimerRef.current = 0;
          setProofOfStore(true);
        }
      }

      // Phase 2: Proof of Store formed - show success then reset
      if (eduPhaseRef.current === 2) {
        if (phaseTimerRef.current > 90) {
          // Reset for next cycle
          eduPhaseRef.current = 0;
          phaseTimerRef.current = 0;
          streamingBatchesRef.current = [];
          setSignatures(0);
          setProofOfStore(false);
          validatorsRef.current.forEach(v => {
            v.hasData = v.id === 0;
            v.isSigning = false;
            v.signatureProgress = 0;
          });
        }
      }

      // Draw connection lines (faded)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1;
      validatorsRef.current.forEach((v1, i) => {
        validatorsRef.current.forEach((v2, j) => {
          if (i < j) {
            ctx.beginPath();
            ctx.moveTo(v1.x, v1.y);
            ctx.lineTo(v2.x, v2.y);
            ctx.stroke();
          }
        });
      });

      // Draw streaming batches
      streamingBatchesRef.current = streamingBatchesRef.current.filter(batch => {
        batch.progress += 0.03;
        if (batch.progress >= 1) {
          // Mark destination validator as having data
          const destV = validatorsRef.current[batch.toValidator];
          if (destV) destV.hasData = true;
          return false;
        }

        const fromV = validatorsRef.current[batch.fromValidator];
        const toV = validatorsRef.current[batch.toValidator];
        if (!fromV || !toV) return false;

        const x = fromV.x + (toV.x - fromV.x) * batch.progress;
        const y = fromV.y + (toV.y - fromV.y) * batch.progress;

        // Connection line
        ctx.strokeStyle = batch.color + "40";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(fromV.x, fromV.y);
        ctx.lineTo(toV.x, toV.y);
        ctx.stroke();

        // Batch particle
        ctx.beginPath();
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, 8);
        gradient.addColorStop(0, batch.color);
        gradient.addColorStop(0.5, batch.color + "80");
        gradient.addColorStop(1, "transparent");
        ctx.fillStyle = gradient;
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = "#fff";
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();

        return true;
      });

      // Draw validators
      validatorsRef.current.forEach((v, i) => {
        const isLeader = i === 0;
        const nodeSize = isLeader ? 18 : 14;

        // Glow based on state
        if (v.hasData || isLeader) {
          ctx.beginPath();
          ctx.fillStyle = proofOfStore
            ? "rgba(0, 217, 165, 0.3)"
            : v.signatureProgress >= 1
              ? "rgba(16, 185, 129, 0.3)"
              : "rgba(59, 130, 246, 0.2)";
          ctx.arc(v.x, v.y, nodeSize + 8, 0, Math.PI * 2);
          ctx.fill();
        }

        // Signature progress ring
        if (v.isSigning && v.signatureProgress < 1) {
          ctx.beginPath();
          ctx.strokeStyle = "#F59E0B";
          ctx.lineWidth = 3;
          ctx.arc(v.x, v.y, nodeSize + 4, -Math.PI / 2, -Math.PI / 2 + v.signatureProgress * Math.PI * 2);
          ctx.stroke();
        }

        // Completed signature checkmark ring
        if (v.signatureProgress >= 1) {
          ctx.beginPath();
          ctx.strokeStyle = "#10B981";
          ctx.lineWidth = 3;
          ctx.arc(v.x, v.y, nodeSize + 4, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Node
        ctx.beginPath();
        ctx.fillStyle = proofOfStore
          ? "#00D9A5"
          : v.signatureProgress >= 1
            ? "#10B981"
            : v.hasData
              ? "#3B82F6"
              : "rgba(255, 255, 255, 0.3)";
        ctx.arc(v.x, v.y, nodeSize, 0, Math.PI * 2);
        ctx.fill();

        // Label
        ctx.fillStyle = proofOfStore || v.signatureProgress >= 1 ? "#000" : "#fff";
        ctx.font = `bold ${isLeader ? 10 : 9}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(isLeader ? "L" : `V${i}`, v.x, v.y);
      });

      // Center status
      ctx.textAlign = "center";
      if (eduPhaseRef.current === 0) {
        ctx.fillStyle = "#3B82F6";
        ctx.font = "bold 11px system-ui";
        ctx.fillText("Parallel Streaming", centerX, centerY - 8);
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.font = "9px monospace";
        ctx.fillText("Validators share batches", centerX, centerY + 8);
      } else if (eduPhaseRef.current === 1) {
        ctx.fillStyle = "#F59E0B";
        ctx.font = "bold 11px system-ui";
        ctx.fillText("Collecting Signatures", centerX, centerY - 8);
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.font = "9px monospace";
        ctx.fillText(`${signatures}/5 (2f+1) signatures`, centerX, centerY + 8);
      } else {
        ctx.fillStyle = "#00D9A5";
        ctx.font = "bold 11px system-ui";
        ctx.fillText("Proof of Store!", centerX, centerY - 8);
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.font = "9px monospace";
        ctx.fillText("Batch availability guaranteed", centerX, centerY + 8);
      }

      eduAnimationRef.current = requestAnimationFrame(render);
    };

    eduAnimationRef.current = requestAnimationFrame(render);

    return () => cancelAnimationFrame(eduAnimationRef.current);
  }, [signatures, proofOfStore]);

  return (
    <div className="chrome-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="section-title">Quorum Store</h3>
          <p className="text-xs" style={{ color: "var(--chrome-600)" }}>
            Batch dissemination for data availability (2/3 quorum)
          </p>
        </div>
        <div className="text-xs font-mono" style={{ color: "var(--chrome-500)" }}>
          Narwhal-based batching
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full rounded"
        style={{ height: "160px" }}
      />

      {/* Educational Panel */}
      <div className="mt-4 p-4 rounded-lg bg-white/5 border border-white/10">
        <div className="flex items-start gap-4">
          {/* Animated Diagram */}
          <div className="flex-shrink-0">
            <canvas
              ref={eduCanvasRef}
              className="rounded"
              style={{ width: "200px", height: "180px" }}
            />
          </div>

          {/* Explanation */}
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold mb-2" style={{ color: "#F59E0B" }}>
              How Quorum Store Works
            </h4>

            <div className="space-y-2 text-xs" style={{ color: "var(--chrome-400)" }}>
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: "#3B82F6" }}>1</span>
                <div>
                  <span className="font-semibold" style={{ color: "#3B82F6" }}>Parallel Streaming:</span>
                  <span className="ml-1">Validators continuously stream transaction batches to each other in parallel</span>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: "#F59E0B" }}>2</span>
                <div>
                  <span className="font-semibold" style={{ color: "#F59E0B" }}>Signature Collection:</span>
                  <span className="ml-1">Batch gets 2f+1 signatures from validators who received it</span>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: "#00D9A5" }}>3</span>
                <div>
                  <span className="font-semibold" style={{ color: "#00D9A5" }}>Proof of Store:</span>
                  <span className="ml-1">Leader references batch by hash - validators already have the data!</span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-white/10">
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: "var(--chrome-500)" }}>
                  <span className="font-semibold" style={{ color: "#00D9A5" }}>Result:</span> 12x consensus throughput improvement
                </span>
                <span className="font-mono" style={{ color: "var(--chrome-600)" }}>
                  vs. leader-bottleneck BFT
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
