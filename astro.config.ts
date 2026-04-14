import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import { defineConfig } from "astro/config";

export default defineConfig({
	output: "static",
	adapter: cloudflare({
		imageService: "compile",
	}),
	integrations: [mdx()],
	site: "https://agentic-journal.pages.dev",
});
