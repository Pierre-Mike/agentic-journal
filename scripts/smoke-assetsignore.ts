import { existsSync, readFileSync } from "node:fs";

const ASSETSIGNORE_PATH = "public/.assetsignore";
const EXPECTED_CONTENT = "_worker.js\n_worker.js/**\n";

function fail(msg: string): never {
	console.error(`smoke-assetsignore: FAIL ${msg}`);
	process.exit(1);
}

if (!existsSync(ASSETSIGNORE_PATH)) {
	fail(`MISSING: ${ASSETSIGNORE_PATH}`);
}

const actual = readFileSync(ASSETSIGNORE_PATH, "utf8");
if (actual !== EXPECTED_CONTENT) {
	const visible = (s: string): string => JSON.stringify(s);
	fail(
		`WRONG CONTENT in ${ASSETSIGNORE_PATH}: expected ${visible(EXPECTED_CONTENT)}, got ${visible(actual)}`,
	);
}

console.log("ASSETSIGNORE_OK");
process.exit(0);
