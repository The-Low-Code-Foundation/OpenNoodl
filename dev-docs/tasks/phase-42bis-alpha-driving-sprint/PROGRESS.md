# Phase 42bis — Progress

**The alpha driving sprint. 5 tasks specced 2026-08-06. Nothing built.**
**Phase overview:** [README.md](./README.md)

## Status vocabulary

Not started · In progress · **Built–not driven** · Complete · Superseded

## Tasks

| Task | Tier | Status | Notes |
|---|---|---|---|
| [SPR-001](./SPR-001-ACCESS-CONTROL-SURFACE.md) The access-control surface | 1 | 📋 Specced | F84/F85/F86/F87. **F87 is already answered in the doc** — ACLs work on this backend, verified end to end; the deliverable there is writing the answer into the product. F84 must be done before F85 and F86 or neither can be verified. F86 carries a real design question (who may mutate roles) that must be answered before building |
| [SPR-002](./SPR-002-BACKEND-PANEL-DEFECTS.md) Schema edit and Search legibility | 2 | 📋 Specced | F88/F89. F88 is the one finding whose mechanism was **not** established — reproduce before reading code |
| [SPR-003](./SPR-003-PORTS-TAB-TRUTH.md) What the Ports tab claims | 1 | 📋 Specced | F82/F92/F93/F94. **F82's mechanism is confirmed and is one condition** — cheapest correctness-per-line in the phase. Do it first |
| [SPR-004](./SPR-004-RECORDING-DEAD-END.md) Record's dead end | 2 | 📋 Specced | F90/F91. F90 unreproduced; the occluded-preview trap applies |
| [SPR-005](./SPR-005-CLOUD-FUNCTION-DISCOVERY.md) Finding cloud functions | 1 | 📋 Specced | F83. **Check phase 43 before designing** — real risk of two sessions solving one problem twice |

## Recommended order

1. **SPR-003 §1** (F82) — one filter, 139 ports stop being misdescribed.
2. **SPR-005** — check phase 43 first; may move there entirely.
3. **SPR-001**, starting with F84.
4. **SPR-002**, **SPR-004** — reproduction first.

Then **ALPHA-001 Part A resumes at §2**, from a clean tree, with the commit recorded.

## Findings register

F-numbers continue the shared sequence used by phases 25, 27 and 33. Highest before this
phase: **F81** (allocated 2026-08-06, phase 33).

> ⚠️ **Re-measure a row before you act on it.** This project has now recorded nine rows
> across three registers that outlived their own fixes. Every row below carries the date
> it was measured and, where it is a number, the command that regenerates it. **If you
> add a row, do the same or it will mislead someone within the week.**

