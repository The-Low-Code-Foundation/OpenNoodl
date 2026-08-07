# Phase 42bis — Progress

**The alpha driving sprint. 5 tasks specced 2026-08-06. All five built the same day.**
**Phase overview:** [README.md](./README.md)

## Status vocabulary

Not started · In progress · **Built–not driven** · Complete · Superseded

## Tasks

| Task | Tier | Status | Notes |
|---|---|---|---|
| [SPR-001](./SPR-001-ACCESS-CONTROL-SURFACE.md) The access-control surface | 1 | ✅ **Complete** | F84/F85/F87 driven live; F86 built + 15 backend specs, **not driven** (needs a deployed cloud function). F86's two design questions answered before building — see the log |
| [SPR-002](./SPR-002-BACKEND-PANEL-DEFECTS.md) Schema edit and Search legibility | 2 | 🟡 **F88 complete, F89 built–not driven** | F88 reproduced by reading, fixed, and **driven end to end**. F89 is copy; not driven |
| [SPR-003](./SPR-003-PORTS-TAB-TRUTH.md) What the Ports tab claims | 1 | 🟡 **F82/F92/F93 complete, F94 built–not driven** | F94 needs a canvas port hover, which needs canvas hit-testing this harness does not have |
| [SPR-004](./SPR-004-RECORDING-DEAD-END.md) Record's dead end | 2 | 🟡 **F91 complete, F90 not reproduced** | F91 driven end to end. F90's *stuck* mechanism found and fixed; the reported instance was **never reproduced** — see the log, it is recorded rather than dropped |
| [SPR-005](./SPR-005-CLOUD-FUNCTION-DISCOVERY.md) Finding cloud functions | 1 | ✅ **Complete** | Driven live. Phase 43 overlap resolved in writing |

## What was driven, and what was not

Driven in a real editor on 2026-08-06 against the NodeGX QA Fixture with the built-in
SQLite backend running on `:8578`, **light theme only**:

| Finding | Evidence |
|---|---|
| F82 | `Size Mode` on a Text node renders the chip *"Setting — set here, cannot be connected"*, with **no** "Accepts …" and **no** "Nothing drives this yet"; the connectable `Align Y` above it still shows both |
| F84 | ACL column present, second after `objectId`, badge shown, empty ACLs read `— public (no ACL)`. `{"alice":5}` **refused** — *ACL entry for "alice" must be an object*, editor stays open, nothing written. `{"*":{"read":true}}` saved and **confirmed in the backend's own API response** |
| F85 | Rules render as words; inherited ones dimmed italic; no raw text input anywhere. Matrix expands to audiences × the five ops, with the project's existing `role:test` already a row |
| F88 | Expand `Person`, press **Edit** → becomes **Done**, `+ Add Field` and the rename hint appear. Added a `price` column through the real IPC path: 4 fields → 5 |
| F91 | 30 events captured; **Stop** shows `Recorded 30 events · 18 interactions` + **See what happened**; the button opens the Provenance panel on the real interaction list |
| F92 | Both tabs measure **exactly 161px**, `flex: 1 1 0`, `text-align: center` |
| F93 | Name on its own line, type label beneath |
| F83 | Header **+** present; menu titled *New in Default*; *Create Cloud Function Component* appears **disabled carrying its reason** rather than vanishing. Sheet pill reads *"All sheets — every sheet except Cloud Functions, flattened. New components land in Default."* |

**Not driven, and why:**

- **F86** — needs a cloud function deployed to a running backend plus two signed-up users to
  prove the 403 → 200 transition. Covered by 15 backend specs; the live pass is owed.
- **F89** — copy only. Rendered by a panel that was not opened this session.
- **F90** — see the log. Not reproduced.
- **F94** — the explainer popup appears on a canvas port hover. The canvas is Canvas2D with no
  DOM nodes and no port hit-testing, and the CDP helper clicks selectors, not coordinates.
  Covered by 10 unit specs including two off-screen cases the specs caught during authoring.
