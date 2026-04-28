---
id: NNN-slug
title: Short descriptive title
status: active
kind: code | rule | workflow | writeup
# kind:code uses slice-RED TDD: each task in tasks.md declares its own gate:
# field. The proposal-level gate: below is a human-readable derived summary
# of per-task gates — NOT a source of truth. spec-lint does not enforce it
# for kind:code. For non-code kinds (rule/workflow/writeup), the proposal-level
# gate: remains the authoritative single gate.
#
# kind:code example (per-task gates declared in tasks.md, listed here for readability):
gate:
  - path: src/foo.test.ts
    level: unit
  - path: scripts/smoke-foo.ts
    level: e2e
# For non-code kinds, scalar (legacy) is accepted:
#   gate: path/to/gate/artifact
created: YYYY-MM-DD
owner: main
depends_on: []
supersedes: null
---

## Intent

One paragraph. Why does this exist? What user-visible or system-visible change does it produce?

## Constraints

- Bullet list of hard requirements
- Explicit non-goals

## Acceptance criteria

- [ ] Observable condition 1 (encoded in the gate)
- [ ] Observable condition 2

## Context

Link to related specs, issues, or external references.
