import { existsSync, readFileSync } from "node:fs";

const WORKFLOW_PATH = ".github/workflows/preview.yml";

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

console.log("PREVIEW_WORKFLOW_OK");
process.exit(0);
