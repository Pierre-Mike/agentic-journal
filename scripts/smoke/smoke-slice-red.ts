/**
 * Smoke test for spec 039-slice-red-tdd.
 *
 * Asserts that the slice-RED TDD system is fully wired:
 *   1. _lib.ts exports taskGates() helper
 *   2. spec-lint validates per-task gate fields for kind:code
 *   3. tasks-verify is slice-aware (skips unfrozen, enforces frozen)
 *   4. spec-complete requires all .gate-frozen-N sentinels for kind:code
 *   5. enforce.ts findSliceForPath blocks frozen slice gates; bare .gate-frozen inert
 *   6. /do SKILL.md describes per-slice loop (Step 6) with tester/judge/implementer per slice
 *   7. spec-tester agent doc describes scaffold vs slice modes
 *   8. spec-judge agent doc describes per-slice review and .gate-frozen-N sentinel
 *   9. spec-implementer agent doc describes per-slice GREEN + slice-revision-blocker
 *  10. constitution §4 describes slice-RED rules + kind:code-only gating
 *  11. tasks.md template includes per-task gate: field example
 *
 * RED: all assertions fail until the implementer wires up the changes.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = process.cwd();

function fail(msg: string): never {
	console.error(`FAIL: ${msg}`);
	process.exit(1);
}

function assert(condition: boolean, msg: string): void {
	if (!condition) fail(msg);
}

function readFile(rel: string): string {
	const abs = join(REPO_ROOT, rel);
	if (!existsSync(abs)) fail(`file not found: ${rel}`);
	return readFileSync(abs, "utf-8");
}

// ---------------------------------------------------------------------------
// 1. _lib.ts exports taskGates()
// ---------------------------------------------------------------------------
const lib = readFile("scripts/_lib.ts");
assert(
	lib.includes("taskGates"),
	"_lib.ts must export taskGates() helper returning {ordinal, gatePath, frozen}[]",
);
assert(lib.includes("ordinal"), "_lib.ts taskGates() must return objects with an 'ordinal' field");
assert(lib.includes("gatePath"), "_lib.ts taskGates() must return objects with a 'gatePath' field");
assert(lib.includes("frozen"), "_lib.ts taskGates() must return objects with a 'frozen' field");

// ---------------------------------------------------------------------------
// 2. spec-lint validates per-task gate fields for kind:code
// ---------------------------------------------------------------------------
const specLint = readFile("scripts/spec-lint.ts");
assert(
	specLint.includes("gate") && specLint.includes("kind") && specLint.includes("code"),
	"spec-lint.ts must reference gate field validation gated on kind:code",
);
assert(
	specLint.includes("contiguous") || specLint.includes("ordinal") || specLint.includes("taskGates"),
	"spec-lint.ts must validate per-task gate contiguity (ordinals 1..N)",
);
assert(
	specLint.includes("unique") || specLint.includes("duplicate") || specLint.includes("seen"),
	"spec-lint.ts must validate per-task gate uniqueness",
);

// ---------------------------------------------------------------------------
// 3. tasks-verify is slice-aware
// ---------------------------------------------------------------------------
const tasksVerify = readFile("scripts/tasks-verify.ts");
assert(
	tasksVerify.includes("taskGates") || tasksVerify.includes("gate-frozen-"),
	"tasks-verify.ts must use taskGates() or check .gate-frozen-N sentinels",
);
assert(
	tasksVerify.includes("frozen") || tasksVerify.includes("gate-frozen"),
	"tasks-verify.ts must be slice-aware (skip unfrozen, enforce frozen)",
);

// ---------------------------------------------------------------------------
// 4. spec-complete requires all .gate-frozen-N sentinels for kind:code
// ---------------------------------------------------------------------------
const specComplete = readFile("scripts/spec-complete.ts");
assert(
	specComplete.includes("gate-frozen-") || specComplete.includes("taskGates"),
	"spec-complete.ts must check .gate-frozen-N sentinels for kind:code specs",
);
assert(
	specComplete.includes("kind") && specComplete.includes("code"),
	"spec-complete.ts must gate sentinel checks on kind:code (legacy path for non-code kinds)",
);

// ---------------------------------------------------------------------------
// 5. enforce.ts findSliceForPath and bare .gate-frozen inert
// ---------------------------------------------------------------------------
const enforce = readFile(".claude/hooks/enforce.ts");
assert(
	enforce.includes("findSliceForPath"),
	"enforce.ts must export/use findSliceForPath for per-slice gate enforcement",
);
assert(
	enforce.includes("gate-frozen-"),
	"enforce.ts must check .gate-frozen-N (numbered sentinel) for each slice",
);
assert(
	!enforce.includes('".gate-frozen"') && !enforce.includes("'.gate-frozen'"),
	"enforce.ts must NOT reference bare .gate-frozen sentinel (it is inert post-migration)",
);

// ---------------------------------------------------------------------------
// 6. /do SKILL.md describes per-slice loop (Step 6)
// ---------------------------------------------------------------------------
const doSkill = readFile(".claude/skills/do/SKILL.md");
assert(
	doSkill.includes("per-slice") || doSkill.includes("slice loop") || doSkill.includes("slice N"),
	"/do SKILL.md must describe per-slice loop in Step 6",
);
assert(
	doSkill.includes("gate-frozen-") || doSkill.includes(".gate-frozen-"),
	"/do SKILL.md must reference .gate-frozen-N sentinels",
);
assert(
	doSkill.includes("scaffold") || doSkill.includes("Step 5"),
	"/do SKILL.md Step 5 must be scaffold-only (proposal.md, design.md, tasks.md — no gate files)",
);

// ---------------------------------------------------------------------------
// 7. spec-tester agent doc describes scaffold vs slice modes
// ---------------------------------------------------------------------------
const testerAgent = readFile(".claude/agents/spec-tester.md");
assert(
	testerAgent.includes("scaffold") && testerAgent.includes("slice"),
	"spec-tester.md must describe both scaffold mode and slice mode",
);
assert(
	testerAgent.includes("gate-frozen-") || testerAgent.includes(".gate-frozen-"),
	"spec-tester.md must reference numbered sentinel .gate-frozen-N",
);

// ---------------------------------------------------------------------------
// 8. spec-judge agent doc describes per-slice review with .gate-frozen-N
// ---------------------------------------------------------------------------
const judgeAgent = readFile(".claude/agents/spec-judge.md");
assert(
	judgeAgent.includes("gate-frozen-") || judgeAgent.includes(".gate-frozen-"),
	"spec-judge.md must reference .gate-frozen-N (numbered sentinel per slice)",
);
assert(
	judgeAgent.includes("slice") || judgeAgent.includes("per-slice"),
	"spec-judge.md must describe per-slice review scope",
);

// ---------------------------------------------------------------------------
// 9. spec-implementer agent doc: per-slice GREEN + slice-revision-blocker
// ---------------------------------------------------------------------------
const implAgent = readFile(".claude/agents/spec-implementer.md");
assert(
	implAgent.includes("slice-revision-blocker") || implAgent.includes("slice revision blocker"),
	"spec-implementer.md must describe slice-revision-blocker.md protocol",
);
assert(
	implAgent.includes("slice") || implAgent.includes("per-slice"),
	"spec-implementer.md must describe per-slice implementation scope",
);

// ---------------------------------------------------------------------------
// 10. constitution §4 slice-RED rules + kind:code-only gating
// ---------------------------------------------------------------------------
const constitution = readFile("specs/constitution.md");
assert(
	constitution.includes("slice") || constitution.includes("slice-RED"),
	"specs/constitution.md §4 must document slice-RED rules",
);
assert(
	constitution.includes("kind: code") || constitution.includes("kind:code"),
	"specs/constitution.md §4 must specify slice-RED applies to kind:code only",
);
assert(
	constitution.includes("gate-frozen-") || constitution.includes(".gate-frozen-"),
	"specs/constitution.md must reference .gate-frozen-N sentinel naming",
);

// ---------------------------------------------------------------------------
// 11. tasks.md template includes per-task gate: field
// ---------------------------------------------------------------------------
const tasksTemplate = readFile("specs/_template/tasks.md");
assert(
	tasksTemplate.includes("gate:"),
	"specs/_template/tasks.md must include per-task gate: field example",
);

console.log("✓ smoke-slice-red: all assertions passed");
