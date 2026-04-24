# Tasks

Ordered checklist. Each task declares its `agent`, `depends`, `file_targets`,
and `boundary`.

Parallel-safe siblings are marked `[P]`.

- [ ] T1. RED test authored (spec-tester completes this)
  - agent: main
  - depends: []
  - file_targets: [scripts/spec-lint.test.ts]
  - boundary: [scripts/spec-lint.test.ts]
- [ ] T2. [P] Implement detectDuplicateIds and wire into main()
  - agent: main
  - depends: [T1]
  - file_targets: [scripts/spec-lint.ts]
  - boundary: [scripts/spec-lint.ts]
- [ ] T3. [P] Archive rename: 030-fold-judge-escalation → 031
  - agent: main
  - depends: [T1]
  - file_targets: [specs/archive/2026-04-22-031-fold-judge-escalation/proposal.md]
  - boundary: [specs/archive/**]
- [ ] T4. [P] Archive rename: 030-skip-judge-rule-workflow → 032
  - agent: main
  - depends: [T1]
  - file_targets: [specs/archive/2026-04-22-032-skip-judge-rule-workflow/proposal.md]
  - boundary: [specs/archive/**]
- [ ] T5. [P] Archive rename: 031-your-computer-is-enough → 033
  - agent: main
  - depends: [T1]
  - file_targets: [specs/archive/2026-04-22-033-your-computer-is-enough/proposal.md]
  - boundary: [specs/archive/**]
- [ ] T6. [P] Archive rename: 032-typed-gates-sibling-tests → 034
  - agent: main
  - depends: [T1]
  - file_targets: [specs/archive/2026-04-23-034-typed-gates-sibling-tests/proposal.md]
  - boundary: [specs/archive/**]
- [ ] T7. Verify gate green
  - agent: main
  - depends: [T2, T3, T4, T5, T6]
  - file_targets: []
  - boundary: [*]
