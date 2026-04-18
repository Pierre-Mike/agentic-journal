/**
 * Gate for spec 010-expertise-consolidate.
 *
 * Real-assertion smoke: builds a tmpdir with a known expertise ref file
 * containing duplicate + stale + fresh entries, invokes `consolidateFile`,
 * asserts kept/dropped counts and exact post-consolidation output, then
 * re-invokes and asserts idempotency (byte-identical output + `changed: false`).
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

const FIXTURE = `---
domain: skills
type: gotchas
updated: "2026-04-18"
updated_by: "smoke"
---

# Skills Gotchas

- **SK-G001: fresh one**
  confidence: 0.7 | added: 2026-03-20
  Fresh body A.

- **SK-G002: another fresh**
  confidence: 0.6 | added: 2026-04-01
  Fresh body B.

- **SK-G001: fresh one**
  confidence: 0.7 | added: 2026-03-20
  Fresh body A.

- **SK-G003: stale one**
  confidence: 0.5 | added: 2024-01-01
  Stale body C.
`;

async function test1_consolidate(): Promise<void> {
	process.stdout.write("test 1: consolidateFile drops dups + stale entries\n");
	const dir = mkdtempSync(join(tmpdir(), "expertise-consolidate-"));
	try {
		const path = join(dir, "gotchas.md");
		writeFileSync(path, FIXTURE);

		const mod = await import(join(process.cwd(), "scripts/expertise-consolidate.ts"));
		const required = ["parseEntries", "dedupeByHash", "pruneByAge", "serialize", "consolidateFile"];
		for (const name of required) {
			if (typeof mod[name] !== "function") {
				fail(`scripts/expertise-consolidate.ts exports ${name}`, "missing");
				return;
			}
		}

		const now = new Date("2026-04-18T00:00:00.000Z");
		const res = mod.consolidateFile({ path, now, maxAgeDays: 180, dryRun: false });
		assertTrue(res.kept === 2, "kept === 2 (deduped + stale dropped)", `got ${res.kept}`);
		assertTrue(res.dropped === 2, "dropped === 2", `got ${res.dropped}`);
		assertTrue(res.changed === true, "changed === true on first run");

		const after = readFileSync(path, "utf-8");
		const occ = after.split("SK-G001: fresh one").length - 1;
		assertTrue(occ === 1, "SK-G001 appears exactly once after dedup", `occurrences ${occ}`);
		assertTrue(!after.includes("SK-G003: stale one"), "SK-G003 (stale) is pruned from output");
		assertTrue(after.includes("SK-G002: another fresh"), "SK-G002 survives");
		assertTrue(after.startsWith("---\ndomain: skills"), "frontmatter preserved as header");
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

async function test2_idempotency(): Promise<void> {
	process.stdout.write("\ntest 2: second run is byte-identical (idempotency)\n");
	const dir = mkdtempSync(join(tmpdir(), "expertise-consolidate-"));
	try {
		const path = join(dir, "gotchas.md");
		writeFileSync(path, FIXTURE);
		const mod = await import(join(process.cwd(), "scripts/expertise-consolidate.ts"));
		const now = new Date("2026-04-18T00:00:00.000Z");

		mod.consolidateFile({ path, now, maxAgeDays: 180, dryRun: false });
		const pass1 = readFileSync(path, "utf-8");
		const res2 = mod.consolidateFile({ path, now, maxAgeDays: 180, dryRun: false });
		const pass2 = readFileSync(path, "utf-8");

		assertTrue(res2.changed === false, "second run reports changed: false");
		assertTrue(res2.dropped === 0, "second run drops nothing", `got ${res2.dropped}`);
		assertTrue(pass1 === pass2, "second pass output byte-identical to first");
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

async function test3_dryRun(): Promise<void> {
	process.stdout.write("\ntest 3: --dry-run does not write\n");
	const dir = mkdtempSync(join(tmpdir(), "expertise-consolidate-"));
	try {
		const path = join(dir, "gotchas.md");
		writeFileSync(path, FIXTURE);
		const mod = await import(join(process.cwd(), "scripts/expertise-consolidate.ts"));
		const now = new Date("2026-04-18T00:00:00.000Z");

		const res = mod.consolidateFile({ path, now, maxAgeDays: 180, dryRun: true });
		assertTrue(res.kept === 2, "kept === 2 reported in dry-run", `got ${res.kept}`);
		assertTrue(res.dropped === 2, "dropped === 2 reported in dry-run", `got ${res.dropped}`);

		const unchanged = readFileSync(path, "utf-8");
		assertTrue(unchanged === FIXTURE, "file bytes untouched under --dry-run");
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

async function test4_pureFns(): Promise<void> {
	process.stdout.write("\ntest 4: pure-fn surface area\n");
	const mod = await import(join(process.cwd(), "scripts/expertise-consolidate.ts"));
	const { header, entries } = mod.parseEntries(FIXTURE);
	assertTrue(entries.length === 4, "parseEntries → 4 entries", `got ${entries.length}`);
	assertTrue(header.includes("# Skills Gotchas"), "header preserved");

	const deduped = mod.dedupeByHash(entries);
	assertTrue(deduped.length === 3, "dedupeByHash → 3", `got ${deduped.length}`);

	const now = new Date("2026-04-18T00:00:00.000Z");
	const pruned = mod.pruneByAge({ entries: deduped, now, maxAgeDays: 180 });
	assertTrue(pruned.length === 2, "pruneByAge → 2", `got ${pruned.length}`);

	const out = mod.serialize({ header, entries: pruned });
	const reparsed = mod.parseEntries(out);
	const out2 = mod.serialize({ header: reparsed.header, entries: reparsed.entries });
	assertTrue(out === out2, "serialize ∘ parse is identity on consolidated output");
}

async function main(): Promise<void> {
	try {
		await test1_consolidate();
	} catch (e) {
		fail("test 1 threw", e instanceof Error ? e.message : String(e));
	}
	try {
		await test2_idempotency();
	} catch (e) {
		fail("test 2 threw", e instanceof Error ? e.message : String(e));
	}
	try {
		await test3_dryRun();
	} catch (e) {
		fail("test 3 threw", e instanceof Error ? e.message : String(e));
	}
	try {
		await test4_pureFns();
	} catch (e) {
		fail("test 4 threw", e instanceof Error ? e.message : String(e));
	}

	if (failed > 0) {
		process.stdout.write(`\n\u2716 ${failed} assertion(s) failed\n`);
		process.exit(1);
	}
	process.stdout.write("\n\u2713 all green\n");
}

await main();
