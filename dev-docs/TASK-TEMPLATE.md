# Task Template

Use this template to create new task documentation. Copy the entire `TASK-XXX-template/` folder and rename it.

## Folder Structure

```
tasks/phase-N/TASK-XXX-short-name/
├── README.md           # Full task description (this template)
├── CHECKLIST.md        # Step-by-step checklist
├── CHANGELOG.md        # Track changes made
└── NOTES.md            # Working notes and discoveries
```

---

# README.md Template

```markdown
# TASK-XXX: [Task Title]

## Metadata

| Field | Value |
|-------|-------|
| **ID** | TASK-XXX |
| **Phase** | Phase N |
| **Priority** | 🔴 Critical / 🟠 High / 🟡 Medium / 🟢 Low |
| **Difficulty** | 🔴 Hard / 🟡 Medium / 🟢 Easy |
| **Estimated Time** | X hours/days |
| **Prerequisites** | TASK-YYY, TASK-ZZZ |
| **Branch** | `task/XXX-short-name` |

## Objective

[One clear sentence describing what this task accomplishes]

## Background

[2-3 paragraphs explaining:
- Why this task is needed
- What problems it solves
- How it fits into the bigger picture]

## Current State

[Describe what exists today:
- Current behavior
- Known issues/bugs
- User pain points
- Technical debt]

## Desired State

[Describe the end goal:
- Expected behavior after completion
- User experience improvements
- Technical improvements]

## Scope

### In Scope
- [ ] Item 1
- [ ] Item 2
- [ ] Item 3

### Out of Scope
- Item A (reason)
- Item B (reason)

### Not a constraint: legacy projects
Per `dev-docs/reference/COMPATIBILITY-POLICY.md` (2026-07-30), NodeGX is a
fresh start and pre-NodeGX projects will not reliably import. Do **not** write "existing projects
must keep working" into this section, and do not narrow scope to protect them. Ship the correct
behaviour; record breaks in CHANGELOG.md under *Breaking Changes*. Keep the QA fixture green —
updating the fixture is part of the change.

## Technical Approach

### Key Files to Modify

| File | Changes |
|------|---------|
| `path/to/file1.ts` | [What changes] |
| `path/to/file2.tsx` | [What changes] |

### New Files to Create

| File | Purpose |
|------|---------|
| `path/to/newfile.ts` | [Purpose] |

### Dependencies

- [ ] Requires TASK-XXX to be completed first
- [ ] New npm package: `package-name@version`

## Implementation Steps

### Step 1: [Name]
[Detailed description of what to do]

### Step 2: [Name]
[Detailed description of what to do]

### Step 3: [Name]
[Detailed description of what to do]

## Testing Plan

### Unit Tests
- [ ] Test: [Description]
- [ ] Test: [Description]

### Integration Tests
- [ ] Test: [Description]

### Manual Testing
- [ ] Scenario: [Description]
- [ ] Scenario: [Description]

## Success Criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] All tests pass
- [ ] No TypeScript errors
- [ ] Documentation updated

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| [Risk 1] | [How to mitigate] |
| [Risk 2] | [How to mitigate] |

## Rollback Plan

[How to revert if something goes wrong]

## References

- [Link to relevant docs]
- [Link to related issues]
- [Link to design specs]
```

---

# CHECKLIST.md Template

```markdown
# TASK-XXX Checklist

## Prerequisites
- [ ] Read README.md completely
- [ ] Understand the scope and success criteria
- [ ] Create branch: `git checkout -b task/XXX-short-name`
- [ ] Verify build works: `npm run build:editor`

## Phase 1: Research & Planning
- [ ] Identify all files that need changes
- [ ] Review existing patterns in codebase
- [ ] List assumptions and validate them
- [ ] Update NOTES.md with findings

## Phase 2: Implementation
- [ ] Step 1: [Description]
  - [ ] Sub-step A
  - [ ] Sub-step B
  - [ ] Document in CHANGELOG.md
- [ ] Step 2: [Description]
  - [ ] Sub-step A
  - [ ] Sub-step B
  - [ ] Document in CHANGELOG.md
- [ ] Step 3: [Description]
  - [ ] Sub-step A
  - [ ] Sub-step B
  - [ ] Document in CHANGELOG.md

## Phase 3: Testing
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Run full test suite: `npm run test:editor`
- [ ] Run type check: `npx tsc --noEmit`
- [ ] Manual testing scenarios

## Phase 4: Documentation
- [ ] Add JSDoc to new public functions
- [ ] Update README if behavior changed
- [ ] Complete CHANGELOG.md with summary
- [ ] Update dev-docs if needed

## Phase 5: Completion
- [ ] Self-review all changes
- [ ] Verify all success criteria met
- [ ] Clean up any debug code
- [ ] Create pull request
- [ ] Mark task as complete
```

---

# CHANGELOG.md Template

```markdown
# TASK-XXX Changelog

## [Date] - [Your Name/Handle]

### Summary
[Brief summary of what was accomplished]

### Files Modified
- `path/to/file.ts` - [What changed and why]
- `path/to/file2.tsx` - [What changed and why]

### Files Created
- `path/to/newfile.ts` - [Purpose]

### Files Deleted
- `path/to/oldfile.ts` - [Why removed]

### Breaking Changes
- [Any breaking changes and migration path]

### Testing Notes
- [What was tested]
- [Any edge cases discovered]

### Known Issues
- [Any remaining issues or follow-up needed]

### Notes
- [Any other relevant information]
```

---

# NOTES.md Template

```markdown
# TASK-XXX Working Notes

## Research

### Existing Patterns Found
- [Pattern 1]: Found in `path/to/file.ts`
- [Pattern 2]: Found in `path/to/file2.ts`

### Questions to Resolve
- [ ] Question 1?
- [ ] Question 2?

### Assumptions
- Assumption 1: [Description] - ✅ Validated / ❓ Pending
- Assumption 2: [Description] - ✅ Validated / ❓ Pending

## Implementation Notes

### Approach Decisions
- Decided to [approach] because [reason]
- Rejected [alternative] because [reason]

### Gotchas / Surprises
- [Something unexpected discovered]

### Useful Commands
```bash
# Commands that were helpful
grep -r "pattern" packages/
```

## Debug Log

### [Date/Time]
- Trying: [what you're attempting]
- Result: [what happened]
- Next: [what to try next]
```
