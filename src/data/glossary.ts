// Technical terms glossary with definitions and official documentation links

export interface GlossaryTerm {
  term: string;
  eli5: string; // Simple explanation anyone can understand
  technical: string; // Technical details for engineers
  link: string;
}

export const glossary: Record<string, GlossaryTerm> = {
  "block-stm": {
    term: "Block-STM",
    eli5: "Instead of processing transactions one-by-one like a single cashier, Block-STM runs many transactions at once like having 16 cashiers. If two transactions try to change the same thing, only one needs to redo — the rest fly through.",
    technical: "Parallel execution engine using Software Transactional Memory. Speculatively executes transactions in parallel, detects read-write conflicts via MVCC, and only re-executes conflicting transactions. Achieves 8-16x speedup over sequential execution.",
    link: "https://aptos.dev/network/blockchain/execution",
  },
  "quorum-store": {
    term: "Quorum Store",
    eli5: "Before voting on transactions, validators share data with each other first — like passing out copies of a document before a meeting. This way, when it's time to vote, everyone already has what they need.",
    technical: "Data availability layer based on Narwhal. Validators batch transactions and obtain Proof-of-Store certificates (2f+1 signatures) before consensus, decoupling data dissemination from ordering. Enables horizontal scalability.",
    link: "https://github.com/aptos-labs/aptos-core/tree/main/consensus",
  },
  "raptr": {
    term: "Raptr",
    eli5: "A 4-step voting process where validators agree on new blocks. Leader proposes → validators vote → leader collects votes into a certificate → validators confirm. Takes about 400ms total.",
    technical: "4-hop BFT consensus based on HotStuff-2. Achieves linear message complexity O(n) with Byzantine fault tolerance. Quorum of 2f+1 validators needed for agreement where f is max faulty nodes.",
    link: "https://aptos.dev/network/blockchain/blockchain-deep-dive",
  },
  "velociraptr": {
    term: "Velociraptr",
    eli5: "A speed upgrade that lets the next leader start working before the previous block is fully confirmed — like a relay race where runners start moving before the baton arrives. Makes blocks 40% faster.",
    technical: "AIP-131 optimistic proposal protocol. Leaders propose blocks without waiting for parent QC. Reduces block time from ~100ms to ~60ms by allowing proposals every network delay δ instead of 2δ.",
    link: "https://medium.com/aptoslabs/velociraptr-towards-faster-block-time-for-the-global-trading-engine-b7579d27fd1a",
  },
  "move-vm": {
    term: "Move VM",
    eli5: "The engine that runs smart contracts on Aptos. It treats digital assets like physical objects — you can't accidentally copy or destroy them, making it much safer than other blockchain languages.",
    technical: "Smart contract virtual machine with linear type system for safe resource management. Features formal verification, prevents reentrancy attacks, and ensures assets can't be duplicated or destroyed unexpectedly.",
    link: "https://aptos.dev/move/move-on-aptos/",
  },
  "mvcc": {
    term: "MVCC",
    eli5: "Every piece of data keeps a history of its changes (v1, v2, v3...). This lets multiple transactions read data at the same time without waiting, because each can read the version it needs.",
    technical: "Multi-Version Concurrency Control. Each storage key maintains versioned values. Parallel transactions read specific versions; conflicts detected when a transaction reads an older version than current. Enables lock-free parallel reads.",
    link: "https://aptos.dev/network/blockchain/execution",
  },
  "bft": {
    term: "BFT",
    eli5: "The network keeps working correctly even if up to 1/3 of validators are broken or malicious. Like a jury that can still make the right decision even if some jurors are compromised.",
    technical: "Byzantine Fault Tolerant consensus. Guarantees safety and liveness with up to f malicious validators out of 3f+1 total. Requires 2f+1 honest validators for quorum.",
    link: "https://aptos.dev/network/blockchain/aptos-white-paper",
  },
  "quorum-certificate": {
    term: "Quorum Certificate (QC)",
    eli5: "Proof that 2/3+ of validators agreed on something. Instead of storing everyone's signature separately, they're combined into one compact proof that's quick to verify.",
    technical: "Aggregated threshold signature from 2f+1 validators proving consensus on a block hash. Uses BLS signature aggregation for O(1) verification complexity regardless of validator count.",
    link: "https://aptos.dev/network/glossary",
  },
  "epoch": {
    term: "Epoch",
    eli5: "A fixed time period (about 2 hours) where the same set of validators work together. Any changes to who can validate only take effect at the start of the next epoch.",
    technical: "Time period during which validator set remains fixed. Stake changes, validator additions/removals, and configuration updates only take effect at epoch boundaries. Enables stable consensus rounds.",
    link: "https://aptos.dev/network/glossary",
  },
  "shoal": {
    term: "Shoal++",
    eli5: "A reputation system that tracks which validators are reliable. Good performers get picked as leaders more often, bad performers less often — reducing failed rounds by 60%.",
    technical: "Leader reputation system tracking validator performance history (successful proposals, vote participation, timeouts). Probabilistic leader selection weighted by reputation scores.",
    link: "https://github.com/aptos-labs/aptos-core/tree/main/consensus",
  },
  "archon": {
    term: "Archon",
    eli5: "5 validators in the same data center agree super fast (~5ms) among themselves first, then share with everyone else. Like having a local team huddle before the full meeting.",
    technical: "Co-located cluster consensus optimization. Intra-cluster agreement in ~5ms using fast local network, then broadcast to external validators. Achieves sub-10ms block times within cluster.",
    link: "https://aptos.dev/network/blockchain/blockchain-deep-dive",
  },
  "narwhal": {
    term: "Narwhal",
    eli5: "A system where validators continuously share transaction batches with each other in the background, building a web of certified data. Consensus then just picks which batches to order.",
    technical: "DAG-based mempool protocol. Separates data dissemination from ordering — validators exchange batches and certificates asynchronously, then consensus orders certified batches. Enables horizontal throughput scaling.",
    link: "https://github.com/aptos-labs/aptos-core/tree/main/consensus",
  },
  "proof-of-store": {
    term: "Proof of Store (PoS)",
    eli5: "A receipt proving that 2/3+ of validators have saved a batch of transactions. Like a signed delivery confirmation showing the package was received.",
    technical: "Certificate containing batch digest and 2f+1 aggregated signatures proving data availability. Validators only vote on batches with valid PoS, ensuring data can be retrieved.",
    link: "https://github.com/aptos-labs/aptos-core/tree/main/consensus",
  },
  "pipelining": {
    term: "Pipelining",
    eli5: "Working on multiple blocks at different stages simultaneously — like a factory assembly line. While Block 1 is being finalized, Block 2 is being voted on, and Block 3 is being proposed.",
    technical: "Concurrent processing of blocks through consensus stages. Block N in commit phase while N+1 in vote phase and N+2 in propose phase. Maximizes throughput by overlapping latencies.",
    link: "https://aptos.dev/network/blockchain/blockchain-deep-dive",
  },
  "shardines": {
    term: "Shardines",
    eli5: "Automatically groups transactions that don't affect each other into separate lanes that run in parallel. Like having express lanes at a supermarket for customers with no item conflicts.",
    technical: "Hypergraph partitioning for horizontal scalability. Analyzes transaction read/write sets to identify independent subsets that can execute in parallel shards without cross-shard coordination.",
    link: "https://aptos.dev/network/blockchain/execution",
  },
  "zaptos": {
    term: "Zaptos",
    eli5: "Runs consensus and execution at the same time instead of one after the other. While validators agree on Block N, they're already running Block N-1's transactions.",
    technical: "Parallel consensus-execution pipelining. Decouples block ordering from execution — consensus proceeds on block N while execution completes block N-1. Reduces end-to-end latency significantly.",
    link: "https://aptos.dev/network/blockchain/blockchain-deep-dive",
  },
  "consensus-observer": {
    term: "Consensus Observer",
    eli5: "Nodes that watch and learn from consensus without voting. They get all the data and can serve users, helping the network scale to more users without adding voting overhead.",
    technical: "Non-voting nodes that observe consensus messages and replicate state. Reduces validator load while maintaining decentralization. Can serve read requests and submit transactions.",
    link: "https://aptos.dev/network/blockchain/blockchain-deep-dive",
  },
  "loader-v2": {
    term: "Loader V2",
    eli5: "A smart caching system for smart contract code. Instead of reloading the same code for every transaction, it keeps popular modules in memory — making execution 60% faster.",
    technical: "Multi-level module code caching system. L1 (per-thread), L2 (per-block), L3 (epoch-wide) caches reduce code loading overhead. Parallel-safe design integrates with Block-STM.",
    link: "https://aptos.dev/network/blockchain/execution",
  },
};

