/**
 * Canary: hook block allowlist.
 *
 * Asserts that `.claude/hooks/enforce.ts`'s block rules fire on a
 * deterministic synthetic input: an edit under `/specs/archive/` must exit 2
 * with a "immutable" rationale. We spawn the enforce.ts module via a Bun
 * subprocess with a crafted event-harness wrapper — no LLM, no network.
 *
 * Emits `CANARY_OK` on success and exits 0; exits 1 with a reason on failure.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const HARNESS_BODY = `
import { enforcePreToolUse } from "${process.cwd()}/.claude/hooks/enforce";

const event = {
	session_id: "canary",
	transcript_path: "",
	cwd: "/tmp/canary-repo",
	hook_event_name: "PreToolUse",
	tool_name: "Write",
	tool_input: { file_path: "/tmp/canary-repo/specs/archive/foo/bar.md" },
};

enforcePreToolUse(event);
process.exit(0);
`;

async function main(): Promise<void> {
	const tmp = mkdtempSync(join(tmpdir(), "canary-hook-"));
	try {
		const harnessPath = join(tmp, "harness.ts");
		writeFileSync(harnessPath, HARNESS_BODY);
		const proc = Bun.spawn(["bun", harnessPath], {
			stdout: "pipe",
			stderr: "pipe",
		});
		const stderr = await new Response(proc.stderr).text();
		const exitCode = await proc.exited;
		if (exitCode !== 2) {
			process.stderr.write(
				`expected enforce.ts to exit 2 (block), got ${exitCode}. stderr=${stderr}\n`,
			);
			process.exit(1);
		}
		if (!stderr.toLowerCase().includes("immutable")) {
			process.stderr.write(
				`enforce.ts exited 2 but rationale did not mention "immutable". stderr=${stderr}\n`,
			);
			process.exit(1);
		}
		process.stdout.write("CANARY_OK hook-block-allowlist\n");
		process.exit(0);
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}
}

await main();
