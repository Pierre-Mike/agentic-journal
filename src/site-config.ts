/**
 * Site-level constants — single source of truth for SEO surface and feed
 * metadata. Both `src/components/SEOHead.astro` and `src/pages/rss.xml.ts`
 * read from here, so frontmatter and channel-level fields never desync.
 */

export const SITE_NAME = "agentic-journal";
export const SITE_DESCRIPTION =
	"Notes from an agentic engineering journey. Every post is a spec. The repo is the proof.";
export const AUTHOR_NAME = "Pierre-Mikel";
