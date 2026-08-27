# Phase 18 Progress — Code Export v2

**Created:** 2026-07-22, from [NOODL-REVIVAL-ROADMAP.md](../../reviews/NOODL-REVIVAL-ROADMAP.md) Track F
**Last updated:** 2026-08-27
**Overall status:** 🟡 In progress — 1 / 7 tasks built (EXP-001); EXP-002 started 2026-08-27 (IR designed, target output hand-written, walking skeleton builds)

## Status vocabulary

Not started · In progress · **Built–not wired** · Complete · Superseded

## Tasks

| ID | Title | Status | Estimate | Notes |
|---|---|---|---|---|
| [EXP-001](./EXP-001-NODEGX-CORE.md) | `@nodegx/core` companion library | **Built–not wired** | 3 wks | `packages/nodegx-core`. Behaviour contract read from the runtime ([CONTRACT.md](../../../packages/nodegx-core/CONTRACT.md)), API derived by hand-writing the wanted output first ([EXP-001-TARGET-OUTPUT.md](./EXP-001-TARGET-OUTPUT.md)). 69 tests in-package + 8 parity tests running the same scenario through the real interpreter. 2.8 KB gzipped against an 8 KB budget, gated in CI. **No call sites until EXP-002**; npm scope ownership + publish are human-gated |
| [EXP-002](./EXP-002-DETERMINISTIC-GENERATORS.md) | Deterministic generators | **In progress** (started 2026-08-27) | 6–8 wks | Steps 1–3 done: IR designed as the shared contract ([EXP-002-IR-DESIGN.md](./EXP-002-IR-DESIGN.md)), target output hand-written from the real v2 project Puppy test 3 ([EXP-002-TARGET-OUTPUT.md](./EXP-002-TARGET-OUTPUT.md) — headline: the whole project exports with zero `@nodegx/core` imports), and `packages/nodegx-export` walking skeleton (IR types, v2 parser, scaffold emitter; 16 tests; emitted app `npm install && npm run build` verified clean). Next: visual-node generator + style extraction (step 4). Note: work is on `cline-dev` per repo practice, not the task branch the checklist names |
| EXP-003 | AI logic translation + trace verification | Not started | 6–8 wks | **The 2026 addition** — machine-checked translation of Function/Expression/dynamic-port nodes |
| EXP-004 | Export report & honesty UX | Not started | 1 wk | What exported clean, what is best-effort, what needs review |
| EXP-005 | Multi-framework pipeline | Not started | 4–6 wks | AI ports the *exported React* to Svelte/Vue, same trace harness — not native multi-compilers |
| [EXP-006](./EXP-006-EXPORT-AUTHORING-INTENT.md) | Export carries authoring intent | Not started | 1–1.5 wks | Node comments, wire labels, authored titles and comment-box regions become comments and identifiers. Design is [CAN-005](../phase-28-canvas-legibility/CAN-005-EXPORT-AUTHORING-INTENT.md); rescues CODE-008 (F57). Blocked on EXP-002 |
| [EXP-007](./EXP-007-EXPORT-PROVENANCE.md) | Export provenance & regeneration safety | Not started | 1 wk | Generated files carry node id, component, catalog/exporter version and a content hash, so a re-export knows what a human has edited. Harvests `FileChangeTracker` from the [Rise assessment](../../../docs/research/rise-assessment.md). Same injection point as EXP-006, different payload. Blocked on EXP-002 |

## Relationship to the original Phase 7

This phase **supersedes** `dev-docs/tasks/phase-7-code-export/` rather than replacing its thinking. That phase's design work — the companion-library approach, per-node-type generators, the ts-morph pipeline — is sound and is what EXP-001/002 implement. What this phase adds is:

1. **Funding and sequencing.** Phase 7 sat at 0 of 8 tasks with no start date. Here it is scheduled after the Phase 13 substrate work, because generators and LLMs both consume per-component files plus a node catalog.
2. **EXP-003, which did not exist in 2025.** The original design and the earlier `CODE-EXPORT-STUDY.md` both concluded that translating Function and Expression nodes was the intractable part, and proposed leaving TODO comments. Machine-verified AI translation is a genuinely new option, and it changes the achievable fidelity.
3. **EXP-005's reframing of multi-framework support.** Rather than maintaining N compiler backends, export to React once and let AI port the output, verified by the same trace harness.

~~Mark `phase-7-code-export/PROGRESS.md` as superseded when EXP-001 begins.~~ Done, 2026-08-07.

**CODE-008 is resolved — it is [EXP-006](./EXP-006-EXPORT-AUTHORING-INTENT.md) now** (2026-07-29).
`phase-7-code-export/CODE-008-node-comments-export.md` specs node-comment export in full detail, and
nothing in EXP-001…005's scope mentioned comments, labels or titles — so stamping phase 7 superseded
would have orphaned a complete design referenced by nothing live. That was phase 28's finding F57; the
scope now lives in EXP-006, with the expanded version from
[CAN-005](../phase-28-canvas-legibility/CAN-005-EXPORT-AUTHORING-INTENT.md) (wire labels, authored
titles and comment-box regions as well as node comments) and CODE-008's formatters adopted rather than
rewritten. Phase 7 can be stamped without losing anything.

## Phase-level prerequisites

- **SUB-001** (Phase 13) — the editor reads and writes per-component v2 files
- **SUB-004** (Phase 13) — the node catalog gives generators a typed vocabulary of node types and ports
- **SUB-005** is highly desirable — semantic descriptions materially improve AI translation quality
- **RUN-001** (Phase 16) — export targets React 19, so the runtime should be there too

## The honest expectation

Export fidelity will always be a spectrum. UI-heavy projects should export to clean, idiomatic code. Projects built largely from Function nodes, expressions, and dynamic ports will export to code that needs human review. EXP-004 exists to make that spectrum visible to the user rather than surprising them. The viability assessment's ranking stands: **React-only export is realistic and is enough**; direct multi-framework export from the graph is not promised.
