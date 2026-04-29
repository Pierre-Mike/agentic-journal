import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const CODEOWNERS_PATH = join(ROOT, ".github", "CODEOWNERS");

// Real repo handles that must NOT appear on the alignment rule's owner list.
// Any such handle would allow self-approval, defeating the freeze.
const REAL_HANDLES = ["@pierre-mike"];

describe("CODEOWNERS: freeze alignment.md", () => {
	it("file exists at .github/CODEOWNERS", () => {
		expect(existsSync(CODEOWNERS_PATH)).toBe(true);
	});

	it("alignment rule pattern is exactly specs/active/*/alignment.md (single-star glob)", () => {
		const content = readFileSync(CODEOWNERS_PATH, "utf8");
		const lines = content.split("\n");
		// The pattern must be exactly the single-star form GitHub CODEOWNERS honors.
		// ** is NOT equivalent to * in CODEOWNERS glob semantics.
		const alignmentRule = lines.find((line) =>
			/^specs\/active\/\*\/alignment\.md(\s|$)/.test(line.trim()),
		);
		expect(alignmentRule).toBeTruthy();
	});

	it("alignment.md owner list contains NO real repo handle (lockout sentinel only)", () => {
		const content = readFileSync(CODEOWNERS_PATH, "utf8");
		const lines = content.split("\n");
		const alignmentRule = lines.find((line) =>
			/^specs\/active\/\*\/alignment\.md(\s|$)/.test(line.trim()),
		);
		expect(alignmentRule).toBeTruthy();

		// Split on whitespace: first token is the pattern, remainder are owners.
		const tokens = (alignmentRule ?? "").trim().split(/\s+/);
		const owners = tokens.slice(1);

		// There must be at least one owner.
		expect(owners.length).toBeGreaterThan(0);

		// Every owner token must start with @ (GitHub user/team syntax).
		for (const o of owners) {
			expect(o).toMatch(/^@/);
		}

		// CODEOWNERS treats multiple owners as alternatives: if *any* owner is a
		// real contributor, that person can self-approve. Assert that NO token on
		// the list equals a recognised real repo handle.
		for (const realHandle of REAL_HANDLES) {
			expect(owners).not.toContain(realHandle);
		}

		// Every owner must be a lockout sentinel (unresolvable / bot / freeze marker).
		for (const o of owners) {
			expect(o).toMatch(/no-such|freeze|lockout|__/i);
		}
	});

	it("alignment rule line index is greater than any catch-all * rule (last-match-wins)", () => {
		const content = readFileSync(CODEOWNERS_PATH, "utf8");
		const lines = content.split("\n");

		// Find the line index of the alignment rule.
		const alignmentIdx = lines.findIndex((line) =>
			/^specs\/active\/\*\/alignment\.md(\s|$)/.test(line.trim()),
		);
		expect(alignmentIdx).toBeGreaterThan(-1);

		// Find the line index of the catch-all rule (* @...).
		const catchAllIdx = lines.findIndex((line) => /^\*\s+@\S+/.test(line.trim()));
		expect(catchAllIdx).toBeGreaterThan(-1);

		// CODEOWNERS uses last-match-wins semantics. The alignment rule must appear
		// AFTER the catch-all so it takes precedence over the default owner.
		expect(alignmentIdx).toBeGreaterThan(catchAllIdx);
	});

	it("has a default fallback rule for all other paths", () => {
		const content = readFileSync(CODEOWNERS_PATH, "utf8");
		const lines = content.split("\n");
		// A catch-all `* @owner` line must exist so other paths remain owned.
		const fallback = lines.find((line) => /^\*\s+@\S+/.test(line.trim()));
		expect(fallback).toBeTruthy();
	});

	it("file ends with a newline (POSIX)", () => {
		const content = readFileSync(CODEOWNERS_PATH, "utf8");
		expect(content.endsWith("\n")).toBe(true);
	});
});
