// Technical terms glossary with definitions and official documentation links

export interface GlossaryTerm {
  term: string;
  definition: string;
  link: string;
}

export const glossary: Record<string, GlossaryTerm> = {
  "block-stm": {
    term: "Block-STM",
    definition: "Aptos's parallel execution engine using Software Transactional Memory. It speculatively executes transactions in parallel and only re-executes on conflict, achieving 8-16x speedup over sequential execution.",
    link: "https://aptos.dev/network/blockchain/execution",
  },
  "quorum-store": {
    term: "Quorum Store",
    definition: "Data availability layer based on Narwhal protocol. Validators batch transactions and obtain Proof-of-Store certificates before consensus, decoupling data dissemination from ordering.",
    link: "https://github.com/aptos-labs/aptos-core/tree/main/consensus",
  },
  "raptr": {
    term: "Raptr",
    definition: "Aptos's 4-hop BFT consensus protocol based on HotStuff-2. Achieves linear message complexity O(n) while maintaining Byzantine fault tolerance with 2f+1 quorum.",
    link: "https://aptos.dev/network/blockchain/blockchain-deep-dive",
  },
  "velociraptr": {
    term: "Velociraptr",
    definition: "AIP-131 upgrade enabling optimistic proposals. Reduces block time by 40% (from ~100ms to ~60ms) by allowing validators to propose every network delay instead of every two.",
    link: "https://medium.com/aptoslabs/velociraptr-towards-faster-block-time-for-the-global-trading-engine-b7579d27fd1a",
  },
  "move-vm": {
    term: "Move VM",
    definition: "Smart contract virtual machine designed for safe resource management. Features linear types, formal verification, and prevents common vulnerabilities like reentrancy attacks.",
    link: "https://aptos.dev/move/move-on-aptos/",
  },
  "mvcc": {
    term: "MVCC",
    definition: "Multi-Version Concurrency Control. Each storage key maintains multiple versions, allowing parallel reads without blocking. Block-STM uses MVCC to detect conflicts and ensure serializability.",
    link: "https://aptos.dev/network/blockchain/execution",
  },
  "bft": {
    term: "BFT",
    definition: "Byzantine Fault Tolerant consensus. Guarantees safety and liveness even when up to f validators (out of 3f+1 total) are malicious or faulty.",
    link: "https://aptos.dev/network/blockchain/aptos-white-paper",
  },
  "quorum-certificate": {
    term: "Quorum Certificate (QC)",
    definition: "Aggregated threshold signature from 2f+1 validators proving consensus on a block. Enables efficient verification with O(1) signature size.",
    link: "https://aptos.dev/network/glossary",
  },
  "epoch": {
    term: "Epoch",
    definition: "Time period during which the validator set remains fixed. Stake changes and validator rotations only take effect at epoch boundaries.",
    link: "https://aptos.dev/network/glossary",
  },
  "shoal": {
    term: "Shoal++",
    definition: "Leader reputation system that tracks validator performance history. Reliable validators are selected more often as block proposers, reducing failed rounds by ~60%.",
    link: "https://github.com/aptos-labs/aptos-core/tree/main/consensus",
  },
  "archon": {
    term: "Archon",
    definition: "Co-located cluster consensus optimization. 5 validators in the same datacenter reach internal agreement in ~5ms, then broadcast to external validators. Achieves ~10ms block times.",
    link: "https://aptos.dev/network/blockchain/blockchain-deep-dive",
  },
  "narwhal": {
    term: "Narwhal",
    definition: "DAG-based mempool protocol that Quorum Store is based on. Separates transaction dissemination from ordering for horizontal scalability.",
    link: "https://github.com/aptos-labs/aptos-core/tree/main/consensus",
  },
  "proof-of-store": {
    term: "Proof of Store (PoS)",
    definition: "Certificate proving 2f+1 validators have stored a transaction batch. Contains batch digest and aggregated threshold signature.",
    link: "https://github.com/aptos-labs/aptos-core/tree/main/consensus",
  },
  "pipelining": {
    term: "Pipelining",
    definition: "Technique where multiple blocks process concurrently through different stages. While block N is being voted on, block N+1 can already be proposed.",
    link: "https://aptos.dev/network/blockchain/blockchain-deep-dive",
  },
  "shardines": {
    term: "Shardines",
    definition: "Hypergraph partitioning technique for horizontal scalability. Analyzes transaction dependencies to create independent shards that can execute in parallel.",
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
  blockStmPaper: "https://aptoslabs.com/pdf/2203.06871.pdf",

  // Blog Posts
  velociraptorBlog: "https://medium.com/aptoslabs/velociraptr-towards-faster-block-time-for-the-global-trading-engine-b7579d27fd1a",

  // External
  aptosLabs: "https://aptoslabs.com",
  github: "https://github.com/aptos-labs/aptos-core",
};
