/**
 * Spec-awareness: check whether an active spec currently targets a given file path.
 * Used by enforce.ts to gate edits to protected paths.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function activeSpecTargetsFile(cwd: string, filePath: string): boolean {
	const activeDir = join(cwd, "specs", "active");
	if (!existsSync(activeDir)) return false;
	for (const slug of readdirSync(activeDir)) {
		if (slug.startsWith("_") || slug.startsWith(".")) continue;
		const proposal = join(activeDir, slug, "proposal.md");
		if (!existsSync(proposal)) continue;
		const body = readFileSync(proposal, "utf-8");
		if (body.includes(filePath)) return true;
	}
	return false;
}
