/**
 * Pre-tool-use enforcement: block writes/edits that violate repo invariants.
 *
 * Rules enforced here (deterministic, no LLM):
 *   - wrangler.toml requires an active spec targeting it
 *   - content/posts/*.mdx requires an active spec of kind:writeup targeting it
 *   - specs/archive/** is immutable
 *
 * Fail-closed discipline (spec 008-hook-fail-open):
 *   Claude Code only treats exit code 2 as "block"; any other non-zero exit
 *   (including the default 1 from an uncaught throw) is read as "hook ran
 *   fine, allow." To avoid silently allowing a tool call when this hook hits
 *   a bug, the entire body is wrapped in a catch-all that logs to stderr and
 *   calls `process.exit(2)`. Never `process.exit(1)` from a hook.
 */

import { activeSpecTargetsFile } from "./spec-guard";
import { block, type ToolEvent } from "./types";

function enforce(event: ToolEvent): void {
	const filePath = event.tool_input.file_path as string | undefined;
	if (!filePath) return;

	if (filePath.endsWith("wrangler.toml")) {
		if (!activeSpecTargetsFile(event.cwd, "wrangler.toml")) {
			block(
				"wrangler.toml is a protected file. Create an active spec that targets it before editing.",
			);
		}
		return;
	}

	if (filePath.includes("/content/posts/") && filePath.endsWith(".mdx")) {
		if (!activeSpecTargetsFile(event.cwd, filePath)) {
			block(
				`${filePath} is a post file. Create an active spec of kind:writeup that targets it before editing.`,
			);
		}
		return;
	}

	if (filePath.includes("/specs/archive/")) {
		block("Archived specs are immutable. Create a new spec that supersedes the previous one.");
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
