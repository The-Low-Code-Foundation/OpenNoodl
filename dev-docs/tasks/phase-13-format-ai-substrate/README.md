# Phase 13: Format & AI Substrate (Revival Track A)

**Phase:** 13
**Status:** 🔴 Not Started
**Effort:** ~20-29 weeks of task time (parallelizable; ~3 months with 3 people)
**Priority:** CRITICAL — this is the strategic spine of the revival roadmap. Staff it best.

---

## Overview

This phase makes the OpenNoodl project format **a language**: decomposed, documented,
diffable, validatable, and manipulable by any tool or AI — not just Noodl's own editor.

Phase 10A (STRUCT-001..004) already built the foundation: a v2 multi-file project format
(`nodegx.project.json`, `components/<Path>/{component,nodes,connections}.json`,
`components/_registry.json` — layout documented at
`packages/noodl-editor/src/editor/src/io/ProjectExporter.ts:7-18`), 8 JSON schemas with
an Ajv validator (`src/editor/src/schemas/`), a format detector, and ~149 passing tests.
What it did **not** deliver: the editor still saves the monolithic `project.json`
(`models/projectmodel.ts:588-617`), the round-trip silently drops several fields, no
enumerable node/port catalog exists anywhere, git merge still runs through 666 lines of
legacy `utils/projectmerger.js`, and no external tool can author a Noodl project.

This phase closes all of those gaps and ends with a Model Context Protocol server that
turns Noodl into a first-class target for the entire agent ecosystem.

---

## Task Breakdown

| Task | Name | Description | Est. |
|---------|--------------------------|--------------------------------------------------------------------|--------|
| SUB-001 | [Editor v2 Integration](./SUB-001-EDITOR-V2-INTEGRATION.md) | Editor natively reads/writes v2 (STRUCT-005 lazy loading + STRUCT-006 component-level save) | 3-4 wks | 🟠 Opus 4.8 |
| SUB-002 | [Round-Trip Fidelity](./SUB-002-ROUNDTRIP-FIDELITY.md) | Carry `comments`/`visualRoots`/`lesson`/`rootNodeId`; whole-object round-trip tests; golden fixtures | 1-2 wks | 🟢 Sonnet 5 |
| SUB-003 | [Migration & Real Tests](./SUB-003-MIGRATION-AND-REAL-TESTS.md) | STRUCT-007 migration wizard UI + STRUCT-008 real-project test suite | 3-4 wks | 🟠 Opus 4.8 — 🟢 engine + STRUCT-008 done; wizard UI deferred |
| SUB-004 | [Node Catalog](./SUB-004-NODE-CATALOG.md) | **The keystone**: generate `node-catalog.json` from runtime registry metadata | 1-2 wks | 🔵 Fable 5 |
| SUB-005 | [Catalog Enrichment](./SUB-005-CATALOG-ENRICHMENT.md) | Usage examples, semantic docs, connection-compatibility rules, dynamic-port flags | 3-4 wks | 🔵 Fable 5 |
| SUB-006 | [Semantic Validator](./SUB-006-SEMANTIC-VALIDATOR.md) | Lint v2 projects against the catalog — "the AI's compiler errors" | 2-3 wks | 🟠 Opus 4.8 |
| SUB-007 | [Graph-Native Git](./SUB-007-GRAPH-NATIVE-GIT.md) | Replace `projectmerger.js` with v2-aware diff/merge; readable graph diffs | 4-6 wks | 🔵 Fable 5 |
| SUB-008 | [MCP Server](./SUB-008-MCP-SERVER.md) | Noodl MCP server: any agent can open, inspect, and author projects | 3-4 wks | 🔵 Fable 5 |

---

## Dependencies & Sequencing

```
SUB-002 (fidelity) ──┐
                     ├──> SUB-001 (editor v2) ──> SUB-003 (migration + real tests)
                     │           │
                     │           └──> SUB-007 (graph-native git)
                     │
SUB-004 (catalog) ───┼──> SUB-005 (enrichment)
                     ├──> SUB-006 (semantic validator)
                     │
                     └──> SUB-008 (MCP server, also needs SUB-001/006)
```

- **Start SUB-001 and SUB-002 first** (SUB-002 is small and MUST land before any real
  project migrates; SUB-004 can start in parallel — it is independent of format wiring).
- **SUB-004 unblocks SUB-005, SUB-006, and SUB-008** — it is the single
  highest-leverage task in this phase.
- **SUB-007 depends on SUB-001** (per-component files are what make graph merge tractable).
- **SUB-008 is the capstone** — it composes SUB-001..006 behind a protocol boundary.

---

## Phase Exit: Gate G1 (Substrate Gate)

From the revival roadmap (§6), this phase is done when the following demo works:

> **An external AI agent, via MCP + catalog, authors a valid page into a real project
> without ingesting the whole project, and the semantic validator + editor both accept it.**

If this gate fails, the AI-authorable-format thesis is wrong at the foundation —
downstream AI and export tracks halt for a rethink. Every task in this phase should
justify itself by distance to that demo.

---

## References

- [NOODL-REVIVAL-ROADMAP.md](../../reviews/NOODL-REVIVAL-ROADMAP.md) — Track A (A-01..A-08) is this phase
- [NOODL-VIABILITY-REPORT.md](../../reviews/NOODL-VIABILITY-REPORT.md) — §4.2 and Appendix G (STRUCT findings)
- [Phase 10 README](../phase-10-ai-powered-development/README.md) — STRUCT-005..009 specs that SUB-001/003 implement

---

_Created: 2026-07-22_

## Executor guidance

Each task file carries a **Recommended executor** row, using the criteria shared across revival phases 12–20:

| Tier | Use when | In this phase |
|------|----------|---------------|
| 🟢 **Sonnet 5** | Defect is identified, fix is specified, success is mechanically verifiable | SUB-002 (carry four dropped fields; deep-equal proves it) |
| 🟠 **Opus 4.8** | Substantial engineering against a clear target, with a large surface or opaque failure modes | SUB-001 (save/load hot path), SUB-003 (irreversible user-data migration), SUB-006 (rule engine + false-positive discipline) |
| 🔵 **Fable 5** | The task *defines* semantics, an interface, or a vocabulary that is expensive to change later | SUB-004 (the catalog schema), SUB-005 (language semantics), SUB-007 (graph merge model), SUB-008 (the public agent API) |

This phase is unusually Fable-weighted, and that is the point: four of its eight tasks produce artifacts every later phase depends on and none can cheaply revise. The implementation inside each is often delegable to a lower tier once the design is settled — the task files say where.
