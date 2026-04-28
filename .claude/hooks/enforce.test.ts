import { afterEach, describe, expect, mock, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ToolEvent } from "./types";

function evt(file_path: string | undefined, cwd = "/tmp/repo"): ToolEvent {
	return {
		session_id: "s1",
		transcript_path: "",
		cwd,
		hook_event_name: "PreToolUse",
		tool_name: "Write",
		tool_input: file_path === undefined ? {} : { file_path },
	};
}

const DISPATCHER = join(import.meta.dir, "..", "hooks.ts");
const DISPATCHER_CWD = join(import.meta.dir, "..", "..");

async function runDispatcher(stdin: string): Promise<{ code: number; stderr: string }> {
	const proc = Bun.spawn(["bun", DISPATCHER], {
		stdin: "pipe",
		stdout: "pipe",
		stderr: "pipe",
		cwd: DISPATCHER_CWD,
	});
	proc.stdin.write(stdin);
	await proc.stdin.end();
	const code = await proc.exited;
	const stderr = await new Response(proc.stderr).text();
	return { code, stderr };
}

describe("enforcePreToolUse", () => {
	test("passes through when no file_path", async () => {
		mock.module("./spec-guard", () => ({ activeSpecTargetsFile: () => false }));
		const { enforcePreToolUse } = await import("./enforce");
		expect(() => enforcePreToolUse(evt(undefined))).not.toThrow();
	});

	test("blocks wrangler.toml edit when no active spec targets it", async () => {
		mock.module("./spec-guard", () => ({ activeSpecTargetsFile: () => false }));
		const { enforcePreToolUse } = await import("./enforce");
		const exitCodes: number[] = [];
		const spy = mock((code?: number) => {
			exitCodes.push(typeof code === "number" ? code : 0);
			throw new Error("process.exit");
		});
		const originalExit = process.exit;
		// @ts-expect-error mocking
		process.exit = spy;
		try {
			expect(() => enforcePreToolUse(evt("/repo/wrangler.toml"))).toThrow();
			expect(exitCodes).toContain(2);
		} finally {
			process.exit = originalExit;
		}
	});

	test("blocks any edit under specs/archive/", async () => {
		mock.module("./spec-guard", () => ({ activeSpecTargetsFile: () => true }));
		const { enforcePreToolUse } = await import("./enforce");
		const exitCodes: number[] = [];
		const spy = mock((code?: number) => {
			exitCodes.push(typeof code === "number" ? code : 0);
			throw new Error("process.exit");
		});
		const originalExit = process.exit;
		// @ts-expect-error mocking
		process.exit = spy;
		try {
			expect(() => enforcePreToolUse(evt("/repo/specs/archive/x/y.md"))).toThrow();
			expect(exitCodes).toContain(2);
		} finally {
			process.exit = originalExit;
		}
	});

	test("allows content/posts edit when active spec targets file", async () => {
		mock.module("./spec-guard", () => ({ activeSpecTargetsFile: () => true }));
		const { enforcePreToolUse } = await import("./enforce");
		expect(() => enforcePreToolUse(evt("/repo/content/posts/foo.mdx"))).not.toThrow();
	});

	test("fails closed (exit 2) when spec-guard throws an internal error", async () => {
		mock.module("./spec-guard", () => ({
			activeSpecTargetsFile: () => {
				throw new Error("induced internal error");
			},
		}));
		const { enforcePreToolUse } = await import("./enforce");
		const exitCodes: number[] = [];
		const spy = mock((code?: number) => {
			exitCodes.push(typeof code === "number" ? code : 0);
			throw new Error("process.exit");
		});
		const originalExit = process.exit;
		// @ts-expect-error mocking
		process.exit = spy;
		try {
			expect(() => enforcePreToolUse(evt("/repo/wrangler.toml"))).toThrow();
			expect(exitCodes).toContain(2);
			expect(exitCodes).not.toContain(1);
		} finally {
			process.exit = originalExit;
		}
	});
});

