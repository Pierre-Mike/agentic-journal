/**
 * Gate for spec 030-retro-dormant-worktrees.
 *
 * Smoke test for `scripts/retro-preflight.ts`. Sets up fixture scenarios via
 * environment-variable-based `gh` stubbing and a fake worktree directory
 * structure, then asserts `detectDormantWorktrees()` returns the correct set.
 *
 * Scenarios tested:
 *   (a) worktree under .agentic/worktrees/, spec/* branch, no PR, age >1h → DETECTED
 *   (b) worktree under .agentic/worktrees/, spec/* branch, open PR → NOT detected
 *   (c) worktree under .agentic/worktrees/, spec/* branch, merged PR → NOT detected
 *   (d) worktree under .agentic/worktrees/, non-spec branch → NOT detected
 *
 * Pre-impl: exits 1 because scripts/retro-preflight.ts does not exist.
 * Post-impl: exits 0 when all assertions pass.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let failed = 0;

function pass(name: string): void {
	process.stdout.write(`  ✓ ${name}\n`);
}

function fail(name: string, detail?: string): void {
	process.stdout.write(`  ✖ ${name}${detail ? ` — ${detail}` : ""}\n`);
	failed++;
}

function assertTrue(cond: boolean, name: string, detail?: string): void {
	if (cond) pass(name);
	else fail(name, detail);
}

// ---------------------------------------------------------------------------
// DormantSpec type mirror — must match retro-preflight.ts export
// ---------------------------------------------------------------------------
interface DormantSpec {
	slug: string;
	branch: string;
	worktree_path: string;
	age_days: number;
	last_commit_sha: string;
	last_commit_ts: string;
}

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/**
 * Build a fake worktree directory structure and return fixture data.
 *
 * We cannot mock `git worktree list` globally, so instead we override
 * the GIT_WORKTREE_LIST_FIXTURE env variable: retro-preflight.ts must
 * honour this variable (when set) as a newline-delimited list of
 * "worktree_path branch" entries instead of calling `git worktree list`.
 *
 * GH_PR_LIST_FIXTURE is a JSON object keyed by branch name mapping to a JSON
 * array (the fake `gh pr list` response).
 *
 * GIT_LOG_FIXTURE is a JSON object keyed by worktree_path mapping to
 * { sha, ts } for the last commit.
 */
