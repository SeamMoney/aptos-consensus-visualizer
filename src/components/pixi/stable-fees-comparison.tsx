"use client";

import { memo, useEffect, useRef, useState, useCallback } from "react";
import { Application, Graphics } from "pixi.js";
import { useVisibility } from "@/hooks/useVisibility";
import {
  PIXI_COLORS,
  formatFee,
  formatFeeStable,
  lerp,
  easings,
} from "@/lib/pixi-utils";

// Smart Y-axis label formatter - ensures labels are visually distinct
const formatYAxisLabel = (value: number, range: number): string => {
  if (!isFinite(value) || isNaN(value)) return '$0';

  // Determine precision based on range size
  if (range < 0.0001) {
    return `$${value.toFixed(6)}`;
  } else if (range < 0.001) {
    return `$${value.toFixed(5)}`;
  } else if (range < 0.01) {
    return `$${value.toFixed(4)}`;
  } else if (range < 0.1) {
    return `$${value.toFixed(3)}`;
  } else if (range < 1) {
    return `$${value.toFixed(2)}`;
  } else if (range < 10) {
    return `$${value.toFixed(1)}`;
  }
  return `$${value.toFixed(0)}`;
};

interface StableFeesComparisonProps {
  className?: string;
}

// Detailed chain configurations with accurate fee market mechanics
const CHAINS = {
  polygon: {
    name: 'Polygon',
    subtitle: 'EIP-1559 (Low Capacity)',
    color: 0x8247E5,
    capacity: 35, // Practical limit during high load
    baseFee: 0.003,
    peakFee: 0.08,
    failureRate: 0.07,
    // Latency model: soft finality + capped mempool wait
    softFinality: 4000, // 4s (2 blocks)
    maxWait: 600000, // 10 min max wait
    waitPerExcess: 30000, // +30s per 1x over capacity
    feeModel: 'EIP-1559 with 2s blocks. Low throughput causes congestion quickly.',
    mechanism: 'Base fee adjusts ±12.5% per block based on gas usage vs target.',
  },
  ethereum: {
    name: 'Ethereum',
    subtitle: 'EIP-1559 Fee Market',
    color: 0x627EEA,
    capacity: 15, // ~15 TPS
    baseFee: 1.50,
    peakFee: 100,
    failureRate: 0.20,
    // Latency model: 15s confirmation + mempool wait (capped at 1hr)
    softFinality: 15000, // 15s (1 block confirmation)
    maxWait: 3600000, // 1 hour max (then tx dropped/replaced)
    waitPerExcess: 60000, // +1 min per 1x over capacity
    feeModel: 'EIP-1559: Base fee doubles when blocks are full.',
    mechanism: 'Base fee adjusts ±12.5% per block. Priority fee for inclusion priority.',
  },
  solana: {
    name: 'Solana',
    subtitle: 'Local Fee Markets',
    color: 0xFF6B35, // Electric orange - vibrant, pops against Aptos teal
    // Capacity: 65K TPS theoretical
    capacity: 65000,
    // Fee data from Helius, Solana docs, The Block:
    // Base: 5000 lamports = 0.000005 SOL = $0.001 at $200 SOL
    // Median normal: $0.001-$0.003
    // TRUMP launch peak (Jan 2025): mean $0.37, 825% spike, 5000x priority fees
    baseFee: 0.001, // Base + minimal priority in normal conditions
    peakFee: 0.40, // TRUMP launch saw mean of $0.37
    failureRate: 0.15,
    // Latency: What users actually experience (optimistic confirmation)
    // Optimistic confirmation ~400-600ms (what apps show as "confirmed")
    // Note: Full finality is 12.8s (32 slots) but users don't wait for that
    softFinality: 500, // ~500ms optimistic confirmation (user experience)
    maxWait: 2000, // Solana drops txs under load rather than queuing
    waitPerExcess: 500,
    feeModel: 'Local fee markets per account. Hot accounts = high priority fees.',
    mechanism: 'Compute unit pricing + priority fees. Congestion = drops, not delays.',
  },
  monad: {
    name: 'Monad',
    subtitle: 'Variance-Aware EIP-1559',
    color: 0x836EF9,
    capacity: 10000, // Target 10k TPS
    baseFee: 0.001,
    peakFee: 0.003, // Very stable due to variance dampening
    failureRate: 0.01,
    // High capacity means minimal congestion
    softFinality: 800, // 800ms single-slot finality
    maxWait: 2000, // Minimal wait due to capacity
    waitPerExcess: 400,
    feeModel: 'Variance-aware: Dampens short-term volatility, max 3.6% change/block.',
    mechanism: 'Tracks fee variance over time. High variance = slower adjustments. Absorbs spikes.',
  },
  sui: {
    name: 'Sui',
    subtitle: 'Reference Gas Price',
    color: 0x6FBCF0,
    capacity: 100000, // Very high theoretical
    baseFee: 0.0005,
    peakFee: 0.005,
    failureRate: 0.02,
    // Mysticeti consensus: ~400ms finality
    softFinality: 400, // 400ms (Mysticeti)
    maxWait: 1000, // Minimal - huge capacity
    waitPerExcess: 200,
    feeModel: 'Validator-set reference price. Object-based parallelism.',
    mechanism: 'Validators vote on gas price each epoch. Local congestion per object.',
  },
};

const APTOS = {
  name: 'Aptos',
  subtitle: 'Block-STM Parallel Execution',
  color: PIXI_COLORS.primary,
  currentCapacity: 160000,
  futureCapacity: 1000000, // With Shardines, Archon, Block-STM v2
  baseFee: 0.0005, // ~$0.0005 governance floor
  feeVariance: 0.0001,
  failureRate: 0,
  // Sub-second E2E latency with Raptr consensus
  softFinality: 500, // 500ms E2E with Raptr
  // No congestion - massive excess capacity
  feeModel: 'Governance floor + gas market. Block-STM parallel execution.',
  mechanism: 'Optimistic parallel execution. Min gas price set by governance.',
};

