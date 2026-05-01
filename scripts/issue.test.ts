/**
 * Tests for scripts/issue.ts — the pure issue-body parser/renderer.
 *
 * Step 1 of moving spec content (proposal.md / alignment.md) into a
 * GitHub issue body. No `gh` API yet — these tests cover only the
 * canonical-shape <-> structured-fields round trip.
 */

import { describe, expect, test } from "bun:test";
import { type ParsedBody, parseBody, renderBody } from "./issue.ts";

const FULL_BODY = `## Intent
<!-- user's raw ask, verbatim -->
Move spec content from files into the issue.

## Alignment
**Goal**: Hybrid issue+repo split
**Big picture**: Conversational fields move to the issue, executable contract stays in repo.
**Straightforward details**:
- Issue body holds intent + alignment
- Repo holds design.md, tasks.md, gate sentinels
**Non-obvious decisions**:
- Gate sentinels stay filesystem-based to preserve hook lock semantics
**Confidence**: high
**Kind**: code
**Depends on**: #49, #55

## Approval
- [x] approved

## Timeline
<!-- subagent comments below -->
`;

describe("parseBody — full canonical body", () => {
	const parsed = parseBody(FULL_BODY);

	test("strips comments from intent", () => {
		expect(parsed.intent).toBe("Move spec content from files into the issue.");
	});

	test("extracts alignment singles", () => {
		expect(parsed.alignment?.goal).toBe("Hybrid issue+repo split");
		expect(parsed.alignment?.bigPicture).toBe(
			"Conversational fields move to the issue, executable contract stays in repo.",
		);
	});

	test("extracts alignment bullet lists", () => {
		expect(parsed.alignment?.straightforward).toEqual([
			"Issue body holds intent + alignment",
			"Repo holds design.md, tasks.md, gate sentinels",
		]);
		expect(parsed.alignment?.nonObvious).toEqual([
			"Gate sentinels stay filesystem-based to preserve hook lock semantics",
		]);
	});

	test("parses confidence and kind", () => {
		expect(parsed.alignment?.confidence).toBe("high");
		expect(parsed.alignment?.kind).toBe("code");
	});

	test("parses depends-on as issue numbers", () => {
		expect(parsed.alignment?.dependsOn).toEqual([49, 55]);
	});

	test("detects ticked approval box", () => {
		expect(parsed.approved).toBe(true);
	});
});

describe("parseBody — partial / empty bodies", () => {
	test("empty string → empty intent, null alignment, not approved", () => {
		expect(parseBody("")).toEqual({ intent: "", alignment: null, approved: false });
	});

	test("only intent filled → alignment is null", () => {
		const body = "## Intent\nJust an idea.\n\n## Alignment\n\n## Approval\n- [ ] approved\n";
		const parsed = parseBody(body);
		expect(parsed.intent).toBe("Just an idea.");
		expect(parsed.alignment).toBeNull();
		expect(parsed.approved).toBe(false);
	});

	test("alignment missing required field → null", () => {
		const body = `## Intent
x

## Alignment
**Goal**: y
**Big picture**: z
**Confidence**: high
<!-- kind missing -->

## Approval
- [ ] approved
`;
		expect(parseBody(body).alignment).toBeNull();
	});

	test("invalid kind → null alignment", () => {
		const body = `## Intent
x

## Alignment
**Goal**: y
**Big picture**: z
**Confidence**: high
**Kind**: nonsense

## Approval
- [ ] approved
`;
		expect(parseBody(body).alignment).toBeNull();
	});

	test("approval — capital X also counts", () => {
		const body = "## Approval\n- [X] approved\n";
		expect(parseBody(body).approved).toBe(true);
	});

	test("approval — unticked box", () => {
		const body = "## Approval\n- [ ] approved\n";
		expect(parseBody(body).approved).toBe(false);
	});
});

