/**
 * Colocated unit tests for `scripts/red-commit-gate.ts` (016).
 *
 * Covers the nine-case matrix that pins the RED-spec subject regex:
 * positive matches (with title, no title, glued em-dash) and rejects
 * (capital-S Spec, lowercase red, missing spec id, unrelated commit, empty,
 * leading whitespace).
 *
 * Also exposes a default async function so this file works as a kind:rule gate
 * artifact (invoked by scripts/gates/rule.ts) — the default runs `bun test` on
 * this file as a subprocess and returns {pass, message}.
 */

import { describe, expect, test } from "bun:test";
import { shouldSkipTypecheck } from "./red-commit-gate.ts";

/**
 * When this module is imported by the kind:rule gate (not under the test
 * runner), `describe` throws. Probe safely and skip test registration in
 * that case — the gate's default export reinvokes `bun test` on this file
 * as a subprocess, which IS under the test runner.
 */
function underTestRunner(): boolean {
	try {
		describe.skip("__probe__", () => {});
		return true;
	} catch {
		return false;
	}
}

if (underTestRunner()) {
	registerTests();
}

function registerTests(): void {
	describe("shouldSkipTypecheck (016)", () => {
		test("RED with em-dash and title", () => {
			expect(shouldSkipTypecheck({ commitSubject: "spec(15): RED — foo" })).toBe(true);
		});
		test("RED with no title", () => {
			expect(shouldSkipTypecheck({ commitSubject: "spec(15): RED" })).toBe(true);
		});
		test("RED glued em-dash", () => {
			expect(shouldSkipTypecheck({ commitSubject: "spec(15): RED—foo" })).toBe(true);
		});
		test("rejects capital-S Spec", () => {
			expect(shouldSkipTypecheck({ commitSubject: "Spec(15): RED" })).toBe(false);
		});
		test("rejects lowercase red", () => {
			expect(shouldSkipTypecheck({ commitSubject: "spec(15): red — foo" })).toBe(false);
		});
		test("rejects missing spec id", () => {
			expect(shouldSkipTypecheck({ commitSubject: "spec(): RED" })).toBe(false);
		});
		test("rejects unrelated conventional commit", () => {
			expect(shouldSkipTypecheck({ commitSubject: "feat: bar" })).toBe(false);
		});
		test("rejects empty subject", () => {
			expect(shouldSkipTypecheck({ commitSubject: "" })).toBe(false);
		});
		test("rejects leading whitespace", () => {
			expect(shouldSkipTypecheck({ commitSubject: "  spec(15): RED" })).toBe(false);
		});
	});
}

/**
 * Default export so this file doubles as a kind:rule gate artifact.
 * Invokes `bun test` on itself; pass when exit code is 0.
 */
export default async function runGate(): Promise<{ pass: boolean; message: string }> {
	const proc = Bun.spawn(["bun", "test", import.meta.path], {
		stdout: "inherit",
		stderr: "inherit",
	});
	const code = await proc.exited;
	return {
		pass: code === 0,
		message: code === 0 ? "red-commit-gate tests pass" : "red-commit-gate tests failed",
	};
}
