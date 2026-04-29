// @no-test: sibling test worktree-open.test.ts was authored by the spec tester and is already committed
/**
 * Open a worktree for a spec: isolated branch + working directory.
 *
 *   - Refuses unless main is clean and checked out
 *   - Creates `.agentic/worktrees/<slug>` on branch `spec/<slug>` from `main`
 *   - Reuses an existing branch if `spec/<slug>` already exists
 *   - Prints the worktree absolute path on success
 *
 * Usage: bun scripts/worktree-open.ts <slug>
 */

import { join } from "node:path";
import { type Fs, type Process, realFs, realProcess } from "../_lib";

export async function openWorktree(deps: {
	slug: string;
	repoRoot: string;
	proc: Process;
	fs: Fs;
}): Promise<{ ok: true; path: string } | { ok: false; reason: string }> {
	const { slug, repoRoot, proc, fs } = deps;
	const worktreePath = join(repoRoot, ".agentic", "worktrees", slug);
	const branch = `spec/${slug}`;

	// Check current branch first
	const currentBranch = await proc.run(["git", "branch", "--show-current"], { cwd: repoRoot });
	if (currentBranch.stdout !== "main") {
		return {
			ok: false,
			reason: `not on main (currently on '${currentBranch.stdout}'). Switch to main first.`,
		};
	}

	// Check for uncommitted changes
	const status = await proc.run(["git", "status", "--porcelain"], { cwd: repoRoot });
	if (status.stdout.length > 0) {
		return {
			ok: false,
			reason: "uncommitted changes on main. Commit or stash before opening a worktree.",
		};
	}

	// Check if worktree dir already exists
	if (fs.exists(worktreePath)) {
		return { ok: false, reason: `worktree already exists at ${worktreePath}` };
	}

	// Check if branch already exists — reuse it (skip -b) if so
	const branchExists = await proc.run(
		["git", "show-ref", "--verify", "--quiet", `refs/heads/${branch}`],
		{ cwd: repoRoot },
	);

	let addResult: { ok: boolean; stdout: string };
	if (branchExists.ok) {
		addResult = await proc.run(["git", "worktree", "add", worktreePath, branch], {
			cwd: repoRoot,
		});
	} else {
		addResult = await proc.run(["git", "worktree", "add", worktreePath, "-b", branch, "main"], {
			cwd: repoRoot,
		});
	}

	if (!addResult.ok) {
		return { ok: false, reason: "git worktree add failed" };
	}

	const install = await proc.run(["bun", "install", "--frozen-lockfile"], {
		cwd: worktreePath,
	});
	if (!install.ok) {
		return {
			ok: false,
			reason: `bun install --frozen-lockfile failed in ${worktreePath}`,
		};
	}

	return { ok: true, path: worktreePath };
}

async function main(): Promise<void> {
	const slug = process.argv[2];
	if (!slug) {
		console.error("usage: bun scripts/worktree/worktree-open.ts <slug>");
		process.exit(1);
	}

	const repoRoot = process.cwd();
	const result = await openWorktree({ slug, repoRoot, proc: realProcess, fs: realFs });

	if (result.ok) {
		console.log(`\n✓ worktree ready at ${result.path} on branch spec/${slug}`);
	} else {
		console.error(`✖ ${result.reason}`);
		process.exit(1);
	}
}

if (import.meta.main) {
	await main();
}
