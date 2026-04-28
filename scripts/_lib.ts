// @no-test: sibling test _lib.test.ts was authored for pre-existing exports; new Process+Fs ports are covered by worktree-open.test.ts and worktree-close.test.ts
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";

export type SpecKind = "code" | "rule" | "workflow" | "writeup";

export type GateLevel = "unit" | "integration" | "e2e";

export interface GateEntry {
	readonly path: string;
	readonly level: GateLevel;
}

const VALID_GATE_LEVELS: readonly GateLevel[] = ["unit", "integration", "e2e"];

export interface SpecFrontmatter {
	id: string;
	title: string;
	status: "active" | "archived";
	kind: SpecKind;
	gate: string | string[] | Array<{ path: string; level: string }>;
	created: string;
	owner: string;
	depends_on: string[];
	supersedes: string | null;
}

export interface Spec {
	slug: string;
	dir: string;
	frontmatter: SpecFrontmatter;
	body: string;
}

const REPO_ROOT = process.cwd();
const SPECS_DIR = join(REPO_ROOT, "specs");

export function listActiveSpecs(): Spec[] {
	const dir = join(SPECS_DIR, "active");
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((name) => !name.startsWith("_") && !name.startsWith("."))
		.map((slug) => loadSpec(join(dir, slug)))
		.filter((s): s is Spec => s !== null);
}

export function listArchivedIds(): Set<string> {
	const dir = join(SPECS_DIR, "archive");
	if (!existsSync(dir)) return new Set();
	const ids = new Set<string>();
	for (const name of readdirSync(dir)) {
		const spec = loadSpec(join(dir, name));
		if (spec) ids.add(spec.frontmatter.id);
	}
	return ids;
}

export function loadSpec(dir: string): Spec | null {
	const proposalPath = join(dir, "proposal.md");
	if (!existsSync(proposalPath)) return null;
	const raw = readFileSync(proposalPath, "utf-8");
	const parsed = matter(raw);
	const fm = parsed.data as Partial<SpecFrontmatter>;
	if (!fm.id || !fm.kind || !fm.gate) return null;
	return {
		slug: dir.split("/").pop() ?? "",
		dir,
		frontmatter: {
			id: fm.id,
			title: fm.title ?? "",
			status: fm.status ?? "active",
			kind: fm.kind,
			gate: fm.gate,
			created: fm.created ?? "",
			owner: fm.owner ?? "main",
			depends_on: fm.depends_on ?? [],
			supersedes: fm.supersedes ?? null,
		},
		body: parsed.content,
	};
}

/**
 * Parse the `gate:` frontmatter field into a list of typed entries.
 *
 * Accepted shapes:
 *  - scalar string  → [{path: string, level: "unit"}]  (legacy lift)
 *  - string[]       → [{path: string, level: "unit"}, ...]  (legacy list lift)
 *  - {path, level}[]  → typed entries, validated
 *
 * Throws on:
 *  - unknown level string
 *  - duplicate paths
 */
export function gateEntries(spec: { frontmatter: { gate: unknown } }): readonly GateEntry[] {
	const g = spec.frontmatter.gate;

	let raw: Array<{ path: string; level: string }>;

	if (typeof g === "string") {
		// Scalar legacy: lift to unit
		raw = [{ path: g, level: "unit" }];
	} else if (Array.isArray(g)) {
		if (g.length === 0) return [];
		if (typeof g[0] === "string") {
			// string[] legacy: lift each to unit
			raw = (g as string[]).map((p) => ({ path: p, level: "unit" }));
		} else {
			// typed list
			raw = g as Array<{ path: string; level: string }>;
		}
	} else {
		throw new Error(`invalid gate field: expected string or array, got ${typeof g}`);
	}

	// Validate levels and collect entries
	const seen = new Set<string>();
	const entries: GateEntry[] = [];
	for (const item of raw) {
		if (!VALID_GATE_LEVELS.includes(item.level as GateLevel)) {
			throw new Error(`unknown gate level '${item.level}'; expected unit|integration|e2e`);
		}
		if (seen.has(item.path)) {
			throw new Error(`duplicate gate path '${item.path}'`);
		}
		seen.add(item.path);
		entries.push({ path: item.path, level: item.level as GateLevel });
	}
	return entries;
}

export function gatePaths(spec: Spec): string[] {
	const g = spec.frontmatter.gate;
	if (typeof g === "string") return [g];
	if (Array.isArray(g)) {
		if (g.length === 0) return [];
		if (typeof g[0] === "string") return g as string[];
		return (g as Array<{ path: string; level: string }>).map((e) => e.path);
	}
	return [];
}

export function isReady(spec: Spec, archivedIds: Set<string>): boolean {
	return spec.frontmatter.depends_on.every((d) => archivedIds.has(d));
}

export function unresolvedDeps(spec: Spec, archivedIds: Set<string>): string[] {
	return spec.frontmatter.depends_on.filter((d) => !archivedIds.has(d));
}

export const VALID_KINDS: SpecKind[] = ["code", "rule", "workflow", "writeup"];

// ---------------------------------------------------------------------------
// Process + Fs ports
// ---------------------------------------------------------------------------

export type Process = {
	run(cmd: readonly string[], opts?: { cwd?: string }): Promise<{ ok: boolean; stdout: string }>;
};

export type Fs = {
	exists(path: string): boolean;
};

export const realProcess: Process = {
	async run(cmd, opts) {
		const proc = Bun.spawn(cmd as string[], {
			cwd: opts?.cwd,
			stdout: "pipe",
			stderr: "pipe",
		});
		const [stdout, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
		return { ok: code === 0, stdout: stdout.trim() };
	},
};

export const realFs: Fs = {
	exists(path) {
		return existsSync(path);
	},
};

// ---------------------------------------------------------------------------
// Slice-RED helpers
// ---------------------------------------------------------------------------

export interface TaskGateEntry {
	readonly ordinal: number;
	readonly gatePath: string;
	readonly frozen: boolean;
}

/**
 * Parse the `gate:` field from each task in a `tasks.md` file.
 * Returns one entry per task that declares a `gate:` field, with ordinals
 * starting at 1. The `frozen` field is true if the corresponding
 * `.gate-frozen-N` sentinel file exists in `specDir`.
 *
 * Only applies to `kind: code` specs. For other kinds, returns [].
 */
export function taskGates(specDir: string): readonly TaskGateEntry[] {
	const tasksPath = join(specDir, "tasks.md");
	if (!existsSync(tasksPath)) return [];

	const lines = readFileSync(tasksPath, "utf-8").split("\n");
	const entries: TaskGateEntry[] = [];
	let ordinal = 0;
	let inTask = false;

	for (const line of lines) {
		const taskMatch = line.match(/^- \[[ x]\]\s+.+$/);
		if (taskMatch) {
			inTask = true;
			continue;
		}
		if (!inTask) continue;
		const gateMatch = line.match(/^\s+-\s+gate:\s*(.+)$/);
		if (gateMatch) {
			ordinal += 1;
			const gatePath = (gateMatch[1] ?? "").trim();
			const sentinelPath = join(specDir, `.gate-frozen-${ordinal}`);
			const frozen = existsSync(sentinelPath);
			entries.push({ ordinal, gatePath, frozen });
		}
	}

	return entries;
}