describe("parseBody — depends-on edge cases", () => {
	const baseAlignment = `## Alignment
**Goal**: g
**Big picture**: bp
**Confidence**: high
**Kind**: code
`;

	test("absent depends-on line → empty array", () => {
		expect(parseBody(baseAlignment).alignment?.dependsOn).toEqual([]);
	});

	test("'none' literal → empty array", () => {
		const body = `${baseAlignment}**Depends on**: none\n`;
		expect(parseBody(body).alignment?.dependsOn).toEqual([]);
	});

	test("multiple references with whitespace", () => {
		const body = `${baseAlignment}**Depends on**: #1 ,  #22, #333\n`;
		expect(parseBody(body).alignment?.dependsOn).toEqual([1, 22, 333]);
	});
});

describe("parseBody — confidence values", () => {
	const make = (conf: string) => `## Alignment
**Goal**: g
**Big picture**: bp
**Confidence**: ${conf}
**Kind**: code
`;

	test("'low' → low", () => {
		expect(parseBody(make("low")).alignment?.confidence).toBe("low");
	});

	test("'High' (mixed case) → high", () => {
		expect(parseBody(make("High")).alignment?.confidence).toBe("high");
	});

	test("anything else defaults to high (template-only field)", () => {
		expect(parseBody(make("medium")).alignment?.confidence).toBe("high");
	});
});

describe("renderBody / round-trip", () => {
	test("parse(render(parse(x))) === parse(x) for full body", () => {
		const once = parseBody(FULL_BODY);
		const twice = parseBody(renderBody(once));
		expect(twice).toEqual(once);
	});

	test("renders unticked approval when approved=false", () => {
		const out = renderBody({
			intent: "x",
			alignment: null,
			approved: false,
		});
		expect(out).toContain("- [ ] approved");
		expect(out).not.toContain("- [x] approved");
	});

	test("renders ticked approval when approved=true", () => {
		const out = renderBody({
			intent: "x",
			alignment: null,
			approved: true,
		});
		expect(out).toContain("- [x] approved");
	});

	test("omits Depends on line when dependsOn is empty", () => {
		const parsed: ParsedBody = {
			intent: "x",
			alignment: {
				goal: "g",
				bigPicture: "bp",
				straightforward: [],
				nonObvious: [],
				confidence: "high",
				kind: "code",
				dependsOn: [],
			},
			approved: false,
		};
		const out = renderBody(parsed);
		expect(out).not.toContain("Depends on");
	});

	test("includes Depends on line when dependsOn is non-empty", () => {
		const parsed: ParsedBody = {
			intent: "x",
			alignment: {
				goal: "g",
				bigPicture: "bp",
				straightforward: [],
				nonObvious: [],
				confidence: "high",
				kind: "code",
				dependsOn: [12, 34],
			},
			approved: false,
		};
		const out = renderBody(parsed);
		expect(out).toContain("**Depends on**: #12, #34");
	});

	test("ends with single trailing newline", () => {
		const out = renderBody({ intent: "x", alignment: null, approved: false });
		expect(out.endsWith("\n")).toBe(true);
		expect(out.endsWith("\n\n")).toBe(false);
	});
});

// gh-backed API tests
// ---------------------------------------------------------------------------

import type { Process } from "./_lib.ts";
import {
	addLabel,
	comment,
	issueNumberFromSpecDir,
	listByLabel,
	listReady,
	loadIssue,
	removeLabel,
	setLifecycle,
	specDirForIssue,
} from "./issue.ts";

interface CmdRecord {
	readonly cmd: readonly string[];
	readonly result: { ok: boolean; stdout: string };
}

function makeMockProcess(results: Array<{ ok: boolean; stdout: string }>): {
	process: Process;
	calls: CmdRecord[];
} {
	const calls: CmdRecord[] = [];
	let callIndex = 0;

	const process: Process = {
		async run(cmd) {
			const result = results[callIndex] ?? { ok: true, stdout: "" };
			callIndex += 1;
			calls.push({ cmd, result });
			return result;
		},
	};

	return { process, calls };
}

