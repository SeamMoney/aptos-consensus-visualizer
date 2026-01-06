"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useNetwork, Network } from "@/contexts/NetworkContext";

export interface GasPriceStats {
  min: number;
  max: number;
  median: number;
  count: number;
}

export interface BlockStats {
  blockHeight: number;
  txCount: number;
  timestamp: number;
  blockTimeMs: number;
  gasUsed: number;
  gasStats?: GasPriceStats;
  proposer?: string;
  round?: number;
  epoch?: number;
  votesBitvec?: string;
  failedProposers?: number[];
}

export interface ValidatorInfo {
  address: string;
  votingPower: number;
  successfulProposals: number;
  failedProposals: number;
  proposalRate: number;
  isActive: boolean;
  lastProposedBlock?: number;
}

export interface ValidatorVote {
  index: number;
  voted: boolean;
  address?: string;
  votingPower?: number;
}

export interface ConsensusStats {
  epoch: number;
  round: number;
  totalValidators: number;
  activeValidators: number;
  totalVotingPower: number;
  currentProposer: string;
  validators: ValidatorInfo[];
  recentProposers: string[];
  voteParticipation: number;
  validatorVotes: ValidatorVote[];  // Individual votes per validator
}

export interface AptosStats {
  blockHeight: number;
  tps: number;
  avgBlockTime: number;
  recentBlocks: BlockStats[];
  consensus: ConsensusStats | null;
}

// Fetch block with transactions
async function fetchBlock(apiBase: string, network: Network, height: number) {
  const res = await fetch(
    `${apiBase}/block?network=${network}&height=${height}`,
    { cache: "no-store" }
  );
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("Retry-After") || "30");
    throw new RateLimitError(retryAfter);
  }
  if (!res.ok) return null;
  return res.json();
}

// Custom error for rate limiting
class RateLimitError extends Error {
  retryAfter: number;
  constructor(retryAfter: number) {
    super('Rate limited');
    this.retryAfter = retryAfter;
  }
}

// Fetch ledger info
async function fetchLedgerInfo(apiBase: string, network: Network) {
  const res = await fetch(`${apiBase}/ledger?network=${network}`, {
    cache: "no-store",
  });
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("Retry-After") || "30");
    throw new RateLimitError(retryAfter);
  }
  if (!res.ok) return null;
  return res.json();
}

// Fetch validator set for current epoch
async function fetchValidatorSet(apiBase: string, network: Network) {
  const res = await fetch(`${apiBase}/validators?network=${network}`, {
    cache: "no-store",
  });
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("Retry-After") || "30");
    throw new RateLimitError(retryAfter);
  }
  if (!res.ok) return null;
  return res.json();
}

// Parse block metadata and gas stats from transactions
function parseBlockMetadata(block: any): Partial<BlockStats> {
  const metadata: Partial<BlockStats> = {};
  const gasPrices: number[] = [];

  if (block.transactions) {
    for (const tx of block.transactions) {
      if (tx.type === 'block_metadata_transaction') {
        metadata.proposer = tx.proposer;
        metadata.round = parseInt(tx.round || '0');
        metadata.epoch = parseInt(tx.epoch || '0');
        metadata.votesBitvec = tx.previous_block_votes_bitvec;
        metadata.failedProposers = tx.failed_proposer_indices?.map((i: string) => parseInt(i)) || [];
      }
      // Extract gas prices from user transactions
      if (tx.type === 'user_transaction' && tx.gas_unit_price) {
        gasPrices.push(parseInt(tx.gas_unit_price));
      }
    }
  }

  // Calculate gas price stats if we have user transactions
  if (gasPrices.length > 0) {
    const sorted = [...gasPrices].sort((a, b) => a - b);
    metadata.gasStats = {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      median: sorted[Math.floor(sorted.length / 2)],
      count: gasPrices.length,
    };
  }

  return metadata;
}

