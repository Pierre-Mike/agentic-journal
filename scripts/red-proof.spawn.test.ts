/**
 * Integration tests for spec 042 slice 2: runProof spawn/capture/truncation/timeout.
 * These tests are RED until scripts/red-proof.ts exports a working runProof.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runProof } from "./red-proof";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeTmpDir(): string {
	const dir = join(tmpdir(), `red-proof-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	mkdirSync(dir, { recursive: true });
	return dir;
}

/** Write a .ts fixture file that exits with a given code + emits optional output. */
function writeFixtureScript(
	dir: string,
	name: string,
	opts: { exitCode?: number; stderr?: string; stdout?: string; lines?: number },
): string {
	const { exitCode = 1, stderr = "", stdout = "", lines = 0 } = opts;
	const parts: string[] = [];
	if (stderr) parts.push(`process.stderr.write(${JSON.stringify(stderr)});`);
	if (stdout) parts.push(`process.stdout.write(${JSON.stringify(stdout)});`);
	if (lines > 0) {
		// Emit `lines` lines to stdout to test truncation
		parts.push(`for (let i = 0; i < ${lines}; i++) process.stdout.write("line " + i + "\\n");`);
	}
	parts.push(`process.exit(${exitCode});`);
	const path = join(dir, name);
	writeFileSync(path, parts.join("\n"));
	return path;
}

/** Write a fixture that loops until killed (for timeout testing). */
function writeInfiniteScript(dir: string, name: string): string {
	const path = join(dir, name);
	writeFileSync(path, `setInterval(() => {}, 10_000);`);
	return path;
}

// ---------------------------------------------------------------------------
// runProof — basic spawn + capture
// ---------------------------------------------------------------------------

describe("runProof — spawn and capture", () => {
	test("returns exitCode from gate process (exit 1)", async () => {
		const dir = makeTmpDir();
		const gatePath = writeFixtureScript(dir, "fail.ts", { exitCode: 1 });
		const result = await runProof({ gatePath, cwd: dir });
		expect(result.exitCode).toBe(1);
	});

	test("returns exitCode 0 for a passing gate", async () => {
		const dir = makeTmpDir();
		const gatePath = writeFixtureScript(dir, "pass.ts", { exitCode: 0 });
		const result = await runProof({ gatePath, cwd: dir });
		expect(result.exitCode).toBe(0);
	});

	test("result.command matches pickRunner dispatch for .ts gate", async () => {
		const dir = makeTmpDir();
		const gatePath = writeFixtureScript(dir, "gate.ts", { exitCode: 1 });
		const result = await runProof({ gatePath, cwd: dir });
		expect(result.command).toEqual(["bun", "run", gatePath]);
	});

	test("result.command matches pickRunner dispatch for .test.ts gate", async () => {
		const dir = makeTmpDir();
		// Write a minimal bun test file that fails
		const path = join(dir, "gate.test.ts");
		writeFileSync(
			path,
			`import { test, expect } from "bun:test"; test("fail", () => { expect(1).toBe(2); });`,
		);
		const result = await runProof({ gatePath: path, cwd: dir });
		expect(result.command).toEqual(["bun", "test", path]);
		expect(result.exitCode).not.toBe(0);
	});

	test("captures stderr as string", async () => {
		const dir = makeTmpDir();
		const gatePath = writeFixtureScript(dir, "err.ts", {
			exitCode: 1,
			stderr: "some error output\n",
		});
		const result = await runProof({ gatePath, cwd: dir });
		expect(result.stderr).toContain("some error output");
	});

	test("captures stdout as string", async () => {
		const dir = makeTmpDir();
		const gatePath = writeFixtureScript(dir, "out.ts", {
			exitCode: 1,
			stdout: "hello from stdout\n",
		});
		const result = await runProof({ gatePath, cwd: dir });
		expect(result.stdout).toContain("hello from stdout");
	});

	test("durationMs is a non-negative number", async () => {
		const dir = makeTmpDir();
		const gatePath = writeFixtureScript(dir, "dur.ts", { exitCode: 1 });
		const result = await runProof({ gatePath, cwd: dir });
		expect(typeof result.durationMs).toBe("number");
		expect(result.durationMs).toBeGreaterThanOrEqual(0);
	});

	test("unsupported gate suffix → exitCode 127, empty stdout/stderr", async () => {
		const dir = makeTmpDir();
		const gatePath = join(dir, "gate.md");
		writeFileSync(gatePath, "# not runnable");
		const result = await runProof({ gatePath, cwd: dir });
		expect(result.exitCode).toBe(127);
	});
});

// ---------------------------------------------------------------------------
// runProof — stdout/stderr truncation to last 200 lines
// ---------------------------------------------------------------------------

