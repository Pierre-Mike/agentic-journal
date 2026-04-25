/**
 * Unit tests for the `closeWorktree` policy extracted from worktree-close.ts (spec 037).
 *
 * All git and fs operations are replaced by in-memory fakes — no Bun.spawn calls.
 *
 * RED: fails until closeWorktree is exported from worktree-close.ts with the
 * Process + Fs port injection signature.
 */

import { expect, test } from "bun:test";
// @ts-expect-error — closeWorktree does not exist yet (RED)
import { closeWorktree } from "./worktree-close";

// ---------------------------------------------------------------------------
// Fake adapters (test-local, not exported)
// ---------------------------------------------------------------------------

type FakeProcessScript = Record<string, { ok: boolean; stdout: string }>;

function fakeProcess(scripted: FakeProcessScript) {
	return {
		async run(
			cmd: readonly string[],
			_opts?: { cwd?: string },
		): Promise<{ ok: boolean; stdout: string }> {
			const key = cmd.join(" ");
			// biome-ignore lint/style/noNonNullAssertion: key membership asserted on prior line
			if (key in scripted) return scripted[key]!;
			// Default: succeed with empty output for unscripted calls
			return { ok: true, stdout: "" };
		},
	};
}

function fakeFs(opts: { existing?: string[] } = {}) {
	const existing = new Set(opts.existing ?? []);
	return {
		exists(path: string): boolean {
			return existing.has(path);
		},
	};
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REPO_ROOT = "/fake/repo";
const SLUG = "my-feature";
const WORKTREE_PATH = `${REPO_ROOT}/.agentic/worktrees/${SLUG}`;
const BRANCH = `spec/${SLUG}`;

// Scripted git helpers for common states
function mergedAncestorScript(): FakeProcessScript {
	// git branch --merged main lists the branch
	return {
		"git branch --merged main": { ok: true, stdout: `  main\n  ${BRANCH}` },
		"git status --porcelain": { ok: true, stdout: "" },
		[`git worktree remove ${WORKTREE_PATH}`]: { ok: true, stdout: "" },
		[`git branch -D ${BRANCH}`]: { ok: true, stdout: "" },
	};
}

function notMergedScript(): FakeProcessScript {
	return {
		"git branch --merged main": { ok: true, stdout: "  main" },
		// gh pr list returns no merged PR
		[`gh pr list --state merged --head ${BRANCH} --json number -q .[0].number`]: {
			ok: true,
			stdout: "",
		},
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("closeWorktree returns ok:false when worktree dir missing and branch not merged", async () => {
	const proc = fakeProcess({
		...notMergedScript(),
	});
	const fs = fakeFs(); // dir does not exist

	const result = await closeWorktree({ slug: SLUG, repoRoot: REPO_ROOT, proc, fs });

	expect(result.ok).toBe(false);
});

test("closeWorktree returns ok:false with reason /not merged/ when branch is not merged into main", async () => {
	const proc = fakeProcess({
		...notMergedScript(),
		"git status --porcelain": { ok: true, stdout: "" },
	});
	const fs = fakeFs({ existing: [WORKTREE_PATH] });

	const result = await closeWorktree({ slug: SLUG, repoRoot: REPO_ROOT, proc, fs });

	expect(result.ok).toBe(false);
	if (!result.ok) {
		expect(result.reason).toMatch(/not merged/i);
	}
});

test("closeWorktree returns ok:false with reason /uncommitted/ when worktree has dirty status", async () => {
	const proc = fakeProcess({
		"git branch --merged main": { ok: true, stdout: `  main\n  ${BRANCH}` },
		"git status --porcelain": { ok: true, stdout: " M dirty-file.ts" },
	});
	const fs = fakeFs({ existing: [WORKTREE_PATH] });

	const result = await closeWorktree({ slug: SLUG, repoRoot: REPO_ROOT, proc, fs });

	expect(result.ok).toBe(false);
	if (!result.ok) {
		expect(result.reason).toMatch(/uncommit/i);
	}
});

test("closeWorktree returns ok:true on happy path (worktree present, clean, branch merged)", async () => {
	const proc = fakeProcess(mergedAncestorScript());
	const fs = fakeFs({ existing: [WORKTREE_PATH] });

	const result = await closeWorktree({ slug: SLUG, repoRoot: REPO_ROOT, proc, fs });

	expect(result.ok).toBe(true);
});

test("closeWorktree reconciles zombie: dir missing + branch merged → deletes branch, returns ok:true", async () => {
	const proc = fakeProcess({
		"git branch --merged main": { ok: true, stdout: `  main\n  ${BRANCH}` },
		[`git branch -D ${BRANCH}`]: { ok: true, stdout: "" },
	});
	const fs = fakeFs(); // dir does not exist

	const result = await closeWorktree({ slug: SLUG, repoRoot: REPO_ROOT, proc, fs });

	expect(result.ok).toBe(true);
});
