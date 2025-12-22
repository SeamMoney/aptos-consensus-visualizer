"use client";

import { motion } from "framer-motion";
import { Check, Clock, Rocket } from "lucide-react";

interface ConsensusVersion {
  name: string;
  status: string;
  blockTime: string;
  finality: string;
  networkHops: number;
  description: string;
  color: string;
}

interface EvolutionTimelineProps {
  activeVersion: string;
  onVersionSelect: (version: "quorumStore" | "velociraptr" | "raptr") => void;
  versions: Record<string, ConsensusVersion>;
}

export function EvolutionTimeline({
  activeVersion,
  onVersionSelect,
  versions,
}: EvolutionTimelineProps) {
  const versionKeys = Object.keys(versions) as Array<keyof typeof versions>;

  const getIcon = (key: string, index: number) => {
    if (index === 0) return <Clock className="w-5 h-5" />;
    if (index === 1) return <Check className="w-5 h-5" />;
    return <Rocket className="w-5 h-5" />;
  };

  return (
    <div className="relative">
      {/* Progress Line */}
      <div className="absolute top-12 left-0 right-0 h-1 bg-gray-200 hidden md:block" />
      <motion.div
        className="absolute top-12 left-0 h-1 bg-aptos-teal hidden md:block"
        initial={{ width: "0%" }}
        animate={{
          width:
            activeVersion === "quorumStore"
              ? "16.67%"
              : activeVersion === "velociraptr"
              ? "50%"
              : "83.33%",
        }}
        transition={{ duration: 0.5 }}
      />

      {/* Timeline Items */}
      <div className="grid md:grid-cols-3 gap-6">
        {versionKeys.map((key, index) => {
          const version = versions[key];
          const isActive = activeVersion === key;
          const isPast =
            versionKeys.indexOf(activeVersion as keyof typeof versions) >= index;

          return (
            <motion.button
              key={key}
              onClick={() => onVersionSelect(key as "quorumStore" | "velociraptr" | "raptr")}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`relative p-6 rounded-xl text-left transition-all ${
                isActive
                  ? "bg-white shadow-lg border-2 border-aptos-teal"
                  : "bg-white/50 shadow border border-gray-200 hover:bg-white hover:shadow-md"
              }`}
            >
              {/* Connection dot */}
              <div
                className={`absolute -top-3 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-colors hidden md:flex ${
                  isPast ? "bg-aptos-teal text-white" : "bg-gray-200 text-gray-500"
                }`}
              >
                {getIcon(key, index)}
              </div>

              <div className="md:mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: version.color }}
                  />
                  <h3 className="font-semibold text-gray-900">{version.name}</h3>
                </div>
                <p className="text-xs text-gray-500 mb-3">{version.status}</p>

                <div className="flex items-baseline gap-1 mb-2">
                  <span
                    className="text-2xl font-bold"
                    style={{ color: version.color }}
                  >
                    {version.blockTime}
                  </span>
                  <span className="text-sm text-gray-500">block time</span>
                </div>

                <p className="text-sm text-gray-600 line-clamp-2">
                  {version.description}
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
