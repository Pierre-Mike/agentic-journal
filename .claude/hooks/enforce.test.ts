import { describe, expect, mock, test } from "bun:test";
import type { ToolEvent } from "./types";

// Tests mock filesystem reads via the spec-guard module.
// Keep tests deterministic by constructing synthetic events.

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

describe("enforcePreToolUse", () => {
	test("passes through when no file_path", async () => {
		mock.module("./spec-guard", () => ({ activeSpecTargetsFile: () => false }));
		const { enforcePreToolUse } = await import("./enforce");
		expect(() => enforcePreToolUse(evt(undefined))).not.toThrow();
	});

	test("blocks wrangler.toml edit when no active spec targets it", async () => {
		mock.module("./spec-guard", () => ({ activeSpecTargetsFile: () => false }));
		const { enforcePreToolUse } = await import("./enforce");
		const spy = mock(() => {
			throw new Error("process.exit");
		});
		const originalExit = process.exit;
		// @ts-expect-error mocking
		process.exit = spy;
		try {
			expect(() => enforcePreToolUse(evt("/repo/wrangler.toml"))).toThrow();
		} finally {
			process.exit = originalExit;
		}
	});

	test("blocks any edit under specs/archive/", async () => {
		mock.module("./spec-guard", () => ({ activeSpecTargetsFile: () => true }));
		const { enforcePreToolUse } = await import("./enforce");
		const originalExit = process.exit;
		const spy = mock(() => {
			throw new Error("process.exit");
		});
		// @ts-expect-error mocking
		process.exit = spy;
		try {
			expect(() => enforcePreToolUse(evt("/repo/specs/archive/x/y.md"))).toThrow();
		} finally {
			process.exit = originalExit;
		}
	});

	test("allows content/posts edit when active spec targets file", async () => {
		mock.module("./spec-guard", () => ({ activeSpecTargetsFile: () => true }));
		const { enforcePreToolUse } = await import("./enforce");
		expect(() => enforcePreToolUse(evt("/repo/content/posts/foo.mdx"))).not.toThrow();
	});
});