describe(".claude/hooks.ts dispatcher (fail-closed)", () => {
	test("malformed JSON on stdin -> exit 2 (not 1)", async () => {
		const { code } = await runDispatcher("this is not json {");
		expect(code).toBe(2);
	});

	test("PreToolUse event for wrangler.toml without active spec -> exit 2", async () => {
		const event = {
			session_id: "test-session-blocked",
			transcript_path: "",
			cwd: DISPATCHER_CWD,
			hook_event_name: "PreToolUse",
			tool_name: "Write",
			tool_input: { file_path: "/some/path/wrangler.toml" },
		};
		const { code } = await runDispatcher(JSON.stringify(event));
		expect(code).toBe(2);
	});

	test("PreToolUse event with allowed file_path -> exit 0", async () => {
		const event = {
			session_id: "test-session-allowed",
			transcript_path: "",
			cwd: DISPATCHER_CWD,
			hook_event_name: "PreToolUse",
			tool_name: "Write",
			tool_input: { file_path: "/tmp/unrelated.txt" },
		};
		const { code } = await runDispatcher(JSON.stringify(event));
		expect(code).toBe(0);
	});

	test("dispatcher never exits 1 on any input", async () => {
		const inputs = [
			"{",
			"null",
			"[]",
			'{"hook_event_name": "UnknownEvent"}',
			'{"hook_event_name": "PreToolUse"}',
		];
		for (const input of inputs) {
			const { code } = await runDispatcher(input);
			expect(code).not.toBe(1);
		}
	});
});

describe("emitBlocked — spec 028", () => {
	let tmpRoot: string;

	afterEach(() => {
		if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true });
	});

	function makeEvent(sessionId: string, cwd: string): ToolEvent {
		return {
			session_id: sessionId,
			transcript_path: "",
			cwd,
			hook_event_name: "PreToolUse",
			tool_name: "Write",
			tool_input: { file_path: join(cwd, "wrangler.toml") },
		};
	}

	test("appends a ToolBlocked line with status:blocked to .claude/traces/<session>.jsonl", async () => {
		tmpRoot = mkdtempSync(join(tmpdir(), "emit-blocked-"));
		const tracesDir = join(tmpRoot, ".claude", "traces");
		mkdirSync(tracesDir, { recursive: true });
		const sessionId = "sess-028-emit";
		const event = makeEvent(sessionId, tmpRoot);
		const { emitBlocked } = await import("./observe");
		emitBlocked(event, "wrangler.toml is a protected file.", "Write", "wrangler.toml");
		const { readFileSync: rfs } = await import("node:fs");
		const lines = rfs(join(tracesDir, `${sessionId}.jsonl`), "utf-8")
			.split("\n")
			.filter(Boolean)
			.map((l: string) => JSON.parse(l));
		const blocked = lines.find((l: Record<string, unknown>) => l.event === "ToolBlocked");
		expect(blocked).toBeDefined();
		expect(blocked?.status).toBe("blocked");
		expect(blocked?.reason).toBe("wrangler.toml is a protected file.");
		expect(blocked?.file).toBe("wrangler.toml");
	});

	test("never throws when given malformed/missing input", async () => {
		tmpRoot = mkdtempSync(join(tmpdir(), "emit-blocked-nothrow-"));
		const { emitBlocked } = await import("./observe");
		// null cwd should not throw
		const badEvent = {
			session_id: "",
			transcript_path: "",
			cwd: "/nonexistent-\x00-path",
			hook_event_name: "PreToolUse",
			tool_name: "Write",
			tool_input: {},
		} as ToolEvent;
		expect(() => emitBlocked(badEvent, "", "", "")).not.toThrow();
		// completely missing fields
		expect(() =>
			emitBlocked(
				null as unknown as ToolEvent,
				null as unknown as string,
				null as unknown as string,
				null as unknown as string,
			),
		).not.toThrow();
	});

	test("observe.ts is the single writer — enforce.ts does not import fs write functions directly", async () => {
		// Read enforce.ts source and assert it does not call appendFileSync or writeFileSync
		const { readFileSync: rfs } = await import("node:fs");
		const enforceSrc = rfs(join(import.meta.dir, "enforce.ts"), "utf-8");
		expect(enforceSrc).not.toMatch(/appendFileSync/);
		expect(enforceSrc).not.toMatch(/writeFileSync/);
		expect(enforceSrc).not.toMatch(/openSync/);
		expect(enforceSrc).not.toMatch(/createWriteStream/);
	});
});

