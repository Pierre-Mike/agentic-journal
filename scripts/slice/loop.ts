import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runLocalCi as ciRunner } from "./local-ci.ts";

export type LoopOpts = {
	readonly sliceId: number;
	readonly specId: string;
	readonly branch: string;
	readonly gatePath: string;
	readonly slug: string;
	readonly runAgent?: () => Promise<void>;
	readonly runLocalCi?: (opts: {
		gatePath: string;
	}) => Promise<{ ok: boolean; failedStep?: string }>;
	readonly pushWithRetry?: (branch: string) => Promise<void>;
	readonly commitWip?: (slug: string, branch: string) => Promise<string>;
	readonly openSliceStuckIssue?: (opts: {
		slug: string;
		failedStep: string;
		specId: string;
	}) => Promise<void>;
	readonly validateBoundary?: (
		boundary: string[],
	) => Promise<{ ok: boolean; violations: string[] }>;
	readonly getBoundary?: () => string[];
	readonly getSha7?: () => Promise<string>;
};

async function sh(cmd: readonly string[]): Promise<{ ok: boolean; out: string }> {
	const proc = Bun.spawn([...cmd], { stdout: "pipe", stderr: "pipe" });
	const out = await new Response(proc.stdout).text();
	const code = await proc.exited;
	return { ok: code === 0, out };
}

async function defaultGetSha7(): Promise<string> {
	const { out } = await sh(["git", "rev-parse", "--short=7", "HEAD"]);
	return out.trim();
}

async function defaultPushWithRetry(branch: string): Promise<void> {
	for (let attempt = 1; attempt <= 3; attempt++) {
		const proc = Bun.spawn(["git", "push", "origin", branch], {
			stdout: "inherit",
			stderr: "inherit",
		});
		const code = await proc.exited;
		if (code === 0) return;
		if (attempt < 3) {
			await sh(["git", "pull", "--rebase", "origin", branch]);
		}
	}
	throw new Error(`Push failed for branch ${branch} after 3 attempts`);
}

async function defaultCommitWip(slug: string, _branch: string): Promise<string> {
	const sha7 = await defaultGetSha7();
	await sh(["git", "add", "-A"]);
	await sh(["git", "commit", "--allow-empty", "-m", `wip(${slug}): partial — local-ci RED`]);
	await sh(["git", "push", "origin", `HEAD:refs/heads/wip/${slug}-${sha7}`]);
	return sha7;
}

async function defaultOpenSliceStuckIssue(opts: {
	slug: string;
	failedStep: string;
	specId: string;
}): Promise<void> {
	const title = `slice-stuck: ${opts.slug} step=${opts.failedStep}`;
	const body = `Slice runner halted at step \`${opts.failedStep}\` for spec \`${opts.specId}\`.`;
	await sh(["gh", "label", "create", "slice-stuck", "--color", "CC0000", "--force"]);
	await sh(["gh", "issue", "create", "--title", title, "--body", body, "--label", "slice-stuck"]);
}

async function defaultValidateBoundary(
	boundary: string[],
): Promise<{ ok: boolean; violations: string[] }> {
	if (boundary.length === 0) return { ok: true, violations: [] };
	const unstaged = await sh(["git", "diff", "--name-only", "HEAD"]);
	const staged = await sh(["git", "diff", "--cached", "--name-only"]);
	const changed = [
		...unstaged.out.trim().split("\n").filter(Boolean),
		...staged.out.trim().split("\n").filter(Boolean),
	];
	const violations = changed.filter(
		(file) =>
			!boundary.some((pattern) => {
				const re = pattern
					.replace(/[.+^${}()|[\]\\]/g, "\\$&")
					.replace(/\\\*\\\*/g, "DSTAR")
					.replace(/\\\*/g, "[^/]*")
					.replace(/DSTAR/g, ".*");
				return new RegExp(`^${re}`).test(file);
			}),
	);
	return { ok: violations.length === 0, violations };
}

function defaultGetBoundary(specId: string): string[] {
	const tasksPath = join("specs/active", specId, "tasks.md");
	if (!existsSync(tasksPath)) return [];
	const lines = readFileSync(tasksPath, "utf-8").split("\n");
	const boundaries: string[] = [];
	for (const line of lines) {
		const m = line.match(/^\s+(?:-\s+)?boundary:\s*(.+)$/);
		const val = m?.[1];
		if (val !== undefined) {
			boundaries.push(
				...val
					.split(",")
					.map((s) => s.trim())
					.filter(Boolean),
			);
		}
	}
	return boundaries;
}

