/**
 * Colocated unit tests for the pure functions in scripts/ci-feedback.ts.
 * Covered: parseFailingChecks, extractRunId, formatFailureBrief.
 * IO helpers (fetchPrChecks, fetchFailingLogs, writeBrief, resolveActiveSpecDir)
 * are exercised by scripts/smoke-ci-feedback.ts instead.
 */

import { describe, expect, test } from "bun:test";
import {
	extractRunId,
	type FailingCheck,
	formatFailureBrief,
	type PrInfo,
	parseFailingChecks,
} from "./ci-feedback.ts";

describe("parseFailingChecks", () => {
	test("returns empty array for empty input array", () => {
		expect(parseFailingChecks({ checksJson: [] })).toEqual([]);
	});

	test("skips rows with state SUCCESS", () => {
		const checksJson = [
			{
				name: "typecheck",
				state: "SUCCESS",
				link: "https://github.com/a/b/actions/runs/111/job/222",
			},
		];
		expect(parseFailingChecks({ checksJson })).toEqual([]);
	});

	test("keeps rows with state FAILURE", () => {
		const checksJson = [
			{
				name: "typecheck",
				state: "FAILURE",
				link: "https://github.com/a/b/actions/runs/111/job/222",
			},
		];
		const result = parseFailingChecks({ checksJson });
		expect(result.length).toBe(1);
		expect(result[0]?.name).toBe("typecheck");
		expect(result[0]?.conclusion).toBe("FAILURE");
		expect(result[0]?.detailsUrl).toBe("https://github.com/a/b/actions/runs/111/job/222");
		expect(result[0]?.runId).toBe("111");
	});

	test("keeps rows with state PENDING (non-success is failing)", () => {
		const checksJson = [
			{
				name: "slow-test",
				state: "PENDING",
				link: "https://github.com/a/b/actions/runs/333/job/444",
			},
		];
		const result = parseFailingChecks({ checksJson });
		expect(result.length).toBe(1);
		expect(result[0]?.conclusion).toBe("PENDING");
	});

	test("mixed array → only non-success rows returned, in input order", () => {
		const checksJson = [
			{
				name: "ok",
				state: "SUCCESS",
				link: "https://github.com/a/b/actions/runs/1/job/1",
			},
			{
				name: "bad",
				state: "FAILURE",
				link: "https://github.com/a/b/actions/runs/2/job/2",
			},
			{
				name: "slow",
				state: "PENDING",
				link: "https://github.com/a/b/actions/runs/3/job/3",
			},
		];
		const result = parseFailingChecks({ checksJson });
		expect(result.map((r) => r.name)).toEqual(["bad", "slow"]);
	});

	test("rejects non-array input", () => {
		expect(() => parseFailingChecks({ checksJson: null })).toThrow();
		expect(() => parseFailingChecks({ checksJson: {} })).toThrow();
		expect(() => parseFailingChecks({ checksJson: "bad" })).toThrow();
	});

	test("rejects rows missing name/state/link", () => {
		expect(() => parseFailingChecks({ checksJson: [{ state: "FAILURE", link: "x" }] })).toThrow();
		expect(() => parseFailingChecks({ checksJson: [{ name: "a", link: "x" }] })).toThrow();
		expect(() => parseFailingChecks({ checksJson: [{ name: "a", state: "FAILURE" }] })).toThrow();
	});

	test("runId is null when link has no recognisable run id", () => {
		const checksJson = [
			{
				name: "external-check",
				state: "FAILURE",
				link: "https://example.com/not-a-gha-url",
			},
		];
		const result = parseFailingChecks({ checksJson });
		expect(result[0]?.runId).toBeNull();
	});
});

describe("extractRunId", () => {
	test("pulls run id out of a job URL", () => {
		expect(
			extractRunId({
				detailsUrl: "https://github.com/owner/repo/actions/runs/12345/job/67890",
			}),
		).toBe("12345");
	});

	test("pulls run id out of a bare run URL", () => {
		expect(
			extractRunId({
				detailsUrl: "https://github.com/owner/repo/actions/runs/12345",
			}),
		).toBe("12345");
	});

	test("returns null for non-GHA URLs", () => {
		expect(extractRunId({ detailsUrl: "https://example.com/foo" })).toBeNull();
	});

	test("returns null for empty string", () => {
		expect(extractRunId({ detailsUrl: "" })).toBeNull();
	});
});

describe("formatFailureBrief", () => {
	const pr: PrInfo = {
		url: "https://github.com/owner/repo/pull/42",
		headBranch: "spec/014-ci-feedback-loop",
	};
	const failingChecks: FailingCheck[] = [
		{
			name: "typecheck",
			conclusion: "FAILURE",
			detailsUrl: "https://github.com/owner/repo/actions/runs/111/job/222",
			runId: "111",
		},
		{
			name: "e2e",
			conclusion: "FAILURE",
			detailsUrl: "https://github.com/owner/repo/actions/runs/333/job/444",
			runId: "333",
		},
	];
	const logs: Record<string, string> = {
		"111": "ts error: cannot find module 'foo'",
		"333": "playwright timeout after 30s",
	};

	test("brief cites PR URL and head branch", () => {
		const out = formatFailureBrief({ pr, failingChecks, logs });
		expect(out).toContain("https://github.com/owner/repo/pull/42");
		expect(out).toContain("spec/014-ci-feedback-loop");
	});

	test("brief lists every failing check name", () => {
		const out = formatFailureBrief({ pr, failingChecks, logs });
		expect(out).toContain("typecheck");
		expect(out).toContain("e2e");
	});

	test("brief includes log excerpts for each run id", () => {
		const out = formatFailureBrief({ pr, failingChecks, logs });
		expect(out).toContain("ts error: cannot find module 'foo'");
		expect(out).toContain("playwright timeout after 30s");
	});

	test("missing log for a runId renders a placeholder, not an error", () => {
		const out = formatFailureBrief({
			pr,
			failingChecks,
			logs: { "111": "ts error: cannot find module 'foo'" },
		});
		expect(out).toContain("ts error: cannot find module 'foo'");
		// run 333 has no log entry — brief still mentions the check
		expect(out).toContain("e2e");
	});

	test("truncates long logs to last ~200 lines", () => {
		const big = Array.from({ length: 500 }, (_, i) => `line ${i + 1}`).join("\n");
		const out = formatFailureBrief({
			pr,
			failingChecks: [failingChecks[0] as FailingCheck],
			logs: { "111": big },
		});
		expect(out).toContain("line 500");
		expect(out).not.toContain("line 1\n");
		// Count how many "line N" occurrences we have in the output — should be near 200.
		const matches = out.match(/line \d+/g) ?? [];
		expect(matches.length).toBeLessThanOrEqual(210);
		expect(matches.length).toBeGreaterThanOrEqual(180);
	});

	test("empty failingChecks yields a brief that still mentions the PR", () => {
		const out = formatFailureBrief({ pr, failingChecks: [], logs: {} });
		expect(out).toContain("https://github.com/owner/repo/pull/42");
	});
});
