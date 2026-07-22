# Phase 18 Progress — Code Export v2

**Created:** 2026-07-22, from [NOODL-REVIVAL-ROADMAP.md](../../reviews/NOODL-REVIVAL-ROADMAP.md) Track F
**Overall status:** 🔴 Not started — 0 / 5 tasks

## Status vocabulary

Not started · In progress · **Built–not wired** · Complete · Superseded

## Tasks

| ID | Title | Status | Estimate | Notes |
|---|---|---|---|---|
| EXP-001 | `@nodegx/core` companion library | Not started | 3 wks | Reactive primitives preserving push-signal semantics (phase-7 CODE-001 design) |
| EXP-002 | Deterministic generators | Not started | 6–8 wks | Visual nodes, state stores, events, routing, scaffolding — "the mechanical 70%" |
| EXP-003 | AI logic translation + trace verification | Not started | 6–8 wks | **The 2026 addition** — machine-checked translation of Function/Expression/dynamic-port nodes |
| EXP-004 | Export report & honesty UX | Not started | 1 wk | What exported clean, what is best-effort, what needs review |
| EXP-005 | Multi-framework pipeline | Not started | 4–6 wks | AI ports the *exported React* to Svelte/Vue, same trace harness — not native multi-compilers |

## Relationship to the original Phase 7

This phase **supersedes** `dev-docs/tasks/phase-7-code-export/` rather than replacing its thinking. That phase's design work — the companion-library approach, per-node-type generators, the ts-morph pipeline — is sound and is what EXP-001/002 implement. What this phase adds is:

1. **Funding and sequencing.** Phase 7 sat at 0 of 8 tasks with no start date. Here it is scheduled after the Phase 13 substrate work, because generators and LLMs both consume per-component files plus a node catalog.
2. **EXP-003, which did not exist in 2025.** The original design and the earlier `CODE-EXPORT-STUDY.md` both concluded that translating Function and Expression nodes was the intractable part, and proposed leaving TODO comments. Machine-verified AI translation is a genuinely new option, and it changes the achievable fidelity.
3. **EXP-005's reframing of multi-framework support.** Rather than maintaining N compiler backends, export to React once and let AI port the output, verified by the same trace harness.

Mark `phase-7-code-export/PROGRESS.md` as superseded when EXP-001 begins.

## Phase-level prerequisites

- **SUB-001** (Phase 13) — the editor reads and writes per-component v2 files
- **SUB-004** (Phase 13) — the node catalog gives generators a typed vocabulary of node types and ports
- **SUB-005** is highly desirable — semantic descriptions materially improve AI translation quality
- **RUN-001** (Phase 16) — export targets React 19, so the runtime should be there too

## The honest expectation

Export fidelity will always be a spectrum. UI-heavy projects should export to clean, idiomatic code. Projects built largely from Function nodes, expressions, and dynamic ports will export to code that needs human review. EXP-004 exists to make that spectrum visible to the user rather than surprising them. The viability assessment's ranking stands: **React-only export is realistic and is enough**; direct multi-framework export from the graph is not promised.
