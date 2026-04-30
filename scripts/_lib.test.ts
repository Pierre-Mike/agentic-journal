/**
 * Unit tests for scripts/_lib.ts helpers.
 *
 * Comprehensive gateEntries() tests are colocated in scripts/spec-lint.test.ts
 * (they were written there as spec-032 gate tests). This file covers the
 * remaining helpers: gatePaths, isReady, unresolvedDeps.
 */

import { describe, expect, test } from "bun:test";
import { closeSync, mkdtempSync, openSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	gateEntries,
	gatePaths,
	isReady,
	sliceProgress,
	taskGates,
	unresolvedDeps,
} from "./_lib.ts";

const makeSpec = (gate: unknown, depends_on: string[] = []) => ({
	slug: "test",
	dir: "/tmp/test",
	frontmatter: {
		id: "001",
		title: "test",
		status: "active" as const,
		kind: "code" as const,
		gate: gate as string,
		created: "2026-01-01",
		owner: "main",
		depends_on,
		supersedes: null,
	},
	body: "",
});

describe("gatePaths", () => {
	test("scalar → single-element array", () => {
		expect(gatePaths(makeSpec("src/foo.test.ts"))).toEqual(["src/foo.test.ts"]);
	});

	test("string array → same array", () => {
		expect(gatePaths(makeSpec(["a.ts", "b.ts"]))).toEqual(["a.ts", "b.ts"]);
	});

	test("typed list → path array", () => {
		expect(
			gatePaths(
				makeSpec([
					{ path: "src/foo.test.ts", level: "unit" },
					{ path: "scripts/smoke.ts", level: "e2e" },
				]),
			),
		).toEqual(["src/foo.test.ts", "scripts/smoke.ts"]);
	});
});

describe("gateEntries", () => {
	test("scalar → unit entry", () => {
		expect(gateEntries(makeSpec("src/foo.test.ts"))).toEqual([
			{ path: "src/foo.test.ts", level: "unit" },
		]);
	});

	test("string[] → all unit entries", () => {
		expect(gateEntries(makeSpec(["a.test.ts", "b.test.ts"]))).toEqual([
			{ path: "a.test.ts", level: "unit" },
			{ path: "b.test.ts", level: "unit" },
		]);
	});

	test("typed list → passes through with validation", () => {
		const entries = gateEntries(
			makeSpec([
				{ path: "src/foo.test.ts", level: "unit" },
				{ path: "scripts/smoke.ts", level: "e2e" },
			]),
		);
		expect(entries).toEqual([
			{ path: "src/foo.test.ts", level: "unit" },
			{ path: "scripts/smoke.ts", level: "e2e" },
		]);
	});

	test("empty array → empty", () => {
		expect(gateEntries(makeSpec([]))).toEqual([]);
	});
});

describe("isReady", () => {
	test("no dependencies → ready", () => {
		expect(isReady(makeSpec("x.ts"), new Set())).toBe(true);
	});

	test("dep in archived set → ready", () => {
		expect(isReady(makeSpec("x.ts", ["001"]), new Set(["001"]))).toBe(true);
	});

	test("dep not archived → not ready", () => {
		expect(isReady(makeSpec("x.ts", ["001"]), new Set())).toBe(false);
	});
});

describe("unresolvedDeps", () => {
	test("no deps → empty", () => {
		expect(unresolvedDeps(makeSpec("x.ts"), new Set())).toEqual([]);
	});

	test("archived dep → resolved", () => {
		expect(unresolvedDeps(makeSpec("x.ts", ["001"]), new Set(["001"]))).toEqual([]);
	});

	test("missing dep → listed", () => {
		expect(unresolvedDeps(makeSpec("x.ts", ["001", "002"]), new Set(["001"]))).toEqual(["002"]);
	});
});

// ---------------------------------------------------------------------------
// sliceProgress — RED tests (spec 040, slice 1)
// ---------------------------------------------------------------------------