const MOCK_ISSUE_JSON = {
	number: 42,
	title: "Test issue",
	body: `## Intent
Move spec to issue.

## Alignment
**Goal**: g
**Big picture**: bp
**Straightforward details**:
- detail 1
**Non-obvious decisions**:
- decision 1
**Confidence**: high
**Kind**: code

## Approval
- [x] approved

## Timeline
`,
	labels: [{ name: "alignment:approved" }, { name: "kind:code" }],
};

describe("loadIssue", () => {
	test("happy path — returns IssueSpec with parsed body and lifecycle", async () => {
		const { process } = makeMockProcess([{ ok: true, stdout: JSON.stringify(MOCK_ISSUE_JSON) }]);

		const spec = await loadIssue(42, process);

		expect(spec.number).toBe(42);
		expect(spec.title).toBe("Test issue");
		expect(spec.body).toContain("## Intent");
		expect(spec.parsed.intent).toBe("Move spec to issue.");
		expect(spec.parsed.approved).toBe(true);
		expect(spec.labels).toContain("alignment:approved");
		expect(spec.labels).toContain("kind:code");
		expect(spec.lifecycle).toBe("alignment:approved");
	});

	test("no lifecycle label → lifecycle: null", async () => {
		const noLifecycle = {
			...MOCK_ISSUE_JSON,
			labels: [{ name: "kind:code" }],
		};
		const { process } = makeMockProcess([{ ok: true, stdout: JSON.stringify(noLifecycle) }]);

		const spec = await loadIssue(42, process);

		expect(spec.lifecycle).toBeNull();
	});

	test("multiple lifecycle labels → picks first in LIFECYCLE_LABELS order", async () => {
		const multiLifecycle = {
			...MOCK_ISSUE_JSON,
			labels: [{ name: "alignment:approved" }, { name: "intent:captured" }],
		};
		const { process } = makeMockProcess([{ ok: true, stdout: JSON.stringify(multiLifecycle) }]);

		const spec = await loadIssue(42, process);

		// intent:captured comes first in LIFECYCLE_LABELS declaration
		expect(spec.lifecycle).toBe("intent:captured");
	});

	test("non-zero exit → throws with issue number in message", async () => {
		const { process } = makeMockProcess([{ ok: false, stdout: "GraphQL: Issue not found" }]);

		await expect(loadIssue(99, process)).rejects.toThrow("99");
	});

	test("repo option appends --repo flag", async () => {
		const { process, calls } = makeMockProcess([
			{ ok: true, stdout: JSON.stringify(MOCK_ISSUE_JSON) },
		]);

		await loadIssue(42, process, { repo: "owner/repo" });

		expect(calls[0]?.cmd).toContain("--repo");
		expect(calls[0]?.cmd).toContain("owner/repo");
	});
});

describe("listByLabel", () => {
	test("returns array with correct length and parsed bodies", async () => {
		const listJson = [
			MOCK_ISSUE_JSON,
			{
				number: 43,
				title: "Another issue",
				body: "## Intent\nAnother intent.\n",
				labels: [{ name: "ready:dispatch" }],
			},
		];
		const { process } = makeMockProcess([{ ok: true, stdout: JSON.stringify(listJson) }]);

		const specs = await listByLabel("ready:dispatch", process);

		expect(specs).toHaveLength(2);
		expect(specs[0]?.number).toBe(42);
		expect(specs[0]?.parsed.intent).toBe("Move spec to issue.");
		expect(specs[1]?.number).toBe(43);
		expect(specs[1]?.parsed.intent).toBe("Another intent.");
	});

	test("state: 'all' includes --state all in cmd", async () => {
		const { process, calls } = makeMockProcess([{ ok: true, stdout: JSON.stringify([]) }]);

		await listByLabel("done", process, { state: "all" });

		expect(calls[0]?.cmd).toContain("--state");
		expect(calls[0]?.cmd).toContain("all");
	});

	test("default state is 'open'", async () => {
		const { process, calls } = makeMockProcess([{ ok: true, stdout: JSON.stringify([]) }]);

		await listByLabel("done", process);

		expect(calls[0]?.cmd).toContain("--state");
		expect(calls[0]?.cmd).toContain("open");
	});

	test("repo option appends --repo flag", async () => {
		const { process, calls } = makeMockProcess([{ ok: true, stdout: JSON.stringify([]) }]);

		await listByLabel("done", process, { repo: "owner/repo" });

		expect(calls[0]?.cmd).toContain("--repo");
		expect(calls[0]?.cmd).toContain("owner/repo");
	});
});

