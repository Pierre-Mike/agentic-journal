import { describe, expect, test } from "bun:test";
import { readingTime, WPM } from "./reading-time";

describe("readingTime", () => {
	test("WPM constant is 200", () => {
		expect(WPM).toBe(200);
	});

	test("returns words and minutes for plain prose", () => {
		const text = Array.from({ length: 400 }, () => "word").join(" ");
		const result = readingTime(text);
		expect(result.words).toBe(400);
		expect(result.minutes).toBe(2);
	});

	test("rounds to nearest minute", () => {
		const text250 = Array.from({ length: 250 }, () => "w").join(" ");
		expect(readingTime(text250).minutes).toBe(1);
		const text350 = Array.from({ length: 350 }, () => "w").join(" ");
		expect(readingTime(text350).minutes).toBe(2);
	});

	test("minimum of 1 minute for empty or near-empty input", () => {
		expect(readingTime("").minutes).toBe(1);
		expect(readingTime("hello").minutes).toBe(1);
	});

	test("strips fenced code blocks before counting", () => {
		const text = `one two three\n\n\`\`\`ts\nconst x = 1;\nconst y = 2;\n\`\`\`\n\nfour five`;
		expect(readingTime(text).words).toBe(5);
	});

	test("strips inline code", () => {
		const text = "use the `readingTime` function carefully";
		expect(readingTime(text).words).toBe(4);
	});

	test("strips MDX import/export lines", () => {
		const text = `import Foo from "./Foo";\nexport const x = 1;\n\nactual prose here`;
		expect(readingTime(text).words).toBe(3);
	});

	test("strips JSX tags", () => {
		const text = `hello <Foo bar="baz" /> world <Bar>inner</Bar> end`;
		expect(readingTime(text).words).toBe(4);
	});

	test("reduces markdown links to their label", () => {
		const text = "see [the docs](https://example.com/very/long/path) for more";
		expect(readingTime(text).words).toBe(5);
	});

	test("strips images entirely", () => {
		const text = "before ![alt text](https://example.com/img.png) after";
		expect(readingTime(text).words).toBe(2);
	});

	test("strips raw HTML tags", () => {
		const text = "before <div class='x'>middle</div> after";
		expect(readingTime(text).words).toBe(3);
	});

	test("is deterministic", () => {
		const text = "the quick brown fox jumps over the lazy dog";
		expect(readingTime(text)).toEqual(readingTime(text));
	});
});
