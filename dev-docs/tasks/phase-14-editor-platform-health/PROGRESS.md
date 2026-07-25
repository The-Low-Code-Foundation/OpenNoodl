# Phase 14 Progress — Editor Platform Health

**Created:** 2026-07-22, from [NOODL-REVIVAL-ROADMAP.md](../../reviews/NOODL-REVIVAL-ROADMAP.md) Track B
**Overall status:** 🟡 In progress — 2 / 5 tasks complete (PLAT-001, PLAT-002, both 2026-07-24)

## Status vocabulary

Not started · In progress · **Built–not wired** · Complete · Superseded

(The "Built–not wired" state is used deliberately across the revival phases: the viability assessment found several subsystems that were complete by their task spec but had no call sites in the application. Completion means integrated.)

## Tasks

| ID | Title | Status | Estimate | Notes |
|---|---|---|---|---|
| PLAT-001 | Canvas decomposition | **Complete** (2026-07-24) | 6–8 wks | Coordinator 3,481 → 790; 20 modules; unit + characterisation tests; regression + 500-node perf verified; CHANGELOG in task doc. ~~Optional follow-up: `NodeGraphEditorNode.ts` split (1,290)~~ — shipped in wave 4: 1,290 → 610 (+ stateless `NodeGraphEditorNodePainter`, 466); see PLAT-001-NOTES §11. *(Corrected by DEBT-010, 2026-07-25.)* |
| PLAT-002 | Retire the jQuery islands | **Complete (2026-07-24)** | 6–8 wks | **547 → 0 `$(` calls, 68 → 0 files.** jQuery is gone from the repository: no source usage, no vendored `jquery-min.js`/`jquery.autosize.min.js`, no `<script>` tags, no `@types/jquery`, and **all 34 runtime `.html` templates deleted** along with webpack's now-unused `html-loader` rule. Waves 1a–4 converted the dead code, every `DataTypes` row/widget/picker, the property-editor hosts, the standalone popups and PopupLayer itself (TypeScript + native DOM, React for the popups that are components). Wave 5a took the utility modules (`$.ajax` → fetch, `$(':focus')` → a real focus check). Wave 5b took the framework: `shared/view.js` + `view.d.ts` → a 35-line typed `view.ts` that is only the listener bus, the last two templates rebuilt in code (`CanvasShell.ts` hands the canvas shell's nine layers back as typed refs instead of `el.find('#...')`), `ReactView` de-jQueried, and the `el.jquery ? el[0] : el` normalisers removed everywhere. The original inventory had missed `src/frames/viewer-frame/` entirely — a second `View` subclass with its own template. Narrowing the types surfaced **two live wave-4 regressions**: the detached viewer window threw on boot (`PopupLayer.render().get(0)`) so its inspect menu was dead, and three callers still passed `content: { el: [div] }`. tsc clean, **1060 specs / 0 failures**, editor + detached viewer driven live via CDP. Follow-ups (rename the bus, `flushSync` sweep, `Ports` root disposal, the unverified import-popup variants) are itemised in PLAT-002-NOTES §8 |
| PLAT-003 | Type the runtime and viewer | In progress (2026-07-24) | 8–12 wks | **Slices 1–8 done as of 2026-07-24** (this cell's prose below narrates only slices 1–4; see PLAT-003-NOTES for 5–8, and note the live pass it says is owed was paid by DEBT-002 — correction by DEBT-010, 2026-07-25.) Slices 1–2 detail: Slice 1 (toolchain): `noodl-runtime` had **no TS toolchain and no runnable tests** — 11 of 14 suites collected 0 tests; now 0 load failures and `tsc --noEmit` clean. Slice 2 (spec steps 1, 3, 4): **node-definition API published** as `@noodl/types/src/runtime/node-definition.d.ts`, sharing SUB-004's catalog vocabulary by import so the two cannot drift, with all five dynamic-port mechanisms modelled honestly; **12 core files converted** (node, nodedefinition, nodescope, nodecontext, noderegister, outputproperty, eventsender, edgetriggeredinput, variants, guid, utils, async-pool), ~2,500 lines; runtime internals kept unpublished in `src/internal.d.ts`. Conversion pipeline de-risked with a dedicated ts-loader instance (`webpack-ts-rule.js`) since the runtime is CommonJS and both viewers compile ESM; `noodl-viewer-cloud` moved to its own `typecheck:cloud`. Tests 225 pass (was 215) / 20 pre-existing failures; all 3 viewer bundles + 2 cloud bundles + preview esbuild green; `catalog:check` byte-identical across 135 node types. Also removed 16 leftover emoji `console.log`s, three of them per-signal-per-frame. Slice 3 (step 6): `react-component-node.js` → `.ts` (1,189 lines), the compiler between React node authoring and the runtime definition, with `ReactNodeDefinition`/`ReactNodeInstance` published from it; four latent defects found and documented. Slice 4 (step 7, first group): all nine `nodes/visual/*.js` → `.ts`, **annotated** against `ReactNodeDefinition`/`NodeDefinitionOptions` rather than merely renamed. That slice hit the ESM/CJS boundary for the first time — a viewer `.ts` importing `@noodl/runtime/src/utils` pulled a CommonJS runtime file into the viewer's ESM program; fixed by giving that module named exports, and the general fix (ship `.d.ts` from `@noodl/runtime`) is queued as its own slice. Slice 3's `inputs`/`outputs` types were wrong for React nodes and its first consumers proved it — `ReactInputDefinition`/`ReactOutputDefinition` added. New findings: `Noodl.runDeployed` is never set, so deployed bundles still carry editor-only tooltip HTML (the real flag is `Noodl.deployed`), and `propPath` on an ordinary input is inert. Viewer file counts 107/31/35 → **97 `.js` / 41 `.ts` / 35 `.tsx`**; `catalog:check` byte-identical at every step. **Still owed: a live editor pass** — blocked while PLAT-002 has the editor mid-conversion. Next: remaining viewer nodes (std-library, navigation) — see PLAT-003-NOTES.md §12 |
| PLAT-004 | `TSFixme` burn-down | In progress (2026-07-24) | Ongoing | **Mechanism complete** — `scripts/tsfixme-ratchet.js` + `.tsfixme-baseline.json`, wired into the `lint` job in `pr.yml`, policy documented in CODING-STANDARDS.md, clustering report at `dev-docs/reference/TYPE-ESCAPE-HATCHES.md`. Baseline now **568** `TSFixme` at `0395b24` (581 when the mechanism landed at `3a302b9`), 392 `any`, 22 `@ts-ignore`, 88 `@ts-expect-error`, each gated separately so trading one marker for another still fails. Note the phase-start figure was 554: the count **rose** during Phase 14 even as PLAT-002/003 removed markers, because new work added them faster — which is the argument for the ratchet. Counter uses the TS parser, not grep (a scanner-based draft silently lost comments in 8 files); verified against per-file grep across all 1,549 files. First burn-down slice done: `noodl-preview` 16 → 3 `TSFixme`, the 3 remaining documented in place as blocked on the untyped exporter; typing the test helpers required naming the preview server's HTTP contract (`PreviewStatus`/`PreviewEvent`) and surfaced four real defects in its specs. The rest of the burn-down is deferred to PLAT-002/003, whose files it deliberately does not touch. See PLAT-004-NOTES.md |
| PLAT-005 | Editor UX loose ends | Not started | 2–3 wks | Includes wiring the built-but-dangling STYLE-005 banner from Phase 9 |

## Baseline measurements (2026-07-22)

Captured so progress is provable rather than asserted:

| Metric | Value at phase start |
|---|---|
| jQuery-referencing files | 14 (all in `noodl-editor`; several are vendored bundles) — the real figure at PLAT-002's start was **68 source files / 547 `$(` calls**; now **0** |
| `src/shared/view.js` subclasses | ~21 |
| `TSFixme` occurrences | 554 |
| `nodegrapheditor.ts` | 3,481 lines |
| `views/popuplayer.js` | 1,043 lines (~101 `$(` calls) — now TypeScript, 0 |
| `noodl-runtime` | 98 `.js` / 6 `.ts` |
| `noodl-viewer-react` | 131 `.js` / 32 `.ts` / 35 `.tsx` |
| `noodl-core-ui` | 1 `.js` / 151 `.ts` / 235 `.tsx` (already modern) |

Re-measure these at each task's completion and record the delta in that task's CHANGELOG.

## Blockers

- All large tasks here should wait for **REV-003** (CI merge gates) — refactoring at this scale without automated regression detection is how contained debt becomes real damage.
