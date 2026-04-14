# 🎯 Big Picture

We'll split the monolithic UserController into two focused controllers by extracting auth operations while preserving existing service layer logic.

**Current state:**
```
/users/login         ┐
/users/signup        │
/users/reset-pwd     ├─> UserController (800 lines)
/users/profile       │    ├─ auth methods
/users/:id/update    ┘    └─ profile methods
```

**Target state:**
```
/auth/login          ┐
/auth/signup         ├─> AuthController
/auth/reset-password ┘    └─ authentication flows
                           └─ token/session management

/users/profile       ┐
/users/:id           ├─> UserController
/users/:id/update    ┘    └─ profile CRUD
```

Both controllers share the existing UserService layer — no service refactoring needed. Route definitions move to match their controller. Middleware (auth guards, validation) stays in place, just applied to the new route paths.

---

1. ✅ Yes, move to straightforward details
2. ✏️ Type a correction