- **Both themes.** Every live check above was **light theme only**. Dark theme is owed for all
  of them, and OBS-003 already records that the recording HUD's one-shot states have only ever
  been checked in dark — F91's receipt is a *new* one-shot state, so it has the inverse gap.

## Gates

Run against the final tree, 2026-08-06:

| Gate | Result |
|---|---|
| `typecheck:editor` | ✅ 0 errors — **caught a real regression**, see the log |
| `typecheck:runtime`, `typecheck:editor-tests` | ✅ 0 errors |
| `test:main` | ✅ **67 suites, 933 passed, 933 total** |
| `nodegx-backend` package tests | ✅ 99 suites, 1079 passed, 10 skipped |
| `catalog:check`, `cloud-library:check` | ✅ up to date (regenerated — 15 cloud-specific types, including the three new role nodes) |
| `colors`, `tokens:css`, `icons:check` | ✅ green (`colors` required fixing a **pre-existing** failure) |
| `tsfixme` | 🔴 **red, and pre-existing** — see F100 |

## Findings register

F-numbers continue the shared sequence used by phases 25, 27 and 33. Highest before this
phase: **F81**. This phase allocated **F82–F94** on creation and **F95–F101** while building.

> ⚠️ **Re-measure a row before you act on it.** This project has now recorded nine rows
> across three registers that outlived their own fixes. Every row below carries the date
> it was measured and, where it is a number, the command that regenerates it. **If you
> add a row, do the same or it will mislead someone within the week.**

### The thirteen this phase opened with

| # | Finding | Status |
|---|---|---|
| F82 | The Ports tab listed 139 ports the canvas refuses to connect | ✅ **Fixed and driven.** One shared helper, `models/nodelibrary/portConnectivity.ts`; `ConnectionBar.tsx`'s local predicate deleted. Rows kept, marked. `10973fc2` |
| F83 | Cloud function authoring exists and cannot be found | ✅ **Fixed and driven.** `58a48bfb`, `29c1fab0`, `5bd7f79d`, `a41537b8` |
| F84 | The data browser hid the ACL | ✅ **Fixed and driven.** Cause **measured** first — the grid, not the backend, and **not** `READ_ONLY_FIELDS`. `8aeea2a1`, `34da2eae`, `486d0067`, `7be63c14` |
| F85 | Collection permission rules were free text | ✅ **Fixed and driven.** `51e15f53`, `99978792`, `3382742e` |
| F86 | Nothing could put a user in a role | 🟡 **Built, not driven.** Three cloud-only nodes + a `SystemRoles` seam. 15 specs. `e9aab7bf`, `5db43f82`, `0167a111`, `5c7b7e96` |
| F87 | ACL rules work and nothing said so | ✅ **Written into the product.** Port tooltip + `BACKEND-AUTHORING-MODEL.md`. `f2712045` |
| F88 | The schema manager's edit button did nothing | ✅ **Fixed and driven.** Not a bug — a no-op stub. `f02d7fbc` |
| F89 | The Search page was unreadable to a non-programmer | 🟡 **Built, not driven.** `93c22adf`, `dce21109` |
| F90 | The provenance pane sticks on a preview warning | ⚠️ **NOT REPRODUCED.** Stuck *mechanism* found and fixed; the instance was never seen. See the log |
| F91 | Record showed nodes firing and offered no route | ✅ **Fixed and driven.** `c6bd3435`, `feec4e87` |
| F92 | The Properties/Ports tab labels were not centred | ✅ **Fixed and driven.** `882930c2` |
| F93 | Port name and type collided on one line | ✅ **Fixed and driven.** `882930c2` |
| F94 | The port explainer popup was occluded | 🟡 **Fixed, not driven.** The spec's diagnosis was wrong — see the log. `15759aae` |

### Opened while building