function buildFixtures(baseDir: string): {
	worktreeFixture: string;
	prFixture: Record<string, unknown[]>;
	gitLogFixture: Record<string, { sha: string; ts: string }>;
} {
	const oldTs = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2h ago
	const recentTs = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30m ago

	const worktrees = [
		// (a) dormant — spec branch, no PR, >1h old
		{ slug: "old-no-pr", branch: "spec/old-no-pr", ts: oldTs },
		// (b) open PR — spec branch, open PR, >1h old
		{ slug: "open-pr", branch: "spec/open-pr", ts: oldTs },
		// (c) merged PR — spec branch, merged PR, >1h old
		{ slug: "merged-pr", branch: "spec/merged-pr", ts: oldTs },
		// (d) non-spec branch — >1h old, no PR
		{ slug: "main-work", branch: "feature/main-work", ts: oldTs },
		// (e) spec branch, no PR, but <1h old → not dormant
		{ slug: "fresh", branch: "spec/fresh", ts: recentTs },
	];

	const agentic = join(baseDir, ".agentic", "worktrees");
	const worktreeLines: string[] = [];
	const gitLogFixture: Record<string, { sha: string; ts: string }> = {};

	for (const wt of worktrees) {
		const wtPath = join(agentic, wt.slug);
		mkdirSync(wtPath, { recursive: true });
		worktreeLines.push(`${wtPath} ${wt.branch}`);
		gitLogFixture[wtPath] = { sha: `deadbeef${wt.slug.slice(0, 8)}`, ts: wt.ts };
	}

	const prFixture: Record<string, unknown[]> = {
		"spec/old-no-pr": [],
		"spec/open-pr": [{ number: 42 }],
		"spec/merged-pr": [{ number: 17 }],
		"feature/main-work": [],
		"spec/fresh": [],
	};

	return {
		worktreeFixture: worktreeLines.join("\n"),
		prFixture,
		gitLogFixture,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function test_detectDormant(): Promise<void> {
	process.stdout.write("test 1: detectDormantWorktrees() returns correct set\n");

	const baseDir = mkdtempSync(join(tmpdir(), "retro-preflight-"));
	try {
		const { worktreeFixture, prFixture, gitLogFixture } = buildFixtures(baseDir);

		// Inject fixtures via env variables (dot notation required by biome useLiteralKeys)
		process.env.GIT_WORKTREE_LIST_FIXTURE = worktreeFixture;
		process.env.GH_PR_LIST_FIXTURE = JSON.stringify(prFixture);
		process.env.GIT_LOG_FIXTURE = JSON.stringify(gitLogFixture);

		// Import the module under test (must exist post-impl)
		const mod = await import(join(process.cwd(), "scripts/retro-preflight.ts"));

		if (typeof mod.detectDormantWorktrees !== "function") {
			fail("detectDormantWorktrees export", "not a function or missing");
			return;
		}

		const result: DormantSpec[] = await mod.detectDormantWorktrees();

		assertTrue(Array.isArray(result), "result is an array");
		assertTrue(
			result.length === 1,
			"exactly 1 dormant worktree detected",
			`got ${result.length}: ${JSON.stringify(result.map((r) => r.slug))}`,
		);

		const dormant = result[0];
		assertTrue(
			dormant?.slug === "old-no-pr" || dormant?.branch === "spec/old-no-pr",
			"detected entry is old-no-pr",
			`got slug=${dormant?.slug} branch=${dormant?.branch}`,
		);
		assertTrue(
			typeof dormant?.age_days === "number" && dormant.age_days >= 0,
			"age_days is non-negative number",
			`got ${dormant?.age_days}`,
		);
		assertTrue(
			typeof dormant?.last_commit_sha === "string" && dormant.last_commit_sha.length > 0,
			"last_commit_sha is non-empty string",
		);
		assertTrue(
			typeof dormant?.last_commit_ts === "string" && dormant.last_commit_ts.length > 0,
			"last_commit_ts is non-empty string",
		);
		assertTrue(
			typeof dormant?.worktree_path === "string" && dormant.worktree_path.includes("old-no-pr"),
			"worktree_path includes slug",
		);
	} finally {
		delete process.env.GIT_WORKTREE_LIST_FIXTURE;
		delete process.env.GH_PR_LIST_FIXTURE;
		delete process.env.GIT_LOG_FIXTURE;
		rmSync(baseDir, { recursive: true, force: true });
	}
}

async function test_textOutput(): Promise<void> {
	process.stdout.write(
		"\ntest 2: CLI text output — header present when dormant, empty string when none\n",
	);

	const baseDir = mkdtempSync(join(tmpdir(), "retro-preflight-"));
	try {
		const { worktreeFixture, prFixture, gitLogFixture } = buildFixtures(baseDir);

		process.env.GIT_WORKTREE_LIST_FIXTURE = worktreeFixture;
		process.env.GH_PR_LIST_FIXTURE = JSON.stringify(prFixture);
		process.env.GIT_LOG_FIXTURE = JSON.stringify(gitLogFixture);

		const mod = await import(join(process.cwd(), "scripts/retro-preflight.ts"));

		if (typeof mod.renderDormant !== "function") {
			fail("renderDormant export", "not a function or missing — needed for text output test");
			return;
		}

		const dormant: DormantSpec[] = await mod.detectDormantWorktrees();
		const text: string = mod.renderDormant(dormant);

		assertTrue(typeof text === "string", "renderDormant returns string");
		assertTrue(
			text.startsWith("Dormant in-flight specs:"),
			"non-empty result starts with 'Dormant in-flight specs:'",
			`got: ${JSON.stringify(text.slice(0, 60))}`,
		);

		const emptyText: string = mod.renderDormant([]);
		assertTrue(
			emptyText === "",
			"renderDormant([]) returns empty string",
			`got: ${JSON.stringify(emptyText)}`,
		);
	} finally {
		delete process.env.GIT_WORKTREE_LIST_FIXTURE;
		delete process.env.GH_PR_LIST_FIXTURE;
		delete process.env.GIT_LOG_FIXTURE;
		rmSync(baseDir, { recursive: true, force: true });
	}
}

async function test_jsonFlag(): Promise<void> {
	process.stdout.write("\ntest 3: CLI --json flag output is valid JSON array of DormantSpec\n");

	const baseDir = mkdtempSync(join(tmpdir(), "retro-preflight-"));
	try {
		const { worktreeFixture, prFixture, gitLogFixture } = buildFixtures(baseDir);

		process.env.GIT_WORKTREE_LIST_FIXTURE = worktreeFixture;
		process.env.GH_PR_LIST_FIXTURE = JSON.stringify(prFixture);
		process.env.GIT_LOG_FIXTURE = JSON.stringify(gitLogFixture);

		// Run CLI with --json and capture stdout
		const proc = Bun.spawn(["bun", join(process.cwd(), "scripts/retro-preflight.ts"), "--json"], {
			stdout: "pipe",
			stderr: "pipe",
			env: { ...process.env },
		});
		const stdout = await new Response(proc.stdout).text();
		const exitCode = await proc.exited;

		assertTrue(exitCode === 0, "--json exits 0", `exit code was ${exitCode}`);

		let parsed: unknown;
		try {
			parsed = JSON.parse(stdout);
		} catch (e) {
			fail("--json stdout is valid JSON", `parse error: ${e}`);
			return;
		}

		assertTrue(Array.isArray(parsed), "--json output is a JSON array", `got ${typeof parsed}`);

		const arr = parsed as unknown[];
		assertTrue(arr.length === 1, "--json array has 1 entry (old-no-pr)", `got ${arr.length}`);

		const entry = arr[0] as Record<string, unknown>;
		const requiredKeys: (keyof DormantSpec)[] = [
			"slug",
			"branch",
			"worktree_path",
			"age_days",
			"last_commit_sha",
			"last_commit_ts",
		];
		for (const key of requiredKeys) {
			assertTrue(
				key in entry,
				`--json entry has key '${key}'`,
				`missing from ${JSON.stringify(Object.keys(entry))}`,
			);
		}
	} finally {
		delete process.env.GIT_WORKTREE_LIST_FIXTURE;
		delete process.env.GH_PR_LIST_FIXTURE;
		delete process.env.GIT_LOG_FIXTURE;
		rmSync(baseDir, { recursive: true, force: true });
	}
}

async function test_skillAmended(): Promise<void> {
	process.stdout.write("\ntest 4: .claude/skills/retro/SKILL.md references preflight invocation\n");

	const skillPath = join(process.cwd(), ".claude/skills/retro/SKILL.md");
	if (!existsSync(skillPath)) {
		fail("retro SKILL.md exists", skillPath);
		return;
	}

	const body = readFileSync(skillPath, "utf8");

	assertTrue(
		body.includes("retro-preflight"),
		"SKILL.md references retro-preflight",
		"no mention of 'retro-preflight' found",
	);
	assertTrue(
		/bun\s+scripts\/retro-preflight\.ts/.test(body),
		"SKILL.md contains 'bun scripts/retro-preflight.ts' invocation",
		"invocation pattern not found",
	);
	assertTrue(
		/Dormant in-flight specs/i.test(body) || /preflight/i.test(body),
		"SKILL.md Step 2 refers to dormant preflight section",
	);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
	try {
		await test_detectDormant();
	} catch (e) {
		fail("test 1 threw", e instanceof Error ? e.message : String(e));
	}
	try {
		await test_textOutput();
	} catch (e) {
		fail("test 2 threw", e instanceof Error ? e.message : String(e));
	}
	try {
		await test_jsonFlag();
	} catch (e) {
		fail("test 3 threw", e instanceof Error ? e.message : String(e));
	}
	try {
		await test_skillAmended();
	} catch (e) {
		fail("test 4 threw", e instanceof Error ? e.message : String(e));
	}

	if (failed > 0) {
		process.stdout.write(`\n✖ ${failed} assertion(s) failed\n`);
		process.exit(1);
	}
	process.stdout.write("\n✓ all green\n");
}

await main();