| # | Finding | Where | Owner |
|---|---|---|---|
| F82 | 🔴 **The Ports tab lists 139 ports the canvas refuses to connect.** `ConnectionBar.tsx:18-20` filters `!type.allowEditOnly`; `PortsTab.tsx:71-76` does not, so a port declared *"so it cannot be wired"* appears in the Ports tab as a port. Richard hit it on the String node: `Treat Unchanged as` (`outcome.ts:243-245`) and `Run On Value Change → Value` (`run-on-value-change.ts:131`), both `allowEditOnly: true`. Count regenerates with `grep -rn "allowEditOnly" packages/noodl-runtime/src packages/noodl-viewer-react/src \| wc -l` = **139**, measured 2026-08-06. A second divergence in the same pair: the popup passes `['extended']` to `applyPortConditionsFilterForNode`, the tab passes nothing | `views/ConnectionPopup/components/ConnectionBar.tsx:18` × `views/panels/propertyeditor/components/PortsTab/PortsTab.tsx:71` | SPR-003 |
| F83 | 🔴 **Cloud function authoring exists and cannot be found.** The template, icon, component kind, create gesture and deploy action are all present and wired. The only entry point is a **right-click on empty space** in the components tree, on a **sheet you must already have switched to**, and the sheet selector renders as a filter labelled "All" | `ComponentTemplates.ts:138,285` × `ComponentsPanelReact.tsx:55,209-228` | SPR-005 |
| F84 | 🔴 **The data browser hides the ACL.** A record created with an ACL shows no ACL anywhere in the data explorer, so *"why can't this user see this record?"* cannot be answered from the product. `READ_ONLY_FIELDS` is `{objectId, createdAt, updatedAt}`; ACL is in neither that set nor the column list. **Cause not yet isolated** — the backend may not return it, or the grid may drop it. Measure before fixing | `views/panels/databrowser/DataGrid.tsx:45`, measured 2026-08-06 | SPR-001 |
| F85 | **Collection permission rules are free text over a closed vocabulary.** Every CLP cell is a raw `<input>`; the legal values are exactly `public \| authenticated \| nobody \| role:<name>`, comma-separated for OR. A typo is silently a different policy. The roles are declared in the same panel (`:762`), so a dropdown can offer them | `views/panels/permissions/PermissionsPanel.tsx:583-586,651,674-678,692-696,731,762` | SPR-001 |
| F86 | 🔴 **Nothing can put a user in a role.** `noodl-runtime/src/nodes/std-library/user/` contains three files and none of them touch roles; there is no role node in the library. Membership can only be added by pasting an objectId into the editor's Permissions panel by hand. **So the entire role half of the access-control model is unreachable from a running app** — a rule can say `role:member` and nothing the app does can ever put anyone in `member` | `packages/noodl-runtime/src/nodes/std-library/user/`, measured 2026-08-06 | SPR-001 |
| F87 | ✅ **"Do the Access Control Rules on data nodes actually work?" — yes, on this backend, and it is not a Parse vestige.** Traced end to end 2026-08-06: `newdbmodelpropertiesnode.ts:118` collects it → `ParseWireAdapter.ts:497,545` sends `{ACL: …}` → `nodegx-backend/src/security/model.ts` models `role:<name>` as a first-class principal key and enforces it, with the JS predicate **property-tested against the SQL twin**. ⚠️ **The caveat is elsewhere:** `RestDataAdapter.ts:1032-1038` (BYOB REST — Supabase, PostgREST) **drops a per-record ACL**, deliberately and with a `console.warn` that no user will ever see. Remaining work is to say all this **in the product**, not just here | verified across 4 files, 2026-08-06 | SPR-001 §1 |
| F88 | **The schema manager's edit button does nothing on an already-created table.** Reported by Richard; **not reproduced** — the stack was stopped first. His wording implies the new-table path works, which would put the bug in the populated/edit branch rather than the button | `views/panels/schemamanager/`, reported 2026-08-06 | SPR-002 |
| F89 | **The Search page is unreadable to a non-programmer.** *"I don't even know what it means."* It never says what search is for, what happens with nothing configured, or which node consumes it. The Permissions panel's own help text is the standard to meet — Richard did not complain about that one | `views/panels/search-panel/` (confirm which of the two search dirs), reported 2026-08-06 | SPR-002 |
| F90 | **The provenance pane sticks on a preview-instantiation warning** during a recording, with the preview on the same page as the canvas. **Not reproduced.** ⚠️ Diagnosing this by reading the preview's DOM has already cost this project an hour once — an occluded preview repaints late and an occluded Electron window clamps timers ~1000× | reported 2026-08-06 | SPR-004 |
| F91 | **Record shows nodes firing and offers no route to the results.** *"ok, it shows me which nodes fire, nice, now what"* — the Record control is bottom-right on the canvas, the provenance walk is a different panel on the left rail, and nothing connects them at the one moment the user wants to look | canvas Record control × provenance panel, reported 2026-08-06 | SPR-004 |
| F92 | **The Properties/Ports tab labels are not centred** — the tab is sized narrower than its label, so `Properties` sits hard against the right edge with padding on the left | `views/panels/propertyeditor/components/`, 2026-08-06 | SPR-003 |
| F93 | **Port name and type collide on one line.** At narrow widths the name is squeezed to one character per line beside a full-width enum label. `PortsTab.tsx:60-68` already trims long enums *"because a font-weight enum is longer than the row it sits in"* — the row was known to be tight and the mitigation went to the wrong side | `PortsTab.tsx:60-68`, 2026-08-06 | SPR-003 |
| F94 | **The port explainer popup is occluded** by the panels around it — it renders behind the STEP 1 list, clipped by the panel edge. Richard: *"very cool, but it very easily gets hidden behind other stuff … tricky one to place correctly"* | `views/ConnectionPopup/`, 2026-08-06 | SPR-003 |

## Log

- **2026-08-06 — Phase created**, from thirteen findings Richard filed in a single
  message while driving the editor himself, in parallel with ALPHA-001 Part A's scripted
  first-hour run. Part A had completed §1 (launcher and first run — **pass**) at the
  point it was stopped.

  **The finding about the findings:** an hour of a human building a real thing — an app
  against the SQLite backend, with records, ACLs, roles and a String node — produced
  thirteen first sightings, none of which the scripted pass had reached and none of which
  any suite could see. Every affected surface was code-complete-never-driven. That is
  the same category ALPHA-001 exists to empty, which is why the first hour **resumes**
  after this phase rather than being replaced by it.

  Three of the thirteen (F82, F83, F84) are one defect in three costumes: **the product
  knows something true and shows the user something else.** F87 is the inverse and the
  happiest result in the set — the thing Richard suspected was a dead Parse vestige is
  real, correct and property-tested, and the only defect is that nothing in the product
  says so.
