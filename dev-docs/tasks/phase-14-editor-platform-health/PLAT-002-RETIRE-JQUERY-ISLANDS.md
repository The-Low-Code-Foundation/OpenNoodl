# PLAT-002: Retire the jQuery Islands

## Metadata

| Field | Value |
|-------|-------|
| **ID** | PLAT-002 |
| **Phase** | Phase 14 — Editor Platform Health (Revival Track B) |
| **Priority** | 🟠 High |
| **Difficulty** | 🟡 Medium (large volume, well-understood pattern) |
| **Estimated Time** | 6–8 weeks |
| **Prerequisites** | REV-003 (CI merge gates) |
| **Branch** | `task/plat-002-retire-jquery-islands` |
| **Recommended executor** | 🟠 **Opus 4.8** — high-volume conversion with an established target pattern, but each legacy view encodes undocumented behaviour that must be preserved. Sonnet can handle individual simple `DataTypes/*` conversions once the first few set the precedent. |

## Objective

Rebuild the remaining jQuery-based views in React using the existing `ReactView` and `noodl-core-ui` patterns, and delete the homegrown jQuery view framework and vendored jQuery when the last subclass is gone.

## Objective in context

This is a finishing task, not a rescue. The viability assessment found the jQuery/React boundaries to be genuinely well-managed — the question here is whether to keep managing them forever or to remove the seam.

## Background

OpenNoodl's editor predates its React adoption. The original UI was built on a homegrown jQuery MVC framework: a `View` base class providing template binding (`data-template`, `data-text`, `data-click`, and similar attributes) and property watching via getter/setter definition. Over time most of the editor migrated to React — `noodl-core-ui` is now entirely modern, and substantial panels such as VersionControlPanel are fully React — but a residue remains.

The residue is small and precisely located. jQuery appears in 14 files, all within `noodl-editor`, several of which are vendored bundles rather than source. It is not an npm dependency; `jquery-min.js` sits in `src/assets/lib/` and is provided as a webpack global. Real usage clusters in two subsystems (PopupLayer and the property editor), plus the canvas shell and the `View` base class itself, which has roughly 21 subclasses.

Critically, the boundaries are already contained. `src/shared/ReactView.ts` gives React its own private div and a single persistent root; property-editor rows mount React pickers into freshly created elements; PopupLayer hosts React content without containing any itself. The rules are documented in `dev-docs/reference/LEARNINGS.md` and, as far as the assessment could tell, consistently followed.

So this task is not about danger; it is about cost. Maintaining two UI paradigms means every contributor must learn which rules apply where, every new panel faces a choice that should not exist, and the `TSFixme` count stays high because the seams are where types go to die. With budget available, finishing the migration is straightforwardly worth it.

## Current State

Legacy views by size (the conversion queue):

| File | Lines | Notes |
|---|---|---|
| `views/popuplayer.js` | 1,043 | ~101 `$(` calls; hosts React content from callers |
| `views/panels/propertyeditor/resizingview.js` | 314 | Layout/resize controls |
| `views/panels/propertyeditor/proplist.js` | 292 | Property list container |
| `views/importpopup.js` | 270 | |
| `views/panels/propertyeditor/marginpaddingview.js` | 230 | |
| `views/lessons/lessonevalconditions.js` | 212 | Coordinate with LEARN-001 (Phase 17), which revives lessons |
| `views/panels/propertyeditor/DataTypes/StringList/stringlist.js` | 177 | |
| `views/panels/propertyeditor/fontpicker.js` | 176 | |
| `views/panels/propertyeditor/imagepicker.js` | 125 | |
| `views/panels/propertyeditor/colorpicker.js` | 123 | |
| `views/panels/propertyeditor/aligntools.js` | 121 | |
| `src/shared/view.js` | 278 | The base class — deleted last |

Also: `views/projectsview.ts` uses jQuery heavily (~65 `$(` calls) despite being TypeScript, and various `DataTypes/*.ts` files mix jQuery rows with React pickers.

The target pattern already exists and works: `src/shared/ReactView.ts` (React in a private div with one `createRoot`), plus the `noodl-core-ui` component library for the actual UI.

## Desired State

- Zero jQuery in the repository: no `$(` usage in source, no vendored `jquery-min.js`, no webpack global provision.
- `src/shared/view.js` and its template-binding mechanism deleted.
- All former legacy views implemented in React with `noodl-core-ui` components, typed, and tested.
- The 47 runtime-loaded `.html` templates that fed `bindView` removed along with their consumers.

## Scope

### In Scope
- [x] Convert PopupLayer to React (the largest and most-depended-upon piece) — wave 4; the
      layer itself is TypeScript + native DOM (it hosts foreign content), its popups are React
- [x] Convert the property-editor legacy views and `DataTypes/*` rows — waves 1b–2g
- [x] Convert the remaining smaller views (import popup, pickers, align tools) — waves 2e–3
- [x] Convert `projectsview.ts`'s jQuery usage — wave 1a; it had zero importers and was deleted
- [ ] Delete `src/shared/view.js`, vendored jQuery, the webpack global, and orphaned `.html` templates
- [x] Type everything converted (no new `TSFixme`) — the ratchet is 19 markers below baseline
- [ ] Tests for converted components

