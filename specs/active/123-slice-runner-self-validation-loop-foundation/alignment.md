---
created: 2026-04-30
status: confirmed
confidence: high
intent_hash: 3f8abc6f7ead
---

## Goal

Add a self-validation loop wrapper around the slice runner so that local CI checks (typecheck, lint, spec lint, tasks verify, test, and the slice's own gate test) run before any push to `auto/X`. On a GREEN run all checks pass and the existing push-with-retry logic fires. On a RED run the loop must NOT push to `auto/X`; instead it commits WIP to `wip/<slug>-<sha7>`, opens a `slice-stuck` GitHub issue containing the failed step's stdout/stderr (capped at 50 KB), and exits 0. This eliminates the 5–10 minute CI-roundtrip cost of catching failures that could be detected locally, and is the foundational layer for the broader self-healing pipeline (fix-agent, doctor.yml, cross-PR track come in subsequent specs).

## Big Picture

The current flow pushes unconditionally after the slice agent runs. The new flow inserts a local-CI gate between the slice agent and the push:

```
slice.yml
  └─ bun scripts/slice/loop.ts
        │
        ├─ 1. run slice agent (existing logic, moved in)
        │
        ├─ 2. run scripts/slice/local-ci.ts
        │       mirrors ci.yml steps in order, fail-fast
        │       writes /tmp/local-ci/<step>.{stdout,stderr,exit}
        │       runs the slice's gate test as final step
        │
        ├─ GREEN path (all checks pass)
        │       └─ push to auto/X (push-with-retry logic, moved in)
        │
        └─ RED path (any check fails)
                ├─ commit WIP to wip/<slug>-<sha7>
                ├─ open slice-stuck issue
                │   (last 100 lines stdout + full stderr, <=50KB)
                └─ exit 0 (auto/X not advanced)

        Boundary check (validateBoundary) runs once at end-of-loop
        against the slice's declared task boundary.
```

Key files:
- `scripts/slice/loop.ts` — new bounded loop wrapper (owns push-with-retry)
- `scripts/slice/local-ci.ts` — local mirror of ci.yml, fail-fast, writes /tmp artifacts
- `scripts/slice/loop.test.ts` — unit tests for GREEN/RED paths
- `scripts/slice/local-ci.test.ts` — unit tests for step execution and artifact writes
- `.github/workflows/slice.yml` — wired to invoke loop.ts instead of direct agent dispatch

## Straightforward Details

### loop.ts responsibilities
- Accept the same inputs slice.yml currently passes to the agent
- Invoke the slice agent (existing logic extracted in)
- Call local-ci.ts after agent completes
- GREEN: call push-with-retry (existing logic extracted in)
- RED: commit WIP to `wip/<slug>-<sha7>`, open slice-stuck issue, exit 0
- Run validateBoundary once at end-of-loop against current slice's boundary list

### local-ci.ts step order (mirrors ci.yml)
```
1. typecheck      (tsc --noEmit)
2. lint:ci        (biome check)
3. spec:lint      (bun scripts/spec-lint.ts or equivalent)
4. tasks:verify   (bun scripts/tasks-verify.ts)
5. test           (bun test)
6. gate test      (bun test <slice-gate-path>)
```
- Fail-fast: stop at first failing step
- Each step writes /tmp/local-ci/<step>.stdout, /tmp/local-ci/<step>.stderr, /tmp/local-ci/<step>.exit
- /tmp/local-ci/ is cleared at start of each loop.ts run

### slice-stuck issue content
- Title: `slice-stuck: <slug> step=<failed-step>`
- Body: last 100 lines of stdout + full stderr for the failed step, capped at 50KB total
- Label: `slice-stuck` (created if missing)
- Opened via `gh issue create`

### slice.yml changes
- Remove: "Implement slice via Claude" step and "Push with retry" step
- Add: `bun scripts/slice/loop.ts` invocation with same env vars/inputs those steps consumed

### Boundary check
- Uses existing `validateBoundary` function (unchanged contract)
- Runs once, at end of loop.ts, after the agent has written its files
- A boundary violation is treated as a RED path failure (commits WIP, opens issue)

### Test strategy (colocated, constitution §8)
```
scripts/slice/
  loop.ts
  loop.test.ts        ← GREEN path: mock local-ci returns ok, verifies push called
                         RED path: mock local-ci returns fail, verifies wip commit + issue
  local-ci.ts
  local-ci.test.ts    ← step execution: verifies artifact writes, fail-fast behavior
```

## Non-obvious Decisions

### Where push-with-retry logic lives

- Recommended: Extract push-with-retry from slice.yml's shell step into loop.ts directly. This keeps loop.ts as the single authority over what happens after local CI, makes retry behavior testable in loop.test.ts, and avoids split ownership between a YAML step and a TypeScript module. The slice.yml step becomes a thin `bun scripts/slice/loop.ts` invocation.
- Alternative rejected: Keep push-with-retry as a separate yml step after loop.ts. Rejected because loop.ts must own the RED-vs-GREEN branch decision; if push is outside loop.ts, the yml must re-read the outcome, adding a coordination seam.

### wip branch naming format

- Recommended: `wip/<slug>-<sha7>` where `<sha7>` is the first 7 characters of the HEAD commit SHA at the time loop.ts detects failure. This is deterministic, human-readable, and avoids collisions across reruns of the same spec slice.
- Alternative rejected: `wip/<slug>-<timestamp>`. Timestamp is less stable for debugging (two runs at the same second collide; timestamps are harder to correlate to git log than SHAs).

### boundary check placement (start vs end of loop)

- Recommended: Run validateBoundary at the END of loop.ts (after the slice agent has written its files, before the push decision). This matches the intent in the issue — "boundary check runs once at end-of-loop" — and mirrors the natural TDD flow (write code, then verify scope). Running it before the agent would catch nothing useful.
- Alternative rejected: Run it before local-ci. Rejected because if the agent hasn't run yet, there are no new files to check; and running it mid-loop (between agent and local-ci) introduces an ordering split where boundary violation handling must duplicate the RED path logic that local-ci already triggers.

### local-ci.ts gate-test step identification

- Recommended: Accept the slice's gate file path as an explicit argument to local-ci.ts (passed by loop.ts from tasks.md). This makes the gate-test step deterministic and testable without file-system inference.
- Alternative rejected: Auto-detect gate file from tasks.md inside local-ci.ts. Rejected because local-ci.ts should be a pure executor (steps + paths as inputs); spec-parsing logic belongs in loop.ts, which already reads tasks.md to get the boundary list.
