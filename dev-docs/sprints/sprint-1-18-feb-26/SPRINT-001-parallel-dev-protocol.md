# SPRINT-001: Parallel Development Protocol
## Richard & Dishant — Dual Cline Branch Strategy

**Sprint:** 001  
**Branch Base:** `cline-dev`  
**Developer Branches:** `cline-dev-richard` / `cline-dev-dishant`  
**Date Created:** 2026-02-18  
**Status:** 🟡 Active

---

## Overview

This sprint runs two independent Cline sessions in parallel — one per developer — each operating on its own branch derived from `cline-dev`. The goal is to maximise throughput across remaining phases while avoiding merge conflicts and keeping both agents informed of each other's progress.

> **Note on Phase 11:** Phase 11 does not yet have formal task documentation. Dishant should check the dev docs for any phase 11 content before beginning, and raise it for scoping if it is missing.

---

## Sprint 1 Task Assignment

| Developer | Primary Phases | If Time Permits |
|-----------|---------------|-----------------|
| **Richard** | Phase 9 (Styles Overhaul), Phase 6 (UBA System) | Phase 5 (Multi-Target Deployment) |
| **Dishant** | Phase 10 (AI-Powered Development), Phase 11 | Phase 7 (Code Export) |

**Rationale for split:** Phases 9 and 6 share some UI pattern heritage from Phase 3, making Richard's work self-contained. Phases 10 and 11 build on each other and are cleanly separable from the styles/UBA work, making Dishant's scope independent.

---

## Branch Setup

### One-Time Setup (done by Richard or together)

```bash
# Starting from cline-dev
git checkout cline-dev
git pull origin cline-dev

# Create developer branches
git checkout -b cline-dev-richard
git push origin cline-dev-richard

git checkout cline-dev
git checkout -b cline-dev-dishant
git push origin cline-dev-dishant
```

Each developer (and their Cline) then works exclusively on their own branch. **Never commit directly to `cline-dev` during the sprint.**

---

## Document Conflict Prevention

Certain shared documents are high-risk for merge conflicts when both branches touch the same files simultaneously. The following strategy prevents this.

### High-Risk Shared Documents

| Document | Risk | Strategy |
|----------|------|----------|
| `PROGRESS.md` in each phase | Both Clines update task status | See below — use developer-specific update files |
| `.clinerules` | Both Clines may refine shared rules | Each Cline appends to its own section only |
| Phase `README.md` files | Cross-phase architectural notes | Only the assigned developer's Cline touches these |
| Any shared `CHANGELOG.md` | Concurrent entries | Use timestamped entries with developer prefix |

### PROGRESS.md Conflict Strategy

Instead of both Clines writing to the same `PROGRESS.md`, each phase gets a companion update file:

```
dev-docs/tasks/phase-9-styles-overhaul/
  PROGRESS.md                    ← read-only during sprint (not touched)
  PROGRESS-richard.md            ← Richard's Cline writes here only
  
dev-docs/tasks/phase-10-ai-powered-development/
  PROGRESS.md                    ← read-only during sprint (not touched)
  PROGRESS-dishant.md            ← Dishant's Cline writes here only
```

**Template for developer-specific PROGRESS file:**

```markdown
# Phase X Progress — [Developer Name]
**Branch:** cline-dev-[name]
**Last Updated:** YYYY-MM-DD

## Completed This Sprint

| Task | Name | Completed | Notes |
|------|------|-----------|-------|
| TASK-001 | Name | YYYY-MM-DD | |

## In Progress

| Task | Name | Started | Blocker |
|------|------|---------|---------|

## Decisions & Learnings

- [Date] Decision or learning that the other developer should know about
```

After the sprint, both `PROGRESS-richard.md` and `PROGRESS-dishant.md` are merged into the main `PROGRESS.md` by hand before merging branches.

### .clinerules Strategy

Add a clearly delimited section to `.clinerules` for each developer. Cline only modifies content inside its own section:

```
# ===== RICHARD (cline-dev-richard) =====
[Richard's Cline rules here]
# ===== END RICHARD =====

# ===== DISHANT (cline-dev-dishant) =====
[Dishant's Cline rules here]
# ===== END DISHANT =====
```

---

## Cline Workflow: Before Each Task

At the start of every task session, Cline **must** perform the following cross-branch sync check before writing any code.

### Pre-Task Protocol

```bash
# 1. Confirm which branch you are on
git branch --show-current
# Expected: cline-dev-richard OR cline-dev-dishant

# 2. Fetch all remote branches (no checkout)
git fetch origin

# 3. View commits on the OTHER branch since your last check
# Richard checks Dishant's branch:
git log origin/cline-dev-dishant --oneline --since="24 hours ago"
# Dishant checks Richard's branch:
git log origin/cline-dev-richard --oneline --since="24 hours ago"

# 4. Check the other developer's PROGRESS file for learnings
# (read only — no edits to the other developer's files)

# 5. Evaluate: should you merge or just note?
```

### Merge Decision Criteria

Cline should recommend a merge from the other branch if **any** of the following are true:

- The other branch has introduced a shared utility, hook, or component that this branch will also need
- The other branch has resolved an infrastructure issue (build errors, TypeScript config, Webpack) that would block this branch too
- The other branch has changed a shared type definition or interface
- More than 2 tasks have been completed on the other branch since the last sync

If none of the above apply, Cline should **note the other branch's progress** in its session context and continue without merging. Add a comment to the current task's notes like:

