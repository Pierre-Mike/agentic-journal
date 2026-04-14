# Non-obvious Decisions

Here's what's coming:
1. Snowflake write strategy
2. Kafka offset commit timing
3. Failure handling and retries
4. Exactly-once vs at-least-once semantics

---

## Decision 1: Snowflake write strategy

**The problem**: Snowflake has multiple ingestion paths with different latency/cost/complexity tradeoffs. The choice determines whether we can meet the 5-minute latency target and how much we pay for it.

### ⭐ Recommended: Snowpipe Streaming API

Use the Snowpipe Streaming API with micro-batches (100-500 records or 10-30 seconds, whichever comes first).

**Why:**
- Sub-minute end-to-end latency (typically 30-90 seconds from ingest to queryable)
- No staging files in S3 — direct append to Snowflake tables
- Pay only for compute used during ingestion (serverless, scales automatically)
- Handles backpressure gracefully — if Snowflake slows down, we buffer in the transformation layer
- Native support for offset tracking (can sync Kafka offsets with Snowflake state)

```
Kafka → [Transform worker] → Snowpipe Streaming API → Snowflake table
                ↓                      ↓
          micro-batch             channel per partition
          (100-500 rec)           (auto-managed)
```

### ❌ Alternatives considered

**REST API with INSERT batches**
- Latency: Each INSERT is a full transaction (5-15 seconds minimum)
- Cost: Very expensive for high-frequency small batches (charged per query)
- Bottleneck: Cannot sustain continuous 5-minute latency at scale
- Rejected because: transaction overhead makes sub-5-minute infeasible

**Snowpipe with S3 staging**
- Latency: Must write to S3, then Snowpipe polls every 1-5 minutes
- Complexity: Requires S3 bucket, file rotation logic, SQS notifications
- Cost: S3 storage + Snowpipe compute + potential small-file problems
- Rejected because: multi-stage delay makes <5 minutes unreliable, adds moving parts

**Bulk COPY every N minutes**
- Latency: Fixed delay = batch interval (if we run every 5 min, worst case is 10 min old data)
- Throughput: Good for large volumes, but contradicts "near-real-time" goal
- Rejected because: batch mentality defeats the purpose of moving off daily loads

---

1. ✅ Accept and move to decision 2
2. ✏️ Type a correction