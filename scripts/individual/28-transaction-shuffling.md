# Transaction Shuffling: MEV Protection Built Into Consensus

**Duration:** ~60 seconds
**Animation:** Transaction shuffling visualization
**Status:** 🟢 LIVE ON MAINNET

---

## Hook

*"Front-runners watch the mempool. They see your trade, jump ahead, profit off your slippage."*

*"On Aptos? They can't predict where your transaction lands. Because we shuffle."*

---

## Script

**[Show transactions entering in gas-price order]**

*"Here's how most chains work. Transactions enter ordered by gas price. Highest bidder goes first. Predictable. Exploitable."*

*"MEV bots love predictable. They front-run you, sandwich you, extract value from every trade."*

**[Show the shuffling animation]**

*"Aptos does something different. After gas ordering, transactions get shuffled."*

*"Two parameters control this:"*

*"Sender spread factor—32. Transactions from the same sender get spread as far apart as possible in the block."*

*"Use-case spread factor—4. Similar transaction types get distributed across the block."*

**[Show the parallel execution benefit]**

*"Why shuffle? Two reasons."*

*"First: MEV protection. Bots can't predict final position. Front-running becomes a guessing game."*

*"Second: Performance. Spreading transactions reduces conflicts. Block-STM executes more in parallel."*

*"The result? 25% higher TPS. And front-runners left guessing."*

---

## Banger

*"Predictable ordering is exploitable ordering. Aptos shuffles. Bots stumble. Users win."*

---

## Key Points
- Live on mainnet today
- `sender_spread_factor: 32` - same sender spread apart
- `user_use_case_spread_factor: 4` - similar txns distributed
- 25% TPS improvement from better parallelization
- MEV bots can't predict final transaction position
- Combines fairness with performance
