# Design

## Approach

Insert a deterministic RED-proof step between spec-tester exit and spec-judge dispatch in the `/do` per-slice loop. A new pure-Bun script (`scripts/red-proof.ts`) runs the gate, captures exit code + output, writes `specs/active/<id>/red-proof-N.txt`, and exits 0. The spec-judge reads this file and applies a new Item 0 that auto-FAILs any gate that exited 0.

```
spec-tester writes gate  (RED commit)
        │
        ▼
/do runs: bun run scripts/red-proof.ts <specDir> <N>
        │   writes: specs/active/<id>/red-proof-N.txt
        ▼
spec-judge reads red-proof-N.txt + gate + proposal
        │
        ├── exit_code == 0   → auto-FAIL "not RED — gate passes without implementation"
        ├── exit_code == 124 → auto-FAIL "gate timed out"
        ├── exit_code == 127 → auto-FAIL "unknown runner"
        └── exit_code other  → continue Items 1–4
```

## Files touched

- `scripts/red-proof.ts` — new script; reads tasks.md task N gate field, dispatches runner, writes proof artifact, always exits 0
- `scripts/red-proof.test.ts` — new unit tests; covers runner dispatch by suffix, exit-code mapping (0/124/127/other), output truncation at 200 lines, timeout kill path
- `.claude/skills/do/SKILL.md` — Step 6 pseudocode updated with proof step between tester commit and judge dispatch
- `.claude/agents/spec-judge.md` — allowed Read paths expanded; Item 0 rubric prepended

## Decisions

- **Decision 1: orchestrator runs the proof** — spec-judge has no Bash tool (by design, isolation principle). spec-tester cannot generate its own evidence (untrusted party). /do is the only neutral party with Bash access.
- **Decision 2: overwrite red-proof-N.txt per retry attempt** — matches existing `tester-review-N.md` overwrite behavior. Git history is the forensic record for prior attempts.
- **Decision 3: any non-zero exit = RED** — TS resolution errors are the most common legitimate RED state. Distinguishing compile error from assertion failure requires fragile runner-specific output parsing. Judge Items 1–4 catch nonsense gates that are only compile errors with no real assertion.
- **Decision 4: 60 s timeout → exit 124** — matches GNU `timeout` convention; judge can name the failure crisply ("gate timed out") in the review.
- **Decision 5: 200-line tail truncation** — bounds proof file size; leading output rarely contains the assertion failure; tail is the most actionable section.

## Risks

- **Runner dispatch ambiguity**: a `*.ts` gate that is NOT a smoke script but IS a test file without the `.test.ts` suffix would be dispatched as `bun run` not `bun test`. Mitigation: the convention enforced by spec-tester (gate files end in `.test.ts` for unit gates) makes this a spec-tester error, surfaced by the judge's Item 0 analysis.
- **tasks.md parse divergence**: red-proof.ts must parse tasks.md the same way as spec-lint/tasks-verify. Mitigation: reuse the `parseTasksFile` export from `scripts/spec-lint.ts` rather than duplicating parser logic.

## Out of scope

- Adding Bash tool to spec-judge
- Lenient mode / backward-compat flag (missing proof file is loud, not silent)
- Migrating archived specs to require red-proof artifacts
- Distinguishing compile errors from assertion failures in the proof