```
// Cross-branch awareness: Dishant completed STRUCT-001 on 2026-02-18. 
// No merge needed — no shared dependencies with this task.
```

### Performing a Selective Merge

If a merge is warranted, use cherry-pick for specific commits rather than a full branch merge, to avoid pulling in in-progress work:

```bash
# Cherry-pick a specific commit from the other branch
git cherry-pick <commit-hash>

# Or merge only a specific file from the other branch
git checkout origin/cline-dev-dishant -- path/to/specific/file.ts
```

Only do a full branch merge if the other developer explicitly marks a task as "safe to merge" in their PROGRESS file.

---

## Cline Workflow: After Each Task

At the end of every completed task session, Cline **must** push its work so the other agent can see it.

### Post-Task Protocol

```bash
# 1. Update your developer-specific PROGRESS file
# (e.g., PROGRESS-richard.md or PROGRESS-dishant.md)

# 2. Stage and commit all changes
git add -A
git commit -m "feat(phase-X): [task name] — [brief description]

Task: TASK-ID
Branch: cline-dev-[name]
Cross-branch notes: [anything the other developer should know, or 'none']"

# 3. Push to your branch
git push origin cline-dev-[name]

# 4. If this task introduced a shared type, utility, or resolved an infrastructure 
#    issue, add a note to your PROGRESS file under 'Decisions & Learnings' 
#    so the other Cline picks it up on their next pre-task check
```

### Commit Message Convention

```
feat(phase-9): STYLE-001 token system foundation

Task: STYLE-001
Branch: cline-dev-richard
Cross-branch notes: Introduced shared DesignToken type in noodl-core-ui/src/types/tokens.ts — Dishant may want to cherry-pick if phase 10 UI components need it
```

---

## Communication Between Cline Sessions

Because the two Clines cannot talk directly, all inter-agent communication happens through git commits and the `PROGRESS-[developer].md` files. The conventions below make this reliable.

### Flagging Something for the Other Developer

In your PROGRESS file's "Decisions & Learnings" section:

```markdown
## Decisions & Learnings

- **[2026-02-18] FOR DISHANT:** Resolved EventDispatcher/React 19 incompatibility 
  in phase 9. Fix is in `packages/noodl-editor/src/editor/src/utils/EventDispatcher.ts`. 
  If you hit this in phase 10, cherry-pick commit `abc1234`.
```

### Flagging a Potential Conflict

If your work is about to touch a file that might also be touched by the other branch, add a warning comment at the top of the file:

```typescript
// SPRINT-001 NOTE (richard, 2026-02-18): Modifying this file on cline-dev-richard.
// Dishant — check cross-branch diff before editing this file on cline-dev-dishant.
```

Remove these comments before the final sprint merge.

---

## End-of-Sprint Merge Protocol

When both developers are done (or at end of sprint day):

```bash
# 1. Both developers ensure their branch is fully pushed and PROGRESS files updated

# 2. On cline-dev, merge Richard's branch first (or whichever finished stable work first)
git checkout cline-dev
git merge cline-dev-richard --no-ff -m "sprint-001: merge richard's branch (phase 9, 6)"

# 3. Resolve any conflicts, then merge Dishant's branch
git merge cline-dev-dishant --no-ff -m "sprint-001: merge dishant's branch (phase 10, 11)"

# 4. Consolidate PROGRESS files
# Manually merge PROGRESS-richard.md and PROGRESS-dishant.md into each phase's PROGRESS.md
# Then delete the developer-specific files

# 5. Remove any SPRINT-001 NOTE comments left in code

# 6. Push cline-dev
git push origin cline-dev
```

---

## Quick Reference Card for Cline

> Copy this into Cline's context at the start of each session.

```
SPRINT-001 PARALLEL DEV RULES
==============================
My branch: cline-dev-[richard|dishant]
Other branch: cline-dev-[dishant|richard]

BEFORE EACH TASK:
1. git fetch origin
2. git log origin/cline-dev-[other] --oneline --since="24 hours ago"
3. Read their PROGRESS-[other].md for learnings
4. Decide: cherry-pick needed? (shared util / infra fix / shared types / 2+ tasks)
5. If yes: cherry-pick specific commits only
6. If no: note awareness and continue

AFTER EACH TASK:
1. Update PROGRESS-[mine].md
2. git add -A && git commit -m "feat(phase-X): [task] ..."
3. git push origin cline-dev-[mine]
4. Flag shared changes in PROGRESS-[mine].md under 'Decisions & Learnings'

FILES I OWN (richard): phase-9, phase-6, (phase-5 if time)
FILES I OWN (dishant): phase-10, phase-11, (phase-7 if time)
SHARED FILES: .clinerules (my section only), PROGRESS.md (don't touch — use PROGRESS-[mine].md)
```

---

## Phase Reference

| Phase | Name | Assigned To |
|-------|------|-------------|
| Phase 5 | Multi-Target Deployment | Richard (if time) |
| Phase 6 | UBA System | Richard |
| Phase 7 | Code Export | Dishant (if time) |
| Phase 9 | Styles Overhaul | Richard |
| Phase 10 | AI-Powered Development | Dishant |
| Phase 11 | *(check docs — scope TBC)* | Dishant |

---

*This document lives in `dev-docs/sprints/SPRINT-001-parallel-dev-protocol.md`*  
*Update the sprint status header when the sprint closes.*