function makeDefaultRunAgent(sliceId: number, specId: string): () => Promise<void> {
	return async () => {
		const token = process.env.CLAUDE_CODE_OAUTH_TOKEN;
		if (!token) throw new Error("CLAUDE_CODE_OAUTH_TOKEN is required for runAgent");
		const prompt = [
			"You are the spec-implementer.",
			`Make slice ${sliceId} of spec ${specId} GREEN.`,
			`Read the frozen gate and implement only the file_targets declared in task ${sliceId}.`,
			"Run bun run tasks:verify.",
			"When GREEN, run a refactor pass scoped to the task's file_targets.",
			"Do not push — only commit.",
			"Use the expertise skill at .claude/skills/expertise/ if relevant patterns apply.",
		].join(" ");
		const proc = Bun.spawn(
			[
				"claude",
				"-p",
				"--no-session-persistence",
				"--max-turns",
				"50",
				"--allowedTools",
				"Bash(git:*),Bash(gh:*),Bash(bun:*),Bash(mkdir:*),Bash(mv:*),Bash(cp:*),Bash(rm:*),Edit,Write,Read,Glob,Grep",
				prompt,
			],
			{ stdout: "inherit", stderr: "inherit" },
		);
		const code = await proc.exited;
		if (code !== 0) throw new Error(`spec-implementer exited with code ${code}`);
	};
}

function parseArgs(argv: string[]): { sliceId: number; specId: string; branch: string } {
	const get = (flag: string): string | undefined => {
		const i = argv.indexOf(flag);
		return i !== -1 ? argv[i + 1] : undefined;
	};
	const sliceIdStr = get("--slice-id");
	const specId = get("--spec-id");
	const branch = get("--branch");
	if (!sliceIdStr || !specId || !branch) {
		throw new Error("Usage: bun scripts/slice/loop.ts --slice-id N --spec-id SPEC --branch BRANCH");
	}
	return { sliceId: parseInt(sliceIdStr, 10), specId, branch };
}

function gatePathForSlice(specId: string, sliceId: number): string {
	const tasksPath = join("specs/active", specId, "tasks.md");
	if (!existsSync(tasksPath)) return "";
	const lines = readFileSync(tasksPath, "utf-8").split("\n");
	let inSlice = false;
	for (const line of lines) {
		if (/^\s*-\s+id:\s*/.test(line)) {
			inSlice = line.includes(`id: ${sliceId}`) || line.trim() === `- id: ${sliceId}`;
		}
		if (inSlice) {
			const m = line.match(/^\s+gate:\s+(\S+)/);
			if (m?.[1]) return m[1];
		}
	}
	return "";
}

if (import.meta.main) {
	const { sliceId, specId, branch } = parseArgs(process.argv.slice(2));
	const gatePath = gatePathForSlice(specId, sliceId);
	const slug = specId.replace(/^\d+-/, "");
	const result = await runLoop({ sliceId, specId, branch, gatePath, slug });
	process.exit(result.outcome === "green" ? 0 : 0);
}

export async function runLoop(opts: LoopOpts): Promise<{ outcome: "green" | "red" }> {
	const {
		sliceId,
		specId,
		branch,
		gatePath,
		slug,
		runAgent = makeDefaultRunAgent(sliceId, specId),
		runLocalCi = ciRunner,
		pushWithRetry = defaultPushWithRetry,
		commitWip = defaultCommitWip,
		openSliceStuckIssue = defaultOpenSliceStuckIssue,
		validateBoundary = defaultValidateBoundary,
		getBoundary = () => defaultGetBoundary(specId),
	} = opts;

	// 1. Run the agent
	await runAgent();

	// 2. Validate boundary (after agent, before push decision)
	const boundary = getBoundary();
	const boundaryResult = await validateBoundary(boundary);
	if (!boundaryResult.ok) {
		await commitWip(slug, branch);
		await openSliceStuckIssue({ slug, failedStep: "boundary", specId });
		return { outcome: "red" };
	}

	// 3. Run local CI steps
	const ciResult = await runLocalCi({ gatePath });
	if (!ciResult.ok) {
		const failedStep = ciResult.failedStep ?? "unknown";
		await commitWip(slug, branch);
		await openSliceStuckIssue({ slug, failedStep, specId });
		return { outcome: "red" };
	}

	// 4. GREEN: push
	await pushWithRetry(branch);
	return { outcome: "green" };
}
