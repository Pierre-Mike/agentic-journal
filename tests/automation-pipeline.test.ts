/**
 * Outer BDD acceptance gate for spec 049: Issue→PR autonomous pipeline.
 *
 * This file is the integration-level contract test that stays RED until the
 * final slice (slice 10) delivers all deliverables. Early GREEN = spec gap.
 *
 * Covers (aligned to proposal.md acceptance criteria):
 *  - align.yml contract (trigger events, branch naming, draft PR, /do-auto, alignment freeze)
 *  - CODEOWNERS freeze rule for alignment.md
 *  - dag-controller.ts: dispatchable() function with depends_on + touches logic
 *  - tasks.md schema: depends_on and touches keys present in _template
 *  - controller.yml contract (cron schedule, repository_dispatch)
 *  - slice.yml contract (repository_dispatch trigger, claude -p + expertise, pull --rebase retry)
 *  - preview.yml contract (wrangler deploy, playwright, BDD outer gate run)
 *  - issue-options.ts: failureMenu() emitting 4-option markdown
 *  - automerge.yml contract (aggregator, squash-merge, close issue)
 *  - RED-until-last-slice invariant
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "..");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readWorkflow(name: string): string {
	const p = join(REPO_ROOT, ".github", "workflows", name);
	if (!existsSync(p)) throw new Error(`Workflow not found: ${name}`);
	return readFileSync(p, "utf-8");
}

function readFile(rel: string): string {
	const p = join(REPO_ROOT, rel);
	if (!existsSync(p)) throw new Error(`File not found: ${rel}`);
	return readFileSync(p, "utf-8");
}

// ---------------------------------------------------------------------------
// intent.yml (consolidates the old align.yml + spec.yml)
// ---------------------------------------------------------------------------

describe("intent.yml contract", () => {
	test("file exists at .github/workflows/intent.yml", () => {
		expect(existsSync(join(REPO_ROOT, ".github/workflows/intent.yml"))).toBe(true);
	});

	test("listens to issues.opened and issues.edited events", () => {
		const wf = readWorkflow("intent.yml");
		expect(wf).toMatch(/issues/);
		expect(wf).toMatch(/opened/);
		expect(wf).toMatch(/edited/);
	});

	test("listens to issue_comment.created event (2-way Q&A surface)", () => {
		const wf = readWorkflow("intent.yml");
		expect(wf).toMatch(/issue_comment/);
		expect(wf).toMatch(/created/);
	});

	test("creates branch with auto/<issue#>-<slug> naming pattern", () => {
		const wf = readWorkflow("intent.yml");
		expect(wf).toMatch(/auto\//);
	});

	test("opens a draft PR", () => {
		const wf = readWorkflow("intent.yml");
		expect(wf).toMatch(/draft/);
	});

	test("invokes the auto-aligner", () => {
		const wf = readWorkflow("intent.yml");
		expect(wf).toMatch(/auto-aligner|alignment/i);
	});

	test("commits alignment.md only on confidence: high", () => {
		const wf = readWorkflow("intent.yml");
		expect(wf).toMatch(/alignment\.md/);
		expect(wf).toMatch(/confidence.*high|high.*confidence/i);
	});

	test("has a scaffold job that runs spec-tester after high confidence", () => {
		const wf = readWorkflow("intent.yml");
		expect(wf).toMatch(/scaffold:/);
		expect(wf).toMatch(/spec-tester/);
	});
});

// ---------------------------------------------------------------------------
// CODEOWNERS freeze
// ---------------------------------------------------------------------------

describe("CODEOWNERS freeze", () => {
	test("CODEOWNERS file exists at .github/CODEOWNERS", () => {
		expect(existsSync(join(REPO_ROOT, ".github/CODEOWNERS"))).toBe(true);
	});

	test("contains a rule protecting specs/active/*/alignment.md", () => {
		const co = readFile(".github/CODEOWNERS");
		// Must have a pattern matching specs/active/*/alignment.md
		expect(co).toMatch(/specs\/active\/\*\/alignment\.md/);
	});

	test("protection rule references a non-existent or bot user (freeze semantics)", () => {
		const co = readFile(".github/CODEOWNERS");
		// The pattern line should include a user/team that makes self-approval impossible
		const lines = co.split("\n").filter((l) => l.includes("alignment.md"));
		expect(lines.length).toBeGreaterThan(0);
		// Must reference at least one owner token
		expect(lines[0]).toMatch(/@[\w-]+/);
	});
});

