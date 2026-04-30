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
// runProof — spawn + capture + truncation + timeout
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

const TAIL_LINES = 200;

function tailTruncate(text: string): string {
	const lines = text.split("\n");
	// If the text ends with a newline, the last element is ""; don't count it as a line
	const hasTrailingNewline = text.endsWith("\n");
	const contentLines = hasTrailingNewline ? lines.slice(0, -1) : lines;
	if (contentLines.length <= TAIL_LINES) return text;
	const kept = contentLines.slice(contentLines.length - TAIL_LINES);
	return `... (truncated, kept last ${TAIL_LINES} lines)\n${kept.join("\n")}${hasTrailingNewline ? "\n" : ""}`;
}

/**
 * Spawns the gate process, captures stderr+stdout, enforces timeout.
 * - stderr and stdout are each truncated to the last 200 lines.
 * - If truncated, a marker line is prepended: `... (truncated, kept last 200 lines)`
 * - Timeout kills the process and returns exitCode 124.
 * - Always resolves (never rejects).
 */
export async function runProof(input: RunProofInput): Promise<RunProofResult> {
	const { gatePath, cwd, timeoutMs = 60_000 } = input;
	const { runnable, cmd } = pickRunner(gatePath);

	if (!runnable) {
		return {
			exitCode: 127,
			command: [],
			durationMs: 0,
			stderr: "",
			stdout: "",
		};
	}

	const start = Date.now();

	const proc = Bun.spawn(cmd, {
		cwd,
		stdout: "pipe",
		stderr: "pipe",
	});

	let timedOut = false;
	const timer = setTimeout(() => {
		timedOut = true;
		proc.kill();
	}, timeoutMs);

	const [exitCode, stdoutBuf, stderrBuf] = await Promise.all([
		proc.exited,
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
	]);

	clearTimeout(timer);

	const durationMs = Date.now() - start;

	return {
		exitCode: timedOut ? 124 : exitCode,
		command: cmd,
		durationMs,
		stderr: tailTruncate(stderrBuf),
		stdout: tailTruncate(stdoutBuf),
	};
}

// ---------------------------------------------------------------------------
// Smoke entry
//
// Usage: bun run scripts/red-proof.ts <gatePath> [outPath]
//   1. Calls runProof({ gatePath, cwd, timeoutMs: 60_000 })
//   2. Writes formatProof output to outPath (default: cwd/red-proof-smoke.txt)
//   3. Always exits 0 — proof file is the artifact
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
		const text = formatProof(result);
		await Bun.write(outPath, text);
		process.stdout.write(`red-proof written to ${outPath}\n`);
		process.exit(0);
	} catch (err) {
		process.stderr.write(`red-proof failed: ${err instanceof Error ? err.message : String(err)}\n`);
		process.exit(1);
	}
}
