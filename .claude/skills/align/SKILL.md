---
name: align
description: >
  Presents a proposed approach in progressive confirmable chunks with recommended decisions and
  alternatives before implementation begins. Use when aligning on a design, plan, or technical
  approach: (1) designing a new feature or system from scratch, (2) refactoring a module with
  multiple valid approaches, (3) planning a migration where key decisions carry long-term cost,
  (4) any task where a wrong assumption discovered mid-implementation is expensive, or (5) when
  the user invokes align with a file or folder as context. The skill enforces a strict zoom-in
  flow — Goal → Big Picture → Straightforward Details → Non-obvious Decisions — confirming at
  each level before descending, so divergence is found while changes are free.
---

STARTER_CHARACTER = 🎯

## Core Principle

Propose, don't ask. Think first, then present your thinking for confirmation. The user's job is to spot where your understanding diverges from theirs, not to generate the approach.

## Conditional Research

Before presenting the Big Picture (after Goal is confirmed), and before re-presenting a corrected section when the correction introduces unfamiliar territory, assess whether online research would materially improve the proposal.

**Research when** the topic involves:
- Choosing between architectural patterns, protocols, or algorithms you are not deeply certain about (e.g., CRDTs vs OT, event sourcing vs CQRS)
- Integrating with external APIs, services, or platforms whose constraints matter (rate limits, auth flows, SDK quirks)
- Selecting between competing libraries or frameworks for a core role
- Any domain where concrete, current data (benchmarks, compatibility, deprecation status) would change the recommendation

**Skip research when** the topic is:
- A purely internal refactoring, reorganization, or cleanup within the existing codebase
- Decisions fully determined by the codebase's own conventions and constraints
- Well-understood patterns you can confidently recommend without external validation

**How to research:** Use web search, GitHub search, or both. Keep it focused — 1-3 targeted queries, not an exhaustive survey. Then explicitly tell the user what you found before proceeding:

> 🔍 I looked into [topic] before proposing the big picture. Key findings: [1-3 bullet points of what you learned that shapes the proposal].

Then proceed with the big picture (or corrected section) informed by what you found. The research is a brief interlude, not a separate phase — it should feel like a well-prepared colleague who did their homework, not a literature review.

---

## Flow — Zoom In

Confirm at each level before descending. Never present level N+1 content while waiting for level N confirmation.

```
Goal → Big Picture → Straightforward Details → Non-obvious Decisions
```

---

### 1. Goal

State what you understand the goal to be and why it matters. One or two sentences maximum.

**The first response contains the goal statement and nothing else** — no architecture, no diagrams, no decisions. State the purpose and outcome the system must achieve, not the components it contains. If the user provided a detailed brief with architecture, worker types, retry strategies, or technical specifics already described, extract the underlying business goal from it — do not repeat those details back. The goal should be expressible as: "The system must [outcome] so that [reason]." The components and strategies come later.

Confirm with two options before proceeding:

```
1. ✅ Yes, move to big picture
2. ✏️ Type a correction
```

---

### 2. Big Picture

Present the overall shape of the approach: how the pieces relate, what the high-level flow is. A few sentences and an ASCII diagram. Not a page.

Confirm with two options before proceeding.

---

### 3. Straightforward Details

Decisions where there is one clear reasonable approach — no real alternatives worth surfacing.

Group items by topic. **Each group must be anchored with an ASCII diagram before listing its items** — not just for file structures, but for any group: roles and responsibilities, control flow, component relationships. The diagram makes the group scannable. Present one group, confirm, move to the next.

Each item: one line stating the decided approach. Omit the "why" — it's obvious.

---

### 4. Non-obvious Decisions

Decisions with real tradeoffs where your recommendation might not be obvious.

**Step 1 — Show the index, then immediately present the first decision.** Open the non-obvious decisions section with a brief title-only index (no recommendations, no analysis), then immediately present the first decision in full in the same response — no separate confirmation between the index and the first item:

```
Here's what's coming:
1. [Problem title]     ← just titles, no analysis
2. [Problem title]
3. [Problem title]

--- Decision 1: [Problem title] ---
[Full ⭐/❌ treatment]

1. ✅ Accept and move to decision 2
2. ✏️ Type a correction
```

The index gives scope. The first decision gives immediate forward motion. The confirmation comes after the first decision, not after the index.

**Step 2 — Present one decision at a time for decisions 2+.** For each subsequent decision (or a small tightly related group):

