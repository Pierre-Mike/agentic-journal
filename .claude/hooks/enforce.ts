/**
 * Pre-tool-use enforcement: block writes/edits that violate repo invariants.
 *
 * Rules enforced here (deterministic, no LLM):
 *   - wrangler.toml requires an active spec targeting it
 *   - content/posts/*.mdx requires an active spec of kind:writeup targeting it
 *   - specs/archive/** is immutable
 */

import { activeSpecTargetsFile } from "./spec-guard";
import { block, type ToolEvent } from "./types";

export function enforcePreToolUse(event: ToolEvent): void {
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
