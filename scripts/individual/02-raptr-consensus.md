# Raptr: 4-Hop Consensus

**Duration:** ~60 seconds
**Animation:** Raptr 4-hop visualization

---

## Hook

*"How do a hundred validators scattered across the globe agree on anything in under a hundred milliseconds?"*

*"Four hops. That's it."*

---

## Script

**[Walk through each hop as it animates]**

*"Hop one—PROPOSE. Leader broadcasts the block. Everyone gets it simultaneously."*

*"Hop two—VOTE. Validators verify, sign, send back. We need two-thirds plus one."*

*"Hop three—CERTIFY. All those signatures? Compressed into one Quorum Certificate. Cryptographic proof of consensus."*

*"Hop four—COMMIT. Done. Finalized. Permanent."*

**[Show the timing]**

*"With Velociraptr optimization, that's sixty to a hundred milliseconds per block. Not per round—per BLOCK."*

*"True BFT finality. Not probabilistic like Bitcoin. When it's done, it's done."*

---

## Banger

*"Four hops to finality. Sixty milliseconds to permanence."*

---

## Key Points
- HotStuff-2 based BFT consensus
- Quorum Certificate compresses 100 signatures into 1
- O(n) messages, O(1) verification
- ~60-100ms block times with Velociraptr
