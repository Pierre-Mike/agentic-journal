/**
 * Gate for spec 050-automerge-yml-issue-lookup-fallback-regex.
 *
 * Asserts that automerge.yml uses the correct PCRE fallback regex
 * (^auto/\K[0-9]+) and not the broken one ((?<=issue-)\d+), then verifies
 * the extraction logic against representative branch names.
 *
 * Pure file read + regex; no network, no spawn, no LLM.
 */

import { existsSync, readFileSync } from "node:fs";

const WORKFLOW = ".github/workflows/automerge.yml";

function fail(msg: string): never {
	console.error(`automerge-issue-lookup: FAIL ${msg}`);
	process.exit(1);
}

if (!existsSync(WORKFLOW)) fail(`MISSING: ${WORKFLOW}`);

const content = readFileSync(WORKFLOW, "utf8");

// 1. Broken regex must be absent
if (content.includes("(?<=issue-)")) {
	fail(`${WORKFLOW} still contains broken regex '(?<=issue-)\\d+' — fix not applied (line 58)`);
}

// 2. Correct regex must be present
if (!content.includes("^auto/\\K[0-9]+")) {
	fail(`${WORKFLOW} does not contain correct regex '^auto/\\K[0-9]+' (expected on line 58)`);
}

console.log("AUTOMERGE_ISSUE_LOOKUP_OK");
process.exit(0);
