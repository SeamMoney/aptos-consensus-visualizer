# Transaction Pipeline: 5 Hops to Finality

**Duration:** ~60 seconds
**Animation:** Transaction pipeline visualization

---

## Hook

*"Every transaction you send takes a journey. Five stages. Under a second. Forever final."*

---

## Script

**[Follow a transaction through stages]**

*"SUBMIT—your wallet broadcasts. Transaction enters the mempool."*

*"PROPOSE—the leader bundles it into a block. Broadcasts to all validators."*

*"VOTE—each validator verifies independently. Checks signatures, validates transactions, confirms no double-spends. Valid? They sign and return."*

*"CERTIFY—signatures aggregate into a Quorum Certificate. Cryptographic proof that consensus was achieved."*

*"COMMIT—QC broadcasts. Block finalizes. Your transaction is permanent. Irreversible."*

**[Show timing]**

*"At sixty millisecond blocks, that's about 300 milliseconds from submission to finality. Under half a second."*

*"True finality—not probabilistic like Bitcoin. Not optimistic like rollups. Final final."*

---

## Banger

*"Five stages. Three hundred milliseconds. Forever final."*

---

## Key Points
- 5 stages: Submit → Propose → Vote → Certify → Commit
- ~300ms total finality (5 stages at ~60ms blocks)
- True BFT finality, not probabilistic
- Quorum Certificate proves 2/3+ agreement
