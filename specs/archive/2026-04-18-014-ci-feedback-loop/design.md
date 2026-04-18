# Design

## Approach

Add `scripts/ci-feedback.ts` as a self-contained module following the `trace-scan.ts` template: pure functions (unit-tested colocated) + thin IO layer (covered by smoke) + CLI entrypoint guarded by `import.meta.main`. The script is invoked by `/do` Step 9 when CI goes red. It calls `gh pr checks <pr-url> --json name,state,link` to enumerate failed checks, extracts the GitHub Actions run id from each `link` field, calls `gh run view <runId> --log-failed` for each failed run, and writes a `ci-failure.md` brief into the spec's active directory inside the worktree. A follow-up session reads the brief and drives the fix. No LLM call happens in this script.

## Pure function signatures

```ts
interface FailingCheck {
  name: string;
  conclusion: string;
  detailsUrl: string;
  runId: string | null;
}

interface PrInfo {
  url: string;
  headBranch: string;
}

parseFailingChecks({ checksJson }: { checksJson: unknown }): FailingCheck[]
extractRunId({ detailsUrl }: { detailsUrl: string }): string | null
formatFailureBrief({
  pr,
  failingChecks,
  logs,
}: {
  pr: PrInfo;
  failingChecks: FailingCheck[];
  logs: Record<string, string>;  // keyed by runId
}): string
```

`parseFailingChecks` is schema-validating: reject non-arrays, reject rows missing string fields. Skip success rows. Return fails + pending as failing (any non-pass is a problem — keeps "still running" visible).

`extractRunId` parses URLs like `https://github.com/OWNER/REPO/actions/runs/<runId>/job/<jobId>`. Returns the run id, or null if the URL doesn't match.

`formatFailureBrief` produces a markdown document with a summary header, a failing-checks table, and one section per run with truncated logs (last ~200 lines per run to keep the brief readable).

## IO helpers

```ts
fetchPrChecks({ prUrl }: { prUrl: string }): Promise<unknown>
fetchFailingLogs({ runId }: { runId: string }): Promise<string>
writeBrief({ specDir, content }: { specDir: string; content: string }): void
resolveActiveSpecDir({ worktreePath }: { worktreePath: string }): string
```

- `fetchPrChecks` shells out to `gh pr checks <prUrl> --json name,state,link` and returns parsed JSON as `unknown` (validation is `parseFailingChecks`'s job).
- `fetchFailingLogs` shells out to `gh run view <runId> --log-failed` and returns raw stdout. Swallows non-zero exits (log-failed returns non-zero when the run had no failed jobs) and returns "" in that case.
- `writeBrief` writes `ci-failure.md` next to `proposal.md` in the resolved spec dir.
- `resolveActiveSpecDir` scans `<worktreePath>/specs/active/` and returns the single child directory. If zero or multiple, throws.

## CLI

```
bun scripts/ci-feedback.ts <pr-url> [--worktree <path>] [--dry-run]
```

- `<pr-url>` — positional, required
- `--worktree <path>` — default `process.cwd()`
- `--dry-run` — print the brief to stdout instead of writing the file

Exit codes:
- 0 — brief written (or printed in dry-run)
- 1 — arg error, `gh` not on PATH, or no failing checks found

## Fixture strategy for the smoke

Mock `gh` by creating a temp directory, writing a `gh` shim script that reads canned fixture files, and putting that directory first on `PATH`. The shim:

```sh
#!/bin/sh
case "$*" in
  "pr checks "*"--json name,state,link") cat "$CI_FEEDBACK_FIXTURE_CHECKS" ;;
  "run view "*"--log-failed") cat "$CI_FEEDBACK_FIXTURE_LOGS" ;;
  *) echo "unknown gh call: $*" >&2; exit 1 ;;
esac
```

The smoke:
1. `mkdtempSync` a root; place `bin/gh` shim + JSON + log fixtures inside
2. `chmod 0755 bin/gh`
3. Run the CLI as a child process with `env: { PATH: binDir + ":" + process.env.PATH, CI_FEEDBACK_FIXTURE_CHECKS: ..., CI_FEEDBACK_FIXTURE_LOGS: ... }`
4. Also create a fake worktree inside the tmp dir with `specs/active/fake-spec/proposal.md`
5. Pass `--worktree <fakeWorktree>` to the CLI
6. Assert exit 0, assert `ci-failure.md` was written, assert its contents include the failing job names and excerpts from the log fixture
7. Also cover `--dry-run`: CLI prints to stdout, no file written

## Files touched

- `scripts/ci-feedback.ts` — new. Pure fns + IO helpers + CLI.
- `scripts/ci-feedback.test.ts` — new. Colocated `bun:test` unit tests for pure fns.
- `scripts/smoke-ci-feedback.ts` — new. Real-assertion smoke with fixture-mocked `gh` on `PATH`.
- `.claude/skills/do/SKILL.md` — Step 9 invokes the script on red; Step 10 paused report cites `ci-failure.md`.
- `specs/active/014-ci-feedback-loop/{proposal,design,tasks}.md` — standard spec docs.

## Decisions

- **No LLM in this script** — deterministic-first (constitution §2). Reasoning about the log belongs in a separate "autonomous fix" spec; this spec only delivers the data.
- **Schema-validated parse, not `as`** — `parseFailingChecks` narrows `unknown` via runtime checks. No `as` casts in source files (constitution §5).
- **Fixture-mock `gh` via `PATH`** — avoids network, avoids state. Same testability pattern used by stdlib shims and git's own test suite. Smoke runs as a child process (isolates env pollution).
- **Brief lives inside the worktree** — the spec's active dir is the natural scratch space. The file is gitignored-by-practice (we don't commit ephemeral CI debug output). Future "autonomous fix" subagent reads from the same path.
- **Non-success = failing** — includes pending/queued alongside failed so a stuck CI check doesn't get ignored.
- **Truncate logs to ~200 lines** — full logs can be 10k+ lines; the brief is for human (or LLM) triage, not archival.

## Risks

- **`gh` auth dependence** — if the caller's `gh` is not logged in, the IO helpers throw. Script exits non-zero with a clear message; caller (`/do` Step 9) continues to its paused report. Acceptable.
- **URL format drift** — `extractRunId` parses a specific GitHub URL shape. If GitHub changes the path, the regex fails and `runId` is null; the brief still lists the failing check with the raw URL. Fail-soft.

## Out of scope

- Autonomous LLM-driven fix loop (separate spec)
- Auto-pushing fixes
- Modifying GitHub Actions workflow YAML
- Altering CI retry policy
- Adding a `bun run` script alias (CLI is invoked directly by the `/do` skill)