// Parse vote bitvec into individual validator votes
function parseVoteBitvec(bitvec: string, validators: ValidatorInfo[]): { participation: number; votes: ValidatorVote[] } {
  const votes: ValidatorVote[] = [];
  const totalValidators = validators.length || 138;

  // If no bitvec, not a string, or no validators, assume all voted (can't show accurate data)
  if (!bitvec || typeof bitvec !== 'string' || validators.length === 0) {
    for (let i = 0; i < totalValidators; i++) {
      votes.push({
        index: i,
        voted: true, // Assume voted when no data
        address: validators[i]?.address,
        votingPower: validators[i]?.votingPower,
      });
    }
    return { participation: 100, votes };
  }

  try {
    // Remove 0x prefix if present
    const hexStr = bitvec.startsWith('0x') ? bitvec.slice(2) : bitvec;
    let voteCount = 0;

    // Parse each validator's vote from the bitvec
    // The bitvec is ordered by validator index
    for (let i = 0; i < totalValidators; i++) {
      // Each byte covers 8 validators
      const byteIndex = Math.floor(i / 8);
      const bitIndex = i % 8;

      // Get the hex byte (2 chars per byte)
      const hexByteStart = byteIndex * 2;
      if (hexByteStart + 2 > hexStr.length) {
        // Bitvec too short - assume voted
        votes.push({
          index: i,
          voted: true,
          address: validators[i]?.address,
          votingPower: validators[i]?.votingPower,
        });
        voteCount++;
        continue;
      }

      const hexByte = hexStr.slice(hexByteStart, hexByteStart + 2);
      const byteVal = parseInt(hexByte, 16);

      // Check if this validator's bit is set (LSB first within each byte)
      const voted = ((byteVal >> bitIndex) & 1) === 1;
      if (voted) voteCount++;

      votes.push({
        index: i,
        voted,
        address: validators[i]?.address,
        votingPower: validators[i]?.votingPower,
      });
    }

    const participation = Math.round((voteCount / totalValidators) * 100);
    return { participation, votes };
  } catch (e) {
    console.error('Vote bitvec parsing error:', e);
    // On error, assume all voted
    for (let i = 0; i < totalValidators; i++) {
      votes.push({
        index: i,
        voted: true,
        address: validators[i]?.address,
        votingPower: validators[i]?.votingPower,
      });
    }
    return { participation: 100, votes };
  }
}

