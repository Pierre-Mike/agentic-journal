/**
 * Pre-tool-use enforcement: block writes/edits that violate repo invariants.
 *
 * Rules enforced here (deterministic, no LLM):
 *   - wrangler.toml requires an active spec targeting it
 *   - content/posts/*.mdx requires an active spec of kind:writeup targeting it
 *   - specs/archive/** is immutable
 *   - A spec's per-task gate path is frozen once `.gate-frozen-N` sentinel
 *     exists for that slice (spec 039-slice-red-tdd — prevents the
 *     spec-implementer from editing tests the spec-judge has already approved)
 *   - Bare `.gate-frozen` is inert — never created, never checked after
 *     spec 039 migration.
 *
 * Fail-closed discipline (spec 008-hook-fail-open):
 *   Claude Code only treats exit code 2 as "block"; any other non-zero exit
 *   (including the default 1 from an uncaught throw) is read as "hook ran
 *   fine, allow." To avoid silently allowing a tool call when this hook hits
 *   a bug, the entire body is wrapped in a catch-all that logs to stderr and
 *   calls `process.exit(2)`. Never `process.exit(1)` from a hook.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { activeSpecTargetsFile } from "./spec-guard";
import { block, type ToolEvent } from "./types";

function findRepoRoot(filePath: string, fallback: string): string {
	let dir = dirname(resolve(filePath));
	while (true) {
		if (existsSync(join(dir, ".git"))) return dir;
		const parent = dirname(dir);
		if (parent === dir) return fallback;
		dir = parent;
	}
}

function parseTaskGatePaths(tasksBody: string): string[] {
	const paths: string[] = [];
	const lines = tasksBody.split("\n");
	for (const line of lines) {
		const m = line.match(/^\s+-\s+gate:\s*(.+)$/);
		if (m) {
			const p = (m[1] ?? "").trim();
			if (p) paths.push(p);
		}
	}
	return paths;
}

/**
 * Finds the active spec whose per-task gate path matches `filePath` AND whose
 * corresponding `.gate-frozen-N` sentinel exists. Returns the match with slice
 * ordinal and sentinel path, or null if no frozen slice matches.
 *
 * Bare `.gate-frozen` (without ordinal) is inert — never checked.
 */
export function findSliceForPath(
	cwd: string,
	filePath: string,
): { slug: string; gatePath: string; ordinal: number; sentinelPath: string } | null {
	const repoRoot = findRepoRoot(filePath, cwd);
	const activeDir = join(repoRoot, "specs", "active");
	if (!existsSync(activeDir)) return null;
	const absTarget = isAbsolute(filePath) ? filePath : resolve(repoRoot, filePath);
	const relTarget = absTarget.startsWith(`${repoRoot}/`)
		? absTarget.slice(repoRoot.length + 1)
		: absTarget;

	for (const slug of readdirSync(activeDir)) {
		if (slug.startsWith("_") || slug.startsWith(".")) continue;
		const specDir = join(activeDir, slug);
		const tasksPath = join(specDir, "tasks.md");
		if (!existsSync(tasksPath)) continue;

		const tasksBody = readFileSync(tasksPath, "utf-8");
		const gatePaths = parseTaskGatePaths(tasksBody);

		for (let i = 0; i < gatePaths.length; i++) {
			const gp = gatePaths[i];
			if (!gp) continue;
			if (gp !== relTarget && gp !== absTarget) continue;
			const ordinal = i + 1;
			const sentinelName = `.gate-frozen-${ordinal}`;
			const sentinelPath = join(specDir, sentinelName);
			if (existsSync(sentinelPath)) {
				return { slug, gatePath: gp, ordinal, sentinelPath };
			}
		}
	}
	return null;
}

function enforce(event: ToolEvent): void {
	const filePath = event.tool_input.file_path as string | undefined;
	if (!filePath) return;

	const frozenSlice = findSliceForPath(event.cwd, filePath);
	if (frozenSlice) {
		block(
			event,
			`spec ${frozenSlice.slug} slice ${frozenSlice.ordinal} gate is frozen; edits to ${frozenSlice.gatePath} are not allowed until the spec is archived or ${frozenSlice.sentinelPath} is manually removed.`,
			filePath,
		);
	}

	if (filePath.endsWith("wrangler.toml")) {
		if (!activeSpecTargetsFile(event.cwd, "wrangler.toml")) {
			block(
				event,
				"wrangler.toml is a protected file. Create an active spec that targets it before editing.",
				filePath,
			);
		}
		return;
	}

	if (filePath.includes("/content/posts/") && filePath.endsWith(".mdx")) {
		if (!activeSpecTargetsFile(event.cwd, filePath)) {
			block(
				event,
				`${filePath} is a post file. Create an active spec of kind:writeup that targets it before editing.`,
				filePath,
			);
		}
		return;
	}

	if (filePath.includes("/specs/archive/")) {
		block(
			event,
			"Archived specs are immutable. Create a new spec that supersedes the previous one.",
			filePath,
		);
	}
}

export function enforcePreToolUse(event: ToolEvent): void {
	try {
		enforce(event);
	} catch (err) {
		const reason = err instanceof Error ? err.message : String(err);
		console.error(`enforcePreToolUse failed closed: ${reason}`);
		process.exit(2);
	}
}
