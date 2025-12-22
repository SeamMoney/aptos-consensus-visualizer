"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Play, Pause, RotateCcw } from "lucide-react";

interface ConsensusVisualizationProps {
  version: "quorumStore" | "velociraptr" | "raptr";
  isAnimating: boolean;
  onToggleAnimation: () => void;
}

const stageData = {
  quorumStore: {
    stages: [
      { name: "Tx Batching", duration: 100, description: "Transactions collected into batches" },
      { name: "Data Dissemination", duration: 500, description: "Broadcast to all validators" },
      { name: "PoA Certificate", duration: 300, description: "Proof of Availability (2 extra hops)" },
      { name: "Consensus", duration: 300, description: "Leader proposes with certificate" },
      { name: "Finalization", duration: 200, description: "Execute and commit" },
    ],
    totalTime: 1400,
    hops: 6,
  },
  velociraptr: {
    stages: [
      { name: "Tx Batching", duration: 80, description: "Transactions collected" },
      { name: "Optimistic Proposal", duration: 200, description: "Propose every network delay" },
      { name: "Parallel Verification", duration: 200, description: "Validators verify in parallel" },
      { name: "Finalization", duration: 170, description: "Execute and commit" },
    ],
    totalTime: 650,
    hops: 4,
  },
  raptr: {
    stages: [
      { name: "DAG Broadcast", duration: 30, description: "DAG-based dissemination" },
      { name: "Prefix Consensus", duration: 100, description: "Leader-based ordering" },
      { name: "Instant Commit", duration: 70, description: "Parallel finalization" },
    ],
    totalTime: 200,
    hops: 4,
  },
};

const colors = {
  quorumStore: "#f97316",
  velociraptr: "#06D6A0",
  raptr: "#4ECDC4",
};

export function ConsensusVisualization({
  version,
  isAnimating,
  onToggleAnimation,
}: ConsensusVisualizationProps) {
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState(0);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const data = stageData[version];
  const color = colors[version];

  useEffect(() => {
    setProgress(0);
    setCurrentStage(0);
    startTimeRef.current = null;
  }, [version]);

  useEffect(() => {
    if (!isAnimating) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const newProgress = Math.min((elapsed / data.totalTime) * 100, 100);
      setProgress(newProgress);

      // Calculate current stage
      let accumulated = 0;
      for (let i = 0; i < data.stages.length; i++) {
        accumulated += data.stages[i].duration;
        if (elapsed < accumulated) {
          setCurrentStage(i);
          break;
        }
        if (i === data.stages.length - 1) {
          setCurrentStage(i);
        }
      }

      if (newProgress < 100) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        onToggleAnimation();
        startTimeRef.current = null;
        setProgress(0);
        setCurrentStage(0);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isAnimating, data, onToggleAnimation]);

  const handleReset = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setProgress(0);
    setCurrentStage(0);
    startTimeRef.current = null;
    if (isAnimating) {
      onToggleAnimation();
    }
  };

  return (
    <div className="bg-white rounded-2xl p-8 shadow-lg">
      {/* Visualization Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Transaction Journey
          </h3>
          <p className="text-sm text-gray-500">
            Total time: <span style={{ color }} className="font-medium">{data.totalTime}ms</span> ({data.hops} network hops)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onToggleAnimation}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
            style={{ backgroundColor: `${color}20`, color }}
          >
            {isAnimating ? (
              <>
                <Pause className="w-4 h-4" />
                Pause
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Play
              </>
            )}
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Network Visualization */}
      <div className="relative h-48 mb-8 bg-gray-50 rounded-xl overflow-hidden">
        <svg className="w-full h-full" viewBox="0 0 800 200">
          {/* Nodes */}
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const x = 100 + i * 120;
            const y = 100;
            const isActive = isAnimating && progress > (i / 6) * 100;

            return (
              <g key={i}>
                {/* Connection line to next node */}
                {i < 5 && (
                  <line
                    x1={x + 20}
                    y1={y}
                    x2={x + 100}
                    y2={y}
                    stroke={isActive ? color : "#e5e7eb"}
                    strokeWidth="2"
                    strokeDasharray={isActive ? "0" : "5,5"}
                  />
                )}
                {/* Node */}
                <motion.circle
                  cx={x}
                  cy={y}
                  r="20"
                  fill={isActive ? color : "#f3f4f6"}
                  stroke={isActive ? color : "#d1d5db"}
                  strokeWidth="2"
                  animate={{
                    scale: isActive ? [1, 1.1, 1] : 1,
                  }}
                  transition={{ duration: 0.3 }}
                />
                {/* Node label */}
                <text
                  x={x}
                  y={y + 45}
                  textAnchor="middle"
                  className="text-xs fill-gray-500"
                >
                  {i === 0 ? "Client" : i === 5 ? "Commit" : `V${i}`}
                </text>
              </g>
            );
          })}

          {/* Animated packet */}
          {isAnimating && (
            <motion.circle
              cx={100}
              cy={100}
              r="8"
              fill={color}
              initial={{ cx: 100 }}
              animate={{ cx: 100 + progress * 6 }}
              transition={{ duration: 0.1 }}
            />
          )}
        </svg>
      </div>

      {/* Stages Timeline */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          {data.stages.map((stage, index) => {
            const width = (stage.duration / data.totalTime) * 100;
            const isActive = currentStage === index && isAnimating;
            const isComplete = currentStage > index || (progress === 100 && currentStage === index);

            return (
              <div
                key={index}
                className="relative"
                style={{ width: `${width}%` }}
              >
                <div
                  className={`h-10 rounded-lg flex items-center justify-center text-xs font-medium transition-all ${
                    isActive
                      ? "ring-2 ring-offset-2"
                      : ""
                  }`}
                  style={{
                    backgroundColor: isComplete || isActive ? color : "#f3f4f6",
                    color: isComplete || isActive ? "white" : "#6b7280",
                    ["--tw-ring-color" as string]: color,
                  }}
                >
                  <span className="truncate px-1">{stage.name}</span>
                </div>
                <div className="text-center mt-1">
                  <span className="text-xs text-gray-400">{stage.duration}ms</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Current stage description */}
        <motion.div
          key={currentStage}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-lg bg-gray-50"
        >
          <p className="text-sm font-medium text-gray-900">
            Stage {currentStage + 1}: {data.stages[currentStage]?.name}
          </p>
          <p className="text-sm text-gray-600">
            {data.stages[currentStage]?.description}
          </p>
        </motion.div>
      </div>

      {/* Progress bar */}
      <div className="mt-6">
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: color }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span>0ms</span>
          <span>{Math.round((progress / 100) * data.totalTime)}ms</span>
          <span>{data.totalTime}ms</span>
        </div>
      </div>
    </div>
  );
}
