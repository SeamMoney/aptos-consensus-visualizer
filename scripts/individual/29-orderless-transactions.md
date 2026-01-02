# Orderless Transactions: True Parallel Processing

**Duration:** ~60 seconds
**Animation:** Parallel transaction lanes visualization
**Status:** 🟡 LIVE ON TESTNET (AIP-123)

---

## Hook

*"Traditional blockchains force your transactions into a queue. Transaction 1, then 2, then 3. Sequential. Slow."*

*"Orderless transactions on Aptos? They all fly at once."*

---

## Script

**[Show traditional sequence number model]**

*"Here's the old way. Every account has a sequence number. Transaction N must finish before N+1 can start. Even if they don't touch the same data."*

*"Got multiple trading bots on one account? They queue behind each other. Waiting. Wasting time."*

**[Show orderless parallel model]**

*"Orderless transactions flip this. Instead of sequence numbers, you use nonces—unique identifiers for each transaction."*

*"Nonce 47, nonce 382, nonce 9—they can all execute in parallel. No queue. No waiting."*

**[Show the use cases]**

*"Why does this matter?"*

*"Multiple machines signing for the same account? They don't block each other."*

*"High-frequency trading? Parallel order flow, not sequential bottlenecks."*

*"Prediction markets with 47 million bets? They process simultaneously."*

**[Show the expiration mechanism]**

*"Replay protection? Each nonce expires after 60 seconds. Use it or lose it. Can't replay old transactions."*

---

## Banger

*"Sequence numbers sequence. Nonces unleash. Forty-seven million transactions. Zero queue."*

---

## Key Points
- AIP-123, live on testnet
- Nonce-based replay protection (not sequence numbers)
- 60-second expiration window
- Multiple machines can sign for same account in parallel
- Eliminates sequential bottlenecks
- Critical for high-frequency orderbook trading
- Works with stateless accounts (AIP-115)
