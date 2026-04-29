// @no-test: sibling test scripts/spec-status.test.ts was committed as the frozen gate in the RED slice commit
/**
 * Reports the state of every active spec: ready, blocked, or in-progress.
 * State is computed from the filesystem — never stored.
 */

import type { Spec } from "../_lib";
import { isReady, listActiveSpecs, listArchivedIds, sliceProgress, unresolvedDeps } from "../_lib";

export function formatSpecLine(
	spec: Spec,
	archived: Set<string>,
	progress: { frozen: number; total: number } | null,
): string {
	const blockers = unresolvedDeps(spec, archived);
	const state = isReady(spec, archived) ? "READY" : `BLOCKED-BY: ${blockers.join(", ")}`;
	const base = `  [${state}] ${spec.frontmatter.id} — ${spec.frontmatter.title} (${spec.frontmatter.kind})`;
	if (progress === null) return base;
	return `${base} [${progress.frozen}/${progress.total} frozen]`;
}

function main(): void {
	const archived = listArchivedIds();
	const active = listActiveSpecs();

	if (active.length === 0) {
		console.log("no active specs.");
		return;
	}

	console.log("active specs:");
	for (const spec of active) {
		const progress = sliceProgress({ specDir: spec.dir });
		console.log(formatSpecLine(spec, archived, progress));
	}
}

main();
