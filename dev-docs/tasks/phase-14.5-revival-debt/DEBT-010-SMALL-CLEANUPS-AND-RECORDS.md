# DEBT-010: Small Cleanups & Record-Keeping

## Metadata

| Field | Value |
|-------|-------|
| **ID** | DEBT-010 |
| **Phase** | Phase 14.5 — Revival Debt |
| **Priority** | 🟢 Low |
| **Difficulty** | 🟢 Easy |
| **Estimated Time** | 2–3 days |
| **Prerequisites** | None |
| **Recommended executor** | 🟢 **Sonnet 5** — each item is small, bounded, and documented at its source |

## Objective

Sweep the small unowned leftovers from the 2026-07-24 audit: mechanical code cleanups from PLAT-002 §8, and the record-keeping corrections that keep the task docs from lying to the next reader.

## Scope

### Code cleanups (each sourced in [PLAT-002-NOTES.md §8](../phase-14-editor-platform-health/PLAT-002-NOTES.md) unless noted)

- [ ] **Rename [shared/view.ts](../../../packages/noodl-editor/src/shared/view.ts)** — it is an event bus, not a view framework; the name misleads post-jQuery. ~10–11 subclasses; mechanical rename + import sweep.
- [ ] **`Ports.renderGroups` React-root leak** ([Ports.ts](../../../packages/noodl-editor/src/editor/src/views/panels/propertyeditor/DataTypes/Ports.ts)) — rebuilds row views each panel render without disposing the old roots; dispose `this.views` before rebuilding.
- [ ] **`flushSync` sweep** — `Pages.tsx`, `TextStylePicker.jsx`, `propertyeditors.jsx`, `useComponentActions` create their own React roots without `flushSync`, so their popup boxes measure 0×0. Apply the same fix PLAT-002 used elsewhere.
- [ ] **Hover tooltips on converted property rows** — not reproduced during conversion; restore.
- [ ] **`viewer.js` webview blur→refocus binding** — dead since forever; PLAT-002 deliberately left it as a *behaviour decision*. Decide (recommend: delete the dead binding; enabling refocus is a UX change nobody asked for) and record.
- [ ] **dugite fallback-path log noise** ([REV-002-NOTES.md](../phase-12-reanimation/REV-002-NOTES.md) lines 98–104) — silence the fallback spam, if DEBT-005 didn't already take it.

### Record-keeping (docs asserting things that are false)

- [ ] **Phase-14 [PROGRESS.md](../phase-14-editor-platform-health/PROGRESS.md)**: the `NodeGraphEditorNode` split is listed as an outstanding optional follow-up — it shipped (1,290→608, PLAT-001-NOTES §11). The PLAT-003 cell says "slices 1–2 done" (actual: 1–7, only `navigation/` remains). TSFixme figures stale (actual baseline: 540/287 at `78ba241`).
- [ ] **[PLAT-003-NOTES.md](../phase-14-editor-platform-health/PLAT-003-NOTES.md) header**: says "slices 1–5 landed… resume from §14" — actual resume point is §18.
- [ ] **[PLAT-004 spec](../phase-14-editor-platform-health/PLAT-004-TSFIXME-BURNDOWN.md)** success criterion cites 538 — superseded by the committed 540 baseline.
- [ ] **Phase-2 `TASK-005-new-nodes`**: marked Complete with **zero code** (REV-006's own finding, never actioned). Re-mark honestly (Not started / Superseded — check whether phase-13's catalog work or later node additions absorbed its intent) and note who, if anyone, should own it.
- [ ] **REV-002/REV-010 checklist hygiene**: REV-002's `[ ] Open PR` box (moot under the no-PR convention — annotate rather than delete) and REV-010's unchecked success-criteria boxes whose body text says verified.

### Out of Scope

- Anything DEBT-002's live pass turns up (that pass owns its own findings)
- The larger PLAT-002 deferrals already owned elsewhere (import-popup verification → DEBT-002)

## Success Criteria

- [ ] All §8 code cleanups landed with the editor smoke-tested after (property panel especially — `Ports` and the popups are high-traffic)
- [ ] Every listed doc corrected; no phase doc asserts stale line counts, slice counts, or phantom completions
- [ ] Each "decide" item (viewer.js binding, TASK-005 disposition) carries a recorded decision, not just a change

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| The `view.ts` rename touches ~11 subclasses across a live codebase | Pure mechanical rename with typecheck as the gate; land it in one commit so it's trivially revertable |
| Doc edits collide with in-flight PLAT-003/PLAT-004 sessions updating the same files | Correct only the *stale-as-of-today* facts; leave live-session sections alone and note the correction date |

## References

- [PLAT-002-NOTES.md §8](../phase-14-editor-platform-health/PLAT-002-NOTES.md) — the "what this task leaves behind" list
- Audit of 2026-07-24 (phase README) — the staleness inventory
