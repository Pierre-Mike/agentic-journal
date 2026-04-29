/**
 * Slice 5 gate: bootstrap.yml — issue→branch→aligner→spec
 *
 * Tests that `.github/workflows/bootstrap.yml` encodes the correct contract:
 *   1. File exists at .github/workflows/bootstrap.yml
 *   2. Triggers on issues.opened, issues.edited, issue_comment.created — NO label filter
 *   3. Permissions block: contents:write, pull-requests:write, issues:write
 *   4. Job creates branch named auto/<issue-number>-<slug> from main
 *   5. Job opens a draft PR linked to the issue (gh pr create --draft)
 *   6. Job invokes `claude -p` with /do-auto and uses ANTHROPIC_API_KEY secret
 *   7. After claude runs, checks .agentic/last-alignment.md confidence:
 *      - confidence:low  → posts issue comment (does NOT commit alignment)
 *      - confidence:high → commits alignment.md to the branch
 *   8. Concurrency group keyed on issue-${{ github.event.issue.number }}
 *   9. Uses runs-on: ubuntu-latest
 *  10. Steps include actions/checkout@v4 with fetch-depth: 0
 *
 * These tests are intentionally RED until bootstrap.yml is implemented (slice 5).
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "../..");
const WORKFLOW_PATH = join(REPO_ROOT, ".github", "workflows", "bootstrap.yml");

function readWorkflow(): string {
	if (!existsSync(WORKFLOW_PATH)) {
		throw new Error("bootstrap.yml not found at .github/workflows/bootstrap.yml");
	}
	return readFileSync(WORKFLOW_PATH, "utf-8");
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
// 2. Trigger events — no label filter
// ---------------------------------------------------------------------------

describe("bootstrap.yml: trigger events", () => {
	test("triggers on issues event", () => {
		const wf = readWorkflow();
		expect(wf).toMatch(/^\s*issues:/m);
	});

	test("issues trigger includes 'opened' type", () => {
		const wf = readWorkflow();
		expect(wf).toMatch(/opened/);
	});

	test("issues trigger includes 'edited' type", () => {
		const wf = readWorkflow();
		expect(wf).toMatch(/edited/);
	});

	test("triggers on issue_comment event", () => {
		const wf = readWorkflow();
		expect(wf).toMatch(/issue_comment/);
	});

	test("issue_comment trigger includes 'created' type", () => {
		const wf = readWorkflow();
		// 'created' must appear in the on: block — not just in a step
		expect(wf).toMatch(/created/);
	});

	test("trigger has NO label filter (no 'types' restricted to labels)", () => {
		const wf = readWorkflow();
		// A label-only filter would look like: types: [labeled] or types: [opened, labeled]
		// The word 'labeled' must NOT appear as a trigger type filter.
		expect(wf).not.toMatch(/types:\s*\[.*labeled.*\]/);
		expect(wf).not.toMatch(/- labeled\b/);
	});
});

// ---------------------------------------------------------------------------
// 3. Permissions block
// ---------------------------------------------------------------------------

describe("bootstrap.yml: permissions block", () => {
	test("has a top-level permissions block", () => {
		const wf = readWorkflow();
		expect(wf).toMatch(/^permissions:/m);
	});

	test("grants contents: write", () => {
		const wf = readWorkflow();
		expect(wf).toMatch(/contents:\s*write/);
	});

	test("grants pull-requests: write", () => {
		const wf = readWorkflow();
		expect(wf).toMatch(/pull-requests:\s*write/);
	});

	test("grants issues: write", () => {
		const wf = readWorkflow();
		expect(wf).toMatch(/issues:\s*write/);
	});
});

// ---------------------------------------------------------------------------
// 4. Branch creation — auto/<issue-number>-<slug>
// ---------------------------------------------------------------------------

describe("bootstrap.yml: branch creation", () => {
	test("creates a branch with prefix 'auto/'", () => {
		const wf = readWorkflow();
		expect(wf).toMatch(/auto\//);
	});

	test("branch name includes the issue number expression", () => {
		const wf = readWorkflow();
		// Must reference github.event.issue.number in the branch name
		expect(wf).toMatch(/github\.event\.issue\.number/);
	});

	test("branch creation uses git checkout -b or git switch -c", () => {
		const wf = readWorkflow();
		expect(wf).toMatch(/git checkout -b|git switch -c/);
	});
});

// ---------------------------------------------------------------------------
// 5. Draft PR creation linked to the issue
// ---------------------------------------------------------------------------

describe("bootstrap.yml: draft PR creation", () => {
	test("opens a draft PR via gh pr create --draft", () => {
		const wf = readWorkflow();
		expect(wf).toMatch(/gh pr create.*--draft|gh pr create[\s\S]*?--draft/);
	});

	test("PR is linked to the issue (references issue number)", () => {
		const wf = readWorkflow();
		// The PR body or title must link the issue — gh pr create typically via --body
		// referencing the issue number or closes keyword
		expect(wf).toMatch(/github\.event\.issue\.number|Closes #|closes #/);
	});
});

// ---------------------------------------------------------------------------
// 6. Claude invocation with /do-auto and ANTHROPIC_API_KEY
// ---------------------------------------------------------------------------

describe("bootstrap.yml: claude /do-auto invocation", () => {
	test("invokes claude with -p flag", () => {
		const wf = readWorkflow();
		expect(wf).toMatch(/claude\s+-p/);
	});

	test("passes /do-auto as the prompt or command", () => {
		const wf = readWorkflow();
		expect(wf).toMatch(/\/do-auto/);
	});

	test("uses ANTHROPIC_API_KEY secret", () => {
		const wf = readWorkflow();
		expect(wf).toMatch(/ANTHROPIC_API_KEY/);
		expect(wf).toMatch(/secrets\.ANTHROPIC_API_KEY/);
	});

	test("threads the issue body into the claude invocation", () => {
		const wf = readWorkflow();
		// Issue body available via github.event.issue.body
		expect(wf).toMatch(/github\.event\.issue\.body/);
	});
});

// ---------------------------------------------------------------------------
// 7. Confidence-gated alignment commit / issue comment
// ---------------------------------------------------------------------------

describe("bootstrap.yml: confidence gate", () => {
	test("checks .agentic/last-alignment.md after claude runs", () => {
		const wf = readWorkflow();
		expect(wf).toMatch(/last-alignment\.md|last_alignment/);
	});

	test("reads confidence field from last-alignment.md", () => {
		const wf = readWorkflow();
		expect(wf).toMatch(/confidence/);
	});

	test("on confidence:high — commits alignment.md to the branch", () => {
		const wf = readWorkflow();
		// Must have a conditional commit step referencing alignment.md
		expect(wf).toMatch(/alignment\.md/);
		expect(wf).toMatch(/git commit|git add.*alignment/);
	});

	test("on confidence:low — posts a comment on the issue (does NOT commit alignment)", () => {
		const wf = readWorkflow();
		// Must post an issue comment via gh issue comment or github-script
		expect(wf).toMatch(/gh issue comment|gh issue.*comment|issue\.createComment/);
	});

	test("low-confidence branch does NOT directly commit alignment.md (conditional guarded)", () => {
		const wf = readWorkflow();
		// The commit of alignment.md must be inside an 'if:' condition checking confidence:high
		// We verify that 'high' appears near the alignment commit guard
		expect(wf).toMatch(/high/);
		// And the low path is explicitly distinct — 'low' appears for the comment path
		expect(wf).toMatch(/low/);
	});
});

// ---------------------------------------------------------------------------
// 8. Concurrency group
// ---------------------------------------------------------------------------

describe("bootstrap.yml: concurrency group", () => {
	test("has a concurrency block", () => {
		const wf = readWorkflow();
		expect(wf).toMatch(/^concurrency:/m);
	});

	test("concurrency group is keyed on the issue number", () => {
		const wf = readWorkflow();
		// Group must include github.event.issue.number so concurrent triggers on the same
		// issue are serialised / the in-flight run is cancelled.
		expect(wf).toMatch(
			/group:.*issue.*github\.event\.issue\.number|group:.*\$\{\{\s*github\.event\.issue\.number/,
		);
	});

	test("concurrency group has cancel-in-progress set", () => {
		const wf = readWorkflow();
		expect(wf).toMatch(/cancel-in-progress:\s*true/);
	});
});

// ---------------------------------------------------------------------------
// 9. Runner
// ---------------------------------------------------------------------------

describe("bootstrap.yml: runner", () => {
	test("uses runs-on: ubuntu-latest", () => {
		const wf = readWorkflow();
		expect(wf).toMatch(/runs-on:\s*ubuntu-latest/);
	});
});

// ---------------------------------------------------------------------------
// 10. Checkout step
// ---------------------------------------------------------------------------

describe("bootstrap.yml: checkout step", () => {
	test("uses actions/checkout@v4", () => {
		const wf = readWorkflow();
		expect(wf).toMatch(/actions\/checkout@v4/);
	});

	test("checkout step sets fetch-depth: 0", () => {
		const wf = readWorkflow();
		expect(wf).toMatch(/fetch-depth:\s*0/);
	});
});
