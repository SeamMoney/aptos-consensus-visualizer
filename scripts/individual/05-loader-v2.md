# Loader V2: Multi-Level Code Caching

**Duration:** ~60 seconds
**Animation:** Loader V2 cache hierarchy

---

## Hook

*"Here's a performance killer hiding in plain sight. Every smart contract call loads bytecode. Deserializes it. Verifies it. On hot contracts? Thousands of times per second. Redundant. Wasteful."*

*"Loader V2 caches once, serves forever."*

---

## Script

**[Point to cache levels]**

*"L1—Thread cache. 90% hit rate. Sub-microsecond."*

*"L2—Block cache. Shared across threads. Another 8%."*

*"L3—Epoch cache. Survives for hours. The hot contracts everyone uses? They live here."*

**[Show 32 threads accessing cache]**

*"32 Block-STM threads need the same module? Legacy loads it 32 times. Loader V2? Once. Lock-free reads for everyone else."*

*"60% faster blocks. Just from smart caching."*

---

## Banger

*"Cache it once. Crush it forever."*

---

## Key Points
- 3-level cache hierarchy (L1/L2/L3)
- L1: 90% hit rate, <1μs latency
- L2: Block-scoped, 5μs latency
- L3: Epoch-wide (2 hours), 50μs latency
- 14x faster module publishing, 60% faster blocks
