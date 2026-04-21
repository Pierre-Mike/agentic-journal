# Tester review — 030-retro-dormant-worktrees (attempt 2)

**Verdict**: PASS

## Rubric

### 1. Acceptance criterion coverage
YES.

Mapping:
  - AC1 (script + `detectDormantWorktrees` export) → test 1 (module import + `typeof` function check) ✓
  - AC2 (only dormant-qualified entries) → test 1 (exactly 2: old-no-pr, ninety-min; all others excluded) ✓
  - AC3 (open PR not flagged) → test 1 (open-pr excluded) ✓
  - AC4 (merged PR not flagged) → test 1 (merged-pr excluded; pinned via `+state=all` fixture key) ✓
  - AC5 (non-spec branch not flagged) → test 1 (feature/main-work excluded) ✓
  - AC6 (<1h commit not flagged) → test 1 (fresh 30-min excluded) ✓
  - AC7 (text header / empty string) → test 2 (CLI subprocess, header present + empty-case asserts trimmed empty) ✓
  - AC8 (`--json` array of DormantSpec) → test 3 (CLI subprocess, JSON.parse + all 6 required keys checked) ✓
  - AC9 (SKILL.md amended) → test 5 (invocation + header references) ✓
  - AC10 (smoke exits 0 post-impl) → `main()` exit logic ✓

### 2. Adversarial gap
YES — one minor residual, not structural.

Residual: test 4 (real-subprocess path) runs in a non-git scratch dir with fixture env vars stripped and only asserts exit 0 + empty array. An implementation that unconditionally `return [];` when `GIT_WORKTREE_LIST_FIXTURE` is absent would still pass. However, since proposal.md Constraint line 34 now explicitly declares the env-var fixture protocol as a first-class test-affordance contract and the real `git worktree list` / `gh pr list` / `git log -1` invocations are named in the same constraint, this is a documented design affordance rather than a covert stub. Not a blocker for spec 030; flag for future retro if the dormant detector misfires in production.

The three attempt-1 adversarial gaps are all closed:
- `--state all` is pinned: fixture keys use `<branch>+state=all`; an implementation omitting the flag looks up a missing key, returns `[]`, and mis-flags merged-pr as dormant → test 1 fails.
- Path-prefix filter exercised: scenario (g) `outside-wt` sits under `<baseDir>/other/worktrees/` on `spec/outside-wt`, >1h old, no PR; asserted excluded.
- Hour-granularity pinned: `ninety-min` entry's `age_days` asserted `>0 && <1` (a day-floored implementation returns 0 and fails).

### 3. Coverage gap
NO — all four attempt-1 gaps closed.

- `--state all` on `gh pr list` → pinned via fixture key schema (`+state=all` suffix).
- Path-prefix constraint → scenario (g) outside `.agentic/worktrees/` asserted excluded.
- Real-subprocess path → test 4 spawns CLI with fixture env vars stripped in a scratch directory, asserts exit 0 + empty JSON array.
- `age_days` hour-granularity → test 1 asserts `ninetyEntry.age_days > 0 && < 1`.

### 4. Behavior vs implementation detail
YES — tests behavior-pinned.

- `renderDormant` named-import assertion removed; test 2 drives the CLI via `Bun.spawn(["bun", ".../retro-preflight.ts"])` and asserts on stdout, matching the AC's observable-behavior framing.
- Env-var fixture protocol (`GIT_WORKTREE_LIST_FIXTURE`, `GH_PR_LIST_FIXTURE`, `GIT_LOG_FIXTURE`) is now declared in `proposal.md` Constraint line 34 as a declared test-affordance — no longer invisible coupling.
- Fixture key schema (`<branch>+state=all`) is documented inline in the smoke script and serves as a behavior pin for the `--state all` requirement rather than a private implementation shape.

## Verdict summary
PASS. Attempt 2 closes all four gaps from attempt 1: the `+state=all` key schema forces the `--state all` flag, scenario (g) exercises the path-prefix filter, test 4 exercises the real-subprocess path, and the fractional `age_days` assertion pins hour-granularity. The `renderDormant` import coupling is replaced with CLI subprocess invocation, and the env-var fixture protocol is now a declared Constraint. One minor residual (test 4 would accept a stub that returns `[]` whenever fixtures are absent) is documented but not structural, since the fixture protocol is itself a sanctioned design affordance. Gate is frozen.

---

## PASS note (judge, attempt 2)
Gate frozen at `specs/active/030-retro-dormant-worktrees/.gate-frozen`. Spec-implementer may proceed.
