/**
 * RSS 2.0 feed for every post in the `posts` content collection. Channel
 * metadata flows from `src/site-config.ts` so it stays in sync with the
 * head metadata rendered by `<SEOHead>`.
 */

import { getCollection } from "astro:content";
import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { SITE_DESCRIPTION, SITE_NAME } from "../site-config";

export async function GET(context: APIContext): Promise<Response> {
	if (context.site === undefined) {
		throw new Error("Astro.site must be configured for RSS feed URLs");
	}
	const posts = await getCollection("posts");
	const sorted = [...posts].sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
	return rss({
		title: SITE_NAME,
		description: SITE_DESCRIPTION,
		site: context.site,
		items: sorted.map((p) => ({
			title: p.data.title,
			description: p.data.summary,
			pubDate: p.data.date,
			link: `/posts/${p.id}/`,
		})),
	});
}