describe("listReady", () => {
	test("calls listByLabel with ready:dispatch", async () => {
		const { process, calls } = makeMockProcess([{ ok: true, stdout: JSON.stringify([]) }]);

		await listReady(process);

		expect(calls[0]?.cmd).toContain("--label");
		expect(calls[0]?.cmd).toContain("ready:dispatch");
	});

	test("forwards repo option", async () => {
		const { process, calls } = makeMockProcess([{ ok: true, stdout: JSON.stringify([]) }]);

		await listReady(process, { repo: "owner/repo" });

		expect(calls[0]?.cmd).toContain("--repo");
		expect(calls[0]?.cmd).toContain("owner/repo");
	});
});

describe("addLabel", () => {
	test("cmd shape includes --add-label", async () => {
		const { process, calls } = makeMockProcess([{ ok: true, stdout: "" }]);

		await addLabel(42, "needs:human", process);

		expect(calls[0]?.cmd).toEqual(["gh", "issue", "edit", "42", "--add-label", "needs:human"]);
	});

	test("repo option appends --repo flag", async () => {
		const { process, calls } = makeMockProcess([{ ok: true, stdout: "" }]);

		await addLabel(42, "needs:human", process, { repo: "owner/repo" });

		expect(calls[0]?.cmd).toContain("--repo");
		expect(calls[0]?.cmd).toContain("owner/repo");
	});

	test("non-zero exit → throws with issue number and label", async () => {
		const { process } = makeMockProcess([{ ok: false, stdout: "Label does not exist" }]);

		const error = addLabel(42, "bad-label", process);
		await expect(error).rejects.toThrow("42");
		await expect(error).rejects.toThrow("bad-label");
	});
});

describe("removeLabel", () => {
	test("cmd shape includes --remove-label", async () => {
		const { process, calls } = makeMockProcess([{ ok: true, stdout: "" }]);

		await removeLabel(42, "intent:captured", process);

		expect(calls[0]?.cmd).toEqual([
			"gh",
			"issue",
			"edit",
			"42",
			"--remove-label",
			"intent:captured",
		]);
	});

	test("repo option appends --repo flag", async () => {
		const { process, calls } = makeMockProcess([{ ok: true, stdout: "" }]);

		await removeLabel(42, "intent:captured", process, { repo: "owner/repo" });

		expect(calls[0]?.cmd).toContain("--repo");
		expect(calls[0]?.cmd).toContain("owner/repo");
	});
});

