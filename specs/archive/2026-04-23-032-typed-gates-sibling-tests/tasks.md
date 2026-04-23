# Tasks — 032 Typed gates and sibling tests

- [x] Add gateEntries() helper to scripts/_lib.ts
    - agent: main
    - depends: []
    - boundary: ["scripts/_lib.ts", "scripts/_lib.test.ts"]
    - file_targets: ["scripts/_lib.ts"]

- [x] Extend spec-lint.ts with level-coverage, invalid-level, duplicate-path checks
    - agent: main
    - depends: [0]
    - boundary: ["scripts/spec-lint.ts", "scripts/spec-complete.ts"]
    - file_targets: ["scripts/spec-lint.ts"]

- [x] Update tasks-verify.ts to iterate every gate entry
    - agent: main
    - depends: [0]
    - boundary: ["scripts/tasks-verify.ts"]
    - file_targets: ["scripts/tasks-verify.ts"]

- [x] Implement scripts/sibling-test-hook.ts
    - agent: main
    - depends: []
    - boundary: ["scripts/sibling-test-hook.ts"]
    - file_targets: ["scripts/sibling-test-hook.ts"]

- [x] Wire sibling-test into lefthook.yml pre-commit
    - agent: main
    - depends: [3]
    - boundary: ["lefthook.yml"]
    - file_targets: ["lefthook.yml"]

- [x] Update specs/_template/proposal.md for list syntax
    - agent: main
    - depends: [1]
    - boundary: ["specs/_template/proposal.md"]
    - file_targets: ["specs/_template/proposal.md"]

- [x] Update specs/constitution.md §4
    - agent: main
    - depends: [1]
    - boundary: ["specs/constitution.md"]
    - file_targets: ["specs/constitution.md"]
