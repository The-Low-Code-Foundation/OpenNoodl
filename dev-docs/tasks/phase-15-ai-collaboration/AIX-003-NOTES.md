# AIX-003 — As-Built Notes

_Executor: Fable 5. Committed to `cline-dev` (no task branch, per working
agreement). Five slices, 2026-07-24: 57eaa28, b10dce2, 5eb336c, a505d8c, + slice 5._

## What shipped

| Piece | Where | Role |
|-------|-------|------|
| Change-set adapter | `models/AiAssistant/authoring/ChangeSet.ts` | Staged proposal (AIX-002 `ComponentFiles`) → SUB-007 diff, with stable change ids + dependency edges + `requiredWith`/`excludedWith` closures |
| Review component | `models/AiAssistant/authoring/reviewComponent.ts` | Change set → annotated merged legacy component (`annotation`/`diffData`) for the read-only diff canvas |
| Partial acceptance | `models/AiAssistant/authoring/applyChangeSet.ts` | `materializeSelection`: base + accepted changes → `ComponentFiles`; rejection closed over dependencies first |
| Review document | `views/documents/ChangeReviewDocument/` | Diff canvas + change rail: grouped sentences, per-key parameter detail, click-to-focus, Before/Changes/After views, per-row exclude/restore, walkthrough stepper, collapsible groups (auto-collapsed past 20 changes), Accept N of M |
| Panel wiring | `AiAuthoringPanel.tsx` | "Review changes" on the staged bar; `acceptFiles` validates any (partial) selection through the SUB-006 gate before staging |
| Painter a11y | `NodeGraphEditorNodePainter.ts`, `NodeGraphEditorConnection.ts` | Shape alongside colour: corner badges (+/−/~), dashed border+routing for deletions, thicker stroke for additions — also upgrades the version-control diff view |

+14 specs (1139 → 1153): `tests/ai/authoring-changeset.test.ts`,
`authoring-review.test.ts`, `authoring-apply.test.ts`, plus a ports-index spec
in `tests/versioning/graphdiff.test.ts`.

## Decisions worth keeping

- **No second diff, and no overlay.** SUB-007's types header said "consumed by
  AIX-003" and that held: the adapter is `fromV2Files` + `diffGraphs` and one
  empty-snapshot case. Rendering reuses the *annotated component on a
  read-only `NodeGraphEditor`* — the exact surface the version-control diff
  uses — rather than the spec's imagined canvas overlay. A new component isn't
  on the live canvas at all, so an overlay had nothing to overlay; a document
  with its own canvas gets in-place removals, both routings of a rewire, and
  the painter's treatments for free, in the same visual language as VC review.
- **Same-format diffing.** The existing component is converted through
  `buildComponentV2Files` (the exporter's own serializer) so both diff sides
  are v2-shaped. Diffing legacy-vs-v2 snapshots reports each side's `extras`
  bookkeeping as contradictory metadata changes.
- **Dependencies are data on the change set.** Each `ReviewChange` carries
  `requires` (connection→its new endpoints, child→new parent, removal→removal
  of touching wires, parent-removal→child disposition, recreation→both sides).
  The UI closes rejection *forward* (`excludedWith`) and restoration
  *backward* (`requiredWith`), and `materializeSelection` re-closes before
  applying — invalid subsets are unrepresentable, and the SUB-006 gate in the
  panel is belt-and-braces on top.
- **Materialization is base-forward.** Result = base snapshot + accepted
  changes applied (field-wise per change kind), never inverse-patching the
  target. All-accepted reproduces the proposal exactly — asserted through the
  diff engine's own equality. The proposal's `component.json` is reused
  verbatim; component-level rows are not individually rejectable.
- **Two upstream SUB-007 fixes instead of forks** (the spec's step-1 advice
  paying off): `v2:componentName` joined `DERIVED_EXTRAS` (it never carries
  independent information; renames surface via snapshot name), and instance
  ports now compare with the editor-stamped `index` stripped.

## Traps hit

- **Loaded ports carry `index`; authored ports don't.** Every loaded
  `Component Inputs` node spuriously reported "ports changed" against its own
  re-proposal — *live only*: the headless corpus never runs the editor's port
  registration, so the round-trip spec couldn't catch it. Live smoke earns
  its keep exactly here.
- `switchToComponent(component, {node})` on a read-only editor still centres
  (selection short-circuits to `readOnlyNodeClicked`), which is all the
  change-rail click needs.
- The webpack-require probe (`window.webpackChunknoodl_editor.push`) reaches
  any editor module from CDP for scripted driving; eval scope is shared
  across calls, so wrap in IIFEs or redeclaration errors follow.
- `cdp.js` default target resolves to the cloud-runtime page once a project is
  open — `--target=NodeGX`, as PLAT-003 recorded.

## Verified

- `npx tsc --noEmit` clean; `npm run test:ci` **1153 specs, 0 failures**;
  `npm run catalog:check` green.
- Live (CDP-driven, real project): new-component review (all-Created canvas +
  grouped rail + badges), modification review (param change with before/after
  detail, added node, rewire shown as dashed-old + thick-green-new), row-click
  canvas navigation, and the ports-index fix (spurious row gone). Zero
  renderer exceptions.

## Not yet done

1. **Live pass on the slice-4/5 UI** (exclude/restore clicks, Before/After
   toggle, walkthrough, Accept-N-of-M through the real panel): blocked
   mid-smoke by an unrelated in-flight edit breaking the workspace build
   (`ProjectScanner.ts`, RUN-001 work). Logic is spec-covered; the UI needs
   one clean-session smoke.
2. **The 40+ node fresh-reviewer test** (success criterion: a human who
   hasn't seen the change can say what happened). Still needs a human — but the
   artifact it needs now exists:
   `measurements/live/changeset/settings-page.review.md` (a real 38-node,
   40-change proposal rendered through the change rail's own presentation) with
   the request held separately in `settings-page.request.md`. Same pair for
   `share-popup`.
3. **Comment annotations on canvas** ride through `rest.annotation` in the
   review component but the comment layer's rendering of them is unverified.
4. ~~Real end-to-end: author with a live provider → review → partially accept.~~
   **Done, 2026-08-02** — see `AIX-003-LIVE-ROUND-TRIP.md`. Thirteen live
   `claude-sonnet-5` sessions through `--mode=changeset`, $2.39. It found that a
   fully accepted proposal could land its inserted rows in the wrong sibling slot
   (fixed), that `connection-relabelled` was unhandled in three places and that
   wire labels never survived the v2 export/import at all (fixed), and — filed,
   not fixed — that a gate-forced repair is structurally independent and
   semantically not, so the rail offers a rejection the Build panel then refuses.
