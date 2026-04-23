# Tasks — 032 Typed gates and sibling tests

- [ ] Add gateEntries() helper to scripts/_lib.ts
    - agent: main
    - depends: []
    - boundary: ["scripts/_lib.ts", "scripts/_lib.test.ts"]
    - file_targets: ["scripts/_lib.ts"]

- [ ] Extend spec-lint.ts with level-coverage, invalid-level, duplicate-path checks
    - agent: main
    - depends: [0]
    - boundary: ["scripts/spec-lint.ts", "scripts/spec-complete.ts"]
    - file_targets: ["scripts/spec-lint.ts"]

- [ ] Update tasks-verify.ts to iterate every gate entry
    - agent: main
    - depends: [0]
    - boundary: ["scripts/tasks-verify.ts"]
    - file_targets: ["scripts/tasks-verify.ts"]

- [ ] Implement scripts/sibling-test-hook.ts
    - agent: main
    - depends: []
    - boundary: ["scripts/sibling-test-hook.ts"]
    - file_targets: ["scripts/sibling-test-hook.ts"]

- [ ] Wire sibling-test into lefthook.yml pre-commit
    - agent: main
    - depends: [3]
    - boundary: ["lefthook.yml"]
    - file_targets: ["lefthook.yml"]

- [ ] Update specs/_template/proposal.md for list syntax
    - agent: main
    - depends: [1]
    - boundary: ["specs/_template/proposal.md"]
    - file_targets: ["specs/_template/proposal.md"]

- [ ] Update specs/constitution.md §4
    - agent: main
    - depends: [1]
    - boundary: ["specs/constitution.md"]
    - file_targets: ["specs/constitution.md"]
