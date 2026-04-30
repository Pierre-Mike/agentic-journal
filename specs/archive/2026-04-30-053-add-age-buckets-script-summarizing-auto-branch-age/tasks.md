## Tasks

- id: 1
  title: "Pure functions: parseAgeBuckets, formatAgeLine, AgeBuckets type + unit tests"
  agent: main
  depends_on: []
  touches:
    - scripts/auto-age-buckets.ts
    - scripts/auto-age-buckets.test.ts
  file_targets:
    - scripts/auto-age-buckets.ts
    - scripts/auto-age-buckets.test.ts
  boundary:
    - scripts/auto-age-buckets.ts
    - scripts/auto-age-buckets.test.ts
  gate: scripts/auto-age-buckets.test.ts

- id: 2
  title: "main() entry point + package.json auto:age registration"
  agent: main
  depends_on: [1]
  touches:
    - scripts/auto-age-buckets.ts
    - package.json
  file_targets:
    - scripts/auto-age-buckets.ts
    - package.json
  boundary:
    - scripts/auto-age-buckets.ts
    - package.json
    - tests/auto-age-buckets-bdd.test.ts
  gate: tests/auto-age-buckets-bdd.test.ts
