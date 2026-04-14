/**
 * Observability: append a structured event to .claude/traces/<session>.jsonl.
 * Must never throw — trace emission failures must not break the harness.
 */

import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { BaseEvent } from "./types";

export function emitTrace(event: BaseEvent, extra: Record<string, unknown>): void {
	try {
		const dir = join(event.cwd, ".claude", "traces");
		if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
		const line = JSON.stringify({
			ts: new Date().toISOString(),
			session_id: event.session_id,
			event: event.hook_event_name,
			agent_id: event.agent_id ?? null,
			...extra,
		});
		appendFileSync(join(dir, `${event.session_id}.jsonl`), `${line}\n`);
	} catch {
		// trace emission must never break the harness
	}
}
