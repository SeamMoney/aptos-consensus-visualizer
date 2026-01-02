"use client";

import { memo, useEffect, useRef, useState } from "react";
import { formatNumber, lerp, easings } from "@/lib/pixi-utils";

interface OrderbookStressProps {
  className?: string;
}

const CONFIG = {
  duration: 24000, // 24 second cycle
  maxTPS: 500000, // 500K TPS with all upgrades
  minTPS: 100, // Start VERY slow
  levels: 6,
  lanes: 64,
};

interface OrderLevel {
  price: number;
  size: number;
  total: number;
}

interface Trade {
  id: number;
  price: number;
  size: number;
  side: "buy" | "sell";
  time: number;
}

export const OrderbookStress = memo(function OrderbookStress({
  className,
}: OrderbookStressProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [phase, setPhase] = useState("IDLE");
  const [tps, setTps] = useState(CONFIG.minTPS);
  const [latency, setLatency] = useState(25);
  const [activeThreads, setActiveThreads] = useState(1);
  const [bids, setBids] = useState<OrderLevel[]>([]);
  const [asks, setAsks] = useState<OrderLevel[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [laneActivity, setLaneActivity] = useState<number[]>(Array(CONFIG.lanes).fill(0));

  const bidSizesRef = useRef<number[]>([]);
  const askSizesRef = useRef<number[]>([]);
  const startTimeRef = useRef(performance.now());
  const tradeIdRef = useRef(0);
  const frameRef = useRef<number | undefined>(undefined);
  const lastUpdateRef = useRef(0);
  const lastTradeRef = useRef(0);
  const smoothLatencyRef = useRef(10); // For smooth latency transitions

  // Initialize orderbook
  useEffect(() => {
    const midPrice = 0.50; // 50 cents = 50% probability
    const initBids: OrderLevel[] = [];
    const initAsks: OrderLevel[] = [];
    const initBidSizes: number[] = [];
    const initAskSizes: number[] = [];
    let bidTotal = 0;
    let askTotal = 0;

    for (let i = 0; i < CONFIG.levels; i++) {
      const bidSize = Math.round(150000 - i * 15000 + Math.random() * 50000);
      const askSize = Math.round(140000 - i * 12000 + Math.random() * 45000);
      bidTotal += bidSize;
      askTotal += askSize;

      initBidSizes.push(bidSize);
      initAskSizes.push(askSize);

      initBids.push({ price: midPrice - 0.01 - i * 0.01, size: bidSize, total: bidTotal });
      initAsks.push({ price: midPrice + 0.01 + i * 0.01, size: askSize, total: askTotal });
    }

    bidSizesRef.current = initBidSizes;
    askSizesRef.current = initAskSizes;
    setBids(initBids);
    setAsks(initAsks);
  }, []);

  // Animation loop
  useEffect(() => {
    if (!isPlaying) return;

    const animate = () => {
      const now = performance.now();
      const elapsed = now - startTimeRef.current;
      const progress = (elapsed % CONFIG.duration) / CONFIG.duration;

      // Throttle to ~30fps
      const shouldUpdateState = now - lastUpdateRef.current > 33;

      // DRAMATIC phase transitions: 100 TPS -> 10K -> 100K -> back down
      let intensity: number;
      let phaseName: string;

      if (progress < 0.30) {
        // IDLE - 100 TPS, barely moving (30% of cycle = 7.2s)
        intensity = 0.001 + easings.easeOutQuad(progress / 0.30) * 0.009;
        phaseName = "IDLE";
      } else if (progress < 0.38) {
        // SURGE to 10K (8% of cycle = 2s)
        const surgeProgress = (progress - 0.30) / 0.08;
        intensity = 0.01 + easings.easeInQuad(surgeProgress) * 0.09;
        phaseName = "RAMPING";
      } else if (progress < 0.48) {
        // Hold at ~10K briefly (10% = 2.4s)
        intensity = 0.1 + Math.sin((progress - 0.38) * Math.PI * 4) * 0.02;
        phaseName = "10K TPS";
      } else if (progress < 0.55) {
        // EXPLODE to 100K+ (7% = 1.7s)
        const explodeProgress = (progress - 0.48) / 0.07;
        intensity = 0.1 + easings.easeInQuad(explodeProgress) * 0.9;
        phaseName = "SURGE";
      } else if (progress < 0.80) {
        // PEAK CHAOS at 500K TPS (25% = 6s) - FULL INTENSITY
        intensity = 0.95 + Math.sin((progress - 0.55) * Math.PI * 6) * 0.05;
        phaseName = "PEAK LOAD";
      } else {
        // COOLDOWN back to idle (20% = 4.8s)
        const coolProgress = (progress - 0.80) / 0.20;
        intensity = 1.0 - easings.easeOutQuad(coolProgress) * 0.999;
        phaseName = "COOLING";
      }

      // Calculate TPS based on intensity (logarithmic feel)
      const currentTps = Math.round(CONFIG.minTPS + (CONFIG.maxTPS - CONFIG.minTPS) * intensity);

      if (shouldUpdateState) {
        lastUpdateRef.current = now;

        // Latency: scales with load - hits 100-150ms at 500K TPS
        const targetLatency = 10 + intensity * 145; // 10ms idle → 155ms at peak
        // Faster interpolation so we actually reach the target
        smoothLatencyRef.current = smoothLatencyRef.current + (targetLatency - smoothLatencyRef.current) * 0.25;
        const currentLatency = Math.round(smoothLatencyRef.current);

        // Threads scale with intensity
        const threads = Math.max(1, Math.floor(intensity * 64));

        setTps(currentTps);
        setLatency(Math.max(10, Math.min(160, currentLatency))); // Allow up to 160ms
        setActiveThreads(threads);
        setPhase(phaseName);

        // Orderbook volatility scales DRAMATICALLY with intensity
        // At idle: barely moves. At peak: wild swings
        const volatility = intensity < 0.01
          ? 2000  // Idle: tiny changes
          : intensity < 0.1
            ? 8000  // 10K TPS: moderate
            : 15000 + intensity * 35000; // Peak: massive swings up to 50K

        const newBidSizes = bidSizesRef.current.map((size, i) => {
          // More volatility at top of book
          const positionMultiplier = 1 + (CONFIG.levels - i) * 0.15;
          const change = (Math.random() - 0.5) * volatility * positionMultiplier;
          return Math.max(20000, Math.min(250000, size + change));
        });
        bidSizesRef.current = newBidSizes;

        const newAskSizes = askSizesRef.current.map((size, i) => {
          const positionMultiplier = 1 + (CONFIG.levels - i) * 0.15;
          const change = (Math.random() - 0.5) * volatility * positionMultiplier * 0.95;
          return Math.max(15000, Math.min(240000, size + change));
        });
        askSizesRef.current = newAskSizes;

        // Dynamic mid-price based on market sentiment
        const marketSentiment = Math.sin(now / 5000) * 0.12; // Slow drift ±12c
        const midPrice = 0.50 + marketSentiment;

        let bidTotal = 0;
        const newBids = newBidSizes.map((size, i) => {
          bidTotal += size;
          const price = midPrice - 0.01 - i * 0.01; // Tighter spread: 1c levels
          return { price: parseFloat(price.toFixed(2)), size: Math.round(size), total: Math.round(bidTotal) };
        });

        let askTotal = 0;
        const newAsks = newAskSizes.map((size, i) => {
          askTotal += size;
          const price = midPrice + 0.01 + i * 0.01; // Tighter spread: 1c levels
          return { price: parseFloat(price.toFixed(2)), size: Math.round(size), total: Math.round(askTotal) };
        });

        setBids(newBids);
        setAsks(newAsks);

        // TRADES: frequency directly tied to TPS
        const tradeInterval = intensity < 0.01
          ? 2500  // Idle: 1 trade per 2.5 seconds
          : intensity < 0.1
            ? 300   // 10K: few per second
            : 40;   // Peak: rapid fire

        if (now - lastTradeRef.current > tradeInterval) {
          lastTradeRef.current = now;

          const isBuy = Math.random() > 0.5;

          // HUGE price variations - prediction market style (0.01 to 0.99)
          // Base around 50c but with big swings
          const marketSentiment = Math.sin(now / 5000) * 0.15; // Slow drift ±15c
          const volatilitySpike = intensity > 0.5 ? (Math.random() - 0.5) * 0.20 : 0; // ±10c at peak
          const basePrice = 0.50 + marketSentiment + volatilitySpike;

          // Trade at different levels based on activity
          const priceOffset = (Math.random() - 0.5) * (0.05 + intensity * 0.15);
          let tradePrice = basePrice + priceOffset;
          tradePrice = Math.max(0.35, Math.min(0.65, tradePrice)); // Keep 35c-65c range

          // WILDLY RANDOM sizes - pure chaos
          const roll = Math.random();
          let tradeSize: number;

          if (roll < 0.15) {
            // Tiny: $11 - $99
            tradeSize = 11 + Math.floor(Math.random() * 88);
          } else if (roll < 0.30) {
            // Small: $100 - $999
            tradeSize = 100 + Math.floor(Math.random() * 900);
          } else if (roll < 0.45) {
            // Medium-small: $1K - $9.9K
            tradeSize = 1000 + Math.floor(Math.random() * 9000);
          } else if (roll < 0.58) {
            // Medium: $10K - $99K
            tradeSize = 10000 + Math.floor(Math.random() * 90000);
          } else if (roll < 0.70) {
            // Large: $100K - $499K
            tradeSize = 100000 + Math.floor(Math.random() * 400000);
          } else if (roll < 0.82) {
            // Big: $500K - $1.5M
            tradeSize = 500000 + Math.floor(Math.random() * 1000000);
          } else if (roll < 0.92) {
            // Whale: $1.5M - $5M
            tradeSize = 1500000 + Math.floor(Math.random() * 3500000);
          } else {
            // Mega whale: $5M - $25M
            tradeSize = 5000000 + Math.floor(Math.random() * 20000000);
          }

          // Extra chaos multiplier
          tradeSize = Math.floor(tradeSize * (0.3 + Math.random() * 2.5));

          const newTrade: Trade = {
            id: tradeIdRef.current++,
            price: parseFloat(tradePrice.toFixed(2)),
            size: tradeSize,
            side: isBuy ? "buy" : "sell",
            time: now,
          };
          setTrades(prev => [newTrade, ...prev].slice(0, 8));
        }

        // LANES: proportional to TPS - always show SOME activity
        // Even at 100 TPS we should see occasional lane firing
        // At 500K TPS, most lanes should be constantly lit

        // Calculate fire chance based on current TPS directly
        const tpsRatio = currentTps / CONFIG.maxTPS; // 0.0002 at 100 TPS, 1.0 at 500K
        const baseFireChance = 0.03; // Always 3% minimum chance
        const scaledFireChance = baseFireChance + tpsRatio * 0.5; // Up to 53% at peak

        setLaneActivity(prev => {
          return prev.map((activity) => {
            // Decay existing activity
            if (activity > 0) {
              const decayRate = 0.1 + tpsRatio * 0.15; // Faster decay at high TPS for more flicker
              const newActivity = activity - decayRate;
              if (newActivity > 0) return newActivity;
            }

            // Fire new lanes based on TPS
            if (Math.random() < scaledFireChance) {
              return 0.7 + Math.random() * 0.3;
            }

            return 0;
          });
        });
      }

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [isPlaying]);

  // Fixed max so bars actually show visible size changes
  const maxSize = 220000;

  return (
    <div className={`chrome-card overflow-hidden ${className || ""}`}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="text-sm font-semibold" style={{ color: "var(--chrome-100)" }}>
            Live Orderbook Stress Test
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-mono px-2 py-0.5 rounded"
            style={{
              background: phase === "PEAK LOAD" ? "rgba(0,217,165,0.15)" :
                         phase === "SURGE" ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.05)",
              color: phase === "PEAK LOAD" ? "var(--accent)" :
                     phase === "SURGE" ? "#fbbf24" : "var(--chrome-400)"
            }}
          >
            {phase}
          </span>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-6 h-6 flex items-center justify-center rounded border border-white/10 hover:bg-white/5"
          >
            <span className="text-[10px]" style={{ color: "var(--chrome-300)" }}>
              {isPlaying ? "⏸" : "▶"}
            </span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="px-4 py-2 flex items-center gap-6 border-b border-white/5 bg-black/20">
        <div>
          <div className="text-[9px] uppercase tracking-wider" style={{ color: "var(--chrome-500)" }}>Throughput</div>
          <div className="text-base font-mono font-bold tabular-nums" style={{ color: "var(--accent)" }}>
            {formatNumber(tps)}<span className="text-[10px] font-normal ml-1" style={{ color: "var(--chrome-500)" }}>tx/s</span>
          </div>
        </div>
        <div className="w-px h-8 bg-white/5" />
        <div>
          <div className="text-[9px] uppercase tracking-wider" style={{ color: "var(--chrome-500)" }}>Latency</div>
          <div className="flex items-center gap-2">
            <div className="text-base font-mono font-bold tabular-nums transition-colors duration-300" style={{
              color: latency < 30 ? "#00d9a5" : latency < 70 ? "#fbbf24" : "#ef4444"
            }}>
              {latency}<span className="text-[10px] font-normal ml-1" style={{ color: "var(--chrome-500)" }}>ms</span>
            </div>
            {/* Latency gauge - 10ms to 150ms range */}
            <div className="flex items-end gap-0.5">
              {[0, 1, 2, 3, 4].map((i) => {
                const threshold = 15 + i * 30; // 15, 45, 75, 105, 135ms
                const isActive = latency >= threshold;
                const barColor = i < 2 ? "#00d9a5" : i < 4 ? "#fbbf24" : "#ef4444";
                return (
                  <div
                    key={i}
                    className="w-1.5 rounded-sm transition-all duration-300"
                    style={{
                      height: `${10 + i * 3}px`,
                      background: isActive ? barColor : "rgba(255,255,255,0.15)",
                      opacity: isActive ? 1 : 0.4
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
        <div className="w-px h-8 bg-white/5" />
        <div>
          <div className="text-[9px] uppercase tracking-wider" style={{ color: "var(--chrome-500)" }}>Threads</div>
          <div className="text-base font-mono font-bold tabular-nums" style={{ color: "var(--secondary)" }}>
            {activeThreads}<span className="text-[10px] font-normal" style={{ color: "var(--chrome-500)" }}>/64</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-4">
        {/* Orderbook */}
        <div className="rounded-lg border border-white/5 overflow-hidden" style={{ background: "rgba(0,0,0,0.3)" }}>
          <div className="grid grid-cols-3 text-[9px] uppercase tracking-wider py-2 px-3 border-b border-white/5" style={{ color: "var(--chrome-500)" }}>
            <div>Size</div>
            <div className="text-center">Price</div>
            <div className="text-right">Total</div>
          </div>

          {/* Asks */}
          <div className="divide-y divide-white/[0.02]">
            {asks.slice().reverse().map((level, i) => (
              <div key={`ask-${i}`} className="grid grid-cols-3 py-1.5 px-3 relative overflow-hidden">
                <div
                  className="absolute inset-y-0 right-0 transition-[width] duration-100 ease-out"
                  style={{
                    width: `${Math.min((level.size / maxSize) * 100, 100)}%`,
                    background: "linear-gradient(to left, rgba(239,68,68,0.4), rgba(239,68,68,0.08))"
                  }}
                />
                <div className="text-[11px] font-mono tabular-nums relative z-10" style={{ color: "var(--chrome-300)" }}>
                  {formatNumber(level.size)}
                </div>
                <div className="text-[11px] font-mono tabular-nums text-center relative z-10" style={{ color: "#ef4444" }}>
                  {(level.price * 100).toFixed(1)}¢
                </div>
                <div className="text-[11px] font-mono tabular-nums text-right relative z-10" style={{ color: "var(--chrome-400)" }}>
                  {formatNumber(level.total)}
                </div>
              </div>
            ))}
          </div>

          {/* Spread */}
          <div className="py-1.5 px-3 text-center border-y border-white/5" style={{ background: "rgba(255,255,255,0.02)" }}>
            <span className="text-[10px] font-mono" style={{ color: "var(--chrome-500)" }}>
              Spread: {(((asks[0]?.price || 0.51) - (bids[0]?.price || 0.49)) * 100).toFixed(1)}¢
            </span>
          </div>

          {/* Bids */}
          <div className="divide-y divide-white/[0.02]">
            {bids.map((level, i) => (
              <div key={`bid-${i}`} className="grid grid-cols-3 py-1.5 px-3 relative overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 transition-[width] duration-100 ease-out"
                  style={{
                    width: `${Math.min((level.size / maxSize) * 100, 100)}%`,
                    background: "linear-gradient(to right, rgba(0,217,165,0.4), rgba(0,217,165,0.08))"
                  }}
                />
                <div className="text-[11px] font-mono tabular-nums relative z-10" style={{ color: "var(--chrome-300)" }}>
                  {formatNumber(level.size)}
                </div>
                <div className="text-[11px] font-mono tabular-nums text-center relative z-10" style={{ color: "#00d9a5" }}>
                  {(level.price * 100).toFixed(1)}¢
                </div>
                <div className="text-[11px] font-mono tabular-nums text-right relative z-10" style={{ color: "var(--chrome-400)" }}>
                  {formatNumber(level.total)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trade Feed + Block-STM Lanes */}
        <div className="grid grid-cols-2 gap-3">
          {/* Trade Feed - fills entire height */}
          <div className="rounded-lg border border-white/5 overflow-hidden flex flex-col" style={{ background: "rgba(0,0,0,0.3)", minHeight: "200px" }}>
            <div className="text-[9px] uppercase tracking-wider py-2 px-3 border-b border-white/5" style={{ color: "var(--chrome-500)" }}>
              Recent Trades
            </div>
            <div className="flex-1 flex flex-col">
              {trades.slice(0, 8).map((trade) => (
                <div key={trade.id} className="flex items-center justify-between py-1.5 px-3 border-b border-white/[0.02]">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: trade.side === "buy" ? "#00d9a5" : "#ef4444" }}
                    />
                    <span
                      className="text-[10px] font-mono tabular-nums"
                      style={{ color: trade.side === "buy" ? "#00d9a5" : "#ef4444" }}
                    >
                      {(trade.price * 100).toFixed(1)}¢
                    </span>
                  </div>
                  <span className="text-[10px] font-mono tabular-nums" style={{ color: "var(--chrome-400)" }}>
                    {formatNumber(trade.size)}
                  </span>
                </div>
              ))}
              {trades.length === 0 && (
                <div className="flex-1 flex items-center justify-center">
                  <span className="text-[10px]" style={{ color: "var(--chrome-600)" }}>
                    Waiting for trades...
                  </span>
                </div>
              )}
              {/* Fill remaining space */}
              <div className="flex-1" />
            </div>
          </div>

          {/* Block-STM Lanes - 8x8 grid filling the box */}
          <div className="rounded-lg border border-white/5 overflow-hidden flex flex-col" style={{ background: "rgba(0,0,0,0.3)", minHeight: "200px" }}>
            <div className="flex items-center justify-between py-2 px-3 border-b border-white/5">
              <span className="text-[9px] uppercase tracking-wider" style={{ color: "var(--chrome-500)" }}>
                Block-STM Lanes
              </span>
              <span className="text-[10px] font-mono font-bold" style={{ color: "var(--accent)" }}>
                {laneActivity.filter(a => a > 0).length}/{CONFIG.lanes}
              </span>
            </div>
            <div className="flex-1 p-2">
              <div className="grid grid-cols-8 grid-rows-8 gap-1 h-full">
                {laneActivity.map((activity, i) => (
                  <div
                    key={i}
                    className="rounded-[3px] transition-all duration-100"
                    style={{
                      background: activity > 0
                        ? `rgba(0, 217, 165, ${0.4 + activity * 0.6})`
                        : "rgba(255,255,255,0.06)"
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-white/5 bg-black/20">
        <p className="text-[10px] leading-relaxed" style={{ color: "var(--chrome-500)" }}>
          <span style={{ color: "var(--accent)" }}>Block-STM</span> executes orderbook transactions in parallel across 64 threads.
          At 500K tx/s peak load — no congestion, no fee spikes, sub-second finality.
        </p>
      </div>
    </div>
  );
});
