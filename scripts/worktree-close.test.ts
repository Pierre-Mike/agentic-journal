/**
 * Colocated tests for `scripts/worktree-close.ts` (026).
 *
 * Two cases:
 *   1. Shape — reads the script source and asserts two structural
 *      landmarks:
 *        (a) `git worktree prune` runs before `listMergedSpecBranches()`
 *        (b) the `!existsSync(worktreePath)` branch is guarded by
 *            `isMerged(` and reaches `git branch -D` in that order
 *      Fast regression fence.
 *   2. Behavior — reproduces the zombie scenario with real git
 *      primitives: open a tmp worktree, make a throwaway commit,
 *      fast-forward main onto the branch so it's an ancestor,
 *      `rm -rf` the dir, spawn the script, assert exit 0 and branch
 *      gone. `afterAll` resets main and cleans up.
 */

import { afterAll, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const SCRIPT_PATH = "scripts/worktree-close.ts";
const WORKTREE_ROOT = ".agentic/worktrees";
// Absolute paths to THIS test's sibling scripts — so the behavior test
// spawns the working-tree versions under test, not whatever's on main.
const ABS_SCRIPT_PATH = resolve(dirname(import.meta.path), "worktree-close.ts");
const ABS_OPEN_SCRIPT_PATH = resolve(dirname(import.meta.path), "worktree-open.ts");

/**
 * Resolve the main repo root (the common git dir's parent). When this test
 * runs from a git worktree, `process.cwd()` is the worktree — but the
 * script under test refuses unless invoked against `main` in the main
 * working tree.
 */
function mainRepoRoot(): string {
	const res = Bun.spawnSync(["git", "rev-parse", "--git-common-dir"], {
		stdout: "pipe",
		stderr: "pipe",
	});
	const gitDir = new TextDecoder().decode(res.stdout).trim();
	const abs = gitDir.startsWith("/") ? gitDir : join(process.cwd(), gitDir);
	return abs.replace(/\/\.git\/?$/, "").replace(/\/\.git$/, "");
}

// --- shape case ---

test("prune runs before listMergedSpecBranches and dir-missing path reaches branch -D via isMerged", () => {
	const src = readFileSync(SCRIPT_PATH, "utf8");
	const pruneIdx = src.indexOf(`"git", "worktree", "prune"`);
	const listIdx = src.indexOf("listMergedSpecBranches");
	expect(pruneIdx).toBeGreaterThan(-1);
	expect(listIdx).toBeGreaterThan(pruneIdx);

	// The dir-missing branch must:
	//   - still be guarded by isMerged
	//   - reach `git branch -D` when the guard passes
	const noDirIdx = src.indexOf("!existsSync(worktreePath)");
	expect(noDirIdx).toBeGreaterThan(-1);
	const afterNoDir = src.slice(noDirIdx);
	const isMergedIdx = afterNoDir.indexOf("isMerged(");
	const branchDashDIdx = afterNoDir.indexOf(`"git", "branch", "-D"`);
	expect(isMergedIdx).toBeGreaterThan(-1);
	expect(branchDashDIdx).toBeGreaterThan(isMergedIdx);
});

// --- behavior case ---

const slug = `close-test-${randomBytes(4).toString("hex")}`;
const branch = `spec/${slug}`;
const repoRoot = mainRepoRoot();
const worktreePath = join(repoRoot, WORKTREE_ROOT, slug);
let savedMain = "";

afterAll(async () => {
	if (savedMain) {
		await Bun.spawn(["git", "reset", "--hard", savedMain], {
			cwd: repoRoot,
			stdout: "ignore",
			stderr: "ignore",
		}).exited;
	}
	await Bun.spawn(["git", "worktree", "prune"], {
		cwd: repoRoot,
		stdout: "ignore",
		stderr: "ignore",
	}).exited;
	await Bun.spawn(["git", "worktree", "remove", "--force", worktreePath], {
		cwd: repoRoot,
		stdout: "ignore",
		stderr: "ignore",
	}).exited;
	await Bun.spawn(["git", "branch", "-D", branch], {
		cwd: repoRoot,
		stdout: "ignore",
		stderr: "ignore",
	}).exited;
});

test("close auto-detect reconciles zombie branch (dir gone, branch merged)", async () => {
	// Save main ref for afterAll reset.
	const savedMainProc = Bun.spawn(["git", "rev-parse", "main"], {
		cwd: repoRoot,
		stdout: "pipe",
		stderr: "pipe",
	});
	savedMain = (await new Response(savedMainProc.stdout).text()).trim();
	expect(await savedMainProc.exited).toBe(0);

	// 1. Open a worktree for the tmp slug (spec 025 ensures deps installed).
	const openProc = Bun.spawn(["bun", ABS_OPEN_SCRIPT_PATH, slug], {
		cwd: repoRoot,
		stdout: "pipe",
		stderr: "pipe",
	});
	expect(await openProc.exited).toBe(0);
	expect(existsSync(worktreePath)).toBe(true);

	// 2. Empty commit on spec/<slug> via the worktree (sidesteps staging
	//    and any commit-signing file-scanning hooks).
	const commitProc = Bun.spawn(["git", "commit", "--allow-empty", "-m", "tmp: close-test marker"], {
		cwd: worktreePath,
		stdout: "ignore",
		stderr: "pipe",
	});
	expect(await commitProc.exited).toBe(0);

	// 3. Fast-forward merge the branch into main so it's an ancestor.
	//    `isMerged` will short-circuit on the local ancestry check — no
	//    `gh` call, no network.
	const mergeProc = Bun.spawn(["git", "merge", "--ff-only", branch], {
		cwd: repoRoot,
		stdout: "ignore",
		stderr: "pipe",
	});
	expect(await mergeProc.exited).toBe(0);

	// 4. Remove the worktree dir by hand — THE ZOMBIE.
	rmSync(worktreePath, { recursive: true, force: true });
	expect(existsSync(worktreePath)).toBe(false);

	// 5. Run worktree-close auto-detect.
	const closeProc = Bun.spawn(["bun", ABS_SCRIPT_PATH], {
		cwd: repoRoot,
		stdout: "pipe",
		stderr: "pipe",
	});
	const closeExit = await closeProc.exited;
	expect(closeExit).toBe(0);

	// 6. Assert branch gone.
	const branchList = Bun.spawn(["git", "branch", "--list", branch], {
		cwd: repoRoot,
		stdout: "pipe",
		stderr: "pipe",
	});
	const branchOut = (await new Response(branchList.stdout).text()).trim();
	await branchList.exited;
	expect(branchOut).toBe("");
}, 120_000);
