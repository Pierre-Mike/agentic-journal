## Straightforward Details — Group 3: Secrets Management

```
GitHub Repository Secrets
├── PROD_*                    Production secrets
├── STAGING_*                 Staging secrets  
└── SHARED_*                  Cross-environment (API keys, etc.)
        ↓
   CI/CD Workflow
   ├── Inject via env vars
   ├── Scope by environment
   └── Never logged/exposed
        ↓
   Deployment Targets
   ├── Production    (PROD_* + SHARED_*)
   └── Staging       (STAGING_* + SHARED_*)
```

**Decisions:**

- **Storage**: GitHub repository secrets (native, scoped per environment, encrypted at rest)
- **Naming**: Environment prefix (`PROD_`, `STAGING_`, `SHARED_`) for clear scoping
- **Access**: Injected as environment variables in workflow steps, scoped to job context
- **Shared secrets**: API keys, external service tokens stored once with `SHARED_` prefix
- **Rotation**: Manual rotation via GitHub UI, no automation (straightforward for small team)
- **Local dev**: `.env.local` files (gitignored), developers maintain their own copies

---

1. ✅ Accept and move to Group 4 (CI workflow structure)
2. ✏️ Type a correction