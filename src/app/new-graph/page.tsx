"use client";

import { BatchSizeNoise } from "@/components/batch-size-noise";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewGraphPage() {
  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-8">
      <div className="max-w-5xl mx-auto">
        {/* Navigation */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 mb-6 text-sm transition-colors"
          style={{ color: "var(--chrome-500)" }}
        >
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </Link>

        {/* Page Header */}
        <div className="mb-8">
          <h1
            className="text-2xl sm:text-3xl font-bold mb-2"
            style={{ color: "var(--chrome-100)" }}
          >
            Machine Learning Visualizations
          </h1>
          <p className="text-sm" style={{ color: "var(--chrome-500)" }}>
            Interactive demonstrations of key ML concepts
          </p>
        </div>

        {/* Visualization */}
        <BatchSizeNoise />

        {/* Additional Info */}
        <div
          className="mt-6 p-4 rounded-lg"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--chrome-200)" }}>
            About This Visualization
          </h3>
          <p className="text-xs leading-relaxed" style={{ color: "var(--chrome-500)" }}>
            This visualization demonstrates the relationship between batch size and gradient noise
            in stochastic gradient descent (SGD). As batch size increases, the gradient estimate
            becomes more accurate (less noisy), converging toward the true gradient. The noise
            reduction follows a 1/√B relationship, where B is the batch size.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span
              className="px-2 py-1 rounded text-[10px] font-medium"
              style={{ background: "var(--bg-surface)", color: "var(--chrome-400)" }}
            >
              SGD
            </span>
            <span
              className="px-2 py-1 rounded text-[10px] font-medium"
              style={{ background: "var(--bg-surface)", color: "var(--chrome-400)" }}
            >
              Batch Size
            </span>
            <span
              className="px-2 py-1 rounded text-[10px] font-medium"
              style={{ background: "var(--bg-surface)", color: "var(--chrome-400)" }}
            >
              Gradient Noise
            </span>
            <span
              className="px-2 py-1 rounded text-[10px] font-medium"
              style={{ background: "var(--bg-surface)", color: "var(--chrome-400)" }}
            >
              Variance Reduction
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
