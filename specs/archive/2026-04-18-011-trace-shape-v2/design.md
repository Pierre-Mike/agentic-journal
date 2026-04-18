# Design

## Approach

1. Extend `BaseEvent` / payload type in `.claude/hooks/types.ts` with optional span fields.
2. Update `.claude/hooks/observe.ts` to generate `span_id` per emission, track a per-session stack mapping `tool_name → pending span_id + started_at` so PostToolUse can populate `parent_span_id` and `duration_ms`. Infer `status`.
3. Extend `TraceLine` in `scripts/trace-scan.ts` to carry the new optional fields. `isTraceLine` tolerates their absence → backward compat preserved.
4. Add three pure detectors in `scripts/trace-scan.ts`:
   - `detectLoops({ events, windowSize, maxRepeats })` — slides a window of size `windowSize` over ordered events; flags any `(tool, file)` tuple whose count in the window >= `maxRepeats`.
   - `detectDrift({ events, allowedFiles })` — for every Write-class tool event, flags events whose `file` doesn't match any entry in `allowedFiles` (supports simple `*` / `**` globs via a tiny matcher).
   - `detectRetryStorm({ events, threshold })` — scans chronologically, counts consecutive "verify" failure events (event/tool === verify + status=error) per session; flags any run ≥ threshold.
5. Extend `aggregate()` and `TraceScanReport` with `loops`, `drift`, `retries` fields. Text renderer prints a compact summary.
6. CLI: add `--detect` flag (parsed, but default surfaces all three; we emit whichever set was requested).
7. New tests in `scripts/trace-scan.test.ts` cover detectors + backward-compat.

## Files touched

- `.claude/hooks/types.ts` — add optional span fields on `ToolEvent` (and base emit payload shape).
- `.claude/hooks/observe.ts` — generate span id, track pending spans, populate new fields.
- `scripts/trace-scan.ts` — extend `TraceLine`, `TraceScanReport`, new detectors, wire into `aggregate`, CLI flag, text renderer.
- `scripts/trace-scan.test.ts` — RED tests for detectors + backward-compat.

## Decisions

- **Span-id generator** — use `crypto.randomUUID()` (available in Bun). Rejected: nanoid (extra dep), monotonic counter (not unique across sessions).
- **Parent-span tracking** — process-local map keyed by `session_id:tool_name`. Not exposed outside observe.ts. PreToolUse pushes; PostToolUse pops and uses recorded `started_at`. If PostToolUse arrives without a matching Pre, `parent_span_id` stays `undefined` and `duration_ms` is omitted — never throw.
- **Status inference** — `error` if `tool_response.is_error === true` or the hook was a blocker (we don't have blocker signal in observe.ts today); `ok` otherwise. `blocked` reserved for future PreToolUse rejections. Keep inference conservative: default `ok`.
- **Glob matcher for drift** — minimal: `**` matches any path segments, `*` matches any chars within a segment. No external dep. Pure, tested.
- **Backward compat** — `isTraceLine` keeps the same four required fields (`ts`, `session_id`, `event`, `agent_id`). New fields on `TraceLine` are `?`. Old jsonl parses.
- **Detector purity** — zero IO, zero `Date.now()` inside detectors; everything comes from the events argument.
- **Named args** — all three detectors take an options object; they have 2 meaningful args today (events + config) but adopting named-args early keeps the signature stable for future knobs.

## Risks

- **observe.ts process lifetime** — each hook invocation is a separate process; a module-level Map won't persist across invocations. Mitigation: persist the pending-span table as a tiny JSON file under `.claude/traces/.spans-<session>.json`, read/write inside the same try/catch that makes observe.ts never throw. Worst case: `parent_span_id` and `duration_ms` stay undefined — still backward compatible.
- **Glob matcher bugs** — minimal matcher + dedicated tests.
- **Existing trace files** — read-tested via the backward-compat test case with a synthetic old-shape `TraceLine`.

## Out of scope

- Integrating detectors into `/retro` skill (separate spec).
- OTLP export / external telemetry sink.
- Metrics histograms or latency percentiles.
- Cross-session correlation.
