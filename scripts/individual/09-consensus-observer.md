# Consensus Observer: Fullnode Scaling (AIP-93)

**Duration:** ~60 seconds
**Animation:** Consensus Observer visualization

---

## Hook

*"Fullnodes don't vote. So why should they wait for voting to finish?"*

*"Consensus Observer says: they shouldn't."*

---

## Script

**[Show the parallel flows]**

*"When a block is proposed, two things happen simultaneously."*

*"Validators start the 4-hop consensus dance. Propose, vote, certify, commit."*

*"But observers? They receive the same proposal and immediately start executing. Speculatively."*

**[Point to the timing advantage]**

*"Observers don't wait for the Quorum Certificate. They execute ahead, staying 2-3 rounds in front of finalization."*

*"When consensus completes? Observers just mark those blocks as final. The work is already done."*

*"30-50% latency reduction for fullnodes. Your wallet sees confirmations faster. Indexers update quicker."*

---

## Banger

*"Validators vote. Observers execute. Everyone wins."*

---

## Key Points
- AIP-93 optimization for fullnodes
- Speculative execution 2-3 rounds ahead
- 30-50% latency reduction for non-validators
- Same security—all blocks still verified
