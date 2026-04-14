import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";

export type SpecKind = "code" | "rule" | "workflow" | "writeup";

export interface SpecFrontmatter {
	id: string;
	title: string;
	status: "active" | "archived";
	kind: SpecKind;
	gate: string | string[];
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
			owner: fm.owner ?? "blog-lead",
			depends_on: fm.depends_on ?? [],
			supersedes: fm.supersedes ?? null,
		},
		body: parsed.content,
	};
}

export function gatePaths(spec: Spec): string[] {
	const g = spec.frontmatter.gate;
	return Array.isArray(g) ? g : [g];
}

export function isReady(spec: Spec, archivedIds: Set<string>): boolean {
	return spec.frontmatter.depends_on.every((d) => archivedIds.has(d));
}

export function unresolvedDeps(spec: Spec, archivedIds: Set<string>): string[] {
	return spec.frontmatter.depends_on.filter((d) => !archivedIds.has(d));
}

export const VALID_KINDS: SpecKind[] = ["code", "rule", "workflow", "writeup"];