export function useAptosStream() {
  const { network, apiBase, wsEndpoints } = useNetwork();

  const [stats, setStats] = useState<AptosStats>({
    blockHeight: 0,
    tps: 0,
    avgBlockTime: 94,
    recentBlocks: [],
    consensus: null,
  });
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastBlockRef = useRef<number>(0);
  const blocksRef = useRef<BlockStats[]>([]);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const validatorsRef = useRef<ValidatorInfo[]>([]);
  const lastValidatorFetchRef = useRef<number>(0);
  const recentProposersRef = useRef<string[]>([]);

  const defaultPollMs = parseInt(process.env.NEXT_PUBLIC_APTOS_POLL_MS || "300");

  // Error recovery refs
  const errorCountRef = useRef<number>(0);
  const lastSuccessTimeRef = useRef<number>(Date.now());
  const isPollingRef = useRef<boolean>(false);
  const rateLimitedUntilRef = useRef<number>(0);
  const baseIntervalRef = useRef<number>(defaultPollMs);

  // Generation counter to prevent stale polls from rescheduling after network change
  const pollGenerationRef = useRef<number>(0);

  // Calculate stats from blocks
  const updateStats = useCallback(() => {
    if (blocksRef.current.length === 0) return;

    const recentBlocks = blocksRef.current.slice(0, 20);
    let tps = 0;
    if (recentBlocks.length >= 2) {
      const totalTx = recentBlocks.reduce((sum, b) => sum + b.txCount, 0);
      const timeSpanMs = recentBlocks[0].timestamp - recentBlocks[recentBlocks.length - 1].timestamp;
      if (timeSpanMs > 0) {
        tps = Math.round((totalTx / timeSpanMs) * 1000);
      }
    }

    const avgBlockTime = recentBlocks.length > 0
      ? Math.round(recentBlocks.reduce((sum, b) => sum + b.blockTimeMs, 0) / recentBlocks.length)
      : 94;

    const latestBlock = blocksRef.current[0];
    const totalValidators = validatorsRef.current.length || 138;
    const activeValidators = validatorsRef.current.filter(v => v.isActive).length;
    const totalVotingPower = validatorsRef.current.reduce((sum, v) => sum + v.votingPower, 0);

    // Parse vote bitvec into individual votes
    const { participation: voteParticipation, votes: validatorVotes } = parseVoteBitvec(
      latestBlock?.votesBitvec || '',
      validatorsRef.current
    );

    const consensus: ConsensusStats | null = latestBlock?.epoch ? {
      epoch: latestBlock.epoch,
      round: latestBlock.round || 0,
      totalValidators,
      activeValidators,
      totalVotingPower,
      currentProposer: latestBlock.proposer || '',
      validators: validatorsRef.current,
      recentProposers: recentProposersRef.current.slice(0, 10),
      voteParticipation,
      validatorVotes,
    } : null;

    setStats({
      blockHeight: blocksRef.current[0]?.blockHeight || 0,
      tps,
      avgBlockTime,
      recentBlocks: blocksRef.current.slice(0, 30),
      consensus,
    });
  }, []);

  // Add a new block to the list
  const addBlock = useCallback((block: BlockStats) => {
    // Avoid duplicates
    if (blocksRef.current.some(b => b.blockHeight === block.blockHeight)) return;

    blocksRef.current = [block, ...blocksRef.current]
      .sort((a, b) => b.blockHeight - a.blockHeight)
      .slice(0, 50);

    // Track recent proposers
    if (block.proposer) {
      recentProposersRef.current = [
        block.proposer,
        ...recentProposersRef.current.filter(p => p !== block.proposer)
      ].slice(0, 20);

      // Update validator's last proposed block
      const validator = validatorsRef.current.find(v => v.address === block.proposer);
      if (validator) {
        validator.lastProposedBlock = block.blockHeight;
      }
    }

    lastBlockRef.current = Math.max(lastBlockRef.current, block.blockHeight);
    updateStats();
  }, [updateStats]);

  // Fetch and update validator set (called on a separate timer, not every poll)
  const fetchValidators = useCallback(async () => {
    const now = Date.now();
    // Only fetch every 60 seconds to reduce API calls
    if (now - lastValidatorFetchRef.current < 60000) return;
    // Don't fetch if rate limited
    if (now < rateLimitedUntilRef.current) return;

    try {
      const validatorSet = await fetchValidatorSet(apiBase, network);
      if (!validatorSet?.data?.active_validators) return;

      const validators: ValidatorInfo[] = validatorSet.data.active_validators.map((v: any) => ({
        address: v.addr,
        votingPower: parseInt(v.voting_power || '0'),
        successfulProposals: parseInt(v.config?.validator_index || '0'),
        failedProposals: 0,
        proposalRate: 100,
        isActive: true,
      }));

      validatorsRef.current = validators;
      lastValidatorFetchRef.current = now;
    } catch (e) {
      if (e instanceof RateLimitError) {
        rateLimitedUntilRef.current = Date.now() + e.retryAfter * 1000;
      }
      // Silently ignore validator fetch errors - not critical
    }
  }, [apiBase, network]);

  // Polling with rate limit handling
  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) return;
    if (isPollingRef.current) return;

    // Capture generation at start - if it changes, this poll session is stale
    const myGeneration = pollGenerationRef.current;

    const poll = async () => {
      // Check if this poll session is stale (network changed)
      if (pollGenerationRef.current !== myGeneration) {
        return; // Don't continue - a new poll session will start
      }
      // Prevent concurrent polls
      if (isPollingRef.current) return;

      // Check if we're rate limited
      const now = Date.now();
      if (now < rateLimitedUntilRef.current) {
        const waitTime = Math.ceil((rateLimitedUntilRef.current - now) / 1000);
        setError(`Rate limited. Retrying in ${waitTime}s...`);
        return;
      }

      isPollingRef.current = true;

      try {
        const ledger = await fetchLedgerInfo(apiBase, network);
        if (!ledger) {
          throw new Error('Failed to fetch ledger info');
        }

        const currentHeight = parseInt(ledger.block_height);

        // Initial load or catch up
        if (lastBlockRef.current === 0) {
          // Fetch smaller initial batch (5 blocks) to reduce API calls
          const heights = Array.from({ length: 5 }, (_, i) => currentHeight - i);
          try {
            const blocks = await Promise.all(heights.map(h => fetchBlock(apiBase, network, h)));

          for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i];
            if (!block) continue;

            const height = heights[i];
            const timestamp = parseInt(block.block_timestamp) / 1000;
            const txCount = block.transactions?.length || 0;

            // Find previous block for timing
            let blockTimeMs = 94;
            const prevIdx = blocks.findIndex((b, j) => j > i && b);
            if (prevIdx > -1 && blocks[prevIdx]) {
              const prevTs = parseInt(blocks[prevIdx].block_timestamp) / 1000;
              blockTimeMs = Math.max(1, timestamp - prevTs);
            }

            // Parse block metadata (proposer, round, epoch, votes)
            const metadata = parseBlockMetadata(block);

            addBlock({
              blockHeight: height,
              txCount,
              timestamp,
              blockTimeMs,
              gasUsed: 0,
              ...metadata,
            });
          }

          lastBlockRef.current = currentHeight;
          } catch (blockFetchError) {
            console.error(`[AptosStream] Error fetching initial blocks:`, blockFetchError);
          }
        }

        // Fetch all new blocks since last poll (limit to 15 to handle ~100ms block times)
        if (currentHeight > lastBlockRef.current) {
          const newCount = Math.min(currentHeight - lastBlockRef.current, 15);
          const heights = Array.from({ length: newCount }, (_, i) => currentHeight - i);
          const blocks = await Promise.all(heights.map(h => fetchBlock(apiBase, network, h)));

          for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i];
            if (!block) continue;

            const height = heights[i];
            const timestamp = parseInt(block.block_timestamp) / 1000;
            const txCount = block.transactions?.length || 0;

            // Calculate block time
            let blockTimeMs = 94;
            const prevBlock = blocksRef.current.find(b => b.blockHeight === height - 1);
            if (prevBlock) {
              blockTimeMs = Math.max(1, timestamp - prevBlock.timestamp);
            }

            // Parse block metadata (proposer, round, epoch, votes)
            const metadata = parseBlockMetadata(block);

            addBlock({
              blockHeight: height,
              txCount,
              timestamp,
              blockTimeMs,
              gasUsed: 0,
              ...metadata,
            });
          }

          lastBlockRef.current = currentHeight;
        }

        // Success! Reset error state and reduce interval
        errorCountRef.current = 0;
        lastSuccessTimeRef.current = Date.now();
        baseIntervalRef.current = defaultPollMs;
        setConnected(true);
        setError(null);

        // Fetch validators after successful connection (throttled internally)
        fetchValidators();

      } catch (e) {
        // Handle rate limiting specially
        if (e instanceof RateLimitError) {
          const waitMs = e.retryAfter * 1000;
          rateLimitedUntilRef.current = Date.now() + waitMs;
          baseIntervalRef.current = Math.max(baseIntervalRef.current, 2000); // At least 2s between polls
          // Don't immediately disconnect on rate limit - only if we have no recent data
          const hasRecentData = blocksRef.current.length > 0 &&
            (Date.now() - lastSuccessTimeRef.current) < 10000;
          if (!hasRecentData) {
            setConnected(false);
            setError(`Rate limited. Waiting ${e.retryAfter}s...`);
          }
        } else {
          console.error('Poll error:', e);
          errorCountRef.current++;

          // After 3 consecutive errors, mark as disconnected
          if (errorCountRef.current >= 3) {
            setConnected(false);
            setError('Connection issues. Retrying...');
          }

          // Exponential backoff on errors (max 10 seconds)
          baseIntervalRef.current = Math.min(baseIntervalRef.current * 1.5, 10000);
        }
      } finally {
        isPollingRef.current = false;
      }
    };

    // Start polling with adaptive interval
    const runPoll = () => {
      poll().then(() => {
        // Don't reschedule if generation changed (network switch)
        if (pollGenerationRef.current !== myGeneration) {
          return;
        }
        // Schedule next poll with current interval
        pollIntervalRef.current = setTimeout(runPoll, baseIntervalRef.current);
      });
    };

    // Initial poll after short delay
    pollIntervalRef.current = setTimeout(runPoll, 500);

    // Stale data check every 5 seconds
    const staleCheckInterval = setInterval(() => {
      const timeSinceLastSuccess = Date.now() - lastSuccessTimeRef.current;
      if (timeSinceLastSuccess > 15000 && Date.now() >= rateLimitedUntilRef.current) {
        setError('Data may be stale. Reconnecting...');
      }
    }, 5000);

    return () => {
      clearInterval(staleCheckInterval);
    };
  }, [addBlock, fetchValidators, apiBase, network, defaultPollMs]);

  // WebSocket connection disabled - Aptos public endpoints don't support WebSocket reliably
  // Polling works well and is more reliable
  const connectWebSocket = useCallback(() => {
    // No-op - WebSocket endpoints not available
  }, []);

  // Main polling effect - restarts whenever network/apiBase changes
  useEffect(() => {
    // Increment generation to invalidate any stale polls from previous network
    pollGenerationRef.current++;

    // Reset all refs for fresh start
    lastBlockRef.current = 0;
    blocksRef.current = [];
    validatorsRef.current = [];
    lastValidatorFetchRef.current = 0;
    recentProposersRef.current = [];
    errorCountRef.current = 0;
    lastSuccessTimeRef.current = Date.now();
    isPollingRef.current = false;
    rateLimitedUntilRef.current = 0;
    baseIntervalRef.current = defaultPollMs;

    // Reset stats state but keep connected true briefly to avoid flash
    setStats({
      blockHeight: 0,
      tps: 0,
      avgBlockTime: 94,
      recentBlocks: [],
      consensus: null,
    });
    // Don't immediately set disconnected - give polling a chance to connect
    setError(null);

    // Small delay to ensure clean state before starting
    const startTimeout = setTimeout(() => {
      // Start fast polling immediately (most reliable)
      startPolling();

      // Also try WebSocket for even faster updates
      connectWebSocket();
    }, 100);

    return () => {
      clearTimeout(startTimeout);
      if (pollIntervalRef.current) {
        clearTimeout(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      isPollingRef.current = false;
      rateLimitedUntilRef.current = 0;
      baseIntervalRef.current = defaultPollMs;
    };
  }, [network, startPolling, connectWebSocket]);

  return { stats, connected, error, network };
}
