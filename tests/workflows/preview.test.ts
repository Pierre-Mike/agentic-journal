/**
 * Slice 8 gate: preview.yml — wrangler + playwright + outer BDD gate
 *
 * Tests that `.github/workflows/preview.yml` encodes the correct contract:
 *   1. File exists
 *   2. Triggers on pull_request (opened, synchronize, reopened)
 *   3. Has a permissions block: contents:read, pull-requests:write, deployments:write
 *   4. Deploys via wrangler versions upload with CLOUDFLARE_API_TOKEN secret
 *   5. Captures preview URL into a step output
 *   6. Posts preview URL as a PR comment
 *   7. Runs playwright --base-url=$PREVIEW_URL against the preview deployment
 *   8. Runs the outer BDD gate (automation-pipeline.test.ts) on every push
 *
 * These tests are intentionally RED until preview.yml is implemented (slice 8).
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "../..");
const WORKFLOW_PATH = join(REPO_ROOT, ".github", "workflows", "preview.yml");

function readWorkflow(): string {
	if (!existsSync(WORKFLOW_PATH)) {
		throw new Error("preview.yml not found at .github/workflows/preview.yml");
	}
	return readFileSync(WORKFLOW_PATH, "utf-8");
}

// ---------------------------------------------------------------------------
// 1. File existence
// ---------------------------------------------------------------------------

describe("preview.yml: file existence", () => {
	test("exists at .github/workflows/preview.yml", () => {
		expect(existsSync(WORKFLOW_PATH)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 2. Trigger events
// ---------------------------------------------------------------------------

describe("preview.yml: trigger events", () => {
	test("triggers on pull_request event", () => {
		const wf = readWorkflow();
		expect(wf).toMatch(/pull_request/);
	});

	test("pull_request trigger includes 'opened' event type", () => {
		const wf = readWorkflow();
		expect(wf).toMatch(/opened/);
	});

	test("pull_request trigger includes 'synchronize' event type", () => {
		const wf = readWorkflow();
		expect(wf).toMatch(/synchronize/);
	});

	test("pull_request trigger includes 'reopened' event type", () => {
		const wf = readWorkflow();
		expect(wf).toMatch(/reopened/);
	});
});

// ---------------------------------------------------------------------------
// 3. Permissions block
// ---------------------------------------------------------------------------

describe("preview.yml: permissions block", () => {
	test("has a top-level permissions block", () => {
		const wf = readWorkflow();
		expect(wf).toMatch(/^permissions:/m);
	});

	test("grants contents: read", () => {
		const wf = readWorkflow();
		expect(wf).toMatch(/contents:\s*read/);
	});

	test("grants pull-requests: write", () => {
		const wf = readWorkflow();
		expect(wf).toMatch(/pull-requests:\s*write/);
	});

	test("grants deployments: write", () => {
		const wf = readWorkflow();
		expect(wf).toMatch(/deployments:\s*write/);
	});
});

// ---------------------------------------------------------------------------
// 4. Wrangler deploy with CLOUDFLARE_API_TOKEN
// ---------------------------------------------------------------------------

describe("preview.yml: wrangler deploy", () => {
	test("uses wrangler versions upload or cloudflare/wrangler-action", () => {
		const wf = readWorkflow();
		expect(wf).toMatch(/wrangler.*versions.*upload|cloudflare\/wrangler-action/);
	});

	test("passes CLOUDFLARE_API_TOKEN secret to the deploy step", () => {
		const wf = readWorkflow();
		expect(wf).toMatch(/CLOUDFLARE_API_TOKEN/);
		expect(wf).toMatch(/secrets\.CLOUDFLARE_API_TOKEN/);
	});
});

// ---------------------------------------------------------------------------
// 5. Capture preview URL as step output
// ---------------------------------------------------------------------------

describe("preview.yml: preview URL step output", () => {
	test("captures preview URL into a step output (deployment-url or similar)", () => {
		const wf = readWorkflow();
		// Must write to GITHUB_OUTPUT or declare an output referencing the preview URL
		expect(wf).toMatch(
			/GITHUB_OUTPUT|steps\.\w+\.outputs\.(deployment.url|preview.url|preview_url)/,
		);
	});

	test("step output is referenced later in the workflow (not just written)", () => {
		const wf = readWorkflow();
		// At least one reference to steps.<id>.outputs.<url-key>
		expect(wf).toMatch(/steps\.\w+\.outputs\.\w*(url|URL)\w*/);
	});
});

// ---------------------------------------------------------------------------
// 6. Post preview URL as PR comment
// ---------------------------------------------------------------------------

describe("preview.yml: PR comment with preview URL", () => {
	test("posts a comment on the PR (uses gh pr comment or actions/github-script)", () => {
		const wf = readWorkflow();
		expect(wf).toMatch(/gh pr comment|github-script|create_comment|issue\.comment/);
	});

	test("comment body includes the preview URL variable", () => {
		const wf = readWorkflow();
		// The comment step must reference the captured URL
		expect(wf).toMatch(/PREVIEW_URL|preview.url|deployment.url/i);
	});
});

// ---------------------------------------------------------------------------
// 7. Playwright against preview URL
// ---------------------------------------------------------------------------

describe("preview.yml: playwright e2e against preview", () => {
	test("runs playwright in the workflow", () => {
		const wf = readWorkflow();
		expect(wf).toMatch(/playwright/);
	});

	test("passes --base-url or sets PLAYWRIGHT_BASE_URL from the preview URL", () => {
		const wf = readWorkflow();
		expect(wf).toMatch(/--base-url|PLAYWRIGHT_BASE_URL|BASE_URL/);
	});

	test("playwright step references the captured preview URL", () => {
		const wf = readWorkflow();
		// Must thread the URL through env or arg — not a hardcoded value
		expect(wf).toMatch(/PREVIEW_URL|steps\.\w+\.outputs\.\w*(url|URL)\w*/);
	});
});

// ---------------------------------------------------------------------------
// 8. Outer BDD gate (automation-pipeline.test.ts) on every push
// ---------------------------------------------------------------------------

describe("preview.yml: outer BDD gate run", () => {
	test("runs automation-pipeline.test.ts as a step", () => {
		const wf = readWorkflow();
		expect(wf).toMatch(/automation-pipeline\.test\.ts|automation.pipeline/);
	});

	test("outer gate step uses bun test", () => {
		const wf = readWorkflow();
		expect(wf).toMatch(/bun.*test|bun run.*test/);
	});

	test("outer gate step does NOT abort the workflow on failure (continue-on-error or similar)", () => {
		const wf = readWorkflow();
		// The gate is expected RED; it must not block the preview step
		expect(wf).toMatch(/continue-on-error:\s*true/);
	});
});
