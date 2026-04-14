/**
 * Central hook dispatcher. Reads one event from stdin and routes it.
 * Enforcement lives in hooks/enforce.ts, observability in hooks/observe.ts,
 * post-edit verification in hooks/verify.ts.
 */

import { enforcePreToolUse } from "./hooks/enforce";
import { emitTrace } from "./hooks/observe";
import { isToolEvent, type HookEvent, type ToolEvent } from "./hooks/types";
import { verifyPostToolUse } from "./hooks/verify";

const input = await Bun.stdin.text();
const event = JSON.parse(input) as HookEvent;

function traceExtra(e: HookEvent): Record<string, unknown> {
	if (!isToolEvent(e)) return {};
	const filePath = (e.tool_input.file_path as string | undefined) ?? null;
	return { tool: e.tool_name, file: filePath };
}

emitTrace(event, traceExtra(event));

switch (event.hook_event_name) {
	case "PreToolUse":
		enforcePreToolUse(event as ToolEvent);
		break;
	case "PostToolUse":
		await verifyPostToolUse(event as ToolEvent);
		break;
}
