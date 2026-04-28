---
name: do-auto
description: >
  Headless variant of /do — replaces the interactive `align` interview with the `auto-aligner`
  subagent and an ambiguity gate. Reads intent, dispatches auto-aligner, branches on the mailbox
  status. On `confirmed` + `confidence: high`, runs Steps 3-10 from /do (worktree, scaffold,
  slice loop, close, push, PR). On `needs-human`, exits 0; the mailbox sits at
  `.agentic/last-alignment.md` for the morning digest. Invoke as `/do-auto <intent>` from a TTY
  or via `claude -p --max-turns 100 "/do-auto <intent>"` from cron, retro findings, or a queue.
  Never opens a worktree until the auto-aligner returns high confidence.
---

## Core Principle

One headless command per change. No human interaction. The auto-aligner is the single judgment point — its `confidence` field gates everything downstream. Default action on ambiguity is "do nothing, surface for human review" — never guess and scaffold.

## Preconditions

- Current directory is the repo root
- Current branch is `main`
- Working tree is clean (`git status --porcelain` empty)
- `.agentic/` directory exists (gitignored, holds runtime state)

Refuse with a clear stderr message and exit 1 if any precondition fails.

## Workflow

### Step 1 — Write intent sidecar

The user's intent string (the argument to `/do-auto`) is written to `.agentic/last-intent.txt` so the `auto-aligner` agent can hash it deterministically.

```bash
echo "<intent>" > .agentic/last-intent.txt
```

### Step 2 — Dispatch auto-aligner

```
Agent({
  subagent_type: "auto-aligner",
  description: "do-auto: align <slug-of-intent>",
  prompt: <intent string + "Read .agentic/last-intent.txt; write .agentic/last-alignment.md per your contract.">,
})
```

Wait for completion. The auto-aligner exits 0 in all cases — outcome is encoded in the mailbox file.

### Step 3 — Branch on mailbox status

Read the mailbox via the shared helper:

```ts
import { parseAlignmentAndBranch } from "scripts/do-auto-branch";
const result = parseAlignmentAndBranch(".agentic/last-alignment.md");
```

If `result.proceed === false`:

```
echo "/do-auto exited: ${result.reason}"
echo "alignment.md sits at: $(realpath .agentic/last-alignment.md)"
echo "morning digest will surface this row for human review"
exit 0
```

The mailbox file is left in place. The morning digest (spec 5) reads it.

If `result.proceed === true`, continue to Step 4.

### Step 4 — Extract spec fields from alignment.md

Parse the alignment to derive:
- `title` — sentence-case from the alignment's `## Goal` first sentence
- `kind` — inferred from the alignment's structure:
  - "lint rule" / "block X via hook" → `rule`
  - "smoke test" / "shell script" / "auto-X" → `workflow`
  - "blog post" / "write up" → `writeup`
  - default → `code`
- `gate` — derived from the alignment + kind:
  - `code`: outer gate path = `tests/e2e/<slug>.spec.ts` or similar (same conventions as `/do`)
  - `rule | workflow`: a script under `scripts/`
  - `writeup`: the `.mdx` file path
- `depends_on` — scan archived specs for matches; if none found, set to `[]`

If any field cannot be derived confidently, write the reason into `replan-escalation.md` (or a sidecar file) and exit 0 — same soft-escalation pattern as the replanner. The mailbox stays as `confirmed` since alignment was clear; only field extraction failed.

### Step 5 — Run /do Steps 3-10

From here forward, the workflow is identical to `/do`. Reference `.claude/skills/do/SKILL.md` Steps 3-10:

- Step 3: Allocate ID and slug
- Step 4: Open worktree (`bun scripts/worktree-open.ts <slug>`)
- Step 5: Scaffold the spec (5a proposal.md, 5b alignment.md copied from mailbox, 5c gate, 5d design.md, 5e tasks.md)
- Step 6: Per-slice TDD loop (kind: code) or work loop (other kinds)
- Step 7: Close (`bun run spec:complete <slug>`)
- Step 8: Push + PR + auto-merge
- Step 9: Watch CI
- Step 10: Report

The Step 10 report is printed to stdout (since headless contexts capture stdout). Do NOT prompt for confirmation at any step.

## Headless invocation

Cron, queue, or one-off:

```bash
claude -p --max-turns 100 \
  --setting-sources project,user \
  "/do-auto $(cat my-intent.txt)"
```

The `--max-turns 100` cap protects against runaway slice loops. A typical kind:code spec with 4 slices uses ~30-50 turns; bumping to 100 leaves headroom.

## Hard rules

- **Never bypass auto-aligner.** Even if the intent looks clear, dispatching the aligner is the safety check. Skipping it removes the ambiguity gate.
- **Never scaffold a spec when status is needs-human.** Exit 0 with the reason. The morning digest is the recovery path.
- **Main is never dirty.** Same as /do — every write goes into the worktree.
- **Never `git pull` from within /do-auto.** The post-merge hook handles cleanup.
- **Soft-escalate, never hard-block.** Field-extraction failures, replan conflicts, CI red — all surface in artifacts the digest reads. Never throw; exit 0 with a clear stdout line.

## When NOT to invoke

- Interactive session where the user wants alignment confirmation → use `/do` instead.
- Intent that names a destructive action (delete, drop, mass-rename) → human review required regardless. Auto-aligner should set `needs-human` for these.
- Repo state mid-merge or mid-rebase — preconditions block it.

## Relationship to /do

`/do` and `/do-auto` share Steps 3-10 conceptually. The skill files are independent so each can evolve without breaking the other. If the workflow drifts (e.g., a new step is added in /do), update both — they should remain in lockstep. A future spec may extract Steps 3-10 into a shared sub-skill; for now, keep the duplication explicit.
