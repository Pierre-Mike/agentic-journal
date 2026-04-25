/**
 * Integration smoke test for the worktree-open / worktree-close port refactor (spec 037).
 *
 * RED stub — exits 1 until openWorktree and closeWorktree are wired with real adapters.
 *
 * When GREEN this script will:
 *   1. Check main is clean (skip gracefully if not).
 *   2. Spawn `bun scripts/worktree-open.ts <slug>` with a random _smoke-<rand> slug.
 *   3. Assert the worktree directory is created.
 *   4. Fast-forward merge the branch so worktree-close accepts it.
 *   5. Spawn `bun scripts/worktree-close.ts <slug>`.
 *   6. Assert the worktree directory is gone.
 *   7. Exit 0.
 */

process.stderr.write("RED — smoke-worktree-ports not yet implemented (spec 037)\n");
process.exit(1);
