# Encrypted Mempool: The End of Front-Running

**Duration:** ~60 seconds
**Animation:** Ciphertext flow → batch decryption → execution
**Status:** 🔵 COMING SOON (Pending Governance Vote)

---

## Hook

*"Every transaction you send is visible in the mempool. Bots see it. They front-run you. They sandwich you. They extract your value."*

*"What if they couldn't see it at all?"*

---

## Script

**[Show traditional mempool exposure]**

*"Here's how MEV works today. You submit a trade. It enters the mempool, visible to everyone. Bots analyze it. They see you're buying Token X."*

*"Lightning fast, they buy before you, push the price up, let your trade execute at a worse price, then sell into your purchase."*

*"Sandwich complete. They profit. You lose."*

**[Show encrypted transaction flow]**

*"Encrypted Mempool changes everything. Your transaction enters the mempool as encrypted ciphertext. Validators can't read it. Bots can't analyze it."*

*"The content stays hidden until the block is ready to execute."*

**[Show batch threshold decryption]**

*"When it's time to execute, validators collectively decrypt the entire batch. Batched threshold decryption lets the group reveal the batch with a single lightweight operation."*

*"Aptos Labs expects sub‑20ms overhead; the TrX paper reports ~27ms (≈14%) over baseline in their prototype."*

**[Show protection benefits]**

*"Front-running? Impossible—they can't see what you're trading."*

*"Sandwich attacks? Gone—your intent is hidden."*

*"Order flow manipulation? Eliminated—strategies stay confidential."*

*"If approved by governance, Aptos would be among the first L1s to ship this natively — not a sidecar, not a wrapper, but built into the protocol."*

---

## Banger

*"They can't front-run what they can't see. Encrypted mempool. Native to Aptos. MEV ends here."*

---

## Key Points
- Pending governance approval (announced October 2025)
- Encrypted ciphertexts hide intent until execution
- Batched threshold decryption by validators
- Reported overhead: <20ms expected; ~27ms (≈14%) in prototype
- Prevents: front-running, sandwich attacks, order flow manipulation
- Native protocol feature (not an external relayer)

## Sources
- Aptos Foundation forum announcement (JSON): https://forum.aptosfoundation.org/t/aptos-introduces-built-in-mev-protection-with-encrypted-mempools/17175.json
- TrX paper (IACR ePrint 2025/2032): https://eprint.iacr.org/2025/2032.pdf
