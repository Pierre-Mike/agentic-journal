#!/usr/bin/env bun
// Smoke gate for spec 041: asserts CI integrity fixes are in place.
// Exits 0 only when all four assertions pass.

import { readFileSync } from "node:fs";

const failures: string[] = [];

function assertContains(path: string, needle: string | RegExp, label: string) {
	const text = readFileSync(path, "utf8");
	const ok = typeof needle === "string" ? text.includes(needle) : needle.test(text);
	if (!ok) failures.push(`${label}: missing in ${path}`);
}

function assertNotContains(path: string, needle: string | RegExp, label: string) {
	const text = readFileSync(path, "utf8");
	const ok = typeof needle === "string" ? text.includes(needle) : needle.test(text);
	if (ok) failures.push(`${label}: still present in ${path}`);
}

// Fix 1: ci.yml runs unit tests in the check job
assertContains(".github/workflows/ci.yml", /bun run test\b/, "ci.yml runs unit tests");

// Fix 2: deploy.yml has a check job and deploy needs it
assertContains(
	".github/workflows/deploy.yml",
	/needs:\s*\[?\s*check\s*\]?/,
	"deploy gates on check",
);
assertContains(
	".github/workflows/deploy.yml",
	/\bcheck:\s*\n\s+runs-on:/,
	"deploy.yml defines a check job",
);

// Fix 3: bun-version pinned (no `latest` anywhere)
for (const wf of ["ci.yml", "deploy.yml", "preview.yml", "on-spec.yml"]) {
	assertNotContains(`.github/workflows/${wf}`, /bun-version:\s*latest/, `${wf} pins bun-version`);
}

// Fix 4: playwright e2e runs against built artifact
assertContains("playwright.config.ts", /bun run build/, "playwright builds before serving");
assertContains("playwright.config.ts", /bun run preview/, "playwright serves built artifact");

if (failures.length > 0) {
	console.error("smoke-ci-gates: FAIL");
	for (const f of failures) console.error(`  - ${f}`);
	process.exit(1);
}
console.log("smoke-ci-gates: PASS");
