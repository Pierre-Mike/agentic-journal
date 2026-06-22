import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const REPO = resolve(import.meta.dir, "..");

describe("055: CI traces artifacts — BDD outer gate", () => {
	describe("intent.yml artifact naming", () => {
		test("align job artifact is traces-intent-{run_id}-align", () => {
			const yml = readFileSync(`${REPO}/.github/workflows/intent.yml`, "utf-8");
			expect(yml).toContain("name: traces-intent-${{ github.run_id }}-align");
		});

		test("align job does not use old claude-traces-align- prefix", () => {
			const yml = readFileSync(`${REPO}/.github/workflows/intent.yml`, "utf-8");
			expect(yml).not.toContain("name: claude-traces-align-${{ github.run_id }}");
		});

		test("scaffold job artifact is traces-intent-{run_id}-scaffold", () => {
			const yml = readFileSync(`${REPO}/.github/workflows/intent.yml`, "utf-8");
			expect(yml).toContain("name: traces-intent-${{ github.run_id }}-scaffold");
		});

		test("scaffold job has no generic claude-traces-{run_id} step (duplicate removed)", () => {
			const yml = readFileSync(`${REPO}/.github/workflows/intent.yml`, "utf-8");
			expect(yml).not.toContain("name: claude-traces-${{ github.run_id }}");
		});
	});

	describe("slice.yml artifact naming", () => {
		test("implement-slice job artifact is traces-slice-{run_id}-implement-slice", () => {
			const yml = readFileSync(`${REPO}/.github/workflows/slice.yml`, "utf-8");
			expect(yml).toContain("name: traces-slice-${{ github.run_id }}-implement-slice");
		});

		test("slice.yml does not use old claude-traces- prefix", () => {
			const yml = readFileSync(`${REPO}/.github/workflows/slice.yml`, "utf-8");
			expect(yml).not.toContain("name: claude-traces-${{ github.run_id }}");
		});
	});

	describe("retention", () => {
		test("intent.yml trace upload steps use retention-days: 30", () => {
			const yml = readFileSync(`${REPO}/.github/workflows/intent.yml`, "utf-8");
			expect(yml).toContain("retention-days: 30");
		});

		test("intent.yml has no retention-days: 7 in trace upload steps", () => {
			const yml = readFileSync(`${REPO}/.github/workflows/intent.yml`, "utf-8");
			// Verify 7d retention is gone from trace upload contexts
			const traceUploadPattern =
				/- name: (?:Upload Claude traces[^\n]*)\n(?:.*\n)*?.*retention-days: 7/m;
			expect(yml).not.toMatch(traceUploadPattern);
		});

		test("slice.yml trace upload step uses retention-days: 30", () => {
			const yml = readFileSync(`${REPO}/.github/workflows/slice.yml`, "utf-8");
			expect(yml).toContain("retention-days: 30");
		});
	});

	describe("traces-fetch.ts script", () => {
		test("scripts/agentic/traces-fetch.ts exists", () => {
			expect(existsSync(`${REPO}/scripts/agentic/traces-fetch.ts`)).toBe(true);
		});

		test("scripts/agentic/traces-fetch.test.ts colocated test exists", () => {
			expect(existsSync(`${REPO}/scripts/agentic/traces-fetch.test.ts`)).toBe(true);
		});
	});

	describe(".gitignore", () => {
		test(".gitignore contains .claude/traces-mirror/", () => {
			const gitignore = readFileSync(`${REPO}/.gitignore`, "utf-8");
			expect(gitignore).toContain(".claude/traces-mirror/");
		});
	});

	describe("retro SKILL.md Step 2", () => {
		test("Step 2 calls bun scripts/agentic/traces-fetch.ts", () => {
			const skill = readFileSync(`${REPO}/.claude/skills/retro/SKILL.md`, "utf-8");
			expect(skill).toContain("bun scripts/agentic/traces-fetch.ts");
		});

		test("Step 2 scans .claude/traces-mirror for CI traces", () => {
			const skill = readFileSync(`${REPO}/.claude/skills/retro/SKILL.md`, "utf-8");
			expect(skill).toContain(".claude/traces-mirror");
		});

		test("Step 2 uses [ci] provenance label", () => {
			const skill = readFileSync(`${REPO}/.claude/skills/retro/SKILL.md`, "utf-8");
			expect(skill).toContain("[ci]");
		});

		test("Step 2 uses [local] provenance label", () => {
			const skill = readFileSync(`${REPO}/.claude/skills/retro/SKILL.md`, "utf-8");
			expect(skill).toContain("[local]");
		});
	});
});
