# Design

Three exported pure functions handle parsing, aggregation, and formatting. A thin `main()` globs `.claude/traces/`, feeds the content into those functions, and prints the result. One file per session; filename stem is the session ID.

## Approach

1. `parseTraceContent(content: string): TraceEvent[]` — split on newlines, parse each JSON line through Zod discriminated union (`z.union([TokenUsageSchema, ToolUseSchema]).catch(undefined)`), filter out `undefined` (unknown types). Forward-compatible: new event types are silently dropped.
2. `buildReport(files: Record<string, string>): ReportData` — iterate over filename → content pairs; filename stem is the session key. For each session, aggregate `input_tokens`, `output_tokens`, `duration_ms` from `token_usage` events and tool call counts from `tool_use` events. Compute `topByTokens` (top-5 sessions by `inputTokens + outputTokens`) and `topByDuration` (top-5 by `durationMs`).
3. `formatReport(data: ReportData): string` — if `sessionCount === 0`, return `"no trace data yet."`. Otherwise format the four-section dashboard. Duration display: `Xs` for < 60s, `Xm Ys` for ≥ 60s. Session-id prefix: first 8 chars of filename stem.
4. `main()` — `await Array.fromAsync(new Bun.Glob(".claude/traces/*.jsonl").scan("."))`, read each file, call `buildReport`, call `formatReport`, `console.log`. If no files, `buildReport({})` → `formatReport` returns the empty message.

## Files touched

- `scripts/pipeline-report.ts` — new: Zod schemas + `parseTraceContent` + `buildReport` + `formatReport` + `main()`
- `scripts/pipeline-report.test.ts` — new: outer gate + slice 1 unit tests; inline JSONL fixtures, golden-string assertion
- `tests/pipeline-report-bdd.test.ts` — new: slice 2 BDD integration gate; checks file existence, package.json entry, exported API shape via dynamic import; no real JSONL reads
- `package.json` — add `"pipeline:report": "bun scripts/pipeline-report.ts"` alongside existing `pipeline:*` entries

## Decisions

- **Zod discriminated union with `.catch(undefined)`** — satisfies `noExplicitAny` + `no-as-casts` constraints; auto-handles forward-compatibility as the hook system adds new event types; more auditable than `if (type === "…")` chains. Rejected: manual narrowing (verbose, no schema docs); `JSON.parse as T` cast (violates constitution §5).
- **Filename stem as session ID** — alignment specifies "first 8 chars of the session ID from the filename stem"; using the filename means `buildReport` doesn't depend on `session_id` being present in every event. Rejected: using event `session_id` field (harder to group if field varies or is absent).
- **Inline fixture in test** — keeps unit tests self-contained and deterministic; avoids fixture file drift and brittle path resolution across worktrees. Rejected: separate `__fixtures__/trace.jsonl` (extra file to maintain; disk I/O in tests).
- **`duration_ms` summed per session** — simple and testable; sum of all `token_usage` duration_ms values in a session file. The display (`Xs` / `Xm Ys`) rounds to whole seconds.
- **`zod` as transitive dep** — already present in `node_modules` (transitive from other tooling); not added to `package.json` directly.

## Out of scope

- Filtering by date range, branch, or agent
- JSON or HTML output modes
- Per-agent breakdowns (per-tool only)
- Streaming / live tail
- Pagination of trace files
