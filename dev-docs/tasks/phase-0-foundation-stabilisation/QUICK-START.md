# Phase 0: Quick Start Guide

## What Is This?

Phase 0 is a foundation stabilization sprint to fix critical infrastructure issues discovered during TASK-004B. Without these fixes, every React migration task will waste 10+ hours fighting the same problems.

**Total estimated time:** 10-16 hours (1.5-2 days)

---

## The 3-Minute Summary

### The Problems

1. **Webpack caching is so aggressive** that code changes don't load, even after restarts
2. **EventDispatcher doesn't work with React** - events emit but React never receives them
3. **No way to verify** if your fixes actually work

### The Solutions

1. **TASK-009:** Nuke caches, disable persistent caching in dev, add build timestamp canary
2. **TASK-010:** Verify the `useEventListener` hook works, fix ComponentsPanel
3. **TASK-011:** Document the pattern so this never happens again
4. **TASK-012:** Create health check script to catch regressions

---

## Execution Order

```
┌─────────────────────────────────────────────────────────────┐
│  TASK-009: Webpack Cache Elimination                        │
│  ─────────────────────────────────────                      │
│  MUST BE DONE FIRST - Can't debug anything until caching    │
│  is solved. Expected time: 2-4 hours                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  TASK-010: EventListener Verification                       │
│  ─────────────────────────────────────                      │
│  Test and verify the React event pattern works.             │
│  Fix ComponentsPanel. Expected time: 4-6 hours              │
└─────────────────────────────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌────────────────────────┐  ┌────────────────────────────────┐
│  TASK-011: Pattern     │  │  TASK-012: Health Check        │
│  Guide                 │  │  Script                        │
│  ──────────────────    │  │  ─────────────────────         │
│  Document everything   │  │  Automated validation          │
│  2-3 hours             │  │  2-3 hours                     │
└────────────────────────┘  └────────────────────────────────┘
```

---

## Starting TASK-009

### Prerequisites

- VSCode/IDE open to the project
- Terminal ready
- Project runs normally (`npm run dev` works)

### First Steps

1. **Read TASK-009/README.md** thoroughly
2. **Find all cache locations** (grep commands in the doc)
3. **Create clean script** in package.json
4. **Modify webpack config** to disable filesystem cache in dev
5. **Add build canary** (timestamp logging)
6. **Verify 3 times** that changes load reliably

### Definition of Done

You can edit a file, save it, and see the change in the running app within 5 seconds. Three times in a row.

---

## Key Files

| File                               | Purpose                         |
| ---------------------------------- | ------------------------------- |
| `phase-0-foundation/README.md`     | Master plan                     |
| `TASK-009-*/README.md`             | Webpack cache elimination       |
| `TASK-009-*/CHECKLIST.md`          | Verification checklist          |
| `TASK-010-*/README.md`             | EventListener verification      |
| `TASK-010-*/EventListenerTest.tsx` | Test component (copy to app)    |
| `TASK-011-*/README.md`             | Pattern documentation task      |
| `TASK-011-*/GOLDEN-PATTERN.md`     | The canonical pattern reference |
| `TASK-012-*/README.md`             | Health check script task        |
| `CLINERULES-ADDITIONS.md`          | Rules to add to .clinerules     |

---

## Success Criteria

Phase 0 is complete when:

- [ ] `npm run clean:all` works
- [ ] Code changes load reliably (verified 3x)
- [ ] Build timestamp visible in console
- [ ] `useEventListener` verified working
- [ ] ComponentsPanel rename updates UI immediately
- [ ] Pattern documented in LEARNINGS.md
- [ ] .clinerules updated
- [ ] Health check script runs

---

## After Phase 0

Return to Phase 2 work:

- TASK-004B (ComponentsPanel migration) becomes UNBLOCKED
- Future React migrations will follow the documented pattern
- Less token waste, more progress
