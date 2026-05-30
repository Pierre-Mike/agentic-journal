## Tasks

- id: 1
  title: "Implement scripts/slice/local-ci.ts: fail-fast step runner"
  agent: main
  depends_on: []
  touches:
    - scripts/slice/local-ci.ts
  file_targets:
    - scripts/slice/local-ci.ts
  boundary:
    - scripts/slice/**
  gate: scripts/slice/local-ci.test.ts

- id: 2
  title: "Implement scripts/slice/loop.ts: loop wrapper with GREEN/RED dispatch"
  agent: main
  depends_on: [1]
  touches:
    - scripts/slice/loop.ts
  file_targets:
    - scripts/slice/loop.ts
  boundary:
    - scripts/slice/**
  gate: scripts/slice/loop.test.ts

- id: 3
  title: "Update slice.yml to invoke loop.ts instead of direct agent dispatch"
  agent: main
  depends_on: [2]
  touches:
    - .github/workflows/slice.yml
  file_targets:
    - .github/workflows/slice.yml
  boundary:
    - .github/workflows/slice.yml
    - scripts/slice/**
  gate: tests/workflows/slice-loop-wiring.test.ts