// Realistic fee calculation with natural market noise
const calculateChainFee = (
  chainKey: ChainKey,
  intensity: number,
  elapsed: number,
  prevFee: number,
  demandMax: number // Pass in the scenario's max demand
): number => {
  const chain = CHAINS[chainKey];
  const demand = intensity * demandMax;
  const utilizationRatio = demand / chain.capacity;

  // Calculate base target fee based on utilization
  let baseFeeTarget: number;

  switch (chainKey) {
    case 'ethereum':
    case 'polygon': {
      // EIP-1559: fee spikes but plateaus when demand is priced out
      // Historical max: ~$50-100 during extreme congestion
      if (utilizationRatio > 1) {
        // Over capacity: fee spikes to price out excess demand
        // Log scale - fee rises fast initially, then plateaus
        const logPressure = Math.log2(Math.min(utilizationRatio, 50) + 1);
        const feeMultiplier = Math.pow(2, logPressure * 1.5);
        baseFeeTarget = Math.min(chain.peakFee, chain.baseFee * feeMultiplier);
      } else if (utilizationRatio > 0.5) {
        // Approaching capacity: fee starts rising
        const pressure = (utilizationRatio - 0.5) * 2; // 0 to 1
        const feeMultiplier = 1 + pressure * 5;
        baseFeeTarget = chain.baseFee * feeMultiplier;
      } else {
        // Low utilization: base fee
        baseFeeTarget = chain.baseFee * (1 + utilizationRatio * 0.5);
      }
      break;
    }
    case 'solana': {
      // Solana's local fee markets: fees spike on HOT ACCOUNTS, not total TPS
      // Even at 10% total capacity, popular DEXs/mints see massive priority fee spikes
      const hotAccountContention = Math.pow(intensity, 1.5);
      if (utilizationRatio > 0.5) {
        // Heavy activity on hot accounts
        const feeMultiplier = 1 + (chain.peakFee / chain.baseFee - 1) * hotAccountContention;
        baseFeeTarget = Math.min(chain.peakFee, chain.baseFee * feeMultiplier);
      } else {
        // Normal activity
        baseFeeTarget = chain.baseFee * (1 + hotAccountContention * 2);
      }
      break;
    }
    case 'monad': {
      // Variance-aware EIP-1559: max 3.6% change per block
      // Fees stay very stable even under load due to dampening
      const dampedPressure = Math.min(0.5, utilizationRatio * 0.3);
      baseFeeTarget = chain.baseFee * (1 + dampedPressure);
      break;
    }
    case 'sui': {
      // Reference gas price set by validators each epoch
      // More stable than auction, but can rise under sustained load
      if (utilizationRatio > 0.7) {
        const pressure = (utilizationRatio - 0.7) / 0.3;
        baseFeeTarget = chain.baseFee * (1 + pressure * 3);
      } else {
        baseFeeTarget = chain.baseFee * (1 + utilizationRatio * 0.3);
      }
      break;
    }
    default:
      baseFeeTarget = chain.baseFee * (1 + utilizationRatio);
  }

  // Add organic market noise with discrete step behavior (like real block-by-block updates)
  const noiseScale = baseFeeTarget * 0.15;

  // Discrete steps - fee holds then jumps (simulates per-block updates)
  // ~20% chance to update per frame = roughly every 5 frames = choppy steps
  const shouldUpdate = Math.random() < 0.2;

  let result: number;
  if (shouldUpdate) {
    // When we update, make a discrete jump
    const stepNoise = (Math.random() - 0.5) * noiseScale;
    const targetFee = Math.max(chain.baseFee * 0.8, baseFeeTarget + stepNoise);
    // Snap more aggressively toward target (0.6-0.8) for discrete feel
    const snapStrength = 0.6 + Math.random() * 0.2;
    result = lerp(prevFee, targetFee, snapStrength);
  } else {
    // Hold current value with tiny jitter
    const microJitter = (Math.random() - 0.5) * noiseScale * 0.05;
    result = prevFee + microJitter;
  }

  // Protect against NaN - fallback to base fee
  if (!isFinite(result) || isNaN(result)) {
    return chain.baseFee;
  }
  return result;
};

// Aptos fee calculation with contention and capacity pressure
// Under normal conditions: stable at governance floor
// Uses discrete steps like real block-by-block updates (Aptos: ~50-100ms blocks)
const calculateAptosFee = (
  elapsed: number,
  prevFee: number,
  intensity: number,
  contention: number,
  demand: number
): number => {
  // Capacity pressure: as demand approaches 160k TPS, some fee pressure builds
  const utilizationRatio = demand / APTOS.currentCapacity;
  const capacityPressure = utilizationRatio > 0.5
    ? Math.pow((utilizationRatio - 0.5) * 2, 2) * 0.002
    : 0;

  // Contention penalty: contentious state access causes re-execution
  const contentionPenalty = contention * intensity * 0.001;

  // Block-STM re-execution overhead at very high contention
  const reexecutionOverhead = contention > 0.2 && intensity > 0.7
    ? (contention - 0.2) * intensity * 0.0015
    : 0;

  // Priority fee bidding at very high utilization
  const priorityBidding = utilizationRatio > 0.8
    ? Math.pow((utilizationRatio - 0.8) * 5, 2) * 0.003
    : 0;

  const baseFeeTarget = APTOS.baseFee + capacityPressure + contentionPenalty + reexecutionOverhead + priorityBidding;

  // Discrete step behavior - Aptos has fast blocks (~100ms) so updates often
  // ~25% chance to update per frame for choppy look
  const shouldUpdate = Math.random() < 0.25;

  if (shouldUpdate) {
    // Discrete jump with noise
    const stepNoise = (Math.random() - 0.5) * 0.0003;
    const targetFee = Math.max(0.00035, Math.min(0.008, baseFeeTarget + stepNoise));
    // Snap hard toward target for discrete feel
    const snapStrength = 0.5 + Math.random() * 0.3;
    return lerp(prevFee, targetFee, snapStrength);
  } else {
    // Hold with tiny micro-jitter
    const microJitter = (Math.random() - 0.5) * 0.00003;
    return Math.max(0.00035, prevFee + microJitter);
  }
};

