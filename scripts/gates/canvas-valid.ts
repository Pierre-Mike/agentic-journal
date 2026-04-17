/**
 * Smoke gate for spec 005: validates docs/agentic-workflow.canvas.
 *
 * Checks:
 *  - File exists
 *  - Parses as JSON
 *  - Top-level object has `nodes` and `edges` arrays
 *  - Contains both "Forward loop" and "Feedback loop" groups
 *  - At least 12 nodes total
 *
 * Exits 0 on pass, 1 on fail. Run via `bun scripts/gates/canvas-valid.ts`.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

interface CanvasNode {
	readonly id: string;
	readonly type: string;
	readonly label?: string;
	readonly text?: string;
}

interface Canvas {
	readonly nodes: readonly CanvasNode[];
	readonly edges: readonly unknown[];
}

const CANVAS_PATH = "docs/agentic-workflow.canvas";
const REQUIRED_GROUPS = ["Forward loop", "Feedback loop"] as const;
const MIN_NODES = 12;

function fail(msg: string): never {
	console.error(`✖ canvas-valid: ${msg}`);
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
			fail(`missing required group '${required}'`);
		}
	}

	console.log(
		`✓ canvas-valid: ${parsed.nodes.length} nodes, ${parsed.edges.length} edges, groups present`,
	);
}

main();
