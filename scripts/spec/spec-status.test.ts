/**
 * Gate for spec 040 slice 2: formatSpecLine tests.
 * RED — formatSpecLine is not yet exported from spec-status.ts.
 */

import { describe, expect, it } from "bun:test";
import type { Spec } from "../_lib";

// Import under test.
import { formatSpecLine } from "./spec-status";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSpec(overrides: {
	id?: string;
	title?: string;
	kind?: string;
	depends_on?: string[];
}): Spec {
	return {
		slug: "040-spec-status-progress",
		dir: "/fake/specs/active/040-spec-status-progress",
		frontmatter: {
			id: overrides.id ?? "040-spec-status-progress",
			title: overrides.title ?? "Show slice-RED progress in spec-status",
			status: "active",
			kind: (overrides.kind ?? "code") as Spec["frontmatter"]["kind"],
			gate: [{ path: "scripts/spec-status.test.ts", level: "integration" }],
			created: "2026-04-28T00:00:00.000Z",
			owner: "main",
			depends_on: overrides.depends_on ?? [],
			supersedes: null,
		},
		body: "",
	};
}

// ---------------------------------------------------------------------------
// 1. formatSpecLine is exported
// ---------------------------------------------------------------------------

describe("formatSpecLine export", () => {
	it("is a function", () => {
		expect(typeof formatSpecLine).toBe("function");
	});
});

// ---------------------------------------------------------------------------
// 2. null sliceProgress → byte-identical to pre-040 format
// ---------------------------------------------------------------------------

describe("formatSpecLine — null sliceProgress (non-slice-RED)", () => {
	it("READY spec with null progress — no tag appended", () => {
		const spec = makeSpec({ id: "041", title: "Some title", kind: "rule", depends_on: [] });
		const archived = new Set<string>();
		const result = formatSpecLine(spec, archived, null);
		expect(result).toBe("  [READY] 041 — Some title (rule)");
	});

	it("BLOCKED spec with null progress — no tag appended", () => {
		const spec = makeSpec({
			id: "042",
			title: "Blocked spec",
			kind: "writeup",
			depends_on: ["039"],
		});
		const archived = new Set<string>(); // 039 not archived → blocked
		const result = formatSpecLine(spec, archived, null);
		expect(result).toBe("  [BLOCKED-BY: 039] 042 — Blocked spec (writeup)");
	});

	it("no trailing space or extra characters", () => {
		const spec = makeSpec({ id: "043", title: "Clean line", kind: "workflow", depends_on: [] });
		const archived = new Set<string>();
		const result = formatSpecLine(spec, archived, null);
		expect(result).toBe("  [READY] 043 — Clean line (workflow)");
		expect(result.endsWith(" ")).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// 3. non-null sliceProgress → tag appended
// ---------------------------------------------------------------------------

describe("formatSpecLine — non-null sliceProgress (slice-RED)", () => {
	it("READY spec — tag appended at end", () => {
		const spec = makeSpec({
			id: "040-spec-status-progress",
			title: "Show slice-RED progress in spec-status",
			kind: "code",
			depends_on: [],
		});
		const archived = new Set<string>();
		const result = formatSpecLine(spec, archived, { frozen: 1, total: 2 });
		expect(result).toBe(
			"  [READY] 040-spec-status-progress — Show slice-RED progress in spec-status (code) [1/2 frozen]",
		);
	});

	it("READY spec with 0 frozen", () => {
		const spec = makeSpec({ id: "040", title: "My spec", kind: "code", depends_on: [] });
		const archived = new Set<string>();
		const result = formatSpecLine(spec, archived, { frozen: 0, total: 3 });
		expect(result).toBe("  [READY] 040 — My spec (code) [0/3 frozen]");
	});

	it("READY spec with all slices frozen", () => {
		const spec = makeSpec({ id: "040", title: "My spec", kind: "code", depends_on: [] });
		const archived = new Set<string>();
		const result = formatSpecLine(spec, archived, { frozen: 3, total: 3 });
		expect(result).toBe("  [READY] 040 — My spec (code) [3/3 frozen]");
	});

	it("BLOCKED spec — tag still appended", () => {
		const spec = makeSpec({
			id: "040",
			title: "My spec",
			kind: "code",
			depends_on: ["035", "039"],
		});
		const archived = new Set<string>(["035"]); // 039 not archived → blocked
		const result = formatSpecLine(spec, archived, { frozen: 1, total: 2 });
		expect(result).toBe("  [BLOCKED-BY: 039] 040 — My spec (code) [1/2 frozen]");
	});

	it("tag format is single-space-prefixed [K/N frozen]", () => {
		const spec = makeSpec({ id: "040", title: "T", kind: "code", depends_on: [] });
		const archived = new Set<string>();
		const result = formatSpecLine(spec, archived, { frozen: 2, total: 5 });
		expect(result.endsWith(" [2/5 frozen]")).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 4. BLOCKED-BY state with multiple blockers
// ---------------------------------------------------------------------------

describe("formatSpecLine — BLOCKED-BY comma list", () => {
	it("lists multiple unresolved deps comma-separated", () => {
		const spec = makeSpec({
			id: "045",
			title: "Multi blocked",
			kind: "code",
			depends_on: ["035", "039", "040"],
		});
		const archived = new Set<string>(); // none archived
		const result = formatSpecLine(spec, archived, null);
		expect(result).toBe("  [BLOCKED-BY: 035, 039, 040] 045 — Multi blocked (code)");
	});

	it("BLOCKED-BY with sliceProgress tag", () => {
		const spec = makeSpec({
			id: "045",
			title: "Multi blocked",
			kind: "code",
			depends_on: ["035", "039"],
		});
		const archived = new Set<string>();
		const result = formatSpecLine(spec, archived, { frozen: 0, total: 2 });
		expect(result).toBe("  [BLOCKED-BY: 035, 039] 045 — Multi blocked (code) [0/2 frozen]");
	});
});