### Out of Scope
- The canvas shell's jQuery binding (PLAT-001 owns `nodegrapheditor.ts`; coordinate, and remove its jQuery only once PLAT-001 has landed)
- Visual redesign — convert behaviour faithfully; design changes belong to PLAT-005 or Phase 9
- The lessons views if LEARN-001 is rewriting them anyway (check before converting `lessonevalconditions.js`)

## Technical Approach

### Order of work

Convert **leaves before hosts**. The property-editor `DataTypes` rows and pickers are numerous, small, and independent — they build momentum, establish the conversion idiom, and reduce PopupLayer's caller surface. PopupLayer itself comes late, because converting it while many callers still hand it jQuery-wrapped elements means supporting both interfaces at once.

For each view: read it fully, note every behaviour including the undocumented ones (focus handling, keyboard shortcuts, click-outside dismissal, blur-commit semantics — these are exactly what gets lost in conversions), build the React equivalent from `noodl-core-ui` primitives, wire it through the existing call sites, and delete the original plus its `.html` template.

### Key Files

Modified: every file listed in Current State, plus their call sites and `webpackconfigs/shared/webpack.shared.js` (removing the jQuery ProvidePlugin entry at the end).

New: React components under `views/panels/propertyeditor/` and a React `PopupLayer` — following existing `noodl-core-ui` conventions rather than inventing new ones.

## Implementation Steps

1. **Inventory and triage.** List every `View` subclass and every `$(` call site; mark each as convert / delete / defer-to-another-task (lessons, canvas).
2. **Establish the idiom** by converting two or three small `DataTypes` rows and reviewing them carefully. Everything after follows this precedent.
3. **Convert the property editor** view by view, landing each as its own PR so regressions are attributable.
4. **Convert the standalone popups and pickers.**
5. **Convert `projectsview.ts`.**
6. **Convert PopupLayer** once its callers no longer pass jQuery elements. Expect this to be the hardest single piece: it manages stacking, dismissal, positioning, and keyboard interaction for the whole editor.
7. **Delete the framework**: `src/shared/view.js`, vendored jQuery, the webpack global, and every orphaned `.html` template. Confirm with a repository-wide grep that nothing remains.

## Testing Plan

- Per-conversion manual testing against a behaviour checklist written *before* conversion (from step 1's inventory) — focus, keyboard, dismissal, and commit semantics especially.
- Component tests for converted React components.
- Full editor smoke test after each PR; property editing is used constantly, so regressions here are highly visible.
- Final verification: `grep -rn '\$(' packages/noodl-editor/src` returns nothing meaningful; the app builds and runs without the jQuery global.

## Success Criteria

- [ ] No jQuery source usage remains in `noodl-editor` (canvas excepted only if PLAT-001 is still in flight)
- [ ] `src/shared/view.js`, vendored `jquery-min.js`, and the webpack global removed
- [ ] Orphaned `.html` templates deleted
- [ ] All converted views typed with no new `TSFixme`
- [ ] Behaviour checklists pass for every converted view
- [ ] Editor builds and runs with no functional regressions

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Undocumented behaviours (focus, keyboard, dismissal) lost in conversion | Write a behaviour checklist per view *before* converting; test against it after |
| PopupLayer conversion destabilises the whole editor UI | Convert it last, after callers stop passing jQuery elements; land behind a flag if feasible |
| Conversion collides with PLAT-001 on the canvas | Explicit boundary: PLAT-001 owns `nodegrapheditor.ts`; this task takes its jQuery only after PLAT-001 lands |
| Lessons views converted then rewritten by LEARN-001 | Check with Phase 17 before touching `lessons/` |

## References

- [Viability report — §4.4 and Appendix E](../../reviews/NOODL-VIABILITY-REPORT.md)
- `dev-docs/reference/LEARNINGS.md` — legacy/React separation rules and the `ReactView` pattern
- `packages/noodl-editor/src/shared/ReactView.ts` — the bridge to follow
- Related: PLAT-001 (canvas), PLAT-004 (`TSFixme` falls as a side effect), LEARN-001 (lessons)

## Checklist

- [x] ~~Branch `task/plat-002-retire-jquery-islands`~~ — work lands directly on `cline-dev`
- [x] Inventory all `View` subclasses and `$(` call sites; triage (PLAT-002-NOTES §1–§2)
- [x] Establish conversion idiom on 2–3 small views; review (wave 1b)
- [x] Convert property editor, then popups/pickers, then `projectsview` (waves 1a–3)
- [x] Convert PopupLayer last (wave 4)
- [ ] Delete framework, vendored jQuery, webpack global, orphan templates (wave 5 — 51 `$(`
      left in 12 files, itemised in PLAT-002-NOTES §8)
- [ ] Verify with repo-wide grep; CHANGELOG with before/after counts
