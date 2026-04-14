## Straightforward Details — Group 3: Secrets Management

```
┌─────────────────────────────────────────────────────────────┐
│                    Secrets Management Flow                   │
└─────────────────────────────────────────────────────────────┘

 Developer Local          CI/CD Platform           Cloud Provider
 ───────────────          ──────────────           ──────────────
                                                                  
 .env.example    ──┐                                             
 (template)       │                                              
                  │                                              
 .env.local       │      GitHub Secrets      ──▶  AWS Secrets   
 (gitignored)     │      ───────────────           Manager       
                  │      • NPM_TOKEN                ──────────   
                  │      • AWS_ACCESS_KEY                        
 .env.example ◀───┘      • AWS_SECRET_KEY          • DB_PASSWORD 
 documented             • AWS_REGION              • API_KEYS     
 in README                                         • TOKENS      
                        injected at                              
                        build/deploy              fetched at     
                        as env vars               runtime        
```

**Secrets are managed in three tiers:**

- Build-time secrets (NPM_TOKEN, registry credentials) stored in GitHub Secrets and injected during CI runs
- Deploy-time secrets (AWS credentials, deployment keys) stored in GitHub Secrets and used by deployment workflows
- Runtime secrets (database passwords, API keys, encryption keys) stored in AWS Secrets Manager and fetched by applications on startup
- Local development uses `.env.local` files (gitignored) with `.env.example` templates committed to the repo
- Each environment (dev/staging/prod) has isolated secret namespaces with no cross-environment access
- Secret rotation happens in AWS Secrets Manager with automatic propagation to running services via restart hooks

---

1. ✅ Accept and move to Group 4 (CI workflow structure)
2. ✏️ Type a correction