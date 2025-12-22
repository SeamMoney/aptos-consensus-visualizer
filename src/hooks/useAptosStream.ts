"use client";

import { useEffect, useState, useRef, useCallback } from "react";

export interface BlockStats {
  blockHeight: number;
  txCount: number;
  timestamp: number;
  blockTimeMs: number;
  gasUsed: number;
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

// Aptos API with Geomi API key
const APTOS_API = "https://api.mainnet.aptoslabs.com/v1";
const API_KEY = "AG-PBRRDTVTGPEDATI1NHY3UANNUYSKBPJMA";
const AUTH_HEADER = { "Authorization": `Bearer ${API_KEY}` };

// Fetch block with transactions
async function fetchBlock(height: number) {
  const res = await fetch(
    `${APTOS_API}/blocks/by_height/${height}?with_transactions=true`,
    { headers: AUTH_HEADER, cache: 'no-store' }
  );
  if (!res.ok) return null;
  return res.json();
}

// Fetch ledger info
async function fetchLedgerInfo() {
  const res = await fetch(APTOS_API, {
    headers: AUTH_HEADER,
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return res.json();
}

// Fetch validator set for current epoch
async function fetchValidatorSet() {
  const res = await fetch(
    `${APTOS_API}/accounts/0x1/resource/0x1::stake::ValidatorSet`,
    { headers: AUTH_HEADER, cache: 'no-store' }
  );
  if (!res.ok) return null;
  return res.json();
}

// Fetch validator performance for an address
async function fetchValidatorPerformance(validatorAddr: string) {
  const res = await fetch(
    `${APTOS_API}/accounts/${validatorAddr}/resource/0x1::stake::ValidatorPerformance`,
    { headers: AUTH_HEADER, cache: 'no-store' }
  );
  if (!res.ok) return null;
  return res.json();
}

// Fetch current epoch stake pool info
async function fetchStakePool() {
  const res = await fetch(
    `${APTOS_API}/accounts/0x1/resource/0x1::stake::StakePool`,
    { headers: AUTH_HEADER, cache: 'no-store' }
  );
  if (!res.ok) return null;
  return res.json();
}

// Parse block metadata from transactions
function parseBlockMetadata(block: any): Partial<BlockStats> {
  const metadata: Partial<BlockStats> = {};

  if (block.transactions) {
    for (const tx of block.transactions) {
      if (tx.type === 'block_metadata_transaction') {
        metadata.proposer = tx.proposer;
        metadata.round = parseInt(tx.round || '0');
        metadata.epoch = parseInt(tx.epoch || '0');
        metadata.votesBitvec = tx.previous_block_votes_bitvec;
        metadata.failedProposers = tx.failed_proposer_indices?.map((i: string) => parseInt(i)) || [];
        break;
      }
    }
  }

  return metadata;
}

// Parse vote bitvec into individual validator votes
function parseVoteBitvec(bitvec: string, validators: ValidatorInfo[]): { participation: number; votes: ValidatorVote[] } {
  const votes: ValidatorVote[] = [];
  const totalValidators = validators.length || 138;

  // If no bitvec or no validators, assume all voted (can't show accurate data)
  if (!bitvec || validators.length === 0) {
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

  // Error recovery refs
  const errorCountRef = useRef<number>(0);
  const lastSuccessTimeRef = useRef<number>(Date.now());
  const isPollingRef = useRef<boolean>(false);

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

  // Fetch and update validator set (call less frequently)
  const fetchValidators = useCallback(async () => {
    const now = Date.now();
    // Only fetch every 30 seconds
    if (now - lastValidatorFetchRef.current < 30000) return;

    try {
      const validatorSet = await fetchValidatorSet();
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
      console.error('Validator fetch error:', e);
    }
  }, []);

  // Fast polling with API key (primary method - most reliable)
  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) return;
    if (isPollingRef.current) return;

    const poll = async () => {
      // Prevent concurrent polls
      if (isPollingRef.current) return;
      isPollingRef.current = true;

      try {
        // Fetch validators periodically
        fetchValidators();

        const ledger = await fetchLedgerInfo();
        if (!ledger) {
          throw new Error('Failed to fetch ledger info');
        }

        const currentHeight = parseInt(ledger.block_height);

        // Initial load or catch up
        if (lastBlockRef.current === 0) {
          // Fetch smaller initial batch (10 blocks instead of 30) for faster load
          const heights = Array.from({ length: 10 }, (_, i) => currentHeight - i);
          const blocks = await Promise.all(heights.map(h => fetchBlock(h)));

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
        }

        // Fetch only new blocks
        if (currentHeight > lastBlockRef.current) {
          const newCount = Math.min(currentHeight - lastBlockRef.current, 10);
          const heights = Array.from({ length: newCount }, (_, i) => currentHeight - i);
          const blocks = await Promise.all(heights.map(h => fetchBlock(h)));

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

        // Success! Reset error state
        errorCountRef.current = 0;
        lastSuccessTimeRef.current = Date.now();
        setConnected(true);
        setError(null);

      } catch (e) {
        console.error('Poll error:', e);
        errorCountRef.current++;

        // After 3 consecutive errors, mark as disconnected
        if (errorCountRef.current >= 3) {
          setConnected(false);
          setError('Connection lost. Retrying...');
        }

        // Exponential backoff on errors (max 5 seconds)
        const backoffMs = Math.min(errorCountRef.current * 500, 5000);
        await new Promise(r => setTimeout(r, backoffMs));
      } finally {
        isPollingRef.current = false;
      }
    };

    // Start polling
    poll();

    // Poll every 200ms (slightly slower for reliability)
    pollIntervalRef.current = setInterval(poll, 200);

    // Also check for stale data periodically
    const staleCheckInterval = setInterval(() => {
      const timeSinceLastSuccess = Date.now() - lastSuccessTimeRef.current;
      if (timeSinceLastSuccess > 10000) {
        // No successful update in 10 seconds
        setConnected(false);
        setError('Data may be stale. Reconnecting...');
      }
    }, 2000);

    // Store the stale check interval for cleanup
    return () => {
      clearInterval(staleCheckInterval);
    };
  }, [addBlock, fetchValidators]);

  // WebSocket connection (experimental - for true real-time)
  const connectWebSocket = useCallback(() => {
    // Try multiple WebSocket endpoints
    const wsEndpoints = [
      'wss://aptos.dorafactory.org/mainnet-ws/',
      'wss://fullnode.mainnet.aptoslabs.com/v1/stream',
    ];

    const tryConnect = (idx: number) => {
      if (idx >= wsEndpoints.length) {
        console.log('All WebSocket endpoints failed, using polling');
        return;
      }

      const ws = new WebSocket(wsEndpoints[idx]);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected to', wsEndpoints[idx]);

        // Try to subscribe to new blocks
        ws.send(JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "subscribe",
          params: ["newBlock"]
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WS message:', data);

          // Handle block notifications
          if (data.params?.result?.block_height) {
            const height = parseInt(data.params.result.block_height);
            // Fetch full block data
            fetchBlock(height).then(block => {
              if (block) {
                const timestamp = parseInt(block.block_timestamp) / 1000;
                const txCount = block.transactions?.length || 0;

                let blockTimeMs = 94;
                const prevBlock = blocksRef.current.find(b => b.blockHeight === height - 1);
                if (prevBlock) {
                  blockTimeMs = Math.max(1, timestamp - prevBlock.timestamp);
                }

                addBlock({
                  blockHeight: height,
                  txCount,
                  timestamp,
                  blockTimeMs,
                  gasUsed: 0,
                });
              }
            });
          }
        } catch (e) {
          // Not JSON or parse error
        }
      };

      ws.onerror = () => {
        console.log('WebSocket error on', wsEndpoints[idx]);
        ws.close();
      };

      ws.onclose = () => {
        console.log('WebSocket closed');
        // Try next endpoint
        setTimeout(() => tryConnect(idx + 1), 1000);
      };
    };

    // Start trying WebSocket endpoints
    tryConnect(0);
  }, [addBlock]);

  useEffect(() => {
    // Start fast polling immediately (most reliable)
    startPolling();

    // Also try WebSocket for even faster updates
    connectWebSocket();

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [startPolling, connectWebSocket]);

  return { stats, connected, error };
}
