/**
 * Gate for spec 030-fold-judge-escalation.
 *
 * Asserts that the judge-rejection escalation path has been folded into the
 * `paused` Step 10 variant of `/do`:
 *
 *   1. `.claude/skills/do/SKILL.md` contains NO occurrence of `blocker.md`.
 *   2. `.claude/agents/spec-judge.md` contains NO occurrence of `blocker.md`.
 *   3. SKILL.md Step 10 does NOT contain a heading/section labeled "escalated"
 *      (case-insensitive). Only `complete` and `paused` variants remain.
 *   4. spec-judge.md names `tester-review.md` as the 3-strike-FAIL escalation
 *      artifact (not blocker.md).
 *
 * RED on write: SKILL.md + spec-judge.md still reference blocker.md and the
 * "escalated" Step 10 variant, so this script exits 1.
 * GREEN after the edits in tasks 3 and 4 land.
 *
 * Accepts `DO_NO_BLOCKER_ROOT` env override so the colocated bun:test (if one
 * is ever added) can point it at a fixture. Defaults to `.`.
 */

import { existsSync, readFileSync } from "node:fs";

const ROOT = process.env.DO_NO_BLOCKER_ROOT ?? ".";

const SKILL_PATH = `${ROOT}/.claude/skills/do/SKILL.md`;
const JUDGE_PATH = `${ROOT}/.claude/agents/spec-judge.md`;

function fail(msg: string): never {
	console.error(`smoke-do-no-blocker: FAIL ${msg}`);
	process.exit(1);
}

for (const p of [SKILL_PATH, JUDGE_PATH]) {
	if (!existsSync(p)) fail(`MISSING: ${p}`);
}

const skill = readFileSync(SKILL_PATH, "utf8");
const judge = readFileSync(JUDGE_PATH, "utf8");

// Assertion 1: SKILL.md has no `blocker.md`.
if (skill.includes("blocker.md")) {
	fail(`${SKILL_PATH} still references blocker.md`);
}

// Assertion 2: spec-judge.md has no `blocker.md`.
if (judge.includes("blocker.md")) {
	fail(`${JUDGE_PATH} still references blocker.md`);
}

// Assertion 3: SKILL.md Step 10 has no "escalated" variant heading/section.
// The old shape used lines like:
//   **On judge rejecting 3 tester attempts (NEW — spec 027)**:
//   /do escalated for <id>:
// Detect any case-insensitive "escalated" inside the Step 10 block.
const step10Match = skill.match(/### Step 10[\s\S]*?(?=\n### |\n## |$)/);
if (!step10Match) fail(`${SKILL_PATH}: could not locate Step 10 section`);
const step10Body = step10Match[0];
if (/escalated/i.test(step10Body)) {
	fail(`${SKILL_PATH}: Step 10 still contains an "escalated" variant`);
}

// Assertion 4: spec-judge.md must cite tester-review.md as the 3-strike FAIL
// artifact. Sanity check: the file still mentions tester-review.md at all.
if (!judge.includes("tester-review.md")) {
	fail(`${JUDGE_PATH}: no reference to tester-review.md as escalation artifact`);
}

console.log("DO_NO_BLOCKER_OK");
