---
created: 2026-04-30
status: confirmed
confidence: high
intent_hash: 000000000000
---

## Goal

The fallback branch-name parser in `automerge.yml` (line 58) uses a regex that matches `issue-<N>` in the branch name, but the actual branch naming convention — set at `align.yml:41` — is `auto/<N>-<slug>`. As a result, whenever a PR body lacks a `Closes #N` line, the issue number is never recovered from the branch name: linked issues are never closed after merge, and failure fan-in comments never reach the issue. The fix is a one-line regex change so the fallback matches the real `auto/<N>-<slug>` convention.

## Big Picture

The automerge workflow resolves the issue number in two stages:

```
PR body
  └─ grep -oP '(?i)closes? #\K[0-9]+'  ──► ISSUE_NUMBER (primary)
       │ (empty)
       ▼
  branch name  ── grep -oP '(?<=issue-)\d+'  ──► ISSUE_NUMBER (fallback)  ← BROKEN
                                                                              actual format:
                                                                              auto/<N>-<slug>

Downstream consumers of ISSUE_NUMBER:
  - "Post spec-gap comment to issue"   (step: early_green)
  - "Close linked issue after merge"   (step: close issue)
  - "Failure fan-in — post menu to issue" (step: failure)

All three silently no-op when ISSUE_NUMBER is empty.
```

`align.yml:41` sets the branch as `auto/${{ github.event.issue.number }}-${{ steps.slug.outputs.value }}`, e.g. `auto/90-automerge-yml-issue-lookup-fallback-regex-doesn-t-`. The number appears immediately after `auto/`, not after `issue-`.

## Straightforward Details

### File change (single line)

```
File:  .github/workflows/automerge.yml
Line:  58
```

Before:
```
ISSUE_NUMBER=$(echo "${BRANCH}" | grep -oP '(?<=issue-)\d+' | head -1)
```

After:
```
ISSUE_NUMBER=$(echo "${BRANCH}" | grep -oP '^auto/\K[0-9]+' | head -1)
```

Regex mechanics:

```
^auto/\K[0-9]+
  ^        — anchored to string start
  auto/    — literal prefix consumed by lookbehind equivalent
  \K       — reset match start (PCRE: discard everything before this point)
  [0-9]+   — capture the numeric issue id
```

This is equivalent to `(?<=^auto/)[0-9]+` but avoids a variable-length lookbehind.

### No other files need changing

```
align.yml        — branch format is already correct; no change needed
automerge.yml    — only line 58; comment on line 56 can be updated for accuracy
```

Updated comment (line 56, optional clarity improvement):

```
# Fallback: parse issue number from branch name convention auto/<N>-<slug>
```

### Spec kind and gate

```
kind:    workflow
gate:    scripts/smoke/automerge-issue-lookup.sh   (new smoke script)
```

Smoke script verifies the regex against sample branch names:

```
auto/90-automerge-yml-issue-lookup-fallback   → extracts "90"  (PASS)
auto/1-short-slug                              → extracts "1"   (PASS)
auto/123-multi-word-slug-here                  → extracts "123" (PASS)
issue-90-old-format                            → extracts ""    (PASS — old format correctly rejected)
feature/no-number                              → extracts ""    (PASS — non-auto branch)
```

## Non-obvious Decisions

### Regex choice: `^auto/\K[0-9]+` vs `(?<=^auto/)[0-9]+`

Recommended: `^auto/\K[0-9]+`

Rationale: GNU grep with `-P` (PCRE) supports `\K` but does NOT support variable-length lookbehinds in all versions. `\K` is universally supported in PCRE and is idiomatically preferred in shell scripts using `grep -oP`. Both forms are functionally identical here; `\K` avoids any risk of lookbehind-length restrictions on older grep binaries in ubuntu-latest GitHub runners.

Rejected alternative — `grep -oP '(?<=auto/)\d+'` without anchoring:
Matches any branch containing `auto/` anywhere in the path, not just `^auto/`. In practice branch names won't have `auto/` mid-string, but anchoring is more correct and costs nothing.

Rejected alternative — `sed` or `awk` extraction:
More verbose, no meaningful benefit; `grep -oP` is already used for the primary extraction and is consistent.

### Whether to also add a `gh api` lookup as a third fallback

Recommended: do NOT add a gh api lookup at this time.

Rationale: the intent explicitly says "update the fallback regex." Adding a gh api call would expand scope, introduce a new network dependency in an already-long step, and risk rate-limiting. If the regex fix does not cover edge cases, a separate spec can introduce the API fallback.
