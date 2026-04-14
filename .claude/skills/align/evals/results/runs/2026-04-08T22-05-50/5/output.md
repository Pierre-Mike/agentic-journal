🔍 I looked into collaborative editing approaches before proposing the big picture. Key findings:

- **CRDTs** (Conflict-free Replicated Data Types) are the right choice over Operational Transform for this use case — they're easier to implement correctly, work better for offline support, and don't require a central server to resolve conflicts
- **Yjs** is the dominant Node.js CRDT library in 2026 — fast, well-documented, specifically designed for text collaboration, and battle-tested in production
- **Architecture pattern**: CRDT handles document merging, WebSocket handles real-time sync, separate channel for ephemeral presence data (cursors)

---

## Big Picture

The system uses **Yjs (CRDT library)** for document state management, a **Node.js WebSocket server** for real-time synchronization, and **IndexedDB on the client** for offline support. Each client maintains a local copy of the document that auto-merges changes from others. When online, clients sync via WebSocket; when offline, they continue editing locally and sync when reconnected. Cursor positions and presence are sent as separate ephemeral messages (not persisted).

```
┌─────────────┐         WebSocket          ┌──────────────┐
│   Client A  │◄──────────────────────────►│              │
│  (Browser)  │   • Document updates       │   Node.js    │
│             │   • Cursor positions       │   Server     │
│  ┌────────┐ │                            │              │
│  │  Yjs   │ │                            │  ┌────────┐  │
│  │  Doc   │ │                            │  │  Yjs   │  │
│  └────────┘ │                            │  │  Doc   │  │
│  ┌────────┐ │                            │  └────────┘  │
│  │IndexedDB│ │                            │  ┌────────┐  │
│  └────────┘ │                            │  │Database│  │
└─────────────┘                            │  │(Postgres)│ │
                                           │  └────────┘  │
┌─────────────┐         WebSocket          │              │
│   Client B  │◄──────────────────────────►│              │
│  (Browser)  │   • Document updates       └──────────────┘
│             │   • Cursor positions       
│  ┌────────┐ │                            
│  │  Yjs   │ │    Offline? Keep editing.
│  │  Doc   │ │    Reconnect? Auto-merge.
│  └────────┘ │                            
│  ┌────────┐ │                            
│  │IndexedDB│ │                            
│  └────────┘ │                            
└─────────────┘                            
```

Flow: Client opens document → loads from IndexedDB (if cached) + server → edits locally → Yjs generates updates → sends to server → server broadcasts to other clients → clients merge updates automatically → no conflicts, always converges.

1. ✅ Yes, move to straightforward details  
2. ✏️ Type a correction

---

**Sources:**
- [How to Build Real-Time Collaborative Editing in Node.js](https://oneuptime.com/blog/post/2026-01-23-realtime-collaborative-editing-nodejs/view)
- [Building real-time collaboration applications: OT vs CRDT](https://www.tiny.cloud/blog/real-time-collaboration-ot-vs-crdt/)
- [I was wrong. CRDTs are the future](https://josephg.com/blog/crdts-are-the-future/)
- [GitHub - yjs/yjs](https://github.com/yjs/yjs)
- [Best CRDT Libraries 2025 | Real-Time Data Sync Guide](https://velt.dev/blog/best-crdt-libraries-real-time-data-sync)
- [In practice most projects seem to use Yjs rather than Automerge](https://news.ycombinator.com/item?id=41012895)