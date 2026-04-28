---
status: confirmed
confidence: high
intent_hash: a2db282f8b67
created: 2026-04-28
---

# Alignment — BDD outer acceptance gate

## Goal

Add a top-level (BDD-style) acceptance gate per spec, separate from per-slice gates, so the spec as a whole has a single behavioral check that proves "done." Catches integration gaps where individual slice gates pass but the spec's stated outcome doesn't.

## Big Picture

Today: each task in `tasks.md` declares its own `gate:` per slice. Slices flip RED→GREEN one by one. There is **no outer check** tying them together — a spec can ship with every per-slice gate green while the integrated behavior is broken.

Future: the existing `gate:` field in `proposal.md` frontmatter is repurposed as the OUTER gate (BDD acceptance test, scoped to `alignment.md`). `spec-tester` scaffolds the outer gate at Step 5, RED. `spec-judge` reviews it against `alignment.md`. Per-slice TDD continues unchanged. After the last slice flips GREEN, the outer gate must also be GREEN — which it might already be (slices cover it) or might fail and reveal an integration gap. `spec:complete` re-verifies BOTH the outer and every per-slice gate before archiving.

```
spec scaffold ──→ outer-gate.spec.ts (RED, scoped to alignment.md)
                         │
slice 1 RED → GREEN → refactor   ┐
slice 2 RED → GREEN → refactor   ├── per-slice TDD (existing)
slice 3 RED → GREEN → refactor   ┘
                         │
                         ↓
spec:complete: outer GREEN required AND all slices GREEN
```

## Straightforward Details

- Outer gate path: the existing `gate:` field in `proposal.md` frontmatter. For `kind: code` specs this becomes the OUTER gate, separate from per-slice gates.
- Per-slice gates: still declared as `gate:` per task in `tasks.md` (existing behavior).
- `spec-tester` scaffolds the outer gate at Step 5 for `kind: code` (currently it skips writing any gate at Step 5 for kind:code — this changes).
- `spec-judge` reviews the outer gate at scaffold time using `alignment.md` as the source of truth (judge already reads alignment.md from spec 1).
- `spec:complete` validates BOTH the outer gate (`proposal.md` frontmatter `gate:`) AND every per-slice gate from `tasks.md`. Currently it primarily checks the proposal `gate:`; most `kind: code` specs left this RED until close. That changes.
- For `kind: rule | workflow | writeup` — outer gate is the only gate (no slices). Existing behavior preserved; no functional change.

## Non-obvious Decisions

**D1 — Reuse existing `gate:` field as outer gate vs add a new `outer_gate:` field.**
⭐ Reuse. The frontmatter `gate:` field already declares the spec-level gate; today it is underused for kind:code. Treat it as the outer gate from now on.
❌ Add `outer_gate:` field. Confusing duplication; backward-incompatible with existing archived specs.

**D2 — Judge reviews outer gate or just per-slice gates.**
⭐ Judge reviews BOTH. Outer gate is the most expensive to get wrong; slipping it through unreviewed defeats the BDD intent.
❌ Only review per-slice gates. Misses the integration check.

**D3 — Outer gate enforcement timing.**
⭐ At `spec:complete` only. Outer gate must be GREEN before archive. If RED at close, spec stays active and a draft PR signals an integration gap.
❌ Block per-slice GREEN if outer is RED. Premature; outer typically depends on multiple slices being in place.
