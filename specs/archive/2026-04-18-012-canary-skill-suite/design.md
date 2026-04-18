# Design

## Approach

Framework + 2 dry-run fixtures. No real LLM execution in this spec. A "canary" is a JSON entry pointing at a deterministic `.ts` script; the runner spawns each script via `Bun.spawn`, captures stdout + exit, compares to `expected_output`, and computes a weighted pass rate.

## Data shape

```ts
interface CanaryEntry {
  id: string;
  description: string;
  script_path: string;        // relative to repo root, e.g. canaries/scripts/<id>.ts
  expected_output: string;    // substring match on stdout; if empty, only exit 0 is required
  weight: number;             // positive number; pass rate is sum(weight where passed) / sum(weight)
}

interface CanaryResult {
  id: string;
  passed: boolean;
  exit_code: number;
  stdout: string;
  duration_ms: number;
  reason: string | null;      // why it failed, null on pass
}

interface CanaryReport {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  pass_rate: number;          // 0..1, weighted
  results: CanaryResult[];
}
```

## File layout

```
canaries/
├── baseline.json                              # locked array of CanaryEntry
└── scripts/
    ├── canary-spec-template-shape.ts          # asserts _template files exist + have headings
    └── canary-hook-block-allowlist.ts         # asserts enforce.ts blocks archive path

scripts/
├── canary-run.ts         # pure fns + CLI
├── canary-run.test.ts    # colocated unit tests for pure fns
└── smoke-canary.ts       # end-to-end smoke against tmpdir baseline
```

## Function signatures (pure, named params when 3+)

```ts
export function loadBaseline(path: string): CanaryEntry[]
export async function runCanary(args: { entry: CanaryEntry; cwd: string }): Promise<CanaryResult>
export function score(results: CanaryResult[], entries: CanaryEntry[]): CanaryReport
export async function run(argv: string[]): Promise<number>  // CLI entry
```

`score` is pure: takes results + entries (for weights), returns a CanaryReport. No IO. Guarded against divide-by-zero (empty list → pass_rate 1).

## CLI surface

```
bun scripts/canary-run.ts [--baseline <path>] [--filter <id>] [--format text|json] [--update-baseline]
```

- `--baseline` default `canaries/baseline.json`
- `--filter <id>` run a single canary
- `--format` text (default) or json
- `--update-baseline` refuses unless `CANARY_UPDATE=1`; prints current pass/fail to stdout (never writes baseline itself in this spec — the guard exists to reserve the flag for a future spec)

## Decisions

- **Dry-run fixtures over real /do** — real LLM canaries are 10-100× the cost of CI we can afford. Start with deterministic fixtures; real canaries get their own spec once cost model is clearer.
- **Substring match on stdout** — full structural assertions belong inside the canary script itself; `expected_output` is a lightweight smoke marker ("did the script reach its success path?").
- **Weighted pass rate** — even at 2 canaries, weight lets us tune importance without renaming entries.
- **CanaryEntry lives in baseline.json, not TS** — baseline must be human-reviewable on PRs; JSON diffs cleanly.
- **`CANARY_UPDATE` env guard** — `--update-baseline` flag exists in CLI grammar but refuses without env; prevents accidental invocation.

## Risks

- Canary scripts that silently pass without asserting anything — mitigated by each fixture asserting concrete conditions (existence + heading presence, or exit code 2 from enforce).
- Future reviewer assumes "canary green" == "skill correct" — mitigated by proposal.md explicitly flagging this as framework-only.

## Out of scope

- Real `/do`-recursion canaries (separate spec; too expensive for CI).
- SWE-bench / LLM-as-judge graders.
- CI hook to require canary green on `.claude/skills/` PRs.
- `--update-baseline` actually writing the baseline (flag reserved; implementation deferred).