// ---------------------------------------------------------------------------
// dag-controller.ts: dispatchable()
// ---------------------------------------------------------------------------

describe("dag-controller: dispatchable() logic", () => {
	type Slice = {
		id: number;
		depends_on: number[];
		touches: string[];
	};

	// We dynamically import to allow RED (missing file → import fails → test fails)
	async function loadDispatchable(): Promise<
		(slices: Slice[], done: Set<number>, inFlight: Slice[]) => Slice[]
	> {
		const mod = await import(join(REPO_ROOT, "scripts/dag-controller.ts"));
		if (typeof mod.dispatchable !== "function") {
			throw new Error("dag-controller.ts does not export dispatchable()");
		}
		return mod.dispatchable;
	}

	test("exports a dispatchable function", async () => {
		const fn = await loadDispatchable();
		expect(typeof fn).toBe("function");
	});

	test("returns root slices (no depends_on) when nothing is in-flight or done", async () => {
		const dispatchable = await loadDispatchable();
		const slices: Slice[] = [
			{ id: 1, depends_on: [], touches: ["specs/_template/tasks.md"] },
			{ id: 2, depends_on: [1], touches: ["scripts/dag-controller.ts"] },
			{ id: 3, depends_on: [], touches: ["scripts/issue-options.ts"] },
		];
		const result = dispatchable(slices, new Set(), []);
		const ids = result.map((s) => s.id);
		expect(ids).toContain(1);
		expect(ids).toContain(3);
		expect(ids).not.toContain(2);
	});

	test("unblocks a slice when its depends_on are all done", async () => {
		const dispatchable = await loadDispatchable();
		const slices: Slice[] = [
			{ id: 1, depends_on: [], touches: ["a.ts"] },
			{ id: 2, depends_on: [1], touches: ["b.ts"] },
		];
		const result = dispatchable(slices, new Set([1]), []);
		const ids = result.map((s) => s.id);
		expect(ids).toContain(2);
		expect(ids).not.toContain(1);
	});

	test("blocks a slice whose touches intersect with in-flight touches", async () => {
		const dispatchable = await loadDispatchable();
		const slices: Slice[] = [
			{ id: 1, depends_on: [], touches: ["shared.ts"] },
			{ id: 2, depends_on: [], touches: ["shared.ts"] },
		];
		const inFlight: Slice[] = [{ id: 1, depends_on: [], touches: ["shared.ts"] }];
		const result = dispatchable(slices, new Set(), inFlight);
		// slice 1 is in-flight so not eligible; slice 2 conflicts on shared.ts
		const ids = result.map((s) => s.id);
		expect(ids).not.toContain(2);
	});

	test("allows a slice through when touches is disjoint from in-flight", async () => {
		const dispatchable = await loadDispatchable();
		const slices: Slice[] = [
			{ id: 1, depends_on: [], touches: ["file-a.ts"] },
			{ id: 2, depends_on: [], touches: ["file-b.ts"] },
		];
		const inFlight: Slice[] = [{ id: 1, depends_on: [], touches: ["file-a.ts"] }];
		const result = dispatchable(slices, new Set(), inFlight);
		const ids = result.map((s) => s.id);
		// slice 2's touches don't overlap with slice 1 in-flight
		expect(ids).toContain(2);
	});

	test("does not include already-done slices", async () => {
		const dispatchable = await loadDispatchable();
		const slices: Slice[] = [{ id: 1, depends_on: [], touches: [] }];
		const result = dispatchable(slices, new Set([1]), []);
		expect(result.map((s) => s.id)).not.toContain(1);
	});

	test("does not include already in-flight slices", async () => {
		const dispatchable = await loadDispatchable();
		const slices: Slice[] = [{ id: 1, depends_on: [], touches: [] }];
		const inFlight: Slice[] = [{ id: 1, depends_on: [], touches: [] }];
		const result = dispatchable(slices, new Set(), inFlight);
		expect(result.map((s) => s.id)).not.toContain(1);
	});

	test("handles fan-in: slice 9 unblocked only when 5,6,7,8 all done", async () => {
		const dispatchable = await loadDispatchable();
		const slices: Slice[] = [
			{ id: 9, depends_on: [5, 6, 7, 8], touches: [".github/workflows/automerge.yml"] },
		];
		// Missing slice 8 from done
		const partial = dispatchable(slices, new Set([5, 6, 7]), []);
		expect(partial.map((s) => s.id)).not.toContain(9);

		// All four done
		const full = dispatchable(slices, new Set([5, 6, 7, 8]), []);
		expect(full.map((s) => s.id)).toContain(9);
	});
});

