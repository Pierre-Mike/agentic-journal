import { expect, test } from "@playwright/test";
import { getFirstPostLink } from "./fixtures";

test.describe("post page", () => {
	test("first post link routes to /posts/:slug and renders body + meta", async ({ page }) => {
		await page.goto("/");
		const link = getFirstPostLink(page);
		await expect(link).toBeVisible();
		await link.click();

		await expect(page).toHaveURL(/\/posts\/[^/]+\/?$/);

		// Article body rendered
		const article = page.locator("article");
		await expect(article).toBeVisible();
		await expect(article.locator("h1")).toBeVisible();

		// No raw MDX leakage
		const bodyText = await page.locator("body").innerText();
		expect(bodyText).not.toMatch(/^---\s*$/m);
		expect(bodyText).not.toMatch(/^import\s+\w+\s+from\s+["']/m);

		// Meta line contains reading-time (from spec 001) and spec_id reference
		await expect(article).toContainText(/min read/i);
		await expect(article).toContainText(/spec /i);
	});
});
