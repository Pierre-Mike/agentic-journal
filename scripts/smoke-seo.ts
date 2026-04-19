/**
 * Gate for spec 022-seo-baseline.
 *
 * Builds the site (with mtime short-circuit) and asserts that the rendered
 * HTML, sitemap, and RSS feed contain the SEO surface every post must expose
 * to crawlers and social previews:
 *   - canonical link
 *   - OpenGraph (og:title, og:description)
 *   - Twitter card
 *   - JSON-LD Article schema
 *   - dist/sitemap-index.xml exists and is non-empty
 *   - dist/rss.xml exists, is non-empty, declares RSS 2.0
 *
 * Exits 0 on green with `SEO_OK`, 1 on any missing tag/file with a diagnostic.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist";
const POSTS_DIR = join(DIST, "posts");
const SITEMAP = join(DIST, "sitemap-index.xml");
const RSS = join(DIST, "rss.xml");

function fail(msg: string): never {
	console.error(`smoke-seo: FAIL ${msg}`);
	process.exit(1);
}

function newestMtime(path: string): number {
	const stat = statSync(path);
	if (!stat.isDirectory()) return stat.mtimeMs;
	let newest = stat.mtimeMs;
	for (const entry of readdirSync(path, { withFileTypes: true })) {
		const child = join(path, entry.name);
		const childMtime = entry.isDirectory() ? newestMtime(child) : statSync(child).mtimeMs;
		if (childMtime > newest) newest = childMtime;
	}
	return newest;
}

function needsBuild(): boolean {
	if (!existsSync(DIST)) return true;
	const distMtime = newestMtime(DIST);
	for (const path of ["src", "content", "astro.config.ts", "astro.config.mjs", "package.json"]) {
		if (!existsSync(path)) continue;
		const sourceMtime = newestMtime(path);
		if (sourceMtime > distMtime) return true;
	}
	return false;
}

if (needsBuild()) {
	console.log("smoke-seo: running bun run build...");
	const proc = spawnSync("bun", ["run", "build"], { stdio: "inherit" });
	if (proc.status !== 0) fail("bun run build failed");
} else {
	console.log("smoke-seo: dist/ is fresh — skipping build");
}

if (!existsSync(SITEMAP)) fail(`MISSING ${SITEMAP}`);
if (statSync(SITEMAP).size === 0) fail(`EMPTY ${SITEMAP}`);

if (!existsSync(RSS)) fail(`MISSING ${RSS}`);
const rssContent = readFileSync(RSS, "utf8");
if (!rssContent.includes('<rss version="2.0"')) fail(`${RSS} not RSS 2.0`);

if (!existsSync(POSTS_DIR)) fail(`MISSING ${POSTS_DIR} — no posts built?`);
const postSlugs = readdirSync(POSTS_DIR).filter((d) =>
	existsSync(join(POSTS_DIR, d, "index.html")),
);
if (postSlugs.length === 0) fail(`No post HTML found under ${POSTS_DIR}`);

const sample = postSlugs[0];
if (sample === undefined) fail(`No post HTML found under ${POSTS_DIR}`);
const html = readFileSync(join(POSTS_DIR, sample, "index.html"), "utf8");

const required: ReadonlyArray<{ readonly needle: string; readonly what: string }> = [
	{ needle: '<link rel="canonical"', what: "canonical link" },
	{ needle: 'property="og:title"', what: "og:title meta" },
	{ needle: 'property="og:description"', what: "og:description meta" },
	{ needle: 'name="twitter:card"', what: "twitter:card meta" },
	{ needle: '"@type":"Article"', what: "JSON-LD Article schema" },
];

for (const { needle, what } of required) {
	if (!html.includes(needle))
		fail(`MISSING ${what} in dist/posts/${sample}/index.html (looked for: ${needle})`);
}

console.log("SEO_OK");
process.exit(0);
