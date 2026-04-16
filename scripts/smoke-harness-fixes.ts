/**
 * Gate for spec 003-harness-friction-fixes.
 *
 * Real-assertion smoke: runs the actual behaviours expected to hold post-fix.
 * Pre-fix this exits 1 with specific failure messages; post-fix it exits 0.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

async function test1_specGuardResolvesRepoRoot(): Promise<void> {
	console.log("test 1: spec-guard resolves enclosing repo root from filePath");
	const root = mkdtempSync(join(tmpdir(), "guard-"));
	try {
		mkdirSync(join(root, ".git"), { recursive: true });
		const specDir = join(root, "specs", "active", "000-fake");
		mkdirSync(specDir, { recursive: true });
		writeFileSync(
			join(specDir, "proposal.md"),
			"---\nid: 000-fake\nkind: writeup\ngate: content/posts/fake.mdx\n---\n\nTargets content/posts/fake.mdx here.",
		);
		mkdirSync(join(root, "content", "posts"), { recursive: true });
		const filePath = join(root, "content", "posts", "fake.mdx");

		const mod = await import(join(process.cwd(), ".claude/hooks/spec-guard.ts"));
		const unrelatedCwd = mkdtempSync(join(tmpdir(), "elsewhere-"));
		try {
			const result = mod.activeSpecTargetsFile(unrelatedCwd, filePath);
			assertTrue(
				result === true,
				"activeSpecTargetsFile(unrelated cwd, filePath under repo) \u2192 true",
				`got ${result}`,
			);
		} finally {
			rmSync(unrelatedCwd, { recursive: true, force: true });
		}
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

async function test2_specCompleteAcceptsSlug(): Promise<void> {
	console.log("\ntest 2: spec-complete exports resolveSpec accepting slug-only");
	const root = mkdtempSync(join(tmpdir(), "complete-"));
	try {
		const specDir = join(root, "specs", "active", "007-widget-gizmo");
		mkdirSync(specDir, { recursive: true });
		writeFileSync(
			join(specDir, "proposal.md"),
			"---\nid: 007-widget-gizmo\nkind: rule\ngate: some/path\n---\n\nIntent.",
		);

		const mod = await import(join(process.cwd(), "scripts/spec-complete.ts"));
		if (typeof mod.resolveSpec !== "function") {
			fail("resolveSpec is exported from scripts/spec-complete.ts", "no such export");
			return;
		}
		const exact = mod.resolveSpec("007-widget-gizmo", root);
		const slugOnly = mod.resolveSpec("widget-gizmo", root);
		const miss = mod.resolveSpec("no-such-slug", root);

		assertTrue(
			typeof exact === "string" && exact.endsWith("007-widget-gizmo"),
			"exact id-slug resolves",
			`got ${exact}`,
		);
		assertTrue(
			typeof slugOnly === "string" && slugOnly.endsWith("007-widget-gizmo"),
			"slug-only (suffix-match) resolves",
			`got ${slugOnly}`,
		);
		assertTrue(miss === null, "unknown slug returns null", `got ${miss}`);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

async function main(): Promise<void> {
	try {
		await test1_specGuardResolvesRepoRoot();
	} catch (e) {
		fail("test 1 threw", e instanceof Error ? e.message : String(e));
	}
	try {
		await test2_specCompleteAcceptsSlug();
	} catch (e) {
		fail("test 2 threw", e instanceof Error ? e.message : String(e));
	}

	if (failed > 0) {
		console.log(`\n\u2716 ${failed} assertion(s) failed`);
		process.exit(1);
	}
	console.log("\n\u2713 all green");
}

await main();