describe("setLifecycle", () => {
	test("no current label → only addLabel call, no removeLabel", async () => {
		const { process, calls } = makeMockProcess([{ ok: true, stdout: "" }]);

		await setLifecycle(42, "intent:captured", process, { current: [] });

		expect(calls).toHaveLength(1);
		expect(calls[0]?.cmd).toContain("--add-label");
		expect(calls[0]?.cmd).toContain("intent:captured");
	});

	test("current=alignment:proposed → next=alignment:approved: addLabel then removeLabel", async () => {
		const { process, calls } = makeMockProcess([
			{ ok: true, stdout: "" },
			{ ok: true, stdout: "" },
		]);

		await setLifecycle(42, "alignment:approved", process, {
			current: ["alignment:proposed", "kind:code"],
		});

		expect(calls).toHaveLength(2);
		expect(calls[0]?.cmd).toContain("--add-label");
		expect(calls[0]?.cmd).toContain("alignment:approved");
		expect(calls[1]?.cmd).toContain("--remove-label");
		expect(calls[1]?.cmd).toContain("alignment:proposed");
	});

	test("next === current → no calls", async () => {
		const { process, calls } = makeMockProcess([]);

		await setLifecycle(42, "ready:dispatch", process, {
			current: ["ready:dispatch", "kind:code"],
		});

		expect(calls).toHaveLength(0);
	});

	test("without current option → calls loadIssue first", async () => {
		const { process, calls } = makeMockProcess([
			{ ok: true, stdout: JSON.stringify(MOCK_ISSUE_JSON) },
			{ ok: true, stdout: "" },
			{ ok: true, stdout: "" },
		]);

		await setLifecycle(42, "ready:dispatch", process);

		expect(calls).toHaveLength(3);
		expect(calls[0]?.cmd[0]).toBe("gh");
		expect(calls[0]?.cmd[1]).toBe("issue");
		expect(calls[0]?.cmd[2]).toBe("view");
		expect(calls[1]?.cmd).toContain("--add-label");
		expect(calls[2]?.cmd).toContain("--remove-label");
	});

	test("repo option forwarded to addLabel and removeLabel", async () => {
		const { process, calls } = makeMockProcess([
			{ ok: true, stdout: "" },
			{ ok: true, stdout: "" },
		]);

		await setLifecycle(42, "done", process, {
			repo: "owner/repo",
			current: ["ready:dispatch"],
		});

		expect(calls[0]?.cmd).toContain("--repo");
		expect(calls[0]?.cmd).toContain("owner/repo");
		expect(calls[1]?.cmd).toContain("--repo");
		expect(calls[1]?.cmd).toContain("owner/repo");
	});
});

describe("comment", () => {
	test("cmd shape includes --body", async () => {
		const { process, calls } = makeMockProcess([{ ok: true, stdout: "" }]);

		await comment(42, "Test comment", process);

		expect(calls[0]?.cmd).toEqual(["gh", "issue", "comment", "42", "--body", "Test comment"]);
	});

	test("repo option appends --repo flag", async () => {
		const { process, calls } = makeMockProcess([{ ok: true, stdout: "" }]);

		await comment(42, "Test comment", process, { repo: "owner/repo" });

		expect(calls[0]?.cmd).toContain("--repo");
		expect(calls[0]?.cmd).toContain("owner/repo");
	});

	test("non-zero exit → throws with issue number", async () => {
		const { process } = makeMockProcess([{ ok: false, stdout: "Permission denied" }]);

		await expect(comment(42, "Test", process)).rejects.toThrow("42");
	});
});

// Pure path helpers
// ---------------------------------------------------------------------------

describe("specDirForIssue", () => {
	test("returns correct path format", () => {
		expect(specDirForIssue(49, "foo-bar")).toBe("specs/active/49-foo-bar");
	});

	test("preserves slug exactly", () => {
		expect(specDirForIssue(123, "complex-slug-with-dashes")).toBe(
			"specs/active/123-complex-slug-with-dashes",
		);
	});
});

describe("issueNumberFromSpecDir", () => {
	test("extracts number from valid spec dir", () => {
		expect(issueNumberFromSpecDir("specs/active/49-foo")).toBe(49);
	});

	test("handles multi-digit numbers", () => {
		expect(issueNumberFromSpecDir("specs/active/1234-bar-baz")).toBe(1234);
	});

	test("returns null for dir without leading number", () => {
		expect(issueNumberFromSpecDir("specs/active/foo-bar")).toBeNull();
	});

	test("handles trailing slash", () => {
		expect(issueNumberFromSpecDir("specs/active/49-foo/")).toBe(49);
	});

	test("handles absolute paths", () => {
		expect(issueNumberFromSpecDir("/abs/path/to/specs/active/49-foo")).toBe(49);
	});

	test("returns null for empty string", () => {
		expect(issueNumberFromSpecDir("")).toBeNull();
	});

	test("round-trip: issueNumberFromSpecDir(specDirForIssue(N, x)) === N", () => {
		const n = 42;
		const slug = "test-slug";
		const dir = specDirForIssue(n, slug);
		expect(issueNumberFromSpecDir(dir)).toBe(n);
	});
});