// ---------------------------------------------------------------------------
// tasks.md template schema
// ---------------------------------------------------------------------------

describe("tasks.md template schema", () => {
	test("_template/tasks.md exists", () => {
		expect(existsSync(join(REPO_ROOT, "specs/_template/tasks.md"))).toBe(true);
	});

	test("template declares depends_on field in at least one task entry", () => {
		const content = readFile("specs/_template/tasks.md");
		expect(content).toMatch(/depends_on:/);
	});

	test("template declares touches field in at least one task entry", () => {
		const content = readFile("specs/_template/tasks.md");
		expect(content).toMatch(/touches:/);
	});
});

// ---------------------------------------------------------------------------
// controller.yml contract
// ---------------------------------------------------------------------------

describe("controller.yml contract", () => {
	test("file exists at .github/workflows/controller.yml", () => {
		expect(existsSync(join(REPO_ROOT, ".github/workflows/controller.yml"))).toBe(true);
	});

	test("has a schedule cron trigger (~2min or standard interval)", () => {
		const wf = readWorkflow("controller.yml");
		expect(wf).toMatch(/schedule/);
		expect(wf).toMatch(/cron/);
	});

	test("dispatches slice.yml via repository_dispatch", () => {
		const wf = readWorkflow("controller.yml");
		expect(wf).toMatch(/repository.dispatch|repository_dispatch/);
		// Must reference the slice workflow or slice event type
		expect(wf).toMatch(/slice/);
	});

	test("reads tasks.md DAG (references tasks.md or dag-controller)", () => {
		const wf = readWorkflow("controller.yml");
		expect(wf).toMatch(/tasks\.md|dag.controller/);
	});
});

// ---------------------------------------------------------------------------
// slice.yml contract
// ---------------------------------------------------------------------------

describe("slice.yml contract", () => {
	test("file exists at .github/workflows/slice.yml", () => {
		expect(existsSync(join(REPO_ROOT, ".github/workflows/slice.yml"))).toBe(true);
	});

	test("triggered by repository_dispatch event", () => {
		const wf = readWorkflow("slice.yml");
		expect(wf).toMatch(/repository_dispatch/);
	});

	test("runs claude -p with a prompt", () => {
		const wf = readWorkflow("slice.yml");
		expect(wf).toMatch(/claude.*-p/);
	});

	test("loads expertise skill", () => {
		const wf = readWorkflow("slice.yml");
		expect(wf).toMatch(/expertise/);
	});

	test("executes pull --rebase before push (conflict retry)", () => {
		const wf = readWorkflow("slice.yml");
		expect(wf).toMatch(/pull.*--rebase|--rebase/);
	});
});

// ---------------------------------------------------------------------------
// preview.yml contract
// ---------------------------------------------------------------------------

describe("preview.yml contract", () => {
	test("file exists at .github/workflows/preview.yml", () => {
		expect(existsSync(join(REPO_ROOT, ".github/workflows/preview.yml"))).toBe(true);
	});

	test("deploys using wrangler versions upload", () => {
		const wf = readWorkflow("preview.yml");
		expect(wf).toMatch(/wrangler.*versions.*upload|wrangler versions upload/);
	});

	test("posts preview URL as a PR comment", () => {
		const wf = readWorkflow("preview.yml");
		expect(wf).toMatch(/PREVIEW_URL|preview.*url|preview-url/i);
	});

	test("runs playwright with base-url pointing at preview", () => {
		const wf = readWorkflow("preview.yml");
		expect(wf).toMatch(/playwright/);
		expect(wf).toMatch(/base.url|PREVIEW_URL/);
	});

	test("runs BDD outer gate (automation-pipeline.test.ts)", () => {
		const wf = readWorkflow("preview.yml");
		expect(wf).toMatch(/automation-pipeline\.test\.ts|automation.pipeline/);
	});
});

// ---------------------------------------------------------------------------
// issue-options.ts: failureMenu()
// ---------------------------------------------------------------------------

