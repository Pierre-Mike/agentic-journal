import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const posts = defineCollection({
	loader: glob({ pattern: "**/*.mdx", base: "./content/posts" }),
	schema: z.object({
		title: z.string(),
		date: z.coerce.date(),
		spec_id: z.string(),
		summary: z.string(),
		tags: z.array(z.string()).default([]),
		required_sections: z.array(z.string()).default(["Intent"]),
	}),
});

export const collections = { posts };
