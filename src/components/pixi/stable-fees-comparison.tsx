"use client";

import { memo, useEffect, useRef, useState, useCallback } from "react";
import { Application, Graphics } from "pixi.js";
import { useVisibility } from "@/hooks/useVisibility";
import {
  PIXI_COLORS,
  formatFee,
  lerp,
  easings,
} from "@/lib/pixi-utils";

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
    baseLatency: 2000, // 2s block time
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
    baseLatency: 12000, // 12s block time
    feeModel: 'EIP-1559: Base fee doubles when blocks are full.',
    mechanism: 'Base fee adjusts ±12.5% per block. Priority fee for inclusion priority.',
  },
  solana: {
    name: 'Solana',
    subtitle: 'Local Fee Markets',
    color: 0x14F195,
    capacity: 65000, // Theoretical max (real-world varies: 4k-10k sustained)
    sustainedCapacity: 10000, // Real-world sustained under load
    baseFee: 0.00025, // 5000 lamports = ~$0.00025
    peakFee: 0.50, // During TRUMP memecoin launch
    failureRate: 0.15,
    baseLatency: 400, // 400ms slot time
    feeModel: 'Local fee markets per account. Hot accounts = high priority fees.',
    mechanism: 'Compute unit pricing + priority fees. 65k theoretical, 4-10k real-world sustained.',
  },
  monad: {
    name: 'Monad',
    subtitle: 'Variance-Aware EIP-1559',
    color: 0x836EF9,
    capacity: 10000, // Target 10k TPS
    baseFee: 0.001,
    peakFee: 0.003, // Very stable due to variance dampening
    failureRate: 0.01,
    baseLatency: 500, // 500ms target
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
    baseLatency: 500, // ~500ms finality
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
  baseLatency: 900, // ~900ms finality
  feeModel: 'Governance-set minimum + gas market. Block-STM enables massive parallelism.',
  mechanism: 'Optimistic parallel execution. Fees = gas_used × gas_unit_price. Min price set by governance.',
};

// Realistic fee calculation with natural market noise
const calculateChainFee = (
  chainKey: ChainKey,
  intensity: number,
  elapsed: number,
  prevFee: number
): number => {
  const chain = CHAINS[chainKey];

  // Calculate base target fee based on intensity (0-1)
  let baseFeeTarget: number;

  switch (chainKey) {
    case 'ethereum': {
      // EIP-1559: exponential spike at high utilization
      const feeMultiplier = Math.pow(chain.peakFee / chain.baseFee, Math.pow(intensity, 2));
      baseFeeTarget = chain.baseFee * feeMultiplier;
      break;
    }
    case 'solana': {
      // Solana's local fee markets: fees spike on HOT ACCOUNTS, not total TPS
      // Even at 10% total capacity, popular DEXs/mints see massive priority fee spikes
      // This simulates hot account contention, not total network congestion
      const hotAccountContention = Math.pow(intensity, 1.5); // Hot accounts get contested quickly
      const feeMultiplier = 1 + (chain.peakFee / chain.baseFee - 1) * hotAccountContention;
      baseFeeTarget = chain.baseFee * feeMultiplier;
      break;
    }
    case 'monad': {
      // Variance-aware: very flat curve, barely moves
      baseFeeTarget = chain.baseFee * (1 + intensity * 0.4);
      break;
    }
    case 'polygon': {
      // Low capacity: spikes faster than Ethereum
      const feeMultiplier = Math.pow(chain.peakFee / chain.baseFee, Math.pow(intensity, 1.5));
      baseFeeTarget = chain.baseFee * feeMultiplier;
      break;
    }
    case 'sui': {
      // Reference gas price: moderate curve
      baseFeeTarget = chain.baseFee * (1 + (chain.peakFee / chain.baseFee - 1) * Math.pow(intensity, 2));
      break;
    }
    default:
      baseFeeTarget = lerp(chain.baseFee, chain.peakFee, intensity);
  }

  // Add realistic market noise (proportional to fee size)
  const noiseScale = baseFeeTarget * 0.08; // 8% noise
  const slowWave = Math.sin(elapsed * 0.001) * noiseScale * 0.5;
  const medWave = Math.sin(elapsed * 0.004) * noiseScale * 0.3;
  const fastWave = Math.sin(elapsed * 0.015) * noiseScale * 0.2;
  const microNoise = (Math.random() - 0.5) * noiseScale * 0.4;

  const targetFee = Math.max(chain.baseFee * 0.8, baseFeeTarget + slowWave + medWave + fastWave + microNoise);

  // Smooth transition with responsive movement
  const smoothing = chainKey === 'monad' ? 0.05 : 0.12;
  return lerp(prevFee, targetFee, smoothing);
};

// Aptos fee calculation with contention and capacity pressure
// Under normal conditions: stable at governance floor
// Under extreme load with contention: fees CAN increase (but much less than other chains)
const calculateAptosFee = (
  elapsed: number,
  prevFee: number,
  intensity: number,
  contention: number,
  demand: number
): number => {
  // Base noise (always present - gas estimation variance, tx complexity)
  const slowWave = Math.sin(elapsed * 0.0008) * 0.00008;
  const medWave = Math.sin(elapsed * 0.003) * 0.00005;
  const fastWave = Math.sin(elapsed * 0.01) * 0.00003;
  const microNoise = (Math.random() - 0.5) * 0.00004;
  const baseNoise = slowWave + medWave + fastWave + microNoise;

  // Capacity pressure: as demand approaches 160k TPS, some fee pressure builds
  const utilizationRatio = demand / APTOS.currentCapacity;
  const capacityPressure = utilizationRatio > 0.5
    ? Math.pow((utilizationRatio - 0.5) * 2, 2) * 0.002 // Max ~$0.002 at full capacity
    : 0;

  // Contention penalty: contentious state access causes re-execution
  // This increases gas_used, which increases fees
  // At high contention (0.3) + high intensity (1.0) = up to $0.001 extra
  const contentionPenalty = contention * intensity * 0.001;

  // Block-STM re-execution overhead at very high contention
  // When many txs touch same state, some get re-executed 2-3x
  const reexecutionOverhead = contention > 0.2 && intensity > 0.7
    ? (contention - 0.2) * intensity * 0.0015
    : 0;

  // Priority fee bidding: at very high utilization, users may bid up gas_unit_price
  const priorityBidding = utilizationRatio > 0.8
    ? Math.pow((utilizationRatio - 0.8) * 5, 2) * 0.003 // Max ~$0.003 at 100%
    : 0;

  // Total fee: base + all pressure factors
  const targetFee = APTOS.baseFee + baseNoise + capacityPressure + contentionPenalty + reexecutionOverhead + priorityBidding;

  // Even under extreme conditions, Aptos fees stay reasonable
  // Normal: $0.0003-$0.0007
  // Stress: $0.0005-$0.002
  // Extreme: $0.001-$0.006
  const clampedFee = Math.max(0.00035, Math.min(0.008, targetFee));

  return lerp(prevFee, clampedFee, 0.15);
};

