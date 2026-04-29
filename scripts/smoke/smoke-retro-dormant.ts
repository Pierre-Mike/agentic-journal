/**
 * Gate for spec 030-retro-dormant-worktrees.
 *
 * Smoke test for `scripts/retro-preflight.ts`. Sets up fixture scenarios via
 * environment-variable-based subprocess stubbing, then asserts the CLI and
 * detectDormantWorktrees() return the correct results.
 *
 * Fixture protocol (declared as Constraint in proposal.md):
 *   GIT_WORKTREE_LIST_FIXTURE   — newline-delimited "<path> <branch>" entries
 *   GH_PR_LIST_FIXTURE          — JSON object keyed by "<branch>+state=all" → array
 *   GIT_LOG_FIXTURE             — JSON object keyed by worktree_path → {sha, ts}
 *
 * When all three env vars are absent, retro-preflight.ts shells out to real
 * commands (git worktree list, gh pr list, git log -1).
 *
 * Scenarios tested:
 *   (a) .agentic/worktrees/, spec/* branch, no PR, age >1h          → DETECTED
 *   (b) .agentic/worktrees/, spec/* branch, open PR, age >1h        → NOT detected
 *   (c) .agentic/worktrees/, spec/* branch, merged PR, age >1h      → NOT detected
 *       NOTE: merged-PR fixture is ONLY present under the --state all key;
 *             a stub that calls gh without --state all would return [] and
 *             incorrectly flag this as dormant — assert NOT detected pins the flag.
 *   (d) .agentic/worktrees/, non-spec branch, age >1h               → NOT detected
 *   (e) .agentic/worktrees/, spec/* branch, no PR, age <1h (30 min) → NOT detected
 *   (f) .agentic/worktrees/, spec/* branch, no PR, age ~90 min      → DETECTED
 *   (g) path OUTSIDE .agentic/worktrees/, spec/* branch, no PR, >1h → NOT detected
 *   (h) no fixture env vars → real subprocess path, exit 0, empty output
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
// Fixture builder
// ---------------------------------------------------------------------------

/**
 * Build fixture data for the full scenario matrix.
 *
 * GH_PR_LIST_FIXTURE is keyed by "<branch>+state=all" (not just branch) so
 * that an implementation calling `gh pr list --head <branch>` without
 * `--state all` would look up a missing key, return [], and incorrectly flag
 * merged-PR worktrees as dormant. This directly pins the --state all
 * requirement: only a correct implementation passes test 1.
 */
function buildFixtures(baseDir: string): {
	worktreeFixture: string;
	prFixture: Record<string, unknown[]>;
	gitLogFixture: Record<string, { sha: string; ts: string }>;
} {
	const age2h = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2h ago  → dormant
	const age90m = new Date(Date.now() - 90 * 60 * 1000).toISOString(); // 90m ago → dormant
	const age30m = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30m ago → NOT dormant

	const agentic = join(baseDir, ".agentic", "worktrees");
	// Outside prefix — deliberately in a sibling directory
	const outside = join(baseDir, "other", "worktrees");

	const worktrees: Array<{ slug: string; branch: string; ts: string; base: string }> = [
		// (a) dormant
		{ slug: "old-no-pr", branch: "spec/old-no-pr", ts: age2h, base: agentic },
		// (b) open PR — NOT dormant
		{ slug: "open-pr", branch: "spec/open-pr", ts: age2h, base: agentic },
		// (c) merged PR — NOT dormant (requires --state all lookup key)
		{ slug: "merged-pr", branch: "spec/merged-pr", ts: age2h, base: agentic },
		// (d) non-spec branch — NOT dormant
		{ slug: "main-work", branch: "feature/main-work", ts: age2h, base: agentic },
		// (e) fresh spec (<1h) — NOT dormant
		{ slug: "fresh", branch: "spec/fresh", ts: age30m, base: agentic },
		// (f) 90-minute-old spec — IS dormant (pins hour threshold)
		{ slug: "ninety-min", branch: "spec/ninety-min", ts: age90m, base: agentic },
		// (g) outside .agentic/worktrees/ — NOT dormant regardless
		{ slug: "outside-wt", branch: "spec/outside-wt", ts: age2h, base: outside },
	];

	const worktreeLines: string[] = [];
	const gitLogFixture: Record<string, { sha: string; ts: string }> = {};

	for (const wt of worktrees) {
		const wtPath = join(wt.base, wt.slug);
		mkdirSync(wtPath, { recursive: true });
		worktreeLines.push(`${wtPath} ${wt.branch}`);
		gitLogFixture[wtPath] = { sha: `deadbeef${wt.slug.slice(0, 8)}`, ts: wt.ts };
	}

	// Keys use "<branch>+state=all" — the implementation MUST pass --state all
	// to gh and construct the lookup key accordingly.
	// An implementation that looks up by branch alone (no "+state=all" suffix)
	// will see undefined/[] for "spec/merged-pr" and flag it as dormant — FAIL.
	const prFixture: Record<string, unknown[]> = {
		"spec/old-no-pr+state=all": [],
		"spec/open-pr+state=all": [{ number: 42 }],
		"spec/merged-pr+state=all": [{ number: 17 }],
		"feature/main-work+state=all": [],
		"spec/fresh+state=all": [],
		"spec/ninety-min+state=all": [],
		"spec/outside-wt+state=all": [],
	};

	return {
		worktreeFixture: worktreeLines.join("\n"),
		prFixture,
		gitLogFixture,
	};
}

