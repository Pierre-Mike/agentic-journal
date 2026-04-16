/**
 * Runs the gate for every active spec, dispatched on `kind`.
 * Single source of truth for "is this spec done?"
 */

import { gatePaths, listActiveSpecs, type Spec } from "./_lib";
import { checkRule } from "./gates/rule";
import { checkWorkflow } from "./gates/smoke";
import { checkCode } from "./gates/test";
import { checkWriteup } from "./gates/writeup";

interface GateResult {
	pass: boolean;
	message: string;
}

async function verify(spec: Spec): Promise<GateResult> {
	const paths = gatePaths(spec);
	switch (spec.frontmatter.kind) {
		case "code":
			return checkCode(paths);
		case "rule":
			return checkRule(paths);
		case "workflow":
			return checkWorkflow(paths);
		case "writeup":
			return checkWriteup(paths);
	}
}

async function main(): Promise<void> {
	const specs = listActiveSpecs();
	if (specs.length === 0) {
		console.log("no active specs to verify.");
		return;
	}

	let anyFail = false;
	for (const spec of specs) {
		const result = await verify(spec);
		const mark = result.pass ? "✓" : "✖";
		console.log(`${mark} ${spec.frontmatter.id} (${spec.frontmatter.kind}) — ${result.message}`);
		if (!result.pass) anyFail = true;
	}

	if (anyFail) process.exit(1);
}

await main();
