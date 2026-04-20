/**
 * Shape gate for spec 027-dual-agent-tdd.
 *
 * Asserts that the three-agent `/do` flow is wired up correctly:
 *   1. `.claude/agents/spec-tester.md`, `spec-judge.md`, `spec-implementer.md` exist
 *   2. Each has the correct `name` in frontmatter
 *   3. tester and judge declare DIFFERENT `model`s (independence guard)
 *   4. Judge body contains all 4 rubric keywords verbatim
 *   5. SKILL.md references all three subagent names AND has `writeup` handling
 *
 * Accepts `DUAL_AGENT_ROOT` env override so the colocated bun:test can point it
 * at a tmp fixture. Defaults to `.` (current working directory).
 */

import { existsSync, readFileSync } from "node:fs";

const ROOT = process.env.DUAL_AGENT_ROOT ?? ".";

const AGENT_FILES = [
	`${ROOT}/.claude/agents/spec-tester.md`,
	`${ROOT}/.claude/agents/spec-judge.md`,
	`${ROOT}/.claude/agents/spec-implementer.md`,
];
const SKILL_PATH = `${ROOT}/.claude/skills/do/SKILL.md`;

function fail(msg: string): never {
	console.error(`smoke-dual-agent-do: FAIL ${msg}`);
	process.exit(1);
}

for (const f of AGENT_FILES) {
	if (!existsSync(f)) fail(`MISSING: ${f}`);
}

function readFrontmatter(path: string): Record<string, string> {
	const body = readFileSync(path, "utf8");
	const match = body.match(/^---\n([\s\S]*?)\n---/);
	if (!match || match[1] === undefined) fail(`no frontmatter in ${path}`);
	const fm: Record<string, string> = {};
	for (const line of match[1].split("\n")) {
		const kv = line.match(/^([a-zA-Z_-]+):\s*(.+)$/);
		if (kv && kv[1] !== undefined && kv[2] !== undefined) {
			fm[kv[1]] = kv[2].trim();
		}
	}
	return fm;
}

const tester = readFrontmatter(`${ROOT}/.claude/agents/spec-tester.md`);
const judge = readFrontmatter(`${ROOT}/.claude/agents/spec-judge.md`);
const impl = readFrontmatter(`${ROOT}/.claude/agents/spec-implementer.md`);

if (tester.name !== "spec-tester") fail(`spec-tester name mismatch: ${tester.name}`);
if (judge.name !== "spec-judge") fail(`spec-judge name mismatch: ${judge.name}`);
if (impl.name !== "spec-implementer") fail(`spec-implementer name mismatch: ${impl.name}`);

if (!tester.model || !judge.model) fail("tester and judge must declare model");
if (tester.model === judge.model) {
	fail(`tester and judge must use different models (both are ${tester.model})`);
}

const judgeBody = readFileSync(`${ROOT}/.claude/agents/spec-judge.md`, "utf8");
const RUBRIC_KEYWORDS = [
	"acceptance criterion", // item 1: every AC maps to ≥1 test
	"violating intent", // item 2: adversarial gap-hunt
	"coverage", // item 3: testable property not covered
	"implementation detail", // item 4: robustness
];
for (const kw of RUBRIC_KEYWORDS) {
	if (!judgeBody.toLowerCase().includes(kw.toLowerCase())) {
		fail(`spec-judge.md missing rubric keyword: ${kw}`);
	}
}

if (!existsSync(SKILL_PATH)) fail(`MISSING: ${SKILL_PATH}`);
const skill = readFileSync(SKILL_PATH, "utf8");
for (const t of ["spec-tester", "spec-judge", "spec-implementer"]) {
	if (!skill.includes(t)) fail(`SKILL.md missing subagent reference: ${t}`);
}

if (!/kind[^\n]*writeup/i.test(skill)) {
	fail("SKILL.md missing writeup kind handling");
}

console.log("DUAL_AGENT_DO_OK");