// Calculate failure rate based on chain capacity vs demand (capped at 100%)
const calculateFailureRate = (chainKey: ChainKey, demand: number): number => {
  const chain = CHAINS[chainKey];

  // Solana special case: uses theoretical 65k capacity, but has local fee market failures
  // Transactions fail due to priority fee competition, not total TPS limits
  if (chainKey === 'solana') {
    const utilizationRatio = demand / chain.capacity; // Use 65k theoretical
    // Solana failures come from priority fee competition on hot accounts
    // Even at low total utilization, hot accounts see dropped txs
    if (utilizationRatio > 0.5) {
      // High load: 10-20% failures from dropped low-priority txs
      return Math.min(0.25, chain.failureRate * Math.pow(utilizationRatio, 2));
    } else if (utilizationRatio > 0.15) {
      // Moderate load: some failures on hot accounts
      return Math.min(0.10, chain.failureRate * utilizationRatio);
    }
    return 0;
  }

  const utilizationRatio = demand / chain.capacity;

  // When demand exceeds capacity, failures start happening
  if (utilizationRatio > 1) {
    // Over capacity - failure rate increases with overload
    // At 2x capacity: ~50% fail, at 5x: ~80%, at 10x+: ~95%
    const overloadFactor = utilizationRatio - 1;
    const failureRate = 1 - (1 / (1 + overloadFactor * 0.5));
    return Math.min(1.0, failureRate); // CAP AT 100%
  } else if (utilizationRatio > 0.8) {
    // Approaching capacity - congestion starts
    return Math.min(1.0, chain.failureRate * Math.pow((utilizationRatio - 0.8) / 0.2, 2));
  }
  return 0;
};

// Calculate latency based on chain capacity vs demand
const calculateLatency = (chainKey: ChainKey, demand: number): { latency: number; unit: string } => {
  const chain = CHAINS[chainKey];
  const utilizationRatio = demand / chain.capacity;
  const baseLatency = chain.baseLatency;

  if (utilizationRatio > 1) {
    // Over capacity - latency explodes (queuing, retries)
    const overloadFactor = utilizationRatio;
    const latency = baseLatency * Math.pow(overloadFactor, 1.5);

    if (latency > 60000) {
      return { latency: Math.round(latency / 60000 * 10) / 10, unit: 'min' };
    }
    if (latency >= 1000) {
      return { latency: Math.round(latency / 100) / 10, unit: 's' };
    }
    return { latency: Math.round(latency), unit: 'ms' };
  } else if (utilizationRatio > 0.7) {
    // Congested - latency increases
    const congestionFactor = 1 + (utilizationRatio - 0.7) * 3;
    const latency = baseLatency * congestionFactor;
    if (latency >= 1000) {
      return { latency: Math.round(latency / 100) / 10, unit: 's' };
    }
    return { latency: Math.round(latency), unit: 'ms' };
  }

  // Normal - base latency
  if (baseLatency >= 1000) {
    return { latency: Math.round(baseLatency / 100) / 10, unit: 's' };
  }
  return { latency: baseLatency, unit: 'ms' };
};

