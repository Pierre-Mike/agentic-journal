/**
 * Issue-as-spec body parser.
 *
 * Pure functions — no `gh` API, no filesystem. Round-trips a canonical
 * issue body shape so we can move proposal.md / alignment.md content
 * into a GitHub issue while keeping it programmatically readable.
 *
 * Canonical body layout (see .github/ISSUE_TEMPLATE/spec.md):
 *
 *   ## Intent
 *   <free-form paragraph(s)>
 *
 *   ## Alignment
 *   **Goal**: <one line>
 *   **Big picture**: <one line>
 *   **Straightforward details**:
 *   - bullet
 *   **Non-obvious decisions**:
 *   - bullet
 *   **Confidence**: high | low
 *   **Kind**: code | rule | workflow | writeup
 *   **Depends on**: #123, #456    (omitted if none)
 *
 *   ## Approval
 *   - [ ] approved
 *
 *   ## Timeline
 *   <subagent comments — not parsed>
 */

import type { Process } from "./_lib.ts";

export type SpecKind = "code" | "rule" | "workflow" | "writeup";
export type Confidence = "high" | "low";

export type Lifecycle =
	| "intent:captured"
	| "alignment:proposed"
	| "alignment:approved"
	| "ready:dispatch"
	| "done";

export const LIFECYCLE_LABELS: readonly Lifecycle[] = [
	"intent:captured",
	"alignment:proposed",
	"alignment:approved",
	"ready:dispatch",
	"done",
];

export interface IssueSpec {
	readonly number: number;
	readonly title: string;
	readonly body: string; // raw body
	readonly parsed: ParsedBody; // result of parseBody(body)
	readonly labels: readonly string[];
	readonly lifecycle: Lifecycle | null; // first LIFECYCLE_LABELS member found in labels, else null
}

export interface Alignment {
	readonly goal: string;
	readonly bigPicture: string;
	readonly straightforward: readonly string[];
	readonly nonObvious: readonly string[];
	readonly confidence: Confidence;
	readonly kind: SpecKind;
	readonly dependsOn: readonly number[];
}

export interface ParsedBody {
	readonly intent: string;
	readonly alignment: Alignment | null;
	readonly approved: boolean;
}

const VALID_KINDS: readonly SpecKind[] = ["code", "rule", "workflow", "writeup"];

/**
 * Split a body into top-level `## ` sections. Returns a map of
 * heading-text → section-body (without the heading line).
 *
 * Heading match is anchored to start-of-line and requires exactly two `#`.
 * `### Sub` headings are kept inside their parent section's body.
 */