// Helper function to get a term
export function getTerm(key: string): GlossaryTerm | undefined {
  return glossary[key.toLowerCase()];
}

// Get all terms as an array
export function getAllTerms(): GlossaryTerm[] {
  return Object.values(glossary);
}

// Official Aptos documentation links by category
export const aptosLinks = {
  // Core Documentation
  execution: "https://aptos.dev/network/blockchain/execution",
  deepDive: "https://aptos.dev/network/blockchain/blockchain-deep-dive",
  whitePaper: "https://aptos.dev/network/blockchain/aptos-white-paper",
  glossary: "https://aptos.dev/network/glossary",

  // Move
  moveOnAptos: "https://aptos.dev/move/move-on-aptos/",
  moveBook: "https://move-language.github.io/move/",

  // Consensus & Protocol
  consensus: "https://github.com/aptos-labs/aptos-core/tree/main/consensus",
  aips: "https://aptos.dev/build/aips",

  // Research Papers
  blockStmPaper: "https://arxiv.org/abs/2203.06871",

  // Blog Posts
  velociraptorBlog: "https://medium.com/aptoslabs/velociraptr-towards-faster-block-time-for-the-global-trading-engine-b7579d27fd1a",

  // External
  aptosLabs: "https://aptoslabs.com",
  github: "https://github.com/aptos-labs/aptos-core",
};
