# Design

Thin read-only script that reads local remote-tracking refs and formats them as a status table. No state, no writes, no network.

## Approach

`scripts/intent-status.ts` shells out to `git for-each-ref refs/remotes/origin/auto/ --format=... --sort=committerdate`, parses each line with a regex, computes age from the epoch timestamp, and prints a formatted table to stdout. Three pure functions (`formatAge`, `parseBranch`, `formatTable`) handle the logic so the test suite can import and assert without spawning subprocesses.

## Files touched

- `scripts/intent-status.ts` — new script: pure helpers + `main()` entry point
- `scripts/intent-status.test.ts` — new colocated test: unit tests for pure helpers + mocked subprocess test for `main()`
- `package.json` — adds `"intent:status": "bun scripts/intent-status.ts"` to `scripts`
- `tests/intent-status-bdd.test.ts` — outer BDD gate: integration-level acceptance test (RED at scaffold, GREEN after slice 2)

## Decisions

- **Remote-tracking refs over `git ls-remote`** — `refs/remotes/origin/auto/` is the local cached copy of the remote; no network call, no credentials, works in airgapped CI, deterministic in tests.
- **Flat placement at `scripts/intent-status.ts`** — matches `scripts/issue-options.ts` and other standalone single-file scripts; a subdirectory would be premature grouping.
- **Age as `<N>d <H>h` with space-padded hours** — glanceable in a status table; minutes add noise; aligns with `3d 14h` / `0d  2h` column format (hours field is 2 chars wide, space-padded).
- **Exported pure functions** — `formatAge`, `parseBranch`, `formatTable` exported from the module so the test can import them directly; `main()` is the only function that touches the subprocess.
- **`--sort=committerdate` from git** — subprocess output is already sorted oldest-first; TypeScript re-sorts by `ageSeconds` descending to be defensive.

## Out of scope

- Writing to any file or invoking `git fetch` — read-only, no network
- Filtering by branch owner / assignee
- Machine-readable (JSON) output mode
