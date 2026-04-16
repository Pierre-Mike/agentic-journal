# Design

## Approach

Single pure function + thin consumer in the post route. Sequential regex transforms strip MDX/markdown noise, then split-and-count. No AST, no streaming — regex pipeline is sufficient and keeps the module shallow + dependency-free.

```
input text
  ▼  strip fenced code   (```...```)
  ▼  strip MDX import/export lines
  ▼  strip images        (![alt](url))
  ▼  reduce links        ([label](url) → label)
  ▼  strip JSX tags      (<Foo .../>, <Bar>...</Bar>)
  ▼  strip HTML tags     (<div>...</div>)
  ▼  strip inline code   (`...`)
  ▼  split /\s+/, drop empty
  ▼  { words, minutes = max(1, round(words/WPM)) }
```

Route consumes `post.body` (raw MDX string on the content-collection entry) at build time. No runtime JS.

## Files touched

- `src/lib/reading-time.ts` — new module, exports `readingTime`, `WPM`
- `src/lib/reading-time.test.ts` — gate (written RED first)
- `src/pages/posts/[...slug].astro` — call `readingTime(post.body)`, append `· {minutes} min read` to the meta line

## Decisions

- **Single spec** — utility + route wiring together. Splitting would half-ship the user-visible intent and add ceremony for a 2-line consumer edit.
- **Strip code entirely.** Counting code at 200 WPM inflates via symbol-tokens; a separate code-WPM is language-agnostic guesswork. Stripping reflects prose commitment honestly.
- **No frontmatter override.** Computed only. YAGNI; adds schema + resolver + precedence for a hypothetical case.
- **Regex pipeline, not MDX AST.** Adding `@mdx-js/mdx` for word counting is overkill; regex covers documented cases and stays dependency-free.
- **Meta-line placement.** Append to the existing `{date} · spec {spec_id}` line. Zero new components, zero new CSS, reversible.

## Out of scope

- Listing page ("X min read" on post cards)
- `content.config.ts` schema changes
- i18n / pluralization
