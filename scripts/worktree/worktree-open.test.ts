/**
 * Unit tests for the `openWorktree` policy extracted from worktree-open.ts (spec 037).
 *
 * All git and fs operations are replaced by in-memory fakes — no Bun.spawn calls.
 *
 * RED: fails until openWorktree is exported from worktree-open.ts with the
 * Process + Fs port injection signature.
 */

import { expect, test } from "bun:test";
import { openWorktree } from "./worktree-open";

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("openWorktree returns ok:false with reason /not on main/ when not on main branch", async () => {
	const proc = fakeProcess({
		"git status --porcelain": { ok: true, stdout: "" },
		"git branch --show-current": { ok: true, stdout: "some-other-branch" },
	});
	const fs = fakeFs();

	const result = await openWorktree({ slug: SLUG, repoRoot: REPO_ROOT, proc, fs });

	expect(result.ok).toBe(false);
	if (!result.ok) {
		expect(result.reason).toMatch(/not on main/i);
	}
});

test("openWorktree returns ok:false with reason /uncommit/ when there are uncommitted changes", async () => {
	const proc = fakeProcess({
		"git status --porcelain": { ok: true, stdout: " M some-file.ts" },
		"git branch --show-current": { ok: true, stdout: "main" },
	});
	const fs = fakeFs();

	const result = await openWorktree({ slug: SLUG, repoRoot: REPO_ROOT, proc, fs });

	expect(result.ok).toBe(false);
	if (!result.ok) {
		expect(result.reason).toMatch(/uncommit/i);
	}
});

test("openWorktree returns ok:false with reason /already exists/ when worktree dir exists", async () => {
	const proc = fakeProcess({
		"git status --porcelain": { ok: true, stdout: "" },
		"git branch --show-current": { ok: true, stdout: "main" },
	});
	const fs = fakeFs({ existing: [WORKTREE_PATH] });

	const result = await openWorktree({ slug: SLUG, repoRoot: REPO_ROOT, proc, fs });

	expect(result.ok).toBe(false);
	if (!result.ok) {
		expect(result.reason).toMatch(/already exists/i);
	}
});

test("openWorktree returns ok:true with path on happy path (fresh branch, clean main)", async () => {
	const proc = fakeProcess({
		"git status --porcelain": { ok: true, stdout: "" },
		"git branch --show-current": { ok: true, stdout: "main" },
		[`git show-ref --verify --quiet refs/heads/${BRANCH}`]: { ok: false, stdout: "" },
		[`git worktree add ${WORKTREE_PATH} -b ${BRANCH} main`]: { ok: true, stdout: "" },
		"bun install --frozen-lockfile": { ok: true, stdout: "" },
	});
	const fs = fakeFs();

	const result = await openWorktree({ slug: SLUG, repoRoot: REPO_ROOT, proc, fs });

	expect(result.ok).toBe(true);
	if (result.ok) {
		expect(result.path).toBe(WORKTREE_PATH);
	}
});

test("openWorktree reuses existing branch (skips -b flag) when branch already exists", async () => {
	const proc = fakeProcess({
		"git status --porcelain": { ok: true, stdout: "" },
		"git branch --show-current": { ok: true, stdout: "main" },
		[`git show-ref --verify --quiet refs/heads/${BRANCH}`]: { ok: true, stdout: "" },
		[`git worktree add ${WORKTREE_PATH} ${BRANCH}`]: { ok: true, stdout: "" },
		"bun install --frozen-lockfile": { ok: true, stdout: "" },
	});
	const fs = fakeFs();

	const result = await openWorktree({ slug: SLUG, repoRoot: REPO_ROOT, proc, fs });

	expect(result.ok).toBe(true);
	if (result.ok) {
		expect(result.path).toBe(WORKTREE_PATH);
	}
});
