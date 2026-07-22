# Phase 14 Progress — Editor Platform Health

**Created:** 2026-07-22, from [NOODL-REVIVAL-ROADMAP.md](../../reviews/NOODL-REVIVAL-ROADMAP.md) Track B
**Overall status:** 🔴 Not started — 0 / 5 tasks

## Status vocabulary

Not started · In progress · **Built–not wired** · Complete · Superseded

(The "Built–not wired" state is used deliberately across the revival phases: the viability assessment found several subsystems that were complete by their task spec but had no call sites in the application. Completion means integrated.)

## Tasks

| ID | Title | Status | Estimate | Notes |
|---|---|---|---|---|
| PLAT-001 | Canvas decomposition | Not started | 6–8 wks | Implements the existing `CANVAS-MODERNISATION-PROJECT.md` design; in-place, not a React Flow migration |
| PLAT-002 | Retire the jQuery islands | Not started | 6–8 wks | PopupLayer (1,043 lines) + property-editor legacy views + delete `src/shared/view.js` |
| PLAT-003 | Type the runtime and viewer | Not started | 8–12 wks | 98 `.js` in `noodl-runtime`, 131 in `noodl-viewer-react`; align with SUB-004 |
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