| # | Finding | Where | Owner |
|---|---|---|---|
| F95 | **`backend:changeColumnType` has no UI anywhere.** Registered at `BackendManager.js:184`, supported at `byob-admin.ts:282`, reachable from no surface. The same barrel-orphan shape as F88 one step earlier | `views/panels/schemamanager/`, 2026-08-06 | unassigned |
| F96 | **There is no `dropColumn` action on the admin API at all**, so *"remove a field"* is impossible from every surface. Demonstrated live: the driving pass added a `price` column to the fixture's `Person` table and **could not remove it** | `nodegx-backend` admin API, 2026-08-06 | unassigned |
| F97 | **The backend advertises a CLP operation it rejects.** `admin-security.ts:146` returns a 400 telling the operator the expected shape is `{find, get, create, update, delete, count}` — `CLP_OPS` has no `count`, and `validateSecurityConfig` refuses it as `unknown operation "count"`. The error message instructs you to write a key the validator rejects | `nodegx-backend/src/server/admin-security.ts:146`, 2026-08-06 | unassigned |
| F98 | **`Tabs`' `is-variant-default` still has F92.** Both variants carried `flex-basis: 1` — a unitless non-zero length, which is invalid CSS, so the declaration was dropped and the inline percentage did all the sizing. Fixed for `sidebar` only; the default variant has many more call sites and widening the blast radius mid-sprint was declined | `noodl-core-ui/.../Tabs/Tabs.module.scss`, 2026-08-06 | unassigned |
| F99 | **A cloud function created in a subfolder gets a slash in its name.** The CWF-004 gesture always lands at the sheet root; the components panel will land one in `/#__cloud__/Orders/chargeCard`. `cloudFunctions.ts:41` and `WorkflowRunner.ts:649` strip only the prefix, so the name becomes `Orders/chargeCard` — a slash inside a `POST /functions/:name` segment. **Not disabled**, because the backend's function-route dispatch could not be located to confirm it breaks (grep for `functions` in `HttpServer.ts` returns nothing despite the docstring naming the route — worth a look on its own) | `utils/exporter/cloudFunctions.ts:41`, 2026-08-06 | unassigned |
| F100 | **The TSFixme ratchet is red and has been for a while.** `npm run tsfixme` reports **+43 TSFixme, +35 `any`** over a baseline pinned at commit `2a86bd2f`. This sprint contributed ~6 (591 → 597 occurrences, `git grep -h -o TSFixme <rev> -- 'packages/*.ts' 'packages/*.tsx'` at `5bf95ce2` vs HEAD), so **at least 37 predate it**. Deliberately **not** baselined: the ratchet's own message says raising it silently is the one thing it exists to stop, and blessing 37 unattributed markers is exactly that. **Needs a decision** | `.tsfixme-baseline.json`, measured 2026-08-06 | Richard |
| F101 | **`NewRecordModal` cannot set an ACL at create time.** It renders `schema.columns`, which by design excludes ACL. A record can be created and then given an ACL in the grid, so this is a gap rather than a block | `views/panels/databrowser/`, 2026-08-06 | unassigned |

## Log

- **2026-08-06 — Phase created**, from thirteen findings Richard filed in a single
  message while driving the editor himself, in parallel with ALPHA-001 Part A's scripted
  first-hour run. Part A had completed §1 (launcher and first run — **pass**) at the
  point it was stopped.

  **The finding about the findings:** an hour of a human building a real thing — an app
  against the SQLite backend, with records, ACLs, roles and a String node — produced
  thirteen first sightings, none of which the scripted pass had reached and none of which
  any suite could see. Every affected surface was code-complete-never-driven.

