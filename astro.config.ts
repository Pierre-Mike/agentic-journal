import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

export default defineConfig({
	output: "static",
	adapter: cloudflare({
		imageService: "compile",
	}),
	integrations: [mdx(), sitemap()],
	markdown: {
		shikiConfig: {
			themes: { light: "github-light", dark: "github-dark" },
			defaultColor: false,
		},
	},
	site: "https://agentic-journal-production.pm-lemeliner.workers.dev",
});
