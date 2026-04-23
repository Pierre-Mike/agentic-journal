/**
 * Pre-commit hook: rejects a staged diff that adds or modifies a TypeScript
 * source file under src/, scripts/, or .claude/ without its sibling *.test.ts
 * in the same commit.
 *
 * Exemption: first line of the file matches `// @no-test: <non-empty-reason>`.
 * Empty or missing reason does NOT exempt.
 *
 * CLI: bun scripts/sibling-test-hook.ts
 * Pure function: checkSiblingTests({ staged, readFirstLine? })
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

/** File patterns that are in scope for sibling-test enforcement. */
const INCLUDE_GLOBS = [
	new Bun.Glob("src/**/*.ts"),
	new Bun.Glob("scripts/**/*.ts"),
	new Bun.Glob(".claude/**/*.ts"),
];

/** File patterns that are excluded from enforcement (within included dirs). */
const SKIP_GLOBS = [
	new Bun.Glob("**/*.test.ts"),
	new Bun.Glob("scripts/smoke-*.ts"),
	new Bun.Glob("scripts/gates/*.ts"),
];

function isInScope(path: string): boolean {
	return INCLUDE_GLOBS.some((g) => g.match(path));
}

function isSkipped(path: string): boolean {
	return SKIP_GLOBS.some((g) => g.match(path));
}

/** Parse `// @no-test: <reason>` from first line. Returns reason or null. */
function parseNoTest(line: string | undefined): { valid: boolean } | null {
	if (!line) return null;
	if (!line.startsWith("// @no-test")) return null;
	// Must match exactly `// @no-test: <non-empty-reason>` where reason is non-whitespace
	const match = line.match(/^\/\/ @no-test:\s*(\S.*)$/);
	if (match) return { valid: true };
	// Present but reason is empty or missing
	return { valid: false };
}

export interface SiblingTestOffender {
	file: string;
	expectedSibling: string;
}

export interface SiblingTestResult {
	pass: boolean;
	offenders: SiblingTestOffender[];
}

/**
 * Pure function — no real git ops, no real FS reads unless readFirstLine is omitted.
 *
 * @param staged — list of staged file paths (output of git diff --cached --name-only)
 * @param readFirstLine — optional injector for testing; defaults to reading from disk
 */
export function checkSiblingTests({
	staged,
	readFirstLine,
}: {
	readonly staged: readonly string[];
	readonly readFirstLine?: (path: string) => string | undefined;
}): SiblingTestResult {
	const stagedSet = new Set(staged);

	const defaultReadFirstLine = (path: string): string | undefined => {
		try {
			const content = readFileSync(join(process.cwd(), path), "utf-8");
			return content.split("\n")[0];
		} catch {
			return undefined;
		}
	};

	const getFirstLine = readFirstLine ?? defaultReadFirstLine;

	const offenders: SiblingTestOffender[] = [];

	for (const file of staged) {
		if (!isInScope(file)) continue;
		if (isSkipped(file)) continue;

		// Check @no-test annotation
		const firstLine = getFirstLine(file);
		const noTest = parseNoTest(firstLine);
		if (noTest !== null) {
			if (noTest.valid) continue; // valid exemption
			// Invalid exemption (empty reason) — treat as offender
			offenders.push({ file, expectedSibling: file.replace(/\.ts$/, ".test.ts") });
			continue;
		}

		// Check for sibling test in same staged set
		const sibling = file.replace(/\.ts$/, ".test.ts");
		if (!stagedSet.has(sibling)) {
			offenders.push({ file, expectedSibling: sibling });
		}
	}

	return { pass: offenders.length === 0, offenders };
}

/** CLI entrypoint */
async function main(): Promise<void> {
	const proc = Bun.spawn(["git", "diff", "--cached", "--name-only", "--diff-filter=ACMR"], {
		stdout: "pipe",
		stderr: "pipe",
	});
	const out = await new Response(proc.stdout).text();
	await proc.exited;

	const staged = out.split("\n").filter(Boolean);
	const result = checkSiblingTests({ staged });

	if (result.pass) {
		process.exit(0);
	}

	const lines = result.offenders.map((o) => `  - ${o.file}  (expected ${o.expectedSibling})`);
	console.error(`✖ staged without sibling test:\n${lines.join("\n")}`);
	console.error(
		"\nfix: edit the sibling test and stage it, or add `// @no-test: <reason>` on line 1.",
	);
	process.exit(1);
}

if (import.meta.main) {
	await main();
}
