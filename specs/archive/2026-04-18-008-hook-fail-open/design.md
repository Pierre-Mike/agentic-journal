# Design

## Approach

1. Extend `.claude/hooks/enforce.test.ts` with RED assertions covering three
   concrete regressions:
   - malformed JSON on dispatcher stdin → exit 2
   - PreToolUse event that should be blocked → exit 2
   - internal throw inside `enforcePreToolUse` → exit 2 (not 1)
   Also add a whitelist "dispatcher never exits 1" test that acts as a
   general guardrail for future regressions.
2. Implement in `.claude/hooks/enforce.ts`: wrap `enforcePreToolUse` body in
   `try { ... } catch { console.error(...); process.exit(2); }`. `block()`
   already exits 2, so no change to the helper — only the catch-all.
3. Implement in `.claude/hooks.ts`: wrap JSON parse and dispatch in one
   try/catch that `console.error`s the reason and `process.exit(2)`. Also
   add an unhandled-rejection / uncaught-exception listener at entry that
   exits 2.

## Files touched

- `.claude/hooks/enforce.ts` — add try/catch wrapper around
  `enforcePreToolUse` body; fail-closed on any throw
- `.claude/hooks/enforce.test.ts` — add RED-then-GREEN test cases for
  internal error, malformed JSON, blocked event, allowed event, and a
  "never exit 1" guardrail
- `.claude/hooks.ts` — wrap JSON parse + dispatch in try/catch →
  `process.exit(2)`; register process-level fail-closed listeners

## Decisions

- **Catch-all wraps `enforcePreToolUse`** — agreed. A thrown exception
  anywhere inside the hook body must not bubble into Bun's default exit-1
  handler, since exit 1 from a PreToolUse hook means "allow". Rejected
  alternative: let it throw and rely on dispatcher catch — not defense in
  depth, one ring of protection is not enough for a security boundary.
- **Explicit `process.exit(2)` on every block path** — already the case via
  `block()` in `types.ts`. Kept for clarity; no alternative considered.
- **Never `process.exit(1)` from a hook** — `1` means "hook ran fine,
  allow" per Claude Code docs. Any non-2 non-0 exit from a hook is a bug.
- **Subprocess tests for the dispatcher** — the only faithful way to assert
  the exit code of `.claude/hooks.ts` is to spawn it with stdin. Rejected
  alternative: in-process import and mock; cannot capture top-level-await
  exit behavior of a module with no exported function.
- **Anchor test paths on `import.meta.dir`** — tests run identically from
  the main repo and any worktree. Rejected alternative: `process.cwd()` —
  fragile across bun test invocations.

## Risks

- Subprocess tests are slower (~20ms/test spawn). Mitigation: four
  subprocess tests only, total cost <200ms.
- A dispatcher that fail-closes on every throw could mask legitimate bugs.
  Mitigation: always `console.error` the caught error first, so the
  operator sees the reason on stderr even though the exit is 2.

## Out of scope

- `verify.ts` shape — no change
- `observe.ts` shape — no change (it already swallows internally and never
  throws)
- `.claude/settings.json` — no change
- Matcher coverage in settings.json (Bash hook wiring) — out of scope; this
  spec only hardens existing PreToolUse + PostToolUse paths
