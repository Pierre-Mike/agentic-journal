/**
 * Unit tests for scripts/issue-to-mailbox.ts
 */

import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Process } from "./_lib.ts";
import { issueToMailbox } from "./issue-to-mailbox.ts";

interface CmdRecord {
	readonly cmd: readonly string[];
	readonly result: { ok: boolean; stdout: string };
}

function makeMockProcess(results: Array<{ ok: boolean; stdout: string }>): {
	process: Process;
	calls: CmdRecord[];
} {
	const calls: CmdRecord[] = [];
	let callIndex = 0;

	const process: Process = {
		async run(cmd) {
			const result = results[callIndex] ?? { ok: true, stdout: "" };
			callIndex += 1;
			calls.push({ cmd, result });
			return result;
		},
	};

	return { process, calls };
}

function mockIssueWithAlignment(
	issueNumber: number,
	overrides?: {
		confidence?: "high" | "low";
		straightforward?: string[];
		nonObvious?: string[];
		intent?: string;
	},
): string {
	const intent = overrides?.intent ?? "Build a feature that does X";
	const straightforward = overrides?.straightforward ?? [
		"Add new endpoint /api/foo",
		"Update schema with bar field",
	];
	const nonObvious = overrides?.nonObvious ?? [
		"Use postgres for consistency",
		"Avoid caching for first iteration",
	];
	const confidence = overrides?.confidence ?? "high";

	return JSON.stringify({
		number: issueNumber,
		title: "Test issue",
		body: `## Intent

${intent}

## Alignment

**Goal**: Implement foo feature
**Big picture**: This adds support for foo across the system
**Straightforward details**:
${straightforward.map((s) => `- ${s}`).join("\n")}
**Non-obvious decisions**:
${nonObvious.map((s) => `- ${s}`).join("\n")}
**Confidence**: ${confidence}
**Kind**: code

## Approval

- [ ] approved

## Timeline
`,
		labels: [{ name: "alignment:proposed" }],
	});
}

function mockIssueWithoutAlignment(issueNumber: number): string {
	return JSON.stringify({
		number: issueNumber,
		title: "Test issue without alignment",
		body: `## Intent

Some intent here

## Alignment

## Approval

- [ ] approved

## Timeline
`,
		labels: [{ name: "intent:captured" }],
	});
}

