/**
 * RED-spec commit gate (016).
 *
 * Pure helper + tiny CLI used by the lefthook pre-commit `typecheck` step to
 * decide whether to skip typecheck. We skip when the staged commit subject
 * matches `^spec\(\d+\): RED\b` — the documented RED-state authoring commit
 * format. All other subjects fall through and run typecheck as before.
 *
 *   shouldSkipTypecheck({ commitSubject }) — pure boolean.
 *   readCommitSubject() — resolves `.git/COMMIT_EDITMSG` via
 *     `git rev-parse --git-dir`; returns the first line trimmed at the right
 *     edge only (preserves leading whitespace so the regex's `^` anchor is
 *     meaningful), or `null` if the file is missing.
 *
 * CLI: `bun scripts/red-commit-gate.ts` — exits 0 when the staged subject is
 * RED (i.e. "skip typecheck"), exits 1 otherwise. The lefthook command runs
 * `bun run typecheck` only when this exits non-zero.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const RED_RE = /^spec\(\d+\): RED\b/;

export function shouldSkipTypecheck({
	commitSubject,
}: {
	readonly commitSubject: string;
}): boolean {
	return RED_RE.test(commitSubject);
}

export function readCommitSubject(): string | null {
	const proc = Bun.spawnSync(["git", "rev-parse", "--git-dir"], {
		stdout: "pipe",
		stderr: "pipe",
	});
	if (proc.exitCode !== 0) return null;
	const gitDir = new TextDecoder().decode(proc.stdout).trim();
	if (gitDir.length === 0) return null;
	const path = join(gitDir, "COMMIT_EDITMSG");
	if (!existsSync(path)) return null;
	const text = readFileSync(path, "utf-8");
	const firstLine = text.split("\n")[0] ?? "";
	return firstLine.replace(/\s+$/, "");
}

function main(): void {
	const subject = readCommitSubject();
	if (subject === null) {
		process.exit(1);
	}
	process.exit(shouldSkipTypecheck({ commitSubject: subject }) ? 0 : 1);
}

if (import.meta.main) {
	main();
}
