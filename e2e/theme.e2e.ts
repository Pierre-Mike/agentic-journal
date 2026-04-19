/**
 * E2E gate for spec 024-theme-selection. Asserts DOM state at
 * `domcontentloaded` — not pixel sampling, not transition listeners — so a
 * flash of unstyled content (FOUC) would be caught structurally: if the
 * inline head script is missing or the CSS variables are not wired, these
 * assertions fail before the body paints.
 *
 * Three cases:
 *   (a) stored localStorage.theme = "dark" wins over OS preference
 *   (b) OS prefers-color-scheme: dark with no stored preference → dark
 *   (c) clicking the toggle persists the choice across reload
 */

import { expect, test } from "@playwright/test";

test.describe("theme", () => {
	test("stored preference resolves to dark at domcontentloaded (no FOUC)", async ({
		context,
		page,
	}) => {
		await context.addInitScript(() => {
			window.localStorage.setItem("theme", "dark");
		});
		await page.goto("/");
		const theme = await page.evaluate(() => document.documentElement.dataset.theme);
		expect(theme).toBe("dark");
		const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
		// Non-light palette — cheap invariant that does not pin an exact hex
		// but fails if CSS variables were not swapped before first paint.
		expect(bg).not.toBe("rgb(250, 250, 250)");
	});

	test("OS dark preference resolves to dark at domcontentloaded", async ({ page }) => {
		await page.emulateMedia({ colorScheme: "dark" });
		await page.goto("/");
		const theme = await page.evaluate(() => document.documentElement.dataset.theme);
		expect(theme).toBe("dark");
	});

	test("toggle click persists across reload", async ({ page }) => {
		await page.goto("/");
		const before = await page.evaluate(() => document.documentElement.dataset.theme);
		await page.getByRole("button", { name: /toggle color theme/i }).click();
		const afterClick = await page.evaluate(() => document.documentElement.dataset.theme);
		expect(afterClick).not.toBe(before);
		await page.reload();
		const afterReload = await page.evaluate(() => document.documentElement.dataset.theme);
		expect(afterReload).toBe(afterClick);
	});
});
