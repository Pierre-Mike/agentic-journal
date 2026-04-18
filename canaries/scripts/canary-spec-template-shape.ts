/**
 * Canary: spec template shape.
 *
 * Asserts that `specs/_template/{proposal,tasks,design}.md` exist and contain
 * the required heading/frontmatter markers that `/do` relies on when authoring
 * a new spec. Deterministic — file-system checks only, no LLM.
 *
 * Emits `CANARY_OK` on success and exits 0; exits 1 with a reason on failure.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

interface Check {
	file: string;
	required: string[];
}

const CHECKS: Check[] = [
	{
		file: "specs/_template/proposal.md",
		required: ["## Intent", "## Constraints", "## Acceptance criteria", "kind:"],
	},
	{
		file: "specs/_template/tasks.md",
		required: ["# Tasks", "file_targets"],
	},
	{
		file: "specs/_template/design.md",
		required: ["# Design", "## Approach"],
	},
];

function main(): void {
	const cwd = process.cwd();
	const failures: string[] = [];
	for (const check of CHECKS) {
		const abs = join(cwd, check.file);
		if (!existsSync(abs)) {
			failures.push(`missing file: ${check.file}`);
			continue;
		}
		const body = readFileSync(abs, "utf-8");
		for (const marker of check.required) {
			if (!body.includes(marker)) {
				failures.push(`${check.file}: required marker "${marker}" not found`);
			}
		}
	}
	if (failures.length > 0) {
		for (const f of failures) process.stderr.write(`${f}\n`);
		process.exit(1);
	}
	process.stdout.write("CANARY_OK spec-template-shape\n");
	process.exit(0);
}

main();
