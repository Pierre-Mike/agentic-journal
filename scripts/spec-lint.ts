/**
 * Validates every spec's frontmatter and detects cycles in depends_on.
 * Exits non-zero on any violation.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { listActiveSpecs, listArchivedIds, VALID_KINDS, gatePaths } from "./_lib";

function main(): void {
	const errors: string[] = [];
	const active = listActiveSpecs();
	const archivedIds = listArchivedIds();
	const allIds = new Set([...active.map((s) => s.frontmatter.id), ...archivedIds]);

	for (const spec of active) {
		const fm = spec.frontmatter;
		if (!VALID_KINDS.includes(fm.kind)) {
			errors.push(`${spec.slug}: invalid kind '${fm.kind}'. Expected one of ${VALID_KINDS.join(", ")}`);
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
	console.log(`✓ ${active.length} active spec(s) valid.`);
}

main();