describe("issueToMailbox", () => {
	test("happy path: full alignment renders with all sections", async () => {
		const tempDir = mkdtempSync(join(tmpdir(), "issue-to-mailbox-test-"));
		const outputPath = join(tempDir, ".agentic", "last-alignment.md");

		const ghOutput = mockIssueWithAlignment(42);
		const { process } = makeMockProcess([{ ok: true, stdout: ghOutput }]);

		const fixedDate = new Date("2026-05-04T12:34:56.000Z");
		const result = await issueToMailbox(42, process, {
			outputPath,
			now: () => fixedDate,
		});

		expect(result.outputPath).toBe(outputPath);
		expect(existsSync(outputPath)).toBe(true);

		const content = readFileSync(outputPath, "utf-8");

		// Verify frontmatter keys present
		expect(content).toContain("created: 2026-05-04T12:34:56.000Z");
		expect(content).toContain("status: confirmed");
		expect(content).toContain("confidence: high");
		expect(content).toMatch(/intent_hash: [a-f0-9]{12}/);

		// Verify all required H2 sections
		expect(content).toContain("## Goal");
		expect(content).toContain("## Big Picture");
		expect(content).toContain("## Straightforward Details");
		expect(content).toContain("## Non-obvious Decisions");

		// Verify content
		expect(content).toContain("Implement foo feature");
		expect(content).toContain("This adds support for foo across the system");
		expect(content).toContain("- Add new endpoint /api/foo");
		expect(content).toContain("- Update schema with bar field");
		expect(content).toContain("- Use postgres for consistency");
		expect(content).toContain("- Avoid caching for first iteration");
	});

	test("empty straightforward & nonObvious: section headers still present", async () => {
		const tempDir = mkdtempSync(join(tmpdir(), "issue-to-mailbox-test-"));
		const outputPath = join(tempDir, ".agentic", "last-alignment.md");

		const ghOutput = mockIssueWithAlignment(43, {
			straightforward: [],
			nonObvious: [],
		});
		const { process } = makeMockProcess([{ ok: true, stdout: ghOutput }]);

		await issueToMailbox(43, process, { outputPath });

		const content = readFileSync(outputPath, "utf-8");

		// Section headers must be present
		expect(content).toContain("## Straightforward Details");
		expect(content).toContain("## Non-obvious Decisions");

		// No bullets should appear for empty arrays
		const lines = content.split("\n");
		const straightforwardIdx = lines.indexOf("## Straightforward Details");
		const nonObviousIdx = lines.indexOf("## Non-obvious Decisions");

		expect(straightforwardIdx).toBeGreaterThan(-1);
		expect(nonObviousIdx).toBeGreaterThan(-1);

		// Between Straightforward Details and Non-obvious Decisions, no bullet lines
		const betweenLines = lines.slice(straightforwardIdx + 1, nonObviousIdx);
		const bullets = betweenLines.filter((l) => l.trim().startsWith("-"));
		expect(bullets).toHaveLength(0);
	});

	test("confidence: low flows through to frontmatter", async () => {
		const tempDir = mkdtempSync(join(tmpdir(), "issue-to-mailbox-test-"));
		const outputPath = join(tempDir, ".agentic", "last-alignment.md");

		const ghOutput = mockIssueWithAlignment(44, { confidence: "low" });
		const { process } = makeMockProcess([{ ok: true, stdout: ghOutput }]);

		await issueToMailbox(44, process, { outputPath });

		const content = readFileSync(outputPath, "utf-8");
		expect(content).toContain("confidence: low");
	});

	test("issue with no alignment throws with issue number in message", async () => {
		const tempDir = mkdtempSync(join(tmpdir(), "issue-to-mailbox-test-"));
		const outputPath = join(tempDir, ".agentic", "last-alignment.md");

		const ghOutput = mockIssueWithoutAlignment(45);
		const { process } = makeMockProcess([{ ok: true, stdout: ghOutput }]);

		let errorMessage = "";
		try {
			await issueToMailbox(45, process, { outputPath });
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : String(err);
		}

		expect(errorMessage).toContain("45");
		expect(errorMessage).toContain("no alignment");
	});

	test("injected now function controls created timestamp", async () => {
		const tempDir = mkdtempSync(join(tmpdir(), "issue-to-mailbox-test-"));
		const outputPath = join(tempDir, ".agentic", "last-alignment.md");

		const ghOutput = mockIssueWithAlignment(46);
		const { process } = makeMockProcess([{ ok: true, stdout: ghOutput }]);

		const fixedDate = new Date("2025-12-25T08:00:00.000Z");
		await issueToMailbox(46, process, {
			outputPath,
			now: () => fixedDate,
		});

		const content = readFileSync(outputPath, "utf-8");
		expect(content).toContain("created: 2025-12-25T08:00:00.000Z");
	});

	test("cross-validation: output passes check-alignment-mailbox validator", async () => {
		const tempDir = mkdtempSync(join(tmpdir(), "issue-to-mailbox-test-"));
		const outputPath = join(tempDir, ".agentic", "last-alignment.md");

		const ghOutput = mockIssueWithAlignment(47);
		const { process } = makeMockProcess([{ ok: true, stdout: ghOutput }]);

		await issueToMailbox(47, process, { outputPath });

		// Exec validator
		const proc = Bun.spawn(["bun", "scripts/agentic/check-alignment-mailbox.ts", outputPath], {
			stdout: "pipe",
			stderr: "pipe",
		});

		const exitCode = await proc.exited;
		expect(exitCode).toBe(0);
	});

	test("intent_hash is 12 hex characters derived from intent", async () => {
		const tempDir = mkdtempSync(join(tmpdir(), "issue-to-mailbox-test-"));
		const outputPath = join(tempDir, ".agentic", "last-alignment.md");

		const testIntent = "Unique intent text for hashing";
		const ghOutput = mockIssueWithAlignment(48, { intent: testIntent });
		const { process } = makeMockProcess([{ ok: true, stdout: ghOutput }]);

		await issueToMailbox(48, process, { outputPath });

		const content = readFileSync(outputPath, "utf-8");

		// Extract intent_hash from frontmatter
		const match = content.match(/intent_hash: ([a-f0-9]{12})/);
		expect(match).not.toBeNull();
		const intentHash = match?.[1];

		// Compute expected hash
		const expectedHash = new Bun.CryptoHasher("sha256")
			.update(testIntent)
			.digest("hex")
			.slice(0, 12);

		expect(intentHash).toBe(expectedHash);
	});
});
