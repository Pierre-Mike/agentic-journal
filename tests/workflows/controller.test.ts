/**
 * Slice 6 gate: controller.yml — cron + DAG dispatch
 *
 * Tests that `.github/workflows/controller.yml` encodes the correct contract:
 *   1.  File exists at .github/workflows/controller.yml
 *   2.  Triggers: schedule cron ~2-min, repository_dispatch, workflow_dispatch
 *   3.  Permissions: contents:read, pull-requests:write, actions:write
 *   4.  Concurrency: group keyed on github.ref, cancel-in-progress: false
 *   5.  Step that invokes bun scripts/dag-controller.ts on tasks.md
 *   6.  Step that queries GitHub API for in-progress slice.yml runs
 *   7.  Step that derives completed slices from git log (GREEN commits) or status file
 *   8.  Dispatch loop: calls gh workflow run slice.yml (or repository_dispatch)
 *       with payload { slice_id, spec_id, branch }
 *   9.  No-op when findDispatchable returns [] — exits 0, no failure
 *  10.  runs-on: ubuntu-latest
 *  11.  actions/checkout@v4 with fetch-depth: 0
 *  12.  Dispatch step structurally guarded (if: or empty-array short-circuit)
 *
 * Uses structural YAML parsing (yaml package) — no bare string-grep unless
 * the assertion targets a `run:` block field specifically.
 *
 * These tests are intentionally RED until controller.yml is implemented (slice 6).
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

const REPO_ROOT = join(import.meta.dir, "../..");
const WORKFLOW_PATH = join(REPO_ROOT, ".github", "workflows", "controller.yml");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ScheduleEntry = { cron?: string };

type OnBlock = {
	schedule?: ScheduleEntry[];
	repository_dispatch?: unknown;
	workflow_dispatch?: unknown;
	[key: string]: unknown;
};

type Step = {
	name?: string;
	uses?: string;
	run?: string;
	if?: string;
	with?: Record<string, unknown>;
	env?: Record<string, string>;
	id?: string;
};

type Job = {
	steps?: Step[];
	"runs-on"?: string;
};

type WorkflowDoc = {
	on?: OnBlock;
	permissions?: Record<string, string>;
	concurrency?: { group?: string; "cancel-in-progress"?: boolean };
	jobs?: Record<string, Job>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readWorkflowRaw(): string {
	if (!existsSync(WORKFLOW_PATH)) {
		throw new Error("controller.yml not found at .github/workflows/controller.yml");
	}
	return readFileSync(WORKFLOW_PATH, "utf-8");
}

function parseWorkflow(): WorkflowDoc {
	const raw = readWorkflowRaw();
	return parseYaml(raw) as WorkflowDoc;
}

/** Return all steps from all jobs, flattened. */
function allSteps(wf: WorkflowDoc): Step[] {
	return Object.values(wf.jobs ?? {}).flatMap((job) => job.steps ?? []);
}

// ---------------------------------------------------------------------------
// 1. File existence
// ---------------------------------------------------------------------------

