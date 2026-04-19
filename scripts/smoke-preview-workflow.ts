import { existsSync, readFileSync } from "node:fs";

const WORKFLOW_PATH = process.env.PREVIEW_WORKFLOW_PATH ?? ".github/workflows/preview.yml";

type StepBlock = { readonly text: string; readonly startLine: number };

function findStepBlock(content: string, stepName: string): StepBlock | null {
	const lines = content.split("\n");
	const startIdx = lines.findIndex((l) => new RegExp(`-\\s*name:\\s*${stepName}`).test(l));
	if (startIdx < 0) return null;
	let endIdx = lines.length;
	for (let i = startIdx + 1; i < lines.length; i++) {
		const l = lines[i];
		if (l !== undefined && /^\s*-\s*name:\s*/.test(l)) {
			endIdx = i;
			break;
		}
	}
	return { text: lines.slice(startIdx, endIdx).join("\n"), startLine: startIdx + 1 };
}

function fail(msg: string): never {
	console.error(`smoke-preview-workflow: FAIL ${msg}`);
	process.exit(1);
}

if (!existsSync(WORKFLOW_PATH)) fail(`MISSING: ${WORKFLOW_PATH}`);

const content = readFileSync(WORKFLOW_PATH, "utf8");
const step = findStepBlock(content, "Preview deploy");
if (step === null) fail(`MISSING: 'Preview deploy' step in ${WORKFLOW_PATH}`);

const requiredEnvLines: readonly string[] = [
	"CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}",
	"CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}",
];
for (const needle of requiredEnvLines) {
	if (!step.text.includes(needle)) {
		fail(`MISSING env entry: ${needle} (Preview deploy step starts at L${step.startLine})`);
	}
}

if (!step.text.includes("--env=")) {
	fail(
		`MISSING wrangler flag: --env= in Preview deploy command (step starts at L${step.startLine})`,
	);
}

type PermissionsBlock = { readonly text: string; readonly startLine: number };

function findTopLevelPermissionsBlock(src: string): PermissionsBlock | null {
	const lines = src.split("\n");
	// Anchor at start-of-line (column 0) so a nested job-scope `permissions:`
	// (indented) does not false-match the workflow-scope key we want.
	const startIdx = lines.findIndex((l) => /^permissions:\s*$/.test(l));
	if (startIdx < 0) return null;
	let endIdx = lines.length;
	for (let i = startIdx + 1; i < lines.length; i++) {
		const l = lines[i];
		if (l === undefined) continue;
		// A new top-level key (non-indented, non-empty, non-comment) ends the block.
		if (/^\S/.test(l)) {
			endIdx = i;
			break;
		}
	}
	return { text: lines.slice(startIdx, endIdx).join("\n"), startLine: startIdx + 1 };
}

const permissions = findTopLevelPermissionsBlock(content);
if (permissions === null) {
	fail(`MISSING: workflow-scope 'permissions:' block in ${WORKFLOW_PATH}`);
}
if (!permissions.text.includes("pull-requests: write")) {
	fail(
		`MISSING permissions entry: 'pull-requests: write' (permissions block starts at L${permissions.startLine})`,
	);
}

console.log("PREVIEW_WORKFLOW_OK");
process.exit(0);
