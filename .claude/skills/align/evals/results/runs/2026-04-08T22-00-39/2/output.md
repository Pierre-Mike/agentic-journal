# Non-obvious Decisions

Here's what's coming:
1. **Snowflake write batching strategy**
2. **Delivery semantics and idempotency**
3. **Backpressure and consumer lag handling**
4. **Schema evolution and breaking changes**

---

## Decision 1: Snowflake write batching strategy

**The problem**: Snowflake performs best with bulk writes (thousands of rows), but larger batches increase latency. We need to balance throughput optimization with the <5 minute latency requirement.

⭐ **Recommended: Adaptive micro-batching with dual triggers**

Flush batches when **either** condition is met:
- Time trigger: 30 seconds since first record in batch
- Size trigger: 5,000 records accumulated

```
Kafka → [In-memory buffer] → Snowflake
         ↓
         Flush on:
         • 30s timeout
         • 5K records
         (whichever first)
```

**Rationale**: 
- 30s time cap ensures worst-case latency stays well under 5 minutes (even with transformation + network overhead)
- 5K size trigger optimizes for Snowflake's bulk loading sweet spot when traffic is high
- During low-traffic periods, time trigger prevents indefinite waiting
- Adaptive behavior handles both peak and off-peak loads efficiently

❌ **Alternatives considered**:

- **Fixed small batches (100 records)**: Guarantees low latency but creates excessive Snowflake API calls (high cost, poor throughput). Rejected because cost/performance ratio is poor.
  
- **Fixed time-only (every 60s)**: Simpler logic but misses throughput optimization during high-volume periods. Rejected because we'd waste Snowflake's bulk loading capabilities.

- **Size-only (10K records)**: Maximizes Snowflake efficiency but could violate latency SLA during slow periods. Rejected because latency is the primary goal.

---

1. ✅ Accept and move to decision 2
2. ✏️ Type a correction