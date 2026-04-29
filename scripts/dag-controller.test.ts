/**
 * Unit tests for scripts/dag-controller.ts
 *
 * These tests are RED until the implementation file exists — the import will
 * fail because dag-controller.ts has not been written yet.
 *
 * Covers:
 *  - parseTasksDag(tasksMd) — parses a tasks.md string into DagTask[]
 *  - intersectsTouches(a, b) — returns true iff arrays share any path
 *  - findDispatchable({ tasks, completed, inFlight }) — DAG + touches safety
 */

import { describe, expect, test } from "bun:test";
import { findDispatchable, intersectsTouches, parseTasksDag } from "./dag-controller.ts";

/**
 * Contract definition for the DagTask type.
 * Mirrors the shape that dag-controller.ts must export.
 * Declared here so tsc can type-check the tests even before the implementation exists
 * (the import above will still fail RED at runtime since the module is missing).
 */
interface DagTask {
	id: number;
	title: string;
	depends_on: number[];
	touches: string[];
	file_targets: string[];
	gate: string;
}

// ---------------------------------------------------------------------------
// Synthetic tasks.md fixtures
// ---------------------------------------------------------------------------

/**
 * Three-slice tasks.md in the YAML-list format that parseTasksFile accepts.
 * Each slice has id, title, depends_on, touches, file_targets, and gate.
 */
const THREE_SLICE_TASKS_MD = `## Tasks

- id: 1
  title: "alpha slice"
  agent: main
  depends_on: []
  touches:
    - scripts/alpha.ts
  file_targets:
    - scripts/alpha.ts
  boundary:
    - scripts/alpha.ts
  gate: scripts/alpha.test.ts

- id: 2
  title: "beta slice"
  agent: main
  depends_on: [1]
  touches:
    - scripts/beta.ts
  file_targets:
    - scripts/beta.ts
  boundary:
    - scripts/beta.ts
  gate: scripts/beta.test.ts

- id: 3
  title: "gamma slice"
  agent: main
  depends_on: [1]
  touches:
    - scripts/gamma.ts
  file_targets:
    - scripts/gamma.ts
  boundary:
    - scripts/gamma.ts
  gate: scripts/gamma.test.ts
`;

/**
 * Diamond DAG: A(1) → {B(2), C(3)} → D(4)
 * B and C have disjoint touches → can run in parallel after A completes.
 */
const DIAMOND_TASKS_MD = `## Tasks

- id: 1
  title: "A root"
  agent: main
  depends_on: []
  touches:
    - scripts/a.ts
  file_targets:
    - scripts/a.ts
  boundary:
    - scripts/a.ts
  gate: scripts/a.test.ts

- id: 2
  title: "B left"
  agent: main
  depends_on: [1]
  touches:
    - scripts/b.ts
  file_targets:
    - scripts/b.ts
  boundary:
    - scripts/b.ts
  gate: scripts/b.test.ts

- id: 3
  title: "C right"
  agent: main
  depends_on: [1]
  touches:
    - scripts/c.ts
  file_targets:
    - scripts/c.ts
  boundary:
    - scripts/c.ts
  gate: scripts/c.test.ts

- id: 4
  title: "D sink"
  agent: main
  depends_on: [2, 3]
  touches:
    - scripts/d.ts
  file_targets:
    - scripts/d.ts
  boundary:
    - scripts/d.ts
  gate: scripts/d.test.ts
`;

/** Malformed: no slices at all */
const EMPTY_TASKS_MD = `## Tasks\n`;

/** Malformed: slice with missing required keys */
const MISSING_KEYS_TASKS_MD = `## Tasks

- id: 1
  title: "incomplete"
`;

// ---------------------------------------------------------------------------
// parseTasksDag
// ---------------------------------------------------------------------------

describe("parseTasksDag", () => {
	test("parses three-slice tasks.md → array of length 3", () => {
		const tasks = parseTasksDag(THREE_SLICE_TASKS_MD);
		expect(tasks).toHaveLength(3);
	});

	test("each task has id, title, depends_on, touches, file_targets, gate", () => {
		const tasks = parseTasksDag(THREE_SLICE_TASKS_MD);
		for (const task of tasks) {
			expect(typeof task.id).toBe("number");
			expect(typeof task.title).toBe("string");
			expect(task.title.length).toBeGreaterThan(0);
			expect(Array.isArray(task.depends_on)).toBe(true);
			expect(Array.isArray(task.touches)).toBe(true);
			expect(task.touches.length).toBeGreaterThan(0);
			expect(Array.isArray(task.file_targets)).toBe(true);
			expect(typeof task.gate).toBe("string");
		}
	});

	test("slice 1 has id=1, no depends_on, correct touches", () => {
		const tasks = parseTasksDag(THREE_SLICE_TASKS_MD);
		const t1 = tasks.find((t: DagTask) => t.id === 1);
		expect(t1).toBeDefined();
		if (t1) {
			expect(t1.depends_on).toEqual([]);
			expect(t1.touches).toContain("scripts/alpha.ts");
			expect(t1.gate).toBe("scripts/alpha.test.ts");
		}
	});

	test("slice 2 depends_on [1]", () => {
		const tasks = parseTasksDag(THREE_SLICE_TASKS_MD);
		const t2 = tasks.find((t: DagTask) => t.id === 2);
		expect(t2).toBeDefined();
		if (t2) {
			expect(t2.depends_on).toEqual([1]);
		}
	});

	test("throws on empty tasks.md (no slices)", () => {
		expect(() => parseTasksDag(EMPTY_TASKS_MD)).toThrow();
	});

	test("throws on malformed input with missing required keys", () => {
		expect(() => parseTasksDag(MISSING_KEYS_TASKS_MD)).toThrow();
	});
});

