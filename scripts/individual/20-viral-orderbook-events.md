# Viral Orderbook Events: When Everyone Trades at Once

**Duration:** ~60 seconds
**Animation:** Block River with burst of activity

---

## Hook

*"11:24 PM Eastern. AP calls the election. Forty-seven million positions close at once."*

*"On most chains, you're waiting hours. On Aptos? Sixty milliseconds."*

---

## Script

*"Picture what happens on a traditional orderbook when this hits:"*

*"Matching engine explodes. Latency spikes to minutes. Stale prices. Bad fills. Chaos."*

*"On most blockchains? Even worse."*

*"Mempool floods. Fee auctions begin. Rich traders front-run. Regular users fail entirely."*

**[Point to Aptos handling load]**

*"Now watch Aptos handle the same moment."*

*"Quorum Store already has transactions pre-certified. The flood was absorbed before consensus even started."*

*"Block-STM parallelizes order matching. Buys and sells on different price levels execute simultaneously—no blocking."*

**[Show the metrics staying stable]**

*"Block times? Still sixty milliseconds. Gas fees? Same as yesterday. Arrival order determines execution."*

*"The orderbook clears in seconds. Not hours. Seconds."*

*"Every other chain fails exactly when you need it most. Aptos was designed for that moment."*

---

## Banger

*"Forty-seven million trades. Sixty milliseconds each. Same gas. Cleared in seconds."*

---

## Key Points
- Viral events = instant max load (no gradual scaling)
- Quorum Store pre-certifies transaction floods
- Block-STM parallelizes different price levels
- ~60ms blocks maintained under peak load
- Arrival-based ordering, not fee-based
