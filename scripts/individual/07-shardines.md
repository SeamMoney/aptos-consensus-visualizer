# Shardines: Dynamic Sharding for 1M+ TPS

**Duration:** ~60 seconds
**Animation:** Shardines visualization with multiple shards

---

## Hook

*"One million TPS. Not theoretical. Architected."*

*"Shardines dynamically partitions transactions that don't need to interact."*

---

## Script

**[Point to the hypergraph]**

*"Build a hypergraph. Transactions are nodes. Shared resources are edges. Run min-cut—find natural boundaries."*

**[Show shards processing in parallel]**

*"Each shard runs Block-STM independently. Parallel execution within shards. Parallel shards across the network."*

*"Overloaded? Split. Underutilized? Merge. Dynamic. Adaptive. Automatic."*

**[Show the merge phase]**

*"State merges atomically. Cross-shard conflicts resolve by ordering."*

---

## Banger

*"Shards that scale. Splits that adapt. A million TPS—and that's just the start."*

---

## Key Points
- Hypergraph partitioning for natural transaction boundaries
- Dynamic shard splitting and merging based on load
- Block-STM runs independently within each shard
- Atomic state merge with canonical ordering
- Work-stealing scheduler for load balancing
