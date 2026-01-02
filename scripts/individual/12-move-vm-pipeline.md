# Move VM: 7 Stages of Execution

**Duration:** ~60 seconds
**Animation:** Move VM pipeline visualization

---

## Hook

*"From bytecode to state change. Seven stages. Each one optimized."*

---

## Script

**[Walk through each stage]**

*"TX ENTRY—parse the transaction, verify signatures, check gas."*

*"MODULE LOAD—pull bytecode from cache. Sub-microsecond for hot contracts thanks to Loader V2."*

*"VERIFY—stack safety, type safety, borrow checking. Four parallel checks. Move catches bugs at compile time, not runtime."*

*"LINK—resolve dependencies, connect function calls across modules."*

*"CACHE—store verified bytecode for next time."*

*"EXECUTE—the stack machine runs bytecode."*

*"COMMIT—write state changes, emit events."*

**[Show the flow completing]**

*"Verification runs once per module deployment. Caching eliminates redundant loads. Execution parallelizes via Block-STM."*

---

## Banger

*"Seven stages. Zero waste. Maximum safety."*

---

## Key Points
- 7-stage pipeline: Entry → Load → Verify → Link → Cache → Execute → Commit
- 4 parallel verification checks (stack, type, locals, references)
- Verification at deployment, not execution
- Integrates with Loader V2 caching and Block-STM parallelism
