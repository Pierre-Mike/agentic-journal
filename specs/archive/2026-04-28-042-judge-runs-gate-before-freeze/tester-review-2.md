# Tester review — 042 slice 2 (attempt 1)

**Verdict**: PASS

## Rubric

### 1. Acceptance criterion coverage
YES

Slice-2-relevant ACs mapped:
- AC2 (runner dispatch — unsupported suffix → 127) → `unsupported gate suffix → exitCode 127, empty stdout/stderr` ✓
- AC3 (60s timeout via Bun.spawn → 124) → `timeout returns exitCode 124`, `timeout durationMs reflects actual wall time (>= timeoutMs)`, `default timeout is 60_000 ms (implicit)` ✓
- AC5 (200-line tail truncation, stdout+stderr) → `stdout with exactly 200 lines is NOT truncated`, `stdout with 201 lines is truncated to last 200 lines`, `stdout with >200 lines includes truncation marker`, `truncation marker appears before retained lines`, `stderr truncation: >200 lines includes marker and last 200 lines` ✓
- AC6 (always resolves, crash captured) → `killed process stdout/stderr still captured (may be partial)` + smoke `exits 0 for a non-zero gate and writes proof file` ✓
- Spawn pipeline (exit code, command, durationMs, stdio capture) → `returns exitCode from gate process`, `returns exitCode 0 for a passing gate`, `result.command matches pickRunner dispatch for .ts gate`, `result.command matches pickRunner dispatch for .test.ts gate`, `captures stderr as string`, `captures stdout as string`, `durationMs is a non-negative number` ✓
- Smoke entry shape (bun run <gate> writes proof, exits 0) → `smoke script exits 0 for a non-zero gate and writes proof file`, `proof file written by smoke entry contains exit_code header`, `smoke entry exits non-zero when no gatePath arg supplied` ✓

ACs deferred to slice 3 (out of scope for slice 2): AC1 `<specDir> <N>` arg shape + tasks.md parsing, AC4 full proof-file format end-to-end, AC7 unit-test-no-fs constraint, AC8 SKILL.md update, AC9 spec-judge.md update. Tasks.md task 2 explicitly scopes this slice to "Output truncation + timeout semantics" — the smoke entry uses `<gatePath> [outPath]` directly, deferring tasks.md wiring to slice 3.

### 2. Adversarial gap
YES (minor, non-structural)

An implementation could pass the truncation tests with a constant prepended marker that always says "truncated ... 200 lines" regardless of actual line count, because the "exactly 200" test only checks `not.toContain("truncated")` against `result.stdout` — that is actually defended. The real residual gap: `stdout with exactly 200 lines is NOT truncated` filters empty lines before asserting `length === 200`, so an implementation that quietly drops one line as long as exactly 200 non-empty lines remain still passes. Cosmetic — the spirit (don't truncate at the boundary) is preserved by the negative `not.toContain("truncated")` assertion.

Secondary minor gap: `default timeout is 60_000 ms (implicit)` only verifies a fast gate completes; an impl with a 30-minute default still passes. Mitigated by impracticality of a long wall-clock assertion.

### 3. Coverage gap
NO

AC6 ("proof file written even on runner crash — non-zero exit captured, not thrown") has no direct `expects(runProof(...)).resolves` against a crashing-runner fixture, but is covered transitively: every test in the suite `await`s `runProof` and would surface a rejection as an unhandled error, and the smoke entry's `exits 0 for a non-zero gate` end-to-end-validates the never-throws contract through the orchestration boundary. Acceptable.

### 4. Behavior vs implementation detail
YES — tests behavior-pinned

Fixtures use temp dirs (`tmpdir()`), assert on exit codes, output substrings, command array shape, and durationMs numeric properties. No coupling to internal function names beyond the public exports `runProof` / `pickRunner` already declared in slice 1. The `result.command` assertions (`["bun", "run", gatePath]` / `["bun", "test", path]`) match the documented dispatch contract, which is observable behavior. Smoke tests spawn the script as a subprocess — pure black-box.

## RED-state confirmation

`runProof` throws `Error("runProof: not implemented (slice 2)")`. The 17 tests calling `runProof` directly will each fail with that thrown error. Smoke tests 1 and 2 (which expect exitCode 0 and a written proof file) will fail because the script's catch block exits 1 when runProof throws. Smoke test 3 (`exits non-zero when no gatePath arg supplied`) will pass — the early-exit guard fires before runProof. That gives 19/20 RED, matching the tester's claim. RED is for the right reason: missing implementation, not typo or import error.

## Smoke entry vs design

Design specifies `bun run scripts/red-proof.ts <specDir> <N>`. The slice-2 smoke entry uses `<gatePath> [outPath]` directly. This is a deliberate slice split: slice 2 isolates the spawn/capture/timeout/truncation primitives; slice 3 (per tasks.md task 3, gate `.claude/agents/spec-judge.md`) implies the tasks.md `<specDir> <N>` wrapper lands with the SKILL.md orchestration update. Scope-clean.

## Verdict summary

PASS. Slice 2 ACs (timeout, truncation, spawn pipeline, smoke entry) are mapped to concrete behavior-pinned assertions. RED state is genuine (runProof throws). No structural gaps; minor cosmetic adversarial gaps in the "exactly 200 lines" boundary test do not undermine intent. Scope is contained to slice 2 — no encroachment on slice 1 (frozen pure functions) or slice 3 (tasks.md wiring + SKILL.md). Freezing gate-2.
