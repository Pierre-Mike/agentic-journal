/**
 * Shared e2e helpers. Keep tests decoupled from markup: if the homepage list
 * shape changes, adjust here — the scenarios stay stable.
 */

import type { Locator, Page } from "@playwright/test";

/** First post link on the homepage. Matches `<li><a href="/posts/...">…</a></li>`. */
export function getFirstPostLink(page: Page): Locator {
	return page.locator('a[href^="/posts/"]').first();
}

/** All post links on the homepage. */
export function getAllPostLinks(page: Page): Locator {
	return page.locator('a[href^="/posts/"]');
}
