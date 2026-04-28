---
id: 042-judge-runs-gate-before-freeze
title: Judge runs gate before freezing
status: active
kind: code
# kind:code — per-task gates declared in tasks.md; list below is a human-readable derived summary only.
gate:
  - path: scripts/red-proof.test.ts
    level: unit
  - path: scripts/red-proof.ts
    level: e2e
  - path: .claude/agents/spec-judge.md
    level: integration
created: 2026-04-28
owner: main
depends_on:
  - 039-slice-red-tdd
supersedes: null
---

## Intent

Prove every RED gate test actually fails against the current codebase before the spec-judge freezes it. Today, a spec-tester can author a tautological test that passes without any implementation and the judge never detects it. This spec inserts a deterministic RED-proof step — run by the `/do` orchestrator between spec-tester exit and spec-judge dispatch — that captures the gate's exit code and output, writes an auditable artifact, and forces the judge to reject exit-code-0 gates automatically.

## Constraints

- The proof step is orchestrated by `/do` (the main session), NOT by spec-tester or spec-judge.
- `scripts/red-proof.ts` is a pure Bun script: no LLM, no agent tools, fully deterministic.
- spec-judge gains no Bash tool — it stays read-only; it only reads the proof artifact.
- Runner dispatch by file suffix: `*.test.ts` → `bun test <gate>`, `*.ts` (non-test) → `bun run <gate>`, other → exit 127.
- Timeout: 60 s via `Bun.spawn`; kill on exceed → exit code 124 (GNU timeout convention).
- `red-proof.ts` always exits 0 — the proof artifact is the result, not the script's exit code.
- Proof artifact: `specs/active/<id>/red-proof-N.txt` (format specified in Group A of aligned plan).
- Tail-truncate stderr/stdout at 200 lines each.
- Single `red-proof-N.txt` per slice; git history preserves prior versions (overwrite per attempt).
- `red-proof-N.txt` must be absent (not yet written) to keep spec-judge honest — judge must read it to apply Item 0.
- Out of scope: changing spec-judge model, adding Bash to spec-judge, migrating archived specs, lenient-mode fallback.

## Acceptance criteria

- [ ] `scripts/red-proof.ts` exists: accepts `<specDir> <N>` args, reads task N gate from tasks.md, runs the gate via runner dispatch, writes `specs/active/<id>/red-proof-N.txt`, exits 0
- [ ] Runner dispatch: `*.test.ts` gate → `bun test <gate>`; `*.ts` non-test → `bun run <gate>`; other suffix → proof with `exit_code: 127`
- [ ] 60 s timeout enforced via `Bun.spawn`; killed process → `exit_code: 124` in proof file
- [ ] Proof file format: line 1 `exit_code: <N>`, line 2 `command: <invocation>`, line 3 `duration_ms: <N>`, then `--- stderr (tail 200) ---` section, then `--- stdout (tail 200) ---` section
- [ ] stdout and stderr each tail-truncated to 200 lines; longer output is silently dropped from the front
- [ ] Proof file written even on runner crash (non-zero exit captured, not thrown)
- [ ] `scripts/red-proof.test.ts` covers runner dispatch logic, exit-code mapping, output truncation, and timeout semantics with unit tests that do not require a real filesystem write
- [ ] `/do` SKILL.md Step 6 pseudocode updated: proof step inserted between spec-tester commit and spec-judge dispatch
- [ ] `.claude/agents/spec-judge.md` updated: `red-proof-N.txt` added to allowed Read paths; **Item 0: RED proven** rubric item prepended; exit 0 → auto-FAIL, exit 124 → auto-FAIL, exit 127 → auto-FAIL, other → continue Items 1–4

## Context

- Spec 039-slice-red-tdd: introduced per-slice TDD loop and `.gate-frozen-N` sentinel pattern.
- Aligned plan decision: orchestrator-runs keeps spec-judge Bash-free and prevents spec-tester from faking the proof (untrusted party does not generate evidence).
- Aligned plan decision: any non-zero exit counts as RED — TS resolution failure is the most common legitimate RED state; distinguishing compile error from assertion failure requires fragile runner-specific parsing.
- Aligned plan decision: overwrite red-proof-N.txt per attempt; git history is the forensic record.
