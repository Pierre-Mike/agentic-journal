// @no-test: sibling test is the frozen gate committed in RED state by spec-tester (spec 042 slice 1)
/**
 * red-proof.ts — pure functions for RED-proof runner dispatch and proof formatting.
 * Spawn/timeout/orchestration is slice 2.
 */

export interface PickRunnerResult {
	cmd: string[];
	runnable: boolean;
}

export interface FormatProofInput {
	exitCode: number;
	command: string[];
	durationMs: number;
	stderr: string;
	stdout: string;
}

/**
 * Pure: maps a gate path to the runner command. No spawn.
 *
 * Dispatch rules (suffix-based):
 *   *.test.ts  → ["bun", "test", gatePath]
 *   *.ts       → ["bun", "run", gatePath]
 *   other      → not runnable, empty cmd (caller emits exit_code 127)
 */
export function pickRunner(gatePath: string): PickRunnerResult {
	if (gatePath.endsWith(".test.ts")) {
		return { runnable: true, cmd: ["bun", "test", gatePath] };
	}
	if (gatePath.endsWith(".ts")) {
		return { runnable: true, cmd: ["bun", "run", gatePath] };
	}
	return { runnable: false, cmd: [] };
}

/**
 * Pure: formats a proof record as the canonical text block.
 *
 * Format:
 *   exit_code: <N>
 *   command: <invocation joined with spaces>
 *   duration_ms: <N>
 *   --- stderr (tail 200) ---
 *   <stderr content>
 *   --- stdout (tail 200) ---
 *   <stdout content>
 */
export function formatProof(input: FormatProofInput): string {
	const { exitCode, command, durationMs, stderr, stdout } = input;
	const invocation = command.join(" ");
	return [
		`exit_code: ${exitCode}`,
		`command: ${invocation}`,
		`duration_ms: ${durationMs}`,
		`--- stderr (tail 200) ---`,
		stderr,
		`--- stdout (tail 200) ---`,
		stdout,
	].join("\n");
}

// ---------------------------------------------------------------------------
// Slice 2: runProof — spawn + capture + truncation + timeout
// NOT YET IMPLEMENTED. The smoke entry below will fail (non-zero exit) until
// this is implemented.
// ---------------------------------------------------------------------------

export interface RunProofInput {
	/** Absolute or repo-relative gate path to run. */
	gatePath: string;
	/** Working directory for the spawned process. */
	cwd: string;
	/** Timeout in milliseconds. Default: 60_000. On timeout: exitCode 124. */
	timeoutMs?: number;
}

export interface RunProofResult {
	exitCode: number;
	command: string[];
	durationMs: number;
	stderr: string;
	stdout: string;
}

/**
 * Spawns the gate process, captures stderr+stdout, enforces timeout.
 * - stderr and stdout are each truncated to the last 200 lines.
 * - If truncated, a marker line is prepended: `... (truncated, kept last 200 lines)`
 * - Timeout kills the process and returns exitCode 124.
 * - Always resolves (never rejects).
 *
 * NOT YET IMPLEMENTED — throws to keep gate RED.
 */
export async function runProof(_input: RunProofInput): Promise<RunProofResult> {
	throw new Error("runProof: not implemented (slice 2)");
}

// ---------------------------------------------------------------------------
// Smoke entry — gate for spec 042 slice 2
//
// When run as: bun run scripts/red-proof.ts <gatePath> [outPath]
//   1. Calls runProof({ gatePath, cwd, timeoutMs: 60_000 })
//   2. Writes red-proof-N.txt to outPath (default: cwd/red-proof-smoke.txt)
//   3. Exits 0 on success (proof file is the artifact)
//
// While runProof is not implemented, this exits non-zero (RED).
// ---------------------------------------------------------------------------

if (import.meta.main) {
	const args = process.argv.slice(2);
	const gatePath = args[0];
	if (!gatePath) {
		process.stderr.write("Usage: bun run scripts/red-proof.ts <gatePath> [outPath]\n");
		process.exit(1);
	}

	const cwd = process.cwd();
	const outPath = args[1] ?? `${cwd}/red-proof-smoke.txt`;

	try {
		const result = await runProof({ gatePath, cwd, timeoutMs: 60_000 });
		const text = formatProof({
			exitCode: result.exitCode,
			command: result.command,
			durationMs: result.durationMs,
			stderr: result.stderr,
			stdout: result.stdout,
		});
		await Bun.write(outPath, text);
		process.stdout.write(`red-proof written to ${outPath}\n`);
		process.exit(0);
	} catch (err) {
		process.stderr.write(`red-proof failed: ${err instanceof Error ? err.message : String(err)}\n`);
		process.exit(1);
	}
}
