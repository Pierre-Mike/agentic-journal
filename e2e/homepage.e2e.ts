import { expect, test } from "@playwright/test";
import { getAllPostLinks } from "./fixtures";

test.describe("homepage", () => {
	test("renders the blog title in an h1", async ({ page }) => {
		await page.goto("/");
		const heading = page.getByRole("heading", { level: 1, name: /agentic-journal/i });
		await expect(heading).toBeVisible();
	});

	test("shows at least one post with title, date, and spec reference", async ({ page }) => {
		await page.goto("/");
		const postLinks = getAllPostLinks(page);
		await expect(postLinks.first()).toBeVisible();
		const count = await postLinks.count();
		expect(count).toBeGreaterThan(0);

		// Each <li> contains the link + a <small> with "YYYY-MM-DD · spec …"
		const firstItem = page.locator("li").filter({ has: postLinks.first() }).first();
		await expect(firstItem).toContainText(/\d{4}-\d{2}-\d{2}/);
		await expect(firstItem).toContainText(/spec /i);
	});
});
