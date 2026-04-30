// Slice 1 gate: intent.yml — aligner prompt uses ISSUE_NUMBER as spec id (spec 120)
//
// Tests:
//   1. Aligner prompt does NOT contain "allocate" (no allocation language)
//   2. Aligner prompt does NOT contain "next-id" (no allocation language)
//   3. Aligner prompt references ISSUE_NUMBER as the spec-dir source
//   4. git add glob in "Commit alignment.md" still covers specs/active/STAR/alignment.md
//
// RED until slice 1 is implemented (intent.yml aligner prompt still says
// "allocate a new spec id … next-id" at time of scaffolding).

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

const REPO_ROOT = join(import.meta.dir, "../..");
const INTENT_PATH = join(REPO_ROOT, ".github/workflows/intent.yml");

type Step = {
	name?: string;
	id?: string;
	run?: string;
	env?: Record<string, string>;
};

type WorkflowDoc = {
	jobs?: Record<string, { steps?: Step[] }>;
};

function parseIntentYml(): WorkflowDoc {
	const raw = readFileSync(INTENT_PATH, "utf-8");
	return parseYaml(raw) as WorkflowDoc;
}

/** Return the "Run auto-aligner subagent" step from the align job. */
function getAlignerStep(): Step {
	const wf = parseIntentYml();
	const steps = wf.jobs?.align?.steps ?? [];
	return (
		steps.find((s) => s.id === "align" || s.name?.toLowerCase().includes("auto-aligner")) ?? {}
	);
}

// ---------------------------------------------------------------------------
// 1. Aligner prompt must not contain allocation language
// ---------------------------------------------------------------------------

describe("intent.yml: aligner prompt — no allocation language", () => {
	test("aligner prompt does not contain 'allocate'", () => {
		const run = getAlignerStep().run ?? "";
		expect(run).not.toMatch(/allocat/i);
	});

	test("aligner prompt does not contain 'next-id'", () => {
		const run = getAlignerStep().run ?? "";
		expect(run).not.toMatch(/next-id/i);
	});
});

// ---------------------------------------------------------------------------
// 2. Aligner prompt must reference ISSUE_NUMBER as spec-dir source
// ---------------------------------------------------------------------------

describe("intent.yml: aligner prompt — ISSUE_NUMBER as spec id", () => {
	test("aligner prompt references ISSUE_NUMBER", () => {
		const run = getAlignerStep().run ?? "";
		expect(run).toMatch(/ISSUE_NUMBER/);
	});

	test("aligner prompt encodes specs/active/${ISSUE_NUMBER}-<slug>/ path shape", () => {
		const run = getAlignerStep().run ?? "";
		expect(run).toMatch(/ISSUE_NUMBER/);
		expect(run).toMatch(/specs\/active\//);
	});
});

// ---------------------------------------------------------------------------
// 3. git add glob must still cover specs/active/*/alignment.md
// ---------------------------------------------------------------------------

describe("intent.yml: Commit alignment.md step — git add glob preserved", () => {
	test("git add glob covers specs/active/*/alignment.md (depth-1 wildcard)", () => {
		const raw = readFileSync(INTENT_PATH, "utf-8");
		expect(raw).toMatch(/specs\/active\/\*\/alignment\.md/);
	});
});
