/**
 * Gate for spec 020-deploy-env-fix.
 *
 * Pure file read + regex; no network, no spawn, no LLM. Asserts that the
 * "Deploy to Cloudflare" step in `.github/workflows/deploy.yml` carries a
 * step-level `env:` block exposing both Cloudflare secrets to wrangler's
 * process environment — required because wrangler in non-interactive mode
 * does NOT read action `with:` inputs as env vars.
 *
 * Mirrors the shape of `scripts/smoke-preview-workflow.ts` (spec 019).
 * Duplication is deliberate — rule of three before extraction.
 */

import { existsSync, readFileSync } from "node:fs";

const WORKFLOW_PATH = ".github/workflows/deploy.yml";
const STEP_NAME = "Deploy to Cloudflare";

interface StepBlock {
	readonly text: string;
	readonly startLine: number;
}

function findStepBlock(content: string, stepName: string): StepBlock | null {
	const lines = content.split("\n");
	const startIdx = lines.findIndex((l) => new RegExp(`-\\s*name:\\s*${stepName}`).test(l));
	if (startIdx < 0) return null;
	let endIdx = lines.length;
	for (let i = startIdx + 1; i < lines.length; i++) {
		const line = lines[i];
		if (line !== undefined && /^\s*-\s*name:\s*/.test(line)) {
			endIdx = i;
			break;
		}
	}
	return { text: lines.slice(startIdx, endIdx).join("\n"), startLine: startIdx + 1 };
}

function fail(msg: string): never {
	console.error(`smoke-deploy-workflow: FAIL ${msg}`);
	process.exit(1);
}

if (!existsSync(WORKFLOW_PATH)) fail(`MISSING: ${WORKFLOW_PATH}`);

const content = readFileSync(WORKFLOW_PATH, "utf8");
const step = findStepBlock(content, STEP_NAME);
if (step === null) fail(`MISSING: '${STEP_NAME}' step in ${WORKFLOW_PATH}`);

const requiredEnvLines: readonly string[] = [
	"CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}",
	"CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}",
];
for (const needle of requiredEnvLines) {
	if (!step.text.includes(needle)) {
		fail(`MISSING env entry: ${needle} ('${STEP_NAME}' step starts at L${step.startLine})`);
	}
}

console.log("DEPLOY_WORKFLOW_OK");
process.exit(0);
