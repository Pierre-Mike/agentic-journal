# Tasks

Ordered checklist. Each task declares its `agent`, `depends`, `file_targets`.

- [x] 1. Write RED unit tests in `expertise-consolidate.test.ts` covering `parseEntries`, `dedupeByHash`, `pruneByAge`, `serialize`. Tests import from `./expertise-consolidate.ts` and fail because the module does not yet export those symbols.
  - agent: main
  - depends: []
  - file_targets: [scripts/expertise-consolidate.test.ts]
- [x] 2. Implement the four pure fns in `scripts/expertise-consolidate.ts` to make task 1 tests GREEN.
  - agent: main
  - depends: [1]
  - file_targets: [scripts/expertise-consolidate.ts]
- [x] 3. Add `consolidateFile` IO helper + CLI (`bun scripts/expertise-consolidate.ts <path> [--max-age-days N] [--dry-run]`) to the same file.
  - agent: main
  - depends: [2]
  - file_targets: [scripts/expertise-consolidate.ts]
- [x] 4. Replace the RED stub in `scripts/smoke-expertise-consolidate.ts` with a real fixture harness (`mkdtempSync` + known dup + stale + fresh entries). Assert kept/dropped counts AND byte-identical output after a second run (idempotency).
  - agent: main
  - depends: [3]
  - file_targets: [scripts/smoke-expertise-consolidate.ts]

Task box ticking happens via `scripts/tasks-verify.ts`, not manually.

Full-suite validation (`bun run check`, `bun run spec:lint`, `bun run tasks:verify`)
is not encoded as its own task — it is already required by `spec:complete`'s gate
step before archive. Keeping it as a task would leave the box permanently
unticked (no `file_targets` to verify against).
