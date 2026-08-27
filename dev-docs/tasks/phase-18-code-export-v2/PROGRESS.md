# Phase 18 Progress — Code Export v2

**Created:** 2026-07-22, from [NOODL-REVIVAL-ROADMAP.md](../../reviews/NOODL-REVIVAL-ROADMAP.md) Track F
**Last updated:** 2026-08-27 (third session)
**Overall status:** 🟡 In progress — 1 / 7 tasks built (EXP-001); EXP-002 steps 1–5 done (IR, hand-written target, walking skeleton, visual-node generator, **stores/events** — `@nodegx/core` is earned by a real fixture now, and the emitted app's whole reactive chain is driven green)

## Status vocabulary

Not started · In progress · **Built–not wired** · Complete · Superseded

## Tasks

| ID | Title | Status | Estimate | Notes |
|---|---|---|---|---|
| [EXP-001](./EXP-001-NODEGX-CORE.md) | `@nodegx/core` companion library | **Built–not wired** | 3 wks | `packages/nodegx-core`. Behaviour contract read from the runtime ([CONTRACT.md](../../../packages/nodegx-core/CONTRACT.md)), API derived by hand-writing the wanted output first ([EXP-001-TARGET-OUTPUT.md](./EXP-001-TARGET-OUTPUT.md)). 69 tests in-package + 8 parity tests running the same scenario through the real interpreter. 2.8 KB gzipped against an 8 KB budget, gated in CI. **No call sites until EXP-002**; npm scope ownership + publish are human-gated |
| [EXP-002](./EXP-002-DETERMINISTIC-GENERATORS.md) | Deterministic generators | **In progress** (started 2026-08-27) | 6–8 wks | Steps 1–4 done: IR designed as the shared contract ([EXP-002-IR-DESIGN.md](./EXP-002-IR-DESIGN.md)), target output hand-written from the real v2 project Puppy test 3 ([EXP-002-TARGET-OUTPUT.md](./EXP-002-TARGET-OUTPUT.md) — headline: zero `@nodegx/core` imports), `packages/nodegx-export` walking skeleton, and the **visual-node generator + style extraction** (analysis stage with dispositions, catalog-driven content-vs-style split, class naming with vocabulary-gated merging, JSX/CSS-module emitter, For Each identity mapping, DbCollection2 typed stubs, RouterNavigate resolution). 45 tests incl. a byte-for-byte PuppyCard golden vs TARGET-OUTPUT §1; emitted app `npm install && npm run build` clean, Landing/ThankYou/PuppyCard render (SSR + jsdom client render with seeded fetch → 2 cards in the grid). **Step 5 done (session 3)**: Variables → `src/stores/variables.ts` (`value()` per variable, writer-typed), Send/Receive Event → `src/events.ts` (typed `channel()`), signal wires compile to handler *actions* (navigate / `.set` / `.emit`) attached to DOM events or `useSignal`, wired `onTextChanged` → `onChange` write-through, `@nodegx/core` joins package.json only when imported. New fixture: **Cheer** (`tests/fixtures/cheer`, MCP-authored `exp002-step5-cheer`); target hand-written first ([EXP-002-STEP5-TARGET-OUTPUT.md](./EXP-002-STEP5-TARGET-OUTPUT.md)); 64 tests, 5 byte-for-byte goldens; emitted Cheer app builds (tsc+vite, local-packed core) and a jsdom drive proves the chain: type → shared variable → badge re-renders; click → event → receiver → Set Variable → banner shows the payload. Also fixed: `tokens.css` now emits the **effective** token set (182 shipped defaults merged with overrides — every prior export had unresolved `var()` refs). **Named-stores slice done (session 4, 2026-08-27)**: the `net.noodl.GlobalStore` family → one module per named store (`store(name, initial)` + state interface from the initial-state literal, writer-typed optional keys), single-key `Subscribe.value → rendered sink` → `useStore(mood, (s) => s.key)` selector hooks, `Set` → `mood.set({ key: expr })` as a fourth handler-action kind, and the write-through pair (`onTextChanged → value` + `textChanged → set`) collapsing into one `onChange`. Target hand-written first ([EXP-002-NAMED-STORES-TARGET-OUTPUT.md](./EXP-002-NAMED-STORES-TARGET-OUTPUT.md), which also decides Collection2's write idiom on paper and defers Model2 with reasons); fixture: Cheer extended via MCP with a Mood page (validated, render-reported, snapshot updated). 80 tests incl. 2 new byte-for-byte goldens; extended app `tsc -b` + `vite build` clean and a jsdom drive proves both pages: type → echo re-renders through the selector, click → `visitorName.get()` lands in the store's theme key. Deferrals all noted: persist, merge/transaction, multi-key/whole-store subscribe, non-literal names, non-string-typed key writes. **Collections slice done (session 5, 2026-08-27)**: a named client-side array (`Collection2` by literal `collectionId`) → one `src/collections/<name>.ts` module (`collection<Item>([])`, item interface = optional-keyed union of statically-known inserted property sets), the `NewModel → CollectionInsert` chain → **one `notes.add({...})`** in the handler that owns `NewModel.new` (conditions: properties statically sourced — wires via the step-5 expr machinery plus a new `literal` expr kind; literal array id; the created object's outputs feed exactly this insert — anything else is Model2 territory and defers), read side `Collection2.items → For Each.items` → `useCollection`, rows keyed by index (append-only by construction; no fabricated ids). Also fixed a silently-wrong step-4 rule found by reading `foreach.tsx`: **a repeater with no mapping script identity-maps the template's inputs at runtime** — the plan's old `[]` fallback emitted prop-less rows; now `'template-inputs'` resolves against the template's props at emit, filtered to fields the item type carries (per-entry drop with a note, both feed paths). Target hand-written first ([EXP-002-COLLECTIONS-TARGET-OUTPUT.md](./EXP-002-COLLECTIONS-TARGET-OUTPUT.md)); fixture: Cheer extended via MCP with a Notes page + NoteRow row component (validated, render-reported, snapshot updated). 92 tests incl. 2 new byte-for-byte goldens; extended app `tsc -b` + `vite build` clean; jsdom drives prove all three pages (Notes: draft write-through → click appends `{text, mood}` → list re-renders, order preserved, input stays uncontrolled). Next: step 6 (statically-knowable logic — Condition/String Format → `derived()`), then Model2. Note: work is on `cline-dev` per repo practice, not the task branch the checklist names |
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
