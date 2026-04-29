/**
 * Slice 7 gate: slice.yml — matrix runner with expertise skill
 *
 * Tests that `.github/workflows/slice.yml` encodes the correct contract:
 *   1.  File exists at .github/workflows/slice.yml
 *   2.  Triggers: workflow_dispatch with inputs slice_id, spec_id, branch
 *   3.  Permissions: contents:write, pull-requests:write
 *   4.  Concurrency: group keyed on slice-${{ inputs.spec_id }}-${{ inputs.slice_id }}, cancel-in-progress: false
 *   5.  Runner: ubuntu-latest
 *   6.  Checkout: actions/checkout@v4 checks out ${{ inputs.branch }} with fetch-depth: 0
 *   7.  Pull-rebase before work: a step runs git pull --rebase origin ${{ inputs.branch }}
 *   8.  Claude invocation: claude -p with --max-turns, ANTHROPIC_API_KEY, and expertise skill
 *   9.  Fresh context per slice: claude invoked with --no-resume or equivalent
 *  10.  Push with retry: git push with retry-on-non-fast-forward loop
 *  11.  Replanner invocation: spec-replanner called after work commits
 *  12.  Failure escalation: on 3rd failure, posts menu via bun scripts/issue-options.ts
 *  13.  Dispatch loop short-circuit: failure menu step is structurally guarded (if:failure() or similar)
 *
 * Uses structural YAML parsing (yaml package) — run: block assertions use
 * multiline-anchored regex on the parsed `run:` field.
 *
 * These tests are intentionally RED until slice.yml is implemented (slice 7).
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

const REPO_ROOT = join(import.meta.dir, "../..");
const WORKFLOW_PATH = join(REPO_ROOT, ".github", "workflows", "slice.yml");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InputDef = {
	type?: string;
	description?: string;
	required?: boolean;
	default?: unknown;
};

type OnBlock = {
	workflow_dispatch?: {
		inputs?: Record<string, InputDef>;
	};
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
	"continue-on-error"?: boolean;
};

type Job = {
	steps?: Step[];
	"runs-on"?: string;
	needs?: string | string[];
	if?: string;
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
		throw new Error("slice.yml not found at .github/workflows/slice.yml");
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

/** Return all jobs as [name, job] pairs. */
function allJobs(wf: WorkflowDoc): [string, Job][] {
	return Object.entries(wf.jobs ?? {});
}

// ---------------------------------------------------------------------------
// 1. File existence
// ---------------------------------------------------------------------------