describe("controller.yml: file existence", () => {
	test("exists at .github/workflows/controller.yml", () => {
		expect(existsSync(WORKFLOW_PATH)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 2. Triggers
// ---------------------------------------------------------------------------

describe("controller.yml: trigger events (structural)", () => {
	test("on.schedule is present and is an array", () => {
		const wf = parseWorkflow();
		const on = wf.on as OnBlock;
		expect(Array.isArray(on?.schedule)).toBe(true);
		expect((on?.schedule ?? []).length).toBeGreaterThan(0);
	});

	test("on.schedule[0].cron is a ~2-minute interval (*/2 * * * * or similar)", () => {
		const wf = parseWorkflow();
		const on = wf.on as OnBlock;
		const cron = on?.schedule?.[0]?.cron ?? "";
		// Accept */2 or */1 minute intervals (both give <=2 min cadence)
		expect(cron).toMatch(/^\*\/[12]\s+\*\s+\*\s+\*\s+\*$/);
	});

	test("on.repository_dispatch is present", () => {
		const wf = parseWorkflow();
		const on = wf.on as OnBlock;
		expect(on).toHaveProperty("repository_dispatch");
	});

	test("on.workflow_dispatch is present", () => {
		const wf = parseWorkflow();
		const on = wf.on as OnBlock;
		expect(on).toHaveProperty("workflow_dispatch");
	});
});

// ---------------------------------------------------------------------------
// 3. Permissions
// ---------------------------------------------------------------------------

describe("controller.yml: permissions block", () => {
	test("has a top-level permissions block", () => {
		const wf = parseWorkflow();
		expect(wf.permissions).toBeDefined();
	});

	test("grants contents: read", () => {
		const wf = parseWorkflow();
		expect(wf.permissions?.contents).toBe("read");
	});

	test("grants pull-requests: write", () => {
		const wf = parseWorkflow();
		expect(wf.permissions?.["pull-requests"]).toBe("write");
	});

	test("grants actions: write (needed to dispatch slice.yml)", () => {
		const wf = parseWorkflow();
		expect(wf.permissions?.actions).toBe("write");
	});
});

// ---------------------------------------------------------------------------
// 4. Concurrency — queue, don't cancel
// ---------------------------------------------------------------------------

describe("controller.yml: concurrency block", () => {
	test("has a top-level concurrency block", () => {
		const wf = parseWorkflow();
		expect(wf.concurrency).toBeDefined();
	});

	test("concurrency group references github.ref", () => {
		const wf = parseWorkflow();
		const group = wf.concurrency?.group ?? "";
		expect(group).toMatch(/github\.ref/);
	});

	test("concurrency group includes 'controller' as identifier", () => {
		const wf = parseWorkflow();
		const group = wf.concurrency?.group ?? "";
		expect(group.toLowerCase()).toMatch(/controller/);
	});

	test("cancel-in-progress is false (queue, don't kill running controller)", () => {
		const wf = parseWorkflow();
		expect(wf.concurrency?.["cancel-in-progress"]).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// 5. Step: read tasks.md via dag-controller.ts
// ---------------------------------------------------------------------------

describe("controller.yml: dag-controller.ts invocation (structural)", () => {
	test("a step invokes bun scripts/dag-controller.ts", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const dagStep = steps.find(
			(s) => s.run?.includes("dag-controller") || s.run?.includes("dag-controller.ts"),
		);
		expect(dagStep).toBeDefined();
	});

	test("the dag-controller step references tasks.md", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const dagStep = steps.find((s) => s.run?.includes("dag-controller"));
		// Either the step itself mentions tasks.md, or the workflow file does
		const raw = readWorkflowRaw();
		const mentionsTasks = dagStep?.run?.includes("tasks.md") ?? raw.includes("tasks.md");
		expect(mentionsTasks).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 6. Step: query in-flight slice.yml runs
// ---------------------------------------------------------------------------

describe("controller.yml: in-flight detection (structural)", () => {
	test("a step queries gh run list for in_progress slice.yml runs", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const inFlightStep = steps.find(
			(s) =>
				s.run?.includes("in_progress") ||
				s.run?.includes("in-progress") ||
				(s.run?.includes("gh run list") && s.run?.includes("slice.yml")),
		);
		expect(inFlightStep).toBeDefined();
	});

	test("in-flight step references slice.yml as the workflow to query", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const inFlightStep = steps.find(
			(s) =>
				s.run?.includes("in_progress") ||
				(s.run?.includes("gh run list") && s.run?.includes("slice")),
		);
		const mentionsSlice = inFlightStep?.run?.includes("slice") ?? false;
		expect(mentionsSlice).toBe(true);
	});

	test("in-flight step uses --json flag or gh api for structured output", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const inFlightStep = steps.find(
			(s) =>
				s.run?.includes("in_progress") ||
				(s.run?.includes("gh run list") && s.run?.includes("slice")),
		);
		const usesJson = inFlightStep?.run?.includes("--json") || inFlightStep?.run?.includes("gh api");
		expect(usesJson).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 7. Step: derive completed slices from git log
// ---------------------------------------------------------------------------

describe("controller.yml: completed slices detection (structural)", () => {
	test("a step derives completed slices from git log or status file", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const completedStep = steps.find(
			(s) =>
				s.run?.includes("git log") ||
				s.run?.includes("GREEN") ||
				s.run?.includes("completed") ||
				s.run?.includes("status"),
		);
		expect(completedStep).toBeDefined();
	});

	test("completed detection references GREEN slice commit pattern", () => {
		const raw = readWorkflowRaw();
		// Accept pattern in raw YAML: "GREEN" or "code(NNN): GREEN" or "slice.*GREEN"
		const hasGreenPattern =
			raw.includes("GREEN") ||
			raw.includes("green") ||
			(raw.includes("git log") && raw.includes("grep"));
		expect(hasGreenPattern).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 8. Dispatch loop: calls gh workflow run slice.yml with payload
// ---------------------------------------------------------------------------

describe("controller.yml: dispatch loop (structural)", () => {
	test("a step calls gh workflow run or repository_dispatch for slice.yml", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const dispatchStep = steps.find(
			(s) =>
				(s.run?.includes("gh workflow run") && s.run?.includes("slice.yml")) ||
				(s.run?.includes("gh api") && s.run?.includes("dispatches")) ||
				(s.run?.includes("repository_dispatch") && s.run?.includes("slice")),
		);
		expect(dispatchStep).toBeDefined();
	});

	test("dispatch step passes slice_id in payload", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const dispatchStep = steps.find(
			(s) =>
				(s.run?.includes("gh workflow run") && s.run?.includes("slice.yml")) ||
				(s.run?.includes("gh api") && s.run?.includes("dispatches")),
		);
		const mentionsSliceId =
			dispatchStep?.run?.includes("slice_id") || dispatchStep?.run?.includes("sliceId");
		expect(mentionsSliceId).toBe(true);
	});

	test("dispatch step passes spec_id in payload", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const dispatchStep = steps.find(
			(s) =>
				(s.run?.includes("gh workflow run") && s.run?.includes("slice.yml")) ||
				(s.run?.includes("gh api") && s.run?.includes("dispatches")),
		);
		const mentionsSpecId =
			dispatchStep?.run?.includes("spec_id") || dispatchStep?.run?.includes("specId");
		expect(mentionsSpecId).toBe(true);
	});

	test("dispatch step passes branch ref in payload", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const dispatchStep = steps.find(
			(s) =>
				(s.run?.includes("gh workflow run") && s.run?.includes("slice.yml")) ||
				(s.run?.includes("gh api") && s.run?.includes("dispatches")),
		);
		// branch or ref is passed
		const mentionsBranch =
			dispatchStep?.run?.includes("branch") ||
			dispatchStep?.run?.includes("github.ref") ||
			dispatchStep?.run?.includes("GITHUB_REF");
		expect(mentionsBranch).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 9. No-op when nothing dispatchable — exits 0
// ---------------------------------------------------------------------------

describe("controller.yml: no-op on empty dispatchable list", () => {
	test("dispatch step has an 'if:' guard OR the run block short-circuits on empty array", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const dispatchStep = steps.find(
			(s) =>
				(s.run?.includes("gh workflow run") && s.run?.includes("slice.yml")) ||
				(s.run?.includes("gh api") && s.run?.includes("dispatches")),
		);
		expect(dispatchStep).toBeDefined();
		// Either the step has an `if:` clause, or its run block contains a
		// short-circuit check (length === 0, length > 0, empty check, etc.)
		const hasIfGuard = dispatchStep?.if !== undefined;
		const hasShortCircuit =
			dispatchStep?.run?.includes(".length") ||
			dispatchStep?.run?.includes("length > 0") ||
			dispatchStep?.run?.includes("length === 0") ||
			dispatchStep?.run?.includes("[ -z") ||
			dispatchStep?.run?.includes("if [") ||
			dispatchStep?.run?.match(/if\s*\(/) !== null;
		expect(hasIfGuard || hasShortCircuit).toBe(true);
	});

	test("workflow does not fail when dispatchable list is empty (uses exit 0 or non-failure path)", () => {
		const steps = allSteps(parseWorkflow());
		// There must NOT be an unconditional `exit 1` on no-dispatches path.
		// Accept: step has if: guard, or explicitly uses `|| true` / `exit 0`
		// We verify there's no unconditional exit 1 in a dispatch-related step
		const dispatchStep = steps.find(
			(s) =>
				(s.run?.includes("gh workflow run") && s.run?.includes("slice.yml")) ||
				(s.run?.includes("gh api") && s.run?.includes("dispatches")),
		);
		// If dispatch step has if: guard, empty array won't even run the step → exit 0 guaranteed
		const guardedByIf = dispatchStep?.if !== undefined;
		// Or the step's run block handles empty case without `exit 1`
		const runHasExitOne = dispatchStep?.run?.match(/exit\s+1/) !== null;
		// If guarded, or run doesn't unconditionally exit 1, we're fine
		expect(guardedByIf || !runHasExitOne).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 10. Runner
// ---------------------------------------------------------------------------

describe("controller.yml: runner", () => {
	test("uses runs-on: ubuntu-latest", () => {
		const wf = parseWorkflow();
		const jobs = Object.values(wf.jobs ?? {});
		const hasUbuntu = jobs.some((j) => j["runs-on"] === "ubuntu-latest");
		expect(hasUbuntu).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 11. Checkout step with fetch-depth: 0
// ---------------------------------------------------------------------------

describe("controller.yml: checkout step", () => {
	test("uses actions/checkout@v4", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const checkoutStep = steps.find((s) => s.uses?.startsWith("actions/checkout@v4"));
		expect(checkoutStep).toBeDefined();
	});

	test("checkout step sets fetch-depth: 0 (needed for git log)", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const checkoutStep = steps.find((s) => s.uses?.startsWith("actions/checkout@v4"));
		expect(checkoutStep?.with?.["fetch-depth"]).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// 12. Dispatch step structurally guarded
// ---------------------------------------------------------------------------

describe("controller.yml: dispatch step structural guard", () => {
	test("dispatch step has if: clause OR run block is structured to skip on empty list", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const dispatchStep = steps.find(
			(s) =>
				(s.run?.includes("gh workflow run") && s.run?.includes("slice.yml")) ||
				(s.run?.includes("gh api") && s.run?.includes("dispatches")),
		);
		expect(dispatchStep).toBeDefined();
		const hasIfGuard = dispatchStep?.if !== undefined && (dispatchStep.if ?? "").length > 0;
		const runHandlesEmpty =
			dispatchStep?.run?.includes("length") ||
			dispatchStep?.run?.includes("if [") ||
			dispatchStep?.run?.match(/if\s*\[/) !== null ||
			dispatchStep?.run?.match(/for\s+.*in/) !== null;
		// Either a structural if: guard or the loop/check handles the empty case
		expect(hasIfGuard || runHandlesEmpty).toBe(true);
	});

	test("if: guard on dispatch step references the dispatchable list variable", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const dispatchStep = steps.find(
			(s) =>
				(s.run?.includes("gh workflow run") && s.run?.includes("slice.yml")) ||
				(s.run?.includes("gh api") && s.run?.includes("dispatches")),
		);
		if (dispatchStep?.if === undefined) {
			// If no if: clause, the run block must contain a guard — already tested above
			return;
		}
		const ifClause = dispatchStep.if.toLowerCase();
		// Guard must reference a dispatchable/ids/count concept or step output
		const referencesDispatchable =
			ifClause.includes("dispatchable") ||
			ifClause.includes("ids") ||
			ifClause.includes("count") ||
			ifClause.includes("length") ||
			ifClause.includes("outputs.") ||
			ifClause.includes("steps.");
		expect(referencesDispatchable).toBe(true);
	});
});
