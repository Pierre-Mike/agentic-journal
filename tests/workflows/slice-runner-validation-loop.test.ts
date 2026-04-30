/**
 * Outer gate (e2e): slice runner self-validation loop foundation — spec 123
 *
 * End-to-end wiring and integrated behavior check. RED at scaffold.
 * GREEN only after all three slices land:
 *   slice 1: scripts/slice/local-ci.ts
 *   slice 2: scripts/slice/loop.ts
 *   slice 3: .github/workflows/slice.yml updated to invoke loop.ts
 *
 * Asserts:
 *   1. loop.ts GREEN path calls push; RED path commits WIP + opens issue, no push
 *   2. loop.ts treats a boundary violation as RED
 *   3. validateBoundary is called after runAgent (end-of-loop ordering)
 *   4. slice.yml invokes bun scripts/slice/loop.ts
 *   5. slice.yml does not contain the old "Implement slice via Claude" step
 *   6. slice.yml does not have a standalone "Push with retry" step or id:push step
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "../..");
const LOOP_PATH = join(REPO_ROOT, "scripts/slice/loop.ts");
const SLICE_YML_PATH = join(REPO_ROOT, ".github/workflows/slice.yml");

type LoopOpts = {
	sliceId: number;
	specId: string;
	branch: string;
	gatePath: string;
	slug: string;
	runAgent?: () => Promise<void>;
	runLocalCi?: (opts: { gatePath: string }) => Promise<{ ok: boolean; failedStep?: string }>;
	pushWithRetry?: (branch: string) => Promise<void>;
	commitWip?: (slug: string, branch: string) => Promise<string>;
	openSliceStuckIssue?: (opts: {
		slug: string;
		failedStep: string;
		specId: string;
	}) => Promise<void>;
	validateBoundary?: (boundary: string[]) => Promise<{ ok: boolean; violations: string[] }>;
	getBoundary?: () => string[];
	getSha7?: () => Promise<string>;
};

async function loadLoop(): Promise<{
	runLoop: (opts: LoopOpts) => Promise<{ outcome: "green" | "red" }>;
}> {
	return import(LOOP_PATH) as Promise<{
		runLoop: (opts: LoopOpts) => Promise<{ outcome: "green" | "red" }>;
	}>;
}

const BASE_OPTS: LoopOpts = {
	sliceId: 1,
	specId: "123-my-spec",
	branch: "auto/123",
	gatePath: "scripts/slice/loop.test.ts",
	slug: "my-spec",
	runAgent: async () => {},
	runLocalCi: async () => ({ ok: true }),
	pushWithRetry: async () => {},
	commitWip: async () => "abc1234",
	openSliceStuckIssue: async () => {},
	validateBoundary: async () => ({ ok: true, violations: [] }),
	getBoundary: () => [],
	getSha7: async () => "abc1234",
};

// ---------------------------------------------------------------------------
// 1. GREEN path: push called, outcome green
// ---------------------------------------------------------------------------

describe("loop: GREEN path", () => {
	test("calls pushWithRetry when local-ci passes", async () => {
		const { runLoop } = await loadLoop();
		let pushCalled = false;
		await runLoop({
			...BASE_OPTS,
			pushWithRetry: async () => {
				pushCalled = true;
			},
		});
		expect(pushCalled).toBe(true);
	});

	test("returns outcome:green when local-ci passes", async () => {
		const { runLoop } = await loadLoop();
		const result = await runLoop({ ...BASE_OPTS });
		expect(result.outcome).toBe("green");
	});
});

// ---------------------------------------------------------------------------
// 2. RED path: no push, WIP commit + issue opened
// ---------------------------------------------------------------------------

describe("loop: RED path (local-ci fails)", () => {
	test("does NOT call pushWithRetry when local-ci fails", async () => {
		const { runLoop } = await loadLoop();
		let pushCalled = false;
		await runLoop({
			...BASE_OPTS,
			runLocalCi: async () => ({ ok: false, failedStep: "typecheck" }),
			pushWithRetry: async () => {
				pushCalled = true;
			},
		});
		expect(pushCalled).toBe(false);
	});

	test("calls commitWip when local-ci fails", async () => {
		const { runLoop } = await loadLoop();
		let wipCommitted = false;
		await runLoop({
			...BASE_OPTS,
			runLocalCi: async () => ({ ok: false, failedStep: "lint:ci" }),
			commitWip: async () => {
				wipCommitted = true;
				return "abc1234";
			},
		});
		expect(wipCommitted).toBe(true);
	});

	test("opens slice-stuck issue with correct failedStep when local-ci fails", async () => {
		const { runLoop } = await loadLoop();
		let capturedFailedStep: string | undefined;
		await runLoop({
			...BASE_OPTS,
			runLocalCi: async () => ({ ok: false, failedStep: "spec:lint" }),
			openSliceStuckIssue: async ({ failedStep }) => {
				capturedFailedStep = failedStep;
			},
		});
		expect(capturedFailedStep).toBe("spec:lint");
	});

	test("returns outcome:red when local-ci fails", async () => {
		const { runLoop } = await loadLoop();
		const result = await runLoop({
			...BASE_OPTS,
			runLocalCi: async () => ({ ok: false, failedStep: "test" }),
		});
		expect(result.outcome).toBe("red");
	});
});

// ---------------------------------------------------------------------------
// 3. Boundary violation treated as RED
// ---------------------------------------------------------------------------

describe("loop: boundary violation → RED", () => {
	test("does NOT push when validateBoundary returns violations", async () => {
		const { runLoop } = await loadLoop();
		let pushCalled = false;
		await runLoop({
			...BASE_OPTS,
			validateBoundary: async () => ({ ok: false, violations: ["src/out-of-scope.ts"] }),
			pushWithRetry: async () => {
				pushCalled = true;
			},
		});
		expect(pushCalled).toBe(false);
	});

	test("returns outcome:red on boundary violation", async () => {
		const { runLoop } = await loadLoop();
		const result = await runLoop({
			...BASE_OPTS,
			validateBoundary: async () => ({ ok: false, violations: ["src/out-of-scope.ts"] }),
		});
		expect(result.outcome).toBe("red");
	});
});

// ---------------------------------------------------------------------------
// 4. validateBoundary called after runAgent (end-of-loop ordering)
// ---------------------------------------------------------------------------

describe("loop: validateBoundary called after runAgent", () => {
	test("boundary check happens after agent completes", async () => {
		const { runLoop } = await loadLoop();
		const order: string[] = [];
		await runLoop({
			...BASE_OPTS,
			runAgent: async () => {
				order.push("agent");
			},
			validateBoundary: async () => {
				order.push("boundary");
				return { ok: true, violations: [] };
			},
		});
		expect(order.indexOf("agent")).toBeLessThan(order.indexOf("boundary"));
	});
});

// ---------------------------------------------------------------------------
// 5–6. slice.yml: loop.ts wired in, old steps removed
// ---------------------------------------------------------------------------

describe("slice.yml: loop.ts wired in, old steps removed", () => {
	function raw(): string {
		return readFileSync(SLICE_YML_PATH, "utf-8");
	}

	test("slice.yml invokes bun scripts/slice/loop.ts", () => {
		expect(raw()).toMatch(/scripts\/slice\/loop\.ts/);
	});

	test("slice.yml does not contain 'Implement slice via Claude' step name", () => {
		expect(raw()).not.toMatch(/Implement slice via Claude/);
	});

	test("slice.yml does not have a standalone 'Push with retry' step name", () => {
		expect(raw()).not.toMatch(/name:\s+Push with retry/);
	});

	test("slice.yml does not have a standalone id:push step", () => {
		// push-with-retry now lives inside loop.ts; no separate id:push step.
		expect(raw()).not.toMatch(/^\s+id:\s+push\s*$/m);
	});
});
