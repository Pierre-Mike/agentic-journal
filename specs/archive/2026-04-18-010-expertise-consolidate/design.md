## Approach

Self-contained module `scripts/expertise-consolidate.ts`: pure parse / dedupe / prune / serialize functions (unit-tested colocated) + thin IO helper `consolidateFile` (covered by smoke) + CLI entrypoint guarded by `import.meta.main`. The smoke builds a synthetic fixture ref file inside `mkdtempSync`, runs the consolidator, asserts counts, then re-runs it and asserts byte-identical output (idempotency).

## Entry format

Taken verbatim from `.claude/skills/expertise/schema.md`. An entry is a list item that opens with bold text (the entry's title, typically `**FE-G001: short title**`) and is followed by a metadata line containing the fields `confidence: 0.X`, `added: YYYY-MM-DD`, and optionally `validated: YYYY-MM-DD`, then a free-form body until the next list-item boundary or end-of-file.

```
- **FE-G001: Short title**
  confidence: 0.7 | added: 2026-03-10 | validated: 2026-04-08
  Body text.
```

A superseded entry uses the tilde-strikethrough form `- ~~**...**~~` followed by an italic `*Superseded: ...*` line. The consolidator treats these as entries too — they may be dropped by age just like any other entry.

Non-entry content (frontmatter, `# Heading`, intro paragraph before the first list item) is preserved verbatim as the file's "header".

## Pure function signatures

```ts
interface Entry {
  readonly raw: string;          // exact substring from source (including trailing blank line if present)
  readonly title: string;        // text inside **...** on the first line
  readonly body: string;         // normalized content used for hashing (title + body text)
  readonly added: string | null; // ISO date from the metadata line, if parseable
}

interface ParsedFile {
  readonly header: string;       // content before the first entry
  readonly entries: readonly Entry[];
}

function parseEntries(markdown: string): ParsedFile;
function dedupeByHash(entries: readonly Entry[]): readonly Entry[];
function pruneByAge(params: {
  entries: readonly Entry[];
  now: Date;
  maxAgeDays: number;
}): readonly Entry[];
function serialize(params: { header: string; entries: readonly Entry[] }): string;
function consolidateFile(params: {
  path: string;
  now: Date;
  maxAgeDays: number;
  dryRun: boolean;
}): { kept: number; dropped: number; changed: boolean };
```

## Files touched

- `scripts/expertise-consolidate.ts` — new. Pure fns + IO helper + CLI.
- `scripts/expertise-consolidate.test.ts` — new. Unit tests for the four pure fns.
- `scripts/smoke-expertise-consolidate.ts` — new. Real-assertion smoke with tmpdir fixture.
- `specs/active/010-expertise-consolidate/{proposal,design,tasks}.md` — new. Standard spec docs.

## Decisions

- **Hash normalization** — strip leading/trailing whitespace from title + body, collapse interior whitespace runs to a single space, lowercase. SHA-256 truncated to the first 16 hex chars for Map keys. Deterministic and stable across Node/Bun. Alternatives rejected: full SHA-256 (needlessly long), string equality (too brittle — trailing whitespace noise defeats dedup).
- **Dedup drops later duplicates** — earliest occurrence wins. Rationale: first-added entries have had the longest time to be cited/validated; later re-adds are usually rediscoveries.
- **Age basis is `added`, not `validated`** — `added` is the immutable creation date; `validated` bumps would reset the age clock and defeat pruning. Entries with unparseable or missing `added` are kept (never dropped by age) — conservative default.
- **Idempotency via fixed sort** — `dedupeByHash` preserves first-seen order; `pruneByAge` preserves order; `serialize` concatenates verbatim raws. Any run on the post-consolidation output yields the same bytes.
- **Pure fns vs IO split** — `parseEntries`, `dedupeByHash`, `pruneByAge`, `serialize` are pure and unit-tested with `bun:test`. `consolidateFile` does the `readFileSync` / `writeFileSync`, covered by the smoke's tmpdir fixture.
- **CLI safety** — `--dry-run` prints kept/dropped counts without writing. Default mode writes in place. No backup file — callers should version-control their refs.
- **No recursion** — CLI takes a single file path. Batch use = shell loop; keeps the script's responsibility narrow.

## Risks

- Parser brittleness on malformed entries (e.g., missing metadata line). Mitigation: `added: null` sentinel means "never prune by age"; title-less list items fall through to the header so they're preserved verbatim.
- Expertise format evolution (extra fields, nested sections). Mitigation: parser keys only on the bold-title-opener + metadata-line pattern, tolerant of extra lines in the body.

## Out of scope

- Invoking the consolidator automatically from the `expertise` skill (separate spec)
- LLM-driven semantic merging of near-duplicates
- Multi-file batch mode with a glob
- Any edits to `.claude/skills/expertise/*`
