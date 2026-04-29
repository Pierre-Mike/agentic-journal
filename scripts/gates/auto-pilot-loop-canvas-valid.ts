/**
 * Smoke gate for spec 048: validates docs/auto-pilot-loop.canvas.
 *
 * Checks:
 *  - File exists
 *  - Parses as valid JSON
 *  - Top-level object has `nodes` and `edges` arrays
 *  - Contains all three swim-lane groups: "Trigger", "Judgment gate", "Outcomes"
 *  - At least 8 nodes total (6 component nodes + 2 group nodes minimum)
 *  - At least 4 labeled edges
 *
 * Exits 0 on pass, 1 on fail. Run via `bun scripts/gates/auto-pilot-loop-canvas-valid.ts`.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

interface CanvasNode {
	readonly id: string;
	readonly type: string;
	readonly label?: string;
	readonly text?: string;
}

interface CanvasEdge {
	readonly id: string;
	readonly fromNode: string;
	readonly toNode: string;
	readonly label?: string;
}

interface Canvas {
	readonly nodes: readonly CanvasNode[];
	readonly edges: readonly CanvasEdge[];
}

const CANVAS_PATH = "docs/auto-pilot-loop.canvas";
const REQUIRED_GROUPS = ["Trigger", "Judgment gate", "Outcomes"] as const;
const MIN_NODES = 8;
const MIN_LABELED_EDGES = 4;

function fail(msg: string): never {
	console.error(`✖ auto-pilot-loop-canvas-valid: ${msg}`);
	process.exit(1);
}

function isCanvas(v: unknown): v is Canvas {
	if (typeof v !== "object" || v === null) return false;
	const o = v as { nodes?: unknown; edges?: unknown };
	return Array.isArray(o.nodes) && Array.isArray(o.edges);
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

	if (parsed.nodes.length < MIN_NODES) {
		fail(`expected at least ${MIN_NODES} nodes, got ${parsed.nodes.length}`);
	}

	const groupLabels = new Set(
		parsed.nodes.filter((n) => n.type === "group").map((n) => n.label ?? ""),
	);

	for (const required of REQUIRED_GROUPS) {
		if (!groupLabels.has(required)) {
			fail(`missing required swim-lane group '${required}'`);
		}
	}

	const labeledEdges = parsed.edges.filter((e) => e.label && e.label.trim().length > 0);
	if (labeledEdges.length < MIN_LABELED_EDGES) {
		fail(`expected at least ${MIN_LABELED_EDGES} labeled edges, got ${labeledEdges.length}`);
	}

	console.log(
		`✓ auto-pilot-loop-canvas-valid: ${parsed.nodes.length} nodes, ${parsed.edges.length} edges, ${labeledEdges.length} labeled edges, groups present`,
	);
}

main();
