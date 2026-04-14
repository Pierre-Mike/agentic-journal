# Big Picture

We'll extract authentication methods from `UserController` into a new `AuthController`, each with its own route prefix. Auth operations (login, signup, password reset, token refresh) move to `/auth/*` routes handled by `AuthController`. Profile operations (get profile, update profile, delete account) stay at `/users/*` routes handled by `UserController`. Both controllers will share access to the same underlying `UserService` for data operations, but each controller owns its own domain of HTTP endpoints.

```
Current State                      Target State
┌─────────────────────┐           ┌──────────────────┐  ┌──────────────────┐
│  UserController     │           │ AuthController   │  │ UserController   │
│  (800 lines)        │           │                  │  │                  │
│                     │           │  POST /auth/     │  │  GET  /users/    │
│  POST /users/login  │    ──►    │       login      │  │       profile    │
│  POST /users/signup │           │       signup     │  │  PUT  /users/    │
│  POST /users/reset  │           │       reset      │  │       profile    │
│  GET  /users/me     │           │       refresh    │  │  DELETE /users/  │
│  PUT  /users/me     │           │                  │  │         me       │
│  DELETE /users/me   │           └────────┬─────────┘  └────────┬─────────┘
└──────────┬──────────┘                    │                     │
           │                               │                     │
           │                               └──────────┬──────────┘
           │                                          │
           ▼                                          ▼
    ┌─────────────┐                          ┌─────────────┐
    │ UserService │                          │ UserService │
    │             │                          │ (unchanged) │
    └─────────────┘                          └─────────────┘
```

The routing configuration splits into two registration blocks—one for auth routes, one for user routes—each pointing to its respective controller.

1. ✅ Yes, move to straightforward details
2. ✏️ Type a correction