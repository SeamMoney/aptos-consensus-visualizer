"use client";

import { useRef, useEffect, useState, memo } from "react";
import { useVisibility } from "@/hooks/useVisibility";

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
  { name: "MEMPOOL", color: "#6B7280", x: 0.05 },
  { name: "BATCH", color: "#3B82F6", x: 0.25 },
  { name: "DISSEMINATE", color: "#F59E0B", x: 0.50 },
  { name: "CONSENSUS", color: "#00D9A5", x: 0.78 },
];

export const QuorumStoreFlow = memo(function QuorumStoreFlow({ tps }: QuorumStoreFlowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const eduCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const eduAnimationRef = useRef<number>(0);
  const batchesRef = useRef<Batch[]>([]);
  const batchIdRef = useRef<number>(0);
  const [batchCount, setBatchCount] = useState(0);
  const [signatures, setSignatures] = useState(0);
  const [proofOfStore, setProofOfStore] = useState(false);
  const isVisible = useVisibility(containerRef);

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
      // Skip rendering when off-screen
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

      // Draw pipeline stages - responsive sizing
      const stageGap = Math.max(4, width * 0.01);
      STAGES.forEach((stage, idx) => {
        const stageX = stage.x * width;
        const nextX = idx < 3 ? STAGES[idx + 1].x * width : width * 0.95;
        const stageWidth = nextX - stageX - stageGap;

        // Stage background
        ctx.fillStyle = stage.color + "20";
        ctx.beginPath();
        ctx.roundRect(stageX, pipeY - pipeHeight / 2, stageWidth, pipeHeight, 6);
        ctx.fill();

        // Stage border
        ctx.strokeStyle = stage.color + "40";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(stageX, pipeY - pipeHeight / 2, stageWidth, pipeHeight, 6);
        ctx.stroke();

        // Stage label - smaller on mobile
        ctx.fillStyle = stage.color;
        const fontSize = width < 400 ? 8 : 10;
        ctx.font = `bold ${fontSize}px monospace`;
        ctx.textAlign = "center";
        ctx.fillText(stage.name, stageX + stageWidth / 2, pipeY - pipeHeight / 2 - 8);

        // Arrow between stages
        if (idx < 3) {
          const arrowX = stageX + stageWidth + 1;
          ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
          ctx.beginPath();
          ctx.moveTo(arrowX, pipeY - 4);
          ctx.lineTo(arrowX + stageGap - 2, pipeY);
          ctx.lineTo(arrowX, pipeY + 4);
          ctx.fill();
        }
      });

      // Limit max batches to prevent clutter
      if (batchesRef.current.length > 8) {
        batchesRef.current = batchesRef.current.slice(-8);
      }

      // Update and draw batches
      const moveSpeed = Math.max(2, width * 0.008); // Responsive speed
      for (let i = batchesRef.current.length - 1; i >= 0; i--) {
        const batch = batchesRef.current[i];

        // Calculate target position for current stage
        const stageX = STAGES[Math.min(batch.stage, 3)].x * width;
        const nextX = batch.stage < 3 ? STAGES[batch.stage + 1].x * width : width * 0.95;
        const stageMidX = stageX + (nextX - stageX) * 0.5;

        // Move batch towards stage center
        if (batch.x < stageMidX - moveSpeed) {
          batch.x += moveSpeed;
        } else {
          // At stage center - process stage logic
          if (batch.stage === 2) {
            // DISSEMINATE: wait for quorum
            batch.quorumProgress += 0.025;
            if (batch.quorumProgress >= 1) {
              batch.stage++;
            }
          } else if (batch.stage < 3) {
            // Progress to next stage
            batch.stage++;
          } else {
            // CONSENSUS stage - move to exit
            batch.x += moveSpeed;
            if (batch.x > width * 0.98) {
              batchesRef.current.splice(i, 1);
              continue;
            }
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
  }, [tps, isVisible]);

  // Educational animation - detailed Narwhal-based Quorum Store visualization
  useEffect(() => {
    const canvas = eduCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const NUM_VALIDATORS = 7;
    const QUORUM = 5; // 2f+1 where f=2

    // Initialize validators in a ring layout
    const initValidators = (width: number, height: number) => {
      const centerX = width / 2;
      const centerY = height / 2 + 10;
      const radius = Math.min(width, height) * 0.36;

      validatorsRef.current = Array.from({ length: NUM_VALIDATORS }, (_, i) => {
        const angle = (i / NUM_VALIDATORS) * Math.PI * 2 - Math.PI / 2;
        return {
          id: i,
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius,
          hasData: false,
          isSigning: false,
          signatureProgress: 0,
        };
      });
    };

    let lastTime = 0;
    const targetFPS = 24;
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

      // Clear
      ctx.fillStyle = "#0a0a0b";
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2 + 10;

      // Slower phase management for educational clarity
      phaseTimerRef.current++;

      // ========== PHASE 0: Batch Creation & Dissemination ==========
      if (eduPhaseRef.current === 0) {
        // Mark worker (V0) as having data
        if (validatorsRef.current[0]) validatorsRef.current[0].hasData = true;

        // Spawn dissemination packets from worker to all validators
        if (phaseTimerRef.current === 30) {
          for (let i = 1; i < NUM_VALIDATORS; i++) {
            streamingBatchesRef.current.push({
              id: streamBatchIdRef.current++,
              fromValidator: 0,
              toValidator: i,
              progress: 0,
              color: "#3B82F6",
            });
          }
        }

        // After dissemination completes, move to signing
        if (phaseTimerRef.current > 100) {
          eduPhaseRef.current = 1;
          phaseTimerRef.current = 0;
          validatorsRef.current.forEach(v => {
            v.isSigning = true;
          });
        }
      }

      // ========== PHASE 1: Signature Collection (STORE-VOTE) ==========
      if (eduPhaseRef.current === 1) {
        let signedCount = 0;
        validatorsRef.current.forEach((v, i) => {
          if (v.isSigning && v.hasData) {
            // Stagger signature completion for visual clarity
            const delay = i * 0.01;
            v.signatureProgress += 0.015 + delay;
            if (v.signatureProgress >= 1) {
              signedCount++;
            }
          }
        });
        setSignatures(signedCount);

        // Once we have 2f+1 signatures, form PoS
        if (signedCount >= QUORUM) {
          eduPhaseRef.current = 2;
          phaseTimerRef.current = 0;
          setProofOfStore(true);
        }
      }

      // ========== PHASE 2: Proof of Store Certificate Formed ==========
      if (eduPhaseRef.current === 2) {
        if (phaseTimerRef.current > 120) {
          // Reset for next cycle
          eduPhaseRef.current = 0;
          phaseTimerRef.current = 0;
          streamingBatchesRef.current = [];
          setSignatures(0);
          setProofOfStore(false);
          validatorsRef.current.forEach(v => {
            v.hasData = false;
            v.isSigning = false;
            v.signatureProgress = 0;
          });
        }
      }

      // ========== Draw Network Topology ==========
      // Connection lines (mesh network)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
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

      // ========== Draw Dissemination Packets ==========
      streamingBatchesRef.current = streamingBatchesRef.current.filter(packet => {
        packet.progress += 0.02; // Slower for educational clarity
        if (packet.progress >= 1) {
          const destV = validatorsRef.current[packet.toValidator];
          if (destV) destV.hasData = true;
          return false;
        }

        const fromV = validatorsRef.current[packet.fromValidator];
        const toV = validatorsRef.current[packet.toValidator];
        if (!fromV || !toV) return false;

        const x = fromV.x + (toV.x - fromV.x) * packet.progress;
        const y = fromV.y + (toV.y - fromV.y) * packet.progress;

        // Packet trail
        ctx.strokeStyle = packet.color + "60";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(fromV.x, fromV.y);
        ctx.lineTo(x, y);
        ctx.stroke();

        // Packet glow
        ctx.beginPath();
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, 10);
        gradient.addColorStop(0, packet.color);
        gradient.addColorStop(0.5, packet.color + "80");
        gradient.addColorStop(1, "transparent");
        ctx.fillStyle = gradient;
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fill();

        // Packet core
        ctx.beginPath();
        ctx.fillStyle = "#fff";
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();

        // Packet label (only show for first few)
        if (packet.id < 3 && width > 300) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
          ctx.font = "bold 7px monospace";
          ctx.textAlign = "center";
          ctx.fillText("BATCH", x, y - 14);
        }

        return true;
      });

      // ========== Draw Validators ==========
      validatorsRef.current.forEach((v, i) => {
        const isWorker = i === 0;
        const nodeSize = isWorker ? 16 : 12;

        // Outer glow based on state
        if (proofOfStore) {
          ctx.beginPath();
          ctx.fillStyle = "rgba(0, 217, 165, 0.25)";
          ctx.arc(v.x, v.y, nodeSize + 10, 0, Math.PI * 2);
          ctx.fill();
        } else if (v.signatureProgress >= 1) {
          ctx.beginPath();
          ctx.fillStyle = "rgba(16, 185, 129, 0.2)";
          ctx.arc(v.x, v.y, nodeSize + 8, 0, Math.PI * 2);
          ctx.fill();
        } else if (v.hasData) {
          ctx.beginPath();
          ctx.fillStyle = "rgba(59, 130, 246, 0.15)";
          ctx.arc(v.x, v.y, nodeSize + 6, 0, Math.PI * 2);
          ctx.fill();
        }

        // Signature progress ring
        if (v.isSigning && v.signatureProgress > 0 && v.signatureProgress < 1) {
          ctx.beginPath();
          ctx.strokeStyle = "#F59E0B";
          ctx.lineWidth = 2;
          ctx.arc(v.x, v.y, nodeSize + 3, -Math.PI / 2, -Math.PI / 2 + v.signatureProgress * Math.PI * 2);
          ctx.stroke();
        }

        // Completed signature ring
        if (v.signatureProgress >= 1) {
          ctx.beginPath();
          ctx.strokeStyle = "#10B981";
          ctx.lineWidth = 2;
          ctx.arc(v.x, v.y, nodeSize + 3, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Node body
        ctx.beginPath();
        ctx.fillStyle = proofOfStore
          ? "#00D9A5"
          : v.signatureProgress >= 1
            ? "#10B981"
            : v.hasData
              ? "#3B82F6"
              : "rgba(255, 255, 255, 0.25)";
        ctx.arc(v.x, v.y, nodeSize, 0, Math.PI * 2);
        ctx.fill();

        // Node label
        ctx.fillStyle = (proofOfStore || v.signatureProgress >= 1 || v.hasData) ? "#000" : "#fff";
        ctx.font = `bold ${isWorker ? 9 : 8}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(isWorker ? "W" : `V${i}`, v.x, v.y);

        // Signature indicator (σ_i)
        if (v.signatureProgress >= 1 && width > 280) {
          ctx.fillStyle = "#10B981";
          ctx.font = "bold 7px monospace";
          ctx.fillText("σ", v.x + nodeSize + 6, v.y - 4);
        }
      });

      // ========== Center Status Display ==========
      ctx.textAlign = "center";

      if (eduPhaseRef.current === 0) {
        // Phase 0: Batch Dissemination
        ctx.fillStyle = "#3B82F6";
        ctx.font = "bold 10px system-ui";
        ctx.fillText("1. DISSEMINATE", centerX, centerY - 12);
        ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
        ctx.font = "8px monospace";
        ctx.fillText("⟨BATCH, d, data⟩", centerX, centerY + 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.font = "7px monospace";
        ctx.fillText("Worker → All validators", centerX, centerY + 14);
      } else if (eduPhaseRef.current === 1) {
        // Phase 1: Signature Collection
        ctx.fillStyle = "#F59E0B";
        ctx.font = "bold 10px system-ui";
        ctx.fillText("2. STORE-VOTE", centerX, centerY - 12);
        ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
        ctx.font = "8px monospace";
        ctx.fillText(`⟨σ_i⟩ ${signatures}/${QUORUM}`, centerX, centerY + 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.font = "7px monospace";
        ctx.fillText("Collecting 2f+1 sigs", centerX, centerY + 14);
      } else {
        // Phase 2: Proof of Store
        ctx.fillStyle = "#00D9A5";
        ctx.font = "bold 10px system-ui";
        ctx.fillText("3. PoS FORMED", centerX, centerY - 12);
        ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
        ctx.font = "8px monospace";
        ctx.fillText("⟨d, σ_agg⟩", centerX, centerY + 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.font = "7px monospace";
        ctx.fillText("Data availability proven!", centerX, centerY + 14);
      }

      // ========== Title ==========
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      ctx.font = "bold 9px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("NARWHAL QUORUM STORE", centerX, 14);

      eduAnimationRef.current = requestAnimationFrame(render);
    };

    eduAnimationRef.current = requestAnimationFrame(render);

    return () => cancelAnimationFrame(eduAnimationRef.current);
  }, [signatures, proofOfStore, isVisible]);

  return (
    <div ref={containerRef} className="chrome-card p-4">
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
        style={{ height: "200px" }}
      />

      {/* Educational Panel - Narwhal Protocol Deep Dive */}
      <div className="mt-4 p-3 sm:p-4 rounded-lg bg-white/5 border border-white/10">
        <h4 className="text-sm font-bold mb-3" style={{ color: "#F59E0B" }}>
          Narwhal Protocol: Data Availability Layer
        </h4>

        <div className="flex flex-col lg:flex-row items-center lg:items-start gap-4">
          {/* Animated Diagram - BIGGER */}
          <div className="w-full lg:w-auto lg:flex-shrink-0">
            <canvas
              ref={eduCanvasRef}
              className="rounded w-full lg:w-[400px]"
              style={{ height: "300px" }}
            />
          </div>

          {/* Technical Explanation */}
          <div className="flex-1 min-w-0 w-full">
            <div className="space-y-3 text-xs" style={{ color: "var(--chrome-400)" }}>
              {/* Phase 1 */}
              <div className="p-2 rounded bg-white/5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: "#3B82F6", color: "#fff" }}>1</span>
                  <span className="font-bold" style={{ color: "#3B82F6" }}>DISSEMINATE</span>
                </div>
                <p className="ml-7" style={{ color: "var(--chrome-500)" }}>
                  Worker broadcasts <code className="bg-white/10 px-1 rounded text-[10px]">⟨BATCH, d, data⟩</code> where <code className="bg-white/10 px-1 rounded text-[10px]">d = H(batch)</code>
                </p>
              </div>

              {/* Phase 2 */}
              <div className="p-2 rounded bg-white/5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: "#F59E0B", color: "#000" }}>2</span>
                  <span className="font-bold" style={{ color: "#F59E0B" }}>STORE-VOTE</span>
                </div>
                <p className="ml-7" style={{ color: "var(--chrome-500)" }}>
                  Validators store batch, reply with <code className="bg-white/10 px-1 rounded text-[10px]">⟨STORE-VOTE, d, σ_i⟩</code> partial signature
                </p>
              </div>

              {/* Phase 3 */}
              <div className="p-2 rounded bg-white/5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: "#00D9A5", color: "#000" }}>3</span>
                  <span className="font-bold" style={{ color: "#00D9A5" }}>PROOF OF STORE</span>
                </div>
                <p className="ml-7" style={{ color: "var(--chrome-500)" }}>
                  With 2f+1 signatures: <code className="bg-white/10 px-1 rounded text-[10px]">PoS = ⟨d, σ_agg⟩</code> — aggregated threshold signature
                </p>
              </div>
            </div>

            {/* Key Innovation */}
            <div className="mt-3 pt-3 border-t border-white/10">
              <div className="text-xs" style={{ color: "var(--chrome-500)" }}>
                <span className="font-bold" style={{ color: "#00D9A5" }}>Key Innovation:</span> Decouples data dissemination from ordering. Leader only sends batch digest <code className="bg-white/10 px-1 rounded text-[10px]">d</code>, not full data — validators already have it.
              </div>
              <div className="flex items-center justify-between mt-2 text-xs">
                <span style={{ color: "var(--chrome-600)" }}>
                  O(n) message complexity · Horizontal scaling
                </span>
                <span className="font-mono font-bold" style={{ color: "#00D9A5" }}>
                  12x throughput
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
