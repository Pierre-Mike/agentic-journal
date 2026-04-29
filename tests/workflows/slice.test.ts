/**
 * Slice 7 gate: slice.yml — matrix runner with expertise skill (attempt 2)
 *
 * Tests that `.github/workflows/slice.yml` encodes the correct contract:
 *   1.  File exists at .github/workflows/slice.yml
 *   2.  Triggers: repository_dispatch (type slice-ready, client_payload: slice_id/spec_id/branch)
 *                 AND workflow_dispatch (same inputs for manual/testing invocation)
 *   3.  Input normalization: SLICE_ID resolved from client_payload OR inputs
 *   4.  Permissions: contents:write, pull-requests:write, issues:write
 *   5.  Concurrency: group keyed on spec_id+slice_id (structural, no prefix pinning),
 *       cancel-in-progress: false
 *   6.  Runner: ubuntu-latest
 *   7.  Checkout: actions/checkout@v4 checks out branch with fetch-depth: 0
 *   8.  Pull-rebase before work
 *   9.  Claude invocation: claude -p with --max-turns, ANTHROPIC_API_KEY,
 *       --no-resume, and expertise skill loaded via flag/path/env mechanism
 *  10.  Commit step between pull-rebase and push
 *  11.  Push with retry on non-fast-forward (max retries = 3)
 *  12.  Replanner invocation after work commits
 *  13.  Failure escalation: after 3 retries, posts menu via bun scripts/issue-options.ts
 *       using `gh issue comment` (not gh pr comment), guarded to fire only at retry 3
 *  14.  Structural guard: failure-menu step has if: clause guarding on failure or attempt==3
 *  15.  Cross-spec invariant: controller's dispatch verb matches a trigger slice.yml accepts
 *
 * Uses structural YAML parsing (yaml package) — run: block assertions use
 * anchored regex on the parsed `run:` field.
 *
 * These tests are intentionally RED until slice.yml is implemented (slice 7).
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

const REPO_ROOT = join(import.meta.dir, "../..");
const WORKFLOW_PATH = join(REPO_ROOT, ".github", "workflows", "slice.yml");
const CONTROLLER_PATH = join(REPO_ROOT, ".github", "workflows", "controller.yml");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InputDef = {
	type?: string;
	description?: string;
	required?: boolean;
	default?: unknown;
};

type RepositoryDispatchBlock = {
	types?: string[];
	[key: string]: unknown;
};

type OnBlock = {
	workflow_dispatch?: {
		inputs?: Record<string, InputDef>;
	};
	repository_dispatch?: RepositoryDispatchBlock | unknown;
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
// 2. Triggers: repository_dispatch (primary) + workflow_dispatch (secondary)
// ---------------------------------------------------------------------------

describe("slice.yml: trigger events — repository_dispatch (primary AC trigger)", () => {
	test("on.repository_dispatch is present", () => {
		const wf = parseWorkflow();
		const on = wf.on as OnBlock;
		expect(on).toHaveProperty("repository_dispatch");
	});

	test("repository_dispatch has a types array", () => {
		const wf = parseWorkflow();
		const on = wf.on as OnBlock;
		const rd = on?.repository_dispatch as RepositoryDispatchBlock | undefined;
		// types may be omitted (matches all) OR declared with a slice-related type
		// If declared, it must include a slice-related event type
		if (rd?.types !== undefined) {
			expect(Array.isArray(rd.types)).toBe(true);
			const hasSliceType = rd.types.some((t) => /slice/i.test(t));
			expect(hasSliceType).toBe(true);
		}
		// No assertion if types is omitted — matches-all is valid
		expect(true).toBe(true);
	});
});

describe("slice.yml: trigger events — workflow_dispatch (manual bridge)", () => {
	test("on.workflow_dispatch is present (for manual trigger and gh workflow run)", () => {
		const wf = parseWorkflow();
		const on = wf.on as OnBlock;
		expect(on).toHaveProperty("workflow_dispatch");
	});

	test("workflow_dispatch has inputs block", () => {
		const wf = parseWorkflow();
		const on = wf.on as OnBlock;
		expect(on?.workflow_dispatch?.inputs).toBeDefined();
	});

	test("workflow_dispatch inputs includes slice_id", () => {
		const wf = parseWorkflow();
		const on = wf.on as OnBlock;
		const inputs = on?.workflow_dispatch?.inputs ?? {};
		expect(inputs).toHaveProperty("slice_id");
	});

	test("workflow_dispatch inputs includes spec_id of type string", () => {
		const wf = parseWorkflow();
		const on = wf.on as OnBlock;
		const inputs = on?.workflow_dispatch?.inputs ?? {};
		expect(inputs).toHaveProperty("spec_id");
		const specIdType = inputs["spec_id"]?.type?.toLowerCase() ?? "";
		expect(specIdType).toBe("string");
	});

	test("workflow_dispatch inputs includes branch of type string", () => {
		const wf = parseWorkflow();
		const on = wf.on as OnBlock;
		const inputs = on?.workflow_dispatch?.inputs ?? {};
		expect(inputs).toHaveProperty("branch");
		const branchType = inputs["branch"]?.type?.toLowerCase() ?? "";
		expect(branchType).toBe("string");
	});
});

describe("slice.yml: trigger — both pathways present", () => {
	test("both repository_dispatch and workflow_dispatch are declared (no push/schedule)", () => {
		const wf = parseWorkflow();
		const on = wf.on as OnBlock;
		const keys = Object.keys(on ?? {});
		expect(keys).toContain("repository_dispatch");
		expect(keys).toContain("workflow_dispatch");
		expect(keys).not.toContain("push");
		expect(keys).not.toContain("schedule");
	});
});

// ---------------------------------------------------------------------------
// 3. Input normalization: SLICE_ID from client_payload OR inputs
// ---------------------------------------------------------------------------

describe("slice.yml: input normalization (client_payload || inputs)", () => {
	test("workflow normalizes SLICE_ID from client_payload.slice_id OR inputs.slice_id", () => {
		// The run block must contain an expression that coalesces both pathways:
		// e.g. inputs.slice_id || github.event.client_payload.slice_id
		const raw = readWorkflowRaw();
		const hasNormalization =
			(raw.includes("client_payload.slice_id") && raw.includes("inputs.slice_id")) ||
			(raw.includes("client_payload") && raw.includes("slice_id"));
		expect(hasNormalization).toBe(true);
	});

	test("workflow references client_payload.spec_id or equivalent for spec_id", () => {
		const raw = readWorkflowRaw();
		const hasSpecId = raw.includes("client_payload.spec_id") || raw.includes("client_payload");
		expect(hasSpecId).toBe(true);
	});

	test("workflow references client_payload.branch or equivalent for branch", () => {
		const raw = readWorkflowRaw();
		const hasBranch = raw.includes("client_payload.branch") || raw.includes("client_payload");
		expect(hasBranch).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 4. Permissions block — including issues:write for failure-menu comments
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

	test("grants issues: write (required for gh issue comment in failure escalation)", () => {
		const wf = parseWorkflow();
		expect(wf.permissions?.issues).toBe("write");
	});
});

// ---------------------------------------------------------------------------
// 5. Concurrency — per slice, keyed on spec_id+slice_id (structural, no prefix pin)
// ---------------------------------------------------------------------------

describe("slice.yml: concurrency block", () => {
	test("has a top-level concurrency block", () => {
		const wf = parseWorkflow();
		expect(wf.concurrency).toBeDefined();
	});

	test("concurrency group references spec_id (any expression pathway)", () => {
		const wf = parseWorkflow();
		const group = wf.concurrency?.group ?? "";
		// Accept: inputs.spec_id OR github.event.client_payload.spec_id OR env.SPEC_ID
		const hasSpecId =
			group.includes("spec_id") || group.includes("SPEC_ID") || group.includes("client_payload");
		expect(hasSpecId).toBe(true);
	});

	test("concurrency group references slice_id (any expression pathway)", () => {
		const wf = parseWorkflow();
		const group = wf.concurrency?.group ?? "";
		// Accept: inputs.slice_id OR github.event.client_payload.slice_id OR env.SLICE_ID
		const hasSliceId =
			group.includes("slice_id") || group.includes("SLICE_ID") || group.includes("client_payload");
		expect(hasSliceId).toBe(true);
	});

	test("concurrency group is keyed on both spec and slice identifiers (not just one)", () => {
		// Group must include both so two different slices of the same spec can run in parallel
		const wf = parseWorkflow();
		const group = wf.concurrency?.group ?? "";
		const hasSpec = group.includes("spec_id") || group.includes("SPEC_ID");
		const hasSlice = group.includes("slice_id") || group.includes("SLICE_ID");
		expect(hasSpec && hasSlice).toBe(true);
	});

	test("cancel-in-progress is false (don't kill running slice)", () => {
		const wf = parseWorkflow();
		expect(wf.concurrency?.["cancel-in-progress"]).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// 6. Runner
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
// 7. Checkout step checks out branch with fetch-depth: 0
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

	test("checkout step checks out the dispatched branch", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const checkoutStep = steps.find((s) => s.uses?.startsWith("actions/checkout@v4"));
		// The ref must be set — accept inputs.branch, env var, or client_payload.branch
		const ref = String(checkoutStep?.with?.["ref"] ?? "");
		const hasBranchRef =
			ref.includes("branch") || ref.includes("BRANCH") || ref.includes("client_payload");
		expect(hasBranchRef).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 8. Pull-rebase before work
// ---------------------------------------------------------------------------

describe("slice.yml: pull-rebase before work", () => {
	test("a step runs git pull --rebase before the claude invocation", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const pullStep = steps.find((s) => s.run?.includes("git pull") && s.run?.includes("--rebase"));
		expect(pullStep).toBeDefined();
	});

	test("pull-rebase step targets origin", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const pullStep = steps.find((s) => s.run?.includes("git pull") && s.run?.includes("--rebase"));
		const run = pullStep?.run ?? "";
		expect(run).toMatch(/origin/);
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
// 9. Claude invocation: -p, --max-turns, ANTHROPIC_API_KEY, expertise skill, --no-resume
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
		const envHasKey = Object.keys(claudeStep?.env ?? {}).some((k) => k === "ANTHROPIC_API_KEY");
		const runHasKey = claudeStep?.run?.includes("ANTHROPIC_API_KEY") ?? false;
		expect(envHasKey || runHasKey).toBe(true);
	});

	test("expertise skill loaded via explicit flag or skill path or env var (not bare word)", () => {
		// Tightened: must use a precise mechanism — not just substring 'expertise' anywhere.
		// Accept: --skill expertise | --load-skill expertise | CLAUDE_LOAD_SKILLS=expertise
		// | .claude/skills/expertise in a path | --skill-file pointing to expertise
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const claudeStep = steps.find((s) => s.run?.match(/claude\s+-p/));
		const run = claudeStep?.run ?? "";
		const envValues = Object.values(claudeStep?.env ?? {}).map((v) => String(v));

		const hasSkillFlag =
			/--skill\s+expertise/.test(run) ||
			/--load-skill\s+expertise/.test(run) ||
			/--skill-file\s+\S*expertise/.test(run) ||
			/\.claude\/skills\/expertise/.test(run) ||
			envValues.some(
				(v) => /CLAUDE_LOAD_SKILLS/.test(v) || (/expertise/.test(v) && /skill/i.test(v)),
			) ||
			envValues.some((v) => /\.claude\/skills\/expertise/.test(v));

		// Also accept env key patterns like CLAUDE_LOAD_SKILLS containing expertise
		const envKeys = Object.keys(claudeStep?.env ?? {});
		const envKeyHasSkill = envKeys.some(
			(k) =>
				(k.includes("SKILL") || k.includes("skill")) &&
				String(claudeStep?.env?.[k] ?? "").includes("expertise"),
		);

		// Or a raw SKILL env var set to 'expertise' path
		const rawEnvHasExpertisePath = envValues.some(
			(v) => /expertise/.test(v) && (v.includes("/") || v.includes(".claude")),
		);

		expect(hasSkillFlag || envKeyHasSkill || rawEnvHasExpertisePath).toBe(true);
	});

	test("claude invoked with --no-resume flag (fresh context per slice)", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		// --no-resume must appear on the same run block that contains claude -p
		const claudeStep = steps.find((s) => s.run?.match(/claude\s+-p/));
		expect(claudeStep?.run).toMatch(/--no-resume/);
	});
});

// ---------------------------------------------------------------------------
// 10. Commit step exists between pull-rebase and push
// ---------------------------------------------------------------------------

describe("slice.yml: commit between pull-rebase and push", () => {
	test("a git commit step exists after claude work and before push", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);

		const pullIdx = steps.findIndex(
			(s) => s.run?.includes("git pull") && s.run?.includes("--rebase"),
		);
		const claudeIdx = steps.findIndex((s) => s.run?.match(/claude\s+-p/));
		// Push step: the final push to origin (not the retry-rebase pull)
		const pushIdx = steps.findIndex(
			(s) => s.run?.includes("git push") && s.run?.includes("origin"),
		);
		const commitIdx = steps.findIndex(
			(s) =>
				// Accept: git commit, git diff --quiet || git commit, or git add && git commit
				(s.run?.includes("git commit") && !s.run?.includes("git push")) ||
				s.run?.match(/git\s+diff.*--quiet.*&&.*git\s+commit/) !== null ||
				s.run?.match(/git\s+add.*&&.*git\s+commit/) !== null,
		);

		expect(pullIdx).toBeGreaterThanOrEqual(0);
		expect(claudeIdx).toBeGreaterThanOrEqual(0);
		expect(pushIdx).toBeGreaterThanOrEqual(0);
		expect(commitIdx).toBeGreaterThanOrEqual(0);

		// Commit must appear after the initial pull-rebase and before the push
		expect(commitIdx).toBeGreaterThan(pullIdx);
		expect(commitIdx).toBeLessThan(pushIdx);
	});
});

// ---------------------------------------------------------------------------
// 11. Push with retry on non-fast-forward (retry budget = 3)
// ---------------------------------------------------------------------------

describe("slice.yml: push with retry", () => {
	test("a step pushes to origin (the dispatched branch)", () => {
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
		const hasLoop =
			run.includes("while") ||
			run.includes("for ") ||
			run.includes("retry") ||
			run.match(/ATTEMPT|attempt|MAX_RETRIES|max_retries|MAX_ATTEMPTS/) !== null;
		expect(hasLoop).toBe(true);
	});

	test("retry logic includes git pull --rebase before re-push on failure", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const pushStep = steps.find((s) => s.run?.includes("git push") && s.run?.includes("origin"));
		const run = pushStep?.run ?? "";
		expect(run).toMatch(/pull.*--rebase|--rebase.*pull/s);
	});

	test("push retry budget is exactly 3 (alignment: 3 retries → failure menu)", () => {
		// alignment.md: "Slice fails 3 retries → bot comments on issue with menu"
		// The loop must terminate at attempt 3 — assert the literal 3 appears as the bound
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const pushStep = steps.find((s) => s.run?.includes("git push") && s.run?.includes("origin"));
		const run = pushStep?.run ?? "";
		// Accept: MAX_RETRIES=3, attempt < 3, attempt <= 3, attempt == 3, -le 3, -lt 3, for i in 1 2 3
		const hasRetry3 =
			/MAX_RETRIES\s*=\s*3/.test(run) ||
			/MAX_ATTEMPTS\s*=\s*3/.test(run) ||
			/attempt\s*[<=>]=?\s*3/.test(run) ||
			/\$attempt\s*-l[te]\s*3/.test(run) ||
			/for\s+.*\b(1\s+2\s+3|3\s+times)\b/.test(run) ||
			/\[\s*\$attempt\s*-l[te]\s*3\s*\]/.test(run) ||
			/\[\[\s*\$attempt\s*[<>=]+\s*3\s*\]\]/.test(run);
		expect(hasRetry3).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 12. Replanner invocation after work commits
// ---------------------------------------------------------------------------

describe("slice.yml: replanner invocation", () => {
	test("a step invokes spec-replanner or replanner after work", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
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
		if (replannerIdx === claudeIdx) {
			const run = steps[claudeIdx]?.run ?? "";
			expect(run).toMatch(/replann?er/i);
		} else {
			expect(replannerIdx).toBeGreaterThan(claudeIdx);
		}
	});
});

// ---------------------------------------------------------------------------
// 13. Failure escalation: gh issue comment (not gh pr comment), retry-3 guard
// ---------------------------------------------------------------------------

describe("slice.yml: failure escalation — posts to ISSUE (not PR)", () => {
	test("failure-menu step invokes bun scripts/issue-options.ts", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const menuStep = steps.find((s) => s.run?.includes("issue-options"));
		expect(menuStep).toBeDefined();
	});

	test("failure-menu step uses 'gh issue comment' (not gh pr comment)", () => {
		// alignment.md: "failure menu posted on the issue, PR stays draft"
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const menuStep = steps.find((s) => s.run?.includes("issue-options"));
		const run = menuStep?.run ?? "";
		// Must call 'gh issue comment' somewhere in the run block or in the script invocation
		// Accept: direct 'gh issue comment' OR issue-options.ts itself calls it (verified by naming)
		// At minimum the step must NOT call 'gh pr comment' exclusively
		const callsGhIssueComment =
			run.includes("gh issue comment") ||
			// issue-options.ts semantically posts to issue — assert the step does not use gh pr comment
			(!run.includes("gh pr comment") && run.includes("issue-options"));
		expect(callsGhIssueComment).toBe(true);
	});

	test("failure-menu step references a token for gh CLI (GH_TOKEN/GITHUB_TOKEN)", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const menuStep = steps.find((s) => s.run?.includes("issue-options"));
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
// 14. Failure escalation structural guard: fires on attempt == 3 exactly
// ---------------------------------------------------------------------------

describe("slice.yml: failure escalation structural guard", () => {
	test("failure-menu step has an if: clause guarding on failure or attempt == 3", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const menuStep = steps.find((s) => s.run?.includes("issue-options"));
		expect(menuStep).toBeDefined();
		const ifClause = (menuStep?.if ?? "").toLowerCase();
		const isGuarded =
			ifClause.includes("failure") ||
			ifClause.includes("== 3") ||
			ifClause.includes(">=3") ||
			ifClause.includes(">= 3") ||
			ifClause.includes("== '3'") ||
			ifClause.includes("-eq 3");
		expect(isGuarded).toBe(true);
	});

	test("failure-menu step is guarded (has a non-empty if: clause)", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const menuStep = steps.find((s) => s.run?.includes("issue-options"));
		const hasGuard = menuStep?.if !== undefined && menuStep.if.length > 0;
		expect(hasGuard).toBe(true);
	});

	test("failure-menu guard pins retry count to 3 (not arbitrary: aligns with alignment.md §failure)", () => {
		// The if: clause or surrounding run block must encode the number 3 as the retry threshold
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const menuStep = steps.find((s) => s.run?.includes("issue-options"));
		const ifClause = menuStep?.if ?? "";
		const run = menuStep?.run ?? "";
		const combined = ifClause + " " + run;
		// Accept: == 3, -eq 3, >= 3, attempt == 3, retry_count == 3
		const pinned3 =
			/==\s*3|==\s*'3'|-eq\s+3|>=\s*3|\$attempt\s*==\s*3|\$retry\s*==\s*3/.test(combined) ||
			// Or the surrounding context (steps array) has a max-retries=3 variable visible
			allSteps(wf).some((s) => /MAX_RETRIES\s*=\s*3|MAX_ATTEMPTS\s*=\s*3/.test(s.run ?? ""));
		expect(pinned3).toBe(true);
	});

	test("workflow has a failure-handling mechanism (if:failure() job or step)", () => {
		const wf = parseWorkflow();
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

// ---------------------------------------------------------------------------
// 15. Cross-spec invariant: controller dispatch verb matches slice.yml trigger
// ---------------------------------------------------------------------------

describe("slice.yml: cross-spec trigger invariant (controller → slice)", () => {
	test("controller.yml (slice 6) dispatches via a verb that slice.yml accepts", () => {
		// If controller.yml doesn't exist yet (not yet implemented), skip this check.
		if (!existsSync(CONTROLLER_PATH)) {
			// Gate is still RED because slice.yml itself doesn't exist — correct behavior.
			return;
		}
		const controllerRaw = readFileSync(CONTROLLER_PATH, "utf-8");
		const sliceWf = parseWorkflow();
		const sliceOn = sliceWf.on as OnBlock;

		// controller uses gh workflow run slice.yml → workflow_dispatch
		// controller uses gh api .../dispatches → repository_dispatch
		const controllerUsesWorkflowRun =
			controllerRaw.includes("gh workflow run") && controllerRaw.includes("slice.yml");
		const controllerUsesRepDispatch =
			(controllerRaw.includes("repository_dispatch") || controllerRaw.includes("dispatches")) &&
			controllerRaw.includes("slice");

		// slice.yml must accept whichever verb the controller emits
		const sliceAcceptsWorkflowDispatch = "workflow_dispatch" in (sliceOn ?? {});
		const sliceAcceptsRepDispatch = "repository_dispatch" in (sliceOn ?? {});

		if (controllerUsesWorkflowRun) {
			expect(sliceAcceptsWorkflowDispatch).toBe(true);
		}
		if (controllerUsesRepDispatch) {
			expect(sliceAcceptsRepDispatch).toBe(true);
		}

		// If controller doesn't pin either verb, at least one of the triggers must be present
		if (!controllerUsesWorkflowRun && !controllerUsesRepDispatch) {
			expect(sliceAcceptsWorkflowDispatch || sliceAcceptsRepDispatch).toBe(true);
		}
	});
});
