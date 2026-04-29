/**
 * Colocated bun:test for `scripts/smoke-dual-agent-do.ts`.
 *
 * Uses `DUAL_AGENT_ROOT` env override to point the gate at synthetic tmp
 * fixtures, so the gate's positive and negative cases can be exercised
 * without mutating the real repo.
 */

import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let tmpRoot: string;

afterEach(() => {
	if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true });
});

function writeAgent(dir: string, name: string, model: string, body: string) {
	const fm = `---\nname: ${name}\nmodel: ${model}\ntools: [Read]\n---\n\n${body}`;
	writeFileSync(join(dir, `${name}.md`), fm);
}

function runGate(root: string) {
	return Bun.spawnSync(["bun", "scripts/smoke/smoke-dual-agent-do.ts"], {
		env: { ...process.env, DUAL_AGENT_ROOT: root },
	});
}

const FULL_RUBRIC = `Rubric:
1. Does every acceptance criterion map to at least one test?
2. Name one concrete way the implementation could pass all tests while violating intent.
3. Any testable property in the intent that no test covers? (coverage gap)
4. Are tests pinned to observable behavior or to an implementation detail?`;

test("gate passes on a well-formed agent set", () => {
	tmpRoot = mkdtempSync(join(tmpdir(), "dual-agent-"));
	mkdirSync(join(tmpRoot, ".claude/agents"), { recursive: true });
	mkdirSync(join(tmpRoot, ".claude/skills/do"), { recursive: true });

	writeAgent(join(tmpRoot, ".claude/agents"), "spec-tester", "sonnet", "tester");
	writeAgent(join(tmpRoot, ".claude/agents"), "spec-judge", "opus", FULL_RUBRIC);
	writeAgent(join(tmpRoot, ".claude/agents"), "spec-implementer", "sonnet", "implementer");
	writeFileSync(
		join(tmpRoot, ".claude/skills/do/SKILL.md"),
		"spec-tester\nspec-judge\nspec-implementer\nif kind is writeup skip judge",
	);

	const r = runGate(tmpRoot);
	expect(r.exitCode).toBe(0);
});

test("gate fails when tester and judge share the same model", () => {
	tmpRoot = mkdtempSync(join(tmpdir(), "dual-agent-"));
	mkdirSync(join(tmpRoot, ".claude/agents"), { recursive: true });
	mkdirSync(join(tmpRoot, ".claude/skills/do"), { recursive: true });

	writeAgent(join(tmpRoot, ".claude/agents"), "spec-tester", "sonnet", "tester");
	writeAgent(join(tmpRoot, ".claude/agents"), "spec-judge", "sonnet", FULL_RUBRIC);
	writeAgent(join(tmpRoot, ".claude/agents"), "spec-implementer", "sonnet", "implementer");
	writeFileSync(
		join(tmpRoot, ".claude/skills/do/SKILL.md"),
		"spec-tester spec-judge spec-implementer writeup",
	);

	const r = runGate(tmpRoot);
	expect(r.exitCode).toBe(1);
});

test("gate fails when judge body is missing a rubric keyword", () => {
	tmpRoot = mkdtempSync(join(tmpdir(), "dual-agent-"));
	mkdirSync(join(tmpRoot, ".claude/agents"), { recursive: true });
	mkdirSync(join(tmpRoot, ".claude/skills/do"), { recursive: true });

	writeAgent(join(tmpRoot, ".claude/agents"), "spec-tester", "sonnet", "tester");
	writeAgent(join(tmpRoot, ".claude/agents"), "spec-judge", "opus", "missing some keywords here");
	writeAgent(join(tmpRoot, ".claude/agents"), "spec-implementer", "sonnet", "implementer");
	writeFileSync(
		join(tmpRoot, ".claude/skills/do/SKILL.md"),
		"spec-tester spec-judge spec-implementer writeup",
	);

	const r = runGate(tmpRoot);
	expect(r.exitCode).toBe(1);
});

test("gate fails when an agent file is missing", () => {
	tmpRoot = mkdtempSync(join(tmpdir(), "dual-agent-"));
	mkdirSync(join(tmpRoot, ".claude/agents"), { recursive: true });
	mkdirSync(join(tmpRoot, ".claude/skills/do"), { recursive: true });

	writeAgent(join(tmpRoot, ".claude/agents"), "spec-tester", "sonnet", "tester");
	writeAgent(join(tmpRoot, ".claude/agents"), "spec-judge", "opus", FULL_RUBRIC);
	// implementer missing
	writeFileSync(
		join(tmpRoot, ".claude/skills/do/SKILL.md"),
		"spec-tester spec-judge spec-implementer writeup",
	);

	const r = runGate(tmpRoot);
	expect(r.exitCode).toBe(1);
});

test("gate fails when SKILL.md does not handle the writeup kind", () => {
	tmpRoot = mkdtempSync(join(tmpdir(), "dual-agent-"));
	mkdirSync(join(tmpRoot, ".claude/agents"), { recursive: true });
	mkdirSync(join(tmpRoot, ".claude/skills/do"), { recursive: true });

	writeAgent(join(tmpRoot, ".claude/agents"), "spec-tester", "sonnet", "tester");
	writeAgent(join(tmpRoot, ".claude/agents"), "spec-judge", "opus", FULL_RUBRIC);
	writeAgent(join(tmpRoot, ".claude/agents"), "spec-implementer", "sonnet", "implementer");
	writeFileSync(
		join(tmpRoot, ".claude/skills/do/SKILL.md"),
		"spec-tester spec-judge spec-implementer (no writeup keyword here)",
	);

	const r = runGate(tmpRoot);
	expect(r.exitCode).toBe(1);
});
