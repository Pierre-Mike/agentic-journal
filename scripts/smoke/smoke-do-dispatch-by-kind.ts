/**
 * Shape gate for spec 030-skip-judge-rule-workflow.
 *
 * Asserts that `.claude/skills/do/SKILL.md` Step 2.5 dispatches spec-judge only
 * for `kind: code`, and skips the judge for `rule`, `workflow`, and `writeup`.
 *
 * Checks:
 *   1. Dispatch-chain fenced block lists a line for `code` alone mapped to
 *      `tester → judge (retry cap 3) → implementer`.
 *   2. The same block lists a line for the set `{rule, workflow, writeup}`
 *      (any permutation, `|`-separated) mapped to `tester → implementer`
 *      with `skip judge, skip .gate-frozen` in the comment tail.
 *   3. The pseudocode guards the skip-judge branch with `kind !== "code"`
 *      (not `kind === "writeup"`).
 *
 * Accepts `DISPATCH_BY_KIND_ROOT` for fixture overrides (e.g. future tests);
 * defaults to `.`.
 *
 * Exits 0 on all-pass, 1 with a clear stderr message on any miss.
 */

import { existsSync, readFileSync } from "node:fs";

const ROOT = process.env.DISPATCH_BY_KIND_ROOT ?? ".";
const SKILL_PATH = `${ROOT}/.claude/skills/do/SKILL.md`;

function fail(msg: string): never {
	console.error(`smoke-do-dispatch-by-kind: FAIL ${msg}`);
	process.exit(1);
}

if (!existsSync(SKILL_PATH)) fail(`MISSING: ${SKILL_PATH}`);
const skill = readFileSync(SKILL_PATH, "utf8");

// --- 1 + 2. Dispatch-chain block ---

// Find the first ```-fenced block containing the arrow-mapping table under
// Step 2.5. We search every fenced block and require the matching one to
// contain BOTH dispatch lines.
const fenceBlocks = skill.match(/```[\s\S]*?```/g) ?? [];

function kindsEqual(line: string, expected: readonly string[]): boolean {
	// Strip leading/trailing whitespace, split on `|`, lowercase, sort.
	const tokens = line
		.split("|")
		.map((t) => t.trim().toLowerCase())
		.filter((t) => t.length > 0)
		.sort();
	const want = [...expected].map((s) => s.toLowerCase()).sort();
	if (tokens.length !== want.length) return false;
	for (let i = 0; i < tokens.length; i++) {
		if (tokens[i] !== want[i]) return false;
	}
	return true;
}

let codeLineOk = false;
let skipLineOk = false;

for (const block of fenceBlocks) {
	for (const raw of block.split("\n")) {
		const arrow = raw.indexOf("→");
		if (arrow === -1) continue;
		const lhs = raw.slice(0, arrow);
		const rhs = raw.slice(arrow).toLowerCase();

		// code alone → tester → judge (retry cap 3) → implementer
		if (kindsEqual(lhs, ["code"])) {
			if (
				rhs.includes("tester") &&
				rhs.includes("judge") &&
				rhs.includes("implementer") &&
				/retry\s+cap\s+3/.test(rhs)
			) {
				codeLineOk = true;
			}
		}

		// rule | workflow | writeup → tester → implementer (skip judge, skip .gate-frozen)
		if (kindsEqual(lhs, ["rule", "workflow", "writeup"])) {
			if (
				rhs.includes("tester") &&
				rhs.includes("implementer") &&
				!/\bjudge\b(?!.*skip)/.test(rhs.replace(/skip judge/g, "")) &&
				rhs.includes("skip judge") &&
				rhs.includes(".gate-frozen")
			) {
				skipLineOk = true;
			}
		}
	}
}

if (!codeLineOk) {
	fail(
		"dispatch-chain: missing line mapping `code` alone to `tester → judge (retry cap 3) → implementer`",
	);
}
if (!skipLineOk) {
	fail(
		"dispatch-chain: missing line mapping `rule | workflow | writeup` to `tester → implementer` with `skip judge, skip .gate-frozen`",
	);
}

// --- 3. Pseudocode guard uses `kind !== "code"` ---

if (!/kind\s*!==\s*["']code["']/.test(skill)) {
	fail(
		'pseudocode: skip-judge branch must be guarded by `kind !== "code"` (not `kind === "writeup"`)',
	);
}

// Also guard against the stale form sticking around.
if (/if\s+kind\s*===\s*["']writeup["']/.test(skill)) {
	fail(
		'pseudocode: stale `if kind === "writeup"` guard still present — replace with `if kind !== "code"`',
	);
}

console.log("DO_DISPATCH_BY_KIND_OK");
