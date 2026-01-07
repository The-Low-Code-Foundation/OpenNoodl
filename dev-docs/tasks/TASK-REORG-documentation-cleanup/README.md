# TASK-REORG: Documentation Structure Cleanup

**Task ID:** TASK-REORG  
**Created:** 2026-01-07  
**Status:** 🟡 In Progress  
**Priority:** HIGH  
**Effort:** 2-4 hours

---

## Problem Statement

The task documentation has become disorganized over time with:

1. **Misplaced Content** - Phase 3 TASK-008 "granular-deployment" contains UBA (Universal Backend Adapter) content, not project file structure
2. **Wrong Numbering** - UBA files named "PHASE-6A-6F" but located in Phase 3, while actual Phase 6 is Code Export
3. **Duplicate Topics** - Styles work in both Phase 3 TASK-000 AND Phase 8
4. **Broken References** - Phase 9 references "Phase 6 UBA" which doesn't exist as a separate phase
5. **Typo in Folder Name** - "stabalisation" instead of "stabilisation"
6. **Missing Progress Tracking** - No easy way to see completion status of each phase
7. **Incorrect README** - Phase 8 README contains WIZARD-001 content, not phase overview

---

## Current vs Target Structure

### Phase Mapping

| New #   | Current Location                              | New Location                       | Change Type              |
| ------- | --------------------------------------------- | ---------------------------------- | ------------------------ |
| **0**   | phase-0-foundation-stabalisation              | phase-0-foundation-stabilisation   | RENAME (fix typo)        |
| **1**   | phase-1-dependency-updates                    | phase-1-dependency-updates         | KEEP                     |
| **2**   | phase-2-react-migration                       | phase-2-react-migration            | KEEP                     |
| **3**   | phase-3-editor-ux-overhaul                    | phase-3-editor-ux-overhaul         | MODIFY (remove TASK-008) |
| **3.5** | phase-3.5-realtime-agentic-ui                 | phase-3.5-realtime-agentic-ui      | KEEP                     |
| **4**   | phase-4-canvas-visualisation-views            | phase-4-canvas-visualisation-views | KEEP                     |
| **5**   | phase-5-multi-target-deployment               | phase-5-multi-target-deployment    | KEEP                     |
| **6**   | phase-3.../TASK-008-granular-deployment       | phase-6-uba-system                 | NEW (move UBA here)      |
| **7**   | phase-6-code-export                           | phase-7-code-export                | RENUMBER                 |
| **8**   | phase-7-auto-update-and-distribution          | phase-8-distribution               | RENUMBER                 |
| **9**   | phase-3.../TASK-000 + phase-8-styles-overhaul | phase-9-styles-overhaul            | MERGE                    |
| **10**  | phase-9-ai-powered-development                | phase-10-ai-powered-development    | RENUMBER                 |

---

## Execution Checklist

### Phase 1: Create New Phase 6 (UBA System)

- [ ] Create folder `dev-docs/tasks/phase-6-uba-system/`
- [ ] Create `phase-6-uba-system/README.md` (UBA overview)
- [ ] Move `phase-3.../TASK-008-granular-deployment/PHASE-6A-FOUNDATION.md` → `phase-6-uba-system/UBA-001-FOUNDATION.md`
- [ ] Move `phase-3.../TASK-008-granular-deployment/PHASE-6B-FIELD-TYPES.md` → `phase-6-uba-system/UBA-002-FIELD-TYPES.md`
- [ ] Move `phase-3.../TASK-008-granular-deployment/PHASE-6C-DEBUG-SYSTEM.md` → `phase-6-uba-system/UBA-003-DEBUG-SYSTEM.md`
- [ ] Move `phase-3.../TASK-008-granular-deployment/PHASE-6D-POLISH.md` → `phase-6-uba-system/UBA-004-POLISH.md`
- [ ] Move `phase-3.../TASK-008-granular-deployment/PHASE-6E-REFERENCE-BACKEND.md` → `phase-6-uba-system/UBA-005-REFERENCE-BACKEND.md`
- [ ] Move `phase-3.../TASK-008-granular-deployment/PHASE-6F-COMMUNITY.md` → `phase-6-uba-system/UBA-006-COMMUNITY.md`
- [ ] Delete empty `phase-3-editor-ux-overhaul/TASK-008-granular-deployment/` folder
- [ ] Create `phase-6-uba-system/PROGRESS.md`

