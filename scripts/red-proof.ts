/**
 * red-proof.ts — stubs only.
 * Implementations land in slice 2 after spec-judge freezes slice 1.
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

/** Pure: maps a gate path to the runner command. No spawn. */
export function pickRunner(_gatePath: string): PickRunnerResult {
	throw new Error("not implemented");
}

/** Pure: formats a proof record as the canonical text block. */
export function formatProof(_input: FormatProofInput): string {
	throw new Error("not implemented");
}
