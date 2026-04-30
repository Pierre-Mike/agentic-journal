import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const CI_STEPS = [
	"typecheck",
	"lint:ci",
	"spec:lint",
	"tasks:verify",
	"test",
	"gate",
] as const;

type StepName = (typeof CI_STEPS)[number];

type StepResult = {
	ok: boolean;
	stdout: string;
	stderr: string;
	exit: number;
};

export type Executor = (step: StepName, gatePath: string) => Promise<StepResult>;

const ARTIFACT_DIR = "/tmp/local-ci";

const STEP_COMMANDS: Record<StepName, (gatePath: string) => readonly string[]> = {
	typecheck: () => ["bun", "run", "typecheck"],
	"lint:ci": () => ["bun", "run", "lint:ci"],
	"spec:lint": () => ["bun", "run", "spec:lint"],
	"tasks:verify": () => ["bun", "run", "tasks:verify"],
	test: () => ["bun", "test"],
	gate: (gatePath) => ["bun", "test", gatePath],
};

async function defaultExecutor(step: StepName, gatePath: string): Promise<StepResult> {
	const cmd = STEP_COMMANDS[step](gatePath);
	const proc = Bun.spawn([...cmd], { stdout: "pipe", stderr: "pipe" });
	const [stdout, stderr, exit] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	return { ok: exit === 0, stdout, stderr, exit };
}

function writeArtifacts(step: StepName, result: StepResult): void {
	writeFileSync(join(ARTIFACT_DIR, `${step}.stdout`), result.stdout);
	writeFileSync(join(ARTIFACT_DIR, `${step}.stderr`), result.stderr);
	writeFileSync(join(ARTIFACT_DIR, `${step}.exit`), String(result.exit));
}

export async function runLocalCi(opts: {
	gatePath: string;
	executor?: Executor;
}): Promise<{ ok: boolean; failedStep?: string }> {
	const executor = opts.executor ?? defaultExecutor;

	rmSync(ARTIFACT_DIR, { recursive: true, force: true });
	mkdirSync(ARTIFACT_DIR, { recursive: true });

	for (const step of CI_STEPS) {
		const result = await executor(step, opts.gatePath);
		writeArtifacts(step, result);
		if (!result.ok) {
			return { ok: false, failedStep: step };
		}
	}

	return { ok: true };
}
