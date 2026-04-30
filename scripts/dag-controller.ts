// @no-test: sibling test dag-controller.test.ts is frozen (gate-frozen-2); already GREEN
/**
 * DAG evaluation utilities for tasks.md spec slices.
 *
 * Exports:
 *  - DagTask — typed representation of a tasks.md slice entry
 *  - parseTasksDag(tasksMd) — parse tasks.md string → DagTask[]
 *  - intersectsTouches(a, b) — true iff arrays share any element
 *  - findDispatchable({ tasks, completed, inFlight }) — safe-to-dispatch slice IDs
 */

export interface DagTask {
	readonly id: number;
	readonly title: string;
	readonly depends_on: number[];
	readonly touches: string[];
	readonly file_targets: string[];
	readonly gate: string;
}

interface InFlightEntry {
	readonly sliceId: number;
	readonly touches: string[];
}

interface DispatchableInput {
	readonly tasks: DagTask[];
	readonly completed: Set<number>;
	readonly inFlight: InFlightEntry[];
}

/**
 * Parse a tasks.md string into DagTask records.
 *
 * Expects the YAML-list format used in spec tasks.md files:
 *   - id: N
 *     title: "..."
 *     depends_on: [...]
 *     touches:
 *       - path/to/file
 *     file_targets:
 *       - path/to/file
 *     gate: path/to/gate.test.ts
 *
 * Throws if no tasks are found or any task is missing required fields
 * (id, title, depends_on, touches, file_targets, gate).
 */
export function parseTasksDag(tasksMd: string): DagTask[] {
	const lines = tasksMd.split("\n");

	// Split into task blocks. Each block starts with a line matching /^- id:/
	// (or `^- id:` after the `## Tasks` header).
	const taskBlocks: string[][] = [];
	let currentBlock: string[] | null = null;

	for (const line of lines) {
		if (/^- id:/.test(line)) {
			if (currentBlock !== null) taskBlocks.push(currentBlock);
			currentBlock = [line];
		} else if (currentBlock !== null) {
			// A new top-level `- ` that is NOT `- id:` ends the current block.
			// However, list items under `touches:` / `file_targets:` / `boundary:` are
			// indented, so they start with spaces.  Only an unindented `- ` prefix
			// (which should not appear in well-formed tasks.md) would end the block.
			currentBlock.push(line);
		}
	}
	if (currentBlock !== null) taskBlocks.push(currentBlock);

	if (taskBlocks.length === 0) {
		throw new Error("parseTasksDag: no task blocks found in tasks.md");
	}

	const tasks: DagTask[] = taskBlocks.map((block, blockIdx) => {
		const text = block.join("\n");

		// id
		const idMatch = text.match(/^- id:\s*(\d+)/m);
		if (!idMatch) throw new Error(`parseTasksDag: block ${blockIdx} missing 'id'`);
		const id = Number(idMatch[1]);

		// title — may be quoted or unquoted
		const titleMatch = text.match(/^\s+title:\s*"?([^"\n]+)"?/m);
		if (!titleMatch) throw new Error(`parseTasksDag: block ${blockIdx} (id=${id}) missing 'title'`);
		const title = titleMatch[1]?.trim() ?? "";
		if (title.length === 0)
			throw new Error(`parseTasksDag: block ${blockIdx} (id=${id}) empty 'title'`);

		// depends_on — inline bracket form: depends_on: [1, 2]
		// or multi-line form (not present in current fixtures, but we support inline)
		const depMatch = text.match(/^\s+depends_on:\s*\[([^\]]*)\]/m);
		if (!depMatch)
			throw new Error(`parseTasksDag: block ${blockIdx} (id=${id}) missing 'depends_on'`);
		const depends_on: number[] = depMatch[1]
			? depMatch[1]
					.split(",")
					.map((s) => s.trim())
					.filter(Boolean)
					.map(Number)
					.filter((n) => Number.isFinite(n))
			: [];

		// touches — multi-line YAML list
		const touches = parseYamlStringList(text, "touches", id);
		if (touches === null) {
			throw new Error(`parseTasksDag: block ${blockIdx} (id=${id}) missing 'touches'`);
		}
		if (touches.length === 0) {
			throw new Error(`parseTasksDag: block ${blockIdx} (id=${id}) 'touches' must be non-empty`);
		}

		// file_targets — multi-line YAML list
		const file_targets = parseYamlStringList(text, "file_targets", id);
		if (file_targets === null) {
			throw new Error(`parseTasksDag: block ${blockIdx} (id=${id}) missing 'file_targets'`);
		}

		// gate — required for kind:code specs, optional for kind:workflow/rule/writeup.
		// We default to empty string here; spec-lint enforces presence per kind.
		const gateMatch = text.match(/^\s+gate:\s*(\S+)/m);
		const gate = gateMatch?.[1]?.trim() ?? "";

		return { id, title, depends_on, touches, file_targets, gate };
	});

	return tasks;
}

/**
 * Extract a YAML multi-line string list from a block of text.
 *
 * Matches:
 *   <key>:
 *     - item1
 *     - item2
 *
 * Returns null if the key is not present.
 * Returns [] if the key exists but has no items before the next key.
 */
