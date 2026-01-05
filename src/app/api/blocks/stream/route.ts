import { BlockStats, calculateTPS, calculateAvgBlockTime } from "@/lib/aptos";
import { fetchFromAny, getNetwork } from "@/app/api/aptos/_utils";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Global cache to share across requests (avoids rate limits)
let globalCache = {
  network: "mainnet" as "mainnet" | "testnet",
  lastBlockHeight: 0,
  recentBlocks: [] as BlockStats[],
  lastFetchTime: 0,
};

function parseBlockMetadata(block: any): Partial<BlockStats> {
  const metadata: Partial<BlockStats> = {};
  if (block.transactions) {
    for (const tx of block.transactions) {
      if (tx.type === "block_metadata_transaction") {
        metadata.proposer = tx.proposer;
        metadata.round = parseInt(tx.round || "0");
        metadata.epoch = parseInt(tx.epoch || "0");
        metadata.votesBitvec = tx.previous_block_votes_bitvec;
        metadata.failedProposers =
          tx.failed_proposer_indices?.map((i: string) => parseInt(i)) || [];
        break;
      }
    }
  }
  return metadata;
}

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  const network = getNetwork(request);

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const sendEvent = (data: object) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      const poll = async () => {
        if (closed) return;

        // Rate limit: only fetch if interval has passed since last fetch
        const now = Date.now();
        const pollIntervalMs = parseInt(process.env.APTOS_STREAM_POLL_MS || "500");
        if (globalCache.network !== network) {
          globalCache = {
            network,
            lastBlockHeight: 0,
            recentBlocks: [],
            lastFetchTime: 0,
          };
        }

        if (now - globalCache.lastFetchTime < pollIntervalMs) {
          // Send cached data
          if (globalCache.recentBlocks.length > 0) {
            sendEvent({
              type: 'blocks',
              blocks: [],
              stats: {
                blockHeight: globalCache.lastBlockHeight,
                tps: calculateTPS(globalCache.recentBlocks.slice(0, 20)),
                avgBlockTime: calculateAvgBlockTime(globalCache.recentBlocks.slice(0, 20)),
                recentBlocks: globalCache.recentBlocks.slice(0, 30),
              }
            });
          }
          return;
        }

        try {
          // Get latest ledger info
          const ledgerRes = await fetchFromAny("/", network, { cache: "no-store" });
          if (!ledgerRes.ok) throw new Error(`Ledger ${ledgerRes.status}`);
          const ledger = await ledgerRes.json();
          const currentHeight = parseInt(ledger.block_height);

          if (currentHeight > globalCache.lastBlockHeight) {
            // Fetch just the latest block
            const blockRes = await fetchFromAny(
              `/blocks/by_height/${currentHeight}?with_transactions=true`,
              network,
              { cache: "no-store" }
            );
            if (!blockRes.ok) throw new Error(`Block ${blockRes.status}`);
            const block = await blockRes.json();

            const timestamp = parseInt(block.block_timestamp) / 1000;
            const txCount = block.transactions?.length || 0;

            // Calculate block time
            let blockTimeMs = 94;
            if (globalCache.recentBlocks.length > 0) {
              const prev = globalCache.recentBlocks[0];
              blockTimeMs = Math.max(1, timestamp - prev.timestamp);
            }

            let gasUsed = 0;
            const gasPrices: number[] = [];
            if (block.transactions) {
              for (const tx of block.transactions as any[]) {
                if (tx.gas_used) gasUsed += parseInt(tx.gas_used);
                // Extract gas prices from user transactions
                if (tx.type === "user_transaction" && tx.gas_unit_price) {
                  gasPrices.push(parseInt(tx.gas_unit_price));
                }
              }
            }

            // Calculate gas price stats for this block
            const gasStats = gasPrices.length > 0 ? {
              min: Math.min(...gasPrices),
              max: Math.max(...gasPrices),
              median: gasPrices.sort((a, b) => a - b)[Math.floor(gasPrices.length / 2)],
              count: gasPrices.length,
            } : null;

            const metadata = parseBlockMetadata(block);
            const newBlock: BlockStats = {
              blockHeight: currentHeight,
              txCount,
              timestamp,
              blockTimeMs,
              gasUsed,
              gasStats: gasStats || undefined,
              ...metadata,
            };

            // Update global cache
            globalCache.network = network;
            globalCache.recentBlocks = [newBlock, ...globalCache.recentBlocks].slice(0, 50);
            globalCache.lastBlockHeight = currentHeight;
            globalCache.lastFetchTime = now;

            sendEvent({
              type: 'blocks',
              blocks: [newBlock],
              stats: {
                blockHeight: currentHeight,
                tps: calculateTPS(globalCache.recentBlocks.slice(0, 20)),
                avgBlockTime: calculateAvgBlockTime(globalCache.recentBlocks.slice(0, 20)),
                recentBlocks: globalCache.recentBlocks.slice(0, 30),
              }
            });
          } else {
            globalCache.network = network;
            globalCache.lastFetchTime = now;
          }
        } catch (error) {
          // Silently fail and retry next time
          console.error('Aptos fetch error:', error);
        }
      };

      // Initial fetch
      await poll();

      // Poll at configured interval
      const intervalMs = parseInt(process.env.APTOS_STREAM_POLL_MS || "500");
      const interval = setInterval(poll, intervalMs);

      // Cleanup after 5 minutes
      const timeout = setTimeout(() => {
        closed = true;
        clearInterval(interval);
        try { controller.close(); } catch {}
      }, 5 * 60 * 1000);

      // Handle abort
      return () => {
        closed = true;
        clearInterval(interval);
        clearTimeout(timeout);
      };
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