describe("block() emit-before-throw — spec 028", () => {
	let tmpRoot: string;

	afterEach(() => {
		if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true });
	});

	test("block() calls emitBlocked before throwing BlockError", async () => {
		tmpRoot = mkdtempSync(join(tmpdir(), "block-emit-"));
		const tracesDir = join(tmpRoot, ".claude", "traces");
		mkdirSync(tracesDir, { recursive: true });
		const sessionId = "sess-028-block";
		const event: ToolEvent = {
			session_id: sessionId,
			transcript_path: "",
			cwd: tmpRoot,
			hook_event_name: "PreToolUse",
			tool_name: "Write",
			tool_input: { file_path: join(tmpRoot, "wrangler.toml") },
		};
		const { block } = await import("./types");
		// block() must throw (BlockError or process.exit) after emitting
		try {
			block(event, "wrangler.toml is a protected file.", "wrangler.toml");
		} catch {
			// expected — either BlockError or process.exit stub
		}
		// The .jsonl must have a ToolBlocked line even though block() threw/exited
		const { readFileSync: rfs, existsSync: efs } = await import("node:fs");
		const jsonlPath = join(tracesDir, `${sessionId}.jsonl`);
		expect(efs(jsonlPath)).toBe(true);
		const lines = rfs(jsonlPath, "utf-8")
			.split("\n")
			.filter(Boolean)
			.map((l: string) => JSON.parse(l));
		expect(
			lines.some(
				(l: Record<string, unknown>) => l.event === "ToolBlocked" && l.status === "blocked",
			),
		).toBe(true);
	});
});

describe("enforce.ts call-site integration — spec 028", () => {
	let tmpRoot: string;

	afterEach(() => {
		if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true });
	});

	async function runDispatcherInDir(
		stdin: string,
		cwd: string,
	): Promise<{ code: number; jsonlLines: Record<string, unknown>[] }> {
		const { existsSync: efs, readdirSync: rdirs, readFileSync: rfs } = await import("node:fs");
		const dispatcherPath = join(import.meta.dir, "..", "hooks.ts");
		const proc = Bun.spawn(["bun", dispatcherPath], {
			stdin: "pipe",
			stdout: "pipe",
			stderr: "pipe",
			cwd,
		});
		proc.stdin.write(stdin);
		await proc.stdin.end();
		const code = await proc.exited;
		const tracesDir = join(cwd, ".claude", "traces");
		let jsonlLines: Record<string, unknown>[] = [];
		if (efs(tracesDir)) {
			for (const fname of rdirs(tracesDir)) {
				if (!fname.endsWith(".jsonl")) continue;
				const content = rfs(join(tracesDir, fname), "utf-8");
				jsonlLines = jsonlLines.concat(
					content
						.split("\n")
						.filter(Boolean)
						.map((l: string) => JSON.parse(l)),
				);
			}
		}
		return { code, jsonlLines };
	}

	test("a blocked PreToolUse emits a ToolBlocked line whose reason and file match the rule that fired", async () => {
		tmpRoot = mkdtempSync(join(tmpdir(), "enforce-integration-"));
		// No active spec => wrangler.toml block fires
		const { mkdirSync: mds } = await import("node:fs");
		mds(join(tmpRoot, ".git"), { recursive: true });
		const event = {
			session_id: "sess-028-integration",
			transcript_path: "",
			cwd: tmpRoot,
			hook_event_name: "PreToolUse",
			tool_name: "Write",
			tool_input: { file_path: join(tmpRoot, "wrangler.toml") },
		};
		const { code, jsonlLines } = await runDispatcherInDir(JSON.stringify(event), tmpRoot);
		expect(code).toBe(2);
		const blocked = jsonlLines.find((l) => l.event === "ToolBlocked");
		expect(blocked).toBeDefined();
		expect(typeof blocked?.reason).toBe("string");
		expect((blocked?.reason as string).length).toBeGreaterThan(0);
		expect(typeof blocked?.file).toBe("string");
	});
});

