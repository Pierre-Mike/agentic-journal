/**
 * Gate for .github/workflows/spec.yml — alignment.md → scaffold + outer gate
 *
 * Asserts the contract:
 *  1. File exists at .github/workflows/spec.yml
 *  2. Triggers on push to auto/** when specs/active/**\/alignment.md changes
 *  3. Permissions: contents:write, pull-requests:write, issues:write
 *  4. Concurrency keyed on github.ref
 *  5. Idempotent: skips if proposal.md already exists in the spec dir
 *  6. Verifies confidence:high before scaffolding
 *  7. Invokes claude -p with --allowedTools (Write/Edit/Bash needed for scaffold)
 *  8. Commits scaffold artifacts (proposal/design/tasks/outer gate)
 *  9. Posts success/failure comment back to the linked issue
 * 10. runs-on: ubuntu-latest
 * 11. checkout@v4 with fetch-depth: 0
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

const REPO_ROOT = join(import.meta.dir, "../..");
const WORKFLOW_PATH = join(REPO_ROOT, ".github", "workflows", "spec.yml");

type Step = {
	name?: string;
	uses?: string;
	run?: string;
	if?: string;
	with?: Record<string, unknown>;
	env?: Record<string, string>;
	id?: string;
};

type WorkflowDoc = {
	on?: Record<string, unknown>;
	permissions?: Record<string, string>;
	concurrency?: { group?: string; "cancel-in-progress"?: boolean };
	jobs?: Record<string, { steps?: Step[]; "runs-on"?: string }>;
};

function readWorkflowRaw(): string {
	if (!existsSync(WORKFLOW_PATH)) {
		throw new Error("spec.yml not found at .github/workflows/spec.yml");
	}
	return readFileSync(WORKFLOW_PATH, "utf-8");
}

function parseWorkflow(): WorkflowDoc {
	return parseYaml(readWorkflowRaw()) as WorkflowDoc;
}

function allSteps(wf: WorkflowDoc): Step[] {
	return Object.values(wf.jobs ?? {}).flatMap((job) => job.steps ?? []);
}

describe("spec.yml: file existence", () => {
	test("exists at .github/workflows/spec.yml", () => {
		expect(existsSync(WORKFLOW_PATH)).toBe(true);
	});
});

describe("spec.yml: triggers", () => {
	test("triggers on push to auto/** branches", () => {
		const wf = parseWorkflow();
		const on = wf.on as Record<string, { branches?: string[]; paths?: string[] }>;
		const branches = on?.push?.branches ?? [];
		expect(branches.some((b) => b.startsWith("auto/"))).toBe(true);
	});

	test("scopes the push trigger to specs/active/**\\/alignment.md", () => {
		const wf = parseWorkflow();
		const on = wf.on as Record<string, { paths?: string[] }>;
		const paths = on?.push?.paths ?? [];
		expect(paths.some((p) => p.includes("alignment.md"))).toBe(true);
	});

	test("supports workflow_dispatch with a branch input", () => {
		const wf = parseWorkflow();
		const on = wf.on as Record<string, { inputs?: Record<string, unknown> }>;
		expect(on).toHaveProperty("workflow_dispatch");
		expect(on?.workflow_dispatch?.inputs).toHaveProperty("branch");
	});
});

describe("spec.yml: permissions", () => {
	test("grants contents: write", () => {
		expect(parseWorkflow().permissions?.contents).toBe("write");
	});
	test("grants pull-requests: write", () => {
		expect(parseWorkflow().permissions?.["pull-requests"]).toBe("write");
	});
	test("grants issues: write", () => {
		expect(parseWorkflow().permissions?.issues).toBe("write");
	});
});

describe("spec.yml: concurrency", () => {
	test("concurrency group keyed on github.ref", () => {
		const wf = parseWorkflow();
		expect(wf.concurrency?.group ?? "").toContain("github.ref");
	});

	test("cancel-in-progress is false (don't kill a running scaffold)", () => {
		const wf = parseWorkflow();
		expect(wf.concurrency?.["cancel-in-progress"]).toBe(false);
	});
});

describe("spec.yml: idempotency + confidence verification", () => {
	test("a step checks alignment.md exists and confidence:high", () => {
		const raw = readWorkflowRaw();
		expect(raw).toMatch(/confidence:/);
		expect(raw).toMatch(/high/);
		expect(raw).toMatch(/alignment\.md/);
	});

	test("a step skips when proposal.md already exists in the spec dir", () => {
		const raw = readWorkflowRaw();
		expect(raw).toMatch(/proposal\.md/);
		expect(raw).toMatch(/skip/);
	});
});

describe("spec.yml: claude scaffold invocation", () => {
	test("invokes claude with -p flag", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const claudeStep = steps.find((s) => s.run?.match(/claude\s+-p/));
		expect(claudeStep).toBeDefined();
	});

	test("passes --allowedTools to claude (Write + Edit + Bash needed for scaffold)", () => {
		const raw = readWorkflowRaw();
		expect(raw).toMatch(/--allowedTools/);
		expect(raw).toMatch(/Write/);
		expect(raw).toMatch(/Edit/);
	});

	test("uses CLAUDE_CODE_OAUTH_TOKEN secret (no API key)", () => {
		const raw = readWorkflowRaw();
		expect(raw).toMatch(/secrets\.CLAUDE_CODE_OAUTH_TOKEN/);
		expect(raw).not.toMatch(/secrets\.ANTHROPIC_API_KEY/);
	});

	test("references the spec-tester role in the prompt", () => {
		const raw = readWorkflowRaw();
		expect(raw).toMatch(/spec-tester/);
	});
});

describe("spec.yml: commit + comment", () => {
	test("a step commits scaffold artifacts", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const commitStep = steps.find(
			(s) => s.run?.includes("git commit") && s.run?.includes("scaffold"),
		);
		expect(commitStep).toBeDefined();
	});

	test("posts a success comment to the linked issue", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const successStep = steps.find(
			(s) => s.run?.includes("gh issue comment") && (s.if?.includes("success") ?? false),
		);
		expect(successStep).toBeDefined();
	});

	test("posts a failure comment to the linked issue on failure", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const failureStep = steps.find(
			(s) => s.run?.includes("gh issue comment") && (s.if?.includes("failure") ?? false),
		);
		expect(failureStep).toBeDefined();
	});
});

describe("spec.yml: runner + checkout", () => {
	test("runs on ubuntu-latest", () => {
		const wf = parseWorkflow();
		const job = Object.values(wf.jobs ?? {})[0];
		expect(job?.["runs-on"]).toBe("ubuntu-latest");
	});

	test("checkout@v4 with fetch-depth: 0", () => {
		const wf = parseWorkflow();
		const steps = allSteps(wf);
		const checkout = steps.find((s) => s.uses?.startsWith("actions/checkout@"));
		expect(checkout?.uses).toBe("actions/checkout@v4");
		expect(checkout?.with?.["fetch-depth"]).toBe(0);
	});
});
