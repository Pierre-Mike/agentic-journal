/**
 * Colocated tests for `scripts/worktree-open.ts` (025).
 *
 * Two cases:
 *   1. Shape — reads the script source and asserts the three-landmark order
 *      (git worktree add → bun install --frozen-lockfile → success print).
 *      Fast regression fence.
 *   2. Behavior — spawns the script against a random tmp slug and asserts
 *      `node_modules/@astrojs/cloudflare/package.json` exists in the new
 *      worktree. Tears down the worktree and branch in afterAll.
 */

import { afterAll, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const SCRIPT_PATH = "scripts/worktree-open.ts";
const WORKTREE_ROOT = ".agentic/worktrees";
// Absolute path to THIS test's sibling script — so the behavior test spawns
// the working-tree version under test, not whatever's on main.
const ABS_SCRIPT_PATH = resolve(dirname(import.meta.path), "worktree-open.ts");

/**
 * Resolve the main repo root (the common git dir's parent). When this test
 * runs from a git worktree, `process.cwd()` is the worktree — but the
 * script under test refuses unless invoked against `main` in the main
 * working tree. `git rev-parse --path-format=absolute --git-common-dir`
 * gives us the `.git` dir of the main checkout; its parent is the repo
 * root.
 */
function mainRepoRoot(): string {
	const res = Bun.spawnSync(["git", "rev-parse", "--git-common-dir"], {
		stdout: "pipe",
		stderr: "pipe",
	});
	const gitDir = new TextDecoder().decode(res.stdout).trim();
	// gitDir may be relative or absolute. Normalize via dirname.
	const abs = gitDir.startsWith("/") ? gitDir : join(process.cwd(), gitDir);
	return abs.replace(/\/\.git\/?$/, "").replace(/\/\.git$/, "");
}

test("install step sits between git worktree add and success print", () => {
	const src = readFileSync(SCRIPT_PATH, "utf8");
	const addIdx = src.indexOf(`"git", "worktree", "add"`);
	const installIdx = src.indexOf(`"bun", "install", "--frozen-lockfile"`);
	const printIdx = src.indexOf("worktree ready at");
	expect(addIdx).toBeGreaterThan(-1);
	expect(installIdx).toBeGreaterThan(addIdx);
	expect(printIdx).toBeGreaterThan(installIdx);
});

// --- behavior case ---
const slug = `worktree-open-test-${randomBytes(4).toString("hex")}`;
const repoRoot = mainRepoRoot();
const worktreePath = join(repoRoot, WORKTREE_ROOT, slug);
const branch = `spec/${slug}`;

afterAll(async () => {
	try {
		await Bun.spawn(["git", "worktree", "remove", "--force", worktreePath], {
			cwd: repoRoot,
			stdout: "ignore",
			stderr: "ignore",
		}).exited;
	} catch {}
	try {
		await Bun.spawn(["git", "branch", "-D", branch], {
			cwd: repoRoot,
			stdout: "ignore",
			stderr: "ignore",
		}).exited;
	} catch {}
});

test("opens a worktree with populated node_modules", async () => {
	const proc = Bun.spawn(["bun", ABS_SCRIPT_PATH, slug], {
		cwd: repoRoot,
		stdout: "pipe",
		stderr: "pipe",
	});
	const exitCode = await proc.exited;
	expect(exitCode).toBe(0);
	const depMarker = join(worktreePath, "node_modules", "@astrojs", "cloudflare", "package.json");
	expect(existsSync(depMarker)).toBe(true);
}, 60_000);
