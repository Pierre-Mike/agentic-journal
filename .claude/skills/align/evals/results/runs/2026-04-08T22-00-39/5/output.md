# Big Picture

The system uses **local-first architecture** with a CRDT (Conflict-free Replicated Data Type) to synchronize edits. Each client maintains a full copy of the document and merges changes automatically. A Node.js WebSocket server broadcasts updates between connected clients and persists snapshots. When users go offline, they continue editing locally; when they reconnect, the CRDT reconciles changes without conflicts.

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser Clients                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Editor UI    │  │ Editor UI    │  │ Editor UI    │       │
│  │ + CRDT doc   │  │ + CRDT doc   │  │ + CRDT doc   │       │
│  │ + IndexedDB  │  │ + IndexedDB  │  │ + IndexedDB  │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                  │                  │               │
│         └──────────────────┼──────────────────┘               │
│                            │ WebSocket                        │
└────────────────────────────┼──────────────────────────────────┘
                             │
                    ┌────────▼─────────┐
                    │  Node.js Server  │
                    │  - WebSocket hub │
                    │  - Broadcast ops │
                    │  - Auth/sessions │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │   Persistence    │
                    │  (Postgres/Mongo)│
                    │  - Doc snapshots │
                    │  - Update log    │
                    └──────────────────┘

Flow:
1. User types → CRDT generates operation → saved locally (IndexedDB)
2. If online → send op via WebSocket → server broadcasts to others
3. Receiving clients apply op to their CRDT → UI updates
4. Server periodically persists CRDT state
5. Offline edits queue locally → sync when reconnected
```

**Technology anchor**: Yjs (CRDT library) with y-websocket provider handles the hard parts — operational transformation, conflict resolution, and cursor/presence awareness are built in.

---

1. ✅ Yes, move to straightforward details
2. ✏️ Type a correction