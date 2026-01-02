# Velociraptr: Optimistic Proposals

**Duration:** ~60 seconds
**Animation:** Velociraptr side-by-side comparison

---

## Hook

*"Standard consensus has a dirty secret: leaders wait. They wait for proof the last block succeeded before proposing the next one."*

*"Velociraptr said: why wait?"*

---

## Script

**[Point to the comparison]**

*"Watch the left side—regular Raptr. Wait for Quorum Certificate, then propose. Sequential. Safe but slow."*

*"Now the right—Velociraptr. Propose immediately. Receive the QC in parallel."*

**[Show the timing impact]**

*"Old Raptr: around 100 milliseconds per block."*

*"Velociraptr: 60 milliseconds. Sometimes faster."*

*"Same security guarantees. 40% faster blocks."*

**[Explain the insight]**

*"It's like a relay race. Normal consensus hands off the baton, waits for confirmation, then runs."*

*"Velociraptr? Already sprinting before the handoff completes."*

*"If the parent block fails, we just reorganize. But 99% of the time? It succeeds. Optimism pays."*

---

## Banger

*"Don't wait for permission. Propose with precision. Sixty milliseconds."*

---

## Key Points
- AIP-131 optimization (currently deployed)
- Eliminates waiting for parent Quorum Certificate
- Reduces block time from ~100ms to ~60ms
- Same Byzantine fault tolerance guarantees
- This is what's running on mainnet NOW
