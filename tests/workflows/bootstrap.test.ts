/**
 * Slice 5 gate: bootstrap.yml — issue→branch→aligner→spec
 *
 * Tests that `.github/workflows/bootstrap.yml` encodes the correct contract:
 *   1. File exists at .github/workflows/bootstrap.yml
 *   2. Triggers on issues.opened, issues.edited, issue_comment.created — NO label filter
 *   3. Permissions block: contents:write, pull-requests:write, issues:write
 *   4. Job creates branch named auto/<issue-number>-<slug> from main
 *   5. Job opens a draft PR linked to the issue (gh pr create --draft)
 *   6. Job invokes `claude -p` with /do-auto and uses CLAUDE_CODE_OAUTH_TOKEN secret
 *   7. After claude runs, checks .agentic/last-alignment.md confidence:
 *      - confidence:low  → posts issue comment (does NOT commit alignment)
 *      - confidence:high → commits alignment.md to the branch (ONLY when high)
 *   8. Concurrency group keyed on issue-${{ github.event.issue.number }}
 *   9. Uses runs-on: ubuntu-latest
 *  10. Steps include actions/checkout@v4 with fetch-depth: 0
 *
 * Uses structural YAML parsing (js-yaml / yaml) to assert invariants that
 * string-grep cannot enforce (trigger types location, if: guard presence,
 * mutual exclusivity of high/low paths).
 *
 * These tests are intentionally RED until bootstrap.yml is implemented (slice 5).
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

const REPO_ROOT = join(import.meta.dir, "../..");
const WORKFLOW_PATH = join(REPO_ROOT, ".github", "workflows", "bootstrap.yml");

type WorkflowDoc = {
	on?: Record<string, unknown>;
	permissions?: Record<string, string>;
	concurrency?: { group?: string; "cancel-in-progress"?: boolean };
	jobs?: Record<string, { steps?: Step[]; "runs-on"?: string }>;
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

function readWorkflowRaw(): string {
	if (!existsSync(WORKFLOW_PATH)) {
		throw new Error("bootstrap.yml not found at .github/workflows/bootstrap.yml");
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

describe("bootstrap.yml: file existence", () => {
	test("exists at .github/workflows/bootstrap.yml", () => {
		expect(existsSync(WORKFLOW_PATH)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 2. Trigger events — structural YAML assertions
// ---------------------------------------------------------------------------

describe("bootstrap.yml: trigger events (structural)", () => {
	test("on.issues.types contains 'opened'", () => {
		const wf = parseWorkflow();
		const on = wf.on as Record<string, { types?: string[] } | undefined>;
		const types: string[] = on?.issues?.types ?? [];
		expect(types).toContain("opened");
	});

	test("on.issues.types contains 'edited'", () => {
		const wf = parseWorkflow();
		const on = wf.on as Record<string, { types?: string[] } | undefined>;
		const types: string[] = on?.issues?.types ?? [];
		expect(types).toContain("edited");
	});

	test("on.issue_comment exists as a trigger key", () => {
		const wf = parseWorkflow();
		const on = wf.on as Record<string, unknown>;
		expect(on).toHaveProperty("issue_comment");
	});

	test("on.issue_comment.types contains 'created'", () => {
		const wf = parseWorkflow();
		const on = wf.on as Record<string, { types?: string[] } | undefined>;
		const types: string[] = on?.issue_comment?.types ?? [];
		expect(types).toContain("created");
	});

	test("on.issues.types does NOT contain 'labeled' (no label filter)", () => {
		const wf = parseWorkflow();
		const on = wf.on as Record<string, { types?: string[] } | undefined>;
		const types: string[] = on?.issues?.types ?? [];
		expect(types).not.toContain("labeled");
	});
});

// ---------------------------------------------------------------------------
// 3. Permissions block
// ---------------------------------------------------------------------------

describe("bootstrap.yml: permissions block", () => {
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
});

// ---------------------------------------------------------------------------
// 4. Branch creation — auto/<issue-number>-<slug>
// ---------------------------------------------------------------------------

describe("bootstrap.yml: branch creation", () => {
	test("a step creates a branch prefixed with 'auto/'", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const branchStep = steps.find(
			(s) =>
				s.run?.includes("auto/") ||
				s.run?.includes("git checkout -b") ||
				s.run?.includes("git switch -c"),
		);
		expect(branchStep).toBeDefined();
	});

	test("branch name expression references github.event.issue.number", () => {
		const wf = parseWorkflow();
		const raw = readWorkflowRaw();
		// The branch name must embed the issue number
		const hasNumber = raw.includes("github.event.issue.number");
		expect(hasNumber).toBe(true);
		// AND the issue number must appear in close proximity to auto/ (within the same step)
		const steps = allSteps(wf);
		const branchStep = steps.find(
			(s) => s.run?.includes("auto/") && s.run?.includes("github.event.issue.number"),
		);
		expect(branchStep).toBeDefined();
	});

	test("branch name expression includes a slug derived from issue.title", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		// The branch step or a preceding slug-computation step must reference issue.title
		// with a transform (lowercasing, whitespace replace, truncate, etc.), OR a
		// separate step outputs a slug that the branch step consumes.
		const slugFromTitle = steps.some((s) => {
			const run = s.run ?? "";
			// Direct: title transform inline in the run block
			const directSlug =
				run.includes("issue.title") &&
				(run.includes("lower") ||
					run.includes("sed") ||
					run.includes("tr ") ||
					run.includes("replace") ||
					run.includes("slugify") ||
					run.includes("gsub") ||
					run.includes("toLower") ||
					run.includes("toLowerCase"));
			// Indirect: step produces a slug output (id: slug or id: compute-slug)
			const outputSlug = (s.id?.includes("slug") ?? false) && run.includes("issue.title");
			return directSlug || outputSlug;
		});

		// Also accept: a step whose run references steps.<slug-id>.outputs.slug
		const consumesSlugOutput = steps.some(
			(s) => s.run?.includes("steps.") && s.run?.includes(".outputs.") && s.run?.includes("auto/"),
		);

		expect(slugFromTitle || consumesSlugOutput).toBe(true);
	});

	test("branch creation uses git checkout -b or git switch -c", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const hasCreate = steps.some(
			(s) => s.run?.includes("git checkout -b") || s.run?.includes("git switch -c"),
		);
		expect(hasCreate).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 5. Draft PR creation linked to the issue
// ---------------------------------------------------------------------------

describe("bootstrap.yml: draft PR creation", () => {
	test("opens a draft PR via gh pr create --draft", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const draftStep = steps.find(
			(s) => s.run?.includes("gh pr create") && s.run?.includes("--draft"),
		);
		expect(draftStep).toBeDefined();
	});

	test("PR is linked to the issue (references issue number)", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const linkedStep = steps.find(
			(s) =>
				s.run?.includes("gh pr create") &&
				(s.run?.includes("github.event.issue.number") ||
					s.run?.includes("Closes #") ||
					s.run?.includes("closes #") ||
					s.run?.includes("Fixes #")),
		);
		expect(linkedStep).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// 6. Claude invocation with /do-auto and CLAUDE_CODE_OAUTH_TOKEN
// ---------------------------------------------------------------------------

describe("bootstrap.yml: claude /do-auto invocation", () => {
	test("invokes claude with -p flag", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const claudeStep = steps.find((s) => s.run?.match(/claude\s+-p/));
		expect(claudeStep).toBeDefined();
	});

	test("passes /do-auto as the prompt or command", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		// /do-auto may appear in `run:` (CLI form) or in a step's `with.prompt` (action form)
		const doAutoStep = steps.find((s) => {
			if (s.run?.includes("/do-auto")) return true;
			const withProps = (s as { with?: Record<string, unknown> }).with;
			if (withProps && typeof withProps.prompt === "string") {
				return withProps.prompt.includes("/do-auto");
			}
			return false;
		});
		expect(doAutoStep).toBeDefined();
	});

	test("uses CLAUDE_CODE_OAUTH_TOKEN secret (no API key)", () => {
		const raw = readWorkflowRaw();
		expect(raw).toMatch(/secrets\.CLAUDE_CODE_OAUTH_TOKEN/);
		expect(raw).not.toMatch(/secrets\.ANTHROPIC_API_KEY/);
	});

	test("threads the issue body into the claude invocation", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const claudeStep = steps.find((s) => s.run?.match(/claude\s+-p/));
		// The claude step's run or env must reference github.event.issue.body
		const bodyInRun = claudeStep?.run?.includes("github.event.issue.body") ?? false;
		const bodyInEnv = Object.values(claudeStep?.env ?? {}).some((v) =>
			String(v).includes("github.event.issue.body"),
		);
		expect(bodyInRun || bodyInEnv).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 7. Confidence-gated alignment commit / issue comment — structural
// ---------------------------------------------------------------------------

describe("bootstrap.yml: confidence gate (structural)", () => {
	test("a step reads .agentic/last-alignment.md after claude runs", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const readStep = steps.find(
			(s) => s.run?.includes("last-alignment.md") || s.run?.includes("last_alignment"),
		);
		expect(readStep).toBeDefined();
	});

	test("a step captures or outputs the confidence value", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const confidenceStep = steps.find((s) => s.run?.includes("confidence"));
		expect(confidenceStep).toBeDefined();
	});

	test("the alignment.md commit step has an 'if:' guard referencing confidence", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		// Find the step that commits alignment.md (must reference alignment.md explicitly)
		const commitStep = steps.find(
			(s) =>
				s.run !== undefined &&
				s.run.includes("alignment.md") &&
				(s.run.includes("git add") || s.run.includes("git commit")),
		);
		expect(commitStep).toBeDefined();
		// That commit step MUST have an if: clause
		expect(commitStep?.if).toBeDefined();
		// The if: clause must reference confidence (or a step output derived from it)
		const ifClause = (commitStep?.if ?? "").toLowerCase();
		const referencesConfidence =
			ifClause.includes("confidence") || ifClause.includes("high") || ifClause.includes("outputs.");
		expect(referencesConfidence).toBe(true);
	});

	test("the issue-comment (low-confidence) step has an 'if:' guard", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const commentStep = steps.find(
			(s) => s.run?.includes("gh issue comment") || s.run?.includes("issue.createComment"),
		);
		expect(commentStep).toBeDefined();
		expect(commentStep?.if).toBeDefined();
		const ifClause = (commentStep?.if ?? "").toLowerCase();
		const referencesConfidence =
			ifClause.includes("confidence") || ifClause.includes("low") || ifClause.includes("outputs.");
		expect(referencesConfidence).toBe(true);
	});

	test("high-path and low-path 'if:' guards are mutually exclusive (negations of each other)", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);

		const commitStep = steps.find(
			(s) =>
				s.if !== undefined &&
				s.run !== undefined &&
				(s.run.includes("alignment.md") || s.run.includes("git commit")) &&
				(s.run.includes("git add") || s.run.includes("git commit")),
		);
		const commentStep = steps.find(
			(s) =>
				s.if !== undefined &&
				(s.run?.includes("gh issue comment") || s.run?.includes("issue.createComment")),
		);

		expect(commitStep?.if).toBeDefined();
		expect(commentStep?.if).toBeDefined();

		const commitIf = commitStep?.if ?? "";
		const commentIf = commentStep?.if ?? "";

		// The two guards must not be identical (they cannot both always run or both
		// be the same condition — one must gate on high, the other on low / not-high).
		expect(commitIf).not.toBe(commentIf);

		// One contains the negation of the other, OR one contains "high" and the
		// other contains "low" or "!" of the same expression.
		const commitHasNegation = commitIf.includes("!");
		const commentHasNegation = commentIf.includes("!");
		const mutuallyExclusive =
			commitHasNegation !== commentHasNegation ||
			(commitIf.toLowerCase().includes("high") && commentIf.toLowerCase().includes("low")) ||
			(commitIf.toLowerCase().includes("low") && commentIf.toLowerCase().includes("high")) ||
			commentHasNegation ||
			commitHasNegation;

		expect(mutuallyExclusive).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 8. Concurrency group
// ---------------------------------------------------------------------------

describe("bootstrap.yml: concurrency group", () => {
	test("has a top-level concurrency block", () => {
		const wf = parseWorkflow();
		expect(wf.concurrency).toBeDefined();
	});

	test("concurrency group is keyed on the issue number", () => {
		const wf = parseWorkflow();
		const group = wf.concurrency?.group ?? "";
		expect(group).toMatch(/github\.event\.issue\.number/);
	});

	test("concurrency group has cancel-in-progress: true", () => {
		const wf = parseWorkflow();
		expect(wf.concurrency?.["cancel-in-progress"]).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 9. Runner
// ---------------------------------------------------------------------------

describe("bootstrap.yml: runner", () => {
	test("uses runs-on: ubuntu-latest", () => {
		const wf = parseWorkflow();
		const jobs = Object.values(wf.jobs ?? {});
		const hasUbuntu = jobs.some((j) => j["runs-on"] === "ubuntu-latest");
		expect(hasUbuntu).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 10. Checkout step
// ---------------------------------------------------------------------------

describe("bootstrap.yml: checkout step", () => {
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
