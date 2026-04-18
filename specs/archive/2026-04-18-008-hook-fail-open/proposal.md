---
id: 008-hook-fail-open
title: Hook fail-open fix — explicit exit 2 discipline
status: archived
kind: code
gate: ./.claude/hooks/enforce.test.ts
created: 2026-04-18T00:00:00.000Z
owner: main
depends_on: []
supersedes: null
archived: '2026-04-18'
---

## Intent

`enforce.ts` (PreToolUse hook) today returns non-`2` exit codes on bugs, thrown
exceptions, or bad-JSON parse. Per Claude Code hooks docs, only exit code 2
blocks a tool call. Any other exit code (including 1) means "hook ran fine,
allow." A buggy hook therefore silently allows what should be blocked. This is
a current security regression. This spec audits every `block()` path in
`enforce.ts` and the dispatcher `.claude/hooks.ts`, wraps them in a try/catch
that exits 2, and adds RED-then-GREEN tests that assert exit code 2 on
malformed JSON, blocked events, and internal errors.

## Constraints

- TS strict, no `any`, no `as` outside tests
- Colocated tests stay in `.claude/hooks/`
- Do NOT touch `observe.ts` or `verify.ts` shape — only enforcement paths
- Never `process.exit(1)` from a hook — either 0 (allow) or 2 (block)
- `enforcePreToolUse` must be wrapped in try/catch that exits 2 on throw
- `.claude/hooks.ts` dispatcher must similarly fail-closed on any throw
- Do not change `.claude/settings.json`

## Acceptance criteria

- [ ] `.claude/hooks/enforce.test.ts` has explicit assertions for exit code 2 on: malformed JSON, blocked event, internal error
- [ ] `bun test .claude/hooks/enforce.test.ts` passes
- [ ] `enforcePreToolUse` cannot return without an explicit exit code path
- [ ] `bun run check` passes
- [ ] `bun run spec:lint` passes
- [ ] `bun run tasks:verify` reports green for `008-hook-fail-open`

## Context

- Claude Code hooks docs: exit code semantics for `PreToolUse` — 0 allows, 2
  blocks, any other code = "hook ran fine, allow"
- Ona 2025 deny-list bypass via path aliasing — a precedent for fail-open
  hooks letting through commands the policy was supposed to reject
- Gap analysis 2026-04-18 surfaced this gap in the current `enforce.ts`
