export const WPM = 200;

const FENCED_CODE = /```[\s\S]*?```/g;
const MDX_IMPORT_EXPORT = /^\s*(?:import|export)\b.*$/gm;
const IMAGE = /!\[[^\]]*\]\([^)]*\)/g;
const MARKDOWN_LINK = /\[([^\]]*)\]\([^)]*\)/g;
const TAG = /<\/?[A-Za-z][^>]*>/g;
const INLINE_CODE = /`[^`]*`/g;

export function readingTime(text: string): { minutes: number; words: number } {
	const stripped = text
		.replace(FENCED_CODE, " ")
		.replace(MDX_IMPORT_EXPORT, " ")
		.replace(IMAGE, " ")
		.replace(MARKDOWN_LINK, "$1")
		.replace(TAG, " ")
		.replace(INLINE_CODE, " ");

	const words = stripped.split(/\s+/).filter((w) => w.length > 0).length;
	const minutes = Math.max(1, Math.round(words / WPM));
	return { minutes, words };
}
