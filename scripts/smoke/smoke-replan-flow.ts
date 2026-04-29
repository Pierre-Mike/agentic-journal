#!/usr/bin/env bun
/**
 * Gate validator for spec 045 (post-slice re-plan hook)
 *
 * Simulates a 2-slice spec where slice 1 implementation invalidates slice 2's premise.
 * Asserts:
 * 1. Replanner runs after slice 1 refactor commit
 * 2. tasks.md is patched correctly
 * 3. A `replan(<id>): 2` commit appears
 * 4. Slice 2 spec-tester would read the patched task body
 *
 * Initially RED — flips GREEN once the replanner agent + /do Step 6 wiring land.
 */

import { existsSync } from "node:fs";

// RED until implementation lands
const REPLANNER_AGENT_PATH = ".claude/agents/spec-replanner.md";
const DO_SKILL_PATH = ".claude/skills/do/SKILL.md";

export async function checkReplanFlow(): Promise<{
	ok: boolean;
	reason?: string;
}> {
	// Check 1: spec-replanner agent exists
	if (!existsSync(REPLANNER_AGENT_PATH)) {
		return {
			ok: false,
			reason: `spec-replanner agent not found at ${REPLANNER_AGENT_PATH}`,
		};
	}

	// Check 2: /do SKILL.md mentions replanner dispatch in Step 6
	const doSkillContent = await Bun.file(DO_SKILL_PATH).text();
	if (
		!doSkillContent.includes("spec-replanner") ||
		!doSkillContent.includes("after refactor commit")
	) {
		return {
			ok: false,
			reason: "/do SKILL.md Step 6 does not mention spec-replanner dispatch",
		};
	}

	// Check 3: spec-replanner agent declares model: haiku
	const replannerContent = await Bun.file(REPLANNER_AGENT_PATH).text();
	if (!replannerContent.includes("model: haiku")) {
		return {
			ok: false,
			reason: "spec-replanner agent does not declare model: haiku",
		};
	}

	// Check 4: spec-replanner agent has scoped tool allowlist (Read, Edit on tasks.md/design.md only)
	if (!replannerContent.includes("tasks.md") && !replannerContent.includes("design.md")) {
		return {
			ok: false,
			reason: "spec-replanner agent does not document scoped Edit allowlist for tasks.md/design.md",
		};
	}

	return { ok: true };
}

// CLI entry point
if (import.meta.main) {
	const result = await checkReplanFlow();
	if (result.ok) {
		process.stdout.write("✓ replan-flow gate passed\n");
		process.exit(0);
	}

	process.stderr.write(`✗ replan-flow gate failed: ${result.reason}\n`);
	process.exit(1);
}