### Phase 2: Renumber Existing Phases

- [ ] Rename `phase-6-code-export/` → `phase-7-code-export/`
- [ ] Update any internal references in Phase 7 files
- [ ] Rename `phase-7-auto-update-and-distribution/` → `phase-8-distribution/`
- [ ] Update any internal references in Phase 8 files

### Phase 3: Merge Styles Content

- [ ] Create `phase-9-styles-overhaul/` (new merged folder)
- [ ] Move `phase-8-styles-overhaul/PHASE-8-OVERVIEW.md` → `phase-9-styles-overhaul/README.md`
- [ ] Move `phase-8-styles-overhaul/QUICK-REFERENCE.md` → `phase-9-styles-overhaul/QUICK-REFERENCE.md`
- [ ] Move `phase-8-styles-overhaul/STYLE-001-*` through `STYLE-005-*` folders → `phase-9-styles-overhaul/`
- [ ] Move `phase-8-styles-overhaul/WIZARD-001-*` → `phase-9-styles-overhaul/` (keep together with styles)
- [ ] Move `phase-3-editor-ux-overhaul/TASK-000-styles-overhaul/` → `phase-9-styles-overhaul/CLEANUP-SUBTASKS/` (legacy cleanup tasks)
- [ ] Delete old `phase-8-styles-overhaul/` folder
- [ ] Create `phase-9-styles-overhaul/PROGRESS.md`

### Phase 4: Renumber AI Phase

- [ ] Rename `phase-9-ai-powered-development/` → `phase-10-ai-powered-development/`
- [ ] Update references to "Phase 9" → "Phase 10" within files
- [ ] Update Phase 6 UBA references (now correct!)
- [ ] Create `phase-10-ai-powered-development/PROGRESS.md`

### Phase 5: Fix Phase 0 Typo

- [ ] Rename `phase-0-foundation-stabalisation/` → `phase-0-foundation-stabilisation/`
- [ ] Update any references to the old folder name

### Phase 6: Create PROGRESS.md Files

Create `PROGRESS.md` in each phase root:

- [ ] `phase-0-foundation-stabilisation/PROGRESS.md`
- [ ] `phase-1-dependency-updates/PROGRESS.md`
- [ ] `phase-2-react-migration/PROGRESS.md`
- [ ] `phase-3-editor-ux-overhaul/PROGRESS.md`
- [ ] `phase-3.5-realtime-agentic-ui/PROGRESS.md`
- [ ] `phase-4-canvas-visualisation-views/PROGRESS.md`
- [ ] `phase-5-multi-target-deployment/PROGRESS.md`
- [ ] `phase-6-uba-system/PROGRESS.md` (created in Phase 1)
- [ ] `phase-7-code-export/PROGRESS.md`
- [ ] `phase-8-distribution/PROGRESS.md`
- [ ] `phase-9-styles-overhaul/PROGRESS.md` (created in Phase 3)
- [ ] `phase-10-ai-powered-development/PROGRESS.md` (created in Phase 4)

### Phase 7: Update Cross-References

- [ ] Search all `.md` files for "phase-6" and update to "phase-7" (code export)
- [ ] Search all `.md` files for "phase-7" and update to "phase-8" (distribution)
- [ ] Search all `.md` files for "phase-8" and update to "phase-9" (styles)
- [ ] Search all `.md` files for "phase-9" and update to "phase-10" (AI)
- [ ] Search for "Phase 6 UBA" or "Phase 6 (UBA)" and verify points to new phase-6
- [ ] Search for "stabalisation" and fix typo
- [ ] Update `.clinerules` if it references specific phase numbers

### Phase 8: Verification

- [ ] All folders exist with correct names
- [ ] All PROGRESS.md files created
- [ ] No orphaned files or broken links
- [ ] README in each phase root is correct content
- [ ] Git commit with descriptive message

---

## PROGRESS.md Template

Use this template for all `PROGRESS.md` files:

