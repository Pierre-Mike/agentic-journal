/**
 * Deterministic canary runner for the harness.
 *
 * Loads a locked baseline (`canaries/baseline.json`) of canary entries. Each
 * entry points at a deterministic `.ts` script that simulates the unit of work
 * — no LLM, no network, no `/do` recursion. The runner spawns each script,
 * captures stdout + exit code, compares against `expected_output` (substring
 * match; empty means "only exit 0 is required"), and reports a weighted pass
 * rate.
 *
 * Pure fns (`score`) live here and are covered by scripts/canary-run.test.ts.
 * IO (`loadBaseline`, `runCanary`, `run`) is exercised by
 * scripts/smoke-canary.ts.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export interface CanaryEntry {
	id: string;
	description: string;
	script_path: string;
	expected_output: string;
	weight: number;
}

export interface CanaryResult {
	id: string;
	passed: boolean;
	exit_code: number;
	stdout: string;
	duration_ms: number;
	reason: string | null;
}

export interface CanaryReport {
	total: number;
	passed: number;
	failed: number;
	skipped: number;
	pass_rate: number;
	results: CanaryResult[];
}

function isCanaryEntry(x: unknown): x is CanaryEntry {
	if (x === null || typeof x !== "object") return false;
	const r = x as Record<string, unknown>;
	return (
		typeof r.id === "string" &&
		typeof r.description === "string" &&
		typeof r.script_path === "string" &&
		typeof r.expected_output === "string" &&
		typeof r.weight === "number" &&
		Number.isFinite(r.weight) &&
		r.weight >= 0
	);
}

export function loadBaseline(path: string): CanaryEntry[] {
	if (!existsSync(path)) {
		throw new Error(`baseline not found: ${path}`);
	}
	const raw = readFileSync(path, "utf-8");
	const parsed: unknown = JSON.parse(raw);
	if (!Array.isArray(parsed)) {
		throw new Error(`baseline must be a JSON array, got ${typeof parsed}`);
	}
	const out: CanaryEntry[] = [];
	for (let i = 0; i < parsed.length; i++) {
		const item = parsed[i];
		if (!isCanaryEntry(item)) {
			throw new Error(`baseline[${i}] is not a valid CanaryEntry`);
		}
		out.push(item);
	}
	return out;
}

export async function runCanary(args: { entry: CanaryEntry; cwd: string }): Promise<CanaryResult> {
	const { entry, cwd } = args;
	const scriptAbs = resolve(cwd, entry.script_path);
	const start = Date.now();
	if (!existsSync(scriptAbs)) {
		return {
			id: entry.id,
			passed: false,
			exit_code: -1,
			stdout: "",
			duration_ms: Date.now() - start,
			reason: `script missing: ${entry.script_path}`,
		};
	}
	const proc = Bun.spawn(["bun", scriptAbs], {
		cwd,
		stdout: "pipe",
		stderr: "pipe",
	});
	const stdout = await new Response(proc.stdout).text();
	const exitCode = await proc.exited;
	const duration = Date.now() - start;
	let passed = exitCode === 0;
	let reason: string | null = null;
	if (exitCode !== 0) {
		reason = `exit ${exitCode}`;
	} else if (entry.expected_output.length > 0 && !stdout.includes(entry.expected_output)) {
		passed = false;
		reason = `stdout missing expected substring "${entry.expected_output}"`;
	}
	return {
		id: entry.id,
		passed,
		exit_code: exitCode,
		stdout,
		duration_ms: duration,
		reason,
	};
}

export function score(results: CanaryResult[], entries: CanaryEntry[]): CanaryReport {
	const weightById = new Map<string, number>();
	for (const e of entries) weightById.set(e.id, e.weight);

	let totalWeight = 0;
	let passedWeight = 0;
	let passed = 0;
	let failed = 0;

	for (const r of results) {
		const w = weightById.get(r.id) ?? 1;
		totalWeight += w;
		if (r.passed) {
			passed++;
			passedWeight += w;
		} else {
			failed++;
		}
	}

	const passRate = totalWeight === 0 ? 1 : passedWeight / totalWeight;

	return {
		total: results.length,
		passed,
		failed,
		skipped: 0,
		pass_rate: passRate,
		results,
	};
}

export function renderText(report: CanaryReport): string {
	const lines: string[] = [];
	const pct = (report.pass_rate * 100).toFixed(0);
	lines.push(`Canary run — ${report.passed}/${report.total} passed, pass rate ${pct}%`);
	for (const r of report.results) {
		const mark = r.passed ? "\u2713" : "\u2716";
		const suffix = r.passed ? "" : ` — ${r.reason ?? "failed"}`;
		lines.push(`  ${mark} ${r.id} (${r.duration_ms}ms)${suffix}`);
	}
	return lines.join("\n");
}

interface ParsedArgs {
	baseline: string;
	filter: string | null;
	format: "text" | "json";
	updateBaseline: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
	const out: ParsedArgs = {
		baseline: join(process.cwd(), "canaries", "baseline.json"),
		filter: null,
		format: "text",
		updateBaseline: false,
	};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--baseline") {
			const v = argv[++i];
			if (v !== undefined) out.baseline = v;
		} else if (a === "--filter") {
			out.filter = argv[++i] ?? null;
		} else if (a === "--format") {
			const v = argv[++i];
			if (v === "json" || v === "text") out.format = v;
		} else if (a === "--update-baseline") {
			out.updateBaseline = true;
		}
	}
	return out;
}

export async function run(argv: string[]): Promise<number> {
	const args = parseArgs(argv.slice(2));

	if (args.updateBaseline && process.env.CANARY_UPDATE !== "1") {
		process.stderr.write("--update-baseline requires CANARY_UPDATE=1 env guard. Refusing.\n");
		return 2;
	}

	const entries = loadBaseline(args.baseline);
	const filtered = args.filter === null ? entries : entries.filter((e) => e.id === args.filter);
	const cwd = process.cwd();
	const results: CanaryResult[] = [];
	for (const entry of filtered) {
		results.push(await runCanary({ entry, cwd }));
	}
	const report = score(results, filtered);

	if (args.format === "json") {
		process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
	} else {
		process.stdout.write(`${renderText(report)}\n`);
	}

	return report.failed === 0 ? 0 : 1;
}

if (import.meta.main) {
	const code = await run(process.argv);
	process.exit(code);
}
