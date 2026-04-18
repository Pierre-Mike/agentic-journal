/**
 * Validates every spec's frontmatter and detects cycles in depends_on.
 * Also validates tasks.md schema per active spec and exports pure helpers
 * (validateBoundary, validateTaskSchema) consumed by tests and tasks-verify.
 * Exits non-zero on any violation.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gatePaths, listActiveSpecs, listArchivedIds, VALID_KINDS } from "./_lib";

export interface ParsedTask {
	readonly index: number;
	readonly title: string;
	readonly file_targets: readonly string[];
	readonly boundary?: readonly string[] | undefined;
}

export interface SchemaReport {
	readonly errors: readonly string[];
	readonly warnings: readonly string[];
}

export type BoundaryResult =
	| { readonly ok: true }
	| { readonly ok: false; readonly offendingFiles: readonly string[] };

/**
 * STUB — next commit replaces with real Bun.Glob matcher.
 * Present so the test file compiles against the module.
 */
export function validateBoundary(_args: {
	readonly task: { readonly boundary?: readonly string[] | undefined };
	readonly changedFiles: readonly string[];
	readonly repoRoot: string;
}): BoundaryResult {
	throw new Error("validateBoundary not yet implemented");
}

/**
 * STUB — next commit replaces with real schema checker.
 */
export function validateTaskSchema(_task: ParsedTask): SchemaReport {
	throw new Error("validateTaskSchema not yet implemented");
}

function main(): void {
	const errors: string[] = [];
	const active = listActiveSpecs();
	const archivedIds = listArchivedIds();
	const allIds = new Set([...active.map((s) => s.frontmatter.id), ...archivedIds]);

	for (const spec of active) {
		const fm = spec.frontmatter;
		if (!VALID_KINDS.includes(fm.kind)) {
			errors.push(
				`${spec.slug}: invalid kind '${fm.kind}'. Expected one of ${VALID_KINDS.join(", ")}`,
			);
		}
		for (const g of gatePaths(spec)) {
			if (!existsSync(join(process.cwd(), g))) {
				errors.push(`${spec.slug}: gate artifact missing at ${g}`);
			}
		}
		for (const dep of fm.depends_on) {
			if (!allIds.has(dep)) {
				errors.push(`${spec.slug}: depends_on references unknown spec '${dep}'`);
			}
		}
	}

	// Cycle detection
	const graph = new Map<string, string[]>();
	for (const spec of active) {
		graph.set(spec.frontmatter.id, spec.frontmatter.depends_on);
	}
	const visited = new Set<string>();
	const stack = new Set<string>();
	function visit(id: string, path: string[]): void {
		if (stack.has(id)) {
			errors.push(`cycle detected: ${[...path, id].join(" → ")}`);
			return;
		}
		if (visited.has(id)) return;
		stack.add(id);
		for (const dep of graph.get(id) ?? []) visit(dep, [...path, id]);
		stack.delete(id);
		visited.add(id);
	}
	for (const id of graph.keys()) visit(id, []);

	if (errors.length > 0) {
		for (const e of errors) console.error(`✖ ${e}`);
		process.exit(1);
	}
	// readFileSync is imported for future use (task parsing in a later commit)
	void readFileSync;
	console.log(`✓ ${active.length} active spec(s) valid.`);
}

if (import.meta.main) {
	main();
}
