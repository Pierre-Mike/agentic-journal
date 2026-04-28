#!/usr/bin/env bun
/**
 * smoke-spec-doc-shape.ts — RED gate for spec 042 slice 3
 *
 * Section-scoped checks on .claude/skills/do/SKILL.md and .claude/agents/spec-judge.md.
 * Exits 1 if any check fails (RED), exits 0 if all pass (GREEN).
 */

import { resolve } from "path";

const repoRoot = resolve(import.meta.dir, "..");
const SKILL_MD = resolve(repoRoot, ".claude/skills/do/SKILL.md");
const JUDGE_MD = resolve(repoRoot, ".claude/agents/spec-judge.md");

const misses: string[] = [];

function miss(msg: string): void {
	misses.push(msg);
}

/**
 * Extract the body of a markdown section bounded by the given heading pattern.
 * Returns text from the end of the matched heading line up to (not including)
 * the next heading of equal or higher level, or end-of-file.
 * Returns null if no heading matches.
 */
function extractSection(doc: string, headingPattern: RegExp): string | null {
	const lines = doc.split("\n");
	let startLine = -1;
	let headingLevel = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line === undefined) continue;
		const m = line.match(/^(#{1,6})\s+/);
		if (m?.[1] && headingPattern.test(line)) {
			startLine = i + 1; // body starts after the heading line
			headingLevel = m[1].length;
			break;
		}
	}

	if (startLine === -1) return null;

	const bodyLines: string[] = [];
	for (let i = startLine; i < lines.length; i++) {
		const line = lines[i];
		if (line === undefined) continue;
		const m = line.match(/^(#{1,6})\s+/);
		if (m?.[1] && m[1].length <= headingLevel) {
			// reached a sibling or parent heading — stop
			break;
		}
		bodyLines.push(line);
	}

	return bodyLines.join("\n");
}

async function readDoc(path: string): Promise<string> {
	const f = Bun.file(path);
	if (!(await f.exists())) {
		throw new Error(`File not found: ${path}`);
	}
	return f.text();
}

async function main(): Promise<void> {
	const [skillContent, judgeContent] = await Promise.all([readDoc(SKILL_MD), readDoc(JUDGE_MD)]);

	// ── spec-judge.md: Allowed Read paths section ─────────────────────────────
	// AC9a: red-proof-N.txt must appear inside the allowed Read paths section.
	// We look for a heading that names the read-paths scope. The current doc uses
	// "You may Read files under:" prose without a heading — after the fix it should
	// have a proper "## Allowed Read paths" (or similar) heading. We accept any
	// heading matching /allowed read|read paths|scope/i that is h2 or h3.
	const allowedPathsSection = extractSection(
		judgeContent,
		/^#{1,3}\s+(allowed\s+read\s+paths?|read\s+paths?|scope)\b/i,
	);
	if (allowedPathsSection === null) {
		miss("spec-judge.md: no 'Allowed Read paths' (or Scope) section heading found");
	} else if (!allowedPathsSection.includes("red-proof-N.txt")) {
		miss("spec-judge.md: red-proof-N.txt missing from allowed Read paths section body");
	}

	// ── spec-judge.md: Item 0 section ─────────────────────────────────────────
	// AC9b: Item 0 must appear before Item 1 in the rubric.
	const item0Index = judgeContent.indexOf("Item 0");
	const item1Index = judgeContent.indexOf("Item 1");
	if (item0Index === -1 || item1Index === -1 || item0Index >= item1Index) {
		miss('spec-judge.md: "Item 0" must appear before "Item 1"');
	}

	// Item 0 must be labeled with "RED proven" (or similar).
	const item0Section = extractSection(judgeContent, /^#{1,4}\s+Item 0\b/i);
	if (item0Section === null) {
		miss("spec-judge.md: no 'Item 0' heading found in rubric");
	} else {
		// AC9b: heading itself should contain "RED proven"
		const item0HeadingMatch = judgeContent.match(/^#{1,4}\s+(Item 0[^\n]*)/im);
		const item0Heading = item0HeadingMatch?.[1];
		if (!item0Heading || !/RED\s+proven/i.test(item0Heading)) {
			miss('spec-judge.md: Item 0 heading missing "RED proven" label');
		}

		// AC9c: exit_code 0 → auto-FAIL must be co-located inside Item 0 body.
		// Require both "0" and "auto-FAIL" to appear together (not just either).
		if (!/\b0\b.*auto.?FAIL|auto.?FAIL.*\b0\b/i.test(item0Section)) {
			miss("spec-judge.md: Item 0 body missing exit_code 0 paired with auto-FAIL outcome");
		}

		// AC9c: exit_code 124 must appear inside Item 0 body.
		if (!/\b124\b/.test(item0Section)) {
			miss("spec-judge.md: Item 0 body missing exit_code 124 outcome");
		}

		// AC9c: exit_code 127 must appear inside Item 0 body.
		if (!/\b127\b/.test(item0Section)) {
			miss("spec-judge.md: Item 0 body missing exit_code 127 outcome");
		}

		// AC9c: "else → continue" (or equivalent) for other exit codes must appear
		// inside Item 0 body.
		if (!/else.*continue|continue.*Items?\s*[1-9]|other.*continue/i.test(item0Section)) {
			miss("spec-judge.md: Item 0 body missing 'else continue' outcome for other exit codes");
		}
	}

	// ── SKILL.md Step 6: positional ordering ──────────────────────────────────
	// AC8: red-proof.ts invocation must appear AFTER spec-tester await and
	// BEFORE spec-judge dispatch inside the Step 6 section.
	const step6Section = extractSection(skillContent, /^###\s+Step 6\b/i);
	if (step6Section === null) {
		miss("SKILL.md: no '### Step 6' heading found");
	} else {
		// Anchor 1: spec-tester commit (end of tester's work in the loop)
		// Match the "commits RED" line that closes the tester's action.
		const testerIdx = step6Section.search(
			/spec-tester[^\n]*(slice\s+N|RED\s+commit|commits?\s+RED)/i,
		);
		// Anchor 2: red-proof.ts invocation
		const proofIdx = step6Section.search(/red-proof\.ts/);
		// Anchor 3: spec-judge dispatch
		const judgeIdx = step6Section.search(/spec-judge\s*\(slice\s*N\)/i);

		if (proofIdx === -1) {
			miss("SKILL.md Step 6: red-proof.ts not mentioned in Step 6 section");
		} else if (testerIdx === -1) {
			miss("SKILL.md Step 6: spec-tester commit anchor not found in Step 6 section");
		} else if (judgeIdx === -1) {
			miss("SKILL.md Step 6: spec-judge dispatch anchor not found in Step 6 section");
		} else if (!(testerIdx < proofIdx && proofIdx < judgeIdx)) {
			miss(
				"SKILL.md Step 6: red-proof.ts must appear between spec-tester commit and spec-judge dispatch (positional ordering violated)",
			);
		}

		// Also check red-proof-N.txt artifact path is mentioned in Step 6.
		if (!/red-proof-N\.txt/.test(step6Section)) {
			miss("SKILL.md Step 6: red-proof-N.txt artifact path not mentioned in Step 6 section");
		}

		// exit_code branches for 0, 124, 127 must appear in Step 6.
		// Use section-scoped check (not whole-doc).
		if (!/\b0\b.*auto.?FAIL|auto.?FAIL.*\b0\b/i.test(step6Section)) {
			miss("SKILL.md Step 6: exit_code 0 / auto-FAIL branch not mentioned in Step 6 section");
		}
		if (!/\b124\b/.test(step6Section)) {
			miss("SKILL.md Step 6: exit_code 124 branch not mentioned in Step 6 section");
		}
		if (!/\b127\b/.test(step6Section)) {
			miss("SKILL.md Step 6: exit_code 127 branch not mentioned in Step 6 section");
		}
	}

	// ── Report ─────────────────────────────────────────────────────────────────
	if (misses.length > 0) {
		for (const m of misses) {
			console.log(`MISS: ${m}`);
		}
		console.log(`\n${misses.length} check(s) failed.`);
		process.exit(1);
	}

	console.log(`All checks passed.`);
	process.exit(0);
}

main().catch((err) => {
	console.error(`ERROR: ${err.message}`);
	process.exit(1);
});