// Calculate "priced out" rate - transactions that can't afford to go through
// This isn't "failure" - it's users being priced out by high fees
const calculatePricedOutRate = (chainKey: ChainKey, demand: number): number => {
  const chain = CHAINS[chainKey];
  const utilizationRatio = demand / chain.capacity;

  // Solana: local fee markets mean some txs get dropped even at low utilization
  if (chainKey === 'solana') {
    if (utilizationRatio > 0.5) {
      return Math.min(0.20, chain.failureRate * Math.pow(utilizationRatio, 1.5));
    } else if (utilizationRatio > 0.15) {
      return Math.min(0.08, chain.failureRate * utilizationRatio);
    }
    return 0;
  }

  // For EIP-1559 chains (Ethereum, Polygon):
  // When demand > capacity, excess demand gets "priced out" (stuck in mempool)
  // The chain still processes at MAX capacity, but fees spike to reduce demand
  if (utilizationRatio > 1) {
    // Calculate what % of demand can't get through
    // At 2x demand: 50% priced out, at 3x: 67%, at 10x: 90%
    const pricedOutRate = 1 - (1 / utilizationRatio);
    return Math.min(0.95, pricedOutRate); // Cap at 95% - some always pay
  } else if (utilizationRatio > 0.8) {
    // Approaching capacity - some start getting priced out
    return Math.min(0.15, (utilizationRatio - 0.8) / 0.2 * 0.15);
  }
  return 0;
};

// Calculate latency based on chain capacity vs demand
// Different chains behave differently under load:
// - Solana: latency stays flat, failures increase (drops txs)
// - Ethereum/Polygon: latency increases (mempool queuing)
const calculateLatency = (chainKey: ChainKey, demand: number): { value: number; unit: string } => {
  const chain = CHAINS[chainKey];
  const utilizationRatio = demand / chain.capacity;

  // Base latency = soft finality (what users wait for under normal conditions)
  let latencyMs = chain.softFinality;

  // Solana: latency stays relatively flat - congestion = drops, not delays
  if (chainKey === 'solana') {
    // Only slight increase under extreme load (successful txs still fast)
    const minorIncrease = Math.min(200, utilizationRatio * 100);
    latencyMs += minorIncrease;
  } else {
    // Other chains (Ethereum, Polygon): mempool queuing increases latency
    if (utilizationRatio > 0.5) {
      // Latency grows with utilization squared for realistic curve
      const congestionFactor = Math.pow((utilizationRatio - 0.5) * 2, 2);
      latencyMs += congestionFactor * chain.waitPerExcess;
    }

    if (utilizationRatio > 1) {
      // Over capacity: additional mempool wait (capped)
      const excessDemand = utilizationRatio - 1;
      const mempoolWait = Math.min(
        chain.maxWait,
        excessDemand * chain.waitPerExcess * 2
      );
      latencyMs += mempoolWait;
    }
  }

  // Format the output with appropriate units
  if (latencyMs < 1000) {
    return { value: Math.round(latencyMs), unit: 'ms' };
  } else if (latencyMs < 60000) {
    return { value: Math.round(latencyMs / 100) / 10, unit: 's' };
  } else if (latencyMs < 3600000) {
    return { value: Math.round(latencyMs / 6000) / 10, unit: 'min' };
  }
  // Cap display at 60 min
  return { value: 60, unit: 'min+' };
};

// Aptos latency stays consistent regardless of load
// With Raptr consensus: ~500ms E2E, massive excess capacity means no congestion
const calculateAptosLatency = (demand: number): { value: number; unit: string } => {
  const utilizationRatio = demand / APTOS.currentCapacity;
  // Small variance from network conditions, but latency stays sub-second always
  // Even at 100% capacity (160k TPS), latency only increases slightly
  const baseLatency = APTOS.softFinality;
  const variance = utilizationRatio * 50; // Max +50ms at full capacity
  const latency = baseLatency + variance;
  return { value: Math.round(latency), unit: 'ms' };
};

// Calculate if chain is congested/over capacity
const isChainCongested = (chainKey: ChainKey, demand: number): { congested: boolean; overCapacity: boolean; utilizationPct: number } => {
  const chain = CHAINS[chainKey];
  const utilizationPct = (demand / chain.capacity) * 100;

  // Solana: congestion happens on hot accounts even at low total utilization
  if (chainKey === 'solana') {
    return {
      congested: utilizationPct > 15, // Hot accounts congest early
      overCapacity: utilizationPct > 100, // Still uses theoretical for "over capacity"
      utilizationPct: Math.min(utilizationPct, 9999),
    };
  }

  return {
    congested: utilizationPct > 80,
    overCapacity: utilizationPct > 100,
    utilizationPct: Math.min(utilizationPct, 9999), // Cap display
  };
};

type ChainKey = keyof typeof CHAINS;

// Dynamic demand curve - automatically cycles through low → medium → extreme → recovery
// This replaces the manual scenario selector
const calculateDynamicDemand = (intensity: number): { demand: number; contention: number } => {
  // Intensity goes from 0 → 1 → 0 over the animation cycle
  // Map intensity to exponential demand curve for dramatic effect
  // At intensity 0: ~10 TPS
  // TPS mapping - designed so 10K-160K range is most visible
  // At intensity 0.3: ~10,000 TPS (where it gets interesting)
  // At intensity 0.6: ~50,000 TPS
  // At intensity 1.0: ~160,000 TPS
  const minDemand = 10;
  const maxDemand = 160000;

  // Use intensity^2 for smoother curve that spends more time in interesting range
  const demand = Math.round(minDemand + (maxDemand - minDemand) * Math.pow(intensity, 2));

  // Contention increases with demand (Aptos handles it, but it adds variance)
  const contention = intensity > 0.7 ? (intensity - 0.7) * 1.0 : intensity > 0.4 ? (intensity - 0.4) * 0.3 : 0;

  return { demand, contention };
};

const CONFIG = {
  duration: 45000, // 45 second cycle - tighter, more engaging
  phases: {
    normal: { start: 0, end: 0.1 }, // 0-4.5s: Low activity (quick intro)
    ramp: { start: 0.1, end: 0.45 }, // 4.5-20s: Build to 10K-50K range
    spike: { start: 0.45, end: 0.8 }, // 20-36s: The interesting 50K-160K range (16 seconds!)
    recovery: { start: 0.8, end: 1 }, // 36-45s: Wind down
  },
  stateUpdateInterval: 33, // 30 updates/sec - smooth numbers
  maxDataPoints: 300, // Enough for smooth charts
};

interface DataPoint {
  time: number;
  fee: number;
}

