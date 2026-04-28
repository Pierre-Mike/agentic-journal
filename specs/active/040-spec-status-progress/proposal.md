---
id: 040-spec-status-progress
title: Show slice-RED progress in spec-status
status: active
kind: code
# kind:code — per-task gates declared in tasks.md; list below is a human-readable summary only
gate:
  - path: scripts/_lib.test.ts
    level: unit
  - path: scripts/spec-status.test.ts
    level: integration
created: 2026-04-28T00:00:00.000Z
owner: main
depends_on:
  - '035'
  - 039-slice-red-tdd
supersedes: null
---

## Intent

Make in-flight slice-RED progress visible in `bun scripts/spec-status.ts` output. When a spec has per-task gates (kind:code, slice-RED), the status line gains a `[N/M frozen]` tag showing how many slices are frozen. Non-slice-RED specs are byte-identical to pre-040 output. Operators can see `/do`'s loop position without `ls`-ing the spec folder.

## Constraints

- No state stored; null short-circuits keep non-slice-RED output byte-identical.
- `sliceProgress` is a pure function — no I/O except reading the spec folder.
- Reuses `taskGates(specDir)` from spec 039; no duplicated parsing.
- `formatSpecLine` is a pure formatter; `main()` handles real fs reads and console.log.
- Port injection is out of scope (no fs/process ports injected into spec-status.ts).

## Acceptance criteria

- [ ] `sliceProgress({ specDir })` exported from `scripts/_lib.ts` returns `{ frozen, total }` for kind:code specs with per-task gates
- [ ] Returns `null` when proposal.md kind !== "code"
- [ ] Returns `null` when kind === "code" but tasks.md has no per-task `gate:` fields (taskGates() returns empty)
- [ ] `frozen` counts only slices where `.gate-frozen-<N>` file exists in specDir
- [ ] `total` equals the number of slices declared in tasks.md (i.e. `taskGates(specDir).length`)
- [ ] `formatSpecLine(spec, archived, sliceProgress)` exported from `scripts/spec-status.ts` returns the line as a string
- [ ] When `sliceProgress` arg is `null`, output is byte-identical to pre-040 format
- [ ] When `sliceProgress` arg is `{ frozen, total }`, output has ` [N/M frozen]` appended after `(<kind>)`
- [ ] `main()` in spec-status.ts wires real `sliceProgress(specDir)` calls and `console.log`s `formatSpecLine` output
- [ ] `scripts/_lib.test.ts` has cases covering all `sliceProgress` branches (non-code kind, code with no per-task gates, slice-RED with 0/N, K/N, N/N frozen)
- [ ] `scripts/spec-status.test.ts` exists and tests `formatSpecLine` output for both null and non-null sliceProgress arg

## Context

- Spec 035: typed gates + sibling test convention that `_lib.test.ts` follows.
- Spec 039: introduces `taskGates(specDir)` helper and slice-RED TDD loop; `sliceProgress` reuses it.
