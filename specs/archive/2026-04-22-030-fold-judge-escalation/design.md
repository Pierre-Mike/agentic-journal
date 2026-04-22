# Design

## Approach

Two-file edit. No script or schema changes. Gate is a text-shape smoke script.

1. `scripts/smoke-do-no-blocker.ts` (gate, written RED in task 1): text-asserts that blocker.md is absent from both target files, that the Step 10 "escalated" variant is gone, and that spec-judge.md still names tester-review.md as the escalation artifact.
2. `.claude/skills/do/SKILL.md` edits:
   - Step 2.5 role summary table: drop `blocker.md (3-strike FAIL)` from the spec-judge Writes column — the judge only writes `tester-review.md` and `.gate-frozen` now.
   - Step 2.5 pseudocode: after the retry loop exits without `.gate-frozen`, do NOT early-return. Fall through to Step 8 and open a **draft PR** so the human sees `tester-review.md` in-context.
   - Step 6 escalation sentence still mentions implementer-side `blocker.md` — leave that to spec-implementer.md. But SKILL.md's own Step 6 line ("if stuck after 3 attempts → escalate (write blocker.md, stop)") must be reworded. That line is ambiguously shared between the (now-deleted) judge path and the still-alive implementer path; rewrite it to point at spec-implementer.md without naming the file.
   - Step 8: add a branch for "judge-rejected — open draft PR" with `gh pr create --draft` and a PR body that calls out `tester-review.md`.
   - Step 10: delete the third variant. Update the `paused` variant to add one line: "If the judge rejected 3 tester attempts, see `tester-review.md` inside the spec folder for the revision brief."
   - Drop the trailing paragraph that distinguishes all three variants.
   - SKILL.md Escalation section at the bottom: rewrite the generic "write blocker.md" bullet — the judge no longer writes it; implementer-owned blocker.md is covered in spec-implementer.md.
3. `.claude/agents/spec-judge.md` edits:
   - Frontmatter `description`: drop "writes blocker.md on 3-strike FAIL"; replace with "writes tester-review.md with an ESCALATION header on 3-strike FAIL".
   - Scope section: remove the `blocker.md` Write permission bullet.
   - "On FAIL (attempt 3 — 3-strike)" block: replace the "Also write blocker.md" step with "prepend an `## ESCALATION — 3 attempts exhausted` section to `tester-review.md` summarising the attempt history and naming resume paths".
   - Delete the entire `## blocker.md template` section. Replace with a short `## ESCALATION header template` section giving the prepended block's structure, including attempt history and resume paths.
   - Final `## Exit` paragraph: replace "(or `blocker.md`'s presence)" — parent session reads `.gate-frozen` existence only; absence after the loop = escalation.

## Files touched

- `scripts/smoke-do-no-blocker.ts` — new gate (task 1 RED, already-GREEN by construction once targets edited in tasks 3–4).
- `.claude/skills/do/SKILL.md` — remove blocker.md + escalated variant; add draft-PR branch (task 3).
- `.claude/agents/spec-judge.md` — remove blocker.md writes; fold escalation into tester-review.md (task 4).
- `specs/active/030-fold-judge-escalation/proposal.md|design.md|tasks.md` — spec artefacts (task 2, authored alongside).

## Decisions

- **Draft PR on judge rejection** — chosen over silent exit. The human is in the merge loop anyway; a draft PR makes `tester-review.md` reviewable in a normal PR view (diff + comments), which is why tester-review.md alone is a sufficient escalation artifact. Rejected: structured `blocker.md` — duplicates judge content already in tester-review.md.
- **Leave implementer's blocker.md alone** — different escalation path, different artifact, different reader audience (future /retro or resume). Conflating the two would require a larger refactor out of scope here.
- **Single gate script, text-assertion only** — no need to actually invoke the judge or run a TDD flow. The contract is purely "these strings are absent / present in these two files", which is deterministic and fast.

## Risks

- Merge conflict with the sibling branch editing Step 2.5 kind→role dispatch. Expected; handled by human.
- A future /retro scan might still try to surface blocker.md as a signal. Scanned scripts/ — nothing reads blocker.md today, so no rewire needed (see proposal.md Non-goals).

## Out of scope

- `.claude/agents/spec-implementer.md` blocker.md usage (implementer-stuck path).
- `.claude/skills/ts-axioms/SKILL.md` mention of blocker.md (general axiom-conflict escalation, not judge-specific).
- trace-scan / retro rewiring (no current script reads blocker.md).
