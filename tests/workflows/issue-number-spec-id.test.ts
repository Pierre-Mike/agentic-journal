/**
 * Outer gate: use issue number as spec id — spec 120
 *
 * BDD acceptance test covering the integrated change set. Asserts that after
 * slices 1-2 land, the allocation race is eliminated:
 *
 *   1. intent.yml aligner prompt no longer says "allocate" or "next-id"
 *   2. intent.yml aligner prompt references ISSUE_NUMBER as the spec-dir source
 *   3. intent.yml "Commit alignment.md" git-add glob is preserved unchanged
 *   4. auto-aligner.md instructs ISSUE_NUMBER-derived paths, not specs/ scanning
 *   5. spec-tester.md has no stale "allocate" / "next spec id" prose
 *
 * RED until slices 1-2 are GREEN (intent.yml and auto-aligner.md not yet updated).
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

const REPO_ROOT = join(import.meta.dir, "../..");
const INTENT_PATH = join(REPO_ROOT, ".github/workflows/intent.yml");
const AUTO_ALIGNER_PATH = join(REPO_ROOT, ".claude/agents/auto-aligner.md");
const SPEC_TESTER_PATH = join(REPO_ROOT, ".claude/agents/spec-tester.md");

type Step = {
	name?: string;
	id?: string;
	run?: string;
	env?: Record<string, string>;
	if?: string;
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
// 1. intent.yml — aligner prompt must not contain allocation language
// ---------------------------------------------------------------------------

describe("issue-number-spec-id: intent.yml — no allocation language", () => {
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
// 2. intent.yml — aligner prompt must reference ISSUE_NUMBER as spec-dir source
// ---------------------------------------------------------------------------

describe("issue-number-spec-id: intent.yml — ISSUE_NUMBER in spec path", () => {
	test("aligner prompt references ISSUE_NUMBER", () => {
		const run = getAlignerStep().run ?? "";
		expect(run).toMatch(/ISSUE_NUMBER/);
	});

	test("aligner prompt encodes specs/active/${ISSUE_NUMBER}-<slug>/ path shape", () => {
		const run = getAlignerStep().run ?? "";
		// Both ISSUE_NUMBER and specs/active/ must appear in the run block
		expect(run).toMatch(/ISSUE_NUMBER/);
		expect(run).toMatch(/specs\/active\//);
	});
});

// ---------------------------------------------------------------------------
// 3. intent.yml — git add glob must still cover specs/active/*/alignment.md
// ---------------------------------------------------------------------------

describe("issue-number-spec-id: intent.yml — git add glob preserved", () => {
	test("Commit alignment.md step git-add glob covers specs/active/*/alignment.md", () => {
		const raw = readFileSync(INTENT_PATH, "utf-8");
		expect(raw).toMatch(/specs\/active\/\*\/alignment\.md/);
	});
});

// ---------------------------------------------------------------------------
// 4. auto-aligner.md — must use ISSUE_NUMBER from env, not scan specs/
// ---------------------------------------------------------------------------

describe("issue-number-spec-id: auto-aligner.md — ISSUE_NUMBER from env", () => {
	test("auto-aligner.md exists", () => {
		expect(existsSync(AUTO_ALIGNER_PATH)).toBe(true);
	});

	test("auto-aligner.md references ISSUE_NUMBER", () => {
		const content = readFileSync(AUTO_ALIGNER_PATH, "utf-8");
		expect(content).toMatch(/ISSUE_NUMBER/);
	});

	test("auto-aligner.md instructs writing to specs/active/${ISSUE_NUMBER}-<slug>/ path", () => {
		const content = readFileSync(AUTO_ALIGNER_PATH, "utf-8");
		// Must reference both ISSUE_NUMBER and the specs/active/ path
		expect(content).toMatch(/ISSUE_NUMBER/);
		expect(content).toMatch(/specs\/active\//);
	});

	test("auto-aligner.md does not instruct scanning specs/ for id allocation", () => {
		const content = readFileSync(AUTO_ALIGNER_PATH, "utf-8");
		// Must not tell the aligner to scan specs/ to derive a next numeric id
		expect(content).not.toMatch(/scan\s+specs\//i);
		expect(content).not.toMatch(/next-id|next id/i);
	});
});

// ---------------------------------------------------------------------------
// 5. spec-tester.md — no stale allocation prose
// ---------------------------------------------------------------------------

describe("issue-number-spec-id: spec-tester.md — no stale allocation prose", () => {
	test("spec-tester.md exists", () => {
		expect(existsSync(SPEC_TESTER_PATH)).toBe(true);
	});

	test("spec-tester.md does not contain 'allocate' or 'next spec id'", () => {
		const content = readFileSync(SPEC_TESTER_PATH, "utf-8");
		expect(content).not.toMatch(/allocat/i);
		expect(content).not.toMatch(/next spec id/i);
	});
});
