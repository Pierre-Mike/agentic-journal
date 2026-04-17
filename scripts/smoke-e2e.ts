/**
 * Gate for spec 006-e2e-playwright.
 *
 * Thin wrapper: spawns `bunx playwright test` at repo root, pipes stdout/stderr
 * to the parent, propagates the exit code. The smoke IS the wrapper — the
 * assertions live inside the Playwright scenarios under `e2e/`.
 */

async function main(): Promise<void> {
	const proc = Bun.spawn(["bunx", "playwright", "test"], {
		stdout: "inherit",
		stderr: "inherit",
		cwd: process.cwd(),
	});

	const exitCode = await proc.exited;

	if (exitCode === 0) {
		console.log("✓ playwright tests passed");
	} else {
		console.log("✖ playwright tests failed");
	}

	process.exit(exitCode);
}

await main();

export {};