- **2026-08-06 — All five tasks built**, by nine parallel agents against a shared checkout,
  with the editor held back as a serialized resource and driven afterwards in one pass.

  **Four of the five specs were wrong about their own mechanism.** This is the most
  reusable result of the phase, and it argues for the register's own re-measure rule
  harder than the rule itself does:

  - **F94** — the spec said to portal the explainer to the dialog layer and stop fighting
    z-index. It was **already** portalled, into `.popup-small-docs` → `.popup-layer` at
    `z-index: 10`, above every overlay the editor draws. There was no z-index fight to
    lose. The real bug: the host was `position: absolute; bottom: 2px` with **no `left`
    and no `right`**, so both resolved to the static position — `0` — and it drew in the
    **bottom-left corner of the window** whichever port was hovered. `DialogLayer` and
    `CoreBaseDialog` were never involved.
  - **F84** — `READ_ONLY_FIELDS` was a red herring. The ACL column never reached the
    renderer: `DataBrowser.tsx:143` unions three hard-coded system columns with whatever
    `/admin/schema/:table` reports, and `SchemaManager.ts:229`/`:300` classify `ACL` as a
    *system* column, so it never enters that schema. The spec's instruction to **measure
    before fixing** was correct and load-bearing.
  - **F88** — not a broken button. `SchemaPanel.tsx:151-154` was a stub whose ternary
    branches were the same value, carrying the comment *"full editing will be added in a
    future task"*. React bails on an identical `setState`, so an already-expanded row
    produced **no DOM change and no console output** — which is why the spec's
    "reproduce first, check the console" advice would have cost the session. Ten minutes
    of reading found it.
  - **SPR-005** — its central fact was false. *"The panel header already has a plus
    button"* cited a **class docstring** on `ComponentTemplates`, a fossil from the
    legacy Backbone panel. `ComponentsPanelReact`'s header contained only the sheet
    selector. The task was not "make the existing plus offer cloud functions"; it was
    "there is no plus".

  **And SPR-002 §2 had its two directories the wrong way round** — the backend Search page
  is `views/panels/search/`, not `search-panel/` (which is find-in-project). Following the
  spec would have edited the wrong surface.

- **2026-08-06 — F87 answered, and one of its own claims corrected.** The spec says the
  BYOB-REST ACL drop *"warns to the console and nowhere else"*. That is **not true**:
  `nodeCapabilities.ts:104-105` binds the `accessControl` port to the `data.acl`
  capability and `propertyeditor/DataTypes/Ports.ts:223` gates the row through
  `gateForPort`, so the property row carries the reason in the editor. The `console.warn`
  is the second line of defence, not the only one. Recorded in the reference page.

- **2026-08-06 — F86's two design questions, answered before building.**

  1. **Who may call it? Cloud-only.** A browser node that adds the current user to any role
     is a privilege-escalation primitive. Role mutation ships as three cloud nodes usable
     only inside a cloud function, gated by that function's own `functions.<name>.call`
     rule.
  2. **⚠️ And deliberately *not* inside `SystemUsers`.** That module's header documents
     four checked safety properties, and #2 is that it writes neither `_Role` nor
     `_Join_users__Role` and that a user it creates resolves to `roles: []` — **asserted in
     `tests/cloud-system-users.test.ts`**. Folding role writes in would have silently
     invalidated a tested invariant. A separate `SystemRoles` seam keeps it literally true.
  3. **Nested roles: no, and they are currently *unrepresentable*.** `state.ts:315-328` is
     one non-recursive JOIN, and `_Role`'s only relation is `users` → `_User`
     (`service.ts:776-782`) — there is no `roles` relation on `_Role`, so a role-in-role
     edge has nowhere to be stored. Nothing shipped writes one, so nothing has to be
     un-shipped if the answer changes. Cost if it is ever wanted: a `roles` Relation column,
     a recursive CTE with cycle detection, and a re-run of `security-model.test.ts` — the JS
     predicate is property-tested against its SQL twin, so both sides move together or
     realtime delivery and query filtering drift.
  - Role **auto-create is off by default**, behind a `Create Role If Missing` port. A role
    name is written by two people at two times — the rule that grants through it and the
    call that fills it — so auto-creating turns a typo into a role that exists, has a
    member, and is named by no rule. That is the same defect class as F86 itself.

