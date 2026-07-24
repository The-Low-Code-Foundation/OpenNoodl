# Phase 14 Progress — Editor Platform Health

**Created:** 2026-07-22, from [NOODL-REVIVAL-ROADMAP.md](../../reviews/NOODL-REVIVAL-ROADMAP.md) Track B
**Overall status:** 🟡 In progress — 1 / 5 tasks complete (PLAT-001, 2026-07-24)

## Status vocabulary

Not started · In progress · **Built–not wired** · Complete · Superseded

(The "Built–not wired" state is used deliberately across the revival phases: the viability assessment found several subsystems that were complete by their task spec but had no call sites in the application. Completion means integrated.)

## Tasks

| ID | Title | Status | Estimate | Notes |
|---|---|---|---|---|
| PLAT-001 | Canvas decomposition | **Complete** (2026-07-24) | 6–8 wks | Coordinator 3,481 → 790; 20 modules; unit + characterisation tests; regression + 500-node perf verified; CHANGELOG in task doc. Optional follow-up: `NodeGraphEditorNode.ts` split (1,290) |
| PLAT-002 | Retire the jQuery islands | In progress (2026-07-24) | 6–8 wks | 547 → 236 `$(` calls (49 files). Dead code deleted; all DataTypes rows + composite widgets + pickers converted to React (waves 1b–2e), and the property-editor **hosts** too (wave 2f: TypeView, Ports, TabGroup, PopoutGroup, BooleanType, propertyeditor shell) — `propertyeditorports.html`/`propertyeditor.html` are gone, only `colorpicker.html` is left in that folder. Shared: ContentPicker, PickerTypeView popout plumbing, PropertyGroups/PropertyTabs. Side catches: fixed a pre-existing core-ui mount-commit bug that corrupted app undo whenever the property panel was open, and restored the style-derived-default refresh that the earlier row conversions had silently dropped. Next: NOTES §8 handoff (wave 2g colour picker; then canvas, PopupLayer) |
| PLAT-003 | Type the runtime and viewer | In progress (2026-07-24) | 8–12 wks | Slice 1 (toolchain) done: `noodl-runtime` had **no TS toolchain and no runnable tests** — 11 of 14 suites collected 0 tests. Now 0 load failures, 235 tests collected (was 132), 215 passing (was 124), `tsc --noEmit` clean. Core (`Node`/`NodeContext`/`NodeScope`) green = the characterisation net Step 3 needs. 20 known behavioural failures documented, not fixed (out of scope). Next: core types vs SUB-004 catalog — see PLAT-003-NOTES.md |
| PLAT-004 | `TSFixme` burn-down | Not started | Ongoing | 554 today; CI ratchet, then falls out of PLAT-002/003 |
| PLAT-005 | Editor UX loose ends | Not started | 2–3 wks | Includes wiring the built-but-dangling STYLE-005 banner from Phase 9 |

## Baseline measurements (2026-07-22)

Captured so progress is provable rather than asserted:

| Metric | Value at phase start |
|---|---|
| jQuery-referencing files | 14 (all in `noodl-editor`; several are vendored bundles) |
| `src/shared/view.js` subclasses | ~21 |
| `TSFixme` occurrences | 554 |
| `nodegrapheditor.ts` | 3,481 lines |
| `views/popuplayer.js` | 1,043 lines (~101 `$(` calls) |
| `noodl-runtime` | 98 `.js` / 6 `.ts` |
| `noodl-viewer-react` | 131 `.js` / 32 `.ts` / 35 `.tsx` |
| `noodl-core-ui` | 1 `.js` / 151 `.ts` / 235 `.tsx` (already modern) |

Re-measure these at each task's completion and record the delta in that task's CHANGELOG.

## Blockers

- All large tasks here should wait for **REV-003** (CI merge gates) — refactoring at this scale without automated regression detection is how contained debt becomes real damage.
