/**
 * Unit tests for scripts/issue-write.ts
 */

import { describe, expect, test } from "bun:test";
import type { Process } from "./_lib.ts";
import { parseBody } from "./issue.ts";
import type { Payload } from "./issue-write.ts";
import { writeIssue } from "./issue-write.ts";

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

describe("writeIssue", () => {
	test("edit path calls gh issue edit, setLifecycle, and addLabel in sequence", async () => {
		const payload: Payload = {
			title: "Test Issue",
			intent: "Do something useful",
			alignment: {
				goal: "Test goal",
				bigPicture: "Test big picture",
				straightforward: [],
				nonObvious: [],
				confidence: "high",
				kind: "code",
				dependsOn: [],
			},
			issueNumber: 42,
		};

		// setLifecycle calls: loadIssue (1), addLabel (2), removeLabel (3)
		// addLabel for kind: (4)
		const results = [
			{ ok: true, stdout: "" }, // gh issue edit
			{
				ok: true,
				stdout: JSON.stringify({
					number: 42,
					title: "Test",
					body: "",
					labels: [],
				}),
			}, // loadIssue
			{ ok: true, stdout: "" }, // addLabel alignment:proposed
			{ ok: true, stdout: "" }, // addLabel kind:code
		];

		const { process, calls } = makeMockProcess(results);
		const result = await writeIssue(payload, process);

		expect(result).toEqual({ issueNumber: 42, created: false });
		expect(calls[0]?.cmd[0]).toBe("gh");
		expect(calls[0]?.cmd[1]).toBe("issue");
		expect(calls[0]?.cmd[2]).toBe("edit");
		expect(calls[0]?.cmd[3]).toBe("42");
		expect(calls[0]?.cmd[4]).toBe("--body");
	});

	test("edit path body round-trips through parseBody", async () => {
		const payload: Payload = {
			title: "Test Issue",
			intent: "Do something useful",
			alignment: {
				goal: "Test goal",
				bigPicture: "Test big picture",
				straightforward: ["Detail 1"],
				nonObvious: ["Decision 1"],
				confidence: "high",
				kind: "code",
				dependsOn: [],
			},
			issueNumber: 42,
		};

		const results = [
			{ ok: true, stdout: "" },
			{
				ok: true,
				stdout: JSON.stringify({
					number: 42,
					title: "Test",
					body: "",
					labels: [],
				}),
			},
			{ ok: true, stdout: "" },
			{ ok: true, stdout: "" },
		];

		const { process, calls } = makeMockProcess(results);
		await writeIssue(payload, process);

		const bodyArg = calls[0]?.cmd[5];
		if (typeof bodyArg !== "string") throw new Error("Expected body arg");

		const parsed = parseBody(bodyArg);
		expect(parsed.intent).toBe(payload.intent);
		expect(parsed.alignment?.goal).toBe(payload.alignment.goal);
		expect(parsed.alignment?.bigPicture).toBe(payload.alignment.bigPicture);
		expect(parsed.alignment?.confidence).toBe(payload.alignment.confidence);
		expect(parsed.alignment?.kind).toBe(payload.alignment.kind);
	});

	test("create path calls gh issue create with correct args", async () => {
		const payload: Payload = {
			title: "New Issue",
			intent: "Create something",
			alignment: {
				goal: "Goal",
				bigPicture: "Big picture",
				straightforward: [],
				nonObvious: [],
				confidence: "high",
				kind: "code",
				dependsOn: [],
			},
		};

		const results = [{ ok: true, stdout: "https://github.com/owner/repo/issues/42\n" }];

		const { process, calls } = makeMockProcess(results);
		const result = await writeIssue(payload, process);

		expect(result).toEqual({ issueNumber: 42, created: true });
		expect(calls[0]?.cmd).toEqual([
			"gh",
			"issue",
			"create",
			"--title",
			"New Issue",
			"--body",
			expect.any(String),
			"--label",
			"alignment:proposed,kind:code",
		]);
	});

	test("create path with repo passthrough", async () => {
		const payload: Payload = {
			title: "New Issue",
			intent: "Create something",
			alignment: {
				goal: "Goal",
				bigPicture: "Big picture",
				straightforward: [],
				nonObvious: [],
				confidence: "high",
				kind: "code",
				dependsOn: [],
			},
			repo: "owner/repo",
		};

		const results = [{ ok: true, stdout: "https://github.com/owner/repo/issues/42\n" }];

		const { process, calls } = makeMockProcess(results);
		await writeIssue(payload, process);

		expect(calls[0]?.cmd).toContain("--repo");
		expect(calls[0]?.cmd).toContain("owner/repo");
	});

	test("edit path with non-zero exit throws with issue number", async () => {
		const payload: Payload = {
			title: "Test",
			intent: "Test",
			alignment: {
				goal: "Goal",
				bigPicture: "Big picture",
				straightforward: [],
				nonObvious: [],
				confidence: "high",
				kind: "code",
				dependsOn: [],
			},
			issueNumber: 42,
		};

		const results = [{ ok: false, stdout: "network error" }];

		const { process } = makeMockProcess(results);

		await expect(writeIssue(payload, process)).rejects.toThrow("42");
	});

	test("URL parsing with trailing newline", async () => {
		const payload: Payload = {
			title: "Test",
			intent: "Test",
			alignment: {
				goal: "Goal",
				bigPicture: "Big picture",
				straightforward: [],
				nonObvious: [],
				confidence: "high",
				kind: "code",
				dependsOn: [],
			},
		};

		const results = [{ ok: true, stdout: "https://github.com/x/y/issues/12345\n" }];

		const { process } = makeMockProcess(results);
		const result = await writeIssue(payload, process);

		expect(result.issueNumber).toBe(12345);
	});

	test("round-trip with complex alignment fields", async () => {
		const payload: Payload = {
			title: "Complex Issue",
			intent: "Multi-line intent\nwith newlines",
			alignment: {
				goal: "Complex goal",
				bigPicture: "Complex big picture",
				straightforward: ["Detail 1", "Detail 2", "Detail 3"],
				nonObvious: ["Decision 1", "Decision 2"],
				confidence: "low",
				kind: "workflow",
				dependsOn: [5, 6],
			},
		};

		const results = [{ ok: true, stdout: "https://github.com/owner/repo/issues/99\n" }];

		const { process, calls } = makeMockProcess(results);
		await writeIssue(payload, process);

		const bodyArg = calls[0]?.cmd[6];
		if (typeof bodyArg !== "string") throw new Error("Expected body arg");

		const parsed = parseBody(bodyArg);
		expect(parsed.intent).toBe(payload.intent);
		expect(parsed.alignment?.goal).toBe(payload.alignment.goal);
		expect(parsed.alignment?.bigPicture).toBe(payload.alignment.bigPicture);
		expect(parsed.alignment?.straightforward).toEqual(payload.alignment.straightforward);
		expect(parsed.alignment?.nonObvious).toEqual(payload.alignment.nonObvious);
		expect(parsed.alignment?.confidence).toBe(payload.alignment.confidence);
		expect(parsed.alignment?.kind).toBe(payload.alignment.kind);
		expect(parsed.alignment?.dependsOn).toEqual(payload.alignment.dependsOn);
	});
});