describe("findSliceForPath (spec 039 slice-RED gate-freeze)", () => {
	let tmpRoot: string;

	afterEach(() => {
		if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true });
	});

	function seedSpec(args: {
		slug: string;
		taskGates: Array<{ gate: string }>;
		frozenOrdinals: number[];
	}): void {
		const specDir = join(tmpRoot, "specs", "active", args.slug);
		mkdirSync(specDir, { recursive: true });
		const proposal = [
			"---",
			`id: ${args.slug}`,
			"title: test",
			"status: active",
			"kind: code",
			`gate: ${args.taskGates[0]?.gate ?? "scripts/gate.ts"}`,
			"created: 2026-04-20",
			"owner: main",
			"depends_on: []",
			"supersedes: null",
			"---",
			"",
			"## Intent",
			"test fixture",
			"",
		].join("\n");
		writeFileSync(join(specDir, "proposal.md"), proposal);
		const taskLines = args.taskGates
			.map((tg, i) =>
				[
					`- [ ] ${i + 1}. Task ${i + 1}`,
					`  - gate: ${tg.gate}`,
					`  - file_targets: [src/impl${i + 1}.ts]`,
					`  - boundary: [src/impl${i + 1}.ts]`,
				].join("\n"),
			)
			.join("\n");
		writeFileSync(join(specDir, "tasks.md"), `# Tasks\n\n${taskLines}\n`);
		for (const ordinal of args.frozenOrdinals) {
			writeFileSync(join(specDir, `.gate-frozen-${ordinal}`), "");
		}
	}

	function seedRepo(): void {
		tmpRoot = mkdtempSync(join(tmpdir(), "slice-freeze-"));
		mkdirSync(join(tmpRoot, ".git"), { recursive: true });
	}

	test("blocks when .gate-frozen-N exists and path matches task N gate", async () => {
		seedRepo();
		seedSpec({
			slug: "039-fixture",
			taskGates: [{ gate: "scripts/my-gate.ts" }],
			frozenOrdinals: [1],
		});
		const { findSliceForPath } = await import("./enforce");
		const target = join(tmpRoot, "scripts", "my-gate.ts");
		const hit = findSliceForPath(tmpRoot, target);
		expect(hit).not.toBeNull();
		expect(hit?.slug).toBe("039-fixture");
		expect(hit?.gatePath).toBe("scripts/my-gate.ts");
		expect(hit?.ordinal).toBe(1);
	});

	test("allows when .gate-frozen-N exists but path does not match any task gate", async () => {
		seedRepo();
		seedSpec({
			slug: "039-fixture",
			taskGates: [{ gate: "scripts/my-gate.ts" }],
			frozenOrdinals: [1],
		});
		const { findSliceForPath } = await import("./enforce");
		const target = join(tmpRoot, "src", "unrelated.ts");
		expect(findSliceForPath(tmpRoot, target)).toBeNull();
	});

	test("allows when path matches task gate but .gate-frozen-N is absent", async () => {
		seedRepo();
		seedSpec({
			slug: "039-fixture",
			taskGates: [{ gate: "scripts/my-gate.ts" }],
			frozenOrdinals: [],
		});
		const { findSliceForPath } = await import("./enforce");
		const target = join(tmpRoot, "scripts", "my-gate.ts");
		expect(findSliceForPath(tmpRoot, target)).toBeNull();
	});

	test("allows when bare .gate-frozen exists (inert after migration)", async () => {
		seedRepo();
		seedSpec({
			slug: "039-fixture",
			taskGates: [{ gate: "scripts/my-gate.ts" }],
			frozenOrdinals: [],
		});
		// Write bare .gate-frozen (should be inert)
		const specDir = join(tmpRoot, "specs", "active", "039-fixture");
		writeFileSync(join(specDir, ".gate-frozen"), "");
		const { findSliceForPath } = await import("./enforce");
		const target = join(tmpRoot, "scripts", "my-gate.ts");
		expect(findSliceForPath(tmpRoot, target)).toBeNull();
	});

	test("returns null when no active specs directory exists", async () => {
		tmpRoot = mkdtempSync(join(tmpdir(), "slice-freeze-"));
		mkdirSync(join(tmpRoot, ".git"), { recursive: true });
		const { findSliceForPath } = await import("./enforce");
		const target = join(tmpRoot, "scripts", "my-gate.ts");
		expect(findSliceForPath(tmpRoot, target)).toBeNull();
	});
});
