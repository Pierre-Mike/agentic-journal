# Tester review — 037-worktree-ports (attempt 1)

**Verdict**: FAIL

## Rubric

### 1. Acceptance criterion coverage
PARTIAL — UNCLEAR for AC10.

Mapping:
- AC1 (`openWorktree` /not on main/) → `openWorktree returns ok:false with reason /not on main/ when not on main branch` ✓
- AC2 (`openWorktree` /uncommit/) → `openWorktree returns ok:false with reason /uncommit/ when there are uncommitted changes` ✓
- AC3 (`openWorktree` /already exists/) → `openWorktree returns ok:false with reason /already exists/ when worktree dir exists` ✓
- AC4 (`openWorktree` happy path) → `openWorktree returns ok:true with path on happy path (fresh branch, clean main)` ✓
- AC5 (reuses existing branch, skips `-b`) → `openWorktree reuses existing branch (skips -b flag) when branch already exists` ✓
- AC6 (`closeWorktree` missing slug / no dir + not merged → false) → `closeWorktree returns ok:false when worktree dir missing and branch not merged` ✓
- AC7 (`closeWorktree` /not merged/) → `closeWorktree returns ok:false with reason /not merged/ when branch is not merged into main` ✓
- AC8 (`closeWorktree` /uncommitted/) → `closeWorktree returns ok:false with reason /uncommitted/ when worktree has dirty status` ✓
- AC9 (`closeWorktree` happy path) → `closeWorktree returns ok:true on happy path (worktree present, clean, branch merged)` ✓
- AC10 (smoke spawns real `worktree-open.ts` then `worktree-close.ts` and asserts dir created/removed) → **NOT ENCODED**. `smoke-worktree-ports.ts` is a 2-line RED stub (`process.exit(1)`). The assertions described in AC10 live in a JSDoc comment, not in code. When the implementer flips this RED to GREEN, they author the assertion logic themselves — that is exactly the test-author/implementer collusion window the judge/tester split exists to prevent.

### 2. Adversarial gap
YES — concrete vector.

Because the smoke gate is a stub (no assertions), an implementer can satisfy AC10 with any script that exits 0. Trivial pass: `process.exit(0)` after a no-op, or spawning `worktree-open.ts` with `--help` and never validating that a real worktree directory was created or torn down. The unit fakes (which never call `Bun.spawn`) cannot catch a regression in the real `realProcess` / `realFs` adapters wiring; the smoke is the *only* gate that exercises the live spawn path, and right now it asserts nothing. Real-git coverage the proposal explicitly says is being preserved here is, in fact, not preserved by the gate as written.

Secondary minor vector on the unit side: the fake `proc.run` returns `{ ok: true, stdout: "" }` for unscripted commands (default-allow). An implementation that swaps the order of preflight checks or skips one entirely could still pass — e.g., the "not on main" test only scripts `git status` + `git branch`, so an implementation that never calls `git branch --show-current` and instead hard-codes a result could still match the expected reason. Not a strong vector (the policy must read branch from somewhere) but worth noting; the chosen default-allow fake is generous.

### 3. Coverage gap
YES.

Uncovered testable properties:
- **Smoke assertions are absent from the gate.** The integration gate must, as committed test code, observe the worktree directory's creation after `worktree-open` and its removal after `worktree-close`. Currently both observations are described in prose only. This is the property AC10 names.
- **Smoke must skip-or-fail deterministically when main is dirty.** The JSDoc says "skip gracefully if not [clean]" but no assertion or skip path exists in code; an implementer writing GREEN can choose any policy.
- **Constraint: zero `Bun.spawn` in unit tests.** The proposal's Constraints section names this. The two unit files do not import `Bun.spawn`, which is good — but there is no static check pinning that constraint (e.g., a grep-style assertion in the smoke or a dedicated guard). Minor; arguably out of scope for behavioral tests, but the Constraints line elevates it. Listing as an uncovered property the tester may choose to address or explicitly waive.

### 4. Behavior vs implementation detail
PARTIAL — UNCLEAR.

The unit tests pin command strings as map keys, e.g.:

```ts
[`git show-ref --verify --quiet refs/heads/${BRANCH}`]: { ok: false, stdout: "" },
[`git worktree add ${WORKTREE_PATH} -b ${BRANCH} main`]: { ok: true, stdout: "" },
"bun install --frozen-lockfile": { ok: true, stdout: "" },
```

These are exact-string matches against the command argv that the policy must invoke. That is implementation-shape coupling: a future refactor that reorders flags (`-b ${BRANCH}` before path) or substitutes an equivalent plumbing command (`git rev-parse --verify` instead of `git show-ref --verify`) would break the test even though external behavior (Result.ok + path) is unchanged. The fake's default-allow softens this (unscripted calls succeed silently), but the *negative* and *happy-path* discriminators rely on the exact strings.

This is a known trade-off when faking a Process port by command string, and it is acceptable in principle, but it should be acknowledged. The "reuses existing branch (skips -b flag)" test in particular encodes a flag-presence detail; the behavioral question is "does it succeed when the branch ref exists" — the `-b` skip is implementation. A test that asserts only the Result shape on the happy path with a pre-existing ref would be behavior-pinned; the current test additionally pins the exact `git worktree add` argv.

Not a blocker on its own — flag this as "minor cosmetic, judge-noted" — but combined with Item 1's AC10 gap, the gate as a whole does not meet PASS criteria.

## Verdict summary

FAIL on attempt 1. The unit gates are largely solid (9 of 10 ACs covered, mostly behavior-pinned with minor command-string coupling). The blocker is the smoke gate: AC10 demands an integration assertion that the worktree directory is created by `worktree-open` and removed by `worktree-close`, but `smoke-worktree-ports.ts` is a stub that just exits 1. As written, the implementer authors the GREEN smoke assertions — that collapses the test/implementer separation for the only real-spawn coverage.

## Required corrections

1. **Encode AC10 in `smoke-worktree-ports.ts` as committed assertion code, not prose.** The script must, in code:
   - Generate a unique slug (e.g., `_smoke-<random>`).
   - Spawn `bun scripts/worktree-open.ts <slug>` and observe the result.
   - Assert the worktree directory exists after open. (Throw or `process.exit(non-zero)` with a diagnostic on failure.)
   - Perform whatever main-side bookkeeping the proposal envisions to mark the branch merged so close accepts it.
   - Spawn `bun scripts/worktree-close.ts <slug>`.
   - Assert the worktree directory is gone after close.
   - Today (RED) it must still fail — that is fine — but it must fail *because the assertion is unmet against the current implementation*, not because it is a hard-coded `exit(1)` stub. A common shape: write the assertions, run them; today they fail because `openWorktree`/`closeWorktree` exports do not exist or the wiring is incomplete, so the spawn produces a non-zero exit or the dir is never created. That is a real RED.

2. **Decide and encode the dirty-main skip policy.** Either skip with exit 0 and a clear stderr message, or fail. Pick one and put it in code so the implementer cannot choose.

3. **Optional but recommended:** loosen the happy-path command-string coupling for AC4/AC5 if you can do so without weakening the assertion. Example direction (do not copy this — judge does not author tests): assert on the Result shape, and let the fake default-allow cover the exact argv shape, reserving exact-string scripts for the *negative* discriminators where the command string is the cue the policy must read. Up to you whether to address this in attempt 2 or note it as accepted coupling.

Items 1 and 3 are blockers. Item 4 is judge-noted but not a hard fail on its own.
