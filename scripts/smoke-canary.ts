/**
 * Gate for spec 012-canary-skill-suite.
 *
 * End-to-end smoke: builds a tmpdir baseline with fake-passing and
 * fake-failing canary scripts, invokes canary-run.ts's pure fns directly, and
 * asserts the framework scores correctly and the CLI exits 0 against the
 * locked baseline.
 *
 * Pre-impl this exits 1 (canary-run.ts missing or misbehaves); post-impl 0.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let failed = 0;

function pass(name: string): void {
	process.stdout.write(`  \u2713 ${name}\n`);
}

function fail(name: string, detail?: string): void {
	process.stdout.write(`  \u2716 ${name}${detail ? ` \u2014 ${detail}` : ""}\n`);
	failed++;
}

function assertTrue(cond: boolean, name: string, detail?: string): void {
	if (cond) pass(name);
	else fail(name, detail);
}

function writePassScript(dir: string, id: string, marker: string): string {
	const path = join(dir, `${id}.ts`);
	writeFileSync(
		path,
		`process.stdout.write(${JSON.stringify(marker)} + "\\n");\nprocess.exit(0);\n`,
	);
	return path;
}

function writeFailScript(dir: string, id: string): string {
	const path = join(dir, `${id}.ts`);
	writeFileSync(path, `process.stderr.write("boom\\n");\nprocess.exit(1);\n`);
	return path;
}

async function test1_pureScore(): Promise<void> {
	process.stdout.write("test 1: score() handles mixed results with weights\n");
	const mod = await import(join(process.cwd(), "scripts/canary-run.ts"));
	if (typeof mod.score !== "function") {
		fail("scripts/canary-run.ts exports score", "missing");
		return;
	}
	const entries = [
		{ id: "a", description: "", script_path: "", expected_output: "", weight: 3 },
		{ id: "b", description: "", script_path: "", expected_output: "", weight: 1 },
	];
	const results = [
		{ id: "a", passed: true, exit_code: 0, stdout: "", duration_ms: 1, reason: null },
		{ id: "b", passed: false, exit_code: 1, stdout: "", duration_ms: 1, reason: "x" },
	];
	const report = mod.score(results, entries);
	assertTrue(report.total === 2, "total === 2", `got ${report.total}`);
	assertTrue(report.passed === 1, "passed === 1", `got ${report.passed}`);
	assertTrue(report.failed === 1, "failed === 1", `got ${report.failed}`);
	assertTrue(
		Math.abs(report.pass_rate - 0.75) < 1e-9,
		"weighted pass_rate === 0.75",
		`got ${report.pass_rate}`,
	);
}

async function test2_runCanaryTmpdirFixtures(): Promise<void> {
	process.stdout.write("\ntest 2: runCanary spawns a tmpdir script and captures pass/fail\n");
	const repoRoot = process.cwd();
	const scriptsDir = mkdtempSync(join(tmpdir(), "canary-smoke-"));
	try {
		writePassScript(scriptsDir, "pass-a", "HELLO_A");
		writeFailScript(scriptsDir, "fail-b");
		const mod = await import(join(repoRoot, "scripts/canary-run.ts"));
		if (typeof mod.runCanary !== "function") {
			fail("scripts/canary-run.ts exports runCanary", "missing");
			return;
		}
		const okEntry = {
			id: "pass-a",
			description: "",
			script_path: join(scriptsDir, "pass-a.ts"),
			expected_output: "HELLO_A",
			weight: 1,
		};
		const okResult = await mod.runCanary({ entry: okEntry, cwd: repoRoot });
		assertTrue(okResult.passed === true, "passing canary → passed true", `got ${okResult.reason}`);
		assertTrue(okResult.exit_code === 0, "passing canary → exit 0", `got ${okResult.exit_code}`);

		const failEntry = {
			id: "fail-b",
			description: "",
			script_path: join(scriptsDir, "fail-b.ts"),
			expected_output: "",
			weight: 1,
		};
		const failResult = await mod.runCanary({ entry: failEntry, cwd: repoRoot });
		assertTrue(failResult.passed === false, "failing canary → passed false");
		assertTrue(
			failResult.exit_code === 1,
			"failing canary → exit 1",
			`got ${failResult.exit_code}`,
		);

		const missingEntry = {
			id: "ghost",
			description: "",
			script_path: join(scriptsDir, "nope.ts"),
			expected_output: "",
			weight: 1,
		};
		const missingResult = await mod.runCanary({ entry: missingEntry, cwd: repoRoot });
		assertTrue(
			missingResult.passed === false && missingResult.reason !== null,
			"missing script → passed false with reason",
			`got ${JSON.stringify(missingResult)}`,
		);

		const wrongMarker = {
			id: "pass-a",
			description: "",
			script_path: join(scriptsDir, "pass-a.ts"),
			expected_output: "WRONG",
			weight: 1,
		};
		const wrongResult = await mod.runCanary({ entry: wrongMarker, cwd: repoRoot });
		assertTrue(
			wrongResult.passed === false && wrongResult.exit_code === 0,
			"exit 0 but missing marker → passed false",
			`got ${JSON.stringify(wrongResult)}`,
		);
	} finally {
		rmSync(scriptsDir, { recursive: true, force: true });
	}
}

async function test3_loadBaselineTmpdirFile(): Promise<void> {
	process.stdout.write("\ntest 3: loadBaseline parses valid JSON and rejects bad shapes\n");
	const dir = mkdtempSync(join(tmpdir(), "canary-baseline-"));
	try {
		const mod = await import(join(process.cwd(), "scripts/canary-run.ts"));
		if (typeof mod.loadBaseline !== "function") {
			fail("scripts/canary-run.ts exports loadBaseline", "missing");
			return;
		}
		const goodPath = join(dir, "good.json");
		writeFileSync(
			goodPath,
			JSON.stringify([
				{
					id: "x",
					description: "d",
					script_path: "p",
					expected_output: "e",
					weight: 1,
				},
			]),
		);
		const entries = mod.loadBaseline(goodPath);
		assertTrue(
			Array.isArray(entries) && entries.length === 1 && entries[0].id === "x",
			"loadBaseline returns parsed array",
			`got ${JSON.stringify(entries)}`,
		);

		const badPath = join(dir, "bad.json");
		writeFileSync(badPath, JSON.stringify([{ id: "x" }]));
		let threw = false;
		try {
			mod.loadBaseline(badPath);
		} catch {
			threw = true;
		}
		assertTrue(threw, "loadBaseline throws on malformed entry");

		let threwMissing = false;
		try {
			mod.loadBaseline(join(dir, "does-not-exist.json"));
		} catch {
			threwMissing = true;
		}
		assertTrue(threwMissing, "loadBaseline throws on missing file");
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

async function test4_cliAgainstLockedBaseline(): Promise<void> {
	process.stdout.write(
		"\ntest 4: CLI `bun scripts/canary-run.ts` exits 0 against locked baseline\n",
	);
	const proc = Bun.spawn(["bun", "scripts/canary-run.ts"], {
		cwd: process.cwd(),
		stdout: "pipe",
		stderr: "pipe",
	});
	const stdout = await new Response(proc.stdout).text();
	const exitCode = await proc.exited;
	assertTrue(exitCode === 0, "CLI exit 0", `got ${exitCode}`);
	assertTrue(stdout.includes("pass rate 100%"), "CLI prints 'pass rate 100%'", `stdout=${stdout}`);
}

async function test5_updateBaselineGuard(): Promise<void> {
	process.stdout.write("\ntest 5: --update-baseline without CANARY_UPDATE=1 refuses (exit 2)\n");
	const proc = Bun.spawn(["bun", "scripts/canary-run.ts", "--update-baseline"], {
		cwd: process.cwd(),
		stdout: "pipe",
		stderr: "pipe",
		env: { ...process.env, CANARY_UPDATE: "" },
	});
	const exitCode = await proc.exited;
	assertTrue(exitCode === 2, "--update-baseline without env → exit 2", `got ${exitCode}`);
}

async function main(): Promise<void> {
	try {
		await test1_pureScore();
	} catch (e) {
		fail("test 1 threw", e instanceof Error ? e.message : String(e));
	}
	try {
		await test2_runCanaryTmpdirFixtures();
	} catch (e) {
		fail("test 2 threw", e instanceof Error ? e.message : String(e));
	}
	try {
		await test3_loadBaselineTmpdirFile();
	} catch (e) {
		fail("test 3 threw", e instanceof Error ? e.message : String(e));
	}
	try {
		await test4_cliAgainstLockedBaseline();
	} catch (e) {
		fail("test 4 threw", e instanceof Error ? e.message : String(e));
	}
	try {
		await test5_updateBaselineGuard();
	} catch (e) {
		fail("test 5 threw", e instanceof Error ? e.message : String(e));
	}

	if (failed > 0) {
		process.stdout.write(`\n\u2716 ${failed} assertion(s) failed\n`);
		process.exit(1);
	}
	process.stdout.write("\n\u2713 all green\n");
}

await main();