// ---------------------------------------------------------------------------
// Test 1: detectDormantWorktrees() returns correct set via module import
// ---------------------------------------------------------------------------

async function test_detectDormant(): Promise<void> {
	process.stdout.write(
		"test 1: detectDormantWorktrees() — correct set, --state all required, path prefix filter, age threshold\n",
	);

	const baseDir = mkdtempSync(join(tmpdir(), "retro-preflight-"));
	try {
		const { worktreeFixture, prFixture, gitLogFixture } = buildFixtures(baseDir);

		process.env.GIT_WORKTREE_LIST_FIXTURE = worktreeFixture;
		process.env.GH_PR_LIST_FIXTURE = JSON.stringify(prFixture);
		process.env.GIT_LOG_FIXTURE = JSON.stringify(gitLogFixture);

		const mod = await import(join(process.cwd(), "scripts/retro-preflight.ts"));

		if (typeof mod.detectDormantWorktrees !== "function") {
			fail("detectDormantWorktrees export", "not a function or missing");
			return;
		}

		const result: DormantSpec[] = await mod.detectDormantWorktrees();

		assertTrue(Array.isArray(result), "result is an array");

		// Exactly old-no-pr + ninety-min should be detected (2 entries)
		assertTrue(
			result.length === 2,
			"exactly 2 dormant worktrees detected (old-no-pr and ninety-min)",
			`got ${result.length}: ${JSON.stringify(result.map((r) => r.slug))}`,
		);

		const slugs = result.map((r) => r.slug).sort();
		assertTrue(
			slugs.includes("old-no-pr"),
			"old-no-pr is detected",
			`slugs: ${JSON.stringify(slugs)}`,
		);
		assertTrue(
			slugs.includes("ninety-min"),
			"ninety-min (90-min-old) is detected — pins 1-hour threshold",
			`slugs: ${JSON.stringify(slugs)}`,
		);

		// merged-pr must NOT be detected — implementation had to use --state all
		assertTrue(
			!slugs.includes("merged-pr"),
			"merged-pr is NOT detected — implementation used --state all",
			`slugs unexpectedly include merged-pr: ${JSON.stringify(slugs)}`,
		);

		// outside-wt must NOT be detected — path prefix filter
		assertTrue(
			!slugs.includes("outside-wt"),
			"outside-wt is NOT detected — path prefix .agentic/worktrees/ enforced",
			`slugs unexpectedly include outside-wt: ${JSON.stringify(slugs)}`,
		);

		// fresh (30 min old) must NOT be detected — pins 1-hour threshold lower bound
		assertTrue(
			!slugs.includes("fresh"),
			"fresh (30-min-old) is NOT detected — below 1-hour threshold",
			`slugs unexpectedly include fresh: ${JSON.stringify(slugs)}`,
		);

		// age_days for 90-min entry must be a positive fraction (< 1 day)
		const ninetyEntry = result.find((r) => r.slug === "ninety-min");
		assertTrue(
			typeof ninetyEntry?.age_days === "number" &&
				ninetyEntry.age_days > 0 &&
				ninetyEntry.age_days < 1,
			"ninety-min age_days is a positive fraction < 1 (hour-granularity, not floored to 0)",
			`got ${ninetyEntry?.age_days}`,
		);

		// Verify basic shape of detected entry
		const dormant = result.find((r) => r.slug === "old-no-pr");
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

// ---------------------------------------------------------------------------
// Test 2: CLI text output via subprocess (NOT via renderDormant import)
// ---------------------------------------------------------------------------

async function test_textOutput(): Promise<void> {
	process.stdout.write(
		"\ntest 2: CLI default text output via subprocess — header present when dormant, empty when none\n",
	);

	const baseDir = mkdtempSync(join(tmpdir(), "retro-preflight-"));
	try {
		const { worktreeFixture, prFixture, gitLogFixture } = buildFixtures(baseDir);

		const env = {
			...process.env,
			GIT_WORKTREE_LIST_FIXTURE: worktreeFixture,
			GH_PR_LIST_FIXTURE: JSON.stringify(prFixture),
			GIT_LOG_FIXTURE: JSON.stringify(gitLogFixture),
		};

		// Default invocation (no --json) — expect text output with header
		const proc = Bun.spawn(["bun", join(process.cwd(), "scripts/retro-preflight.ts")], {
			stdout: "pipe",
			stderr: "pipe",
			env,
		});
		const stdout = await new Response(proc.stdout).text();
		const exitCode = await proc.exited;

		assertTrue(exitCode === 0, "CLI default exits 0", `exit code was ${exitCode}`);
		assertTrue(
			stdout.startsWith("Dormant in-flight specs:"),
			"CLI default output starts with 'Dormant in-flight specs:'",
			`got: ${JSON.stringify(stdout.slice(0, 80))}`,
		);

		// Empty fixture (no worktrees) — expect empty string output
		const emptyEnv = {
			...process.env,
			GIT_WORKTREE_LIST_FIXTURE: "",
			GH_PR_LIST_FIXTURE: JSON.stringify({}),
			GIT_LOG_FIXTURE: JSON.stringify({}),
		};
		const emptyProc = Bun.spawn(["bun", join(process.cwd(), "scripts/retro-preflight.ts")], {
			stdout: "pipe",
			stderr: "pipe",
			env: emptyEnv,
		});
		const emptyOut = await new Response(emptyProc.stdout).text();
		const emptyExit = await emptyProc.exited;

		assertTrue(emptyExit === 0, "CLI default (empty) exits 0", `exit code was ${emptyExit}`);
		assertTrue(
			emptyOut.trim() === "",
			"CLI default output is empty string when no dormant worktrees",
			`got: ${JSON.stringify(emptyOut)}`,
		);
	} finally {
		rmSync(baseDir, { recursive: true, force: true });
	}
}

// ---------------------------------------------------------------------------
// Test 3: CLI --json flag output is valid JSON array of DormantSpec
// ---------------------------------------------------------------------------

async function test_jsonFlag(): Promise<void> {
	process.stdout.write("\ntest 3: CLI --json flag output is valid JSON array of DormantSpec\n");

	const baseDir = mkdtempSync(join(tmpdir(), "retro-preflight-"));
	try {
		const { worktreeFixture, prFixture, gitLogFixture } = buildFixtures(baseDir);

		const env = {
			...process.env,
			GIT_WORKTREE_LIST_FIXTURE: worktreeFixture,
			GH_PR_LIST_FIXTURE: JSON.stringify(prFixture),
			GIT_LOG_FIXTURE: JSON.stringify(gitLogFixture),
		};

		const proc = Bun.spawn(["bun", join(process.cwd(), "scripts/retro-preflight.ts"), "--json"], {
			stdout: "pipe",
			stderr: "pipe",
			env,
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
		assertTrue(
			arr.length === 2,
			"--json array has 2 entries (old-no-pr and ninety-min)",
			`got ${arr.length}: ${JSON.stringify(arr)}`,
		);

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
		rmSync(baseDir, { recursive: true, force: true });
	}
}

// ---------------------------------------------------------------------------
// Test 4: Real subprocess path — no fixture env vars, scratch directory
// ---------------------------------------------------------------------------

async function test_realSubprocessPath(): Promise<void> {
	process.stdout.write(
		"\ntest 4: Real subprocess path — no fixtures, scratch dir, exit 0, no dormant output\n",
	);

	// Use a temp directory that is NOT a git repo — git worktree list will
	// fail or return only the main worktree with no spec/* branches.
	// The implementation must handle this gracefully (exit 0, empty output).
	const scratchDir = mkdtempSync(join(tmpdir(), "retro-scratch-"));
	try {
		// Spawn with NO fixture env vars — strip them from inherited env
		const cleanEnv = { ...process.env };
		delete cleanEnv.GIT_WORKTREE_LIST_FIXTURE;
		delete cleanEnv.GH_PR_LIST_FIXTURE;
		delete cleanEnv.GIT_LOG_FIXTURE;

		const proc = Bun.spawn(["bun", join(process.cwd(), "scripts/retro-preflight.ts"), "--json"], {
			stdout: "pipe",
			stderr: "pipe",
			cwd: scratchDir,
			env: cleanEnv,
		});
		const stdout = await new Response(proc.stdout).text();
		const exitCode = await proc.exited;

		assertTrue(
			exitCode === 0,
			"real-subprocess path exits 0 in scratch directory",
			`exit code was ${exitCode}`,
		);

		// In a non-git scratch directory there are no spec/* worktrees.
		// The output should be an empty JSON array (no dormant specs found).
		let parsed: unknown;
		try {
			parsed = JSON.parse(stdout.trim() || "[]");
		} catch {
			parsed = [];
		}
		assertTrue(
			Array.isArray(parsed) && (parsed as unknown[]).length === 0,
			"real-subprocess path returns empty array in clean scratch dir",
			`got: ${JSON.stringify(stdout.slice(0, 120))}`,
		);
	} finally {
		rmSync(scratchDir, { recursive: true, force: true });
	}
}

// ---------------------------------------------------------------------------
// Test 5: SKILL.md amended with preflight invocation
// ---------------------------------------------------------------------------

async function test_skillAmended(): Promise<void> {
	process.stdout.write("\ntest 5: .claude/skills/retro/SKILL.md references preflight invocation\n");

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
		await test_realSubprocessPath();
	} catch (e) {
		fail("test 4 threw", e instanceof Error ? e.message : String(e));
	}
	try {
		await test_skillAmended();
	} catch (e) {
		fail("test 5 threw", e instanceof Error ? e.message : String(e));
	}

	if (failed > 0) {
		process.stdout.write(`\n✖ ${failed} assertion(s) failed\n`);
		process.exit(1);
	}
	process.stdout.write("\n✓ all green\n");
}

await main();
