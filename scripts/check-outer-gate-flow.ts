// @no-test: integration smoke test for BDD outer gate flow
/**
 * Verifies that the workflow changes for outer gate are present:
 * 1. spec-tester.md scaffolds outer gate at Step 5 for kind:code
 * 2. spec-judge.md reviews outer gate against alignment.md
 * 3. spec-complete.ts verifies .gate-frozen-outer before archive
 * 4. constitution.md documents outer/inner gate split
 * 5. /do SKILL.md documents the outer gate flow
 *
 * This is a workflow gate (kind:workflow, static checks) - it verifies the documentation/code changes are present, not runtime agent behavior.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = process.cwd();

function checkFileContains(path: string, searchStrings: string[], description: string): void {
	const fullPath = join(REPO_ROOT, path);
	if (!existsSync(fullPath)) {
		console.log(`  ✖ FAIL: ${path} not found`);
		process.exit(1);
	}
	const content = readFileSync(fullPath, "utf-8");
	for (const search of searchStrings) {
		if (!content.includes(search)) {
			console.log(`  ✖ FAIL: ${description}`);
			console.log(`    Missing: "${search}"`);
			console.log(`    In file: ${path}`);
			process.exit(1);
		}
	}
	console.log(`  ✓ ${description}`);
}

async function main(): Promise<void> {
	console.log("→ BDD outer gate flow check (workflow gate)\n");

	console.log("[Check 1] spec-tester scaffolds outer gate at Step 5 for kind:code");
	checkFileContains(
		".claude/agents/spec-tester.md",
		[
			"the **outer gate** file",
			"BDD acceptance test scoped to `alignment.md`",
			"Do NOT write per-slice gates yet",
		],
		"spec-tester.md documents outer gate scaffolding",
	);

	console.log("\n[Check 2] spec-judge reviews outer gate against alignment.md");
	checkFileContains(
		".claude/agents/spec-judge.md",
		["## Outer gate review", ".gate-frozen-outer", "against `alignment.md`"],
		"spec-judge.md documents outer gate review",
	);

	console.log("\n[Check 3] spec-complete verifies .gate-frozen-outer sentinel");
	checkFileContains(
		"scripts/spec-complete.ts",
		[".gate-frozen-outer", "kind:code spec requires the outer gate sentinel"],
		"spec-complete.ts enforces outer gate before archive",
	);

	console.log("\n[Check 4] constitution documents outer/inner gate split");
	checkFileContains(
		"specs/constitution.md",
		["### Outer gate (kind: code)", ".gate-frozen-outer", "per-slice gates"],
		"constitution.md documents outer/inner gate split",
	);

	console.log("\n[Check 5] /do SKILL.md documents outer gate flow");
	checkFileContains(
		".claude/skills/do/SKILL.md",
		[
			"proposal + outer gate + design + tasks",
			"outer gate file (from `gate:` frontmatter)",
			"both outer gate and all per-slice gates must be GREEN",
		],
		"/do SKILL.md documents outer gate flow",
	);

	console.log("\n[Gate status] GREEN — all workflow checks passed");
	process.exit(0);
}

if (import.meta.main) {
	await main();
}
