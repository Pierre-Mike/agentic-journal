/**
 * Colocated unit tests for the pure functions in scripts/expertise-consolidate.ts.
 * Covered: parseEntries, dedupeByHash, pruneByAge, serialize. IO helpers
 * (consolidateFile, CLI) are exercised by scripts/smoke-expertise-consolidate.ts.
 */

import { describe, expect, test } from "bun:test";
import {
	dedupeByHash,
	type Entry,
	parseEntries,
	pruneByAge,
	serialize,
} from "./expertise-consolidate.ts";

const SAMPLE = `---
domain: skills
type: gotchas
updated: "2026-04-18"
updated_by: "test"
---

# Skills Gotchas

Some preamble line.

- **SK-G001: first entry**
  confidence: 0.7 | added: 2026-03-10 | validated: 2026-04-08
  Body of the first entry.

- **SK-G002: second entry**
  confidence: 0.6 | added: 2026-04-01
  Body of the second entry.
  More body on a second line.

- **SK-G001: first entry**
  confidence: 0.7 | added: 2026-03-10 | validated: 2026-04-08
  Body of the first entry.

- **SK-G003: old stale entry**
  confidence: 0.8 | added: 2025-01-01
  This one should be pruned by age.
`;

describe("parseEntries", () => {
	test("splits header from entries", () => {
		const { header, entries } = parseEntries(SAMPLE);
		expect(header).toContain("# Skills Gotchas");
		expect(header).toContain("Some preamble line.");
		expect(entries.length).toBe(4);
	});

	test("each entry captures title, added, body", () => {
		const { entries } = parseEntries(SAMPLE);
		expect(entries[0]?.title).toBe("SK-G001: first entry");
		expect(entries[0]?.added).toBe("2026-03-10");
		expect(entries[1]?.title).toBe("SK-G002: second entry");
		expect(entries[1]?.added).toBe("2026-04-01");
		expect(entries[3]?.added).toBe("2025-01-01");
	});

	test("entry raw preserves the original substring", () => {
		const { entries } = parseEntries(SAMPLE);
		const first = entries[0];
		expect(first?.raw).toContain("- **SK-G001: first entry**");
		expect(first?.raw).toContain("Body of the first entry.");
	});

	test("empty markdown → empty entries", () => {
		const { header, entries } = parseEntries("");
		expect(header).toBe("");
		expect(entries).toEqual([]);
	});

	test("markdown with no list items → header-only", () => {
		const { header, entries } = parseEntries("# Heading\n\nJust prose.\n");
		expect(entries).toEqual([]);
		expect(header).toContain("Just prose.");
	});

	test("entry without parseable added → added is null", () => {
		const md = `# H\n\n- **X: no meta**\n  Just a body with no metadata line.\n`;
		const { entries } = parseEntries(md);
		expect(entries.length).toBe(1);
		expect(entries[0]?.added).toBeNull();
	});
});

describe("dedupeByHash", () => {
	test("drops later duplicates, keeps first", () => {
		const { entries } = parseEntries(SAMPLE);
		const deduped = dedupeByHash(entries);
		expect(deduped.length).toBe(3);
		expect(deduped[0]?.title).toBe("SK-G001: first entry");
		expect(deduped[1]?.title).toBe("SK-G002: second entry");
		expect(deduped[2]?.title).toBe("SK-G003: old stale entry");
	});

	test("normalized content — whitespace-insensitive", () => {
		const a: Entry = {
			raw: "- **A: x**\n  body\n",
			title: "A: x",
			body: "body",
			added: null,
		};
		const b: Entry = {
			raw: "- **A: x**\n   body   \n",
			title: "A: x",
			body: "  body  ",
			added: null,
		};
		const deduped = dedupeByHash([a, b]);
		expect(deduped.length).toBe(1);
		expect(deduped[0]).toBe(a);
	});

	test("empty → empty", () => {
		expect(dedupeByHash([])).toEqual([]);
	});

	test("all unique → passthrough", () => {
		const a: Entry = { raw: "x", title: "A", body: "alpha", added: null };
		const b: Entry = { raw: "y", title: "B", body: "beta", added: null };
		const deduped = dedupeByHash([a, b]);
		expect(deduped.length).toBe(2);
	});
});

describe("pruneByAge", () => {
	const now = new Date("2026-04-18T00:00:00.000Z");

	test("drops entries older than maxAgeDays by added", () => {
		const { entries } = parseEntries(SAMPLE);
		const pruned = pruneByAge({ entries, now, maxAgeDays: 180 });
		const titles = pruned.map((e) => e.title);
		expect(titles).toContain("SK-G001: first entry");
		expect(titles).toContain("SK-G002: second entry");
		expect(titles).not.toContain("SK-G003: old stale entry");
	});

	test("keeps entries inside the window", () => {
		const e: Entry = {
			raw: "x",
			title: "fresh",
			body: "b",
			added: "2026-04-01",
		};
		expect(pruneByAge({ entries: [e], now, maxAgeDays: 180 })).toEqual([e]);
	});

	test("entry with null added is always kept (conservative)", () => {
		const e: Entry = { raw: "x", title: "noDate", body: "b", added: null };
		expect(pruneByAge({ entries: [e], now, maxAgeDays: 30 })).toEqual([e]);
	});

	test("maxAgeDays = 0 drops everything dated", () => {
		const e: Entry = {
			raw: "x",
			title: "any",
			body: "b",
			added: "2026-04-17",
		};
		expect(pruneByAge({ entries: [e], now, maxAgeDays: 0 })).toEqual([]);
	});

	test("empty → empty", () => {
		expect(pruneByAge({ entries: [], now, maxAgeDays: 180 })).toEqual([]);
	});
});

describe("serialize", () => {
	test("header + entries joined verbatim, roundtrips the raws", () => {
		const { header, entries } = parseEntries(SAMPLE);
		const out = serialize({ header, entries });
		expect(out).toContain("# Skills Gotchas");
		for (const e of entries) expect(out).toContain(e.raw.trimEnd());
	});

	test("empty entries → header only", () => {
		const out = serialize({ header: "# H\n\n", entries: [] });
		expect(out).toBe("# H\n\n");
	});

	test("idempotent — serialize ∘ parseEntries is identity on post-consolidation output", () => {
		const { header, entries } = parseEntries(SAMPLE);
		const first = serialize({ header, entries });
		const reparsed = parseEntries(first);
		const second = serialize({ header: reparsed.header, entries: reparsed.entries });
		expect(second).toBe(first);
	});
});
