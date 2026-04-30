#!/usr/bin/env bun
// Gate: validates that CI workflows upload .claude/traces/ as artifacts and
// that /retro SKILL.md Step 2 documents the CI artifact fetch sub-step.
// Spec 054: upload-ci-claude-traces-as-artifacts

import { readFileSync } from "fs";
import { join } from "path";

const root = process.cwd();
const failures: string[] = [];

const workflows = [
	".github/workflows/slice.yml",
	".github/workflows/intent.yml",
	".github/workflows/claude.yml",
];

for (const wf of workflows) {
	let content: string;
	try {
		content = readFileSync(join(root, wf), "utf-8");
	} catch {
		failures.push(`${wf}: file not found`);
		continue;
	}

	if (!content.includes("actions/upload-artifact")) {
		failures.push(`${wf}: missing upload-artifact step`);
	} else if (!content.includes(".claude/traces/")) {
		failures.push(`${wf}: upload-artifact step does not reference .claude/traces/`);
	} else if (!content.includes("if: always()")) {
		failures.push(`${wf}: upload-artifact step missing if: always()`);
	}
}

let retroContent: string;
try {
	retroContent = readFileSync(join(root, ".claude/skills/retro/SKILL.md"), "utf-8");
} catch {
	failures.push(".claude/skills/retro/SKILL.md: file not found");
	retroContent = "";
}

if (retroContent && !retroContent.includes("traces-ci") && !retroContent.includes("CI artifact")) {
	failures.push(".claude/skills/retro/SKILL.md: Step 2 does not mention CI artifact fetch");
}

if (failures.length > 0) {
	console.error("FAIL — smoke-ci-traces-upload:\n" + failures.map((f) => `  ✗ ${f}`).join("\n"));
	process.exit(1);
}

console.log("OK — smoke-ci-traces-upload: all checks passed");
