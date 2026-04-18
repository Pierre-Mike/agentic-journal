/**
 * Gate for spec 014-ci-feedback-loop.
 *
 * Real-assertion smoke: builds a tmpdir with a `gh` shim on PATH + fixture data
 * + a fake worktree containing `specs/active/fake-spec/proposal.md`, runs the
 * CLI, and asserts the generated `ci-failure.md` has the expected content.
 * Also covers `--dry-run` (CLI prints to stdout, no file written).
 */

import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let failed = 0;

function pass(name: string): void {
	process.stdout.write(`  \u2713 ${name}\n`);
}

function fail(name: string, detail?: string): void {
	process.stdout.write(`  \u2716 ${name}${detail !== undefined ? ` \u2014 ${detail}` : ""}\n`);
	failed++;
}

function assertTrue(cond: boolean, name: string, detail?: string): void {
	if (cond) pass(name);
	else fail(name, detail);
}

interface CheckRow {
	name: string;
	state: string;
	link: string;
}

const CHECKS_FIXTURE: CheckRow[] = [
	{
		name: "typecheck",
		state: "SUCCESS",
		link: "https://github.com/owner/repo/actions/runs/1/job/10",
	},
	{
		name: "e2e",
		state: "FAILURE",
		link: "https://github.com/owner/repo/actions/runs/2/job/20",
	},
	{
		name: "biome",
		state: "FAILURE",
		link: "https://github.com/owner/repo/actions/runs/3/job/30",
	},
];

const PR_INFO_FIXTURE = {
	url: "https://github.com/owner/repo/pull/42",
	headRefName: "spec/014-ci-feedback-loop",
};

const LOG_RUN_2 = `[e2e] Error: page.goto timeout 30000ms
	at /app/e2e/homepage.e2e.ts:11:5
[e2e] 1 failed, 0 passed`;

const LOG_RUN_3 = `scripts/ci-feedback.ts:42:1 lint/style/useConst
	Variable declared with let should be const`;

function buildGhShim(binDir: string, fixtureDir: string): void {
	mkdirSync(binDir, { recursive: true });
	const shim = `#!/bin/sh
set -e
CASE="$*"
case "$CASE" in
  "pr view "*"--json url,headRefName")
    cat "${fixtureDir}/pr-view.json"
    ;;
  "pr checks "*"--json name,state,link")
    cat "${fixtureDir}/pr-checks.json"
    ;;
  "run view 2 --log-failed")
    cat "${fixtureDir}/log-run-2.txt"
    ;;
  "run view 3 --log-failed")
    cat "${fixtureDir}/log-run-3.txt"
    ;;
  *)
    echo "gh shim: unknown call: $CASE" >&2
    exit 1
    ;;
esac
`;
	const ghPath = join(binDir, "gh");
	writeFileSync(ghPath, shim);
	chmodSync(ghPath, 0o755);
}

function writeFixtures(dir: string): void {
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "pr-view.json"), `${JSON.stringify(PR_INFO_FIXTURE)}\n`);
	writeFileSync(join(dir, "pr-checks.json"), `${JSON.stringify(CHECKS_FIXTURE)}\n`);
	writeFileSync(join(dir, "log-run-2.txt"), LOG_RUN_2);
	writeFileSync(join(dir, "log-run-3.txt"), LOG_RUN_3);
}

function buildFakeWorktree(root: string): string {
	const wt = join(root, "worktree");
	const activeSpec = join(wt, "specs", "active", "fake-spec");
	mkdirSync(activeSpec, { recursive: true });
	writeFileSync(
		join(activeSpec, "proposal.md"),
		"---\nid: fake-spec\ntitle: fake\nkind: workflow\ngate: scripts/smoke-fake.ts\n---\n\n# fake\n",
	);
	return wt;
}

async function spawnCli(args: {
	cliPath: string;
	prUrl: string;
	worktree: string;
	extraArgs: string[];
	binDir: string;
	fixtureDir: string;
}): Promise<{ code: number; stdout: string; stderr: string }> {
	const proc = Bun.spawn(
		["bun", args.cliPath, args.prUrl, "--worktree", args.worktree, ...args.extraArgs],
		{
			stdout: "pipe",
			stderr: "pipe",
			env: {
				...process.env,
				PATH: `${args.binDir}:${process.env.PATH ?? ""}`,
				CI_FEEDBACK_FIXTURE_DIR: args.fixtureDir,
			},
		},
	);
	const [stdout, stderr] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
	]);
	const code = await proc.exited;
	return { code, stdout, stderr };
}

