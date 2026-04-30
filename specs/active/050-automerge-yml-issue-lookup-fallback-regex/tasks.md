## Tasks

- id: 1
  title: "Author scripts/smoke/automerge-issue-lookup.ts gate (RED)"
  agent: main
  depends_on: []
  touches:
    - scripts/smoke/automerge-issue-lookup.ts
  file_targets:
    - scripts/smoke/automerge-issue-lookup.ts
  boundary:
    - scripts/smoke/automerge-issue-lookup.ts
- id: 2
  title: "Patch automerge.yml line 58: replace broken regex with auto/<N>-<slug>"
  agent: main
  depends_on: [1]
  touches:
    - .github/workflows/automerge.yml
  file_targets:
    - .github/workflows/automerge.yml
  boundary:
    - .github/workflows/automerge.yml
