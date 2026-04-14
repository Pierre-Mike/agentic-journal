## Big Picture (Updated)

The system follows a **fanout-to-queue pattern**: when a notification event arrives, we fan out to four channel-specific SQS queues (email, SMS, push, WhatsApp), then independent workers consume from each queue and deliver via the respective provider.

**WhatsApp is special** — it has strict tiered rate limits and 24-hour messaging windows. The WhatsApp worker needs a token-bucket throttler to respect these limits without losing messages or overwhelming the queue with retries.

```
┌─────────────┐
│   Event     │ (user_id, message, preferences)
│  Ingestion  │
└──────┬──────┘
       │
       ├─────────┐ fanout (filter by user prefs)
       │         │
   ┌───▼───┐ ┌──▼────┐ ┌──────▼─┐ ┌────────▼─────┐
   │ Email │ │  SMS  │ │  Push  │ │   WhatsApp   │
   │ Queue │ │ Queue │ │ Queue  │ │    Queue     │
   └───┬───┘ └───┬───┘ └───┬────┘ └────┬─────────┘
       │         │          │            │
   ┌───▼───┐ ┌──▼────┐ ┌───▼────┐ ┌────▼─────────┐
   │Email  │ │ SMS   │ │ Push   │ │  WhatsApp    │
   │Worker │ │Worker │ │Worker  │ │ Worker       │
   │       │ │       │ │        │ │ (throttled)  │
   └───┬───┘ └───┬───┘ └───┬────┘ └────┬─────────┘
       │         │          │            │
   ┌───▼────────────────────▼────────────▼──────┐
   │     Provider APIs (SendGrid, Twilio,       │
   │      FCM/APNs, WhatsApp Business API)      │
   └────────────────────────────────────────────┘
```

User preferences stored in DynamoDB determine which queues receive the fanout. Each worker retries with exponential backoff and moves poison messages to a DLQ after exhaustion. The WhatsApp worker additionally enforces a token bucket to stay within provider tier limits.

---

1. ✅ Accept and move to straightforward details
2. ✏️ Type a correction