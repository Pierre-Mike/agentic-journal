// @no-test: smoke script — tested by bun run tasks:verify
/**
 * Gate for spec 037-refactor-pass-after-green.
 *
 * Asserts that:
 *   1. .claude/agents/spec-implementer.md contains a Step 6.5 heading
 *   2. The Step 6.5 section contains kind:code gating language
 *   3. The Step 6.5 section references file_targets (scope bound)
 *   4. The Step 6.5 section contains a revert-on-fail instruction
 *   5. The Step 6.5 section appears AFTER the Step 6 section (ordinal check)
 *      AND contains a termination/bounded rule
 *   6. .claude/settings.json permissions.allow contains Edit(.claude/agents/**)
 *      and Write(.claude/agents/**)
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "..");

function readText(relPath: string): string {
	return readFileSync(join(repoRoot, relPath), "utf-8");
}

type CheckResult = { passed: boolean; label: string; detail: string };

function check(label: string, passed: boolean, detail: string): CheckResult {
	return { passed, label, detail };
}

const agentMd = readText(".claude/agents/spec-implementer.md");
const settingsRaw = readText(".claude/settings.json");

// Extract the Step 6.5 section body (from the heading to the next ### heading)
const step65HeadingMatch = agentMd.match(/###\s+Step\s+6\.5[^\n]*/i);
const step6HeadingMatch = agentMd.match(/###\s+Step\s+6\s+[—-][^\n]*/i);

const step65Idx = step65HeadingMatch ? agentMd.indexOf(step65HeadingMatch[0]) : -1;
const step6Idx = step6HeadingMatch ? agentMd.indexOf(step6HeadingMatch[0]) : -1;

// Get the body of Step 6.5 section (from heading to next ### heading)
const afterStep65 = step65Idx >= 0 ? agentMd.slice(step65Idx) : "";
const nextSectionMatch = afterStep65.slice(1).match(/\n###/);
const step65Body = nextSectionMatch
	? afterStep65.slice(
			0,
			nextSectionMatch.index !== undefined ? nextSectionMatch.index + 1 : afterStep65.length,
		)
	: afterStep65;

// Parse settings.json
const settingsObj: unknown = JSON.parse(settingsRaw);
const allowList: unknown =
	settingsObj !== null &&
	typeof settingsObj === "object" &&
	"permissions" in settingsObj &&
	settingsObj.permissions !== null &&
	typeof settingsObj.permissions === "object" &&
	"allow" in settingsObj.permissions
		? (settingsObj.permissions as Record<string, unknown>).allow
		: [];

const allowArray: string[] = Array.isArray(allowList)
	? allowList.filter((x): x is string => typeof x === "string")
	: [];

const results: CheckResult[] = [
	// 1. Heading exists
	check(
		"Step 6.5 heading present",
		step65Idx >= 0,
		step65HeadingMatch ? step65HeadingMatch[0] : "no match for /step 6.5/i",
	),
	// 2. kind:code gating language in section
	check(
		"kind:code gating language in Step 6.5",
		/kind.*code/i.test(step65Body) || /code.*kind/i.test(step65Body),
		"expected /kind.*code/i or /code.*kind/i in Step 6.5 body",
	),
	// 3. file_targets reference in section
	check(
		"file_targets scope rule in Step 6.5",
		/file_targets/i.test(step65Body),
		"expected /file_targets/i in Step 6.5 body",
	),
	// 4. revert-on-fail instruction
	check(
		"revert-on-fail rule in Step 6.5",
		/revert/i.test(step65Body),
		"expected /revert/i in Step 6.5 body",
	),
	// 5a. Step 6.5 appears AFTER Step 6
	check(
		"Step 6.5 appears after Step 6 (ordinal)",
		step6Idx >= 0 && step65Idx > step6Idx,
		`step6Idx=${step6Idx}, step65Idx=${step65Idx}`,
	),
	// 5b. termination/bounded rule
	check(
		"termination/bounded rule in Step 6.5",
		/terminate|Terminate|bounded/i.test(step65Body),
		"expected /terminate|bounded/i in Step 6.5 body",
	),
	// 6. settings.json allow entries
	check(
		"settings.json allows Edit(.claude/agents/**)",
		allowArray.includes("Edit(.claude/agents/**)"),
		`allow array: ${JSON.stringify(allowArray.filter((x) => x.includes("agents")))}`,
	),
	check(
		"settings.json allows Write(.claude/agents/**)",
		allowArray.includes("Write(.claude/agents/**)"),
		`allow array: ${JSON.stringify(allowArray.filter((x) => x.includes("agents")))}`,
	),
];

let anyFailed = false;
for (const r of results) {
	if (r.passed) {
		console.log(`✓ ${r.label}`);
	} else {
		console.error(`✗ ${r.label} — ${r.detail}`);
		anyFailed = true;
	}
}

if (anyFailed) {
	process.exit(1);
}
process.exit(0);
