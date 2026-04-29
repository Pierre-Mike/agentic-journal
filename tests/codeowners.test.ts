import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "..");
const CODEOWNERS_PATH = join(ROOT, ".github", "CODEOWNERS");

describe("CODEOWNERS: freeze alignment.md", () => {
	it("file exists at .github/CODEOWNERS", () => {
		expect(existsSync(CODEOWNERS_PATH)).toBe(true);
	});

	it("contains a rule protecting specs/active/*/alignment.md", () => {
		const content = readFileSync(CODEOWNERS_PATH, "utf8");
		const lines = content.split("\n");
		const alignmentRule = lines.find((line) =>
			line.trim().startsWith("specs/active/*/alignment.md"),
		);
		expect(alignmentRule).toBeTruthy();
	});

	it("alignment.md owner is a lockout sentinel (prevents self-approval)", () => {
		const content = readFileSync(CODEOWNERS_PATH, "utf8");
		const lines = content.split("\n");
		const alignmentRule = lines.find((line) =>
			line.trim().startsWith("specs/active/*/alignment.md"),
		);
		expect(alignmentRule).toBeTruthy();
		// Owner must be a non-existent user or sentinel — never a real contributor
		// who could self-approve. Accepted sentinels: @no-such-user, @__freeze__,
		// or any owner whose name does not match a real repo member handle.
		const owner = alignmentRule!.trim().split(/\s+/).slice(1).join(" ");
		expect(owner.length).toBeGreaterThan(0);
		// Must NOT be the repo owner (pierre-mike) alone — that allows self-approval
		expect(owner).not.toBe("@pierre-mike");
		// Must start with @ (GitHub user/team syntax)
		expect(owner).toMatch(/^@/);
		// Must contain a name that signals lockout intent (no-such, freeze, lockout, bot)
		expect(owner).toMatch(/no-such|freeze|lockout|__/i);
	});

	it("has a default fallback rule for all other paths", () => {
		const content = readFileSync(CODEOWNERS_PATH, "utf8");
		const lines = content.split("\n");
		// A catch-all `* @owner` line must exist so other paths remain owned
		const fallback = lines.find((line) => /^\*\s+@\S+/.test(line.trim()));
		expect(fallback).toBeTruthy();
	});

	it("file ends with a newline (POSIX)", () => {
		const content = readFileSync(CODEOWNERS_PATH, "utf8");
		expect(content.endsWith("\n")).toBe(true);
	});
});
