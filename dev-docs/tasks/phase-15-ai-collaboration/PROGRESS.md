# Phase 15: AI Collaboration Experience - Progress Tracker

**Last Updated:** 2026-07-24
**Overall Status:** 🟡 In Progress

---

## Quick Summary

| Metric       | Value  |
| ------------ | ------ |
| Total Tasks  | 6      |
| Completed    | 2      |
| In Progress  | 2      |
| Not Started  | 2      |
| **Progress** | **33%** |

---

## Task Status

| Task    | Name                | Status         | Notes                                              |
| ------- | ------------------- | -------------- | -------------------------------------------------- |
| AIX-001 | Modern AI Client    | 🟢 Complete    | Client + registry + 4 providers; live runs unverified |
| AIX-002 | The Authoring Loop  | 🟡 In Progress | Slice 1 (headless loop) shipped; live-provider runs, staging/accept, UI, live canvas pending. See AIX-002-NOTES.md |
| AIX-003 | Graph-Native Review | 🟡 In Progress | Slices 1–5 shipped: change-set adapter, annotated diff canvas, review document (list/nav/detail, before/after, granular accept with dependency closure, walkthrough). Residuals: one clean-session UI smoke, 40-node fresh-reviewer test, live-provider round trip. See AIX-003-NOTES.md |
| AIX-004 | Explain Mode        | 🟢 Complete    | Panel shipped + wired (context menu + sidebar); read-only; citations link to canvas; +47 specs. Register/accuracy tuning needs a live provider run. NOTES + CHANGELOG in the task doc |
| AIX-005 | Agentic UI Nodes    | 🔴 Not Started | Deliberately last; only after AIX-002 proves out   |
| AIX-006 | Style Vocabulary    | 🔴 Not Started | Added 2026-07-24 from the salvage audit; ~1 wk; tokens/variants into the authoring context, StyleAnalyzer as post-gen linter |

---

## Status Legend

- 🔴 **Not Started** - Work has not begun
- 🟡 **In Progress** - Actively being worked on
- 🟢 **Complete** - Finished and verified

---

## Recent Updates

| Date       | Update                                                                 |
| ---------- | ---------------------------------------------------------------------- |
| 2026-07-22 | Phase created from NOODL-REVIVAL-ROADMAP.md Track C (C-01..C-05)       |
| 2026-07-24 | AIX-001 complete — provider-agnostic client, model registry, Anthropic/OpenAI/compatible/Ollama adapters, secure credential storage, settings UI, 69 specs. See NOTES.md. |
| 2026-07-24 | AIX-006 added from the [pre-revival salvage audit](../../reviews/PRE-REVIVAL-SALVAGE-AUDIT.md) §2 — the shipped phase-9 styles system has zero substrate connection; exposing it is the cheapest quality jump for the G2 demo. |
| 2026-07-24 | AIX-004 complete — read-only Explain Mode: bounded context assembly over the real-project corpus, per-scope prompts with node citations, sidebar panel + context-menu entry, citations link to canvas (hover-highlight, click-navigate), +47 specs (1060 → 1107). Live editor pass caught and fixed the sidebar-switch-deselects defect. Register/accuracy tuning deferred to a live provider run. See AIX-004-NOTES.md + the task-doc CHANGELOG. |
| 2026-07-24 | AIX-003 slices 1–5 — graph-native review: staged proposals expressed through SUB-007's diff engine (change-set adapter with stable ids + dependency closures), annotated merged component on the read-only diff canvas (badges/dash/thickness — change types readable without colour), ChangeReviewDocument (grouped sentence list, click-to-canvas navigation, per-key parameter detail, Before/Changes/After, per-row exclude/restore with closure enforcement, walkthrough stepper, Accept N of M validated through the SUB-006 gate), +14 specs (1139 → 1153). Two SUB-007 upstream fixes (derived componentName extra; port-index normalization, found live). Residuals in AIX-003-NOTES.md. |
| 2026-07-24 | AIX-002 slice 1 — the headless authoring loop: `authoring/` module (context → author → validate → repair), pull-based context through a hard charged budget (the no-whole-project rule is structural + spec-asserted), MCP-policy validation gate from shared validators, injectable chat seam, +22 specs (1107 → 1129). `normalizeV2Component` moved to the pure normalize module (barrel-exported; MCP untouched). See AIX-002-NOTES.md. |

---

## Dependencies

- **Phase-13 (format-ai-substrate):** SUB-004 (node catalog) and SUB-006 (semantic validator) block AIX-002/004; SUB-007 (graph diff) blocks AIX-003.
- **Gate G2 (~Month 9):** AIX-002 demo shipped a full quarter + two LEARN-006 pilots → do users return unprompted?
