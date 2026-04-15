---
name: do
description: >
  End-to-end spec → worktree → work → close → push → PR. The only command needed to produce a
  change in this repository. Runs alignment via the `align` skill, authors a spec under
  `specs/active/NNN-slug/` with the gate RED, iterates edits against the gate, closes with
  `spec:complete`, pushes the spec branch, opens a PR. Never touches main directly. Invoke as
  `/do <intent>`.
---

## Core Principle

One command per change. Main stays clean. Work happens in an isolated worktree on its own branch; the PR is the integration point.

## Preconditions

- Current directory is the repo root
- Current branch is `main`
- Working tree is clean (`git status --porcelain` empty)

Refuse with a clear message if any precondition fails.

## Workflow

### Step 1 — Align

Invoke `align`. Let it interview the user through its four layers (Goal → Big Picture → Details → Decisions).

**Override terminal behaviour**: when `align` reaches confirmation at the Decisions layer, do NOT let it begin implementation. Capture the confirmed plan and proceed to Step 2.

### Step 2 — Extract spec fields

From the aligned plan derive:

- `title` — sentence-case goal
- `kind` — one of `code`, `rule`, `workflow`, `writeup`
- `gate` — file path(s) proving doneness
- `depends_on` — archived spec IDs this builds on (must exist in `specs/archive/`)

Confirm these four fields with the user in a single compact message. If any are unclear, ask — do not guess.

### Step 3 — Allocate ID and slug

- Scan `specs/active/` and `specs/archive/`
- Next `NNN` = max existing ID + 1, zero-padded
- `slug` = kebab-case of the title, ≤ 5 words

### Step 4 — Open worktree

```bash
bun scripts/worktree-open.ts <slug>
```

Script creates `.agentic/worktrees/<slug>/` on branch `spec/<slug>` from `main`. All subsequent edits use absolute paths under that directory.

### Step 5 — Author the spec (RED)

Inside the worktree, write in this order:

**5a. Gate artifact (RED)** — failing test file / empty writeup / not-yet-implemented rule / exit-1 smoke. See `specs/constitution.md` §4 for per-kind details.

**5b. `proposal.md`** — based on `specs/_template/proposal.md`. Fill frontmatter (id, title, status=active, kind, gate, created, owner=main, depends_on, supersedes=null). Body: Intent, Constraints, Acceptance criteria (as `- [ ]`), Context.

**5c. `design.md`** — Approach, Files touched, Decisions, Out of scope. Skip empty sections.

**5d. `tasks.md`** — ordered, typed. Each task declares `agent: main`, `depends: []`, `file_targets: [...]`. Mark `[P]` on parallel-safe siblings.

Validate inside the worktree:
```bash
cd .agentic/worktrees/<slug>
bun run spec:lint
bun run tasks:verify   # expected to fail — RED is correct
```

Commit the RED state on the spec branch:
```bash
git add -A
git commit -m "spec(<id>): RED — <title>"
```

### Step 6 — Work the spec

Loop, inside the worktree:

```
while tasks remain unchecked:
  pick the next ready task (depends satisfied)
  edit each file in file_targets (non-deterministic step)
  run: bun run tasks:verify
  if green → next task
  else → inspect output, adjust, re-edit
  if stuck after 3 attempts → escalate (write blocker.md, stop)
```

Edit only files listed in the current task's `file_targets`. Respect `specs/constitution.md` — no `any`, no `as` outside tests, colocated tests, protected paths.

Do not tick `- [x]` yourself. `spec-complete` does that from git truth.

### Step 7 — Close the spec

When every task's `file_targets` are modified AND `bun run tasks:verify` is green:

```bash
bun run spec:complete <slug>
```

The script:
- Re-verifies the gate
- Ticks tasks whose `file_targets` were modified in git
- Archives the spec folder
- Commits with a conventional message

### Step 8 — Push + PR

```bash
git push -u origin spec/<slug>
gh pr create --title "<kind>(<id>): <title>" --body "$(cat <<'EOF'
## Summary
<one sentence of intent from proposal.md>

## Spec
- kind: <kind>
- gate: <path>
- archived to: specs/archive/YYYY-MM-DD-<slug>/

## Changes
<short bullet list derived from tasks.md>
EOF
)"
```

### Step 9 — Report

Print exactly:

```
/do complete for <id>:
  branch: spec/<slug>
  PR: <url>

main remains clean. Merge the PR when ready, then:
  bun scripts/worktree-close.ts <slug>
```

Stop. Do not merge the PR. Do not clean up the worktree. Both are deliberate handoffs.

## Rules

- **Main is never dirty.** Every file write goes into the worktree. Verify with `git status` from main after /do finishes.
- **Align is non-optional.** Skipping the interview produces misaligned specs that poison the archive.
- **Gate first, always.** Write the failing artifact before enumerating tasks.
- **Never tick, never merge, never close the worktree.** Those transitions are either scripts or human actions.
- **Deterministic-first.** If the user's intent can be a lint/hook/script, prefer `kind: rule` or `kind: workflow`.

## Parallelism

To run multiple `/do` in parallel: dispatch each via the `Agent` tool in a single message. Each subagent runs `/do` in isolation, each opens its own worktree, each opens its own PR. No file conflicts are possible until PR merge time.

## When NOT to invoke

- Question rather than change request → answer, skip.
- Trivial typo in a non-protected file → commit directly on main.
- An active spec already exists matching this intent → `cd` into its worktree and resume.

## Escalation

Write `.agentic/worktrees/<slug>/blocker.md` and stop when:
- Alignment cannot converge after three iterations on the same layer
- Three consecutive `tasks:verify` failures with no progress
- A required file edit would breach a constitutional axiom

The worktree + branch stay intact for human inspection. The PR is not opened.
