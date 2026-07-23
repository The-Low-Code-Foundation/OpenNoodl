# Phase 13: Format & AI Substrate — Progress Tracker

**Created:** 2026-07-22 (from [NOODL-REVIVAL-ROADMAP.md](../../reviews/NOODL-REVIVAL-ROADMAP.md), Track A)
**Last Updated:** 2026-07-23
**Overall Status:** 🟡 In Progress (SUB-001, SUB-002 complete)

---

## Quick Summary

| Metric       | Value  |
| ------------ | ------ |
| Total Tasks  | 8      |
| Completed    | 2      |
| In Progress  | 0      |
| Not Started  | 6      |
| **Progress** | **25%** |

---

## Foundation (already done, outside this phase)

STRUCT-001..004 from Phase 10A are **complete** (Feb 2026 sprint) and are this phase's
foundation:

| Task | Name | Where it lives |
|------------|--------------------------|-------------------------------------------------------|
| STRUCT-001 | JSON Schema Definition | `packages/noodl-editor/src/editor/src/schemas/` (8 schemas + Ajv validator) |
| STRUCT-002 | Export Engine Core | `src/editor/src/io/ProjectExporter.ts` (pure, no fs) |
| STRUCT-003 | Import Engine Core | `src/editor/src/io/ProjectImporter.ts` (pure, no fs) |
| STRUCT-004 | Editor Format Detection | `src/editor/src/io/ProjectFormatDetector.ts` |

~149 tests in `packages/noodl-editor/tests/io/` (68 Exporter, 55 Importer incl. ~18
round-trip, 26 Detector; none skipped). Caveat: these classes have **zero application
call sites** — they are exercised only from tests. Making them real is SUB-001's job.

---

## Task Status

| Task | Name | Est. | Status |
|---------|--------------------------------|--------|----------------|
| SUB-001 | Editor v2 Integration (STRUCT-005/006) | 3-4 wks | 🟢 Complete |
| SUB-002 | Round-Trip Fidelity | 1-2 wks | 🟢 Complete |
| SUB-003 | Migration Wizard & Real-Project Tests (STRUCT-007/008) | 3-4 wks | 🔴 Not Started |
| SUB-004 | Node Catalog Generator | 1-2 wks | 🔴 Not Started |
| SUB-005 | Catalog Enrichment | 3-4 wks | 🔴 Not Started |
| SUB-006 | Semantic Validator | 2-3 wks | 🔴 Not Started |
| SUB-007 | Graph-Native Git | 4-6 wks | 🔴 Not Started |
| SUB-008 | Noodl MCP Server | 3-4 wks | 🔴 Not Started |

---

## Gate G1 (phase exit)

- [ ] An external AI agent, via MCP + catalog, authors a valid new page into a real
      project without ingesting the whole project, and the semantic validator + editor
      both accept it.

---

## Change Log

- **2026-07-23** — **SUB-001 complete.** The v2 decomposed format is now wired into
  the editor's real save/load path (previously zero application call sites). New
  `services/ProjectStructure/`: **`ComponentLoader`** (STRUCT-005 — per-component
  lazy load, TTL/LRU cache, `preloadComponents`, `invalidate`), **`ComponentSaver`**
  (STRUCT-006 — two-phase atomic per-component write, incremental+atomic registry,
  content-hash change detection), and a **`ProjectStructureService`** orchestrating
  `loadProject`/`saveProject`. Wired behind the format detector + a feature flag
  (`formatV2.enabled`, default OFF; env/localStorage kill-switches) at the two seams:
  `projectFromDirectory` (read) and `ProjectModel.toDirectory` (write); legacy path
  byte-for-byte unchanged when the flag is off or the project is v1.
  **Design decision (collab-forward):** rather than STRUCT-005's literal "load only the
  active component" — which fights every whole-project consumer and is the wrong target
  for live collaboration — the whole project stays materialised, but the *component* is
  the atomic unit of load/save/**invalidate**. A save rewrites only components whose
  content actually changed (hash diff, excluding volatile timestamps), so one edit = that
  component's 3 files + registry. The saver's `diskHashes` map doubles as the collab
  echo-guard, and `ProjectModel.reloadComponentFromDisk` / `service.reloadComponent`
  ship as the surgical single-component reload seam for future file-watch / SSE sync.
  Crash-safety: staged temp writes then rename; a mid-save failure rolls back baselines so
  a retry redoes the whole change set (no orphaned-from-registry component). io engines
  refactored to expose pure per-component build/reconstruct helpers (behaviour-preserving).
  New suite: **25 ProjectStructure specs** (loader cache/TTL/eviction, saver atomicity/
  interrupted-write/rollback, round-trip, deletion, reload); combined io+schemas+new run
  **270 specs, 0 failures**. Follow-ups: true on-demand loading (needs consumer audit),
  and wiring `reloadComponentFromDisk` to a file watcher (SUB-007 / collab).
- **2026-07-23** — **SUB-002 complete.** Field audit ([NOTES.md](./NOTES.md)) found the
  four named gaps (`rootNodeId`, `lesson`, graph `comments`, `visualRoots`) **plus four
  more** the synthetic-only fixtures hid: project `id` and `thumbnailURI` dropped, legacy
  `metadata.styles.text` silently dropped (exporter read a non-existent `textStyles` key),
  variant `conflicts` dropped, and non-array `routes` lost. All carried now, with schema +
  type additions. New whole-object round-trip suite runs over six real projects
  (import_proj1/2/5, watchproject, git-repo-utf8 44-comp, big-merge 176-comp) + one
  synthetic-awkward fixture; a data-driven schema-drift guard fails if a real-project field
  has no schema home. Full editor harness: **741 specs, 0 failures.** SUB-001 gate is clear.
- **2026-07-22** — Phase created from the revival roadmap (Track A, tasks A-01..A-08
  mapped to SUB-001..008). All tasks Not Started.
