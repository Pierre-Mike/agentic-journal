## Tasks

- id: 1
  title: "Add upload-artifact step to slice.yml"
  agent: main
  depends_on: []
  touches:
    - .github/workflows/slice.yml
  file_targets:
    - .github/workflows/slice.yml
  boundary:
    - .github/workflows/slice.yml

- id: 2
  title: "Add upload-artifact step to intent.yml"
  agent: main
  depends_on: []
  touches:
    - .github/workflows/intent.yml
  file_targets:
    - .github/workflows/intent.yml
  boundary:
    - .github/workflows/intent.yml

- id: 3
  title: "Add upload-artifact step to claude.yml"
  agent: main
  depends_on: []
  touches:
    - .github/workflows/claude.yml
  file_targets:
    - .github/workflows/claude.yml
  boundary:
    - .github/workflows/claude.yml

- id: 4
  title: "Update retro SKILL.md Step 2 for CI artifact traces"
  agent: main
  depends_on: []
  touches:
    - .claude/skills/retro/SKILL.md
  file_targets:
    - .claude/skills/retro/SKILL.md
  boundary:
    - .claude/skills/retro/SKILL.md
