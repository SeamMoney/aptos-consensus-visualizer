# Orderbook Architecture: Why Parallelism Matters

**Duration:** ~60 seconds
**Animation:** Block-STM or orderbook visualization

---

## Hook

*"A centralized exchange matches orders in microseconds. On-chain orderbooks? Most are embarrassingly slow."*

*"Here's how Aptos fixes it."*

---

## Script

*"On-chain orderbooks have a fundamental problem: state contention."*

*"Every trade touches orderbook state. On sequential execution chains, that means one trade at a time. Your matching engine is as slow as your block time divided by transaction count."*

**[Show Block-STM solving this]**

*"Aptos solves this with Block-STM's conflict detection."*

*"Here's the insight: Most orderbook operations don't actually conflict."*

*"A buy at $100 doesn't touch a sell at $105. A trade on ETH/USDC doesn't affect APT/USDC. Even on the same pair, different price levels are independent."*

*"Block-STM executes all pending orders in parallel. Only when two trades match at the same price level does conflict resolution trigger—and even then, only those specific transactions re-execute."*

**[Show the result]**

*"Orderbook throughput scales with parallelism, not sequentially."*

---

## Banger

*"No front-running. No congestion pricing. No 'try again later.' This is what DeFi was supposed to be."*

---

## Key Points
- Sequential chains: One trade at a time
- Most orderbook operations are independent
- Block-STM executes all orders in parallel
- Conflict detection only triggers on actual matches
- Throughput scales with parallelism
