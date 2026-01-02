# Event-Driven Transactions: Onchain Automation Without Keepers

**Duration:** ~60 seconds
**Animation:** Oracle → event → auto-execution flow
**Status:** 🔵 COMING SOON (AIP-125, Announced Sept 2025)

---

## Hook

*"Traditional DeFi needs keepers—external bots that watch and trigger. They extract value. They add latency. They can fail."*

*"Event-Driven Transactions automate onchain. No keepers. No bots. Just code that executes when conditions hit."*

---

## Script

**[Show traditional keeper dependency]**

*"Here's how DeFi automation works today. You set a stop-loss. An external keeper bot monitors the price. When it triggers, the bot submits a transaction."*

*"Problems? The bot takes a cut. The bot might be slow. The bot might be down. Single point of failure."*

**[Show event-driven model]**

*"Event-Driven Transactions move automation onchain. Define your condition. The blockchain itself triggers execution when that condition is met."*

*"No external monitoring. No keeper fees. No latency from off-chain to on-chain."*

**[Show Polymarket use case]**

*"For prediction markets, this is huge. Oracle confirms election result—that's an onchain event."*

*"The moment that event fires, settlement transactions execute automatically. No keeper race. No MEV extraction in the settlement flow."*

**[Show time-based automation]**

*"Time-based triggers too. Schedule a DCA buy every Monday. Token unlock at specific timestamp. Recurring funding rolls."*

*"Each transaction can specify its next schedule. Self-rescheduling automation."*

**[Show the broader impact]**

*"Over 50% of traditional derivatives trading is algorithmic. Event-Driven Transactions bring that sophistication to DeFi—natively."*

---

## Banger

*"Keepers extract. Aptos executes. Onchain automation. Zero intermediaries. Pure code."*

---

## Key Points
- AIP-125, announced September 2025
- Eliminates external keeper networks
- Time-based: DCA, scheduled unlocks, recurring rolls
- Event-based: Oracle confirmations trigger auto-settlement
- Self-rescheduling via `next_schedule_delta_time`
- 60-second max expiration
- Critical for: prediction market settlement, stop-losses, portfolio rebalancing
- Brings TradFi automation sophistication to DeFi
