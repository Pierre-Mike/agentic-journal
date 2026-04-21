# Tasks — 029 Hot-file edit saturation detector

## Task 1 — Add `HotFileFinding` type and `detectHotFiles` pure function

- agent: main
- depends: []
- file_targets: [scripts/trace-scan.ts]
- boundary: [scripts/trace-scan.test.ts is frozen — do not edit]

Add the `HotFileFinding` interface and the exported `detectHotFiles` function.

```ts
export interface HotFileFinding {
  session_id: string;
  file: string;
  count: number;
  first_ts: string;
  last_ts: string;
}

export function detectHotFiles(params: {
  events: readonly TraceLine[];
  minEdits?: number;
}): HotFileFinding[]
```

Filter to `tool === "Write" || tool === "Edit"`, skip null/undefined `file`, group by `(session_id, file)`, discard groups below `minEdits` (default 10), sort count desc / first_ts asc / session_id asc.

## Task 2 — Extend `TraceScanReport` with `hot_files`; populate in `aggregate()`

- agent: main
- depends: [1]
- file_targets: [scripts/trace-scan.ts]
- boundary: [scripts/trace-scan.test.ts is frozen — do not edit]

Add `hot_files: HotFileFinding[]` to the `TraceScanReport` interface. In `aggregate()`, add:

```ts
hot_files: detectHotFiles({ events, minEdits: 10 }),
```

alongside the existing `loops`, `drift`, `retries`, `blocks` calls.

## Task 3 — Add `renderHotFiles` and wire into `renderText()`

- agent: main
- depends: [2]
- file_targets: [scripts/trace-scan.ts]
- boundary: [scripts/trace-scan.test.ts is frozen — do not edit]

Add the exported `renderHotFiles` function:

```ts
export function renderHotFiles(findings: readonly HotFileFinding[]): string
```

Returns `""` on empty input. Otherwise returns `"Hot files:\n"` followed by `  [<sid>] <file> ×<count>` lines.

In `renderText()`, add a block mirroring the `Loops:` / `Blocks:` pattern:

```ts
if (report.hot_files.length > 0) {
  lines.push("");
  lines.push(renderHotFiles(report.hot_files));
}
```
