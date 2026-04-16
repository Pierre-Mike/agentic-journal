# Design

## Approach

Add `scripts/trace-scan.ts` as a self-contained module: pure aggregation functions (unit-tested colocated) + thin IO layer (covered by smoke) + CLI entrypoint guarded by `import.meta.main`. The aggregator reads every `.jsonl` under `./.claude/traces` (or the path passed via `--traces-dir`), parses each line with try/catch that silently drops malformed entries, filters by `--since` cutoff and optional `--session`, and produces a `TraceScanReport` printable as text or JSON.

## Files touched

- `scripts/trace-scan.ts` — new. CLI + exported pure fns (`parseSince`, `aggregate`, `topN`) + IO helpers (`loadTraces`, `renderText`, `run`). Types (`TraceLine`, `TraceScanReport`, `SessionAgg`, `FileCount`) defined inline.
- `scripts/trace-scan.test.ts` — new. Colocated unit tests for pure fns using `bun:test`.
- `scripts/smoke-trace-scan.ts` — new. End-to-end gate: `mkdtempSync` fixture → real JSONL files → `loadTraces` + `aggregate` → assertions on counts, tool frequencies, file ranking, session filter.
- `specs/active/005-trace-scan/findings.md` — new. `/retro` audit trail.
- `specs/active/005-trace-scan/{proposal,design,tasks}.md` — new. Standard spec docs.

## Decisions

- **Read-all over streaming** — current traces are 16 KB total; readline adds complexity for zero benefit. Header comment flags the 5 MB threshold at which to switch.
- **Types inline in `trace-scan.ts`, not `_lib.ts`** — `_lib.ts` is spec-frontmatter-shaped; trace shapes are unrelated concern. Avoid bloating the shared module with single-consumer types.
- **Unit + smoke split** — pure fns (`parseSince`, `aggregate`, `topN`) tested with `bun:test`; IO (`loadTraces`, `renderText`, CLI wiring) covered by the smoke's tmpdir fixtures. No redundancy.
- **No invented block/failure counts** — hook `block()` in `types.ts` does `process.exit(2)` BEFORE `PostToolUse` fires, so hook-blocked attempts are not in the JSONL. The aggregator counts what's in the data, nothing more.
- **Silent skip on malformed JSON** — symmetry with `observe.ts`'s never-throw contract. Malformed traces (partial writes, schema drift) must not break reads.
- **Smoke pattern mirrors `smoke-harness-fixes.ts`** — `mkdtempSync`, `assertTrue(cond, name, detail?)` helper, `process.exit(failed > 0 ? 1 : 0)`. Proven locally in spec 003.

## Out of scope

- Widening `emitTrace` payload (new fields: tool args, exit codes, agent summaries) — separate spec
- Detecting hook-blocked calls — requires write-side change first
- Wiring aggregator output into `/retro` narrative — separate spec once this gate is green
