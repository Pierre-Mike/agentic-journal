# Design

## Approach

Pure-function helper `sliceProgress({ specDir })` in `scripts/_lib.ts` reads proposal.md frontmatter and calls `taskGates(specDir)` (spec 039) to count slices. It checks for `.gate-frozen-N` sentinel files to count frozen slices, returning `{ frozen, total }` or null.

`spec-status.ts` gains a pure `formatSpecLine(spec, archived, sliceProgress)` function that appends ` [N/M frozen]` when sliceProgress is non-null. `main()` remains the only impure entry point: it calls real `sliceProgress(specDir)` and `console.log`s the result of `formatSpecLine`.

```
spec-status.ts → for each active spec:
                   sliceProgress({ specDir }) → null | { frozen, total }
                   formatSpecLine(spec, archived, progress) → string
                   console.log(line)
```

## Files touched

- `scripts/_lib.ts` — add `sliceProgress({ specDir })` export; no other changes
- `scripts/_lib.test.ts` — append sliceProgress branch tests (slice-tester writes RED form in Slice 1)
- `scripts/spec-status.ts` — extract `formatSpecLine`, wire sliceProgress in main()
- `scripts/spec-status.test.ts` — new file; tests formatSpecLine (slice-tester writes RED form in Slice 2)

## Decisions

- **Decision 1 — Pure formatter over filesystem fixtures + spawn.** Extract `formatSpecLine(spec, archived, sliceProgress)` returning a plain string. Tests assert string equality on the pure function. Rejected: spawn + fixture dirs (slow, leaks unit test into integration tier — spec 037 explicitly removed Bun.spawn from unit tests). Rejected: full port injection (overkill for a 25-line formatter with one format function).

- **Decision 2 — Null short-circuit keeps non-slice-RED output byte-identical.** `sliceProgress` returns null for non-code kinds and for code specs with no per-task gates. `formatSpecLine` appends nothing when the argument is null. No trailing spaces, no tag — identical bytes.

- **Decision 3 — Reuse taskGates, no duplicated parsing.** `sliceProgress` calls `taskGates(specDir)` from spec 039. No re-implementation of tasks.md parsing inside _lib.ts.

## Out of scope

- Port injection (fs/process ports) into spec-status.ts.
- Color or rich formatting in the progress tag.
- Sorting or filtering specs by frozen count.
- Any UI beyond the appended `[N/M frozen]` string on the existing status line.
