/**
 * Gate for spec 004-delegate-do-to-subagent.
 *
 * Asserts the /do skill instructs the main session to hand off Steps 3–10 to a
 * background subagent. Pre-fix: SKILL.md has no delegation anchors → exit 1.
 * Post-fix: all anchors present → exit 0.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SKILL = join(process.cwd(), ".claude/skills/do/SKILL.md");

interface Check {
	name: string;
	test: (body: string) => boolean;
}

const checks: Check[] = [
	{
		name: "Step 2.5 — Delegate section exists",
		test: (b) => /###\s+Step\s+2\.5\s+[—-]\s+Delegate/i.test(b),
	},
	{
		name: "handoff uses Agent tool with run_in_background: true",
		test: (b) => b.includes("run_in_background: true"),
	},
	{
		name: "Steps 3–10 flagged as executed by subagent",
		test: (b) => /Executed by the background subagent/i.test(b),
	},
	{
		name: "Rules block contains delegation rule",
		test: (b) => /\*\*Delegate after alignment\*\*/.test(b),
	},
];

function main(): number {
	if (!existsSync(SKILL)) {
		console.error(`✖ ${SKILL} not found`);
		return 1;
	}
	const body = readFileSync(SKILL, "utf-8");
	let failed = 0;
	for (const c of checks) {
		if (c.test(body)) {
			console.log(`  ✓ ${c.name}`);
		} else {
			console.log(`  ✖ ${c.name}`);
			failed++;
		}
	}
	if (failed > 0) {
		console.log(`\n✖ ${failed}/${checks.length} checks failed`);
		return 1;
	}
	console.log("\n✓ all green");
	return 0;
}

process.exit(main());