function parseYamlStringList(text: string, key: string, _id: number): string[] | null {
	// Match the key line (indented or at line start)
	const keyRegex = new RegExp(`^\\s+${key}:\\s*$`, "m");
	const keyMatch = keyRegex.exec(text);
	if (!keyMatch) return null;

	const afterKey = text.slice(keyMatch.index + keyMatch[0].length);
	const items: string[] = [];

	for (const line of afterKey.split("\n")) {
		if (line.trim() === "") continue;
		// Indented list item: `    - value`
		const itemMatch = line.match(/^\s{2,}-\s+(.+)$/);
		if (itemMatch) {
			items.push((itemMatch[1] ?? "").trim());
		} else {
			// Non-list indented line means we've moved to the next key
			break;
		}
	}

	return items;
}

/**
 * Returns true iff arrays `a` and `b` share at least one identical element.
 * Returns false if either array is empty.
 */
export function intersectsTouches(a: string[], b: string[]): boolean {
	if (a.length === 0 || b.length === 0) return false;
	const setA = new Set(a);
	return b.some((item) => setA.has(item));
}

/**
 * Returns the slice IDs that are safe to dispatch now:
 *   1. All depends_on IDs are in `completed`.
 *   2. The slice's `touches` do not overlap with any in-flight slice's `touches`.
 *   3. The slice is not already in `completed` or `inFlight`.
 */
export function findDispatchable({ tasks, completed, inFlight }: DispatchableInput): number[] {
	const inFlightIds = new Set(inFlight.map((e) => e.sliceId));
	const inFlightTouches: string[] = inFlight.flatMap((e) => e.touches);

	return tasks
		.filter((task) => {
			if (completed.has(task.id)) return false;
			if (inFlightIds.has(task.id)) return false;
			const depsSatisfied = task.depends_on.every((dep) => completed.has(dep));
			if (!depsSatisfied) return false;
			if (intersectsTouches(task.touches, inFlightTouches)) return false;
			return true;
		})
		.map((task) => task.id);
}

// ---------------------------------------------------------------------------
// Compatibility shim: outer-gate API (simpler Slice type, returns Slice[])
// ---------------------------------------------------------------------------

interface SimpleSlice {
	readonly id: number;
	readonly depends_on: number[];
	readonly touches: string[];
}

/**
 * Outer-gate compatible variant of findDispatchable.
 * Accepts the minimal Slice shape (id, depends_on, touches) and returns Slice[].
 */
export function dispatchable(
	slices: SimpleSlice[],
	done: Set<number>,
	inFlight: SimpleSlice[],
): SimpleSlice[] {
	const inFlightIds = new Set(inFlight.map((s) => s.id));
	const inFlightTouches: string[] = inFlight.flatMap((s) => s.touches);

	return slices.filter((slice) => {
		if (done.has(slice.id)) return false;
		if (inFlightIds.has(slice.id)) return false;
		if (!slice.depends_on.every((dep) => done.has(dep))) return false;
		if (intersectsTouches(slice.touches, inFlightTouches)) return false;
		return true;
	});
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------
//
// Usage: bun scripts/dag-controller.ts <tasks.md path> [completed-csv] [inflight-json]
//
//   tasks.md path    — required. Path to the spec's tasks.md.
//   completed-csv    — comma-separated slice IDs already GREEN (e.g. "1,3").
//                      Empty or missing = none.
//   inflight-json    — JSON array from `gh run list --json databaseId,name`.
//                      Names are matched against /slice[_\s]+id[=:]\s*(\d+)/i to
//                      extract the in-flight slice IDs. Empty or "[]" = none.
//
// Prints a JSON array of dispatchable slice IDs to stdout, e.g. "[1,2]".
// Exits 2 on usage error, 0 otherwise (including empty result).

if (import.meta.main) {
	const [tasksMdPath, completedArg = "", inFlightArg = "[]"] = process.argv.slice(2);
	if (!tasksMdPath) {
		console.error("usage: dag-controller.ts <tasks.md path> [completed-csv] [inflight-json]");
		process.exit(2);
	}
	const raw = await Bun.file(tasksMdPath).text();
	const tasks = parseTasksDag(raw);
	const completed = new Set(
		completedArg
			? completedArg
					.split(",")
					.map((s) => s.trim())
					.filter(Boolean)
					.map(Number)
					.filter((n) => Number.isFinite(n))
			: [],
	);
	const taskById = new Map(tasks.map((t) => [t.id, t]));
	let inFlight: InFlightEntry[] = [];
	try {
		const parsed = JSON.parse(inFlightArg);
		if (Array.isArray(parsed)) {
			inFlight = parsed
				.map((r): InFlightEntry | null => {
					const m = String(r.name ?? "").match(/slice[_\s]+id[=:]\s*(\d+)/i);
					const id = m ? Number(m[1]) : Number.NaN;
					const task = taskById.get(id);
					return task ? { sliceId: id, touches: task.touches } : null;
				})
				.filter((e): e is InFlightEntry => e !== null);
		}
	} catch {
		inFlight = [];
	}
	const ids = findDispatchable({ tasks, completed, inFlight });
	console.log(JSON.stringify(ids));
}