export const StableFeesComparison = memo(function StableFeesComparison({
  className,
}: StableFeesComparisonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const initAttemptedRef = useRef(false);
  const mountedRef = useRef(true);

  const startTimeRef = useRef<number>(0);
  const leftDataRef = useRef<DataPoint[]>([]);
  const rightDataRef = useRef<DataPoint[]>([]);
  const lastStateUpdateRef = useRef<number>(0);
  const prevChainFeeRef = useRef<number>(CHAINS.ethereum.baseFee);
  const prevAptosFeeRef = useRef<number>(APTOS.baseFee);

  const graphicsRef = useRef<{
    background: Graphics | null;
    demandMeter: Graphics | null;
    leftChart: Graphics | null;
    rightChart: Graphics | null;
    divider: Graphics | null;
    capacity: Graphics | null;
  }>({
    background: null,
    demandMeter: null,
    leftChart: null,
    rightChart: null,
    divider: null,
    capacity: null,
  });

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [selectedChain, setSelectedChain] = useState<ChainKey>('ethereum');
  const [currentDemand, setCurrentDemand] = useState(10);
  const [leftFee, setLeftFee] = useState(CHAINS.ethereum.baseFee);
  const [aptosFee, setAptosFee] = useState(APTOS.baseFee);
  const [leftFailedPct, setLeftFailedPct] = useState(0);
  const [isOverCapacity, setIsOverCapacity] = useState(false);

  // Y positions for price trackers
  const [leftCurrentY, setLeftCurrentY] = useState(200);
  const [rightCurrentY, setRightCurrentY] = useState(200);

  // Y-axis label values
  const [leftYMax, setLeftYMax] = useState(2);
  const [leftYMin, setLeftYMin] = useState(0);
  const [rightYMax, setRightYMax] = useState(0.0015);
  const [rightYMin, setRightYMin] = useState(0);

  // Stats
  const [leftLatency, setLeftLatency] = useState({ value: 12, unit: 's' });
  const [aptosLatency, setAptosLatency] = useState({ value: 70, unit: 'ms' });
  const [utilizationPct, setUtilizationPct] = useState(0);

  const isVisible = useVisibility(containerRef);
  const isPlayingRef = useRef(true);
  const selectedChainRef = useRef<ChainKey>('ethereum');

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    selectedChainRef.current = selectedChain;
    leftDataRef.current = [];
    rightDataRef.current = [];
    prevChainFeeRef.current = CHAINS[selectedChain].baseFee;
    setLeftFailedPct(0);
    setIsOverCapacity(false);
  }, [selectedChain]);

  const getPhase = useCallback((progress: number) => {
    const { phases } = CONFIG;
    if (progress < phases.normal.end) return 'normal';
    if (progress < phases.ramp.end) return 'ramp';
    if (progress < phases.spike.end) return 'spike';
    return 'recovery';
  }, []);

  const calculateIntensity = useCallback((progress: number) => {
    const phase = getPhase(progress);
    const { phases } = CONFIG;

    switch (phase) {
      case 'normal':
        // Small baseline activity
        return 0.02;
      case 'ramp': {
        // Build up to the interesting range (~50K TPS = intensity 0.55)
        const rampProgress = (progress - phases.ramp.start) / (phases.ramp.end - phases.ramp.start);
        // Use easeInCubic for slow start, then accelerate into spike phase
        return 0.02 + easings.easeInOutCubic(rampProgress) * 0.53;
      }
      case 'spike': {
        // THE MAIN EVENT: 50K-160K TPS range
        const spikeProgress = (progress - phases.spike.start) / (phases.spike.end - phases.spike.start);

        if (spikeProgress < 0.25) {
          // Quick push to peak (50K → 160K)
          return 0.55 + easings.easeOutQuad(spikeProgress / 0.25) * 0.45;
        } else if (spikeProgress < 0.75) {
          // SUSTAINED PEAK at 160K with exciting variance
          const pulsePhase = (spikeProgress - 0.25) * 8; // Multiple pulses
          const pulse = Math.sin(pulsePhase * Math.PI) * 0.05;
          return 0.95 + pulse + Math.random() * 0.03; // Add organic jitter
        } else {
          // Gradual decline from peak
          const declineProgress = (spikeProgress - 0.75) / 0.25;
          return 1.0 - easings.easeInQuad(declineProgress) * 0.35;
        }
      }
      case 'recovery': {
        const recoveryProgress = (progress - phases.recovery.start) / (phases.recovery.end - phases.recovery.start);
        // Quick wind down
        return 0.65 * (1 - easings.easeOutCubic(recoveryProgress));
      }
      default:
        return 0;
    }
  }, [getPhase]);

  const updateAnimation = useCallback(() => {
    if (!mountedRef.current) return;
    const app = appRef.current;
    const container = containerRef.current;
    if (!app || !container) return;

    // Safety check for destroyed renderer
    try {
      if (!app.renderer || !app.stage) return;
    } catch {
      return;
    }

    // Wrap entire animation in try-catch to handle PixiJS TexturePool errors
    try {
    const now = performance.now();
    const elapsed = now - startTimeRef.current;
    const progress = (elapsed % CONFIG.duration) / CONFIG.duration;
    const chain = CHAINS[selectedChainRef.current];

    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    if (Math.abs(app.screen.width - width) > 1 || Math.abs(app.screen.height - height) > 1) {
      app.renderer.resize(width, height);
    }

    // Calculate intensity and dynamic demand (auto-cycles through low → extreme → recovery)
    const intensity = calculateIntensity(progress);
    const { demand, contention } = calculateDynamicDemand(intensity);

    // Calculate fees using realistic chain-specific models
    const chainFee = calculateChainFee(
      selectedChainRef.current,
      intensity,
      elapsed,
      prevChainFeeRef.current,
      150000 // Max demand for utilization calculation
    );
    prevChainFeeRef.current = chainFee;

    // Calculate Aptos fee with contention and capacity pressure
    const aptFee = calculateAptosFee(
      elapsed,
      prevAptosFeeRef.current,
      intensity,
      contention,
      demand
    );
    prevAptosFeeRef.current = aptFee;

    // Calculate "priced out" rate (not failures - users can't afford fees)
    const pricedOutRate = calculatePricedOutRate(selectedChainRef.current, demand);

    // Store data points (limit for performance)
    leftDataRef.current.push({ time: elapsed, fee: chainFee });
    rightDataRef.current.push({ time: elapsed, fee: aptFee });
    if (leftDataRef.current.length > CONFIG.maxDataPoints) leftDataRef.current.shift();
    if (rightDataRef.current.length > CONFIG.maxDataPoints) rightDataRef.current.shift();

    // Throttle state updates
    if (now - lastStateUpdateRef.current > CONFIG.stateUpdateInterval) {
      lastStateUpdateRef.current = now;
      setCurrentDemand(demand);
      setLeftFee(chainFee);
      setAptosFee(aptFee);
      setLeftFailedPct(Math.round(pricedOutRate * 100));

      const congestionStatus = isChainCongested(selectedChainRef.current, demand);
      setIsOverCapacity(congestionStatus.overCapacity);
      setUtilizationPct(Math.round(congestionStatus.utilizationPct));

      // Update latency
      setLeftLatency(calculateLatency(selectedChainRef.current, demand));
      setAptosLatency(calculateAptosLatency(demand));

      // Update Y-axis range for left chart - optimized calculation
      const len = leftDataRef.current.length;
      if (len > 10) {
        // Single pass to find min/max (faster than multiple Math.min/max calls)
        let fullMin = Infinity, fullMax = -Infinity;
        let recentMin = Infinity, recentMax = -Infinity;
        const recentStart = Math.floor(len * 0.6);

        for (let i = 0; i < len; i++) {
          const fee = leftDataRef.current[i].fee;
          if (fee < fullMin) fullMin = fee;
          if (fee > fullMax) fullMax = fee;
          if (i >= recentStart) {
            if (fee < recentMin) recentMin = fee;
            if (fee > recentMax) recentMax = fee;
          }
        }

        // Zoom in when recent values are much lower than historical peak
        const isZoomingIn = recentMax < fullMax * 0.3;
        const lMin = isZoomingIn ? recentMin : fullMin;
        const lMax = isZoomingIn ? recentMax : Math.max(fullMax * 0.5, recentMax);

        const lPadding = (lMax - lMin) * 0.15 || lMin * 0.3;
        setLeftYMin(Math.max(0, lMin - lPadding));
        setLeftYMax(lMax + lPadding);
      }

      // Update Y-axis for right chart - dynamic based on current contention
      const rYMax = contention > 0.2 ? 0.008 : contention > 0.05 ? 0.003 : 0.0015;
      setRightYMax(rYMax);
      setRightYMin(0);
    }

    // Layout calculations - cinematic full-bleed charts
    const isMobile = width < 640;
    const margin = isMobile ? 8 : 12;
    const chartTop = isMobile ? 8 : 10;
    const chartHeight = height - chartTop - (isMobile ? 16 : 20);
    const halfWidth = width / 2;
    const chartWidth = halfWidth - margin - 4;

    // Draw clean background - no grid
    const bg = graphicsRef.current.background;
    if (bg) {
      bg.clear();
      bg.rect(0, 0, width, height);
      bg.fill({ color: 0x0a0a0b });
    }

    // Clear unused graphics
    const demandMeter = graphicsRef.current.demandMeter;
    if (demandMeter) demandMeter.clear();

    // Draw thin center divider line - no VS badge
    const divider = graphicsRef.current.divider;
    if (divider) {
      divider.clear();
      divider.setStrokeStyle({ width: 1, color: 0x2d3748, alpha: 0.5 });
      divider.moveTo(halfWidth, chartTop);
      divider.lineTo(halfWidth, chartTop + chartHeight);
      divider.stroke();
    }

    // Draw LEFT chart (selected chain) - clean, no borders
    const leftChart = graphicsRef.current.leftChart;
    if (leftChart && leftDataRef.current.length >= 1) {
      leftChart.clear();
      const points = leftDataRef.current;

      // Calculate Y-axis range - single pass for performance
      const len = points.length;
      const recentStart = Math.floor(len * 0.6);
      let fullMin = Infinity, fullMax = -Infinity;
      let recentMin = Infinity, recentMax = -Infinity;

      for (let i = 0; i < len; i++) {
        const fee = points[i].fee;
        if (fee < fullMin) fullMin = fee;
        if (fee > fullMax) fullMax = fee;
        if (i >= recentStart) {
          if (fee < recentMin) recentMin = fee;
          if (fee > recentMax) recentMax = fee;
        }
      }

      // Zoom in when recent values are much lower than historical peak
      const isZoomingIn = recentMax < fullMax * 0.3;
      const dataMin = isZoomingIn ? recentMin : fullMin;
      const dataMax = isZoomingIn ? recentMax : Math.max(fullMax * 0.5, recentMax);

      const padding = (dataMax - dataMin) * 0.15 || dataMin * 0.3;
      const yMin = Math.max(0, dataMin - padding);
      const yMax = dataMax + padding;

      // Chart area - FULL WIDTH, labels will overlay
      const chartInnerX = margin + 4;
      const chartInnerWidth = chartWidth - 8;
      const chartInnerTop = chartTop + (isMobile ? 8 : 10);
      const chartInnerHeight = chartHeight - (isMobile ? 16 : 20);

      // Subtle grid lines (3 horizontal)
      leftChart.setStrokeStyle({ width: 1, color: 0x374151, alpha: 0.2 });
      for (let i = 0; i <= 3; i++) {
        const y = chartInnerTop + (chartInnerHeight / 3) * i;
        leftChart.moveTo(chartInnerX, y);
        leftChart.lineTo(chartInnerX + chartInnerWidth, y);
      }
      leftChart.stroke();

      // Draw line and area - keep consistent chain color
      const areaColor = chain.color;

      // Area fill
      leftChart.moveTo(chartInnerX, chartInnerTop + chartInnerHeight);
      for (let i = 0; i < points.length; i++) {
        const xRatio = i / Math.max(1, points.length - 1);
        const yRatio = yMax > yMin ? (points[i].fee - yMin) / (yMax - yMin) : 0.5;
        const x = chartInnerX + xRatio * chartInnerWidth;
        const y = chartInnerTop + chartInnerHeight - Math.max(0, Math.min(1, yRatio)) * chartInnerHeight;
        leftChart.lineTo(x, y);
      }
      leftChart.lineTo(chartInnerX + chartInnerWidth, chartInnerTop + chartInnerHeight);
      leftChart.closePath();
      leftChart.fill({ color: areaColor, alpha: 0.12 });

      // Line
      leftChart.setStrokeStyle({ width: 2.5, color: areaColor });
      for (let i = 0; i < points.length; i++) {
        const xRatio = i / Math.max(1, points.length - 1);
        const yRatio = yMax > yMin ? (points[i].fee - yMin) / (yMax - yMin) : 0.5;
        const x = chartInnerX + xRatio * chartInnerWidth;
        const y = chartInnerTop + chartInnerHeight - Math.max(0, Math.min(1, yRatio)) * chartInnerHeight;
        if (i === 0) leftChart.moveTo(x, y);
        else leftChart.lineTo(x, y);
      }
      leftChart.stroke();

      // Current point indicator
      const lastFee = points[points.length - 1].fee;
      const lastYRatio = yMax > yMin ? (lastFee - yMin) / (yMax - yMin) : 0.5;
      const currentX = chartInnerX + chartInnerWidth;
      const currentY = chartInnerTop + chartInnerHeight - Math.max(0, Math.min(1, lastYRatio)) * chartInnerHeight;

      // Glow effect for current point
      leftChart.circle(currentX, currentY, 8);
      leftChart.fill({ color: areaColor, alpha: 0.3 });
      leftChart.circle(currentX, currentY, 5);
      leftChart.fill({ color: areaColor });

      // Update state for HTML price tracker
      setLeftCurrentY(currentY);
    }

    // Draw RIGHT chart (Aptos - always stable)
    const rightChart = graphicsRef.current.rightChart;
    if (rightChart && rightDataRef.current.length >= 1) {
      rightChart.clear();
      const points = rightDataRef.current;

      // Zoomed in Y-axis for Aptos - use dynamic range based on actual data
      const aptosYMin = 0;
      // Calculate actual max from data for better Y-axis
      const aptosFeesData = points.map(p => p.fee);
      const aptosMaxFee = Math.max(...aptosFeesData, 0.0006);
      const aptosYMax = aptosMaxFee * 1.5; // 50% headroom

      // Chart area - FULL WIDTH, labels will overlay
      const chartInnerX = halfWidth + margin + 4;
      const chartInnerWidth = chartWidth - 8;
      const chartInnerTop = chartTop + (isMobile ? 8 : 10);
      const chartInnerHeight = chartHeight - (isMobile ? 16 : 20);

      // Subtle grid lines (3 horizontal)
      rightChart.setStrokeStyle({ width: 1, color: 0x374151, alpha: 0.2 });
      for (let i = 0; i <= 3; i++) {
        const y = chartInnerTop + (chartInnerHeight / 3) * i;
        rightChart.moveTo(chartInnerX, y);
        rightChart.lineTo(chartInnerX + chartInnerWidth, y);
      }
      rightChart.stroke();

      // Area fill
      rightChart.moveTo(chartInnerX, chartInnerTop + chartInnerHeight);
      for (let i = 0; i < points.length; i++) {
        const xRatio = i / Math.max(1, points.length - 1);
        const yRatio = aptosYMax > aptosYMin ? (points[i].fee - aptosYMin) / (aptosYMax - aptosYMin) : 0.5;
        const x = chartInnerX + xRatio * chartInnerWidth;
        const y = chartInnerTop + chartInnerHeight - Math.max(0, Math.min(1, yRatio)) * chartInnerHeight;
        rightChart.lineTo(x, y);
      }
      rightChart.lineTo(chartInnerX + chartInnerWidth, chartInnerTop + chartInnerHeight);
      rightChart.closePath();
      rightChart.fill({ color: APTOS.color, alpha: 0.12 });

      // Line
      rightChart.setStrokeStyle({ width: 2.5, color: APTOS.color });
      for (let i = 0; i < points.length; i++) {
        const xRatio = i / Math.max(1, points.length - 1);
        const yRatio = aptosYMax > aptosYMin ? (points[i].fee - aptosYMin) / (aptosYMax - aptosYMin) : 0.5;
        const x = chartInnerX + xRatio * chartInnerWidth;
        const y = chartInnerTop + chartInnerHeight - Math.max(0, Math.min(1, yRatio)) * chartInnerHeight;
        if (i === 0) rightChart.moveTo(x, y);
        else rightChart.lineTo(x, y);
      }
      rightChart.stroke();

      // Current point with glow
      const lastFee = points[points.length - 1].fee;
      const lastYRatio = aptosYMax > aptosYMin ? (lastFee - aptosYMin) / (aptosYMax - aptosYMin) : 0.5;
      const currentX = chartInnerX + chartInnerWidth;
      const currentY = chartInnerTop + chartInnerHeight - Math.max(0, Math.min(1, lastYRatio)) * chartInnerHeight;

      rightChart.circle(currentX, currentY, 8);
      rightChart.fill({ color: APTOS.color, alpha: 0.3 });
      rightChart.circle(currentX, currentY, 5);
      rightChart.fill({ color: APTOS.color });

      // Update state for HTML price tracker
      setRightCurrentY(currentY);
    }

    // Clear unused capacity graphics
    const capacity = graphicsRef.current.capacity;
    if (capacity) capacity.clear();

    } catch {
      // Outer catch for any animation errors
    }
  }, [calculateIntensity]);

  const initPixi = useCallback(async () => {
    const container = containerRef.current;
    if (!container || appRef.current) return;

    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    initAttemptedRef.current = true;

    const app = new Application();
    await app.init({
      width: rect.width,
      height: rect.height,
      backgroundColor: PIXI_COLORS.background,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    // 60 FPS for smooth animation
    app.ticker.maxFPS = 60;

    container.appendChild(app.canvas as HTMLCanvasElement);
    appRef.current = app;

    graphicsRef.current = {
      background: new Graphics(),
      demandMeter: new Graphics(),
      leftChart: new Graphics(),
      rightChart: new Graphics(),
      divider: new Graphics(),
      capacity: new Graphics(),
    };

    app.stage.addChild(graphicsRef.current.background!);
    app.stage.addChild(graphicsRef.current.demandMeter!);
    app.stage.addChild(graphicsRef.current.divider!);
    app.stage.addChild(graphicsRef.current.leftChart!);
    app.stage.addChild(graphicsRef.current.rightChart!);
    app.stage.addChild(graphicsRef.current.capacity!);

    // No PixiJS Text - using HTML overlays instead to avoid TexturePool bugs

    startTimeRef.current = performance.now();

    // Add initial data point so charts render immediately
    leftDataRef.current = [{ time: 0, fee: CHAINS[selectedChainRef.current].baseFee }];
    rightDataRef.current = [{ time: 0, fee: APTOS.baseFee }];

    mountedRef.current = true;
    setIsReady(true);

    // Initial render before starting ticker
    updateAnimation();
    app.ticker.add(updateAnimation);
  }, [updateAnimation]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          if (!appRef.current && !initAttemptedRef.current) {
            initPixi();
          } else if (appRef.current) {
            appRef.current.renderer.resize(width, height);
          }
        }
      }
    });
    resizeObserver.observe(container);

    const initTimeout = setTimeout(() => {
      if (!appRef.current && !initAttemptedRef.current) {
        initPixi();
      }
    }, 100);

    initPixi();

    return () => {
      mountedRef.current = false;
      clearTimeout(initTimeout);
      resizeObserver.disconnect();
      if (appRef.current) {
        appRef.current.ticker.stop();
        const canvas = appRef.current.canvas as HTMLCanvasElement;
        try {
          appRef.current.destroy(true, { children: true });
        } catch {
          // Ignore cleanup errors during HMR
        }
        if (canvas && container.contains(canvas)) container.removeChild(canvas);
        appRef.current = null;
      }
      graphicsRef.current = {
        background: null,
        demandMeter: null,
        leftChart: null,
        rightChart: null,
        divider: null,
        capacity: null,
      };
      initAttemptedRef.current = false;
      setIsReady(false);
    };
  }, [initPixi]);

  useEffect(() => {
    if (!appRef.current) return;
    if (isVisible && isPlaying) {
      appRef.current.ticker.start();
      updateAnimation();
    } else {
      appRef.current.ticker.stop();
    }
  }, [isVisible, isPlaying, updateAnimation]);

  const chain = CHAINS[selectedChain];

  return (
    <div className={`${className || ""}`} style={{ backgroundColor: '#0a0a0b' }}>
      {/* Header with fee comparison */}
      <div className="flex items-center justify-center px-4 pt-4 sm:pt-6">
        <div className="flex items-baseline gap-2 sm:gap-4">
          <div className="text-right w-[150px] sm:w-[200px] md:w-[240px]">
            <div className="text-xs sm:text-sm mb-1" style={{ color: `#${chain.color.toString(16).padStart(6, '0')}` }}>
              {chain.name}
            </div>
            <div
              className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight tabular-nums font-bai whitespace-nowrap"
              style={{ color: isOverCapacity || leftFailedPct > 10 ? '#ef4444' : '#ffffff' }}
            >
              {formatFeeStable(leftFee)}
            </div>
          </div>

          <div className="text-center px-3 sm:px-6">
            <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-white tabular-nums">
              {currentDemand.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 uppercase tracking-wider">TPS</div>
          </div>

          <div className="text-left w-[150px] sm:w-[200px] md:w-[240px]">
            <div className="text-xs sm:text-sm mb-1 text-[#00D9A5]">Aptos</div>
            <div className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white tabular-nums font-bai whitespace-nowrap">
              {formatFeeStable(aptosFee)}
            </div>
          </div>
        </div>
      </div>

      {/* TPS Demand Gauge - Custom scale: 1K at 25%, 10K at 50%, 100K at 85% */}
      <div className="px-4 py-3">
        {(() => {
          // Custom piecewise scale for intuitive TPS visualization
          // 0-1K: 0-25%, 1K-10K: 25-50%, 10K-100K: 50-85%, 100K-160K: 85-100%
          const getTPSPercent = (tps: number) => {
            if (tps <= 0) return 0;
            if (tps <= 1000) return (tps / 1000) * 25;
            if (tps <= 10000) return 25 + ((tps - 1000) / 9000) * 25;
            if (tps <= 100000) return 50 + ((tps - 10000) / 90000) * 35;
            return 85 + ((tps - 100000) / 60000) * 15;
          };
          const barPercent = getTPSPercent(currentDemand);

          return (
        <div className="relative">
          {/* Background track */}
          <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
            {/* Fill bar */}
            <div
              className="h-full rounded-full transition-all duration-100 ease-out"
              style={{
                width: `${barPercent}%`,
                background: currentDemand > 10000
                  ? 'linear-gradient(90deg, #22c55e, #00D9A5)'
                  : currentDemand > 1000
                    ? 'linear-gradient(90deg, #fbbf24, #f59e0b)'
                    : 'linear-gradient(90deg, #3b82f6, #627EEA)',
              }}
            />
          </div>

          {/* Threshold markers */}
          <div className="absolute inset-0 flex items-center pointer-events-none">
            {/* 1K TPS marker - at 25% */}
            <div
              className="absolute h-5 w-0.5 bg-gray-500 -top-1"
              style={{ left: '25%' }}
            />
            {/* 10K TPS marker - at 50% */}
            <div
              className="absolute h-5 w-0.5 bg-gray-500 -top-1"
              style={{ left: '50%' }}
            />
            {/* 100K TPS marker - at 85% */}
            <div
              className="absolute h-5 w-0.5 bg-gray-500 -top-1"
              style={{ left: '85%' }}
            />
          </div>

          {/* Scale labels */}
          <div className="relative mt-1 h-4 text-[9px] text-gray-500">
            <span className="absolute" style={{ left: '0%' }}>0</span>
            <span className="absolute" style={{ left: '25%', transform: 'translateX(-50%)' }}>1K</span>
            <span className="absolute" style={{ left: '50%', transform: 'translateX(-50%)' }}>10K</span>
            <span className="absolute" style={{ left: '85%', transform: 'translateX(-50%)' }}>100K</span>
            <span className="absolute right-0">160K</span>
          </div>
        </div>
          );
        })()}
      </div>

      {/* Chain Selector Only */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 px-4 pb-3">
        {(Object.keys(CHAINS) as ChainKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setSelectedChain(key)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
              selectedChain === key
                ? 'text-white'
                : 'text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-700/50'
            }`}
            style={selectedChain === key ? {
              backgroundColor: `#${CHAINS[key].color.toString(16).padStart(6, '0')}`,
            } : {}}
          >
            {CHAINS[key].name}
          </button>
        ))}
      </div>

      {/* Charts */}
      <div
        ref={containerRef}
        className="canvas-wrap relative overflow-hidden h-[300px] sm:h-[350px] md:h-[400px]"
        style={{ backgroundColor: "#0a0a0b" }}
      >
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-sm text-gray-500">Loading...</div>
          </div>
        )}

        {/* Overlays with text shadows for contrast */}
        {isReady && (
          <>
            {/* Left Y-axis - overlays chart, positioned below chain name */}
            <div className="absolute pointer-events-none" style={{ left: 8, top: 28, height: 'calc(100% - 48px)' }}>
              <div className="h-full flex flex-col justify-between">
                <span className="text-[10px] sm:text-xs text-gray-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{formatYAxisLabel(leftYMax, leftYMax - leftYMin)}</span>
                <span className="text-[10px] sm:text-xs text-gray-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{formatYAxisLabel(leftYMin + (leftYMax - leftYMin) * 0.67, leftYMax - leftYMin)}</span>
                <span className="text-[10px] sm:text-xs text-gray-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{formatYAxisLabel(leftYMin + (leftYMax - leftYMin) * 0.33, leftYMax - leftYMin)}</span>
                <span className="text-[10px] sm:text-xs text-gray-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{formatYAxisLabel(leftYMin, leftYMax - leftYMin)}</span>
              </div>
            </div>

            {/* Left price tracker */}
            <div
              className="absolute pointer-events-none transition-all duration-75"
              style={{ right: 'calc(50% + 8px)', top: leftCurrentY - 12 }}
            >
              <div
                className="px-2 py-0.5 rounded text-xs sm:text-sm font-semibold shadow-lg"
                style={{
                  backgroundColor: isOverCapacity || leftFailedPct > 10 ? 'rgba(239, 68, 68, 0.95)' : `rgba(${(chain.color >> 16) & 0xff}, ${(chain.color >> 8) & 0xff}, ${chain.color & 0xff}, 0.95)`,
                  color: '#ffffff',
                }}
              >
                {formatFee(leftFee)}
              </div>
            </div>

            {/* Right Y-axis - overlays chart, positioned below chain name */}
            <div className="absolute pointer-events-none" style={{ left: 'calc(50% + 8px)', top: 28, height: 'calc(100% - 48px)' }}>
              <div className="h-full flex flex-col justify-between">
                <span className="text-[10px] sm:text-xs text-gray-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{formatYAxisLabel(rightYMax, rightYMax - rightYMin)}</span>
                <span className="text-[10px] sm:text-xs text-gray-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{formatYAxisLabel(rightYMin + (rightYMax - rightYMin) * 0.67, rightYMax - rightYMin)}</span>
                <span className="text-[10px] sm:text-xs text-gray-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{formatYAxisLabel(rightYMin + (rightYMax - rightYMin) * 0.33, rightYMax - rightYMin)}</span>
                <span className="text-[10px] sm:text-xs text-gray-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{formatYAxisLabel(rightYMin, rightYMax - rightYMin)}</span>
              </div>
            </div>

            {/* Right price tracker */}
            <div
              className="absolute pointer-events-none transition-all duration-75"
              style={{ right: 8, top: rightCurrentY - 12 }}
            >
              <div className="px-2 py-0.5 rounded text-xs sm:text-sm font-semibold shadow-lg bg-[#00D9A5]/95 text-black">
                {formatFee(aptosFee)}
              </div>
            </div>

            {/* Chart labels - name only (tech shown in stats below) */}
            <div className="absolute text-sm font-medium pointer-events-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" style={{ left: 12, top: 8, color: `#${chain.color.toString(16).padStart(6, '0')}` }}>
              {chain.name}
            </div>
            <div className="absolute text-sm font-medium pointer-events-none text-[#00D9A5] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" style={{ left: 'calc(50% + 12px)', top: 8 }}>
              Aptos
            </div>
          </>
        )}
      </div>

      {/* Stats Section - Two columns: Selected chain | Aptos */}
      <div className="grid grid-cols-2 gap-4 px-4 py-4">
        {/* Left column: Selected chain stats */}
        <div className="space-y-2">
          <div className="mb-2">
            <div className="text-xs font-medium" style={{ color: `#${chain.color.toString(16).padStart(6, '0')}` }}>
              {chain.name}
            </div>
            <div className="text-[9px] text-gray-500">
              {chain.subtitle}
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">Confirmation</span>
            <span className="text-sm font-semibold" style={{ color: leftLatency.unit === 'min' || leftLatency.unit === 'min+' ? '#ef4444' : '#ffffff' }}>
              {leftLatency.value}{leftLatency.unit}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">Tx Failures</span>
            <span className="text-sm font-semibold" style={{ color: leftFailedPct > 10 ? '#ef4444' : '#ffffff' }}>
              {leftFailedPct}%
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">Capacity</span>
            <span className="text-sm font-semibold" style={{ color: utilizationPct > 100 ? '#ef4444' : '#ffffff' }}>
              {utilizationPct}%
            </span>
          </div>
        </div>

        {/* Right column: Aptos stats */}
        <div className="space-y-2">
          <div className="mb-2">
            <div className="text-xs font-medium text-[#00D9A5]">
              Aptos
            </div>
            <div className="text-[9px] text-gray-500">
              Block-STM + Raptr Consensus
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">Confirmation</span>
            <span className="text-sm font-semibold text-[#00D9A5]">
              {aptosLatency.value}{aptosLatency.unit}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">Tx Failures</span>
            <span className="text-sm font-semibold text-[#00D9A5]">
              0%
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">Capacity</span>
            <span className="text-sm font-semibold text-[#00D9A5]">
              {((currentDemand / APTOS.currentCapacity) * 100).toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* Capacity Comparison */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span style={{ color: `#${chain.color.toString(16).padStart(6, '0')}` }}>{chain.name}</span>
              <span className={utilizationPct > 100 ? 'text-red-400' : 'text-gray-400'}>{utilizationPct}%</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, utilizationPct)}%`,
                  backgroundColor: utilizationPct > 100 ? '#ef4444' : `#${chain.color.toString(16).padStart(6, '0')}`,
                }}
              />
            </div>
            <div className="text-[10px] text-gray-500 mt-0.5">{chain.capacity.toLocaleString()} TPS capacity</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[#00D9A5]">Aptos</span>
              <span className="text-gray-400">{((currentDemand / APTOS.currentCapacity) * 100).toFixed(2)}%</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-[#00D9A5] transition-all duration-300"
                style={{ width: `${Math.min(100, (currentDemand / APTOS.currentCapacity) * 100)}%` }}
              />
            </div>
            <div className="text-[10px] text-gray-500 mt-0.5">{APTOS.currentCapacity.toLocaleString()} TPS capacity</div>
          </div>
        </div>
      </div>
    </div>
  );
});
