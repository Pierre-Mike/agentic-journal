# Tasks

## Task 1: Gate fixture (RED)
- [ ] Write `scripts/smoke-morning-digest.ts`
- Creates synthetic fixture state:
  - `.agentic/tmp-digest-fixture/specs/archive/2026-04-28-fake1-test/` (MERGED)
  - `.agentic/tmp-digest-fixture/specs/active/fake2-test/` with `ci-failure.md` (PAUSED)
  - `.agentic/tmp-digest-fixture/.agentic/last-alignment.md` with `status: needs-human` (NEEDS-HUMAN)
- Runs `scripts/morning-digest.ts` against fixture root
- Asserts digest output contains "1 MERGED", "1 PAUSED", "1 NEEDS-HUMAN"
- Cleanup fixture dir after

## Task 2: Core scan logic
- [ ] Write `scripts/morning-digest.ts`
- Scan `specs/archive/` for dirs matching `YYYY-MM-DD-*` (last 24h)
- Scan `specs/active/` for all subdirs, apply PAUSED reason heuristic
- Read `.agentic/last-alignment.md` if exists and `status: needs-human`
- Format 3-section digest (✅ MERGED / ⏸ PAUSED / ❓ NEEDS-HUMAN)
- Write to `.agentic/digest/<today>.md`
- Print summary to stdout (no console.log, use process.stdout.write)

## Task 3: Gitignore update
- [ ] Edit `.gitignore` to add `.agentic/digest/` line
- Check if `.agentic/` is already covered; add specific line if needed

## Task 4: Skill file (HANDOFF)
- [ ] Write `specs/active/047-morning-digest/SKILL-content-for-handoff.md`
- Contains the yaml frontmatter + skill body for `.claude/skills/morning-digest/SKILL.md`
- Matches format of `.claude/skills/do-auto/SKILL.md`
- Parent session writes actual skill file (worker lacks permission)

## Task 5: Constitution update
- [ ] Edit `specs/constitution.md`
- Append `### Morning digest (auto-pilot feedback)` subsection under §4
- Documents digest's role: scan overnight outcomes, surface 3-row summary
