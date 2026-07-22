# PLAT-005: Editor UX Loose Ends

## Metadata

| Field | Value |
|-------|-------|
| **ID** | PLAT-005 |
| **Phase** | Phase 14 — Editor Platform Health (Revival Track B) |
| **Priority** | 🟡 Medium |
| **Difficulty** | 🟢 Easy |
| **Estimated Time** | 2–3 weeks |
| **Prerequisites** | REV-001 |
| **Branch** | `task/plat-005-editor-polish` |
| **Recommended executor** | 🟢 **Sonnet 5** — small, well-bounded fixes with clear acceptance criteria. The one caveat is the STYLE-005 wiring, where two API calls were never verified against the real property panel; if those turn out to be wrong, that specific item escalates to Opus. |

## Objective

Finish the small, high-visibility editor UX work left dangling by the 2026-02-18 stall — most notably wiring the built-but-unconnected STYLE-005 style-suggestion banner into the property panel.

## Background

The February 2026 sprint ended mid-flight, and it left a characteristic residue: features that were built, tested, and committed, but never connected to the UI that would surface them. The viability assessment identified this pattern as the defining feature of the codebase's state — not decay, but interrupted work — and named "Built–not wired" as a distinct status worth tracking.

The clearest example is STYLE-005. The phase-9 progress notes record the StyleAnalyzer as complete with 17 tests and a committed implementation, but also record that **the banner is not wired into the property panel** and that two API calls (`setToken` and `setParameter`) were never verified against the real panel. So the analysis runs, produces suggestions, and nobody ever sees them.

These items are individually small and collectively disproportionate in effect: they are the difference between an editor that feels abandoned and one that feels maintained. They are also good work to interleave between the large refactors in this phase, since they touch different code and carry little risk.

## Current State

Items identified by the viability assessment and the phase-9/phase-3 progress notes (verify each before starting — some may have moved):

| Item | State | Notes |
|---|---|---|
| STYLE-005 style-suggestion banner | Built, not wired | StyleAnalyzer implemented with tests; banner never connected to the property panel; `setToken` / `setParameter` API calls unverified |
| Phase-9 CLEANUP-000H (migration wizard polish) | Not started | The design-token cleanup (~500 hardcoded colours tokenised) landed; polish did not |
| Phase-3 residual UX items | Mixed | Dashboard and app-config work partly done; check `phase-3-editor-ux-overhaul/PROGRESS.md` (and note REV-006 is correcting that file's accuracy) |
| Phase-0 residual | One noted dashboard-routing bug | Recorded in phase-0 notes as complete-with-caveat |

This task deliberately does **not** absorb the large phase-3 items (advanced GitHub integration, shared components, AI project creation). The revival roadmap explicitly cuts those: the GitHub work alone was scoped at 501–662 hours and serves a professional-developer persona that the repositioned product is not chasing.

## Desired State

- Style suggestions from the StyleAnalyzer are visible and actionable in the property panel.
- The small UX loose ends are either finished or explicitly closed as won't-do, with the decision recorded.
- No feature remains in "built but invisible" state without a tracking note.

## Scope

### In Scope
- [ ] Wire the STYLE-005 banner into the property panel, verifying the two unverified API calls
- [ ] Verify the StyleAnalyzer's suggestions are correct and useful on a real project before exposing them
- [ ] CLEANUP-000H migration-wizard polish
- [ ] Triage remaining small phase-3/phase-0 UX items: fix, or close with a recorded reason
- [ ] Fix the noted dashboard-routing bug

### Out of Scope
- Advanced GitHub integration (GIT-005–011) — cut by the revival roadmap
- Shared components, AI project creation, deployment automation from phase 3 — cut or superseded by later revival phases
- Visual redesign (Phase 9's design-token work is done; new design direction is not this task)
- Anything requiring the canvas (PLAT-001 owns it)

## Technical Approach

### Key Files

| File | Changes |
|------|---------|
| `.../views/panels/propertyeditor/` | Mount the style-suggestion banner; verify `setToken` / `setParameter` usage |
| StyleAnalyzer implementation (locate via `phase-9-styles-overhaul/PROGRESS-richard.md` and commit `05379c9`) | No change expected; verify its API surface matches the call sites |

### Note on ordering with PLAT-002

The property editor is being converted from jQuery to React by PLAT-002. If that conversion is already underway when this task starts, **wire the banner into the React version**, not the legacy one — otherwise the work is done twice. Coordinate before starting; if PLAT-002 has not reached the property editor yet, wiring the legacy version is acceptable and PLAT-002 carries it across.

## Implementation Steps

1. **Verify the StyleAnalyzer works.** Before wiring anything, run it against a real project and inspect its suggestions. A banner that surfaces bad suggestions is worse than no banner — this check may reveal that the analyzer needs work before it is user-facing.
2. **Verify the two unverified API calls** (`setToken`, `setParameter`) against the actual property-panel API; correct them if the assumed signatures do not exist.
3. **Wire the banner** into the property panel (React version if PLAT-002 has landed there).
4. **Design the dismissal behaviour** — suggestions that cannot be dismissed become noise. Ensure a user can ignore or permanently dismiss a suggestion.
5. **CLEANUP-000H polish** per the phase-9 notes.
6. **Triage the remaining small items**, fixing or explicitly closing each with a note in the relevant `PROGRESS.md` (coordinating with REV-006, which is correcting those files).
7. **Fix the dashboard-routing bug.**

## Testing Plan

- Style suggestions appear on a real project, are accurate, and can be applied and dismissed.
- Applying a suggestion produces the expected style change and is undoable.
- Migration wizard polish verified against the flows phase-9 describes.
- Editor smoke test: no regressions in the property panel, which is used constantly.

## Success Criteria

- [ ] StyleAnalyzer verified as producing useful suggestions on a real project
- [ ] Banner visible in the property panel; suggestions applicable and dismissible
- [ ] The two previously-unverified API calls confirmed correct
- [ ] Applying a suggestion is undoable
- [ ] CLEANUP-000H complete
- [ ] Remaining small items fixed or explicitly closed with recorded reasons
- [ ] Dashboard-routing bug fixed

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| The StyleAnalyzer's suggestions turn out to be poor | Step 1 checks this before exposing anything; if suggestions are weak, fix the analyzer or defer the banner rather than shipping noise |
| Duplicated work with PLAT-002's property-editor conversion | Coordinate first; wire into the React version if it exists |
| Scope creep into the cut phase-3 features | The Out of Scope list is explicit; cut items stay cut — see the roadmap's "what stays dead" section |
| Suggestion banner becomes visual clutter | Dismissal behaviour is in scope, not optional |

## References

- [Viability report — §3, §5 (phase 9 status)](../../reviews/NOODL-VIABILITY-REPORT.md)
- [Revival roadmap — Track B, and "What stays dead"](../../reviews/NOODL-REVIVAL-ROADMAP.md)
- `dev-docs/tasks/phase-9-styles-overhaul/PROGRESS-richard.md` — STYLE-005 state and the unverified API calls
- Related: PLAT-002 (property-editor conversion), REV-006 (progress-file accuracy)

## Checklist

- [ ] Branch `task/plat-005-editor-polish`; coordinate with PLAT-002 on the property editor
- [ ] Verify StyleAnalyzer output quality on a real project first
- [ ] Verify and correct the two API calls
- [ ] Wire the banner with dismissal behaviour
- [ ] CLEANUP-000H polish; dashboard-routing fix
- [ ] Triage and record decisions on remaining small items
- [ ] CHANGELOG; open PR
