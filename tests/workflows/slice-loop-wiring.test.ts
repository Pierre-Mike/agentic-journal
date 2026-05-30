/**
 * Per-slice gate (unit): slice runner self-validation loop foundation — spec 123, slice 3
 *
 * Asserts that .github/workflows/slice.yml is wired to invoke loop.ts and
 * no longer contains the old standalone agent-dispatch or push steps.
 *
 * RED until slice 3 (.github/workflows/slice.yml) is implemented.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "../..");
const SLICE_YML_PATH = join(REPO_ROOT, ".github/workflows/slice.yml");

function raw(): string {
	return readFileSync(SLICE_YML_PATH, "utf-8");
}

describe("slice.yml: loop.ts wiring", () => {
	test("slice.yml invokes bun scripts/slice/loop.ts", () => {
		expect(raw()).toMatch(/scripts\/slice\/loop\.ts/);
	});

	test("slice.yml does not contain 'Implement slice via Claude' step name", () => {
		expect(raw()).not.toMatch(/Implement slice via Claude/);
	});

	test("slice.yml does not have a standalone 'Push with retry' step name", () => {
		expect(raw()).not.toMatch(/name:\s+Push with retry/);
	});

	test("slice.yml does not have a standalone id:push step", () => {
		expect(raw()).not.toMatch(/^\s+id:\s+push\s*$/m);
	});

	test("slice.yml forwards CLAUDE_CODE_OAUTH_TOKEN to the loop step", () => {
		expect(raw()).toMatch(/CLAUDE_CODE_OAUTH_TOKEN/);
	});

	test("slice.yml forwards GH_TOKEN to the loop step", () => {
		expect(raw()).toMatch(/GH_TOKEN/);
	});
});
