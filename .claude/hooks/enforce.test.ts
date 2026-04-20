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

describe("findFrozenGateForPath (spec 027 gate-freeze)", () => {
	let tmpRoot: string;

	afterEach(() => {
		if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true });
	});

	function seedSpec(args: { slug: string; gate: string; frozen: boolean }): void {
		const specDir = join(tmpRoot, "specs", "active", args.slug);
		mkdirSync(specDir, { recursive: true });
		const proposal = [
			"---",
			`id: ${args.slug}`,
			"title: test",
			"status: active",
			"kind: code",
			`gate: ${args.gate}`,
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
		if (args.frozen) writeFileSync(join(specDir, ".gate-frozen"), "");
	}

	function seedRepo(): void {
		tmpRoot = mkdtempSync(join(tmpdir(), "gate-freeze-"));
		mkdirSync(join(tmpRoot, ".git"), { recursive: true });
	}

	test("blocks when frozen sentinel exists and path matches gate", async () => {
		seedRepo();
		seedSpec({ slug: "027-fixture", gate: "scripts/my-gate.ts", frozen: true });
		const { findFrozenGateForPath } = await import("./enforce");
		const target = join(tmpRoot, "scripts", "my-gate.ts");
		const hit = findFrozenGateForPath(tmpRoot, target);
		expect(hit).not.toBeNull();
		expect(hit?.slug).toBe("027-fixture");
		expect(hit?.gatePath).toBe("scripts/my-gate.ts");
	});

	test("allows when frozen sentinel exists but path does not match gate", async () => {
		seedRepo();
		seedSpec({ slug: "027-fixture", gate: "scripts/my-gate.ts", frozen: true });
		const { findFrozenGateForPath } = await import("./enforce");
		const target = join(tmpRoot, "src", "unrelated.ts");
		expect(findFrozenGateForPath(tmpRoot, target)).toBeNull();
	});

	test("allows when path matches gate but frozen sentinel is absent", async () => {
		seedRepo();
		seedSpec({ slug: "027-fixture", gate: "scripts/my-gate.ts", frozen: false });
		const { findFrozenGateForPath } = await import("./enforce");
		const target = join(tmpRoot, "scripts", "my-gate.ts");
		expect(findFrozenGateForPath(tmpRoot, target)).toBeNull();
	});

	test("returns null when no active specs directory exists", async () => {
		tmpRoot = mkdtempSync(join(tmpdir(), "gate-freeze-"));
		mkdirSync(join(tmpRoot, ".git"), { recursive: true });
		const { findFrozenGateForPath } = await import("./enforce");
		const target = join(tmpRoot, "scripts", "my-gate.ts");
		expect(findFrozenGateForPath(tmpRoot, target)).toBeNull();
	});
});