describe("slice.yml: file existence", () => {
	test("exists at .github/workflows/slice.yml", () => {
		expect(existsSync(WORKFLOW_PATH)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 2. Triggers: workflow_dispatch with required inputs
// ---------------------------------------------------------------------------

describe("slice.yml: trigger events (structural)", () => {
	test("on.workflow_dispatch is present", () => {
		const wf = parseWorkflow();
		const on = wf.on as OnBlock;
		expect(on).toHaveProperty("workflow_dispatch");
	});

	test("workflow_dispatch has inputs block", () => {
		const wf = parseWorkflow();
		const on = wf.on as OnBlock;
		expect(on?.workflow_dispatch?.inputs).toBeDefined();
	});

	test("inputs includes slice_id", () => {
		const wf = parseWorkflow();
		const on = wf.on as OnBlock;
		const inputs = on?.workflow_dispatch?.inputs ?? {};
		expect(inputs).toHaveProperty("slice_id");
	});

	test("inputs includes spec_id of type string", () => {
		const wf = parseWorkflow();
		const on = wf.on as OnBlock;
		const inputs = on?.workflow_dispatch?.inputs ?? {};
		expect(inputs).toHaveProperty("spec_id");
		// type is string (not number or boolean)
		const specIdType = inputs["spec_id"]?.type?.toLowerCase() ?? "";
		expect(specIdType).toBe("string");
	});

	test("inputs includes branch of type string", () => {
		const wf = parseWorkflow();
		const on = wf.on as OnBlock;
		const inputs = on?.workflow_dispatch?.inputs ?? {};
		expect(inputs).toHaveProperty("branch");
		const branchType = inputs["branch"]?.type?.toLowerCase() ?? "";
		expect(branchType).toBe("string");
	});

	test("workflow_dispatch is the only trigger (no schedule, no push, etc.)", () => {
		const wf = parseWorkflow();
		const on = wf.on as OnBlock;
		const keys = Object.keys(on ?? {});
		// Only workflow_dispatch should be present (this is a manually-dispatched workflow)
		expect(keys).toContain("workflow_dispatch");
		expect(keys).not.toContain("push");
		expect(keys).not.toContain("schedule");
	});
});

// ---------------------------------------------------------------------------
// 3. Permissions block
// ---------------------------------------------------------------------------

describe("slice.yml: permissions block", () => {
	test("has a top-level permissions block", () => {
		const wf = parseWorkflow();
		expect(wf.permissions).toBeDefined();
	});

	test("grants contents: write", () => {
		const wf = parseWorkflow();
		expect(wf.permissions?.contents).toBe("write");
	});

	test("grants pull-requests: write", () => {
		const wf = parseWorkflow();
		expect(wf.permissions?.["pull-requests"]).toBe("write");
	});
});

// ---------------------------------------------------------------------------
// 4. Concurrency — per slice, don't cancel running slice
// ---------------------------------------------------------------------------

describe("slice.yml: concurrency block", () => {
	test("has a top-level concurrency block", () => {
		const wf = parseWorkflow();
		expect(wf.concurrency).toBeDefined();
	});

	test("concurrency group references inputs.spec_id", () => {
		const wf = parseWorkflow();
		const group = wf.concurrency?.group ?? "";
		expect(group).toMatch(/inputs\.spec_id/);
	});

	test("concurrency group references inputs.slice_id", () => {
		const wf = parseWorkflow();
		const group = wf.concurrency?.group ?? "";
		expect(group).toMatch(/inputs\.slice_id/);
	});

	test("concurrency group starts with 'slice-'", () => {
		const wf = parseWorkflow();
		const group = wf.concurrency?.group ?? "";
		expect(group).toMatch(/^slice-/);
	});

	test("cancel-in-progress is false (don't kill running slice)", () => {
		const wf = parseWorkflow();
		expect(wf.concurrency?.["cancel-in-progress"]).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// 5. Runner
// ---------------------------------------------------------------------------

describe("slice.yml: runner", () => {
	test("uses runs-on: ubuntu-latest", () => {
		const wf = parseWorkflow();
		const jobs = Object.values(wf.jobs ?? {});
		const hasUbuntu = jobs.some((j) => j["runs-on"] === "ubuntu-latest");
		expect(hasUbuntu).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 6. Checkout step checks out inputs.branch with fetch-depth: 0
// ---------------------------------------------------------------------------

describe("slice.yml: checkout step", () => {
	test("uses actions/checkout@v4", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const checkoutStep = steps.find((s) => s.uses?.startsWith("actions/checkout@v4"));
		expect(checkoutStep).toBeDefined();
	});

	test("checkout step sets fetch-depth: 0", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const checkoutStep = steps.find((s) => s.uses?.startsWith("actions/checkout@v4"));
		expect(checkoutStep?.with?.["fetch-depth"]).toBe(0);
	});

	test("checkout step checks out inputs.branch", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const checkoutStep = steps.find((s) => s.uses?.startsWith("actions/checkout@v4"));
		// The ref must be set to inputs.branch (the dispatched branch)
		const ref = String(checkoutStep?.with?.["ref"] ?? "");
		expect(ref).toMatch(/inputs\.branch/);
	});
});

// ---------------------------------------------------------------------------
// 7. Pull-rebase before work
// ---------------------------------------------------------------------------

describe("slice.yml: pull-rebase before work", () => {
	test("a step runs git pull --rebase before the claude invocation", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const pullStep = steps.find((s) => s.run?.includes("git pull") && s.run?.includes("--rebase"));
		expect(pullStep).toBeDefined();
	});

	test("pull-rebase step targets origin and inputs.branch", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const pullStep = steps.find((s) => s.run?.includes("git pull") && s.run?.includes("--rebase"));
		// The step must reference 'origin' and the branch input
		const run = pullStep?.run ?? "";
		expect(run).toMatch(/origin/);
		expect(run).toMatch(/inputs\.branch/);
	});

	test("pull-rebase step appears before the claude invocation step", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const pullIdx = steps.findIndex(
			(s) => s.run?.includes("git pull") && s.run?.includes("--rebase"),
		);
		const claudeIdx = steps.findIndex((s) => s.run?.match(/claude\s+-p/));
		expect(pullIdx).toBeGreaterThanOrEqual(0);
		expect(claudeIdx).toBeGreaterThan(pullIdx);
	});
});

// ---------------------------------------------------------------------------
// 8. Claude invocation: -p, --max-turns, ANTHROPIC_API_KEY, expertise skill
// ---------------------------------------------------------------------------

describe("slice.yml: claude invocation", () => {
	test("invokes claude with -p flag", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const claudeStep = steps.find((s) => s.run?.match(/claude\s+-p/));
		expect(claudeStep).toBeDefined();
	});

	test("claude invocation includes --max-turns flag", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const claudeStep = steps.find((s) => s.run?.match(/claude\s+-p/));
		expect(claudeStep?.run).toMatch(/--max-turns/);
	});

	test("uses ANTHROPIC_API_KEY secret", () => {
		const raw = readWorkflowRaw();
		expect(raw).toMatch(/secrets\.ANTHROPIC_API_KEY/);
	});

	test("ANTHROPIC_API_KEY is wired into the claude step (env or run block)", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const claudeStep = steps.find((s) => s.run?.match(/claude\s+-p/));
		// Check env block on the step OR on the run invocation
		const envHasKey = Object.keys(claudeStep?.env ?? {}).some((k) => k === "ANTHROPIC_API_KEY");
		const runHasKey = claudeStep?.run?.includes("ANTHROPIC_API_KEY") ?? false;
		expect(envHasKey || runHasKey).toBe(true);
	});

	test("claude prompt or env includes the expertise skill", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const claudeStep = steps.find((s) => s.run?.match(/claude\s+-p/));
		// The run block or a step env var must reference 'expertise'
		const runHasExpertise = claudeStep?.run?.includes("expertise") ?? false;
		const envHasExpertise = Object.values(claudeStep?.env ?? {}).some((v) =>
			String(v).includes("expertise"),
		);
		expect(runHasExpertise || envHasExpertise).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 9. Fresh context per slice: --no-resume or equivalent
// ---------------------------------------------------------------------------

describe("slice.yml: fresh context per slice", () => {
	test("claude is invoked with --no-resume flag (no session carryover between slices)", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const claudeStep = steps.find((s) => s.run?.match(/claude\s+-p/));
		expect(claudeStep?.run).toMatch(/--no-resume/);
	});
});

// ---------------------------------------------------------------------------
// 10. Push with retry on non-fast-forward
// ---------------------------------------------------------------------------

describe("slice.yml: push with retry", () => {
	test("a step pushes to origin inputs.branch", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const pushStep = steps.find((s) => s.run?.includes("git push") && s.run?.includes("origin"));
		expect(pushStep).toBeDefined();
	});

	test("push step has retry logic for non-fast-forward (loop or retry wrapper)", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const pushStep = steps.find((s) => s.run?.includes("git push") && s.run?.includes("origin"));
		const run = pushStep?.run ?? "";
		// Accept: while loop, for loop with retries, or a retry-wrapper invocation
		const hasLoop =
			run.includes("while") ||
			run.includes("for ") ||
			run.includes("retry") ||
			run.match(/for\s+i\s+in/) !== null ||
			run.match(/ATTEMPT|attempt|MAX_RETRIES|max_retries|MAX_ATTEMPTS/) !== null;
		expect(hasLoop).toBe(true);
	});

	test("retry logic includes git pull --rebase before re-push on failure", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const pushStep = steps.find((s) => s.run?.includes("git push") && s.run?.includes("origin"));
		const run = pushStep?.run ?? "";
		// The retry block must do a pull --rebase before the next push attempt
		expect(run).toMatch(/pull.*--rebase|--rebase.*pull/s);
	});

	test("push retry has a max-retries count (bounded loop)", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const pushStep = steps.find((s) => s.run?.includes("git push") && s.run?.includes("origin"));
		const run = pushStep?.run ?? "";
		// Must have a numeric bound: a constant like 3, 5, MAX_RETRIES, etc.
		const hasBound =
			run.match(/\b[3-9]\b|\b[1-9][0-9]+\b/) !== null ||
			run.includes("MAX_RETRIES") ||
			run.includes("MAX_ATTEMPTS") ||
			run.includes("max_retries") ||
			run.includes("max_attempts");
		expect(hasBound).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 11. Replanner invocation after work commits
// ---------------------------------------------------------------------------

describe("slice.yml: replanner invocation", () => {
	test("a step invokes spec-replanner or replanner after work", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		// Accept: separate step calling replanner, OR the claude -p run block
		// containing a "run spec-replanner" instruction, OR a step whose
		// name/run references replanner.
		const replannerStep = steps.find(
			(s) =>
				s.run?.includes("replanner") ||
				s.run?.includes("spec-replanner") ||
				s.name?.toLowerCase().includes("replanner") ||
				s.run?.includes("replan"),
		);
		expect(replannerStep).toBeDefined();
	});

	test("replanner step appears after the claude work step", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const claudeIdx = steps.findIndex((s) => s.run?.match(/claude\s+-p/));
		const replannerIdx = steps.findIndex(
			(s) =>
				s.run?.includes("replanner") ||
				s.run?.includes("spec-replanner") ||
				s.name?.toLowerCase().includes("replanner") ||
				s.run?.includes("replan"),
		);
		// If replanner is embedded in the claude prompt block (same step), that's also valid
		if (replannerIdx === claudeIdx) {
			// Same step: check the run block contains both
			const run = steps[claudeIdx]?.run ?? "";
			expect(run).toMatch(/replann?er/i);
		} else {
			expect(replannerIdx).toBeGreaterThan(claudeIdx);
		}
	});
});

// ---------------------------------------------------------------------------
// 12. Failure escalation: post menu via issue-options.ts on 3rd failure
// ---------------------------------------------------------------------------

describe("slice.yml: failure escalation", () => {
	test("a step or job invokes bun scripts/issue-options.ts on failure", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const menuStep = steps.find((s) => s.run?.includes("issue-options"));
		expect(menuStep).toBeDefined();
	});

	test("failure escalation step references ANTHROPIC_API_KEY or GH_TOKEN secret", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const menuStep = steps.find((s) => s.run?.includes("issue-options"));
		// Must have token to post the comment
		const envHasToken = Object.keys(menuStep?.env ?? {}).some(
			(k) => k === "GH_TOKEN" || k === "GITHUB_TOKEN" || k === "ANTHROPIC_API_KEY",
		);
		const runHasToken =
			menuStep?.run?.includes("GH_TOKEN") ||
			menuStep?.run?.includes("GITHUB_TOKEN") ||
			menuStep?.run?.includes("github.token");
		const raw = readWorkflowRaw();
		const rawHasToken =
			raw.includes("secrets.GITHUB_TOKEN") ||
			raw.includes("github.token") ||
			raw.includes("secrets.GH_TOKEN");
		expect(envHasToken || runHasToken || rawHasToken).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 13. Failure escalation structural guard: if:failure() or failure-menu job
// ---------------------------------------------------------------------------

describe("slice.yml: failure escalation structural guard", () => {
	test("the issue-options step has an if: clause guarding on failure", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const menuStep = steps.find((s) => s.run?.includes("issue-options"));
		expect(menuStep).toBeDefined();
		// The step must have an if: guard referencing failure() or a retry counter == 3
		const ifClause = (menuStep?.if ?? "").toLowerCase();
		const isGuarded =
			ifClause.includes("failure") ||
			ifClause.includes("== 3") ||
			ifClause.includes(">=3") ||
			ifClause.includes(">= 3") ||
			ifClause.includes("== '3'");
		expect(isGuarded).toBe(true);
	});

	test("the failure menu step is NOT reachable on first or second failure (guarded)", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const menuStep = steps.find((s) => s.run?.includes("issue-options"));
		// Must have some guard — if: with failure() condition, or retry counter check
		const hasGuard = menuStep?.if !== undefined && menuStep.if.length > 0;
		expect(hasGuard).toBe(true);
	});

	test("workflow jobs include a failure-handling mechanism (if:failure() job OR failure-escalation step)", () => {
		const wf = parseWorkflow();
		// Check for either a separate job with if:failure() or if: needs pattern,
		// OR the main job has a step with if: failure()
		const jobs = allJobs(wf);
		const hasFailureJob = jobs.some(([, job]) => {
			const ifClause = (job.if ?? "").toLowerCase();
			return ifClause.includes("failure");
		});
		const steps = allSteps(wf);
		const hasFailureStep = steps.some((s) => {
			const ifClause = (s.if ?? "").toLowerCase();
			return ifClause.includes("failure");
		});
		expect(hasFailureJob || hasFailureStep).toBe(true);
	});
});
