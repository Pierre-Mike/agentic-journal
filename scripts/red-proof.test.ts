/**
 * Gate for spec 042 slice 1: unit tests for pickRunner + formatProof.
 * These tests are RED until scripts/red-proof.ts exports correct implementations.
 */

import { describe, expect, test } from "bun:test";
import { formatProof, pickRunner } from "./red-proof";

// ---------------------------------------------------------------------------
// pickRunner — runner dispatch by suffix
// ---------------------------------------------------------------------------

describe("pickRunner — runner dispatch", () => {
	test("*.test.ts gate → bun test <path>", () => {
		const result = pickRunner("foo.test.ts");
		expect(result.runnable).toBe(true);
		expect(result.cmd).toEqual(["bun", "test", "foo.test.ts"]);
	});

	test("*.test.ts gate with directory path", () => {
		const result = pickRunner("scripts/some-gate.test.ts");
		expect(result.runnable).toBe(true);
		expect(result.cmd).toEqual(["bun", "test", "scripts/some-gate.test.ts"]);
	});

	test("*.ts (non-test) gate → bun run <path>", () => {
		const result = pickRunner("foo.ts");
		expect(result.runnable).toBe(true);
		expect(result.cmd).toEqual(["bun", "run", "foo.ts"]);
	});

	test("*.ts smoke with directory path", () => {
		const result = pickRunner("scripts/smoke-check.ts");
		expect(result.runnable).toBe(true);
		expect(result.cmd).toEqual(["bun", "run", "scripts/smoke-check.ts"]);
	});

	test("unsupported suffix *.md → not runnable, cmd empty", () => {
		const result = pickRunner("foo.md");
		expect(result.runnable).toBe(false);
		expect(result.cmd).toEqual([]);
	});

	test("unsupported suffix *.sh → not runnable, cmd empty", () => {
		const result = pickRunner("foo.sh");
		expect(result.runnable).toBe(false);
		expect(result.cmd).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// Exit-code mapping contract (documented in public surface)
// ---------------------------------------------------------------------------

describe("exit-code semantics (constants / pure mapping)", () => {
	// These tests verify that pickRunner correctly signals runnable vs not,
	// and that the exit_code=127 reserved slot for unsupported is honoured.
	// The actual process exit codes (0, 1, 124) come from the orchestrator
	// in slice 2; here we only test the pure surface.

	test("runnable=true for .test.ts", () => {
		expect(pickRunner("gate.test.ts").runnable).toBe(true);
	});

	test("runnable=false for unsupported suffix reserves 127", () => {
		// Callers MUST emit exit_code 127 when runnable===false.
		// This test verifies the runnable flag alone — the 127 convention is
		// enforced by the orchestrator tested in slice 2.
		const result = pickRunner("gate.md");
		expect(result.runnable).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// formatProof — output shape
// ---------------------------------------------------------------------------

describe("formatProof — proof text format", () => {
	const base = {
		exitCode: 1,
		command: ["bun", "test", "scripts/red-proof.test.ts"],
		durationMs: 42,
		stderr: "Test failed: expected 1 to be 2",
		stdout: "",
	};

	test("line 1 is exit_code: <N>", () => {
		const text = formatProof(base);
		const lines = text.split("\n");
		expect(lines[0]).toBe("exit_code: 1");
	});

	test("line 2 is command: <invocation>", () => {
		const text = formatProof(base);
		const lines = text.split("\n");
		expect(lines[1]).toBe("command: bun test scripts/red-proof.test.ts");
	});

	test("line 3 is duration_ms: <N>", () => {
		const text = formatProof(base);
		const lines = text.split("\n");
		expect(lines[2]).toBe("duration_ms: 42");
	});

	test("stderr section header present", () => {
		const text = formatProof(base);
		expect(text).toContain("--- stderr (tail 200) ---");
	});

	test("stdout section header present", () => {
		const text = formatProof(base);
		expect(text).toContain("--- stdout (tail 200) ---");
	});

	test("stderr content included after section header", () => {
		const text = formatProof(base);
		const idx = text.indexOf("--- stderr (tail 200) ---");
		expect(idx).toBeGreaterThan(-1);
		const afterHeader = text.slice(idx + "--- stderr (tail 200) ---".length);
		expect(afterHeader).toContain("Test failed: expected 1 to be 2");
	});

	test("stdout content included after section header", () => {
		const input = { ...base, stdout: "some output line" };
		const text = formatProof(input);
		const idx = text.indexOf("--- stdout (tail 200) ---");
		expect(idx).toBeGreaterThan(-1);
		const afterHeader = text.slice(idx + "--- stdout (tail 200) ---".length);
		expect(afterHeader).toContain("some output line");
	});

	test("exit_code 0 renders correctly (gate passed — not RED)", () => {
		const text = formatProof({ ...base, exitCode: 0 });
		expect(text.startsWith("exit_code: 0")).toBe(true);
	});

	test("exit_code 124 renders correctly (timeout)", () => {
		const text = formatProof({ ...base, exitCode: 124 });
		expect(text.startsWith("exit_code: 124")).toBe(true);
	});

	test("exit_code 127 renders correctly (unsupported runner)", () => {
		const text = formatProof({ ...base, exitCode: 127 });
		expect(text.startsWith("exit_code: 127")).toBe(true);
	});

	test("command array joined with spaces", () => {
		const input = {
			...base,
			command: ["bun", "test", "scripts/foo.test.ts"],
		};
		const text = formatProof(input);
		expect(text).toContain("command: bun test scripts/foo.test.ts");
	});

	test("empty stderr renders empty body under section header", () => {
		const input = { ...base, stderr: "" };
		const text = formatProof(input);
		// Section header must still appear
		expect(text).toContain("--- stderr (tail 200) ---");
	});

	test("empty stdout renders empty body under section header", () => {
		const input = { ...base, stdout: "" };
		const text = formatProof(input);
		expect(text).toContain("--- stdout (tail 200) ---");
	});
});
