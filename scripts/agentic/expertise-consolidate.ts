/**
 * Deterministic consolidation pass over a single expertise ref file.
 *
 * The `expertise` skill appends learnings unbounded to `expertise-refs/*.md`.
 * This script loads one file, deduplicates entries by hash of normalized
 * (title + body) content, drops entries older than `maxAgeDays` (default 180),
 * and writes the result back — or prints the intended changes under
 * `--dry-run`. Idempotent: a second run on the same file is a no-op.
 *
 * Pure functions (`parseEntries`, `dedupeByHash`, `pruneByAge`, `serialize`)
 * are unit-tested in `scripts/expertise-consolidate.test.ts`. IO
 * (`consolidateFile`, CLI) is covered by `scripts/smoke-expertise-consolidate.ts`.
 *
 * Entry format per `.claude/skills/expertise/schema.md`: a list item opening
 * with `- **Title**`, followed by a metadata line containing
 * `added: YYYY-MM-DD`, and a free-form body until the next list item or EOF.
 *
 * NO LLM call — constitution §2 (deterministic-first).
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

export interface Entry {
	readonly raw: string;
	readonly title: string;
	readonly body: string;
	readonly added: string | null;
}

export interface ParsedFile {
	readonly header: string;
	readonly entries: readonly Entry[];
}

const ENTRY_OPENER = /^-\s+~?~?\*\*(.+?)\*\*~?~?\s*$/;
const ADDED_RE = /added:\s*(\d{4}-\d{2}-\d{2})/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isEntryOpener(line: string): boolean {
	return ENTRY_OPENER.test(line);
}

function extractTitle(openerLine: string): string {
	const m = openerLine.match(ENTRY_OPENER);
	return m?.[1]?.trim() ?? "";
}

function extractAdded(block: string): string | null {
	const m = block.match(ADDED_RE);
	const date = m?.[1];
	if (date === undefined) return null;
	if (!ISO_DATE.test(date)) return null;
	return date;
}

function deriveBody(block: string, title: string): string {
	const lines = block.split("\n");
	// Drop the opener line; keep the rest as the body signal. Metadata line is
	// intentionally included — rewording a body with the same title + date is
	// still the same gotcha for dedup purposes.
	const bodyLines = lines.slice(1);
	const joined = bodyLines.join("\n");
	// Normalize: combine title + body and use that as the dedup signal. The
	// title carries most of the identity; the body breaks ties.
	return `${title}\n${joined}`;
}

export function parseEntries(markdown: string): ParsedFile {
	if (markdown.length === 0) return { header: "", entries: [] };

	const lines = markdown.split("\n");
	// Locate the first entry opener; everything before it is the header.
	let firstEntryIdx = -1;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line !== undefined && isEntryOpener(line)) {
			firstEntryIdx = i;
			break;
		}
	}

	if (firstEntryIdx === -1) {
		return { header: markdown, entries: [] };
	}

	const header = lines.slice(0, firstEntryIdx).join("\n");

	// Walk from firstEntryIdx, splitting on subsequent openers.
	const entries: Entry[] = [];
	let blockStart = firstEntryIdx;
	for (let i = firstEntryIdx + 1; i <= lines.length; i++) {
		const line = i < lines.length ? lines[i] : undefined;
		const isLast = i === lines.length;
		if (isLast || (line !== undefined && isEntryOpener(line))) {
			const blockLines = lines.slice(blockStart, i);
			const block = blockLines.join("\n");
			const openerLine = blockLines[0] ?? "";
			const title = extractTitle(openerLine);
			const body = deriveBody(block, title);
			const added = extractAdded(block);
			entries.push({ raw: block, title, body, added });
			blockStart = i;
		}
	}

	return { header, entries };
}

function normalize(text: string): string {
	return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function hashEntry(entry: Entry): string {
	const signal = `${normalize(entry.title)}\u0000${normalize(entry.body)}`;
	return createHash("sha256").update(signal).digest("hex").slice(0, 16);
}

export function dedupeByHash(entries: readonly Entry[]): readonly Entry[] {
	const seen = new Set<string>();
	const out: Entry[] = [];
	for (const e of entries) {
		const h = hashEntry(e);
		if (seen.has(h)) continue;
		seen.add(h);
		out.push(e);
	}
	return out;
}

export function pruneByAge(params: {
	entries: readonly Entry[];
	now: Date;
	maxAgeDays: number;
}): readonly Entry[] {
	const { entries, now, maxAgeDays } = params;
	const cutoff = new Date(now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000);
	const kept: Entry[] = [];
	for (const e of entries) {
		if (e.added === null) {
			kept.push(e);
			continue;
		}
		const added = new Date(`${e.added}T00:00:00.000Z`);
		if (Number.isNaN(added.getTime())) {
			kept.push(e);
			continue;
		}
		if (added.getTime() >= cutoff.getTime()) kept.push(e);
	}
	return kept;
}

export function serialize(params: { header: string; entries: readonly Entry[] }): string {
	const { header, entries } = params;
	if (entries.length === 0) return header;
	const raws = entries.map((e) => e.raw.replace(/\n+$/, ""));
	const body = raws.join("\n\n");
	// Ensure exactly one blank line between header and entries if header exists
	// and doesn't already end with a trailing newline block.
	const headerNormalized =
		header.length === 0 ? "" : header.endsWith("\n") ? header : `${header}\n`;
	return `${headerNormalized}${body}\n`;
}

export function consolidateFile(params: {
	path: string;
	now: Date;
	maxAgeDays: number;
	dryRun: boolean;
}): { kept: number; dropped: number; changed: boolean } {
	const { path, now, maxAgeDays, dryRun } = params;
	const original = readFileSync(path, "utf-8");
	const { header, entries } = parseEntries(original);
	const deduped = dedupeByHash(entries);
	const pruned = pruneByAge({ entries: deduped, now, maxAgeDays });
	const out = serialize({ header, entries: pruned });
	const kept = pruned.length;
	const dropped = entries.length - kept;
	const changed = out !== original;
	if (!dryRun && changed) writeFileSync(path, out);
	return { kept, dropped, changed };
}

interface ParsedArgs {
	path: string | null;
	maxAgeDays: number;
	dryRun: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
	const out: ParsedArgs = { path: null, maxAgeDays: 180, dryRun: false };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--max-age-days") {
			const v = argv[++i];
			if (v !== undefined) {
				const n = Number(v);
				if (Number.isFinite(n) && n >= 0) out.maxAgeDays = n;
			}
		} else if (a === "--dry-run") {
			out.dryRun = true;
		} else if (a !== undefined && !a.startsWith("--") && out.path === null) {
			out.path = a;
		}
	}
	return out;
}

export async function run(argv: string[]): Promise<number> {
	const args = parseArgs(argv.slice(2));
	if (args.path === null) {
		process.stderr.write(
			"usage: bun scripts/expertise-consolidate.ts <path> [--max-age-days N] [--dry-run]\n",
		);
		return 1;
	}
	const res = consolidateFile({
		path: args.path,
		now: new Date(),
		maxAgeDays: args.maxAgeDays,
		dryRun: args.dryRun,
	});
	const verb = args.dryRun ? "would keep" : "kept";
	process.stdout.write(
		`${verb} ${res.kept}, dropped ${res.dropped} (${args.dryRun ? "dry-run" : res.changed ? "wrote" : "unchanged"}): ${args.path}\n`,
	);
	return 0;
}

if (import.meta.main) {
	const code = await run(process.argv);
	process.exit(code);
}
