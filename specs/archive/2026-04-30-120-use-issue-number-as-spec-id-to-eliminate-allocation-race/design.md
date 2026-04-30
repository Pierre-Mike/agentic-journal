# Design

Replace sequential id allocation with GitHub issue number injection across two files: the CI workflow prompt and the auto-aligner agent definition. A third file (spec-tester.md) is verified clean and requires no changes.

## Approach

All three allocation-race entry points resolve to a single env-var read:

```
ISSUE_NUMBER=${{ github.event.issue.number }}   (already on the align step)
        │
        ├── intent.yml aligner prompt  → tells the aligner "use ISSUE_NUMBER as spec id"
        │                                removed: "allocate a new spec id"
        │                                added:   "Use issue number $ISSUE_NUMBER as the spec id.
        │                                          Write alignment to specs/active/${ISSUE_NUMBER}-<slug>/alignment.md."
        │
        └── auto-aligner.md             → instructs the agent to derive spec dir from env var,
                                          not by scanning specs/active/
```

Slug derivation (lowercase, hyphens, 50-char cap) is unchanged. The `git add specs/active/*/alignment.md` glob is depth-1 and matches any directory name under `specs/active/`, so it already works for `120-…` style names without modification.

## Files touched

- `.github/workflows/intent.yml` — single-line prompt change on the `claude … <<EOF` heredoc (line 177). Remove "allocate a new spec id, kebab-slug from the issue title"; replace with "Use issue number $ISSUE_NUMBER as the spec id. Write alignment to specs/active/${ISSUE_NUMBER}-<slug>/alignment.md."
- `.claude/agents/auto-aligner.md` — add a new **Inputs** item for `ISSUE_NUMBER` and update the **Outputs** and **Procedure** sections to derive the spec dir as `specs/active/${ISSUE_NUMBER}-<slug>/` instead of scanning specs/.

## Decisions

- **Env var, not branch-name parsing** — `ISSUE_NUMBER` is already injected on the step; parsing the branch name via `git rev-parse --abbrev-ref HEAD` would add a Bash call and couple the aligner to the branch naming convention. Env var is canonical.
- **No max+1 fallback** — keeping any form of `specs/` scanning as a fallback would preserve the race. The env var is always present in CI; a missing env var is a wiring error (fail loudly), not a case to fall back silently.
- **spec-tester.md unchanged** — audited: no "allocate" or "next spec id" prose found. The spec-tester is path-agnostic; it receives the spec dir from the orchestrator and does not need to know how that path was derived.
- **Existing archived specs unchanged** — zero-padded ids (e.g. `054-…`) are immutable. New issue-number ids (`120-…`, `1001-…`) don't sort lexically past #999 but lex-sort is not load-bearing in spec-status.ts.

## Risks

- If a human opens the GitHub Actions editor and types a spec slug manually (not from an issue), `ISSUE_NUMBER` will be empty — the aligner must be told to fail loudly rather than emit a path like `specs/active/-<slug>/`. Mitigated: the env var is always set by GitHub for `issues` and `issue_comment` events; direct workflow_dispatch invocations are not in the triggering path.

## Out of scope

- `.claude/skills/do/SKILL.md` Step 3 ("Allocate ID and slug") — that step describes the human-interactive `/do` flow, which still derives ids from context. Updating it is a separate follow-up.
- `scripts/worktree/worktree-open.ts` — already accepts full slug; no change needed.
- Migration of existing 53+ archived specs — not in scope per alignment.
