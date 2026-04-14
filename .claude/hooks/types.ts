/**
 * Hook event types. Mirror the Claude Code event payloads that arrive on stdin.
 */

export interface BaseEvent {
	session_id: string;
	transcript_path: string;
	cwd: string;
	hook_event_name: string;
	permission_mode?: string;
	agent_id?: string;
}

export interface ToolEvent extends BaseEvent {
	hook_event_name: "PreToolUse" | "PostToolUse";
	tool_name: string;
	tool_input: Record<string, unknown>;
	tool_response?: Record<string, unknown>;
}

export type HookEvent = ToolEvent | BaseEvent;

export function isToolEvent(event: HookEvent): event is ToolEvent {
	return event.hook_event_name === "PreToolUse" || event.hook_event_name === "PostToolUse";
}

export function block(reason: string): never {
	console.error(reason);
	process.exit(2);
}

export async function run(cmd: string[]): Promise<boolean> {
	const proc = Bun.spawn(cmd, { stdout: "ignore", stderr: "ignore" });
	return (await proc.exited) === 0;
}
