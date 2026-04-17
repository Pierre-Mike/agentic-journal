import { expect, test } from "@playwright/test";

test.describe("404", () => {
	test("unknown post slug returns a 404 (status or rendered body)", async ({ page }) => {
		const response = await page.goto("/posts/does-not-exist");
		// Astro in dev mode returns 404 for unknown dynamic routes without a
		// getStaticPaths match. If the runtime surfaces 200 instead (Cloudflare
		// adapter edge cases), fall back to asserting the page body text.
		const status = response?.status() ?? 0;
		if (status === 404) {
			return;
		}

		const body = await page.locator("body").innerText();
		expect(body).toMatch(/404|not found/i);
	});
});
