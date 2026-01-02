# Move Aggregators: Parallel Counters at Blockchain Scale

**Duration:** ~60 seconds
**Animation:** Parallel counter/minting visualization
**Status:** 🟢 LIVE ON MAINNET (AIP-47)

---

## Hook

*"How do you mint one million NFTs without choking the network? Traditional counters create bottlenecks."*

*"Move Aggregators minted a million in under 90 seconds."*

---

## Script

**[Show traditional counter problem]**

*"Here's the problem with counters on blockchain. Every mint increments the collection size. Read current value, add one, write new value."*

*"Sequential. Blocking. One mint at a time."*

*"Want to mint 10,000 NFTs simultaneously? They all fight over the same counter. Conflict city."*

**[Show aggregator solution]**

*"Move Aggregators solve this. They're counters designed for parallel execution."*

*"Multiple transactions can add or subtract from the same aggregator simultaneously. No read-modify-write bottleneck."*

**[Show the technical insight]**

*"The trick: Aggregators track deltas, not absolute values. Transaction A adds 5. Transaction B adds 3. Transaction C adds 7. All in parallel."*

*"At the end, combine the deltas. 5 + 3 + 7 = 15. Order doesn't matter for addition."*

**[Show the performance]**

*"On Aptos previewnet: One million NFTs minted in under 90 seconds. Not sequentially—in parallel."*

*"Critical constraint: Reading the aggregator value forces sequential execution. Add and subtract freely. Read sparingly."*

---

## Banger

*"A million mints. Ninety seconds. Aggregators don't queue—they conquer."*

---

## Key Points
- AIP-47, live on mainnet
- Enables parallel addition/subtraction operations
- 1M NFTs in <90 seconds demonstrated
- No read-modify-write conflicts
- Delta-based tracking (order doesn't matter for +/-)
- Critical: Reading aggregator value is expensive (breaks parallelism)
- Use cases: NFT collection size, token supply, counters
