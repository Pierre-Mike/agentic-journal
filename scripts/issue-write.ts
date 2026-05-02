/**
 * Write or update GitHub issues with structured alignment bodies.
 *
 * Reads a JSON payload from stdin, constructs a ParsedBody with alignment fields,
 * and either creates a new issue or updates an existing one.
 *
 * Usage:
 *   echo '{"title": "...", "intent": "...", "alignment": {...}}' | bun scripts/issue-write.ts
 */

import type { Process } from "./_lib.ts";
import { realProcess } from "./_lib.ts";
import { type Alignment, addLabel, type ParsedBody, renderBody, setLifecycle } from "./issue.ts";

export interface Payload {
	readonly title: string;
	readonly intent: string;
	readonly alignment: Alignment;
	readonly issueNumber?: number;
	readonly repo?: string;
}

export async function writeIssue(
	payload: Payload,
	p: Process,
): Promise<{ issueNumber: number; created: boolean }> {
	const parsed: ParsedBody = {
		intent: payload.intent,
		alignment: payload.alignment,
		approved: false,
	};
	const body = renderBody(parsed);

	if (payload.issueNumber !== undefined) {
		// Edit path
		const n = payload.issueNumber;
		const cmd = ["gh", "issue", "edit", String(n), "--body", body];
		if (payload.repo) {
			cmd.push("--repo", payload.repo);
		}

		const result = await p.run(cmd);
		if (!result.ok) {
			throw new Error(`failed to update issue #${n}: ${result.stdout}`);
		}

		await setLifecycle(n, "alignment:proposed", p, { repo: payload.repo });
		await addLabel(n, `kind:${payload.alignment.kind}`, p, {
			repo: payload.repo,
		});

		return { issueNumber: n, created: false };
	}

	// Create path
	const cmd = [
		"gh",
		"issue",
		"create",
		"--title",
		payload.title,
		"--body",
		body,
		"--label",
		`alignment:proposed,kind:${payload.alignment.kind}`,
	];
	if (payload.repo) {
		cmd.push("--repo", payload.repo);
	}

	const result = await p.run(cmd);
	if (!result.ok) {
		throw new Error(`failed to create issue: ${result.stdout}`);
	}

	const match = result.stdout.match(/\/issues\/(\d+)/);
	if (!match?.[1]) {
		throw new Error(`failed to extract issue number from: ${result.stdout}`);
	}

	const issueNumber = Number.parseInt(match[1], 10);
	return { issueNumber, created: true };
}

if (import.meta.main) {
	try {
		const payload: Payload = await Bun.stdin.json();
		const { issueNumber } = await writeIssue(payload, realProcess);
		// biome-ignore lint/suspicious/noConsole: CLI entrypoint
		console.log(issueNumber);
	} catch (err) {
		// biome-ignore lint/suspicious/noConsole: CLI entrypoint
		console.error(err instanceof Error ? err.message : String(err));
		process.exit(1);
	}
}
