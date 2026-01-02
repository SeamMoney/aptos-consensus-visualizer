# Stable Fees Stress Test: Watch the Load, Watch the Fees

**Duration:** ~60 seconds
**Animation:** Live load simulation with fee stability
**Status:** 🟢 LIVE ON MAINNET

---

## Hook

*"Let's stress test Aptos. Crank the TPS. Flood the network. Watch what happens to gas fees."*

*"Spoiler: Nothing."*

---

## Script

**[Show starting state: low TPS, low fees]**

*"Starting state. Quiet network. A few thousand TPS. Gas fee: let's call it X."*

**[Begin ramping up load]**

*"Now we start ramping. 10,000 TPS. 20,000. 30,000."*

*"Watch two metrics: TPS climbing on the left. Gas fee on the right."*

**[TPS increases, fees stay flat]**

*"50,000 TPS. 75,000. 100,000."*

*"TPS keeps climbing. Gas fee? Still X. Unchanged."*

*"Block-STM absorbs the load through parallelization. More transactions per block, not more expensive transactions."*

**[Push to peak load]**

*"Let's push harder. 150,000 TPS. Approaching theoretical maximum."*

*"Network is working hard. Validators are busy. Block times holding at sixty milliseconds."*

*"Gas fee? Still. Exactly. X."*

**[Show the contrast]**

*"On fee-auction chains, this load would trigger bidding wars. Fees would spike 10x, 100x, 1000x."*

*"On Aptos, the only thing that changes is throughput. Users pay the same whether they're first or one hundred thousandth."*

---

## Banger

*"TPS to the moon. Fees to the floor. That's not a bug—that's the architecture."*

---

## Key Points
- Flat fees maintained under extreme load
- No fee auction mechanism
- Block-STM handles increased load through parallelization
- Governance-set fee price
- 160K+ TPS capacity without fee degradation
- Users never priced out during peak demand
