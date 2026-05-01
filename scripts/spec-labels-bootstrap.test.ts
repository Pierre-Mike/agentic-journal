/**
 * Unit tests for scripts/spec-labels-bootstrap.ts
 */

import { describe, expect, test } from "bun:test";
import type { Process } from "./_lib.ts";
import { bootstrap, LABELS } from "./spec-labels-bootstrap.ts";

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

describe("bootstrap", () => {
	test("applies every label when process returns ok for every call", async () => {
		const allOk = LABELS.map(() => ({ ok: true, stdout: "" }));
		const { process, calls } = makeMockProcess(allOk);

		const result = await bootstrap(process);

		expect(result.applied).toHaveLength(LABELS.length);
		expect(calls).toHaveLength(LABELS.length);
		for (const label of LABELS) {
			expect(result.applied).toContain(label.name);
		}
	});

	test("applied list preserves LABELS array order", async () => {
		const allOk = LABELS.map(() => ({ ok: true, stdout: "" }));
		const { process, calls } = makeMockProcess(allOk);

		const result = await bootstrap(process);

		for (let i = 0; i < LABELS.length; i++) {
			expect(calls[i]?.cmd[3]).toBe(LABELS[i]?.name);
		}
		expect(result.applied).toEqual(LABELS.map((l) => l.name));
	});

	test("non-zero exit → throws with label name in message", async () => {
		const failingLabel = LABELS[2];
		if (!failingLabel) throw new Error("test fixture: LABELS must have at least 3 entries");
		const results = LABELS.map((_, idx) =>
			idx === 2 ? { ok: false, stdout: "network timeout" } : { ok: true, stdout: "" },
		);
		const { process } = makeMockProcess(results);

		await expect(bootstrap(process)).rejects.toThrow(failingLabel.name);
	});

	test("command shape for first label includes --force", async () => {
		const allOk = LABELS.map(() => ({ ok: true, stdout: "" }));
		const { process, calls } = makeMockProcess(allOk);

		await bootstrap(process);

		expect(calls[0]?.cmd).toEqual([
			"gh",
			"label",
			"create",
			"intent:captured",
			"--color",
			"cccccc",
			"--description",
			"User intent recorded; awaiting alignment",
			"--force",
		]);
	});

	test("repo option appends --repo flag", async () => {
		const allOk = LABELS.map(() => ({ ok: true, stdout: "" }));
		const { process, calls } = makeMockProcess(allOk);

		await bootstrap(process, { repo: "owner/repo" });

		expect(calls[0]?.cmd).toContain("--repo");
		expect(calls[0]?.cmd).toContain("owner/repo");
	});
});
