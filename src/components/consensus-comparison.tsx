"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Play, RotateCcw } from "lucide-react";

interface AnimationState {
  progress: number;
  currentStep: number;
}

export function ConsensusComparison() {
  const [isRunning, setIsRunning] = useState(false);
  const [quorumState, setQuorumState] = useState<AnimationState>({ progress: 0, currentStep: 0 });
  const [velociraptorState, setVelociraptorState] = useState<AnimationState>({ progress: 0, currentStep: 0 });
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const quorumSteps = [
    { name: "Preparation", duration: 100 },
    { name: "Tx Creation", duration: 200 },
    { name: "Data Broadcast", duration: 400 },
    { name: "PoA Certificate", duration: 300 },
    { name: "Leader Consensus", duration: 250 },
    { name: "Finalization", duration: 150 },
  ];

  const velociraptorSteps = [
    { name: "Preparation", duration: 50 },
    { name: "Tx Creation", duration: 100 },
    { name: "Optimistic Proposal", duration: 200 },
    { name: "Parallel Verify", duration: 200 },
    { name: "Commit", duration: 100 },
  ];

  const quorumTotal = quorumSteps.reduce((sum, s) => sum + s.duration, 0);
  const velociraptorTotal = velociraptorSteps.reduce((sum, s) => sum + s.duration, 0);

  useEffect(() => {
    if (!isRunning) {
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

      // Update quorum state
      const quorumProgress = Math.min((elapsed / quorumTotal) * 100, 100);
      let quorumAccumulated = 0;
      let quorumStep = 0;
      for (let i = 0; i < quorumSteps.length; i++) {
        quorumAccumulated += quorumSteps[i].duration;
        if (elapsed < quorumAccumulated) {
          quorumStep = i;
          break;
        }
        quorumStep = i;
      }
      setQuorumState({ progress: quorumProgress, currentStep: quorumStep });

      // Update velociraptr state
      const velociraptorProgress = Math.min((elapsed / velociraptorTotal) * 100, 100);
      let velociraptorAccumulated = 0;
      let velociraptorStep = 0;
      for (let i = 0; i < velociraptorSteps.length; i++) {
        velociraptorAccumulated += velociraptorSteps[i].duration;
        if (elapsed < velociraptorAccumulated) {
          velociraptorStep = i;
          break;
        }
        velociraptorStep = i;
      }
      setVelociraptorState({ progress: velociraptorProgress, currentStep: velociraptorStep });

      // Continue animation until both are complete
      if (quorumProgress < 100) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setIsRunning(false);
        startTimeRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRunning, quorumTotal, velociraptorTotal]);

  const handleReset = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setQuorumState({ progress: 0, currentStep: 0 });
    setVelociraptorState({ progress: 0, currentStep: 0 });
    startTimeRef.current = null;
    setIsRunning(false);
  };

  const handleStart = () => {
    handleReset();
    setTimeout(() => setIsRunning(true), 50);
  };

  return (
    <div className="bg-white rounded-2xl p-8 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-lg font-semibold text-gray-900">
          Side-by-Side Race
        </h3>
        <div className="flex gap-2">
          <button
            onClick={handleStart}
            disabled={isRunning}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-aptos-teal text-white hover:bg-aptos-teal/90 disabled:opacity-50 transition-colors"
          >
            <Play className="w-4 h-4" />
            Start Race
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Comparison Grid */}
      <div className="grid md:grid-cols-2 gap-8">
        {/* Quorum Store */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <h4 className="font-semibold text-gray-900">Quorum Store</h4>
            </div>
            <span className="text-sm text-orange-500 font-medium">
              {quorumTotal}ms
            </span>
          </div>
          <p className="text-sm text-gray-500">6 network hops, sequential</p>

          {/* Network visualization */}
          <div className="relative h-32 bg-gray-50 rounded-xl overflow-hidden">
            <svg className="w-full h-full" viewBox="0 0 400 120">
              {/* Central leader node */}
              <circle
                cx="200"
                cy="60"
                r="25"
                fill={quorumState.progress > 50 ? "#f97316" : "#f3f4f6"}
                stroke={quorumState.progress > 50 ? "#f97316" : "#d1d5db"}
                strokeWidth="2"
              />
              <text x="200" y="65" textAnchor="middle" className="text-xs fill-gray-600">
                Leader
              </text>

              {/* Validator nodes around */}
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
                const angle = (i * Math.PI * 2) / 8 - Math.PI / 2;
                const x = 200 + Math.cos(angle) * 70;
                const y = 60 + Math.sin(angle) * 45;
                const isActive = quorumState.progress > (i + 1) * 10;

                return (
                  <g key={i}>
                    <line
                      x1="200"
                      y1="60"
                      x2={x}
                      y2={y}
                      stroke={isActive ? "#f97316" : "#e5e7eb"}
                      strokeWidth="1"
                      strokeDasharray={isActive ? "0" : "3,3"}
                    />
                    <motion.circle
                      cx={x}
                      cy={y}
                      r="10"
                      fill={isActive ? "#f97316" : "#f3f4f6"}
                      stroke={isActive ? "#f97316" : "#d1d5db"}
                      strokeWidth="1"
                      animate={{ scale: isActive ? [1, 1.2, 1] : 1 }}
                      transition={{ duration: 0.2 }}
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-orange-500 rounded-full"
                style={{ width: `${quorumState.progress}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {quorumSteps.map((step, index) => (
                <span
                  key={index}
                  className={`text-xs px-2 py-1 rounded ${
                    quorumState.currentStep === index && isRunning
                      ? "bg-orange-100 text-orange-700 font-medium"
                      : quorumState.currentStep > index || quorumState.progress === 100
                      ? "bg-orange-500 text-white"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {step.name}
                </span>
              ))}
            </div>
          </div>

          {quorumState.progress === 100 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-3 bg-orange-50 rounded-lg text-center"
            >
              <span className="text-orange-600 font-medium">Complete in {quorumTotal}ms</span>
            </motion.div>
          )}
        </div>

        {/* Velociraptr */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-aptos-teal" />
              <h4 className="font-semibold text-gray-900">Velociraptr</h4>
            </div>
            <span className="text-sm text-aptos-teal font-medium">
              {velociraptorTotal}ms
            </span>
          </div>
          <p className="text-sm text-gray-500">4 network hops, parallel</p>

          {/* Network visualization */}
          <div className="relative h-32 bg-gray-50 rounded-xl overflow-hidden">
            <svg className="w-full h-full" viewBox="0 0 400 120">
              {/* Nodes in parallel arrangement */}
              {[0, 1, 2, 3, 4, 5].map((i) => {
                const x = 50 + i * 60;
                const y = 60;
                const isActive = velociraptorState.progress > (i + 1) * 15;

                return (
                  <g key={i}>
                    {i < 5 && (
                      <line
                        x1={x + 15}
                        y1={y}
                        x2={x + 45}
                        y2={y}
                        stroke={isActive ? "#06D6A0" : "#e5e7eb"}
                        strokeWidth="2"
                      />
                    )}
                    <motion.circle
                      cx={x}
                      cy={y}
                      r="15"
                      fill={isActive ? "#06D6A0" : "#f3f4f6"}
                      stroke={isActive ? "#06D6A0" : "#d1d5db"}
                      strokeWidth="2"
                      animate={{
                        scale: isActive ? [1, 1.15, 1] : 1,
                      }}
                      transition={{ duration: 0.15 }}
                    />
                  </g>
                );
              })}

              {/* Parallel broadcast lines */}
              {velociraptorState.progress > 30 && velociraptorState.progress < 70 && (
                <>
                  <motion.line
                    x1="110"
                    y1="40"
                    x2="290"
                    y2="40"
                    stroke="#06D6A0"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.3 }}
                  />
                  <motion.line
                    x1="110"
                    y1="80"
                    x2="290"
                    y2="80"
                    stroke="#06D6A0"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.3 }}
                  />
                </>
              )}
            </svg>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-aptos-teal rounded-full"
                style={{ width: `${velociraptorState.progress}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {velociraptorSteps.map((step, index) => (
                <span
                  key={index}
                  className={`text-xs px-2 py-1 rounded ${
                    velociraptorState.currentStep === index && isRunning
                      ? "bg-teal-100 text-teal-700 font-medium"
                      : velociraptorState.currentStep > index || velociraptorState.progress === 100
                      ? "bg-aptos-teal text-white"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {step.name}
                </span>
              ))}
            </div>
          </div>

          {velociraptorState.progress === 100 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-3 bg-teal-50 rounded-lg text-center"
            >
              <span className="text-aptos-teal font-medium">
                Complete in {velociraptorTotal}ms ({Math.round((1 - velociraptorTotal / quorumTotal) * 100)}% faster!)
              </span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Speed comparison */}
      <div className="mt-8 p-4 bg-gray-50 rounded-xl">
        <div className="flex items-center justify-center gap-4 text-sm">
          <span className="text-gray-600">Speed improvement:</span>
          <span className="text-2xl font-bold text-aptos-teal">
            {((quorumTotal / velociraptorTotal)).toFixed(1)}x faster
          </span>
        </div>
      </div>
    </div>
  );
}