// Aptos latency stays consistent regardless of load (massive capacity)
const calculateAptosLatency = (demand: number): { latency: number; unit: string } => {
  const utilizationRatio = demand / APTOS.currentCapacity;
  // Even at "high" load, Aptos barely notices
  const latency = APTOS.baseLatency * (1 + utilizationRatio * 0.1);
  return { latency: Math.round(latency), unit: 'ms' };
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

// Format dynamic Y-axis labels with more precision for small values
const formatYAxisLabel = (value: number): string => {
  if (value >= 10) return `$${value.toFixed(0)}`;
  if (value >= 1) return `$${value.toFixed(1)}`;
  if (value >= 0.01) return `$${value.toFixed(2)}`;
  if (value >= 0.001) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(5)}`;
};

type ChainKey = keyof typeof CHAINS;

// Scenario configurations
const SCENARIOS = {
  normal: {
    name: 'Normal Load',
    description: 'Typical blockchain activity (10-500 TPS)',
    demand: { min: 10, max: 500 },
    aptosContention: 0, // No contentious state
  },
  stress: {
    name: 'Stress Test',
    description: 'Heavy DeFi activity (1k-50k TPS)',
    demand: { min: 1000, max: 50000 },
    aptosContention: 0.1, // Some hot accounts
  },
  extreme: {
    name: 'Extreme Load',
    description: 'NFT mint + DeFi rush (50k-150k TPS)',
    demand: { min: 50000, max: 150000 },
    aptosContention: 0.3, // Significant contention
  },
} as const;

type ScenarioKey = keyof typeof SCENARIOS;

const CONFIG = {
  duration: 30000, // 30 second cycle
  phases: {
    normal: { start: 0, end: 0.27 }, // 0-8s
    ramp: { start: 0.27, end: 0.53 }, // 8-16s
    spike: { start: 0.53, end: 0.73 }, // 16-22s
    recovery: { start: 0.73, end: 1 }, // 22-30s
  },
  stateUpdateInterval: 50,
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
  const [selectedScenario, setSelectedScenario] = useState<ScenarioKey>('normal');
  const [currentDemand, setCurrentDemand] = useState(10); // Start at 10 TPS
  const [leftFee, setLeftFee] = useState(CHAINS.ethereum.baseFee);
  const [aptosFee, setAptosFee] = useState(APTOS.baseFee);
  const [leftPeakFee, setLeftPeakFee] = useState(CHAINS.ethereum.baseFee);
  const [aptosPeakFee, setAptosPeakFee] = useState(APTOS.baseFee);
  const [leftFailedPct, setLeftFailedPct] = useState(0);
  const [isOverCapacity, setIsOverCapacity] = useState(false);
  const [utilizationPct, setUtilizationPct] = useState(0);
  const [leftLatency, setLeftLatency] = useState({ latency: 12, unit: 's' });
  const [aptosLatencyState, setAptosLatencyState] = useState({ latency: 900, unit: 'ms' });
  const [leftYAxisLabels, setLeftYAxisLabels] = useState<string[]>(['$0.05', '$0.03', '$0.01', '$0.007']);
  const [rightYAxisLabels, setRightYAxisLabels] = useState<string[]>(['$0.0007', '$0.0006', '$0.0004', '$0.0003']);

  const isVisible = useVisibility(containerRef);
  const isPlayingRef = useRef(true);
  const selectedChainRef = useRef<ChainKey>('ethereum');
  const selectedScenarioRef = useRef<ScenarioKey>('normal');

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    selectedScenarioRef.current = selectedScenario;
    // Reset data when scenario changes
    leftDataRef.current = [];
    rightDataRef.current = [];
    setLeftPeakFee(CHAINS[selectedChainRef.current].baseFee);
    setAptosPeakFee(APTOS.baseFee);
    setLeftFailedPct(0);
    setIsOverCapacity(false);
    setUtilizationPct(0);
  }, [selectedScenario]);

  useEffect(() => {
    selectedChainRef.current = selectedChain;
    // Reset data when chain changes
    leftDataRef.current = [];
    rightDataRef.current = [];
    prevChainFeeRef.current = CHAINS[selectedChain].baseFee;
    setLeftPeakFee(CHAINS[selectedChain].baseFee);
    setAptosPeakFee(APTOS.baseFee);
    setLeftFailedPct(0);
    setIsOverCapacity(false);
    setUtilizationPct(0);
    // Reset latency to base for selected chain
    const baseLatency = calculateLatency(selectedChain, SCENARIOS[selectedScenarioRef.current].demand.min);
    setLeftLatency(baseLatency);
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
        return 0;
      case 'ramp': {
        const rampProgress = (progress - phases.ramp.start) / (phases.ramp.end - phases.ramp.start);
        return easings.easeOutQuad(rampProgress) * 0.5;
      }
      case 'spike': {
        const spikeProgress = (progress - phases.spike.start) / (phases.spike.end - phases.spike.start);
        // Quick ramp up, sustained peak, then start decay
        if (spikeProgress < 0.2) {
          return 0.5 + easings.easeOutQuad(spikeProgress / 0.2) * 0.5;
        } else if (spikeProgress < 0.7) {
          // Sustained peak with oscillation
          const oscillation = Math.sin(spikeProgress * Math.PI * 6) * 0.05;
          return 0.95 + oscillation;
        } else {
          return 0.95 - easings.easeInQuad((spikeProgress - 0.7) / 0.3) * 0.25;
        }
      }
      case 'recovery': {
        const recoveryProgress = (progress - phases.recovery.start) / (phases.recovery.end - phases.recovery.start);
        return 0.7 * (1 - easings.easeOutQuad(recoveryProgress));
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

    // Calculate values using selected scenario
    const scenario = SCENARIOS[selectedScenarioRef.current];
    const intensity = calculateIntensity(progress);
    const demand = Math.round(lerp(scenario.demand.min, scenario.demand.max, intensity));

    // Calculate fees using realistic chain-specific models
    const chainFee = calculateChainFee(
      selectedChainRef.current,
      intensity,
      elapsed,
      prevChainFeeRef.current
    );
    prevChainFeeRef.current = chainFee; // Store for Monad's variance-aware calc

    // Calculate Aptos fee with contention and capacity pressure
    const aptFee = calculateAptosFee(
      elapsed,
      prevAptosFeeRef.current,
      intensity,
      scenario.aptosContention,
      demand
    );
    prevAptosFeeRef.current = aptFee;

    // Calculate failure rate using realistic model
    const failureRate = calculateFailureRate(selectedChainRef.current, demand);

    // Store data points
    leftDataRef.current.push({ time: elapsed, fee: chainFee });
    rightDataRef.current.push({ time: elapsed, fee: aptFee });
    if (leftDataRef.current.length > 200) leftDataRef.current.shift();
    if (rightDataRef.current.length > 200) rightDataRef.current.shift();

    // Throttle state updates
    if (now - lastStateUpdateRef.current > CONFIG.stateUpdateInterval) {
      lastStateUpdateRef.current = now;
      setCurrentDemand(demand);
      setLeftFee(chainFee);
      setAptosFee(aptFee);
      setLeftPeakFee(prev => Math.max(prev, chainFee));
      setAptosPeakFee(prev => Math.max(prev, aptFee));
      setLeftFailedPct(Math.round(failureRate * 100));

      // Track congestion status
      const congestionStatus = isChainCongested(selectedChainRef.current, demand);
      setIsOverCapacity(congestionStatus.overCapacity);
      setUtilizationPct(Math.round(congestionStatus.utilizationPct));

      // Calculate latency for both chains
      const latencyData = calculateLatency(selectedChainRef.current, demand);
      setLeftLatency(latencyData);
      const aptosLatencyData = calculateAptosLatency(demand);
      setAptosLatencyState(aptosLatencyData);

      // Update dynamic Y-axis labels based on actual data
      if (leftDataRef.current.length > 10) {
        const leftFees = leftDataRef.current.map(d => d.fee);
        const leftMin = Math.min(...leftFees);
        const leftMax = Math.max(...leftFees);
        const leftPadding = (leftMax - leftMin) * 0.1 || leftMin * 0.5;
        const leftRange = { min: Math.max(0, leftMin - leftPadding), max: leftMax + leftPadding };
        const newLeftLabels = [
          formatYAxisLabel(leftRange.max),
          formatYAxisLabel(leftRange.min + (leftRange.max - leftRange.min) * 0.67),
          formatYAxisLabel(leftRange.min + (leftRange.max - leftRange.min) * 0.33),
          formatYAxisLabel(leftRange.min),
        ];
        setLeftYAxisLabels(newLeftLabels);
      }

      // Fixed Y-axis labels for Aptos to show stability (zoomed out view)
      const currentScenario = SCENARIOS[selectedScenarioRef.current];
      const rightYMax = currentScenario.aptosContention > 0.2 ? 0.015 : 0.01;
      const newRightLabels = [
        formatYAxisLabel(rightYMax),
        formatYAxisLabel(rightYMax * 0.67),
        formatYAxisLabel(rightYMax * 0.33),
        '$0',
      ];
      setRightYAxisLabels(newRightLabels);
    }

    // Layout calculations
    const margin = 20;
    const demandMeterHeight = 50;
    const demandMeterY = 10;
    const chartTop = demandMeterY + demandMeterHeight + 15;
    const capacityHeight = 70;
    const chartHeight = height - chartTop - capacityHeight - 30;
    const halfWidth = width / 2;
    const chartWidth = halfWidth - margin * 2 - 10;
    const capacityY = chartTop + chartHeight + 20;

    // Draw background
    const bg = graphicsRef.current.background;
    if (bg) {
      bg.clear();
      bg.rect(0, 0, width, height);
      bg.fill({ color: 0x0a0a0b });

      // Subtle grid pattern
      bg.setStrokeStyle({ width: 1, color: 0x1f2937, alpha: 0.15 });
      for (let y = 0; y < height; y += 20) {
        bg.moveTo(0, y);
        bg.lineTo(width, y);
      }
      bg.stroke();
    }

    // Draw demand meter
    const demandMeter = graphicsRef.current.demandMeter;
    if (demandMeter) {
      demandMeter.clear();

      // Background
      demandMeter.roundRect(margin, demandMeterY, width - margin * 2, demandMeterHeight, 8);
      demandMeter.fill({ color: 0x1f2937, alpha: 0.5 });
      demandMeter.stroke({ width: 1, color: 0x374151 });

      // Progress bar background - bar starts after label area
      const labelAreaWidth = 150; // Reserve space for label
      const barX = margin + labelAreaWidth;
      const barWidth = width - margin * 2 - labelAreaWidth - 10;
      const barY = demandMeterY + 25;
      const barHeight = 16;

      demandMeter.roundRect(barX, barY, barWidth, barHeight, 4);
      demandMeter.fill({ color: 0x0d1117 });
      demandMeter.stroke({ width: 1, color: 0x374151 });

      // Progress fill
      const fillWidth = (demand / scenario.demand.max) * barWidth;
      const barColor = intensity > 0.7 ? PIXI_COLORS.danger : intensity > 0.4 ? 0xfbbf24 : PIXI_COLORS.primary;
      demandMeter.roundRect(barX, barY, fillWidth, barHeight, 4);
      demandMeter.fill({ color: barColor, alpha: 0.8 });

      // Glow effect at high intensity
      if (intensity > 0.5) {
        demandMeter.roundRect(barX - 2, barY - 2, fillWidth + 4, barHeight + 4, 6);
        demandMeter.stroke({ width: 2, color: barColor, alpha: (intensity - 0.5) * 0.6 });
      }
    }

    // Draw divider
    const divider = graphicsRef.current.divider;
    if (divider) {
      divider.clear();
      divider.setStrokeStyle({ width: 2, color: 0x374151 });
      divider.moveTo(halfWidth, chartTop - 5);
      divider.lineTo(halfWidth, chartTop + chartHeight + 5);
      divider.stroke();

      // VS badge
      const vsY = chartTop + chartHeight / 2;
      divider.circle(halfWidth, vsY, 18);
      divider.fill({ color: 0x1f2937 });
      divider.stroke({ width: 2, color: 0x4b5563 });
    }

    // Draw LEFT chart (selected chain)
    const leftChart = graphicsRef.current.leftChart;
    if (leftChart && leftDataRef.current.length >= 1) {
      leftChart.clear();
      const points = leftDataRef.current;

      // Chart background with danger glow when spiking
      leftChart.roundRect(margin, chartTop, chartWidth, chartHeight, 8);
      leftChart.fill({ color: 0x0d1117, alpha: 0.95 });

      const borderColor = intensity > 0.5 ? PIXI_COLORS.danger : chain.color;
      leftChart.stroke({ width: 2, color: borderColor, alpha: intensity > 0.5 ? 0.8 : 0.5 });

      // Danger glow at high intensity
      if (intensity > 0.5) {
        leftChart.roundRect(margin - 3, chartTop - 3, chartWidth + 6, chartHeight + 6, 10);
        leftChart.stroke({ width: 3, color: PIXI_COLORS.danger, alpha: (intensity - 0.5) * 0.4 });
      }

      // Calculate actual data range for proper scaling
      const fees = points.map(p => p.fee);
      const dataMin = Math.min(...fees);
      const dataMax = Math.max(...fees);
      const padding = (dataMax - dataMin) * 0.1 || dataMin * 0.2;
      const yMin = Math.max(0, dataMin - padding);
      const yMax = dataMax + padding;

      // Draw chart area
      const chartInnerX = margin + 60;
      const chartInnerWidth = chartWidth - 70;
      const chartInnerTop = chartTop + 40;
      const chartInnerHeight = chartHeight - 55;

      // Grid lines
      leftChart.setStrokeStyle({ width: 1, color: 0x374151, alpha: 0.3 });
      for (let i = 0; i <= 3; i++) {
        const y = chartInnerTop + (chartInnerHeight / 3) * i;
        leftChart.moveTo(chartInnerX, y);
        leftChart.lineTo(chartInnerX + chartInnerWidth, y);
      }
      leftChart.stroke();

      // Draw line and area
      const areaColor = intensity > 0.5 ? PIXI_COLORS.danger : chain.color;

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
      leftChart.fill({ color: areaColor, alpha: 0.15 });

      // Line
      leftChart.setStrokeStyle({ width: 2, color: areaColor });
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

      if (intensity > 0.5) {
        const pulse = Math.sin(elapsed * 0.01) * 0.3 + 0.7;
        leftChart.circle(currentX, currentY, 10 * pulse);
        leftChart.fill({ color: PIXI_COLORS.danger, alpha: 0.2 });
      }
      leftChart.circle(currentX, currentY, 4);
      leftChart.fill({ color: areaColor });
    }

    // Draw RIGHT chart (Aptos - always stable)
    const rightChart = graphicsRef.current.rightChart;
    if (rightChart && rightDataRef.current.length >= 1) {
      rightChart.clear();
      const points = rightDataRef.current;

      // Chart background with success glow
      rightChart.roundRect(halfWidth + margin, chartTop, chartWidth, chartHeight, 8);
      rightChart.fill({ color: 0x0d1117, alpha: 0.95 });
      rightChart.stroke({ width: 2, color: APTOS.color, alpha: 0.5 });

      // Subtle success glow
      rightChart.roundRect(halfWidth + margin - 2, chartTop - 2, chartWidth + 4, chartHeight + 4, 10);
      rightChart.stroke({ width: 2, color: APTOS.color, alpha: 0.15 });

      // Fixed wider Y-axis scale for Aptos to show stability
      // Range from $0 to $0.01 so small variations look appropriately flat
      // In extreme mode, extend to $0.015 to accommodate higher fees
      const scenario = SCENARIOS[selectedScenarioRef.current];
      const aptosYMin = 0;
      const aptosYMax = scenario.aptosContention > 0.2 ? 0.015 : 0.01; // Wider view to show stability

      // Draw chart area
      const chartInnerX = halfWidth + margin + 60;
      const chartInnerWidth = chartWidth - 70;
      const chartInnerTop = chartTop + 40;
      const chartInnerHeight = chartHeight - 55;

      // Grid lines
      rightChart.setStrokeStyle({ width: 1, color: 0x374151, alpha: 0.3 });
      for (let i = 0; i <= 3; i++) {
        const y = chartInnerTop + (chartInnerHeight / 3) * i;
        rightChart.moveTo(chartInnerX, y);
        rightChart.lineTo(chartInnerX + chartInnerWidth, y);
      }
      rightChart.stroke();

      // Stable zone highlight (middle of chart)
      const stableZoneTop = chartInnerTop + chartInnerHeight * 0.35;
      const stableZoneHeight = chartInnerHeight * 0.3;
      rightChart.rect(chartInnerX, stableZoneTop, chartInnerWidth, stableZoneHeight);
      rightChart.fill({ color: APTOS.color, alpha: 0.08 });

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
      rightChart.fill({ color: APTOS.color, alpha: 0.15 });

      // Line
      rightChart.setStrokeStyle({ width: 2, color: APTOS.color });
      for (let i = 0; i < points.length; i++) {
        const xRatio = i / Math.max(1, points.length - 1);
        const yRatio = aptosYMax > aptosYMin ? (points[i].fee - aptosYMin) / (aptosYMax - aptosYMin) : 0.5;
        const x = chartInnerX + xRatio * chartInnerWidth;
        const y = chartInnerTop + chartInnerHeight - Math.max(0, Math.min(1, yRatio)) * chartInnerHeight;
        if (i === 0) rightChart.moveTo(x, y);
        else rightChart.lineTo(x, y);
      }
      rightChart.stroke();

      // Current point
      const lastFee = points[points.length - 1].fee;
      const lastYRatio = aptosYMax > aptosYMin ? (lastFee - aptosYMin) / (aptosYMax - aptosYMin) : 0.5;
      const currentX = chartInnerX + chartInnerWidth;
      const currentY = chartInnerTop + chartInnerHeight - Math.max(0, Math.min(1, lastYRatio)) * chartInnerHeight;

      rightChart.circle(currentX, currentY, 4);
      rightChart.fill({ color: APTOS.color });
    }

    // Draw capacity comparison at bottom
    const capacity = graphicsRef.current.capacity;
    if (capacity) {
      capacity.clear();

      // Background panel
      capacity.roundRect(margin, capacityY, width - margin * 2, capacityHeight, 8);
      capacity.fill({ color: 0x1f2937, alpha: 0.3 });
      capacity.stroke({ width: 1, color: 0x374151 });

      const barStartX = margin + 140;
      const barWidth = (width - margin * 2 - 160) / 2 - 20;
      const barHeight = 14;

      // Left chain capacity bar
      const leftBarY = capacityY + 18;
      capacity.roundRect(barStartX, leftBarY, barWidth, barHeight, 4);
      capacity.fill({ color: 0x0d1117 });

      // Calculate how much of capacity is used
      const leftCapacityUsed = Math.min(1, demand / chain.capacity);
      const leftFillWidth = leftCapacityUsed * barWidth;
      const leftBarColor = leftCapacityUsed > 0.8 ? PIXI_COLORS.danger : chain.color;
      capacity.roundRect(barStartX, leftBarY, leftFillWidth, barHeight, 4);
      capacity.fill({ color: leftBarColor, alpha: 0.8 });

      // Right (Aptos) capacity bar
      const rightBarY = capacityY + 42;
      capacity.roundRect(barStartX, rightBarY, barWidth, barHeight, 4);
      capacity.fill({ color: 0x0d1117 });

      const aptosCapacityUsed = Math.min(1, demand / APTOS.currentCapacity);
      const aptosFillWidth = aptosCapacityUsed * barWidth;
      capacity.roundRect(barStartX, rightBarY, aptosFillWidth, barHeight, 4);
      capacity.fill({ color: APTOS.color, alpha: 0.8 });
    }

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

  const handlePlayPause = () => {
    const newState = !isPlaying;
    setIsPlaying(newState);
    if (newState) {
      startTimeRef.current = performance.now();
      leftDataRef.current = [];
      rightDataRef.current = [];
    }
  };

  const handleRestart = () => {
    startTimeRef.current = performance.now();
    leftDataRef.current = [];
    rightDataRef.current = [];
    setLeftPeakFee(CHAINS[selectedChain].baseFee);
    setAptosPeakFee(APTOS.baseFee);
    setLeftFailedPct(0);
    setIsOverCapacity(false);
    setUtilizationPct(0);
    setIsPlaying(true);
  };

  const chain = CHAINS[selectedChain];

  return (
    <div className={`chrome-card p-4 sm:p-6 ${className || ""}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-title">Fee Comparison: Same Load</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePlayPause}
            className="px-3 py-1 text-sm rounded border transition-colors hover:bg-white/5"
            style={{ borderColor: "var(--chrome-700)", color: "var(--chrome-300)" }}
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button
            onClick={handleRestart}
            className="px-3 py-1 text-sm rounded border transition-colors hover:bg-white/5"
            style={{ borderColor: "var(--chrome-700)", color: "var(--chrome-300)" }}
          >
            Restart
          </button>
        </div>
      </div>

      {/* Scenario Selector */}
      <div className="flex flex-wrap gap-2 mb-3">
        <span className="text-xs text-gray-500 self-center mr-2">Load Scenario:</span>
        {(Object.keys(SCENARIOS) as ScenarioKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setSelectedScenario(key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              selectedScenario === key
                ? 'ring-2 ring-offset-1 ring-offset-black'
                : 'opacity-60 hover:opacity-100'
            }`}
            style={{
              backgroundColor: selectedScenario === key
                ? key === 'extreme' ? 'rgba(239, 68, 68, 0.2)' : key === 'stress' ? 'rgba(251, 191, 36, 0.2)' : 'rgba(0, 217, 165, 0.2)'
                : 'rgba(0,0,0,0.2)',
              color: key === 'extreme' ? '#ef4444' : key === 'stress' ? '#fbbf24' : '#00D9A5',
              border: `1px solid ${key === 'extreme' ? '#ef4444' : key === 'stress' ? '#fbbf24' : '#00D9A5'}40`,
              ...(selectedScenario === key ? {
                boxShadow: `0 0 12px ${key === 'extreme' ? 'rgba(239, 68, 68, 0.3)' : key === 'stress' ? 'rgba(251, 191, 36, 0.3)' : 'rgba(0, 217, 165, 0.3)'}`,
              } : {}),
            }}
          >
            {SCENARIOS[key].name}
          </button>
        ))}
        <span className="text-xs text-gray-500 self-center ml-2">
          {SCENARIOS[selectedScenario].description}
        </span>
      </div>

      {/* Chain Selector */}
      <div className="flex gap-2 mb-4">
        {(Object.keys(CHAINS) as ChainKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setSelectedChain(key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              selectedChain === key
                ? 'ring-2 ring-offset-2 ring-offset-black'
                : 'opacity-60 hover:opacity-100'
            }`}
            style={{
              backgroundColor: `rgba(${selectedChain === key ? '255,255,255' : '0,0,0'}, 0.1)`,
              color: `#${CHAINS[key].color.toString(16).padStart(6, '0')}`,
              borderColor: `#${CHAINS[key].color.toString(16).padStart(6, '0')}`,
              border: '1px solid',
              ...(selectedChain === key ? {
                boxShadow: `0 0 12px rgba(${parseInt(CHAINS[key].color.toString(16).padStart(6, '0').slice(0,2), 16)}, ${parseInt(CHAINS[key].color.toString(16).padStart(6, '0').slice(2,4), 16)}, ${parseInt(CHAINS[key].color.toString(16).padStart(6, '0').slice(4,6), 16)}, 0.3)`,
                ringColor: `#${CHAINS[key].color.toString(16).padStart(6, '0')}`,
              } : {}),
            }}
          >
            {CHAINS[key].name}
          </button>
        ))}
        <span className="flex items-center px-3 text-sm text-gray-500">vs</span>
        <div
          className="px-4 py-2 text-sm font-medium rounded-lg ring-2 ring-offset-2 ring-offset-black"
          style={{
            backgroundColor: 'rgba(0,217,165,0.1)',
            color: '#00D9A5',
            border: '1px solid #00D9A5',
            boxShadow: '0 0 12px rgba(0,217,165,0.3)',
          }}
        >
          Aptos
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div
          className="p-4 rounded-lg border relative overflow-hidden"
          style={{
            backgroundColor: isOverCapacity ? 'rgba(239, 68, 68, 0.15)' : leftFailedPct > 10 ? 'rgba(239, 68, 68, 0.1)' : `rgba(${parseInt(chain.color.toString(16).padStart(6, '0').slice(0,2), 16)}, ${parseInt(chain.color.toString(16).padStart(6, '0').slice(2,4), 16)}, ${parseInt(chain.color.toString(16).padStart(6, '0').slice(4,6), 16)}, 0.08)`,
            borderColor: isOverCapacity ? 'rgba(239, 68, 68, 0.6)' : leftFailedPct > 10 ? 'rgba(239, 68, 68, 0.3)' : `#${chain.color.toString(16).padStart(6, '0')}40`,
          }}
        >
          {/* Over capacity warning banner */}
          {isOverCapacity && (
            <div
              className="absolute top-0 left-0 right-0 text-center py-1 text-xs font-bold animate-pulse"
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.9)', color: 'white' }}
            >
              ⚠️ OVER CAPACITY ({utilizationPct}%) - TXs FAILING
            </div>
          )}
          <div className={`flex justify-between items-start mb-2 ${isOverCapacity ? 'mt-6' : ''}`}>
            <span className="text-xs" style={{ color: isOverCapacity ? '#ef4444' : `#${chain.color.toString(16).padStart(6, '0')}` }}>
              {chain.name} ({chain.capacity.toLocaleString()} TPS{selectedChain === 'solana' ? ' theoretical' : ' max'})
            </span>
            {leftFailedPct > 0 && (
              <span
                className="text-xs px-2 py-0.5 rounded font-bold"
                style={{
                  backgroundColor: leftFailedPct > 50 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(239, 68, 68, 0.2)',
                  color: '#ef4444',
                  animation: leftFailedPct > 30 ? 'pulse 1s infinite' : 'none'
                }}
              >
                {leftFailedPct}% FAILED
              </span>
            )}
          </div>
          <div className="text-2xl font-bold mb-1" style={{ color: isOverCapacity || leftFailedPct > 10 ? '#ef4444' : '#ffffff' }}>
            {formatFee(leftFee)}
          </div>
          <div className="flex justify-between text-xs" style={{ color: 'var(--chrome-500)' }}>
            <span>Peak: {formatFee(leftPeakFee)}</span>
            <span style={{ color: leftLatency.latency > 30 ? '#ef4444' : leftLatency.latency > 10 ? '#fbbf24' : '#9ca3af' }}>
              ⏱ {leftLatency.latency.toFixed(1)}{leftLatency.unit}
            </span>
          </div>
        </div>
        <div
          className="p-4 rounded-lg border relative overflow-hidden"
          style={{
            backgroundColor: selectedScenario === 'extreme' && aptosFee > 0.002
              ? 'rgba(251, 191, 36, 0.1)'
              : 'rgba(0, 217, 165, 0.08)',
            borderColor: selectedScenario === 'extreme' && aptosFee > 0.002
              ? 'rgba(251, 191, 36, 0.4)'
              : 'rgba(0, 217, 165, 0.3)',
          }}
        >
          {/* Contention indicator for stress/extreme scenarios */}
          {selectedScenario !== 'normal' && SCENARIOS[selectedScenario].aptosContention > 0 && (
            <div
              className="absolute top-0 left-0 right-0 text-center py-0.5 text-xs"
              style={{
                backgroundColor: selectedScenario === 'extreme' ? 'rgba(251, 191, 36, 0.3)' : 'rgba(251, 191, 36, 0.2)',
                color: '#fbbf24',
              }}
            >
              {selectedScenario === 'extreme' ? '⚡ High Contention + Near Capacity' : '⚡ Some Contention'}
            </div>
          )}
          <div className={`flex justify-between items-start mb-2 ${selectedScenario !== 'normal' ? 'mt-5' : ''}`}>
            <span className="text-xs" style={{ color: 'var(--accent)' }}>
              Aptos ({APTOS.currentCapacity.toLocaleString()} TPS)
            </span>
            <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(0, 217, 165, 0.2)', color: '#00D9A5' }}>
              0% failed
            </span>
          </div>
          <div className="text-2xl font-bold mb-1" style={{ color: '#ffffff' }}>
            {formatFee(aptosFee)}
          </div>
          <div className="flex justify-between text-xs" style={{ color: 'var(--chrome-500)' }}>
            <span>Peak: {formatFee(aptosPeakFee)}</span>
            <span style={{ color: '#00D9A5' }}>
              ⏱ {aptosLatencyState.latency}{aptosLatencyState.unit}
            </span>
          </div>
          {/* Show utilization in extreme mode */}
          {selectedScenario === 'extreme' && (
            <div className="mt-2 pt-2 border-t border-white/10 text-xs" style={{ color: 'var(--chrome-400)' }}>
              Utilization: {((currentDemand / APTOS.currentCapacity) * 100).toFixed(1)}%
              {currentDemand > APTOS.currentCapacity * 0.8 && (
                <span className="ml-2" style={{ color: '#fbbf24' }}>
                  (fee pressure building)
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Canvas with HTML overlays for text (avoids PixiJS TexturePool bugs) */}
      <div
        ref={containerRef}
        className="canvas-wrap relative rounded-lg overflow-hidden"
        style={{ height: "420px", backgroundColor: "#0a0a0b", border: "1px solid #333" }}
      >
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center flex-col gap-2">
            <div className="text-sm" style={{ color: "var(--chrome-500)" }}>
              Loading visualization...
            </div>
            <div className="text-xs" style={{ color: "var(--chrome-600)" }}>
              (PixiJS initializing)
            </div>
          </div>
        )}

        {/* HTML Text Overlays */}
        {isReady && (
          <>
            {/* Demand meter label */}
            <div className="absolute text-xs font-bold text-white pointer-events-none" style={{ top: 27, left: 35 }}>
              DEMAND: {currentDemand.toLocaleString()} TPS
            </div>

            {/* Left chart title & subtitle */}
            <div
              className="absolute text-xs font-bold pointer-events-none"
              style={{ top: 80, left: 28, color: `#${chain.color.toString(16).padStart(6, '0')}` }}
            >
              {chain.name.toUpperCase()}
            </div>
            <div className="absolute pointer-events-none" style={{ top: 94, left: 28, color: '#9ca3af', fontSize: '9px' }}>
              {chain.subtitle}
            </div>

            {/* Left Y-axis labels (4 labels matching grid lines) */}
            {leftYAxisLabels.map((label, i) => (
              <div
                key={`left-y-${i}`}
                className="absolute pointer-events-none text-right"
                style={{
                  top: 115 + i * 63,
                  left: 22,
                  width: 50,
                  color: '#6b7280',
                  fontSize: '10px',
                }}
              >
                {label}
              </div>
            ))}

            {/* Right chart title & subtitle */}
            <div
              className="absolute text-xs font-bold pointer-events-none"
              style={{ top: 80, left: 'calc(50% + 28px)', color: '#00D9A5' }}
            >
              APTOS
            </div>
            <div className="absolute pointer-events-none" style={{ top: 94, left: 'calc(50% + 28px)', color: '#9ca3af', fontSize: '9px' }}>
              {APTOS.subtitle}
            </div>

            {/* Right Y-axis labels (4 labels matching grid lines) */}
            {rightYAxisLabels.map((label, i) => (
              <div
                key={`right-y-${i}`}
                className="absolute pointer-events-none text-right"
                style={{
                  top: 115 + i * 63,
                  left: 'calc(50% + 22px)',
                  width: 55,
                  color: '#6b7280',
                  fontSize: '10px',
                }}
              >
                {label}
              </div>
            ))}

            {/* Current price labels on charts */}
            <div
              className="absolute pointer-events-none font-bold px-2 py-1 rounded"
              style={{
                top: 115,
                right: 'calc(50% + 25px)',
                backgroundColor: 'rgba(0,0,0,0.8)',
                border: `1px solid #${chain.color.toString(16).padStart(6, '0')}`,
                color: `#${chain.color.toString(16).padStart(6, '0')}`,
                fontSize: '11px',
              }}
            >
              {formatFee(leftFee)}
            </div>
            <div
              className="absolute pointer-events-none font-bold px-2 py-1 rounded"
              style={{
                top: 280,
                right: 25,
                backgroundColor: 'rgba(0,0,0,0.8)',
                border: '1px solid #00D9A5',
                color: '#00D9A5',
                fontSize: '11px',
              }}
            >
              {formatFee(aptosFee)}
            </div>

            {/* VS badge */}
            <div
              className="absolute text-xs font-bold pointer-events-none"
              style={{ top: '55%', left: '50%', transform: 'translate(-50%, -50%)', color: '#6b7280' }}
            >
              VS
            </div>

            {/* Capacity section */}
            <div className="absolute pointer-events-none" style={{ bottom: 48, left: 35, color: '#9ca3af', fontSize: '10px' }}>
              {chain.name}: {chain.capacity.toLocaleString()} TPS capacity
            </div>
            <div
              className="absolute pointer-events-none font-bold"
              style={{
                bottom: 48,
                left: 190,
                fontSize: '10px',
                color: utilizationPct > 100 ? '#ef4444' : utilizationPct > 80 ? '#fbbf24' : '#9ca3af',
                animation: utilizationPct > 100 ? 'pulse 0.5s infinite' : 'none'
              }}
            >
              {utilizationPct > 100
                ? `🔥 ${utilizationPct}% OVERLOADED!`
                : utilizationPct > 80
                ? `⚠️ ${utilizationPct}% congested`
                : `${utilizationPct}% used`}
            </div>
            <div className="absolute pointer-events-none" style={{ bottom: 28, left: 35, color: '#9ca3af', fontSize: '10px' }}>
              Aptos: {APTOS.currentCapacity.toLocaleString()} TPS capacity
            </div>
            <div className="absolute pointer-events-none" style={{ bottom: 28, left: 190, color: '#00D9A5', fontSize: '10px' }}>
              ✓ {Math.max(0.1, (currentDemand / APTOS.currentCapacity) * 100).toFixed(1)}% used
            </div>
          </>
        )}
      </div>

      {/* Detailed Chain Comparison */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {/* Left chain details */}
        <div
          className="p-3 rounded-lg"
          style={{
            backgroundColor: `rgba(${parseInt(chain.color.toString(16).padStart(6, '0').slice(0,2), 16)}, ${parseInt(chain.color.toString(16).padStart(6, '0').slice(2,4), 16)}, ${parseInt(chain.color.toString(16).padStart(6, '0').slice(4,6), 16)}, 0.08)`,
            border: `1px solid rgba(${parseInt(chain.color.toString(16).padStart(6, '0').slice(0,2), 16)}, ${parseInt(chain.color.toString(16).padStart(6, '0').slice(2,4), 16)}, ${parseInt(chain.color.toString(16).padStart(6, '0').slice(4,6), 16)}, 0.2)`,
          }}
        >
          <p className="text-xs font-bold mb-2" style={{ color: `#${chain.color.toString(16).padStart(6, '0')}` }}>
            {chain.name} Fee Model
          </p>
          <p className="text-xs mb-2" style={{ color: 'var(--chrome-400)' }}>
            {chain.feeModel}
          </p>
          <p className="text-xs" style={{ color: 'var(--chrome-500)' }}>
            <strong style={{ color: 'var(--chrome-400)' }}>Mechanism:</strong> {chain.mechanism}
          </p>
          <div className="mt-2 pt-2 border-t border-white/10 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span style={{ color: 'var(--chrome-500)' }}>Capacity:</span>
              <span className="ml-1" style={{ color: 'var(--chrome-300)' }}>{chain.capacity.toLocaleString()} TPS</span>
            </div>
            <div>
              <span style={{ color: 'var(--chrome-500)' }}>Base Latency:</span>
              <span className="ml-1" style={{ color: 'var(--chrome-300)' }}>{chain.baseLatency >= 1000 ? `${chain.baseLatency/1000}s` : `${chain.baseLatency}ms`}</span>
            </div>
          </div>
        </div>

        {/* Aptos details */}
        <div
          className="p-3 rounded-lg"
          style={{
            backgroundColor: 'rgba(0, 217, 165, 0.08)',
            border: '1px solid rgba(0, 217, 165, 0.2)',
          }}
        >
          <p className="text-xs font-bold mb-2" style={{ color: '#00D9A5' }}>
            Aptos Fee Model
          </p>
          <p className="text-xs mb-2" style={{ color: 'var(--chrome-400)' }}>
            {APTOS.feeModel}
          </p>
          <p className="text-xs" style={{ color: 'var(--chrome-500)' }}>
            <strong style={{ color: 'var(--chrome-400)' }}>Mechanism:</strong> {APTOS.mechanism}
          </p>
          <div className="mt-2 pt-2 border-t border-white/10 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span style={{ color: 'var(--chrome-500)' }}>Capacity:</span>
              <span className="ml-1" style={{ color: '#00D9A5' }}>{APTOS.currentCapacity.toLocaleString()} TPS</span>
            </div>
            <div>
              <span style={{ color: 'var(--chrome-500)' }}>Base Latency:</span>
              <span className="ml-1" style={{ color: '#00D9A5' }}>{APTOS.baseLatency}ms</span>
            </div>
          </div>
        </div>
      </div>

      {/* Key Insight */}
      <div className="mt-3 p-3 rounded-lg" style={{
        backgroundColor: selectedScenario === 'extreme' ? 'rgba(251, 191, 36, 0.05)' : 'rgba(0, 217, 165, 0.05)',
        border: `1px solid ${selectedScenario === 'extreme' ? 'rgba(251, 191, 36, 0.2)' : 'rgba(0, 217, 165, 0.1)'}`
      }}>
        <p className="text-xs" style={{ color: 'var(--chrome-400)' }}>
          {selectedScenario === 'extreme' ? (
            <>
              <strong style={{ color: '#fbbf24' }}>Extreme Load Insight:</strong>{' '}
              Even at 150k TPS (94% of capacity) with contentious state access, Aptos fees only rise to ~$0.003-$0.006.
              Compare this to {chain.name} which would have {chain.capacity < 1000 ? '100% failure rate' : 'massive fee spikes'} at this load.
              Block-STM's optimistic execution means even contentious transactions complete - they just use slightly more gas from re-execution.
            </>
          ) : selectedScenario === 'stress' ? (
            <>
              <strong style={{ color: '#fbbf24' }}>Stress Test Insight:</strong>{' '}
              At 50k TPS (31% capacity), Aptos fees stay at ~$0.0005-$0.001 even with some contention.
              {chain.name} at 50k TPS demand = {Math.round((50000 / chain.capacity) * 100)}% of capacity = {chain.capacity < 50000 ? 'complete failure' : 'heavy congestion'}.
            </>
          ) : (
            <>
              <strong style={{ color: '#00D9A5' }}>Key Insight:</strong>{' '}
              {selectedChain === 'solana' && 'Solana\'s 65k TPS is theoretical - real-world is 4-10k sustained. More importantly, LOCAL FEE MARKETS mean fees spike on hot accounts (DEXs, mints) even at low total TPS. Aptos parallelizes ALL transactions via Block-STM, avoiding hot-spot congestion.'}
              {selectedChain === 'monad' && 'Monad\'s variance-aware controller limits fee changes to 3.6%/block. Aptos doesn\'t need fee dampening because capacity (160k TPS) always exceeds demand.'}
              {selectedChain === 'sui' && 'Sui validators vote on gas price each epoch. Aptos governance sets a floor price, but the real difference is Block-STM enabling 160k+ TPS vs theoretical limits.'}
              {selectedChain === 'ethereum' && 'Ethereum EIP-1559 base fee can double every ~13 seconds when full. At 15 TPS vs Aptos 160,000 TPS, Ethereum is 10,000x more likely to congest.'}
              {selectedChain === 'polygon' && 'Polygon inherits EIP-1559 but with only 35 TPS practical capacity. Polymarket\'s election night (33.8 TPS) hit the ceiling. Aptos would use 0.02% capacity.'}
            </>
          )}
        </p>
      </div>

      {/* Understanding Fee Mechanisms */}
      <details className="mt-3">
        <summary className="text-xs font-bold cursor-pointer" style={{ color: 'var(--chrome-400)' }}>
          Why do fees behave so differently?
        </summary>
        <div className="mt-2 p-3 rounded-lg text-xs space-y-3" style={{ backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid var(--chrome-700)' }}>
          {selectedChain === 'solana' && (
            <>
              <div>
                <strong style={{ color: '#14F195' }}>Why Solana fees spike (even at low TPS):</strong>
                <p style={{ color: 'var(--chrome-400)' }}>Solana's 65k TPS is theoretical. Real-world sustained is 4-10k TPS. But more importantly, Solana uses <strong>local fee markets per account</strong>. When many users interact with the same program (DEX, NFT mint), they bid against each other. This creates "hot spots" where fees spike 1000x+ while other accounts remain cheap - <strong>regardless of total network TPS</strong>.</p>
              </div>
              <div>
                <strong style={{ color: '#14F195' }}>The "hot account" problem:</strong>
                <p style={{ color: 'var(--chrome-400)' }}>During the TRUMP memecoin launch (Jan 2025), priority fees spiked to $0.50+ per transaction on Raydium/Jupiter - even though total network TPS was only ~4,000. The bottleneck was the specific DEX accounts, not total throughput.</p>
              </div>
              <div>
                <strong style={{ color: '#00D9A5' }}>Why Aptos doesn't have this problem:</strong>
                <p style={{ color: 'var(--chrome-400)' }}>Aptos uses <strong>Block-STM</strong> which parallelizes ALL transactions optimistically. There are no per-account bottlenecks - every transaction gets executed in parallel, then conflicts are re-executed. No bidding wars, no hot spots.</p>
              </div>
            </>
          )}
          {selectedChain === 'monad' && (
            <>
              <div>
                <strong style={{ color: '#836EF9' }}>Why Monad fees stay low:</strong>
                <p style={{ color: 'var(--chrome-400)' }}>Monad uses <strong>variance-aware EIP-1559</strong>. When fees fluctuate wildly, the controller tightens adjustments (max 3.6%/block). This prevents sudden spikes but means fees take many blocks to reach market-clearing prices.</p>
              </div>
              <div>
                <strong style={{ color: '#14F195' }}>Why this differs from Solana:</strong>
                <p style={{ color: 'var(--chrome-400)' }}>Solana's priority fee auction responds instantly to demand. Monad's dampened controller smooths volatility but can't react quickly. Different tradeoffs - Monad prioritizes UX predictability.</p>
              </div>
              <div>
                <strong style={{ color: '#00D9A5' }}>Why Aptos is different:</strong>
                <p style={{ color: 'var(--chrome-400)' }}>Aptos doesn't need fee dampening because <strong>capacity (160k TPS) always exceeds demand</strong>. When you're never congested, fees naturally stay at the governance floor ($0.0005).</p>
              </div>
            </>
          )}
          {selectedChain === 'ethereum' && (
            <>
              <div>
                <strong style={{ color: '#627EEA' }}>Why Ethereum fees explode:</strong>
                <p style={{ color: 'var(--chrome-400)' }}>EIP-1559 base fee increases 12.5% every block when utilization exceeds 50%. At 15 TPS capacity, even moderate demand (30 TPS) causes fees to <strong>double every ~2 minutes</strong> until users are priced out.</p>
              </div>
              <div>
                <strong style={{ color: '#00D9A5' }}>Why Aptos stays stable:</strong>
                <p style={{ color: 'var(--chrome-400)' }}>At 160,000 TPS, even 500 TPS demand = 0.3% utilization. Aptos never triggers congestion pricing because there's always 99%+ spare capacity. Fees stay at governance floor.</p>
              </div>
            </>
          )}
          {selectedChain === 'polygon' && (
            <>
              <div>
                <strong style={{ color: '#8247E5' }}>Why Polygon struggled (Election Night):</strong>
                <p style={{ color: 'var(--chrome-400)' }}>Polygon's practical capacity is ~35 TPS. Polymarket hit 33.8 TPS on Nov 5, 2024 = <strong>97% utilization</strong>. At this level, 7% of transactions failed. Polymarket is building their own L2 due to reliability issues.</p>
              </div>
              <div>
                <strong style={{ color: '#00D9A5' }}>If Aptos handled election night:</strong>
                <p style={{ color: 'var(--chrome-400)' }}>33.8 TPS = 0.02% of Aptos capacity. Zero congestion, zero failures, fees stay at $0.0005. Aptos could handle <strong>4,700x more</strong> before even noticing.</p>
              </div>
            </>
          )}
          {selectedChain === 'sui' && (
            <>
              <div>
                <strong style={{ color: '#6FBCF0' }}>How Sui pricing works:</strong>
                <p style={{ color: 'var(--chrome-400)' }}>Validators vote on a "reference gas price" each epoch (~24h). Local congestion can occur per-object (similar to Solana per-account), but epoch-level price smooths volatility.</p>
              </div>
              <div>
                <strong style={{ color: '#00D9A5' }}>How Aptos pricing works:</strong>
                <p style={{ color: 'var(--chrome-400)' }}><strong>Aptos Gas Formula:</strong> fee = gas_used × gas_unit_price. Gas unit price has a governance-set minimum (~100 octas = $0.0005). Block-STM parallelization means no per-account bottlenecks.</p>
              </div>
            </>
          )}

          {/* Aptos Gas Model Explained */}
          <div className="mt-3 pt-3 border-t border-white/10">
            <strong style={{ color: '#00D9A5' }}>Aptos Gas Model (Simple):</strong>
            <div className="mt-2 p-2 rounded font-mono text-xs" style={{ backgroundColor: 'rgba(0,217,165,0.1)', color: 'var(--chrome-300)' }}>
              fee = gas_used × gas_unit_price<br/>
              <span style={{ color: 'var(--chrome-500)' }}>where:</span><br/>
              • gas_used = compute resources (varies by tx complexity)<br/>
              • gas_unit_price = min 100 octas (~$0.0000005)<br/>
              • typical simple tx: 1000 gas × 100 octas = $0.0005
            </div>
            <p className="mt-2" style={{ color: 'var(--chrome-500)' }}>
              Unlike auction-based systems, Aptos fees only increase if gas_unit_price rises above the floor (rare) or if your transaction uses more compute. No bidding wars.
            </p>
          </div>
        </div>
      </details>
    </div>
  );
});
