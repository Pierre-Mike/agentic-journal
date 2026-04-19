import { expect, test } from "bun:test";
import { nextTheme, resolveTheme } from "./theme";

test("resolveTheme: stored preference wins over OS signal", () => {
	expect(resolveTheme("light", true)).toBe("light");
	expect(resolveTheme("dark", false)).toBe("dark");
});

test("resolveTheme: OS signal used when no stored preference", () => {
	expect(resolveTheme(null, true)).toBe("dark");
	expect(resolveTheme(null, false)).toBe("light");
});

test("resolveTheme: last-resort default is light (null stored, no dark OS)", () => {
	expect(resolveTheme(null, false)).toBe("light");
});

test("resolveTheme: malformed stored value falls back to OS", () => {
	// Narrowing: anything that is not exactly "light" or "dark" is treated as
	// absent. This protects against stale or corrupt localStorage values.
	expect(resolveTheme("weird", true)).toBe("dark");
	expect(resolveTheme("weird", false)).toBe("light");
	expect(resolveTheme("", true)).toBe("dark");
});

test("nextTheme: flips between light and dark", () => {
	expect(nextTheme("light")).toBe("dark");
	expect(nextTheme("dark")).toBe("light");
});
