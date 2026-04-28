# Tasks

- [ ] 1. Write `scripts/check-alignment-mailbox.ts` validator
  - agent: main
  - depends: []
  - file_targets: [scripts/check-alignment-mailbox.ts]
  - boundary: [scripts/check-alignment-mailbox.ts]

- [ ] 2. Edit `.claude/skills/align/SKILL.md` to add final "write mailbox" step
  - agent: main
  - depends: [1]
  - file_targets: [.claude/skills/align/SKILL.md]
  - boundary: [.claude/skills/align/SKILL.md]

- [ ] 3. Edit `.claude/skills/do/SKILL.md` Step 5 to consume mailbox
  - agent: main
  - depends: [1]
  - file_targets: [.claude/skills/do/SKILL.md]
  - boundary: [.claude/skills/do/SKILL.md]

- [ ] 4. Verify `alignment.md` demonstrates the schema
  - agent: main
  - depends: [1]
  - file_targets: [specs/active/043-persist-alignment-mailbox/alignment.md]
  - boundary: [specs/active/043-persist-alignment-mailbox/alignment.md]