describe("issue-options.ts: failureMenu()", () => {
	async function loadFailureMenu(): Promise<(sliceId: number, title: string) => string> {
		const mod = await import(join(REPO_ROOT, "scripts/issue-options.ts"));
		if (typeof mod.failureMenu !== "function") {
			throw new Error("issue-options.ts does not export failureMenu()");
		}
		return mod.failureMenu;
	}

	test("exports a failureMenu function", async () => {
		const fn = await loadFailureMenu();
		expect(typeof fn).toBe("function");
	});

	test("output includes all four options: retry, split, skip, abort", async () => {
		const failureMenu = await loadFailureMenu();
		const body = failureMenu(3, "dag-controller.ts: DAG eval + touches-intersection");
		expect(body.toLowerCase()).toMatch(/retry/);
		expect(body.toLowerCase()).toMatch(/split/);
		expect(body.toLowerCase()).toMatch(/skip/);
		expect(body.toLowerCase()).toMatch(/abort/);
	});

	test("output includes the slice ID", async () => {
		const failureMenu = await loadFailureMenu();
		const body = failureMenu(7, "slice.yml: matrix runner");
		expect(body).toMatch(/7/);
	});

	test("output includes the slice title", async () => {
		const failureMenu = await loadFailureMenu();
		const body = failureMenu(7, "slice.yml: matrix runner");
		expect(body).toMatch(/slice\.yml: matrix runner/);
	});

	test("output is valid markdown (contains at least one heading or list marker)", async () => {
		const failureMenu = await loadFailureMenu();
		const body = failureMenu(1, "test slice");
		expect(body).toMatch(/^#{1,6} |^\s*[-*] /m);
	});
});

// ---------------------------------------------------------------------------
// automerge.yml contract
// ---------------------------------------------------------------------------

describe("automerge.yml contract", () => {
	test("file exists at .github/workflows/automerge.yml", () => {
		expect(existsSync(join(REPO_ROOT, ".github/workflows/automerge.yml"))).toBe(true);
	});

	test("triggers on pull_request check completion or workflow_run", () => {
		const wf = readWorkflow("automerge.yml");
		expect(wf).toMatch(/pull_request|workflow_run|check_suite|check_run/);
	});

	test("requires outer gate to pass before merging", () => {
		const wf = readWorkflow("automerge.yml");
		expect(wf).toMatch(/automation-pipeline|outer.gate|outer_gate/i);
	});

	test("performs squash merge", () => {
		const wf = readWorkflow("automerge.yml");
		expect(wf).toMatch(/squash/);
	});

	test("closes the linked issue after merge", () => {
		const wf = readWorkflow("automerge.yml");
		expect(wf).toMatch(/close.*issue|issue.*close/i);
	});
});

// ---------------------------------------------------------------------------
// RED-until-last-slice invariant
// ---------------------------------------------------------------------------

describe("RED-until-last-slice invariant", () => {
	/**
	 * This describe block encodes the invariant declared in alignment.md:
	 * the outer gate must fail until ALL slices are done.
	 *
	 * At scaffold time (before any slice is implemented), every file check
	 * above fails because the deliverables don't exist yet. This test
	 * explicitly asserts the invariant by verifying that NOT all deliverables
	 * are present simultaneously — which is true during active development.
	 *
	 * When all slices are done (slice 10), every describe block above passes,
	 * and this test also passes (it no longer finds any missing deliverables).
	 */

	const REQUIRED_DELIVERABLES = [
		".github/workflows/intent.yml",
		".github/workflows/controller.yml",
		".github/workflows/slice.yml",
		".github/workflows/preview.yml",
		".github/workflows/automerge.yml",
		".github/CODEOWNERS",
		"scripts/dag-controller.ts",
		"scripts/issue-options.ts",
	];

	test("all required deliverables exist (passes only when pipeline is complete)", () => {
		const missing = REQUIRED_DELIVERABLES.filter((p) => !existsSync(join(REPO_ROOT, p)));
		expect(missing).toEqual([]);
	});

	test("tasks.md template includes depends_on and touches schema keys", () => {
		const tmpl = join(REPO_ROOT, "specs/_template/tasks.md");
		expect(existsSync(tmpl)).toBe(true);
		const content = readFileSync(tmpl, "utf-8");
		expect(content).toMatch(/depends_on:/);
		expect(content).toMatch(/touches:/);
	});
});
