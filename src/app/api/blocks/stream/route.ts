import { BlockStats, calculateTPS, calculateAvgBlockTime } from "@/lib/aptos";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const APTOS_API = "https://api.mainnet.aptoslabs.com/v1";

// Global cache to share across requests (avoids rate limits)
let globalCache = {
  lastBlockHeight: 0,
  recentBlocks: [] as BlockStats[],
  lastFetchTime: 0,
};

// Fetch with retry and backoff
async function fetchJSON(url: string, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.status === 429) {
        // Rate limited - wait longer
        await new Promise(r => setTimeout(r, 2000 * (i + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 500 * (i + 1)));
    }
  }
}

export async function GET() {
  const encoder = new TextEncoder();

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

        // Rate limit: only fetch if 2 seconds have passed since last fetch
        const now = Date.now();
        if (now - globalCache.lastFetchTime < 2000) {
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
          const ledger = await fetchJSON(APTOS_API);
          const currentHeight = parseInt(ledger.block_height);

          if (currentHeight > globalCache.lastBlockHeight) {
            // Fetch just the latest block
            const block = await fetchJSON(
              `${APTOS_API}/blocks/by_height/${currentHeight}?with_transactions=true`
            );

            const timestamp = parseInt(block.block_timestamp) / 1000;
            const txCount = block.transactions?.length || 0;

            // Calculate block time
            let blockTimeMs = 94;
            if (globalCache.recentBlocks.length > 0) {
              const prev = globalCache.recentBlocks[0];
              blockTimeMs = Math.max(1, timestamp - prev.timestamp);
            }

            let gasUsed = 0;
            if (block.transactions) {
              for (const tx of block.transactions as any[]) {
                if (tx.gas_used) gasUsed += parseInt(tx.gas_used);
              }
            }

            const newBlock: BlockStats = {
              blockHeight: currentHeight,
              txCount,
              timestamp,
              blockTimeMs,
              gasUsed,
            };

            // Update global cache
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
            globalCache.lastFetchTime = now;
          }
        } catch (error) {
          // Silently fail and retry next time
          console.error('Aptos fetch error:', error);
        }
      };

      // Initial fetch
      await poll();

      // Poll every 2.5 seconds to stay under rate limits
      const interval = setInterval(poll, 2500);

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
