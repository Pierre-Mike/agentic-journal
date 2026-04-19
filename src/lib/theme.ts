/**
 * Pure theme-resolution primitives. Kept framework-agnostic so the same
 * truth table that drives the inline head script (duplicated in
 * `BaseLayout.astro` because it must run before any module loads) is
 * unit-testable here without DOM coupling.
 *
 * Resolution order for `resolveTheme`:
 *   1. Stored preference of exactly "light" or "dark" wins.
 *   2. Else, the `prefers-color-scheme: dark` signal picks dark.
 *   3. Else, fall back to "light" (matches the CSS `:root` ship default).
 *
 * Both functions return the narrowed literal union `"light" | "dark"` so
 * callers never have to re-narrow downstream.
 */

export type Theme = "light" | "dark";

export function resolveTheme(stored: string | null, prefersDark: boolean): Theme {
	if (stored === "light" || stored === "dark") return stored;
	return prefersDark ? "dark" : "light";
}

export function nextTheme(current: Theme): Theme {
	return current === "light" ? "dark" : "light";
}
