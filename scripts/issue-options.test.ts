/**
 * Unit tests for scripts/issue-options.ts
 * Covered: renderFailureMenu, parseFailureChoice
 *
 * These tests are RED until the implementation file exists.
 */

import { describe, expect, test } from "bun:test";
import { parseFailureChoice, renderFailureMenu } from "./issue-options.ts";

const SAMPLE_INPUT = {
	sliceId: "3",
	sliceTitle: "issue-options.ts: failure menu emitter",
	attemptCount: 2,
	lastError: "import resolution failed",
	runUrl: "https://github.com/owner/repo/actions/runs/99887766",
};

// ---------------------------------------------------------------------------
// renderFailureMenu
// ---------------------------------------------------------------------------

describe("renderFailureMenu", () => {
	test("contains all 4 options as unchecked checkboxes", () => {
		const body = renderFailureMenu(SAMPLE_INPUT);
		expect(body).toContain("- [ ] retry");
		expect(body).toContain("- [ ] split");
		expect(body).toContain("- [ ] skip");
		expect(body).toContain("- [ ] abort");
	});

	test("includes sliceId in output", () => {
		const body = renderFailureMenu(SAMPLE_INPUT);
		expect(body).toContain(SAMPLE_INPUT.sliceId);
	});

	test("includes sliceTitle in output", () => {
		const body = renderFailureMenu(SAMPLE_INPUT);
		expect(body).toContain(SAMPLE_INPUT.sliceTitle);
	});

	test("includes attemptCount in output", () => {
		const body = renderFailureMenu(SAMPLE_INPUT);
		expect(body).toContain(String(SAMPLE_INPUT.attemptCount));
	});

	test("includes a link to runUrl", () => {
		const body = renderFailureMenu(SAMPLE_INPUT);
		expect(body).toContain(SAMPLE_INPUT.runUrl);
	});

	test("is deterministic for a given input (snapshot-stable)", () => {
		const first = renderFailureMenu(SAMPLE_INPUT);
		const second = renderFailureMenu(SAMPLE_INPUT);
		expect(first).toBe(second);
	});

	test("differs when sliceId differs", () => {
		const a = renderFailureMenu({ ...SAMPLE_INPUT, sliceId: "3" });
		const b = renderFailureMenu({ ...SAMPLE_INPUT, sliceId: "7" });
		expect(a).not.toBe(b);
	});
});

// ---------------------------------------------------------------------------
// parseFailureChoice
// ---------------------------------------------------------------------------

describe("parseFailureChoice", () => {
	test('returns "retry" for comment containing "[x] retry"', () => {
		expect(parseFailureChoice("- [x] retry")).toBe("retry");
	});

	test('returns "split" for comment containing "[x] split"', () => {
		expect(parseFailureChoice("- [x] split")).toBe("split");
	});

	test('returns "skip" for comment containing "[x] skip"', () => {
		expect(parseFailureChoice("- [x] skip")).toBe("skip");
	});

	test('returns "abort" for comment containing "[x] abort"', () => {
		expect(parseFailureChoice("- [x] abort")).toBe("abort");
	});

	test("returns null when no box is ticked", () => {
		const noTick = `- [ ] retry\n- [ ] split\n- [ ] skip\n- [ ] abort`;
		expect(parseFailureChoice(noTick)).toBeNull();
	});

	test("returns null when multiple boxes are ticked (ambiguous)", () => {
		const multiTick = `- [x] retry\n- [x] split\n- [ ] skip\n- [ ] abort`;
		expect(parseFailureChoice(multiTick)).toBeNull();
	});

	test("returns null for an unrecognised checked option", () => {
		// A checked label that isn't one of the 4 valid choices
		expect(parseFailureChoice("- [x] deploy")).toBeNull();
	});

	test("is case-insensitive for the [x] marker", () => {
		// GitHub renders both [x] and [X] as checked
		expect(parseFailureChoice("- [X] retry")).toBe("retry");
	});

	test("returns null for empty string", () => {
		expect(parseFailureChoice("")).toBeNull();
	});

	test("ignores surrounding prose and still detects single tick", () => {
		const withProse = `Thanks for the run log.\n\n- [ ] retry\n- [x] skip\n- [ ] abort\n\nLet me know.`;
		expect(parseFailureChoice(withProse)).toBe("skip");
	});
});
