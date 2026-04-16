/**
 * Post-tool-use verification: after a file is written/edited, run deterministic checks.
 *
 *   - Biome lint on recognised file types
 *   - Colocated-test presence warning for .ts files in src/
 */

import { existsSync } from "node:fs";
import { run, type ToolEvent } from "./types";

const LINTABLE = /\.(ts|tsx|js|jsx|astro|json|md|mdx)$/;

export async function verifyPostToolUse(event: ToolEvent): Promise<void> {
	const filePath = ((event.tool_response?.filePath as string) ?? event.tool_input.file_path) as
		| string
		| undefined;
	if (!filePath) return;

	if (LINTABLE.test(filePath)) {
		await run(["bun", "run", "lint:file", filePath]);
	}

	if (
		filePath.includes("/src/") &&
		/\.(ts|tsx)$/.test(filePath) &&
		!filePath.endsWith(".d.ts") &&
		!filePath.endsWith(".test.ts") &&
		!filePath.endsWith(".test.tsx")
	) {
		const testFile = filePath.replace(/\.(ts|tsx)$/, ".test.$1");
		if (!existsSync(testFile)) {
			console.log(
				JSON.stringify({ systemMessage: `Note: ${filePath} has no colocated test file.` }),
			);
		}
	}
}
