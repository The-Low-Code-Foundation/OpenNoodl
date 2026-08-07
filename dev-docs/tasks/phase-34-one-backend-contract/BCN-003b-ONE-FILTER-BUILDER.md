# BCN-003b: One Filter Builder

## Metadata

| Field | Value |
|-------|-------|
| **ID** | BCN-003b |
| **Phase** | Phase 34 — One Backend Contract (Track S) |
| **Tier** | 1 — the contract |
| **Priority** | 🟠 High |
| **Difficulty** | 🟡 Medium — one UI absorbing another, with no data-format change underneath it |
| **Estimated Time** | 3–5 days |
| **Prerequisites** | BCN-003 (complete) |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟠 Opus 4.8 — bounded, but it ends in live QA and the two builders' affordances have to be compared by using them |

## Why this exists

BCN-003's spec had seven implementation steps. Six were headless — translators,
operator declarations, the saved-filter migration, the live equivalence pass —
and the seventh was *"converge the two builders on `ByobFilterBuilder`, folding
in pointer/relation rules"*, which is an editor-UI task with its own live QA.

**Richard split it out on 2026-07-31.** The reasoning: BCN-003 was already
widened past its ~2-week re-estimate by taking on both built-in-backend defects,
and putting a UI convergence in the same landing would mean the commit that has
to prove *filter equivalence* also rewrites the thing that builds filters.

BCN-003 did the half that makes this cheap: **the saved format already moved.**
`ByobFilterBuilder` emits the neutral vocabulary now, and saved filters migrate.
So this task changes no data format at all — it is a pure UI retirement.

## Current State

Two visual filter builders, for the same neutral model, in the same property
editor.

| | Builder | Property-editor type | Saves |
|---|---|---|---|
| Parse family | `components/QueryEditor/` (7 components) | `QueryFilterType.ts`, ~60 lines | `{combinator, rules:[{property, operator: 'equal to', …}]}` |
| BYOB | `components/ByobFilterBuilder/` (~1.9k lines) | `ByobFilterType.ts` | `{id, type, conditions:[{field, operator: 'equalTo', …}]}` |

Both saved formats are converted to the neutral `Filter` by
[`translators/saved.ts`](../../../packages/nodegx-backend-contract/src/translators/saved.ts)
— `visualQueryToNeutral` and `savedFilterToNeutral`. That module is the seam this
task works against, and it exists so that retiring a builder touches no
translator.

`ByobFilterBuilder` is measurably ahead: RUN-003 slice 5 found it ahead on
operators, nesting, drag-and-drop and JSON editing, and then added connected-value
ports and enum/boolean value editors. `QueryEditor`'s one advantage is
`QueryPointerRule` — the Parse-specific "points to" and "related to" affordances.

## Desired State

1. **One builder.** `ByobFilterBuilder` renders for Parse-family nodes too.
   `QueryEditor` and `QueryFilterType.ts` are deleted, not deprecated.
2. **The Parse family loses nothing.** `pointsTo` and `relatedTo` become rule
   types inside `ByobFilterBuilder`, offered when the field's schema says the
   column is a `Pointer` or a `Relation`. The neutral vocabulary already has both
   operators and both translate; what is missing is a way to *choose* them.
3. **Operators are offered per backend.** The builder's operator dropdown is
   filtered by the resolved backend's `filters` capability table, and a
   `degraded` cell shows its sentence as a caveat. This is BCN-010's mechanism
   arriving early in the one place it is cheapest to prove.
4. **Saved `QueryEditor` filters are read, once.** `visualQueryToNeutral` already
   converts them; this task writes the other direction — neutral → the builder's
   saved format — so an existing Parse-family filter opens in the new builder and
   saves in the new shape.
5. **Live QA in the real editor**, which BCN-003 did not do and which is the
   reason this is a separate task.

## Implementation Steps

1. Write `neutralToSavedFilter` beside the two existing converters in
   `translators/saved.ts`, and migrate a `QueryEditor` filter on load exactly as
   `ByobFilterType` migrates a BYOB one.
2. Add pointer/relation rule types to `ByobFilterBuilder`: a field whose schema
   type is `Pointer` offers `pointsTo`; `relatedTo` needs the related record's
   id, so it is a rule with two inputs rather than one.
3. Filter the operator dropdown by the backend's capability table; surface a
   `degraded` cell's reason where the value editor is.
4. Point `QueryFilterType`'s registration at `ByobFilterType`, then delete
   `QueryEditor/` and `QueryFilterType.ts`.
5. Live QA — the deliverable. See below.

## Success Criteria

- [ ] One filter builder in the property editor; `QueryEditor/` is deleted.
- [ ] A Parse-family filter saved before this task opens in the new builder,
      shows the same conditions, and saves without changing what the query asks
      for. Pinned by a test in the same shape as BCN-003's migration test.
- [ ] `pointsTo` and `relatedTo` are reachable from the UI on a Parse-family node.
- [ ] An operator the chosen backend declares `unsupported` is not offered; a
      `degraded` one is offered with its sentence visible.
- [ ] **Live QA:** in the real editor, against the built-in backend — build a
      filter with the mouse on a Query Records node, run the app, and confirm the
      rows. Then the same against a BYOB Directus backend from the rig.
- [ ] Every package's suite, and the editor's Jasmine suite.

## Out of Scope

- **Any change to a translator.** If this task needs one, something has been
  designed wrong — the seam is `translators/saved.ts`.
- **The capability gating of *nodes*.** BCN-010 owns ports and node families;
  this task gates one dropdown, in the one place where doing it early is cheaper
  than not.
- **Sorting.** `convertVisualSorting` and the sorting UI are untouched.

## Traps

- **The builder's operator dropdown is keyed by a UI row, not by an operator.**
  BCN-003 introduced `OperatorDefinition.key` because presence is one
  boolean-valued operator (`exists`) shown as two rows ("is set" / "is not set").
  A pointer rule may need the same treatment.
- **`generateFilterPortName` must keep the `filter_` prefix.** The runtime keys
  its dynamic filter-value inputs on it (`byob-query-data.ts`), and RUN-003's
  slice-5 test exists to say so.
- **The editor's Jasmine specs are not in the root tsconfig's `include`.**
  `npx tsc --noEmit -p tsconfig.json` at the repo root will typecheck the editor
  *source* and miss `packages/noodl-editor/tests/`. BCN-003 changed an operator
  union and found out from `npm run test:ci`, three minutes into a webpack build.
- **`ByobFilterType` logs nothing now** — a `console.log` of every saved filter
  was removed. If a live pass needs to see what is being saved, add it back
  temporarily rather than shipping it.
- The [editor CDP driving traps](../../reference/) apply to the live QA:
  `--target=editor` attaches to the preview window, launch detached, never
  `cdp reload`, and relaunch rather than reload after touching node registrations.

## Notes for whoever starts

- BCN-003's [notes §8](./BCN-003-NOTES.md) list what it did *not* establish, and
  the first item is this task's live QA. The filter builder has never been driven
  with a mouse since the vocabulary changed under it.
- The two saved formats and both converters are already in one small module with
  a header explaining why. Read it before deciding where anything goes.