describe("runProof — output truncation", () => {
	test("stdout with exactly 200 lines is NOT truncated", async () => {
		const dir = makeTmpDir();
		const gatePath = writeFixtureScript(dir, "exact200.ts", { exitCode: 1, lines: 200 });
		const result = await runProof({ gatePath, cwd: dir });
		const lines = result.stdout.split("\n").filter((l) => l.trim() !== "");
		expect(lines.length).toBe(200);
		expect(result.stdout).not.toContain("truncated");
	});

	test("stdout with 201 lines is truncated to last 200 lines", async () => {
		const dir = makeTmpDir();
		const gatePath = writeFixtureScript(dir, "over200.ts", { exitCode: 1, lines: 201 });
		const result = await runProof({ gatePath, cwd: dir });
		// The last line emitted is "line 200" (0-indexed)
		expect(result.stdout).toContain("line 200");
		// The first line emitted "line 0" should be gone
		const contentLines = result.stdout.split("\n");
		const hasLine0AsContent = contentLines.some((l) => l === "line 0");
		expect(hasLine0AsContent).toBe(false);
	});

	test("stdout with >200 lines includes truncation marker", async () => {
		const dir = makeTmpDir();
		const gatePath = writeFixtureScript(dir, "big.ts", { exitCode: 1, lines: 300 });
		const result = await runProof({ gatePath, cwd: dir });
		expect(result.stdout).toContain("truncated");
		expect(result.stdout).toContain("200 lines");
	});

	test("truncation marker appears before retained lines", async () => {
		const dir = makeTmpDir();
		const gatePath = writeFixtureScript(dir, "big2.ts", { exitCode: 1, lines: 300 });
		const result = await runProof({ gatePath, cwd: dir });
		const markerIdx = result.stdout.indexOf("truncated");
		// The last kept line "line 299" must appear after the marker
		const lastLineIdx = result.stdout.indexOf("line 299");
		expect(markerIdx).toBeGreaterThanOrEqual(0);
		expect(lastLineIdx).toBeGreaterThan(markerIdx);
	});

	test("stderr truncation: >200 lines includes marker and last 200 lines", async () => {
		const dir = makeTmpDir();
		// Build a script that writes 201 lines to stderr
		const path = join(dir, "stderr-big.ts");
		writeFileSync(
			path,
			`for (let i = 0; i < 201; i++) process.stderr.write("errline " + i + "\\n"); process.exit(1);`,
		);
		const result = await runProof({ gatePath: path, cwd: dir });
		expect(result.stderr).toContain("errline 200");
		expect(result.stderr).toContain("truncated");
		const hasErrline0AsContent = result.stderr.split("\n").some((l) => l === "errline 0");
		expect(hasErrline0AsContent).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// runProof — timeout semantics
// ---------------------------------------------------------------------------

describe("runProof — timeout", () => {
	test("timeout returns exitCode 124", async () => {
		const dir = makeTmpDir();
		const gatePath = writeInfiniteScript(dir, "infinite.ts");
		const result = await runProof({ gatePath, cwd: dir, timeoutMs: 500 });
		expect(result.exitCode).toBe(124);
	}, 5_000);

	test("timeout durationMs reflects actual wall time (>= timeoutMs)", async () => {
		const dir = makeTmpDir();
		const gatePath = writeInfiniteScript(dir, "infinite2.ts");
		const timeoutMs = 500;
		const result = await runProof({ gatePath, cwd: dir, timeoutMs });
		expect(result.durationMs).toBeGreaterThanOrEqual(timeoutMs);
	}, 5_000);

	test("default timeout is 60_000 ms (implicit — process does not hang)", async () => {
		// Verify that omitting timeoutMs doesn't crash — a fast gate still completes
		const dir = makeTmpDir();
		const gatePath = writeFixtureScript(dir, "fast.ts", { exitCode: 1 });
		const result = await runProof({ gatePath, cwd: dir }); // no timeoutMs
		expect(result.exitCode).toBe(1);
	}, 10_000);

	test("killed process stdout/stderr still captured (may be partial)", async () => {
		const dir = makeTmpDir();
		const gatePath = writeInfiniteScript(dir, "infinite3.ts");
		const result = await runProof({ gatePath, cwd: dir, timeoutMs: 500 });
		// After kill, stdout/stderr should be strings (may be empty)
		expect(typeof result.stdout).toBe("string");
		expect(typeof result.stderr).toBe("string");
	}, 5_000);
});

// ---------------------------------------------------------------------------
// runProof — smoke entry integration
// ---------------------------------------------------------------------------

describe("runProof — smoke entry (import.meta.main)", () => {
	test("smoke script exits 0 for a non-zero gate and writes proof file", async () => {
		const dir = makeTmpDir();
		const gatePath = writeFixtureScript(dir, "fail-gate.ts", {
			exitCode: 1,
			stderr: "assertion error",
		});
		const outPath = join(dir, "proof.txt");

		// Run the smoke entry directly
		const proc = Bun.spawn(
			["bun", "run", join(import.meta.dir, "red-proof.ts"), gatePath, outPath],
			{ cwd: dir, stdout: "pipe", stderr: "pipe" },
		);
		const exitCode = await proc.exited;

		// Smoke entry exits 0 (proof file is the artifact)
		expect(exitCode).toBe(0);
		// Proof file must exist
		expect(existsSync(outPath)).toBe(true);
	});

	test("proof file written by smoke entry contains exit_code header", async () => {
		const dir = makeTmpDir();
		const gatePath = writeFixtureScript(dir, "fail-gate2.ts", { exitCode: 1 });
		const outPath = join(dir, "proof2.txt");

		const proc = Bun.spawn(
			["bun", "run", join(import.meta.dir, "red-proof.ts"), gatePath, outPath],
			{ cwd: dir, stdout: "pipe", stderr: "pipe" },
		);
		await proc.exited;

		const text = await Bun.file(outPath).text();
		expect(text).toMatch(/^exit_code: \d+/);
	});

	test("smoke entry exits non-zero when no gatePath arg supplied", async () => {
		const proc = Bun.spawn(["bun", "run", join(import.meta.dir, "red-proof.ts")], {
			cwd: process.cwd(),
			stdout: "pipe",
			stderr: "pipe",
		});
		const code = await proc.exited;
		expect(code).not.toBe(0);
	});
});
