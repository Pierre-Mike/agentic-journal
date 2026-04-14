# Non-obvious Decisions

Here's what's coming:

1. **Kafka offset commit timing** — when to acknowledge messages as processed
2. **Micro-batch window size** — how many events to accumulate before writing to Snowflake
3. **Failure handling strategy** — what happens when Snowflake writes fail
4. **Deduplication approach** — how to handle duplicate events

---

## Decision 1: Kafka Offset Commit Timing

**The problem**: When we commit Kafka offsets determines our delivery guarantee. Commit too early (before Snowflake confirms the write) and we risk data loss on failure. Commit too late (after Snowflake write) and we risk duplicate processing on consumer restart.

### ⭐ Recommended: Commit after Snowflake write completes (at-least-once delivery)

**Why this approach:**
- Guarantees no data loss — if Snowflake write fails, we retry the same Kafka message
- Simple to implement — linear flow, no transaction coordinators needed
- Duplicates are acceptable because we handle them at write time (see Decision 4)
- Snowflake writes are idempotent when using MERGE with dedup keys

```
┌─────────┐    ┌─────────────┐    ┌───────────┐
│ Consume │───▶│ Transform & │───▶│ Snowflake │
│ batch   │    │ write to SF │    │ confirms  │
└─────────┘    └─────────────┘    └─────┬─────┘
                                         │
                                         ▼
                                  ┌──────────────┐
                                  │ Commit offset│
                                  └──────────────┘
```

### ❌ Alternatives considered

**Commit before Snowflake write (at-most-once)**
- Risk: Message loss if consumer crashes between commit and Snowflake write
- Unacceptable for data warehouse — missing records breaks analytics

**Exactly-once with transaction coordinator**
- Requires Kafka transaction support + Snowflake transaction isolation
- Snowflake's ACID guarantees don't extend to external transaction coordinators
- Massive complexity increase (distributed transactions, 2PC) for marginal benefit
- Better to accept occasional duplicates and handle at write time

---

1. ✅ Accept and move to decision 2
2. ✏️ Type a correction