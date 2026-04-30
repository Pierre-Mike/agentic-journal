# Design

Insert a local-CI gate between the slice agent and the push step in `slice.yml`. Two new TypeScript modules own the gate logic; `slice.yml` becomes a thin shell wrapper.

## Approach

```
slice.yml
  └─ bun scripts/slice/loop.ts
        │
        ├─ 1. runAgent()           (Claude spec-implementer invocation, extracted from slice.yml)
        │
        ├─ 2. validateBoundary()   (existing contract, called once after agent writes files)
        │       violation → RED path
        │
        ├─ 3. runLocalCi()         (scripts/slice/local-ci.ts)
        │       mirrors ci.yml steps in order, fail-fast
        │       writes /tmp/local-ci/<step>.{stdout,stderr,exit}
        │       clears /tmp/local-ci/ at loop start
        │
        ├─ GREEN path (boundary ok + all CI steps pass)
        │       └─ pushWithRetry(branch)   (push-with-retry logic extracted from slice.yml)
        │
        └─ RED path (boundary violation OR any CI step fails)
                ├─ git commit WIP → wip/<slug>-<sha7>
                ├─ gh issue create  slice-stuck: <slug> step=<failed-step>
                │   body: last 100 lines stdout + full stderr, ≤50 KB
                │   label: slice-stuck (created if missing)
                └─ exit 0
```

### local-ci.ts step order (mirrors ci.yml)

```
1. typecheck    — tsc --noEmit
2. lint:ci      — biome check
3. spec:lint    — bun scripts/spec-lint.ts
4. tasks:verify — bun scripts/tasks-verify.ts
5. test         — bun test
6. gate         — bun test <gatePath>
```

`gatePath` is passed explicitly from `loop.ts` (read from tasks.md). `local-ci.ts` does not parse tasks.md itself.

### Injectable executor interface

`runLocalCi` accepts an optional `executor` callback so tests can mock each step without spawning processes. The default executor shells out to the real commands.

`runLoop` accepts optional injected dependencies (`runAgent`, `runLocalCi`, `pushWithRetry`, `commitWip`, `openSliceStuckIssue`, `validateBoundary`) for the same reason.

## Files touched

- `scripts/slice/local-ci.ts` — new: fail-fast step runner, artifact writes, injectable executor
- `scripts/slice/loop.ts` — new: orchestrator; owns push-with-retry and RED path; calls local-ci.ts and validateBoundary
- `.github/workflows/slice.yml` — replace "Implement slice via Claude" + "Push with retry" steps with `bun scripts/slice/loop.ts`

## Decisions

- **push-with-retry lives in loop.ts** — loop.ts must own the GREEN/RED branch; if push were a separate yml step it would have to re-read the loop outcome, introducing a coordination seam. Extracted from slice.yml's shell step.
- **wip/<slug>-<sha7> branch naming** — deterministic, human-readable, collision-free across reruns. Timestamp alternative rejected (instability, cross-second collisions).
- **boundary check at end-of-loop** — running before the agent catches nothing; running mid-loop (between agent and local-ci) duplicates the RED path handling that local-ci already provides. End-of-loop is the natural TDD position (write code, verify scope).
- **gatePath as explicit argument to local-ci.ts** — keeps local-ci.ts as a pure executor; spec-parsing belongs in loop.ts which already reads tasks.md for the boundary list.

## Risks

- `slice.yml` env var threading: `loop.ts` needs `CLAUDE_CODE_OAUTH_TOKEN` and `GH_TOKEN` forwarded via the yml `env:` block. Missing vars are a silent failure risk; mitigated by asserting their presence at loop.ts startup.

## Out of scope

- Fix-agent, doctor.yml, cross-PR self-healing track.
- Changes to `validateBoundary` function contract.
- `scripts/slice/loop.test.ts` and `scripts/slice/local-ci.test.ts` are colocated unit tests written as per-slice gates (Step 6), not at scaffold.