- **The problem**: what is being decided and why it matters
- ⭐ **Recommended approach** with rationale — explain the "why," not just the "what"
- ❌ **Alternatives considered** with specific reasons they were rejected
- ASCII diagram if the decision involves structure or flow

Confirm with two options before presenting the next decision.

When the user rejects a recommendation, check whether downstream decisions are affected and flag which ones need revisiting before continuing.

---

## After Corrections

When the user corrects something — even if they say "quick correction, got it? let's move on" — **re-present the full updated section before proceeding**. Show the corrected whole, not a summary of what changed. The complete re-presentation often triggers additional corrections the user would not have noticed from a delta.

Only after the user confirms the corrected section does the flow continue.

---

## Final Step — Persist the Alignment

After all four layers are confirmed, persist the alignment in **two** places:

### Step A — Write the Mailbox (legacy consumers)

Write `.agentic/last-alignment.md` in this exact format:

```yaml
---
created: <ISO 8601 timestamp>
status: confirmed
confidence: high
intent_hash: <first 12 hex chars of sha256(original user intent string)>
---

## Goal

<confirmed goal text>

## Big Picture

<confirmed big picture text, including any ASCII diagrams>

## Straightforward Details

<confirmed straightforward details text, including any ASCII diagrams>

## Non-obvious Decisions

<confirmed non-obvious decisions text, including any ASCII diagrams>
```

**Compute `intent_hash`**: SHA-256 of the original user intent string (the first message), first 12 hex chars.

**File location**: `.agentic/last-alignment.md` at repo root. Overwrite (single-slot).

`/do-auto` and `morning-digest` still read this file — keep writing it until they migrate.

### Step B — Open / Update the GitHub Issue (new path)

Pipe a JSON payload to `bun scripts/issue-write.ts` to create (or update) the spec issue.

**Decide create vs update**:
- If the user invoked `/align` with a numeric arg (e.g., `/align 42`) — they're refining an existing issue. Set `issueNumber: 42` in the payload.
- Otherwise — new issue. Omit `issueNumber`.

**Build the payload**:

```json
{
  "title": "<≤70 chars derived from the confirmed Goal>",
  "intent": "<original user intent string, verbatim>",
  "alignment": {
    "goal": "<confirmed goal>",
    "bigPicture": "<confirmed big picture, plain text — strip ASCII diagrams to avoid markdown chaos in the issue body>",
    "straightforward": ["<bullet 1>", "<bullet 2>"],
    "nonObvious": ["<bullet 1>", "<bullet 2>"],
    "confidence": "high",
    "kind": "<code | rule | workflow | writeup>",
    "dependsOn": []
  },
  "issueNumber": 42
}
```

**`kind` classification** (you choose, no user prompt):
- `code` — work involves changing application code (`src/`, `scripts/`, tests, build config).
- `rule` — adding/changing a CLAUDE.md, AGENTS.md, axiom doc, or convention.
- `workflow` — adding/changing a `.claude/skill/`, agent, hook, or pipeline.
- `writeup` — blog post, design doc, retrospective — no code or behavior change.

When in doubt, pick the broader category — issues can be retitled later.

**Run the command**:

```bash
echo '<the JSON above>' | bun scripts/issue-write.ts
```

It prints the issue number to stdout. Capture it.

### Step C — Confirm to the User

Tell the user both writes happened, with the issue link. Format:

```
Saved alignment to:
- .agentic/last-alignment.md (mailbox)
- https://github.com/<owner>/<repo>/issues/<N> (label: alignment:proposed)

Tick the approval box on the issue when ready, then run /do <N> to dispatch.
```

If `gh` is unavailable or `issue-write.ts` fails, fall back to mailbox-only and tell the user the issue write failed with the error message — do not abort the alignment.

---

## Confirmation Format

Every confirmation uses exactly two options — never three, never open-ended:

```
1. ✅ [Affirmative action — what happens next]
2. ✏️ Type a correction
```

The second option is always a free-text input. Do not add a third option for "discuss," "clarify," or "ask questions" — these are the same intent as a correction.

---

## Anti-patterns

- Presenting any level N+1 content before level N is confirmed
- Repeating the user's brief back as the goal (extract the purpose, not the spec)
- Asking open-ended questions ("What approach would you like?" "What are your requirements?")
- Presenting the full analysis for every decision — depth is reserved for non-obvious items
- Omitting the ASCII diagram for a group of straightforward decisions
- Showing the full non-obvious decision list without the index first
- Acknowledging a correction and moving on without re-presenting the full corrected section
- Offering more than two confirmation options