```markdown
# Phase X: [Phase Name] - Progress Tracker

**Last Updated:** YYYY-MM-DD  
**Overall Status:** 🔴 Not Started | 🟡 In Progress | 🟢 Complete

---

## Quick Summary

| Metric       | Value  |
| ------------ | ------ |
| Total Tasks  | X      |
| Completed    | X      |
| In Progress  | X      |
| Not Started  | X      |
| **Progress** | **X%** |

---

## Task Status

| Task     | Name   | Status         | Notes           |
| -------- | ------ | -------------- | --------------- |
| TASK-001 | [Name] | 🔴 Not Started |                 |
| TASK-002 | [Name] | 🟡 In Progress | 50% complete    |
| TASK-003 | [Name] | 🟢 Complete    | Done 2026-01-05 |

---

## Status Legend

- 🔴 **Not Started** - Work has not begun
- 🟡 **In Progress** - Actively being worked on
- 🟢 **Complete** - Finished and verified
- ⏸️ **Blocked** - Waiting on dependency
- 🔵 **Planned** - Scheduled but not started

---

## Recent Updates

| Date       | Update                  |
| ---------- | ----------------------- |
| YYYY-MM-DD | [Description of change] |

---

## Dependencies

List any external dependencies or blocking items here.

---

## Notes

Additional context or important information about this phase.
```

---

## Final Phase Structure

After reorganization:

```
dev-docs/tasks/
├── TASK-REORG-documentation-cleanup/    # This task (can be archived after)
├── phase-0-foundation-stabilisation/    # Fixed typo
│   └── PROGRESS.md
├── phase-1-dependency-updates/
│   └── PROGRESS.md
├── phase-2-react-migration/
│   └── PROGRESS.md
├── phase-3-editor-ux-overhaul/          # TASK-008 removed (moved to Phase 6)
│   └── PROGRESS.md
├── phase-3.5-realtime-agentic-ui/
│   └── PROGRESS.md
├── phase-4-canvas-visualisation-views/
│   └── PROGRESS.md
├── phase-5-multi-target-deployment/
│   └── PROGRESS.md
├── phase-6-uba-system/                  # NEW - UBA content from old TASK-008
│   ├── README.md
│   ├── PROGRESS.md
│   ├── UBA-001-FOUNDATION.md
│   ├── UBA-002-FIELD-TYPES.md
│   ├── UBA-003-DEBUG-SYSTEM.md
│   ├── UBA-004-POLISH.md
│   ├── UBA-005-REFERENCE-BACKEND.md
│   └── UBA-006-COMMUNITY.md
├── phase-7-code-export/                 # Renumbered from old Phase 6
│   └── PROGRESS.md
├── phase-8-distribution/                # Renumbered from old Phase 7
│   └── PROGRESS.md
├── phase-9-styles-overhaul/             # Merged Phase 3 TASK-000 + old Phase 8
│   ├── README.md
│   ├── PROGRESS.md
│   ├── QUICK-REFERENCE.md
│   ├── STYLE-001-*/
│   ├── STYLE-002-*/
│   ├── STYLE-003-*/
│   ├── STYLE-004-*/
│   ├── STYLE-005-*/
│   ├── WIZARD-001-*/
│   └── CLEANUP-SUBTASKS/                # From old Phase 3 TASK-000
└── phase-10-ai-powered-development/     # Renumbered from old Phase 9
    ├── README.md
    ├── PROGRESS.md
    ├── DRAFT-CONCEPT.md
    └── TASK-9A-DRAFT.md                 # Will need internal renumber to TASK-10A
```

---

## Success Criteria

- [ ] All 12 phase folders have correct names
- [ ] All 12 phase folders have PROGRESS.md
- [ ] No orphaned content (nothing lost in moves)
- [ ] All cross-references updated
- [ ] No typos in folder names
- [ ] UBA content cleanly separated into Phase 6
- [ ] Styles content merged into Phase 9
- [ ] Phase 10 (AI) references correct Phase 6 (UBA) for dependencies

---

## Notes

- This reorganization is a **documentation-only** change - no code is modified
- Git history will show moves as delete+create, which is fine
- Consider a single commit with clear message: "docs: reorganize phase structure"
- After completion, update `.clinerules` if needed
- Archive this TASK-REORG folder or move to `completed/` subfolder

---

## Estimated Time

| Section                  | Estimate     |
| ------------------------ | ------------ |
| Create Phase 6 (UBA)     | 30 min       |
| Renumber Phases 7-8      | 15 min       |
| Merge Styles             | 30 min       |
| Renumber AI Phase        | 15 min       |
| Fix Phase 0 typo         | 5 min        |
| Create PROGRESS.md files | 45 min       |
| Update cross-references  | 30 min       |
| Verification             | 15 min       |
| **Total**                | **~3 hours** |