// ---------------------------------------------------------------------------
// intersectsTouches
// ---------------------------------------------------------------------------

describe("intersectsTouches", () => {
	test("returns true when arrays share a path", () => {
		expect(intersectsTouches(["scripts/foo.ts", "scripts/bar.ts"], ["scripts/bar.ts"])).toBe(true);
	});

	test("returns false when arrays are disjoint", () => {
		expect(intersectsTouches(["scripts/foo.ts"], ["scripts/bar.ts"])).toBe(false);
	});

	test("returns false when first array is empty", () => {
		expect(intersectsTouches([], ["scripts/bar.ts"])).toBe(false);
	});

	test("returns false when second array is empty", () => {
		expect(intersectsTouches(["scripts/foo.ts"], [])).toBe(false);
	});

	test("returns false when both arrays are empty", () => {
		expect(intersectsTouches([], [])).toBe(false);
	});

	test("exact path match required (no prefix matching)", () => {
		expect(intersectsTouches(["scripts/foo.ts"], ["scripts/foo.ts.bak"])).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// findDispatchable
// ---------------------------------------------------------------------------

describe("findDispatchable", () => {
	test("returns root slices when nothing in flight or completed", () => {
		const tasks = parseTasksDag(THREE_SLICE_TASKS_MD);
		// Only slice 1 has depends_on: []
		const dispatchable = findDispatchable({
			tasks,
			completed: new Set(),
			inFlight: [],
		});
		expect(dispatchable).toContain(1);
		expect(dispatchable).not.toContain(2);
		expect(dispatchable).not.toContain(3);
	});

	test("filters out slices whose depends_on is not fully in completed", () => {
		const tasks = parseTasksDag(THREE_SLICE_TASKS_MD);
		// slice 2 and 3 depend on slice 1, which is not completed
		const dispatchable = findDispatchable({
			tasks,
			completed: new Set(),
			inFlight: [],
		});
		expect(dispatchable).not.toContain(2);
		expect(dispatchable).not.toContain(3);
	});

	test("unlocks slices once their depends_on is satisfied", () => {
		const tasks = parseTasksDag(THREE_SLICE_TASKS_MD);
		const dispatchable = findDispatchable({
			tasks,
			completed: new Set([1]),
			inFlight: [],
		});
		expect(dispatchable).toContain(2);
		expect(dispatchable).toContain(3);
		expect(dispatchable).not.toContain(1);
	});

	test("filters out slices whose touches intersect in-flight touches", () => {
		const tasks = parseTasksDag(THREE_SLICE_TASKS_MD);
		// slice 2 touches scripts/beta.ts; mark it as in-flight with that touch
		const dispatchable = findDispatchable({
			tasks,
			completed: new Set([1]),
			inFlight: [{ sliceId: 2, touches: ["scripts/beta.ts"] }],
		});
		expect(dispatchable).not.toContain(2);
		// slice 3 touches scripts/gamma.ts — disjoint, should still be dispatchable
		expect(dispatchable).toContain(3);
	});

	test("doesn't return already-completed slices", () => {
		const tasks = parseTasksDag(THREE_SLICE_TASKS_MD);
		const dispatchable = findDispatchable({
			tasks,
			completed: new Set([1]),
			inFlight: [],
		});
		expect(dispatchable).not.toContain(1);
	});

	test("doesn't return already-in-flight slices", () => {
		const tasks = parseTasksDag(THREE_SLICE_TASKS_MD);
		const dispatchable = findDispatchable({
			tasks,
			completed: new Set([1]),
			inFlight: [{ sliceId: 2, touches: ["scripts/beta.ts"] }],
		});
		expect(dispatchable).not.toContain(2);
	});

	test("returns multiple parallel-safe slices with disjoint touches simultaneously", () => {
		const tasks = parseTasksDag(THREE_SLICE_TASKS_MD);
		// slice 2 (beta) and slice 3 (gamma) both depend on slice 1 and have disjoint touches
		const dispatchable = findDispatchable({
			tasks,
			completed: new Set([1]),
			inFlight: [],
		});
		expect(dispatchable).toContain(2);
		expect(dispatchable).toContain(3);
	});

	test("diamond DAG: B and C can run in parallel after A completes", () => {
		const tasks = parseTasksDag(DIAMOND_TASKS_MD);
		// After A(1) completes: B(2) and C(3) should both be dispatchable
		const dispatchable = findDispatchable({
			tasks,
			completed: new Set([1]),
			inFlight: [],
		});
		expect(dispatchable).toContain(2);
		expect(dispatchable).toContain(3);
		// D(4) not dispatchable yet — depends on both 2 and 3
		expect(dispatchable).not.toContain(4);
	});

	test("diamond DAG: D dispatches only after B and C complete", () => {
		const tasks = parseTasksDag(DIAMOND_TASKS_MD);
		const dispatchable = findDispatchable({
			tasks,
			completed: new Set([1, 2, 3]),
			inFlight: [],
		});
		expect(dispatchable).toContain(4);
		expect(dispatchable).not.toContain(1);
		expect(dispatchable).not.toContain(2);
		expect(dispatchable).not.toContain(3);
	});

	test("regression: when all slices are completed, returns empty array", () => {
		const tasks = parseTasksDag(THREE_SLICE_TASKS_MD);
		const dispatchable = findDispatchable({
			tasks,
			completed: new Set([1, 2, 3]),
			inFlight: [],
		});
		expect(dispatchable).toHaveLength(0);
	});
});
