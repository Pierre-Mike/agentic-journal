# Tasks

- [ ] 1. Author `scripts/smoke/automerge-issue-lookup.ts` with full assertion
      logic: checks that the broken regex is absent from `automerge.yml` and
      that the correct regex is present. Exits 0 on all-pass, 1 with a
      diagnostic on any failure. RED against the unpatched workflow.
  - agent: main
  - depends_on: []
  - file_targets: [scripts/smoke/automerge-issue-lookup.ts]
  - boundary: [scripts/smoke/automerge-issue-lookup.ts]
  - touches: [scripts/smoke/automerge-issue-lookup.ts]
- [ ] 2. Patch `.github/workflows/automerge.yml` line 58: replace
      `grep -oP '(?<=issue-)\d+'` with `grep -oP '^auto/\K[0-9]+'`.
      Optionally update the comment on line 56 to read:
      `# Fallback: parse issue number from branch name convention auto/<N>-<slug>`.
      Brings the smoke from RED to GREEN.
  - agent: main
  - depends_on: [1]
  - file_targets: [.github/workflows/automerge.yml]
  - boundary: [.github/workflows/automerge.yml]
  - touches: [.github/workflows/automerge.yml]
