# PLAT-005: Editor UX Loose Ends

> **Partially delivered 2026-07-26 — see [PLAT-005-NOTES.md](./PLAT-005-NOTES.md).** Three items are
> done in code and covered by 41 new specs: variant persistence (the real bug), StyleAnalyzer
> suggestion quality, and the dashboard-routing bug. **None has had a live editor pass** — the work
> ran from a git worktree, where `lerna exec` drives the main checkout rather than the worktree; the
> exact click-through owed is NOTES §6. CLEANUP-000H and the phase-3/phase-0 UX triage were cut from
> this pass (NOTES §7).
>
> **Correction to the re-scope note below:** it says `ElementConfigRegistry` has no `addVariant` and
> proposes adding one. That would not have persisted anything — `ElementConfigRegistry` is a
> module-level `Map` populated at import time from four hardcoded config files, and none of it is
> written to the project. The real variant system is `ProjectModel.variants` / `VariantModel`
> (`ProjectModel.addVariant` exists at `projectmodel.ts:1165`), reached through
> `NodeGraphNode.createNewVariant`; that is what the fix uses. See NOTES §2.

> **Re-scoped 2026-07-24** by the salvage audit ([PRE-REVIVAL-SALVAGE-AUDIT.md](../../reviews/PRE-REVIVAL-SALVAGE-AUDIT.md) §2). This task's headline premise is stale: **the STYLE-005 banner is already wired** — commit `6e0ad68` mounts `ElementStyleSectionHost` (banner + `useStyleSuggestions`, with localStorage dismissal) from `propertyeditor.ts` via React, and it survived PLAT-002's property-editor rewrite intact. The two "unverified" API calls are verified: `StyleTokensModel.setToken` (`StyleTokensModel.ts:126`) and `NodeGraphNode.setParameter`/`getParameter` (`NodeGraphNode.ts:649/731`). What actually remains of STYLE-005: **(a)** verify suggestion *quality* on a real project (step 1 below — still the right first step), and **(b)** finish the variant-persistence stub — `SuggestionActionHandler.applyVariantAction()` (line 91) only sets `node.setParameter('_variant', name)`; `ElementConfigRegistry` has no `addVariant`, so "save as variant" does not actually create a reusable variant. The rest of the task (CLEANUP-000H, phase-3/0 triage, dashboard-routing bug) stands as written. Related new work: AIX-006 exposes this same styles system to the AI substrate — coordinate if both run.

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
| STYLE-005 style-suggestion banner | ✅ Wired (was already, before this task) | `propertyeditor.ts:144` mounts `ElementStyleSectionHost`. `setToken` / `setParameter` both verified. |
| STYLE-005 variant persistence | ✅ Fixed 2026-07-26 | `applyVariantAction` only wrote the `_variant` marker; no variant was ever created. Now uses `NodeGraphNode.createNewVariant`. NOTES §2. |
| StyleAnalyzer suggestion quality | ✅ Four defects fixed 2026-07-26 | Token-name collisions, occurrence-vs-element counting, zero/unitless spacing, all-candidates-named-`custom`. NOTES §3. **Fixture-verified, not project-verified.** |
| Phase-9 CLEANUP-000H (migration wizard polish) | ⛔ Cut from this pass | Phases 23/24 have been reworking editor chrome since this list was written. NOTES §7. |
| Phase-3 residual UX items | ⛔ Cut from this pass | Same reason. |
| Phase-0 residual | ✅ Dashboard-routing bug fixed 2026-07-26 | Reproduced; cause was `Launcher.tsx` writing `/dashboard/<tab>` onto a `file:` URL, **not** the TASK-001B store migration that three documents blamed. NOTES §4. |

This task deliberately does **not** absorb the large phase-3 items (advanced GitHub integration, shared components, AI project creation). The revival roadmap explicitly cuts those: the GitHub work alone was scoped at 501–662 hours and serves a professional-developer persona that the repositioned product is not chasing.

## Desired State

- Style suggestions from the StyleAnalyzer are visible and actionable in the property panel.
- The small UX loose ends are either finished or explicitly closed as won't-do, with the decision recorded.
- No feature remains in "built but invisible" state without a tracking note.

## Scope

### In Scope
- [x] ~~Wire the STYLE-005 banner into the property panel~~ **Already done (see 2026-07-24 note)** — instead: implement variant persistence. **Done 2026-07-26** via `NodeGraphNode.createNewVariant`, *not* `ElementConfigRegistry.addVariant` (which could not have persisted — NOTES §2). Also fixed a pre-existing undo/redo bug in `createNewVariant` itself, and made token application undoable.
- [x] Verify the StyleAnalyzer's suggestions are correct and useful — **assessed and four defects fixed** (NOTES §3). ⚠️ Fixture-driven only: verified on constructed fixtures, **not on a real project**. Live pass owed (NOTES §6B).
- [ ] ~~CLEANUP-000H migration-wizard polish~~ — cut from this pass (NOTES §7)
- [ ] ~~Triage remaining small phase-3/phase-0 UX items~~ — cut from this pass (NOTES §7)
- [x] Fix the noted dashboard-routing bug — **done 2026-07-26**; both phase-3 issue docs closed with the corrected cause (NOTES §4)

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

- [ ] StyleAnalyzer verified as producing useful suggestions **on a real project** — ⚠️ **not met.** Assessed against fixtures and four defects fixed (NOTES §3); no live project run was possible from a worktree. This is the headline residual.
- [x] Banner visible in the property panel; suggestions applicable and dismissible — wired before this task; dismissal (session + permanent, localStorage) in `useStyleSuggestions`. Applicability fixed for the variant case (NOTES §2). Not clicked live.
- [x] The two previously-unverified API calls confirmed correct — `StyleTokensModel.setToken` (`:126`) and `NodeGraphNode.setParameter`/`getParameter` (`:649`/`:731`).
- [x] Applying a suggestion is undoable — **it was not, for any suggestion type.** Now one `UndoActionGroup` per accept, covering the token write and every parameter rewrite; variants go through `createNewVariant(…, { undo: true })` with its undo/redo bug fixed (NOTES §2.3, §2.4).
- [ ] CLEANUP-000H complete — cut from this pass (NOTES §7)
- [ ] Remaining small items fixed or explicitly closed — phase-3/phase-0 UX triage cut (NOTES §7); the dashboard-routing item is closed with a recorded cause.
- [x] Dashboard-routing bug fixed — reproduced, cause identified (three docs had it wrong), fixed and spec-covered (NOTES §4). Live confirmation owed (NOTES §6C).

### Residual — what a human still has to do

Every item above that is checked is **code-and-specs complete but not seen running**. The precise
click-through is [PLAT-005-NOTES.md §6](./PLAT-005-NOTES.md). The one that matters most is §6A step
6: save, close and reopen the project after saving a variant — that is the only step that proves
persistence, which is the entire point of the fix.

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

- [x] ~~Branch `task/plat-005-editor-polish`~~ — landed on `cline-dev` per house practice; the Branch field above is stale for every task in this repo
- [ ] Verify StyleAnalyzer output quality **on a real project** — not done; fixtures only (NOTES §3, §6B)
- [x] Verify and correct the two API calls
- [x] Wire the banner with dismissal behaviour — already wired; dismissal already present
- [ ] CLEANUP-000H polish — cut (NOTES §7)
- [x] Dashboard-routing fix (NOTES §4)
- [ ] Triage and record decisions on remaining small items — cut (NOTES §7)
- [x] Notes written (`PLAT-005-NOTES.md`); phase-14 has no CHANGELOG, and this repo does not use PRs
