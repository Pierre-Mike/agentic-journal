🔍 I looked into WhatsApp Business API rate limits before updating the big picture. Key findings:

- **Tiered daily limits**: Starts at 250-1K messages/day, scales to 10K/100K/unlimited based on verification + quality rating + utilization (must use 50% of current tier to advance)
- **Throughput limits**: 80 messages/second default per phone number, upgradeable to 1,000 MPS when eligible
- **Dynamic pacing**: WhatsApp batches large campaigns and monitors feedback signals; can pause remaining batches if quality drops

---

## Updated Big Picture

The system uses a **fanout-on-write pattern** where a central orchestrator receives notification requests and fans them out to channel-specific SQS queues (email, SMS, push, WhatsApp). Each channel has dedicated workers that enforce delivery guarantees and handle channel-specific constraints.

```
┌─────────────────┐
│ Notification    │
│ API             │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Fanout          │──────► DynamoDB (user preferences)
│ Orchestrator    │
└────────┬────────┘
         │
    ┌────┴────┬──────────┬──────────┐
    ▼         ▼          ▼          ▼
┌───────┐ ┌───────┐ ┌───────┐ ┌─────────┐
│ Email │ │  SMS  │ │ Push  │ │WhatsApp │
│ Queue │ │ Queue │ │ Queue │ │  Queue  │
└───┬───┘ └───┬───┘ └───┬───┘ └────┬────┘
    │         │          │          │
    ▼         ▼          ▼          ▼
┌───────┐ ┌───────┐ ┌───────┐ ┌─────────┐
│ Email │ │  SMS  │ │ Push  │ │WhatsApp │
│Workers│ │Workers│ │Workers│ │ Workers │
└───────┘ └───────┘ └───────┘ └─────────┘
                                    │
                                    ▼
                         ┌──────────────────┐
                         │ Rate Limit       │
                         │ Tracker          │
                         │ (MPS + daily cap)│
                         └──────────────────┘
```

**Flow**: API receives request → Orchestrator queries user preferences → Creates messages for opted-in channels → Workers poll queues → Deliver via channel providers → Update delivery status

**WhatsApp distinction**: Workers enforce both throughput (80-1K MPS per phone) and tiered daily limits (250/1K/10K/100K), track quality metrics, and handle dynamic pacing from WhatsApp's batch feedback system.

---

1. ✅ Yes, move to straightforward details
2. ✏️ Type a correction

---

Sources:
- [WhatsApp Business API Pricing: Complete Guide (2026) - Spur](https://www.spurnow.com/en/blogs/whatsapp-business-api-pricing-explained)
- [WhatsApp 2026 Updates: Pacing, Limits & Usernames - Sanuker](https://sanuker.com/whatsapp-api-2026_updates-pacing-limits-usernames/)
- [WhatsApp Rate Limits for Developers: Tiers, TPS, Fixes](https://www.fyno.io/blog/whatsapp-rate-limits-for-developers-a-guide-to-smooth-sailing-clycvmek2006zuj1oof8uiktv)
- [Messaging Limits - WhatsApp Business Platform - Documentation - Meta for Developers](https://developers.facebook.com/docs/whatsapp/messaging-limits/)