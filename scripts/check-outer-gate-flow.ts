// @no-test: integration smoke test for BDD outer gate flow
/**
 * Verifies that:
 * 1. A sample kind:code spec scaffolds with its outer gate file present and RED
 * 2. spec:complete refuses to archive if outer gate is RED even when per-slice gates pass
 *
 * This gate is itself a workflow gate (kind:workflow, single check), not a code gate.
 * It drives a fixture to prove the new outer-gate machinery works end-to-end.
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const FIXTURE_ROOT = "/tmp/outer-gate-fixture";

async function sh(
	cmd: string[],
	opts: { silent?: boolean; cwd?: string } = {},
): Promise<{ ok: boolean; out: string; code: number }> {
	const proc = Bun.spawn(cmd, {
		stdout: opts.silent ? "pipe" : "inherit",
		stderr: opts.silent ? "pipe" : "inherit",
		cwd: opts.cwd,
	});
	const out = opts.silent ? await new Response(proc.stdout).text() : "";
	const code = await proc.exited;
	return { ok: code === 0, out, code };
}

async function main(): Promise<void> {
	console.log("→ BDD outer gate flow check (RED until implementation lands)\n");

	// Clean fixture
	if (existsSync(FIXTURE_ROOT)) {
		rmSync(FIXTURE_ROOT, { recursive: true, force: true });
	}
	mkdirSync(FIXTURE_ROOT, { recursive: true });

	// Create a minimal kind:code spec fixture
	const specDir = join(FIXTURE_ROOT, "specs", "active", "999-fixture-spec");
	mkdirSync(specDir, { recursive: true });

	// Minimal proposal.md with outer gate field
	const proposal = `---
id: 999-fixture-spec
title: Fixture spec for outer gate test
status: active
kind: code
gate: scripts/fixture-outer-gate.test.ts
created: 2026-04-28
owner: main
depends_on: []
supersedes: null
---

## Intent
Fixture spec to test outer gate flow.

## Constraints
- Minimal viable structure

## Acceptance criteria
- [ ] Outer gate exists and is RED at scaffold
- [ ] spec:complete blocks on RED outer gate

## Context
Test fixture only.
`;
	writeFileSync(join(specDir, "proposal.md"), proposal);

	// Minimal tasks.md with a per-slice gate
	const tasks = `- [ ] 1. Implement feature X
  - gate: src/feature-x.test.ts
  - file_targets: [src/feature-x.ts]
  - boundary: [src/feature-x.ts, src/feature-x.test.ts]
`;
	writeFileSync(join(specDir, "tasks.md"), tasks);

	// Check 1: Outer gate file should exist at the path declared in proposal.md
	const outerGatePath = join(FIXTURE_ROOT, "scripts", "fixture-outer-gate.test.ts");
	console.log("[Check 1] Outer gate file presence (NOT YET IMPLEMENTED — expect FAIL)");
	console.log(`  Expected path: ${outerGatePath}`);

	// This will fail until spec-tester scaffolds the outer gate for kind:code
	if (!existsSync(outerGatePath)) {
		console.log("  ✖ FAIL: outer gate file not present (spec-tester does not yet scaffold it)");
		console.log("\n[Gate status] RED — implementation incomplete");
		process.exit(1);
	}
	console.log("  ✓ outer gate file exists");

	// Check 2: Outer gate should be RED (fail when run)
	console.log("\n[Check 2] Outer gate is RED");
	const gateRun = await sh(["bun", "test", outerGatePath], {
		silent: true,
		cwd: FIXTURE_ROOT,
	});
	if (gateRun.ok) {
		console.log("  ✖ FAIL: outer gate passed (should be RED at scaffold)");
		process.exit(1);
	}
	console.log("  ✓ outer gate is RED as expected");

	// Check 3: Simulate per-slice gate passing (create .gate-frozen-1)
	console.log("\n[Check 3] Simulate per-slice gate GREEN");
	writeFileSync(join(specDir, ".gate-frozen-1"), "");
	console.log("  ✓ .gate-frozen-1 created");

	// Check 4: spec:complete should refuse when outer gate is RED
	console.log("\n[Check 4] spec:complete blocks on RED outer gate");
	const completeRun = await sh(["bun", "scripts/spec-complete.ts", "fixture-spec"], {
		silent: true,
		cwd: FIXTURE_ROOT,
	});
	if (completeRun.ok) {
		console.log("  ✖ FAIL: spec:complete did not block on RED outer gate");
		process.exit(1);
	}
	console.log("  ✓ spec:complete correctly refused (outer gate RED)");

	// All checks passed
	console.log("\n[Gate status] GREEN — all checks passed");
	rmSync(FIXTURE_ROOT, { recursive: true, force: true });
	process.exit(0);
}

if (import.meta.main) {
	await main();
}
