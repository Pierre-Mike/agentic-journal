import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE_YAML_WITH_DEPLOY = `name: Preview (PR)
on:
  pull_request:
    types: [opened, synchronize, reopened]
jobs:
  preview:
    runs-on: ubuntu-latest
    steps:
      - name: Preview deploy
        id: deploy
        uses: cloudflare/wrangler-action@v3
        env:
          CLOUDFLARE_API_TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: \${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        with:
          apiToken: \${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: \${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: versions upload --env="" --preview-alias pr-1
`;

const PERMISSIONS_BLOCK = `permissions:
  contents: read
  pull-requests: write
`;

function runGate(path: string): { exitCode: number | null } {
	const result = Bun.spawnSync(["bun", "scripts/smoke/smoke-preview-workflow.ts"], {
		env: { ...process.env, PREVIEW_WORKFLOW_PATH: path },
	});
	return { exitCode: result.exitCode };
}

test("gate exits 1 when permissions block missing", () => {
	const dir = mkdtempSync(join(tmpdir(), "smoke-preview-"));
	const file = join(dir, "preview.yml");
	writeFileSync(file, BASE_YAML_WITH_DEPLOY);
	const result = runGate(file);
	expect(result.exitCode).toBe(1);
});

test("gate exits 0 when permissions block present with pull-requests: write", () => {
	const dir = mkdtempSync(join(tmpdir(), "smoke-preview-"));
	const file = join(dir, "preview.yml");
	const good = BASE_YAML_WITH_DEPLOY.replace("jobs:", `${PERMISSIONS_BLOCK}jobs:`);
	writeFileSync(file, good);
	const result = runGate(file);
	expect(result.exitCode).toBe(0);
});