- **2026-08-06 — Two defects found by measuring rather than by looking for them.**

  - **The admin `PUT /api/:table/:id` did not validate ACL shape**, while both its sibling
    write paths do (`HttpServer.ts:1847`, `parse-wire.ts:244`). `{"ACL":{"alice":5}}` was
    stored verbatim with a 200 — and that is not inert: `canAccessRecord` matches on
    `entry[access] === true`, so a mis-shaped entry means **nobody**, and the row silently
    vanishes for every caller including its owner. Found while establishing F84's cause,
    fixed **before** the editable ACL cell shipped, which is the right order.
  - **The schema panel advertised the primary key as `id`.** It is `objectId`
    (`SchemaManager.ts:109`) — and `id` is the one column name a query against a local
    backend cannot match, so the panel was actively misleading. Fixed in passing.

- **2026-08-06 — `typecheck:editor` earned its keep.** No agent was allowed to run it (nine
  concurrent webpack/tsc runs would have exhausted memory), so it ran once at the end — and
  caught a regression that had survived **four green commits and 27 passing specs**.
  `omitHiddenPorts<T extends { name: string }>` was called with an untyped array, so
  inference had nothing to work from and fell back to the generic's own constraint: every
  port in the connection popup narrowed to `{ name }`, losing `group`, `displayName`, `tab`,
  `type` and `plug`. The unit specs could not see it because they exercise the pure module,
  where `T` infers correctly. Fixed in `439fdfb4`.

  Regenerating the catalog then turned `test:main` red for a different reason: AIB-007's
  completeness test reads the catalog, so F86's three new nodes arrived unclassified.
  Classified as `DELIBERATELY_BACKEND_FREE` for the same reason as CWF-015's four.

- **2026-08-06 — F90 is recorded, not dropped.** The spec says *"a phase that quietly drops
  an unreproduced report is how F62 happened."* So, precisely:

  - The string is `describeFoundation`'s `node-absent` branch, `walkEngine.ts:417-429` — the
    only user-facing "instantiated" sentence in the editor.
  - A **stuck** mechanism was found and fixed: `previewRunning` was read as a getter inside
    the walk memo rather than as a dependency; the topology was pulled once per walk request;
    `TraceSession`'s re-pull was gated on `recording && target`; and **Refresh** was disabled
    on a value nothing re-rendered on *and* pulled no topology when there was no target — so
    a panel opened from the HUD had no escape at all. The panel now subscribes to
    `ViewerRegistered` **and** `viewerClientsChanged` (both are needed — `ViewerRegistered`
    fires one message before the client list is populated).
  - **The reported instance was never reproduced.** The live pass reached the state Richard
    described — preview running on the same page as the canvas, provenance panel open after a
    recording — and the pane rendered 30 events and 18 interactions correctly, with no
    warning. Whether his instance was stale or live is **still unanswered**, and the
    one-click discriminator is: with the sentence on screen, press **Refresh**. Clears →
    stale. Persists → live, and the sentence's own tail splits it further; if the node's
    component *is* in the "preview has instantiated" list, the suspect is
    `buildSessionDictionary` missing Repeater item scopes, which `getAllNodesRecursive` only
    reaches through `ComponentInstanceNode`s.

- **2026-08-06 — Two gates were already red before this phase touched them.** `colors` had
  been failing since `7a9ddc30` (2026-08-05) because two hex literals sit **inside a
  comment** and the ratchet scans text, not declarations; fixed by dropping the `#`, which
  keeps the measurement legible (`39161534`). `tsfixme` is red by +43/+35 and **is not
  fixed** — see F100. Both were found because an agent reported a gate red and the failure
  turned out not to be its own, which is the check worth keeping.