function makeFixtureSpecDir(kind: string, taskCount: number, frozenOrdinals: number[]): string {
	const dir = mkdtempSync(join(tmpdir(), "spec-040-"));

	const proposalMd = `---\nid: 099-test\ntitle: test\nstatus: active\nkind: ${kind}\ngate: scripts/foo.test.ts\ncreated: 2026-01-01\nowner: main\ndepends_on: []\nsupersedes: null\n---\n\n## Intent\n\ntest fixture\n`;
	writeFileSync(join(dir, "proposal.md"), proposalMd, "utf-8");

	const taskLines: string[] = ["# Tasks", ""];
	for (let i = 1; i <= taskCount; i++) {
		taskLines.push(`- [ ] ${i}. Task ${i}`);
		taskLines.push(`  - agent: main`);
		taskLines.push(`  - gate: scripts/task${i}.test.ts`);
	}
	writeFileSync(join(dir, "tasks.md"), taskLines.join("\n") + "\n", "utf-8");

	for (const ordinal of frozenOrdinals) {
		closeSync(openSync(join(dir, `.gate-frozen-${ordinal}`), "w"));
	}

	return dir;
}

describe("sliceProgress", () => {
	test("kind:code, 3 tasks, 0 frozen → { frozen: 0, total: 3 }", () => {
		const dir = makeFixtureSpecDir("code", 3, []);
		expect(sliceProgress({ specDir: dir })).toEqual({ frozen: 0, total: 3 });
	});

	test("kind:code, 3 tasks, 2 frozen → { frozen: 2, total: 3 }", () => {
		const dir = makeFixtureSpecDir("code", 3, [1, 2]);
		expect(sliceProgress({ specDir: dir })).toEqual({ frozen: 2, total: 3 });
	});

	test("kind:code, 3 tasks, all 3 frozen → { frozen: 3, total: 3 }", () => {
		const dir = makeFixtureSpecDir("code", 3, [1, 2, 3]);
		expect(sliceProgress({ specDir: dir })).toEqual({ frozen: 3, total: 3 });
	});

	test("kind:rule → null", () => {
		const dir = makeFixtureSpecDir("rule", 2, []);
		expect(sliceProgress({ specDir: dir })).toBeNull();
	});

	test("kind:code, 0 tasks with gate fields → null", () => {
		const dir = makeFixtureSpecDir("code", 0, []);
		expect(sliceProgress({ specDir: dir })).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// taskGates — YAML-list task format (the format the spec-tester emits)
// ---------------------------------------------------------------------------

describe("taskGates: YAML-list format", () => {
	function makeYamlListSpec(opts: { gates: readonly string[]; frozen: readonly number[] }): string {
		const dir = mkdtempSync(join(tmpdir(), "spec-yaml-"));
		const lines: string[] = ["## Tasks", ""];
		opts.gates.forEach((gate, i) => {
			const id = i + 1;
			lines.push(`- id: ${id}`);
			lines.push(`  title: "Task ${id}"`);
			lines.push(`  agent: main`);
			lines.push(`  depends_on: []`);
			lines.push(`  gate: ${gate}`);
			lines.push("");
		});
		writeFileSync(join(dir, "tasks.md"), lines.join("\n"), "utf-8");
		for (const ord of opts.frozen) {
			closeSync(openSync(join(dir, `.gate-frozen-${ord}`), "w"));
		}
		return dir;
	}

	test("returns one entry per YAML-list task with a gate field", () => {
		const dir = makeYamlListSpec({
			gates: ["scripts/a.test.ts", "tests/b.test.ts"],
			frozen: [],
		});
		const result = taskGates(dir);
		expect(result.length).toBe(2);
		expect(result[0]?.ordinal).toBe(1);
		expect(result[0]?.gatePath).toBe("scripts/a.test.ts");
		expect(result[1]?.ordinal).toBe(2);
		expect(result[1]?.gatePath).toBe("tests/b.test.ts");
	});

	test("frozen sentinel detection works for YAML-list specs", () => {
		const dir = makeYamlListSpec({
			gates: ["scripts/a.test.ts", "tests/b.test.ts"],
			frozen: [1],
		});
		const result = taskGates(dir);
		expect(result[0]?.frozen).toBe(true);
		expect(result[1]?.frozen).toBe(false);
	});
});
