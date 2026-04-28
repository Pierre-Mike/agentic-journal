#!/usr/bin/env bun
/**
 * smoke-spec-doc-shape.ts — RED gate for spec 042 slice 3
 *
 * Checks that .claude/skills/do/SKILL.md and .claude/agents/spec-judge.md
 * contain the required content for the "judge runs gate before freeze" feature.
 *
 * Exits 1 if any check fails (RED), exits 0 if all pass (GREEN).
 */

import { resolve } from "path";

const repoRoot = resolve(import.meta.dir, "..");

const SKILL_MD = resolve(repoRoot, ".claude/skills/do/SKILL.md");
const JUDGE_MD = resolve(repoRoot, ".claude/agents/spec-judge.md");

interface CheckResult {
	doc: string;
	check: string;
	pass: boolean;
}

async function readDoc(path: string): Promise<string> {
	const f = Bun.file(path);
	if (!(await f.exists())) {
		throw new Error(`File not found: ${path}`);
	}
	return f.text();
}

function check(
	results: CheckResult[],
	doc: string,
	label: string,
	content: string,
	pattern: RegExp | string,
): void {
	const pass = typeof pattern === "string" ? content.includes(pattern) : pattern.test(content);
	results.push({ doc, check: label, pass });
}

async function main(): Promise<void> {
	const [skillContent, judgeContent] = await Promise.all([readDoc(SKILL_MD), readDoc(JUDGE_MD)]);

	const results: CheckResult[] = [];

	// ── .claude/skills/do/SKILL.md — Step 6 pseudocode checks ──────────────────

	// Must mention red-proof.ts invocation between spec-tester await and spec-judge dispatch
	check(
		results,
		".claude/skills/do/SKILL.md",
		"mentions red-proof.ts invocation in Step 6 pseudocode",
		skillContent,
		/red-proof\.ts/,
	);

	// Must mention red-proof-N.txt artifact path
	check(
		results,
		".claude/skills/do/SKILL.md",
		"mentions red-proof-N.txt artifact path",
		skillContent,
		/red-proof-\d*N?\.txt|red-proof-N\.txt/,
	);

	// Must mention exit_code branch for 0 (auto-FAIL)
	check(
		results,
		".claude/skills/do/SKILL.md",
		"mentions exit_code 0 branch (auto-FAIL) in Step 6",
		skillContent,
		/exit.?code.*0|0.*auto.?FAIL|exit_code.*==.*0/i,
	);

	// Must mention exit_code branch for 124 (timeout)
	check(
		results,
		".claude/skills/do/SKILL.md",
		"mentions exit_code 124 branch (timeout) in Step 6",
		skillContent,
		/124/,
	);

	// Must mention exit_code branch for 127 (unknown runner)
	check(
		results,
		".claude/skills/do/SKILL.md",
		"mentions exit_code 127 branch (unknown runner) in Step 6",
		skillContent,
		/127/,
	);

	// ── .claude/agents/spec-judge.md checks ────────────────────────────────────

	// Allowed Read paths must list red-proof-N.txt
	check(
		results,
		".claude/agents/spec-judge.md",
		"allowed Read paths section lists red-proof-N.txt",
		judgeContent,
		/red-proof-N\.txt|red-proof-\d*\.txt/,
	);

	// Rubric section must have Item 0: RED proven BEFORE Item 1
	const item0Index = judgeContent.indexOf("Item 0");
	const item1Index = judgeContent.indexOf("Item 1");
	const item0BeforeItem1 = item0Index !== -1 && item1Index !== -1 && item0Index < item1Index;
	results.push({
		doc: ".claude/agents/spec-judge.md",
		check: 'rubric has "Item 0" before "Item 1"',
		pass: item0BeforeItem1,
	});

	// Item 0 must be labeled "Item 0: RED proven" (or similar)
	check(
		results,
		".claude/agents/spec-judge.md",
		'Item 0 is labeled "Item 0: RED proven" (or similar)',
		judgeContent,
		/Item 0.*RED proven|Item 0.*RED/i,
	);

	// Item 0 must list exit_code 0 outcome
	check(
		results,
		".claude/agents/spec-judge.md",
		"Item 0 lists exit_code 0 outcome (auto-FAIL)",
		judgeContent,
		/exit.?code.*0.*auto.?FAIL|0.*auto.?FAIL|exit_code: 0/i,
	);

	// Item 0 must list exit_code 124 outcome (timeout)
	check(
		results,
		".claude/agents/spec-judge.md",
		"Item 0 lists exit_code 124 outcome (timeout)",
		judgeContent,
		/124/,
	);

	// Item 0 must list exit_code 127 outcome (unknown runner)
	check(
		results,
		".claude/agents/spec-judge.md",
		"Item 0 lists exit_code 127 outcome (unknown runner)",
		judgeContent,
		/127/,
	);

	// Item 0 must list the "else → continue" outcome for other exit codes
	check(
		results,
		".claude/agents/spec-judge.md",
		"Item 0 lists other exit_code outcome (continue to Items 1–4)",
		judgeContent,
		/else.*continue|continue.*Items? [1-4]|other.*continue/i,
	);

	// ── Report ─────────────────────────────────────────────────────────────────

	const failures = results.filter((r) => !r.pass);
	const passes = results.filter((r) => r.pass);

	for (const r of passes) {
		console.log(`PASS: ${r.doc} — ${r.check}`);
	}
	for (const r of failures) {
		console.log(`MISS: ${r.doc} — ${r.check}`);
	}

	if (failures.length > 0) {
		console.log(`\n${failures.length} check(s) failed, ${passes.length} passed.`);
		process.exit(1);
	}

	console.log(`\nAll ${passes.length} checks passed.`);
	process.exit(0);
}

main().catch((err) => {
	console.error(`ERROR: ${err.message}`);
	process.exit(1);
});
