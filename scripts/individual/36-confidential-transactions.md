# Confidential Transactions: Hidden Balances, Proven Valid

**Duration:** ~60 seconds
**Animation:** Encrypted balance visualization with ZK proofs
**Status:** 🟠 LIVE ON DEVNET (Testnet/Mainnet Coming)

---

## Hook

*"On most blockchains, everyone can see your balance. Your trades. Your positions. Whales get spotted. Strategies get copied."*

*"Confidential Transactions hide everything—while proving it's all valid."*

---

## Script

**[Show transparent blockchain problem]**

*"Blockchain transparency is a double-edged sword. Great for verification. Terrible for privacy."*

*"Big position on a prediction market? Visible. Everyone knows you're betting big on the outcome. They trade against you."*

**[Show confidential balance structure]**

*"Confidential Transactions encrypt your balances. Two encrypted components: pending balance for incoming, actual balance for outgoing."*

*"Your tokens are there. Provably. But the amounts? Hidden behind Twisted ElGamal encryption."*

**[Show ZK proof verification]**

*"But wait—how do validators know the math works if they can't see the numbers?"*

*"Zero-knowledge proofs. When you transfer, you generate cryptographic proof that:"*

*"One: The encrypted amounts match on both sides."*

*"Two: The value is within valid range."*

*"Three: You have enough balance to send."*

*"All verified without revealing actual numbers."*

**[Show the pending/actual split]**

*"The pending/actual split prevents a subtle attack. Without it, someone could send you dust to manipulate your balance and break your proof."*

*"Incoming goes to pending. You roll over to actual when YOU choose. Attack vector eliminated."*

---

## Banger

*"Balances encrypted. Transfers hidden. Math verified. Privacy and validity—finally together."*

---

## Key Points
- Live on devnet, testnet/mainnet pending
- Twisted ElGamal homomorphic encryption
- Groth16 + Bulletproofs ZK verification
- Pending/actual balance split prevents manipulation attacks
- 64-bit transfers, 128-bit balances
- Amounts split into 16-bit encrypted chunks
- Auditor keys available for compliance
- Hides amounts, not sender/recipient addresses
