## Big Picture (Updated)

The system fans out a single notification event into four independent delivery channels: **email**, **SMS**, **push**, and **WhatsApp Business API**. Each channel gets its own SQS queue and worker fleet. User preferences determine which channels receive the notification. Each worker handles retries, idempotency, and channel-specific rate limits (particularly important for WhatsApp, which has strict and complex throttling rules).

```
┌─────────────────┐
│  Notification   │
│   Event (SNS)   │
└────────┬────────┘
         │
    ┌────┴────┬────────┬────────┬────────┐
    │         │        │        │        │
    ▼         ▼        ▼        ▼        ▼
┌───────┐ ┌─────┐ ┌──────┐ ┌──────────┐
│ Email │ │ SMS │ │ Push │ │ WhatsApp │
│ Queue │ │Queue│ │Queue │ │  Queue   │
└───┬───┘ └──┬──┘ └───┬──┘ └────┬─────┘
    │        │        │         │
    ▼        ▼        ▼         ▼
┌───────┐ ┌─────┐ ┌──────┐ ┌──────────┐
│ Email │ │ SMS │ │ Push │ │ WhatsApp │
│Workers│ │Work │ │Worker│ │ Workers  │
│       │ │ ers │ │  s   │ │          │
└───────┘ └─────┘ └──────┘ └──────────┘
```

SNS fanout filters by user preferences before queuing — if a user has WhatsApp disabled, their notification never enters that queue. Workers pull from their respective queues, call the channel provider API, and handle delivery receipts. WhatsApp workers implement token-bucket rate limiting to stay within API quotas.

---

1. ✅ Accept and move to straightforward details
2. ✏️ Type a correction