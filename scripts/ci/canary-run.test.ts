/**
 * Colocated unit tests for pure fns in scripts/canary-run.ts.
 * Covered: score (weighted pass-rate accounting).
 * IO (loadBaseline, runCanary, run) is exercised by scripts/smoke-canary.ts.
 */

import { describe, expect, test } from "bun:test";
import type { CanaryEntry, CanaryResult } from "./canary-run.ts";
import { score } from "./canary-run.ts";

const entry = (id: string, weight: number): CanaryEntry => ({
	id,
	description: `desc ${id}`,
	script_path: `canaries/scripts/${id}.ts`,
	expected_output: "",
	weight,
});

const result = (id: string, passed: boolean): CanaryResult => ({
	id,
	passed,
	exit_code: passed ? 0 : 1,
	stdout: "",
	duration_ms: 1,
	reason: passed ? null : "failed",
});

describe("score", () => {
	test("empty results and entries → pass_rate 1, zeros", () => {
		const rep = score([], []);
		expect(rep.total).toBe(0);
		expect(rep.passed).toBe(0);
		expect(rep.failed).toBe(0);
		expect(rep.skipped).toBe(0);
		expect(rep.pass_rate).toBe(1);
		expect(rep.results).toEqual([]);
	});

	test("all pass with equal weights → pass_rate 1", () => {
		const entries = [entry("a", 1), entry("b", 1)];
		const results = [result("a", true), result("b", true)];
		const rep = score(results, entries);
		expect(rep.total).toBe(2);
		expect(rep.passed).toBe(2);
		expect(rep.failed).toBe(0);
		expect(rep.pass_rate).toBe(1);
	});

	test("all fail → pass_rate 0", () => {
		const entries = [entry("a", 1), entry("b", 1)];
		const results = [result("a", false), result("b", false)];
		const rep = score(results, entries);
		expect(rep.passed).toBe(0);
		expect(rep.failed).toBe(2);
		expect(rep.pass_rate).toBe(0);
	});

	test("weighted: heavy canary failing drags rate lower than count rate", () => {
		const entries = [entry("a", 3), entry("b", 1)];
		const results = [result("a", false), result("b", true)];
		const rep = score(results, entries);
		// count rate = 1/2 = 0.5; weighted = 1/(3+1) = 0.25
		expect(rep.pass_rate).toBeCloseTo(0.25, 5);
	});

	test("weighted: heavy canary passing lifts rate above count rate", () => {
		const entries = [entry("a", 3), entry("b", 1)];
		const results = [result("a", true), result("b", false)];
		const rep = score(results, entries);
		// weighted = 3/4 = 0.75
		expect(rep.pass_rate).toBeCloseTo(0.75, 5);
	});

	test("result with no matching entry is counted as weight 1", () => {
		const entries = [entry("a", 1)];
		const results = [result("a", true), result("orphan", false)];
		const rep = score(results, entries);
		expect(rep.total).toBe(2);
		expect(rep.passed).toBe(1);
		expect(rep.failed).toBe(1);
		// weighted = 1 / (1 + 1) = 0.5
		expect(rep.pass_rate).toBeCloseTo(0.5, 5);
	});

	test("preserves result order in report.results", () => {
		const entries = [entry("a", 1), entry("b", 1)];
		const results = [result("b", true), result("a", true)];
		const rep = score(results, entries);
		expect(rep.results[0]?.id).toBe("b");
		expect(rep.results[1]?.id).toBe("a");
	});

	test("zero weight entry does not contribute to denominator", () => {
		const entries = [entry("a", 0), entry("b", 1)];
		const results = [result("a", false), result("b", true)];
		const rep = score(results, entries);
		// only b counts: 1/1 = 1
		expect(rep.pass_rate).toBe(1);
	});
});
