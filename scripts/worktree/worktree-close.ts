// @no-test: sibling test worktree-close.test.ts was authored by the spec tester and is already committed
/**
 * Close one or more worktrees whose spec branches have been merged into main.
 *
 * Two modes:
 *   - `bun scripts/worktree-close.ts`         — auto-detect all merged spec/* branches, close each
 *   - `bun scripts/worktree-close.ts <slug>`  — close exactly one (refuses if not merged)
 *
 * In both modes:
 *   - Refuses if the worktree has uncommitted changes
 *   - Refuses if the branch is not yet merged into main
 *   - Removes the worktree directory and deletes the local branch
 */

import { join } from "node:path";
import { type Fs, type Process, realFs, realProcess } from "../_lib";

async function isMergedWith(branch: string, repoRoot: string, proc: Process): Promise<boolean> {
	const ancestry = await proc.run(["git", "branch", "--merged", "main"], { cwd: repoRoot });
	const ancestorBranches = ancestry.stdout.split("\n").map((b) => b.trim().replace(/^\*\s*/, ""));
	if (ancestorBranches.includes(branch)) return true;

	const pr = await proc.run(
		[
			"gh",
			"pr",
			"list",
			"--state",
			"merged",
			"--head",
			branch,
			"--json",
			"number",
			"-q",
			".[0].number",
		],
		{ cwd: repoRoot },
	);
	return pr.ok && pr.stdout.length > 0;
}

export async function closeWorktree(deps: {
	slug: string;
	repoRoot: string;
	proc: Process;
	fs: Fs;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
	const { slug, repoRoot, proc, fs } = deps;
	const worktreePath = join(repoRoot, ".agentic", "worktrees", slug);
	const branch = `spec/${slug}`;

	if (!fs.exists(worktreePath)) {
		// Zombie reconcile: dir gone but branch may still exist.
		// If merged, delete the branch. If not merged, refuse.
		if (await isMergedWith(branch, repoRoot, proc)) {
			const del = await proc.run(["git", "branch", "-D", branch], { cwd: repoRoot });
			if (!del.ok) {
				return { ok: false, reason: `branch '${branch}' deletion failed` };
			}
			return { ok: true };
		}
		return {
			ok: false,
			reason: `no worktree at ${worktreePath} and branch '${branch}' not merged`,
		};
	}

	// Check for uncommitted changes inside the worktree
	const status = await proc.run(["git", "status", "--porcelain"], { cwd: worktreePath });
	if (status.stdout.length > 0) {
		return { ok: false, reason: "worktree has uncommitted changes" };
	}

	if (!(await isMergedWith(branch, repoRoot, proc))) {
		return { ok: false, reason: `branch '${branch}' not merged into main` };
	}

	const removeResult = await proc.run(["git", "worktree", "remove", worktreePath], {
		cwd: repoRoot,
	});
	if (!removeResult.ok) {
		return { ok: false, reason: "git worktree remove failed" };
	}

	// -D (force) because squash/rebase merges leave the local branch non-ancestor
	// of main even though the PR is merged. isMergedWith() already verified that.
	const deleteBranch = await proc.run(["git", "branch", "-D", branch], { cwd: repoRoot });
	if (!deleteBranch.ok) {
		return {
			ok: false,
			reason: `worktree removed but branch '${branch}' deletion failed`,
		};
	}

	return { ok: true };
}

async function listSpecBranches(proc: Process, repoRoot: string): Promise<string[]> {
	const all = await proc.run(["git", "branch", "--list", "spec/*", "--format=%(refname:short)"], {
		cwd: repoRoot,
	});
	return all.stdout
		.split("\n")
		.map((b) => b.trim())
		.filter(Boolean);
}

async function listMergedSpecBranches(proc: Process, repoRoot: string): Promise<string[]> {
	const specs = await listSpecBranches(proc, repoRoot);
	const results = await Promise.all(
		specs.map(async (b) => ((await isMergedWith(b, repoRoot, proc)) ? b : null)),
	);
	return results.filter((b): b is string => b !== null);
}

async function main(): Promise<void> {
	const repoRoot = process.cwd();
	const arg = process.argv[2];
	const proc = realProcess;
	const fs = realFs;

	// Reconcile stale .git/worktrees/* admin dirs before any listing
	await proc.run(["git", "worktree", "prune"], { cwd: repoRoot });

	if (arg) {
		// Single-slug strict mode
		const result = await closeWorktree({ slug: arg, repoRoot, proc, fs });
		if (result.ok) {
			console.log(`✓ closed spec/${arg}`);
		} else {
			console.error(`✖ ${result.reason}`);
			process.exit(1);
		}
		return;
	}

	// Auto-detect mode: close every merged spec branch
	const mergedSpecs = await listMergedSpecBranches(proc, repoRoot);
	if (mergedSpecs.length === 0) {
		console.log("no merged spec branches to close.");
		return;
	}

	console.log(`found ${mergedSpecs.length} merged spec branch(es):\n`);
	let anyFail = false;
	for (const branch of mergedSpecs) {
		const slug = branch.replace(/^spec\//, "");
		const result = await closeWorktree({ slug, repoRoot, proc, fs });
		if (result.ok) {
			console.log(`  ✓ ${branch}`);
		} else {
			console.log(`  ✖ ${branch} — ${result.reason}`);
			anyFail = true;
		}
	}
	if (anyFail) process.exit(1);
}

if (import.meta.main) {
	await main();
}
