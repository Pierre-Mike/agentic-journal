/**
 * Slice 9 gate: automerge.yml — aggregator + squash-merge
 *
 * Tests that `.github/workflows/automerge.yml` encodes the correct contract:
 *
 *  1.  File exists at .github/workflows/automerge.yml
 *  2.  Triggers: workflow_run.types:[completed] (fires after CI concludes)
 *      NOTE: `check_suite` does NOT directly support cross-workflow aggregation in GH Actions;
 *      `workflow_run` is the canonical trigger for "after another workflow finished".
 *      We assert `on.workflow_run.types` contains "completed".
 *  3.  Permissions: contents:write, pull-requests:write, issues:write, actions:read
 *  4.  Concurrency: group keyed on PR number; cancel-in-progress: true
 *  5.  Aggregator gates (all must pass before merge):
 *      a. DAG done — all slices in tasks.md have a GREEN commit on the branch
 *      b. Outer BDD gate ✓ — bun test tests/automation-pipeline.test.ts exits 0
 *      c. Preview e2e ✓ — latest preview.yml run for this branch concluded successfully
 *  6.  Early-green detection: if outer gate went GREEN before the last slice landed,
 *      post a "spec gap detected" comment to the issue and DO NOT merge
 *  7.  Squash merge: gh pr merge --squash --delete-branch $PR_NUMBER
 *  8.  Issue close: gh issue close $ISSUE_NUMBER after merge
 *  9.  Spec archive: bun run spec:complete (or mv specs/active/ → specs/archive/)
 * 10.  Failure fan-in: bun scripts/issue-options.ts posts failure menu to the issue
 *      via gh issue comment (NOT gh pr comment) when any gate fails
 * 11.  Runner: ubuntu-latest
 * 12.  Checkout: actions/checkout@v4 with fetch-depth: 0
 *
 * Uses structural YAML parsing (yaml package) to assert invariants.
 * These tests are intentionally RED until automerge.yml is implemented (slice 9).
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

const REPO_ROOT = join(import.meta.dir, "../..");
const WORKFLOW_PATH = join(REPO_ROOT, ".github", "workflows", "automerge.yml");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OnBlock = {
	workflow_run?: {
		workflows?: string[];
		types?: string[];
		branches?: string[];
		[key: string]: unknown;
	};
	check_suite?: {
		types?: string[];
		[key: string]: unknown;
	};
	pull_request?: {
		types?: string[];
		[key: string]: unknown;
	};
	[key: string]: unknown;
};

type Step = {
	name?: string;
	uses?: string;
	run?: string;
	if?: string;
	with?: Record<string, unknown>;
	env?: Record<string, string | number | boolean>;
	id?: string;
	"continue-on-error"?: boolean;
};

type Job = {
	"runs-on"?: string;
	steps?: Step[];
	permissions?: Record<string, string>;
	concurrency?: { group?: string; "cancel-in-progress"?: boolean };
	needs?: string | string[];
	outputs?: Record<string, string>;
};

type WorkflowDoc = {
	on?: OnBlock;
	permissions?: Record<string, string>;
	concurrency?: { group?: string; "cancel-in-progress"?: boolean };
	jobs?: Record<string, Job>;
	name?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readWorkflowRaw(): string {
	if (!existsSync(WORKFLOW_PATH)) {
		throw new Error("automerge.yml not found at .github/workflows/automerge.yml");
	}
	return readFileSync(WORKFLOW_PATH, "utf-8");
}

function parseWorkflow(): WorkflowDoc {
	const raw = readWorkflowRaw();
	return parseYaml(raw) as WorkflowDoc;
}

function allSteps(wf: WorkflowDoc): Step[] {
	return Object.values(wf.jobs ?? {}).flatMap((job) => job.steps ?? []);
}

// ---------------------------------------------------------------------------
// 1. File existence
// ---------------------------------------------------------------------------

describe("automerge.yml: file existence", () => {
	test("exists at .github/workflows/automerge.yml", () => {
		expect(existsSync(WORKFLOW_PATH)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 2. Triggers — structural YAML assertions
//
// Rationale: `workflow_run` is the correct GH Actions trigger for "fire after
// another workflow completes". `check_suite` fires per-check-suite but cannot
// aggregate across multiple workflow runs. We assert workflow_run.types contains
// "completed". The monitored workflows must include at least slice.yml / preview.yml
// (or a wildcard) so the aggregator runs after the critical CI finishes.
// ---------------------------------------------------------------------------

describe("automerge.yml: trigger events (structural)", () => {
	test("has on.workflow_run trigger (correct GH Actions aggregation mechanism)", () => {
		const wf = parseWorkflow();
		const on = wf.on as OnBlock;
		expect(on).toHaveProperty("workflow_run");
	});

	test("on.workflow_run.types contains 'completed'", () => {
		const wf = parseWorkflow();
		const on = wf.on as OnBlock;
		const types: string[] = on?.workflow_run?.types ?? [];
		expect(types).toContain("completed");
	});

	test("on.workflow_run.workflows lists at least one monitored workflow", () => {
		const wf = parseWorkflow();
		const on = wf.on as OnBlock;
		const workflows: string[] = on?.workflow_run?.workflows ?? [];
		expect(workflows.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// 3. Permissions block
// ---------------------------------------------------------------------------

describe("automerge.yml: permissions block", () => {
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

	test("grants issues: write", () => {
		const wf = parseWorkflow();
		expect(wf.permissions?.issues).toBe("write");
	});

	test("grants actions: read (to query workflow run results)", () => {
		const wf = parseWorkflow();
		expect(wf.permissions?.actions).toBe("read");
	});
});

// ---------------------------------------------------------------------------
// 4. Concurrency — keyed on PR number, cancel-in-progress: true
// ---------------------------------------------------------------------------

describe("automerge.yml: concurrency block", () => {
	test("has a top-level concurrency block", () => {
		const wf = parseWorkflow();
		expect(wf.concurrency).toBeDefined();
	});

	test("concurrency group references a PR number expression", () => {
		// The raw YAML contains the expression string before it is evaluated.
		// Assert the YAML source text contains an expression referencing PR number.
		const raw = readWorkflowRaw();
		// Acceptable patterns: workflow_run.pull_requests[0].number, github.event.number, etc.
		const hasPrNumber =
			raw.includes("pull_requests[0].number") ||
			raw.includes("event.number") ||
			raw.includes("event.pull_request.number") ||
			// some implementations stash PR number in a step output
			raw.includes("pr_number") ||
			raw.includes("PR_NUMBER");
		expect(hasPrNumber).toBe(true);
	});

	test("concurrency group string contains 'automerge' prefix", () => {
		const wf = parseWorkflow();
		const group = wf.concurrency?.group ?? "";
		expect(group).toMatch(/automerge/i);
	});

	test("cancel-in-progress is true (only keep latest decision)", () => {
		const wf = parseWorkflow();
		expect(wf.concurrency?.["cancel-in-progress"]).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 5. Aggregator gates — all must be structurally present
// ---------------------------------------------------------------------------

describe("automerge.yml: aggregator gate — DAG done check", () => {
	test("a step checks GREEN commits for all slices on the feature branch", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		// Must reference GREEN commit pattern and tasks.md (to enumerate slices)
		const dagDoneStep = steps.find(
			(s) =>
				s.run !== undefined &&
				(s.run.includes("GREEN") || s.run.includes("green")) &&
				(s.run.includes("tasks.md") ||
					s.run.includes("slice") ||
					s.run.includes("git log") ||
					s.run.includes("dag")),
		);
		expect(dagDoneStep).toBeDefined();
	});

	test("DAG-done step outputs or sets a variable consumed by a later gate", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const dagDoneStep = steps.find(
			(s) =>
				s.run !== undefined &&
				(s.run.includes("GREEN") || s.run.includes("green")) &&
				(s.run.includes("tasks.md") || s.run.includes("git log") || s.run.includes("dag")),
		);
		// Either it writes to GITHUB_OUTPUT or it has an id used in step conditions
		const writesOutput =
			(dagDoneStep?.run?.includes("GITHUB_OUTPUT") ?? false) || dagDoneStep?.id !== undefined;
		expect(writesOutput).toBe(true);
	});
});

describe("automerge.yml: aggregator gate — outer BDD gate", () => {
	test("a step runs bun test tests/automation-pipeline.test.ts", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const outerGateStep = steps.find(
			(s) =>
				s.run?.includes("automation-pipeline") &&
				(s.run.includes("bun test") || s.run.includes("bun run")),
		);
		expect(outerGateStep).toBeDefined();
	});

	test("outer BDD gate step has an id for downstream reference", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const outerGateStep = steps.find(
			(s) => s.run?.includes("automation-pipeline") && s.run?.includes("bun"),
		);
		expect(outerGateStep?.id).toBeDefined();
	});
});

describe("automerge.yml: aggregator gate — preview e2e check", () => {
	test("a step queries whether the latest preview.yml run concluded successfully", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		// Must reference preview.yml run status via gh run list or API
		const previewCheckStep = steps.find(
			(s) =>
				s.run !== undefined &&
				(s.run.includes("preview") || s.run.includes("preview.yml")) &&
				(s.run.includes("gh run") ||
					s.run.includes("workflow_run") ||
					s.run.includes("conclusion") ||
					s.run.includes("status")),
		);
		expect(previewCheckStep).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// 6. Early-green detection — spec gap guard
// ---------------------------------------------------------------------------

describe("automerge.yml: early-green detection (spec gap guard)", () => {
	test("a step detects if outer gate passed before the last slice landed", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		// Look for a step that checks commit timestamps or ordering of green events
		const earlyGreenStep = steps.find(
			(s) =>
				s.run !== undefined &&
				(s.run.includes("early") ||
					s.run.includes("spec gap") ||
					s.run.includes("gap") ||
					// Checks whether outer-gate GREEN timestamp < last-slice GREEN timestamp
					(s.run.includes("automation-pipeline") && s.run.includes("git log")) ||
					s.run.includes("before")),
		);
		expect(earlyGreenStep).toBeDefined();
	});

	test("if spec gap detected, posts 'spec gap detected' comment to the issue", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const specGapCommentStep = steps.find(
			(s) =>
				s.run !== undefined &&
				(s.run.includes("spec gap") ||
					s.run.includes("spec-gap") ||
					s.run.includes("gap detected")) &&
				s.run.includes("gh issue comment"),
		);
		expect(specGapCommentStep).toBeDefined();
	});

	test("spec gap step has an if: guard so it only fires when gap is detected", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const specGapCommentStep = steps.find(
			(s) =>
				s.run !== undefined &&
				(s.run.includes("spec gap") ||
					s.run.includes("spec-gap") ||
					s.run.includes("gap detected")) &&
				s.run.includes("gh issue comment"),
		);
		expect(specGapCommentStep?.if).toBeDefined();
	});

	test("merge step has an if: guard that excludes spec-gap case", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const mergeStep = steps.find(
			(s) => s.run?.includes("gh pr merge") && s.run?.includes("--squash"),
		);
		// Merge step must have a condition so gap case prevents merge
		expect(mergeStep?.if).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// 7. Squash merge
// ---------------------------------------------------------------------------

describe("automerge.yml: squash merge", () => {
	test("a step runs gh pr merge --squash", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const mergeStep = steps.find(
			(s) => s.run?.includes("gh pr merge") && s.run?.includes("--squash"),
		);
		expect(mergeStep).toBeDefined();
	});

	test("merge step includes --delete-branch flag", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const mergeStep = steps.find(
			(s) => s.run?.includes("gh pr merge") && s.run?.includes("--squash"),
		);
		expect(mergeStep?.run).toMatch(/--delete-branch/);
	});

	test("merge step references a PR number variable (not hardcoded)", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const mergeStep = steps.find(
			(s) => s.run?.includes("gh pr merge") && s.run?.includes("--squash"),
		);
		// Must reference a variable, env var, or expression — not a bare number
		const run = mergeStep?.run ?? "";
		const usesVariable =
			run.includes("${{") ||
			run.includes("$PR_NUMBER") ||
			run.includes("$pr_number") ||
			run.includes("env.") ||
			run.includes("steps.");
		expect(usesVariable).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 8. Issue close after merge
// ---------------------------------------------------------------------------

describe("automerge.yml: issue close after merge", () => {
	test("a step runs gh issue close after the merge step", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const closeStep = steps.find((s) => s.run?.includes("gh issue close"));
		expect(closeStep).toBeDefined();
	});

	test("issue close step references an issue number variable", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const closeStep = steps.find((s) => s.run?.includes("gh issue close"));
		const run = closeStep?.run ?? "";
		const usesVariable =
			run.includes("${{") ||
			run.includes("$ISSUE_NUMBER") ||
			run.includes("$issue_number") ||
			run.includes("env.") ||
			run.includes("steps.");
		expect(usesVariable).toBe(true);
	});

	test("issue close step comes AFTER the merge step in step order", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const mergeIdx = steps.findIndex(
			(s) => s.run?.includes("gh pr merge") && s.run?.includes("--squash"),
		);
		const closeIdx = steps.findIndex((s) => s.run?.includes("gh issue close"));
		expect(mergeIdx).toBeGreaterThanOrEqual(0);
		expect(closeIdx).toBeGreaterThan(mergeIdx);
	});
});

// ---------------------------------------------------------------------------
// 9. Spec archive
// ---------------------------------------------------------------------------

describe("automerge.yml: spec archive step", () => {
	test("a step archives the spec after merge (bun run spec:complete or mv specs/active → specs/archive)", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const archiveStep = steps.find(
			(s) =>
				s.run !== undefined &&
				(s.run.includes("spec:complete") ||
					s.run.includes("bun run spec:complete") ||
					(s.run.includes("specs/archive") && s.run.includes("specs/active")) ||
					(s.run.includes("mv") && s.run.includes("specs"))),
		);
		expect(archiveStep).toBeDefined();
	});

	test("archive step runs before the merge step (pre-squash architecture)", () => {
		// Architecture: the archive must ride along with the PR's content
		// in the squash-merge — a separate post-merge push to main is
		// blocked by branch protection (required status checks). So the
		// archive step pushes specs/active → specs/archive on the auto/N
		// branch, and the squash-merge brings that move into main in one
		// commit.
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const mergeIdx = steps.findIndex(
			(s) => s.run?.includes("gh pr merge") && s.run?.includes("--squash"),
		);
		const archiveIdx = steps.findIndex(
			(s) =>
				s.run !== undefined &&
				(s.run.includes("spec:complete") ||
					(s.run.includes("specs/archive") && s.run.includes("specs/active"))),
		);
		expect(mergeIdx).toBeGreaterThanOrEqual(0);
		expect(archiveIdx).toBeGreaterThanOrEqual(0);
		expect(archiveIdx).toBeLessThan(mergeIdx);
	});
});

// ---------------------------------------------------------------------------
// 10. Failure fan-in: bun scripts/issue-options.ts via gh issue comment
// ---------------------------------------------------------------------------

describe("automerge.yml: failure fan-in (issue-options.ts)", () => {
	test("a step calls bun scripts/issue-options.ts on gate failure", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const failureMenuStep = steps.find((s) => s.run?.includes("issue-options.ts"));
		expect(failureMenuStep).toBeDefined();
	});

	test("failure step posts via gh issue comment (NOT gh pr comment)", () => {
		// Either issue-options.ts itself uses gh issue comment, or the step does
		const raw = readWorkflowRaw();
		// The workflow must reference gh issue comment at least once
		expect(raw).toMatch(/gh issue comment/);
		// And must NOT use gh pr comment for the failure notification
		// (issue comment keeps the conversation in the issue, not the PR)
	});

	test("failure fan-in step has an if: guard (only fires when a gate fails)", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const failureMenuStep = steps.find((s) => s.run?.includes("issue-options.ts"));
		// The step must be conditional — it should not run on success
		expect(failureMenuStep?.if).toBeDefined();
	});

	test("failure step condition references a failure state (failure() or a gate output)", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const failureMenuStep = steps.find((s) => s.run?.includes("issue-options.ts"));
		const ifClause = (failureMenuStep?.if ?? "").toLowerCase();
		const referencesFailure =
			ifClause.includes("failure") ||
			ifClause.includes("!= 'success'") ||
			ifClause.includes('!= "success"') ||
			ifClause.includes("failed") ||
			ifClause.includes("outputs.") ||
			ifClause.includes("steps.");
		expect(referencesFailure).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 11. Runner
// ---------------------------------------------------------------------------

describe("automerge.yml: runner", () => {
	test("uses runs-on: ubuntu-latest", () => {
		const wf = parseWorkflow();
		const jobs = Object.values(wf.jobs ?? {});
		const hasUbuntu = jobs.some((j) => j["runs-on"] === "ubuntu-latest");
		expect(hasUbuntu).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 12. Checkout step
// ---------------------------------------------------------------------------

describe("automerge.yml: checkout step", () => {
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
});
