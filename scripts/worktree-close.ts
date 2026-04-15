/**
 * Close a worktree after its PR has been merged. Deletes the worktree directory
 * and the local `spec/<slug>` branch if it is fully merged into main.
 *
 *   - Refuses if the worktree has uncommitted changes
 *   - Refuses if the branch is not yet merged into main
 *   - Prunes the worktree and deletes the branch
 *
 * Usage: bun scripts/worktree-close.ts <slug>
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

async function main(): Promise<void> {
	const slug = process.argv[2];
	if (!slug) {
		console.error("usage: bun scripts/worktree-close.ts <slug>");
		process.exit(1);
	}

	const repoRoot = process.cwd();
	const worktreePath = join(repoRoot, ".agentic", "worktrees", slug);
	const branch = `spec/${slug}`;

	if (!existsSync(worktreePath)) {
		console.error(`✖ no worktree at ${worktreePath}`);
		process.exit(1);
	}

	const status = await sh(["git", "status", "--porcelain"], { silent: true, cwd: worktreePath });
	if (status.out.length > 0) {
		console.error(`✖ worktree has uncommitted changes. Commit or discard before closing.`);
		process.exit(1);
	}

	const merged = await sh(["git", "branch", "--merged", "main"], { silent: true });
	const mergedBranches = merged.out.split("\n").map((b) => b.trim().replace(/^\*\s*/, ""));
	if (!mergedBranches.includes(branch)) {
		console.error(`✖ branch '${branch}' is not merged into main. Merge the PR first, then retry.`);
		process.exit(1);
	}

	const removeResult = await sh(["git", "worktree", "remove", worktreePath]);
	if (!removeResult.ok) {
		console.error("✖ git worktree remove failed");
		process.exit(1);
	}

	const deleteBranch = await sh(["git", "branch", "-d", branch]);
	if (!deleteBranch.ok) {
		console.error(
			`⚠ worktree removed but branch '${branch}' deletion failed (likely not fully merged).`,
		);
		process.exit(1);
	}

	console.log(`\n✓ worktree removed and branch '${branch}' deleted.`);
}

await main();
