## Straightforward Details — Group 3: Secrets Management

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Repository                         │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │          GitHub Secrets (per environment)          │    │
│  │                                                     │    │
│  │  PROD_*        STAGING_*        DEV_*              │    │
│  │  ├─ DB_URL     ├─ DB_URL        ├─ DB_URL         │    │
│  │  ├─ API_KEY    ├─ API_KEY       ├─ API_KEY        │    │
│  │  └─ ...        └─ ...           └─ ...            │    │
│  └────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│  ┌────────────────────────────────────────────────────┐    │
│  │              CI Workflow (Actions)                  │    │
│  │    Reads secrets based on target environment        │    │
│  └────────────────────────────────────────────────────┘    │
│                           │                                  │
└───────────────────────────┼──────────────────────────────────┘
                            ▼
              ┌─────────────────────────────┐
              │   Deployed Application       │
              │  (receives as env vars)      │
              └─────────────────────────────┘
```

**Decisions:**

- GitHub Secrets store all environment-specific secrets with `{ENV}_` prefix (e.g., `PROD_DB_URL`, `STAGING_API_KEY`)
- CI workflow injects secrets as environment variables based on deployment target
- `.env.example` documents all required secrets with placeholder values, committed to repo
- No actual secret values in code, config files, or committed `.env` files
- Secrets rotation handled manually via GitHub Settings → Secrets and variables → Actions

---

1. ✅ Accept and move to Group 4 (build and test pipeline)
2. ✏️ Type a correction