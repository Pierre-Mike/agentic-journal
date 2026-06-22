import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, readdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { RunRecord } from "./traces-fetch.ts";
// RED: traces-fetch.ts does not exist yet — all imports below will throw
// until the spec-implementer creates the file.
import { filterRuns, parseSince } from "./traces-fetch.ts";

const WITHIN: RunRecord = {
	databaseId: 111,
	createdAt: "2026-04-29T12:00:00Z",
	conclusion: "success",
};
const OUTSIDE: RunRecord = {
	databaseId: 222,
	createdAt: "2026-04-20T12:00:00Z",
	conclusion: "success",
};
const IN_PROGRESS: RunRecord = {
	databaseId: 333,
	createdAt: "2026-04-29T12:00:00Z",
	conclusion: null,
};

describe("filterRuns", () => {
	test("includes runs within the since window that have a conclusion", () => {
		const windowStart = new Date("2026-04-28T00:00:00Z");
		const result = filterRuns([WITHIN, OUTSIDE, IN_PROGRESS], windowStart);
		expect(result.map((r) => r.databaseId)).toEqual([111]);
	});

	test("excludes runs outside the window even if concluded", () => {
		const windowStart = new Date("2026-04-25T00:00:00Z");
		const result = filterRuns([OUTSIDE], windowStart);
		expect(result).toHaveLength(0);
	});

	test("excludes in-progress runs (conclusion === null)", () => {
		const windowStart = new Date("2026-04-01T00:00:00Z");
		const result = filterRuns([IN_PROGRESS], windowStart);
		expect(result).toHaveLength(0);
	});
});

describe("parseSince", () => {
	const REF = new Date("2026-04-30T00:00:00Z");

	test("parses Nd duration as N days before reference date", () => {
		const result = parseSince("7d", REF);
		expect(result.toISOString()).toBe("2026-04-23T00:00:00.000Z");
	});

	test("parses ISO date string directly", () => {
		const result = parseSince("2026-04-25T00:00:00Z", REF);
		expect(result.toISOString()).toBe("2026-04-25T00:00:00.000Z");
	});
});

describe("traces-fetch script CLI (subprocess integration)", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = join(tmpdir(), `traces-fetch-test-${Date.now()}`);
		mkdirSync(tmpDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	test("exits 0 when gh run list returns empty results", async () => {
		// Provide a stub gh that returns [] for run list and exits 0 on download
		const stubGh = join(tmpDir, "gh");
		await Bun.write(
			stubGh,
			`#!/bin/sh
case "$*" in
  *"run list"*) echo '[]' ;;
  *) exit 0 ;;
esac
`,
		);
		const proc = Bun.spawnSync(["chmod", "+x", stubGh]);
		expect(proc.exitCode).toBe(0);

		const result = Bun.spawnSync(
			["bun", join(import.meta.dir, "traces-fetch.ts"), "--since", "1d"],
			{ env: { ...process.env, PATH: `${tmpDir}:${process.env.PATH ?? ""}` } },
		);
		expect(result.exitCode).toBe(0);
	});

	test("exits 0 even when gh run download fails (best-effort)", async () => {
		// Stub gh: list returns 1 run; download exits non-zero
		const stubGh = join(tmpDir, "gh");
		await Bun.write(
			stubGh,
			`#!/bin/sh
case "$*" in
  *"run list"*) echo '[{"databaseId":42,"createdAt":"2026-04-29T12:00:00Z","conclusion":"success"}]' ;;
  *"run download"*) exit 1 ;;
  *) exit 0 ;;
esac
`,
		);
		Bun.spawnSync(["chmod", "+x", stubGh]);

		const result = Bun.spawnSync(
			["bun", join(import.meta.dir, "traces-fetch.ts"), "--since", "7d"],
			{ env: { ...process.env, PATH: `${tmpDir}:${process.env.PATH ?? ""}` } },
		);
		expect(result.exitCode).toBe(0);
	});

	test("downloads artifact into .claude/traces-mirror/<run_id>/ when gh succeeds", async () => {
		const mirrorRoot = join(tmpDir, ".claude", "traces-mirror");
		// Stub gh: list returns 1 run; download creates the expected directory
		const stubGh = join(tmpDir, "gh");
		await Bun.write(
			stubGh,
			`#!/bin/sh
case "$*" in
  *"run list"*) echo '[{"databaseId":99,"createdAt":"2026-04-29T12:00:00Z","conclusion":"success"}]' ;;
  *"run download"*)
    # Extract --dir argument and create a sentinel file
    DIR=""
    while [ $# -gt 0 ]; do
      if [ "$1" = "--dir" ]; then DIR="$2"; fi
      shift
    done
    mkdir -p "$DIR"
    touch "$DIR/sentinel.jsonl"
    exit 0
    ;;
  *) exit 0 ;;
esac
`,
		);
		Bun.spawnSync(["chmod", "+x", stubGh]);

		Bun.spawnSync(["bun", join(import.meta.dir, "traces-fetch.ts"), "--since", "7d"], {
			env: {
				...process.env,
				PATH: `${tmpDir}:${process.env.PATH ?? ""}`,
				TRACES_MIRROR_ROOT: mirrorRoot,
			},
		});

		// Sentinel file should exist at traces-mirror/99/sentinel.jsonl
		const entries = readdirSync(mirrorRoot).sort();
		expect(entries).toContain("99");
	});
});
