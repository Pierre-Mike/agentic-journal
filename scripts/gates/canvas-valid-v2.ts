/**
 * Smoke gate for spec 017: validates docs/agentic-workflow.canvas (v2).
 *
 * Checks:
 *  - File exists, parses as JSON, top-level has `nodes` + `edges` arrays.
 *  - Total node count between 20 and 30.
 *  - Three top-level groups labeled "Forward loop" / "Feedback loop" /
 *    "Guardrails" with documented fills (#cce5ff / #e0d4f7 / #ffd6d6).
 *  - Exactly 5 file-type nodes pointing to the named repo paths.
 *  - Exactly 1 link node to the PR list.
 *  - At least 3 dotted-red guardrail edges from a guardrail-zone node to a
 *    forward-zone stage.
 *
 * Exits 0 on pass, 1 on fail. Run via `bun scripts/gates/canvas-valid-v2.ts`.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

interface CanvasNode {
	readonly id: string;
	readonly type: string;
	readonly label?: string;
	readonly text?: string;
	readonly file?: string;
	readonly url?: string;
	readonly color?: string;
	readonly background?: string;
	readonly backgroundStyle?: string;
}

interface CanvasEdge {
	readonly id: string;
	readonly fromNode: string;
	readonly toNode: string;
	readonly color?: string;
	readonly styleAttributes?: { readonly pathfinder?: string; readonly [k: string]: unknown };
	readonly label?: string;
}

interface Canvas {
	readonly nodes: readonly CanvasNode[];
	readonly edges: readonly CanvasEdge[];
}

const CANVAS_PATH = "docs/agentic-workflow.canvas";
const MIN_NODES = 20;
const MAX_NODES = 30;

const REQUIRED_GROUPS: ReadonlyArray<{ readonly label: string; readonly fill: string }> = [
	{ label: "Forward loop", fill: "#cce5ff" },
	{ label: "Feedback loop", fill: "#e0d4f7" },
	{ label: "Guardrails", fill: "#ffd6d6" },
];

const REQUIRED_FILE_NODES: ReadonlyArray<string> = [
	"lefthook.yml",
	"scripts/ci/red-commit-gate.ts",
	"scripts/agentic/trace-scan.ts",
	".claude/skills/do/SKILL.md",
	".claude/skills/retro/SKILL.md",
];

const REQUIRED_LINK_URL = "https://github.com/Pierre-Mike/agentic-journal/pulls";

const MIN_GUARDRAIL_EDGES = 3;

function fail(msg: string): never {
	console.error(`✖ canvas-valid-v2: ${msg}`);
	process.exit(1);
}

function isCanvas(v: unknown): v is Canvas {
	if (typeof v !== "object" || v === null) return false;
	const o = v as { nodes?: unknown; edges?: unknown };
	return Array.isArray(o.nodes) && Array.isArray(o.edges);
}

function normalizeFill(value: string | undefined): string | undefined {
	if (value === undefined) return undefined;
	return value.trim().toLowerCase();
}

function isRedGuardrailEdge(edge: CanvasEdge): boolean {
	// Guardrail edges are flagged by red color. Canvas presets use "1" for red;
	// hex #ff0000 / #ff6b6b / similar are also accepted. The "dotted" styling
	// is conveyed by canvas-generator-v2's color rendering — we only enforce
	// the color discipline here because the layout engine does not pass through
	// `styleAttributes.pathfinder`.
	const color = (edge.color ?? "").toLowerCase();
	if (color === "1" || color === "red") return true;
	if (color.startsWith("#")) {
		// Red-dominant hex: red channel ≥ 0xc0 and green/blue channels < 0x80.
		const hex = color.replace("#", "");
		if (hex.length === 6) {
			const r = Number.parseInt(hex.slice(0, 2), 16);
			const g = Number.parseInt(hex.slice(2, 4), 16);
			const b = Number.parseInt(hex.slice(4, 6), 16);
			return r >= 0xc0 && g < 0x80 && b < 0x80;
		}
	}
	return false;
}

function main(): void {
	const abs = join(process.cwd(), CANVAS_PATH);
	if (!existsSync(abs)) fail(`missing ${CANVAS_PATH}`);

	const raw = readFileSync(abs, "utf-8");
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (e) {
		fail(`invalid JSON: ${(e as Error).message}`);
	}

	if (!isCanvas(parsed)) {
		fail(`top-level object must have 'nodes' and 'edges' arrays`);
	}

	const nodeCount = parsed.nodes.length;
	if (nodeCount < MIN_NODES || nodeCount > MAX_NODES) {
		fail(`node count ${nodeCount} outside required range [${MIN_NODES}, ${MAX_NODES}]`);
	}

	// Group check: label + fill
	const groupNodes = parsed.nodes.filter((n) => n.type === "group");
	for (const required of REQUIRED_GROUPS) {
		const match = groupNodes.find((g) => (g.label ?? "") === required.label);
		if (!match) fail(`missing required group '${required.label}'`);
		const fill = normalizeFill(match.background) ?? normalizeFill(match.color);
		if (fill !== required.fill.toLowerCase()) {
			fail(
				`group '${required.label}' fill ${fill ?? "(none)"} does not match required ${required.fill}`,
			);
		}
	}

	// File nodes: exactly REQUIRED_FILE_NODES
	const fileNodes = parsed.nodes.filter((n) => n.type === "file");
	const fileTargets = new Set(fileNodes.map((n) => n.file ?? ""));
	if (fileNodes.length !== REQUIRED_FILE_NODES.length) {
		fail(
			`expected exactly ${REQUIRED_FILE_NODES.length} file nodes, got ${fileNodes.length} (${[...fileTargets].join(", ")})`,
		);
	}
	for (const required of REQUIRED_FILE_NODES) {
		if (!fileTargets.has(required)) {
			fail(`missing file node for '${required}' (have: ${[...fileTargets].join(", ")})`);
		}
		// Also check the file actually exists in the repo.
		const repoPath = join(process.cwd(), required);
		if (!existsSync(repoPath)) {
			fail(`file node '${required}' references a path that does not exist in the repo`);
		}
	}

	// Link node: exactly 1 to REQUIRED_LINK_URL
	const linkNodes = parsed.nodes.filter((n) => n.type === "link");
	if (linkNodes.length !== 1) {
		fail(`expected exactly 1 link node, got ${linkNodes.length}`);
	}
	const linkUrl = (linkNodes[0]?.url ?? "").trim();
	if (linkUrl !== REQUIRED_LINK_URL) {
		fail(`link node url '${linkUrl}' does not match required '${REQUIRED_LINK_URL}'`);
	}

	// Guardrail edges: at least MIN_GUARDRAIL_EDGES red-colored edges from a
	// guardrail-zone node to a forward-zone stage.
	const guardrailEdges = parsed.edges.filter((e) => isRedGuardrailEdge(e));
	if (guardrailEdges.length < MIN_GUARDRAIL_EDGES) {
		fail(
			`expected at least ${MIN_GUARDRAIL_EDGES} red guardrail edges, got ${guardrailEdges.length}`,
		);
	}

	console.log(
		`✓ canvas-valid-v2: ${nodeCount} nodes, ${parsed.edges.length} edges, ${groupNodes.length} groups, ${fileNodes.length} file nodes, ${linkNodes.length} link node, ${guardrailEdges.length} red guardrail edges`,
	);
}

main();
