/**
 * Bootstrap GitHub labels for the issue-as-spec workflow.
 *
 * Ensures a fixed set of labels exists on the current repo. Idempotent: safe to run multiple times.
 *
 * Usage:
 *   bun scripts/spec-labels-bootstrap.ts
 */

import type { Process } from "./_lib.ts";
import { realProcess } from "./_lib.ts";

export interface LabelDef {
	readonly name: string;
	readonly color: string;
	readonly description: string;
}

export const LABELS: readonly LabelDef[] = [
	{
		name: "intent:captured",
		color: "cccccc",
		description: "User intent recorded; awaiting alignment",
	},
	{
		name: "alignment:proposed",
		color: "fbca04",
		description: "AI alignment posted; awaiting approval",
	},
	{ name: "alignment:approved", color: "0e8a16", description: "User approved alignment" },
	{ name: "ready:dispatch", color: "1d76db", description: "Ready for /do dispatch" },
	{ name: "done", color: "5319e7", description: "Spec complete" },
	{ name: "kind:code", color: "c5def5", description: "Code spec (TDD chain)" },
	{ name: "kind:rule", color: "c5def5", description: "Rule/doc spec" },
	{ name: "kind:workflow", color: "c5def5", description: "Workflow change spec" },
	{ name: "kind:writeup", color: "c5def5", description: "Write-up only" },
	{ name: "needs:human", color: "b60205", description: "Blocked on human input" },
	{ name: "escalation:replan", color: "d93f0b", description: "Replanner escalated" },
	{ name: "escalation:judge", color: "d93f0b", description: "Judge 3-strike fail" },
	{ name: "confidence:low", color: "e99695", description: "AI confidence low" },
];

export async function bootstrap(
	p: Process,
	opts?: { repo?: string },
): Promise<{ applied: string[] }> {
	const applied: string[] = [];

	for (const label of LABELS) {
		// `--force` makes gh upsert: creates if missing, updates color/description if present.
		// One round-trip per label, no stderr parsing, fully idempotent.
		const cmd = [
			"gh",
			"label",
			"create",
			label.name,
			"--color",
			label.color,
			"--description",
			label.description,
			"--force",
		];
		if (opts?.repo) {
			cmd.push("--repo", opts.repo);
		}

		const result = await p.run(cmd);
		if (!result.ok) {
			throw new Error(`failed to apply label '${label.name}': ${result.stdout}`);
		}
		applied.push(label.name);
	}

	return { applied };
}

if (import.meta.main) {
	const { applied } = await bootstrap(realProcess);
	// biome-ignore lint/suspicious/noConsole: CLI entrypoint
	console.log(`Applied ${applied.length} labels: ${applied.join(", ")}`);
}
