# Block-STM: Parallel Execution Engine

**Duration:** ~60 seconds
**Animation:** Block-STM visualization with parallel threads

---

## Hook

*"Every blockchain you've heard of executes transactions like it's 1995—one at a time, single file, waiting in line."*

*"Aptos said: why wait?"*

---

## Script

**[Point to the parallel threads executing]**

*"This is Block-STM. Software Transactional Memory. Watch—32 transactions running simultaneously across parallel threads."*

*"Here's the magic: execute first, ask questions later. Every transaction runs optimistically. Conflicts? Detected automatically, re-executed surgically. No wasted work."*

**[Highlight a conflict detection moment]**

*"See that? Conflict caught. Only THAT transaction re-runs. Not the whole batch."*

*"The insight is simple: your NFT purchase doesn't touch my token swap. Why should they wait for each other?"*

**[Show the speedup stats]**

*"8 to 16x faster than sequential execution. Same security. Same determinism."*

---

## Banger

*"Other chains queue. Aptos conquers."*

---

## Key Points
- Optimistic parallel execution across 32 threads
- Automatic conflict detection and surgical re-execution
- 8-16x speedup over sequential processing
- Same security guarantees as sequential execution
