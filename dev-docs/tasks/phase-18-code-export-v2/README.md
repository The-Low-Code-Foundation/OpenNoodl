# Phase 18: Code Export v2 (Revival Track F)

**Status:** 🟡 In progress — EXP-001 built (2026-08-07)
**Total Estimated Effort:** 20-26 weeks (tasks overlap; calendar ~4-6 months)
**Source:** `dev-docs/reviews/NOODL-REVIVAL-ROADMAP.md` — Track F (F-01..F-05)
**Design Input:** `dev-docs/tasks/phase-7-code-export/` (complete 12-16 wk design, 0% built)

---

## What This Phase Is

Phase 18 is the **funded execution of phase 7's code-export design**, plus what 2026 makes possible that the 2025 design could not assume: AI-assisted translation of the runtime-interpreted parts, **verified mechanically by a trace harness** instead of trusted on faith.

The phase-7 docs (`CODE-EXPORT-overview.md`, `CODE-001`..`CODE-008`) remain the design of record — companion library `@nodegx/core` (~8KB reactive primitives preserving Noodl's push-signal semantics), per-node-type generators, ts-morph AST + Prettier output, Vite scaffold, React 19 target. None of it was ever built: `phase-7-code-export/PROGRESS.md` records 0/8 tasks, and no `@nodegx/core` or codegen code exists anywhere in `packages/`. This phase does not redesign that work; it executes it, re-sequenced and extended.

## Why Export Matters

Export is the anti-lock-in answer. The strategic pitch of OpenNoodl is comprehension and ownership — and ownership is hollow if projects can never leave the tool. The exit criterion for this phase, taken verbatim from the revival roadmap:

> **A UI-heavy real project exports to a React 19 + Vite repo that builds, passes trace verification, and a React developer accepts as inheritable.**

Two architectural facts make this feasible (both verified in code):

1. **The runtime node model is framework-neutral.** `packages/noodl-runtime/src` contains zero React imports; only ~27 of ~100 node types are React-bound, via a single binding hub (`packages/noodl-viewer-react/src/react-component-node.js`). The graph really is a spec that generators can consume.
2. **The hard cases are known and bounded.** They are the runtime-interpreted dynamics: Function nodes compile user code via `new AsyncFunction` with Proxy-discovered dynamic output ports (`packages/noodl-runtime/src/nodes/std-library/simplejavascript.js:19-37,187`), Expression nodes compile strings via `new Function` (`expression-evaluator.js:177`), and dynamic ports generally (`dev-docs/reference/LEARNINGS.md:1288-1300`). Deterministic generators cannot fully capture these — which is exactly what EXP-003's AI translation + trace verification addresses.

## What 2026 Adds to the 2025 Design

- **EXP-003 (AI logic translation + trace harness):** LLMs translate Function/Expression/dynamic-port nodes against the documented `@nodegx/core` API. Every translation is checked by running the original (interpreted) and exported (compiled) versions side-by-side on recorded input/output traces; humans review only mismatches. The study's hardest problem becomes machine-checked instead of trusted.
- **EXP-005 (multi-framework via post-processing):** Svelte/Vue arrive by AI-porting the *exported React codebase*, verified by the same trace harness — explicitly **not** by maintaining N native compilers.

## Phase-Level Prerequisites

Sequenced **after phase 13 (Revival Track A — Format & AI Substrate)**, because generators and LLMs both consume the same substrate:

- **SUB-001 (phase-13):** editor natively reads/writes the v2 decomposed format — generators walk per-component files instead of a monolithic `project.json`.
- **SUB-004 (phase-13):** the node catalog (`node-catalog.json` generated from `noderegister.js` metadata) — the enumerable node/port/parameter vocabulary both the deterministic generators and the EXP-003 LLM prompts are built against.

## Task List

| Task | Name | Effort | Depends On |
|------|------|--------|------------|
| EXP-001 | `@nodegx/core` companion library | 3 wks | phase-13 SUB-004 |
| EXP-002 | Deterministic generators | 6-8 wks | EXP-001 |
| EXP-003 | AI logic translation + trace harness | 6-8 wks | EXP-001, EXP-002 |
| EXP-004 | Export report & honesty UX | 1 wk | EXP-002, EXP-003 |
| EXP-005 | Multi-framework pipeline (Svelte/Vue) | 4-6 wks | EXP-002, EXP-003 |
| EXP-006 | Export carries authoring intent | 1-1.5 wks | EXP-002 |
| EXP-007 | Export provenance & regeneration safety | 1 wk | EXP-002 |

EXP-001/002 are the mechanical ~70% (phase-7 CODE-001/002/003/005/006, updated). EXP-003 is the new hard part made tractable. EXP-004 keeps the honesty framing `dev-docs/future-projects/CODE-EXPORT-STUDY.md` was right about. EXP-005 dissolves the last lock-in objection.

## Out of Scope (Phase-Level)

- **Round-trip editing** of exported code back into the graph (per phase-7 overview "Out of Scope").
- **Database/cloud node full export** — generated as typed API-service stubs (per CODE-EXPORT-STUDY's proposal), not working backends.
- **Native multi-framework compilers** — the roadmap's "what stays dead" list is explicit; EXP-005 is post-processing only.
- **SSR/SSG export targets** — client-side Vite app first; SSR export can follow Track D's D-02 if demanded.

## References

- `dev-docs/reviews/NOODL-REVIVAL-ROADMAP.md` §3 Track F, §5 (what stays dead)
- `dev-docs/tasks/phase-7-code-export/CODE-EXPORT-overview.md` (ADR-001 companion library, ADR-002 ts-morph, ADR-003 styling)
- `dev-docs/future-projects/CODE-EXPORT-STUDY.md` (why export is hard; expectations framing)
