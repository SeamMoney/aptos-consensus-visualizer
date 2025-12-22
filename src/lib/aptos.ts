const APTOS_API = "https://api.mainnet.aptoslabs.com/v1";

export interface LedgerInfo {
  chain_id: number;
  epoch: string;
  ledger_version: string;
  block_height: string;
  ledger_timestamp: string;
}

export interface BlockInfo {
  block_height: string;
  block_hash: string;
  block_timestamp: string;
  first_version: string;
  last_version: string;
  transactions?: unknown[];
}

export interface BlockStats {
  blockHeight: number;
  txCount: number;
  timestamp: number;
  blockTimeMs: number; // Time since previous block
  gasUsed: number;
}

export async function getLedgerInfo(): Promise<LedgerInfo> {
  const res = await fetch(APTOS_API, {
    next: { revalidate: 0 },
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(`Aptos API error: ${res.status}`);
  return res.json();
}

export async function getBlock(height: number, withTxs = true): Promise<BlockInfo> {
  const url = `${APTOS_API}/blocks/by_height/${height}?with_transactions=${withTxs}`;
  const res = await fetch(url, {
    next: { revalidate: 0 },
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(`Aptos API error: ${res.status}`);
  return res.json();
}

export async function getLatestBlocks(count: number = 10): Promise<BlockStats[]> {
  const ledger = await getLedgerInfo();
  const latestHeight = parseInt(ledger.block_height);

  const blocks: BlockStats[] = [];
  const heights = Array.from({ length: count + 1 }, (_, i) => latestHeight - i);

  // Fetch blocks in parallel (but respect rate limits)
  const blockPromises = heights.map(h => getBlock(h, true).catch(() => null));
  const blockResults = await Promise.all(blockPromises);

  for (let i = 0; i < blockResults.length - 1; i++) {
    const block = blockResults[i];
    const prevBlock = blockResults[i + 1];

    if (!block || !prevBlock) continue;

    const timestamp = parseInt(block.block_timestamp) / 1000; // Convert to ms
    const prevTimestamp = parseInt(prevBlock.block_timestamp) / 1000;
    const blockTimeMs = timestamp - prevTimestamp;

    // Calculate gas used from transactions
    let gasUsed = 0;
    if (block.transactions) {
      for (const tx of block.transactions as any[]) {
        if (tx.gas_used) {
          gasUsed += parseInt(tx.gas_used);
        }
      }
    }

    blocks.push({
      blockHeight: parseInt(block.block_height),
      txCount: block.transactions?.length || 0,
      timestamp,
      blockTimeMs,
      gasUsed,
    });
  }

  return blocks;
}

export function calculateTPS(blocks: BlockStats[]): number {
  if (blocks.length < 2) return 0;

  const totalTx = blocks.reduce((sum, b) => sum + b.txCount, 0);
  const timeSpanMs = blocks[0].timestamp - blocks[blocks.length - 1].timestamp;

  if (timeSpanMs <= 0) return 0;
  return Math.round((totalTx / timeSpanMs) * 1000);
}

export function calculateAvgBlockTime(blocks: BlockStats[]): number {
  if (blocks.length === 0) return 0;
  const avgMs = blocks.reduce((sum, b) => sum + b.blockTimeMs, 0) / blocks.length;
  return Math.round(avgMs);
}
