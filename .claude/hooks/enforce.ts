/**
 * Pre-tool-use enforcement: block writes/edits that violate repo invariants.
 *
 * Rules enforced here (deterministic, no LLM):
 *   - wrangler.toml requires an active spec targeting it
 *   - content/posts/*.mdx requires an active spec of kind:writeup targeting it
 *   - specs/archive/** is immutable
 *   - A spec's `gate:` path is frozen once `.gate-frozen` sentinel exists
 *     (spec 027-dual-agent-tdd — prevents the spec-implementer from editing
 *     tests the spec-judge has already approved)
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

function parseGatePaths(proposalBody: string): string[] {
	const singleMatch = proposalBody.match(/^gate:\s*(.+)$/m);
	if (singleMatch) {
		const val = singleMatch[1].trim();
		if (val.length > 0 && !val.startsWith("-")) return [val];
	}
	const multiMatch = proposalBody.match(/^gate:\s*\n((?:\s+-\s+.+\n?)+)/m);
	if (multiMatch) {
		return multiMatch[1]
			.split("\n")
			.map((l) => l.replace(/^\s*-\s+/, "").trim())
			.filter(Boolean);
	}
	return [];
}

/**
 * Returns the slug of the active spec whose gate is frozen AND matches
 * `filePath`, or null if no such spec exists. The spec's `.gate-frozen`
 * sentinel must exist in its folder for the freeze to be in effect.
 */
export function findFrozenGateForPath(
	cwd: string,
	filePath: string,
): { slug: string; gatePath: string } | null {
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
		const proposal = join(specDir, "proposal.md");
		const frozen = join(specDir, ".gate-frozen");
		if (!existsSync(proposal) || !existsSync(frozen)) continue;
		const body = readFileSync(proposal, "utf-8");
		for (const gatePath of parseGatePaths(body)) {
			if (gatePath === relTarget || gatePath === absTarget) {
				return { slug, gatePath };
			}
		}
	}
	return null;
}

function enforce(event: ToolEvent): void {
	const filePath = event.tool_input.file_path as string | undefined;
	if (!filePath) return;

	const frozen = findFrozenGateForPath(event.cwd, filePath);
	if (frozen) {
		block(
			event,
			`spec ${frozen.slug} gate is frozen; edits to ${frozen.gatePath} are not allowed until the spec is archived or specs/active/${frozen.slug}/.gate-frozen is manually removed.`,
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
