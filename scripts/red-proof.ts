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
