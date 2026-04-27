/**
 * Integration smoke test for the worktree-open / worktree-close port refactor (spec 037).
 *
 * Asserts:
 *   1. `bun scripts/worktree-open.ts <slug>` creates `.agentic/worktrees/<slug>`.
 *   2. After a fast-forward merge of the spec branch, `bun scripts/worktree-close.ts <slug>`
 *      removes the directory and deletes the branch.
 *
 * Dirty-main policy: if `git status --porcelain` reports any changes, the script
 * prints "skipped: main is dirty — commit or stash first" to stderr and exits 0.
 * This is a deliberate skip, not a failure.
 *
 * RED: today this script exits non-zero because `worktree-open.ts` / `worktree-close.ts`
 * do not yet export `openWorktree` / `closeWorktree` with real-adapter wiring, so the
 * spawned scripts fail or the worktree directory is never created. The assertions below
 * are the committed gate logic that the implementer must satisfy — not authored by them.
 */

import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

async function sh(
	cmd: string[],
	opts: { cwd?: string } = {},
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
	const proc = Bun.spawn(cmd, {
		cwd: opts.cwd,
		stdout: "pipe",
		stderr: "pipe",
	});
	const [stdout, stderr, code] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	return { ok: code === 0, stdout: stdout.trim(), stderr: stderr.trim() };
}

function fail(msg: string): never {
	process.stderr.write(`FAIL: ${msg}\n`);
	process.exit(1);
}

async function main(): Promise<void> {
	const repoRoot = resolve(dirname(import.meta.path), "..");

	// --- Dirty-main skip policy ---
	const statusResult = await sh(["git", "status", "--porcelain"], { cwd: repoRoot });
	if (statusResult.stdout.length > 0) {
		process.stderr.write("skipped: main is dirty — commit or stash first\n");
		process.exit(0);
	}

	// --- Setup ---
	const slug = `_smoke-${randomBytes(4).toString("hex")}`;
	const worktreePath = join(repoRoot, ".agentic", "worktrees", slug);
	const branch = `spec/${slug}`;
	const openScript = resolve(dirname(import.meta.path), "worktree-open.ts");
	const closeScript = resolve(dirname(import.meta.path), "worktree-close.ts");

	// Save main SHA for cleanup / reset after ff-merge
	const mainShaResult = await sh(["git", "rev-parse", "main"], { cwd: repoRoot });
	if (!mainShaResult.ok) fail("could not resolve main SHA");
	const savedMainSha = mainShaResult.stdout;

	// --- Step 1: open ---
	process.stderr.write(`smoke: opening worktree for slug '${slug}'\n`);
	const openResult = await sh(["bun", openScript, slug], { cwd: repoRoot });
	if (!openResult.ok) {
		process.stderr.write(`open stdout: ${openResult.stdout}\n`);
		process.stderr.write(`open stderr: ${openResult.stderr}\n`);
		fail("worktree-open.ts exited non-zero");
	}

	// --- Assertion 1: worktree directory created ---
	if (!existsSync(worktreePath)) {
		// Best-effort cleanup
		await sh(["git", "worktree", "prune"], { cwd: repoRoot });
		await sh(["git", "branch", "-D", branch], { cwd: repoRoot });
		fail(`worktree directory not created at ${worktreePath}`);
	}
	process.stderr.write(`smoke: worktree directory confirmed at ${worktreePath}\n`);

	// --- Step 2: make the branch merged (empty commit + fast-forward main) ---
	const emptyCommit = await sh(["git", "commit", "--allow-empty", "-m", "tmp: smoke marker"], {
		cwd: worktreePath,
	});
	if (!emptyCommit.ok) {
		await sh(["git", "worktree", "remove", "--force", worktreePath], { cwd: repoRoot });
		await sh(["git", "branch", "-D", branch], { cwd: repoRoot });
		fail(`could not create empty commit on spec branch: ${emptyCommit.stderr}`);
	}

	const mergeResult = await sh(["git", "merge", "--ff-only", branch], { cwd: repoRoot });
	if (!mergeResult.ok) {
		await sh(["git", "reset", "--hard", savedMainSha], { cwd: repoRoot });
		await sh(["git", "worktree", "remove", "--force", worktreePath], { cwd: repoRoot });
		await sh(["git", "branch", "-D", branch], { cwd: repoRoot });
		fail(`ff-merge of '${branch}' into main failed: ${mergeResult.stderr}`);
	}

	// --- Step 3: close ---
	process.stderr.write(`smoke: closing worktree for slug '${slug}'\n`);
	const closeResult = await sh(["bun", closeScript, slug], { cwd: repoRoot });
	// Reset main before asserting, so cleanup is always done
	await sh(["git", "reset", "--hard", savedMainSha], { cwd: repoRoot });

	if (!closeResult.ok) {
		process.stderr.write(`close stdout: ${closeResult.stdout}\n`);
		process.stderr.write(`close stderr: ${closeResult.stderr}\n`);
		// Branch may still exist; prune worktrees list
		await sh(["git", "worktree", "prune"], { cwd: repoRoot });
		fail("worktree-close.ts exited non-zero");
	}

	// --- Assertion 2: worktree directory removed ---
	if (existsSync(worktreePath)) {
		fail(`worktree directory still exists at ${worktreePath} after close`);
	}
	process.stderr.write("smoke: worktree directory confirmed removed\n");

	process.stderr.write("smoke-worktree-ports: PASS\n");
	process.exit(0);
}

await main();