async function test1_writesBrief(): Promise<void> {
	process.stdout.write("test 1: CLI writes ci-failure.md into the active spec dir\n");
	const root = mkdtempSync(join(tmpdir(), "ci-feedback-"));
	try {
		const binDir = join(root, "bin");
		const fixtureDir = join(root, "fixtures");
		writeFixtures(fixtureDir);
		buildGhShim(binDir, fixtureDir);
		const worktree = buildFakeWorktree(root);

		const cliPath = join(process.cwd(), "scripts/ci-feedback.ts");
		const res = await spawnCli({
			cliPath,
			prUrl: "https://github.com/owner/repo/pull/42",
			worktree,
			extraArgs: [],
			binDir,
			fixtureDir,
		});

		assertTrue(res.code === 0, "CLI exits 0", `got ${res.code}; stderr=${res.stderr.trim()}`);

		const briefPath = join(worktree, "specs/active/fake-spec/ci-failure.md");
		assertTrue(existsSync(briefPath), "ci-failure.md exists next to proposal.md");
		if (!existsSync(briefPath)) return;

		const body = await Bun.file(briefPath).text();
		assertTrue(body.includes("https://github.com/owner/repo/pull/42"), "brief cites PR url");
		assertTrue(body.includes("spec/014-ci-feedback-loop"), "brief cites head branch");
		assertTrue(body.includes("e2e"), "brief lists e2e check");
		assertTrue(body.includes("biome"), "brief lists biome check");
		assertTrue(!body.includes("typecheck"), "brief excludes SUCCESS check (typecheck)");
		assertTrue(body.includes("page.goto timeout"), "brief embeds e2e log snippet");
		assertTrue(body.includes("useConst"), "brief embeds biome log snippet");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

async function test2_dryRun(): Promise<void> {
	process.stdout.write("\ntest 2: --dry-run prints to stdout, writes no file\n");
	const root = mkdtempSync(join(tmpdir(), "ci-feedback-"));
	try {
		const binDir = join(root, "bin");
		const fixtureDir = join(root, "fixtures");
		writeFixtures(fixtureDir);
		buildGhShim(binDir, fixtureDir);
		const worktree = buildFakeWorktree(root);

		const cliPath = join(process.cwd(), "scripts/ci-feedback.ts");
		const res = await spawnCli({
			cliPath,
			prUrl: "https://github.com/owner/repo/pull/42",
			worktree,
			extraArgs: ["--dry-run"],
			binDir,
			fixtureDir,
		});

		assertTrue(res.code === 0, "CLI exits 0 in --dry-run", `got ${res.code}`);
		assertTrue(res.stdout.includes("CI failure brief"), "dry-run stdout contains brief header");
		assertTrue(
			res.stdout.includes("https://github.com/owner/repo/pull/42"),
			"dry-run stdout contains PR url",
		);
		const briefPath = join(worktree, "specs/active/fake-spec/ci-failure.md");
		assertTrue(!existsSync(briefPath), "no ci-failure.md written in --dry-run");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

async function test3_noFailingChecksExitsNonZero(): Promise<void> {
	process.stdout.write("\ntest 3: all-green checks → CLI exits 1 with a clear error\n");
	const root = mkdtempSync(join(tmpdir(), "ci-feedback-"));
	try {
		const binDir = join(root, "bin");
		const fixtureDir = join(root, "fixtures");
		mkdirSync(fixtureDir, { recursive: true });
		writeFileSync(join(fixtureDir, "pr-view.json"), `${JSON.stringify(PR_INFO_FIXTURE)}\n`);
		writeFileSync(
			join(fixtureDir, "pr-checks.json"),
			`${JSON.stringify([
				{
					name: "ok",
					state: "SUCCESS",
					link: "https://github.com/owner/repo/actions/runs/9/job/9",
				},
			])}\n`,
		);
		buildGhShim(binDir, fixtureDir);
		const worktree = buildFakeWorktree(root);

		const cliPath = join(process.cwd(), "scripts/ci-feedback.ts");
		const res = await spawnCli({
			cliPath,
			prUrl: "https://github.com/owner/repo/pull/42",
			worktree,
			extraArgs: [],
			binDir,
			fixtureDir,
		});

		assertTrue(res.code === 1, "CLI exits 1 when no failing checks", `got ${res.code}`);
		assertTrue(
			res.stderr.includes("no failing checks"),
			"stderr mentions no failing checks",
			`stderr=${res.stderr.trim()}`,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

async function main(): Promise<void> {
	try {
		await test1_writesBrief();
	} catch (e) {
		fail("test 1 threw", e instanceof Error ? e.message : String(e));
	}
	try {
		await test2_dryRun();
	} catch (e) {
		fail("test 2 threw", e instanceof Error ? e.message : String(e));
	}
	try {
		await test3_noFailingChecksExitsNonZero();
	} catch (e) {
		fail("test 3 threw", e instanceof Error ? e.message : String(e));
	}

	if (failed > 0) {
		process.stdout.write(`\n\u2716 ${failed} assertion(s) failed\n`);
		process.exit(1);
	}
	process.stdout.write("\n\u2713 all green\n");
}

await main();
