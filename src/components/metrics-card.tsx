"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface MetricsCardProps {
  label: string;
  value: string;
  subtext: string;
  icon: ReactNode;
}

export function MetricsCard({ label, value, subtext, icon }: MetricsCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="bg-white rounded-xl p-5 shadow-md border border-gray-100"
    >
      <div className="flex items-center gap-2 text-gray-500 mb-2">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="text-3xl font-bold text-gray-900 mb-1">{value}</div>
      <div className="text-sm text-aptos-teal font-medium">{subtext}</div>
    </motion.div>
  );
}
