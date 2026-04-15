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

import { existsSync } from "node:fs";
import { join } from "node:path";

async function sh(
	cmd: string[],
	opts: { silent?: boolean; cwd?: string } = {},
): Promise<{ ok: boolean; out: string }> {
	const proc = Bun.spawn(cmd, {
		stdout: opts.silent ? "pipe" : "inherit",
		stderr: opts.silent ? "pipe" : "inherit",
		cwd: opts.cwd,
	});
	const out = opts.silent ? await new Response(proc.stdout).text() : "";
	return { ok: (await proc.exited) === 0, out: out.trim() };
}

async function listMergedSpecBranches(): Promise<string[]> {
	const merged = await sh(["git", "branch", "--merged", "main"], { silent: true });
	return merged.out
		.split("\n")
		.map((b) => b.trim().replace(/^\*\s*/, ""))
		.filter((b) => b.startsWith("spec/"));
}

async function closeOne(slug: string, repoRoot: string): Promise<{ ok: boolean; reason?: string }> {
	const worktreePath = join(repoRoot, ".agentic", "worktrees", slug);
	const branch = `spec/${slug}`;

	if (!existsSync(worktreePath)) {
		return { ok: false, reason: `no worktree at ${worktreePath}` };
	}

	const status = await sh(["git", "status", "--porcelain"], {
		silent: true,
		cwd: worktreePath,
	});
	if (status.out.length > 0) {
		return { ok: false, reason: "worktree has uncommitted changes" };
	}

	const merged = await sh(["git", "branch", "--merged", "main"], { silent: true });
	const mergedBranches = merged.out.split("\n").map((b) => b.trim().replace(/^\*\s*/, ""));
	if (!mergedBranches.includes(branch)) {
		return { ok: false, reason: `branch '${branch}' not merged into main` };
	}

	const removeResult = await sh(["git", "worktree", "remove", worktreePath]);
	if (!removeResult.ok) {
		return { ok: false, reason: "git worktree remove failed" };
	}

	const deleteBranch = await sh(["git", "branch", "-d", branch]);
	if (!deleteBranch.ok) {
		return { ok: false, reason: `worktree removed but branch '${branch}' deletion failed` };
	}

	return { ok: true };
}

async function main(): Promise<void> {
	const repoRoot = process.cwd();
	const arg = process.argv[2];

	if (arg) {
		// Single-slug strict mode
		const result = await closeOne(arg, repoRoot);
		if (result.ok) {
			console.log(`✓ closed spec/${arg}`);
		} else {
			console.error(`✖ ${result.reason}`);
			process.exit(1);
		}
		return;
	}

	// Auto-detect mode: close every merged spec branch
	const mergedSpecs = await listMergedSpecBranches();
	if (mergedSpecs.length === 0) {
		console.log("no merged spec branches to close.");
		return;
	}

	console.log(`found ${mergedSpecs.length} merged spec branch(es):\n`);
	let anyFail = false;
	for (const branch of mergedSpecs) {
		const slug = branch.replace(/^spec\//, "");
		const result = await closeOne(slug, repoRoot);
		if (result.ok) {
			console.log(`  ✓ ${branch}`);
		} else {
			console.log(`  ✖ ${branch} — ${result.reason}`);
			anyFail = true;
		}
	}
	if (anyFail) process.exit(1);
}

await main();
