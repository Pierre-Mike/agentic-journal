/**
 * Gate for spec 009-claude-telemetry.
 *
 * Real-assertion smoke: asserts that the `CLAUDE_CODE_ENABLE_TELEMETRY` env var
 * is set to `"1"` in the script's runtime environment. When unset, exits 1 with
 * a remediation pointer at `AGENTS.md` §Observability. Post-config this exits 0.
 *
 * Pattern mirrors `scripts/smoke-harness-fixes.ts`: `assertTrue` helper,
 * `process.exit(failed > 0 ? 1 : 0)`.
 */

let failed = 0;

function pass(name: string): void {
	console.log(`  \u2713 ${name}`);
}

function fail(name: string, detail?: string): void {
	console.log(`  \u2716 ${name}${detail ? ` \u2014 ${detail}` : ""}`);
	failed++;
}

function assertTrue(cond: boolean, name: string, detail?: string): void {
	if (cond) pass(name);
	else fail(name, detail);
}

function test1_envVarIsSet(): void {
	console.log("test 1: CLAUDE_CODE_ENABLE_TELEMETRY === '1'");
	const actual = process.env.CLAUDE_CODE_ENABLE_TELEMETRY;
	assertTrue(
		actual === "1",
		"process.env.CLAUDE_CODE_ENABLE_TELEMETRY === '1'",
		`got ${actual === undefined ? "<unset>" : JSON.stringify(actual)}`,
	);
}

function main(): void {
	try {
		test1_envVarIsSet();
	} catch (e) {
		fail("test 1 threw", e instanceof Error ? e.message : String(e));
	}

	if (failed > 0) {
		console.log(`\n\u2716 ${failed} assertion(s) failed`);
		console.log("\nRemediation: export CLAUDE_CODE_ENABLE_TELEMETRY=1 in your shell, or see");
		console.log("AGENTS.md \u00a7 Observability for the repo-level configuration location.");
		process.exit(1);
	}
	console.log("\n\u2713 all green");
}

main();
