## Tasks

- id: 1
  title: "Update intent.yml aligner prompt to use ISSUE_NUMBER as spec id"
  agent: main
  depends_on: []
  touches:
    - .github/workflows/intent.yml
  file_targets:
    - .github/workflows/intent.yml
  boundary:
    - .github/workflows/intent.yml
  gate: tests/workflows/intent.test.ts

- id: 2
  title: "Update auto-aligner.md to derive spec dir from ISSUE_NUMBER env var"
  agent: main
  depends_on: [1]
  touches:
    - .claude/agents/auto-aligner.md
  file_targets:
    - .claude/agents/auto-aligner.md
  boundary:
    - .claude/agents/auto-aligner.md
    - .claude/agents/spec-tester.md
  gate: tests/workflows/issue-number-spec-id.test.ts
