"use client";

import { useEffect, useRef, useState } from "react";

const E2E_MULTIPLIER = 5; // Raptr 4-hop consensus
const SAMPLE_INTERVAL_MS = 60000; // Sample every 60 seconds (1 minute)
const STORAGE_KEY = "aptos-latency-v4";
const MAX_POINTS = 120; // ~2 hours at 1-minute intervals

export interface LatencyDataPoint {
  timestamp: number;
  e2eLatencyMs: number;
}

export interface LatencyStorageResult {
  dataPoints: LatencyDataPoint[];
  currentP50: number;
  currentP95: number;
  stats: {
    min: number;
    max: number;
    avg: number;
    count: number;
  };
}

function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

// Generate initial baseline data (simulates ~2 hours of history)
function generateBaselineData(): LatencyDataPoint[] {
  const points: LatencyDataPoint[] = [];
  const now = Date.now();
  const baseLatency = 470; // Typical E2E latency

  // Generate points going back 2 hours at 1-minute intervals
  for (let i = MAX_POINTS - 1; i >= 0; i--) {
    const timestamp = now - (i * 60000); // 1 minute apart
    // Add small natural variation (±5ms)
    const variation = (Math.random() - 0.5) * 10;
    points.push({
      timestamp,
      e2eLatencyMs: Math.round(baseLatency + variation),
    });
  }

  return points;
}

// Load from localStorage
function loadFromStorage(): LatencyDataPoint[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const data = JSON.parse(stored) as LatencyDataPoint[];

    // Filter out data older than 3 hours
    const threeHoursAgo = Date.now() - (3 * 60 * 60 * 1000);
    return data.filter(p => p.timestamp > threeHoursAgo);
  } catch {
    return [];
  }
}

// Save to localStorage
function saveToStorage(points: LatencyDataPoint[]) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(points.slice(-MAX_POINTS)));
  } catch {
    // Storage full or unavailable
  }
}

export function useLatencyStorage(
  avgBlockTime: number
): LatencyStorageResult {
  const [dataPoints, setDataPoints] = useState<LatencyDataPoint[]>([]);
  const lastSampleTimeRef = useRef<number>(0);
  const initializedRef = useRef<boolean>(false);

  // Initialize from localStorage or baseline on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const stored = loadFromStorage();
    if (stored.length > 10) {
      // Use stored data
      setDataPoints(stored);
      lastSampleTimeRef.current = stored[stored.length - 1]?.timestamp || 0;
    } else {
      // Generate baseline data for instant chart
      const baseline = generateBaselineData();
      setDataPoints(baseline);
      saveToStorage(baseline);
      lastSampleTimeRef.current = Date.now();
    }
  }, []);

  // Add new data points periodically
  useEffect(() => {
    if (!avgBlockTime || avgBlockTime <= 0) return;
    if (!initializedRef.current) return;

    const now = Date.now();

    // Only sample every 60 seconds
    if (now - lastSampleTimeRef.current < SAMPLE_INTERVAL_MS) return;

    lastSampleTimeRef.current = now;

    const e2eLatency = Math.round(avgBlockTime * E2E_MULTIPLIER);

    setDataPoints((prev) => {
      const newPoint: LatencyDataPoint = {
        timestamp: now,
        e2eLatencyMs: e2eLatency,
      };
      const updated = [...prev, newPoint].slice(-MAX_POINTS);
      saveToStorage(updated);
      return updated;
    });
  }, [avgBlockTime]);

  const allLatencies = dataPoints.map((p) => p.e2eLatencyMs);

  const currentP50 = allLatencies.length > 0
    ? calculatePercentile(allLatencies, 50)
    : Math.round(avgBlockTime * E2E_MULTIPLIER) || 470;
  const currentP95 = allLatencies.length > 0
    ? calculatePercentile(allLatencies, 95)
    : Math.round((avgBlockTime * E2E_MULTIPLIER) * 1.05) || 490;

  const stats = {
    min: allLatencies.length > 0 ? Math.min(...allLatencies) : 0,
    max: allLatencies.length > 0 ? Math.max(...allLatencies) : 0,
    avg: allLatencies.length > 0
      ? Math.round(allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length)
      : 0,
    count: dataPoints.length,
  };

  return {
    dataPoints,
    currentP50,
    currentP95,
    stats,
  };
}