function splitSections(body: string): Map<string, string> {
	const out = new Map<string, string>();
	const lines = body.split("\n");
	let current: string | null = null;
	let buf: string[] = [];

	const flush = () => {
		if (current !== null) out.set(current, buf.join("\n").trim());
	};

	for (const line of lines) {
		const m = line.match(/^##\s+(.+?)\s*$/);
		if (m && !line.startsWith("###")) {
			flush();
			current = m[1]?.trim() ?? "";
			buf = [];
		} else if (current !== null) {
			buf.push(line);
		}
	}
	flush();
	return out;
}

/** Strip HTML comments (`<!-- ... -->`, multi-line) from a string. */
function stripComments(s: string): string {
	return s.replace(/<!--[\s\S]*?-->/g, "").trim();
}

/**
 * Parse `**Label**: value` lines and `**Label**:` followed by a bullet block.
 * Returns a map keyed by lowercase label.
 */
interface AlignmentFields {
	readonly singles: ReadonlyMap<string, string>;
	readonly lists: ReadonlyMap<string, readonly string[]>;
}

function parseAlignmentFields(section: string): AlignmentFields {
	const singles = new Map<string, string>();
	const lists = new Map<string, string[]>();
	const lines = section.split("\n");

	let listLabel: string | null = null;

	for (const line of lines) {
		const labelMatch = line.match(/^\*\*([^*]+)\*\*:\s*(.*)$/);
		if (labelMatch) {
			const label = (labelMatch[1] ?? "").trim().toLowerCase();
			const value = (labelMatch[2] ?? "").trim();
			if (value === "") {
				listLabel = label;
				lists.set(label, []);
			} else {
				singles.set(label, value);
				listLabel = null;
			}
			continue;
		}
		if (listLabel !== null) {
			const bullet = line.match(/^\s*-\s+(.+)$/);
			if (bullet) {
				lists.get(listLabel)?.push((bullet[1] ?? "").trim());
				continue;
			}
			// Blank line ends a bullet block; non-bullet text ends it too.
			if (line.trim() === "") continue;
			listLabel = null;
		}
	}

	return { singles, lists };
}

function parseDependsOn(raw: string): readonly number[] {
	if (!raw || raw.toLowerCase() === "none") return [];
	const out: number[] = [];
	for (const m of raw.matchAll(/#(\d+)/g)) {
		const n = Number.parseInt(m[1] ?? "", 10);
		if (Number.isFinite(n)) out.push(n);
	}
	return out;
}

function parseAlignment(section: string): Alignment | null {
	const cleaned = stripComments(section);
	if (cleaned === "") return null;

	const { singles, lists } = parseAlignmentFields(cleaned);

	const goal = singles.get("goal") ?? "";
	const bigPicture = singles.get("big picture") ?? "";
	const confidenceRaw = singles.get("confidence") ?? "";
	const kindRaw = singles.get("kind") ?? "";

	// Required fields must all be present and non-empty.
	if (goal === "" || bigPicture === "" || confidenceRaw === "" || kindRaw === "") {
		return null;
	}

	const confidence: Confidence = confidenceRaw.toLowerCase() === "low" ? "low" : "high";
	const kind = (VALID_KINDS as readonly string[]).includes(kindRaw.toLowerCase())
		? (kindRaw.toLowerCase() as SpecKind)
		: null;
	if (kind === null) return null;

	return {
		goal,
		bigPicture,
		straightforward: lists.get("straightforward details") ?? [],
		nonObvious: lists.get("non-obvious decisions") ?? [],
		confidence,
		kind,
		dependsOn: parseDependsOn(singles.get("depends on") ?? ""),
	};
}

function parseApproval(section: string): boolean {
	return /^\s*-\s*\[[xX]\]\s+approved\b/m.test(section);
}

/** Parse a canonical issue body into structured fields. */
export function parseBody(body: string): ParsedBody {
	const sections = splitSections(body);
	const intent = stripComments(sections.get("Intent") ?? "");
	const alignment = parseAlignment(sections.get("Alignment") ?? "");
	const approved = parseApproval(sections.get("Approval") ?? "");
	return { intent, alignment, approved };
}

/** Render structured fields back to canonical issue body markdown. */
export function renderBody(parsed: ParsedBody): string {
	const out: string[] = [];

	out.push("## Intent", "", parsed.intent || "", "");

	out.push("## Alignment", "");
	if (parsed.alignment) {
		const a = parsed.alignment;
		out.push(`**Goal**: ${a.goal}`);
		out.push(`**Big picture**: ${a.bigPicture}`);
		out.push("**Straightforward details**:");
		for (const item of a.straightforward) out.push(`- ${item}`);
		out.push("**Non-obvious decisions**:");
		for (const item of a.nonObvious) out.push(`- ${item}`);
		out.push(`**Confidence**: ${a.confidence}`);
		out.push(`**Kind**: ${a.kind}`);
		if (a.dependsOn.length > 0) {
			out.push(`**Depends on**: ${a.dependsOn.map((n) => `#${n}`).join(", ")}`);
		}
		out.push("");
	}

	out.push("## Approval", "");
	out.push(parsed.approved ? "- [x] approved" : "- [ ] approved");
	out.push("");

	out.push("## Timeline", "");

	return `${out
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trimEnd()}\n`;
}

// gh-backed API
// ---------------------------------------------------------------------------

function deriveLifecycle(labels: readonly string[]): Lifecycle | null {
	for (const lc of LIFECYCLE_LABELS) {
		if (labels.includes(lc)) return lc;
	}
	return null;
}

function buildIssueSpec(raw: {
	number: number;
	title: string;
	body: string;
	labels: Array<{ name: string }>;
}): IssueSpec {
	const body = raw.body ?? "";
	const labels = raw.labels.map((l) => l.name);
	return {
		number: raw.number,
		title: raw.title,
		body,
		parsed: parseBody(body),
		labels,
		lifecycle: deriveLifecycle(labels),
	};
}

export async function loadIssue(
	n: number,
	p: Process,
	opts?: { repo?: string },
): Promise<IssueSpec> {
	const cmd = ["gh", "issue", "view", String(n), "--json", "number,title,body,labels"];
	if (opts?.repo) {
		cmd.push("--repo", opts.repo);
	}

	const result = await p.run(cmd);
	if (!result.ok) {
		throw new Error(`failed to load issue #${n}: ${result.stdout}`);
	}

	const raw = JSON.parse(result.stdout);
	return buildIssueSpec(raw);
}

export async function listByLabel(
	label: string,
	p: Process,
	opts?: { repo?: string; state?: "open" | "closed" | "all" },
): Promise<IssueSpec[]> {
	const cmd = [
		"gh",
		"issue",
		"list",
		"--label",
		label,
		"--state",
		opts?.state ?? "open",
		"--json",
		"number,title,body,labels",
		"--limit",
		"200",
	];
	if (opts?.repo) {
		cmd.push("--repo", opts.repo);
	}

	const result = await p.run(cmd);
	if (!result.ok) {
		throw new Error(`failed to list issues with label '${label}': ${result.stdout}`);
	}

	const raw = JSON.parse(result.stdout);
	return raw.map(buildIssueSpec);
}

export async function listReady(p: Process, opts?: { repo?: string }): Promise<IssueSpec[]> {
	return listByLabel("ready:dispatch", p, opts);
}

export async function addLabel(
	n: number,
	label: string,
	p: Process,
	opts?: { repo?: string },
): Promise<void> {
	const cmd = ["gh", "issue", "edit", String(n), "--add-label", label];
	if (opts?.repo) {
		cmd.push("--repo", opts.repo);
	}

	const result = await p.run(cmd);
	if (!result.ok) {
		throw new Error(`failed to add label '${label}' to issue #${n}: ${result.stdout}`);
	}
}

export async function removeLabel(
	n: number,
	label: string,
	p: Process,
	opts?: { repo?: string },
): Promise<void> {
	const cmd = ["gh", "issue", "edit", String(n), "--remove-label", label];
	if (opts?.repo) {
		cmd.push("--repo", opts.repo);
	}

	const result = await p.run(cmd);
	if (!result.ok) {
		throw new Error(`failed to remove label '${label}' from issue #${n}: ${result.stdout}`);
	}
}

export async function setLifecycle(
	n: number,
	next: Lifecycle,
	p: Process,
	opts?: { repo?: string; current?: readonly string[] },
): Promise<void> {
	let prevLifecycle: Lifecycle | null = null;

	if (opts?.current) {
		prevLifecycle = deriveLifecycle(opts.current);
	} else {
		const spec = await loadIssue(n, p, { repo: opts?.repo });
		prevLifecycle = spec.lifecycle;
	}

	if (next === prevLifecycle) {
		return;
	}

	await addLabel(n, next, p, { repo: opts?.repo });

	if (prevLifecycle !== null) {
		await removeLabel(n, prevLifecycle, p, { repo: opts?.repo });
	}
}

export async function comment(
	n: number,
	body: string,
	p: Process,
	opts?: { repo?: string },
): Promise<void> {
	const cmd = ["gh", "issue", "comment", String(n), "--body", body];
	if (opts?.repo) {
		cmd.push("--repo", opts.repo);
	}

	const result = await p.run(cmd);
	if (!result.ok) {
		throw new Error(`failed to comment on issue #${n}: ${result.stdout}`);
	}
}

// Pure path helpers
// ---------------------------------------------------------------------------

export function specDirForIssue(n: number, slug: string): string {
	return `specs/active/${n}-${slug}`;
}

export function issueNumberFromSpecDir(dir: string): number | null {
	const lastSegment = dir.split("/").filter(Boolean).pop();
	if (!lastSegment) return null;

	const match = lastSegment.match(/^(\d+)-/);
	if (!match?.[1]) return null;

	return Number.parseInt(match[1], 10);
}
