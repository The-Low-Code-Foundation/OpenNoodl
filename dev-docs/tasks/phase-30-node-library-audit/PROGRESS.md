# Phase 30 — Progress

**Track O — Node Library Audit & Remediation**

**All 16 tasks specced as of 2026-07-29.** None started.

| Task | Tier | Status | Notes |
|---|---|---|---|
| NDA-001 Node behaviour corpus | 1 | ✅ **Done** `7a27e7c3` | 34 tests (16 `test.failing`, 18 pinned), wired into `pr.yml` `test-packages` — verified, not assumed. Two spec corrections: **E6 is a failing row** (`undefined` *overwrites* the key with the type default, worse than documented), and E8's propagation half already works — the defect is the `String` cast. F2/F3 are node-boundary/SSR proxies, documented in the corpus README |
| NDA-002 Reactivity contract | 1 | ✅ **Built** `bd6632ca`…`825da393` | R1–R9 green unmarked; all suites green. **`items === arr` does NOT break** — `Collection.get`/`create` return a memoised Proxy, so identity holds and the raw array is simply unreachable. Mutating methods intercepted in the `get` trap (traps alone storm 3–4 changes per `splice`). Perf: only indexed reads regress (~0.3 µs/read Proxy floor; digit-leading fast path recovers 28%). ⚠️ `packages/noodl-editor/src/external/*` + `nodegx-backend/deploy/artifact/` embed stale `collection.ts` copies until rebuilt. Live QA + QA-fixture cyclic-warning check pending |
| NDA-003 Empty-value contract | 1 | ✅ **Built** `e707f0cc`…`b2032129` | All E-rows green unmarked. Nullable Variables shipped with `Treat empty as` (String/Color: `null`/`''`; Number: `null`/`0`; Boolean: `null`/`false`); corpus E1/E8 expectations reconciled to the contract (`null`, not `''`). String `length` returns 0 on null store. httpnode normalised to one helper (both omit; JSON body keeps `null`-is-sent, documented). E5's null-clears-collection worked by accident — now explicit + tested. Enriched catalog needed the NDA-014 compatibility fix first (`61e8b3da`) |
| NDA-013 Repeater Refresh | 1 | ✅ **Done** `0e96c93a` | `refresh()` resyncs from `items`; queue race handled by truncating the ops `set()` just appended (synchronous span, nothing interleaves). Full teardown kept deliberately, documented. Refresh added to Array Map; Array Filter's premise was wrong — its `Filter` signal always re-read fresh, `refresh` added as alias. 3 new corpus rows red→green. Live QA pending |
| NDA-004 Failure contract | 2 | 🔄 §1 built, §3 priority pair done | Channel at `packages/noodl-runtime/src/runtimeerror.ts`; `On App Error` node; F1/F1′ green; Function + Repeater completion signals. Both-surfaces decision ✅ confirmed by Richard. **Remaining: §2's 50 nodes, §3's other 8, the export/cloud legs of criterion 2, catalog regeneration** |
| NDA-005 Port documentation | 2 | ⬜ Not started | Do the shared port definitions first and re-measure; batch with NDA-012 |
| NDA-006 Columns | 2 | ⬜ Not started | Checked: `Columns.tsx` is the **only** file special-casing `ForEachComponent`. Slice 4 (Fable) is gated on slices 2–3 |
| NDA-007 Icon sets | 2 | 🔄 §1 done | Model at [`ICON-SOURCE-MODEL.md`](../../reference/ICON-SOURCE-MODEL.md) — tagged union (`font`/`sprite`/`inline`), sanitise-at-registration policy decided (no existing viewer policy existed to match; checked) |
| NDA-008 Component Stack | 2 | 🔄 **§0 resolved, unblocked** | **The stack does not scroll** — zero `focus()` calls and zero px moved across navigate/replace/useRoutes, measured. The scroll is browser focus-scroll into the viewer's `overflow: hidden` app root (`viewer.jsx:344-353`), triggered by the library's only DOM focus, `TextInput` (`text-input.ts:211-214`). `preventScroll: true` fixes it (0 px vs 1169 px) but is **not applied** — it would stop a deliberate `Focus` scrolling an off-screen field into view. Needs a call from Richard; filed against the viewer, not this node. §2's no-scroll bullet moves out; §1 and §3 stand |
| NDA-009 Run Tasks | 2 | ⬜ Not started | §1 alone closes corpus F1 |
| NDA-010 Popups | 2 | ⬜ Not started | §2 shared with NDA-015 |
| NDA-014 Type dead ends | 2 | 🔄 §1+§2 done | Decision at [`PORT-TYPE-CONTRACT.md`](../../reference/PORT-TYPE-CONTRACT.md) (A now, C direction). Table changed (`object`/`array`/`color` → `string`), JSON mirror added in `setInputValue`, catalog + register regenerated, runtime jest green (1,026), editor suite green (1,885 specs incl. validator/catalog-index). Outstanding: live editor check of the 13 `object` outputs |
| NDA-015 Explicit binding | 2 | 🔄 §1 done | Contract at [`BINDING-CONTRACT.md`](../../reference/BINDING-CONTRACT.md). Explicit-target-miss ≠ fallback is the load-bearing clause. §2 sweep + §3 FIXME open |
| NDA-016 `Layout.size` | 2 | ✅ **Done** | **§0 resolved: the spec's premise was wrong.** `sizeMode` is never unset — a fresh Text node carries `contentHeight`/`100%`, read live. The real defect is a stale `parentLayout`: children bake the parent's layout in at *their* render, `renderChildren` memoises them, and the Layout setter never invalidated the memo — so a layout change never reached the children, and the first child ate the row. Fixed with `setLayout` as the single writer. §1 built too, on its own terms (an abstaining *connection* can still unset the port). 10 regression tests; 15-node-type live blast-radius check. Criterion 4's screenshot corpus is an instrument mismatch — see the spec |
| NDA-011 REST → HTTP | 3 | ⬜ Not started | First output is an assessment, not a change |
| NDA-012 Per-node audit | 3 | ⬜ **1 of 17 categories** | Variables done (4/4) as the worked example. Opt-in, resumable, stop on find-rate decline |

## Audit coverage

| | Count | |
|---|---|---|
| Nodes with a machine-derived smell row | 155 | ✅ `NODE-REGISTER.md` |
| Nodes with a pre-filled audit worksheet | 155 | ✅ `audit/`, 17 category files |
| Nodes whose implementation has been read | 15 | 8 named by Richard + 5 from his second list + Boolean/Color |
| Nodes fully audited against the 12 checks | **4** | Variables, as NDA-012's worked example |
| Systemic defect classes identified | 6 | A reactivity, B failure, C documentation, D string contracts, **E type dead ends**, **F implicit binding** |
| Findings live-verified in the running editor | Tier 1 + NDA-014 | 2026-07-29 pass: preview runs the new collection semantics (push/index/length notify once each, synchronous, `items` identity holds, `set` = one change); zero renderer exceptions; no cyclic warnings; editor's live typecast table carries the three new casts. Catalog page empty = expected (DB query, no local data, no repeater on it) |

**Calibration:** the second pass found five real defects in six nodes. The structural sweep found
none of them. The 142 unread rows are unaudited, not clean — do not read a blank Verdict as a pass.

## Decisions

All three gating decisions were put to Richard on 2026-07-29 and he confirmed the recommendations:

1. **NDA-002 §1** — no listener-coalescing; keep the cycle breakers and surface trips through the
   NDA-004 error channel. ✅ Decided.
2. **NDA-003 §1 corollary 3** — Variables are nullable, with a per-node `Treat empty as` input for
   back-compat. ✅ Decided.
3. **NDA-002 §2** — approach B (Proxy, matching `Model`). ✅ Decided.

4. **NDA-004 §1** — the error channel surfaces both per-node `Failure` outputs *and* a global
   `On App Error` catch-all node (rather than either alone). Put to Richard on 2026-07-29 and
   ✅ **confirmed**; the veto window is closed and `FAILURE-CONTRACT.md` no longer marks it
   provisional.

## Find rate (NDA-012 stop signal)

| Category | Nodes audited | Nodes with ≥1 defect | New defects |
|---|---|---|---|
| Variables | 4 / 4 | 4 | 3 |

Three new defects in the *simplest* category in the library — `latestValue` initialising to `0`
regardless of type, `color` being a type dead end, and the String `length` getter that will throw the
moment NDA-003 makes `null` storable. Consistent with the second-pass calibration. Stop NDA-012 when
this table shows a category producing nothing new.

## Log

- **2026-07-29 (NDA-008 §0 resolved — the node is innocent)** — the scroll jump is real, is
  reproducible, and has nothing to do with the Component Stack. Measured with a Page Stack in a
  page taller than the viewport, scrolled so the header was off-screen: switching components moved
  the scroll position **0 px** and called `HTMLElement.prototype.focus` **0 times** (patched and
  counted), identically for `navigate`+Push, `replace`, and `useRoutes` on and off.
  - The trap is the viewer's app root: `viewer.jsx:344-353` wraps the whole app in
    `overflow: hidden; width: 100%; height: 100%`. That div is pinned to the viewport (663 px) and
    holds taller content (2337 px). **`overflow: hidden` stops the user scrolling, not the
    browser** — so a programmatic scroll is one-way, which is why the header never comes back.
    That asymmetry is the actual complaint, not the scroll itself.
  - The trigger is any real DOM focus: `element.focus()` moved it 0 → 1169;
    `focus({ preventScroll: true })` moved it 0 → 0. The library's only DOM focus is `TextInput`
    (`text-input.ts:211-214`), reached from its `Focus` input (`:132`) or from Noodl's click-capture
    focus system (`viewer.jsx:293-310`), which walks up from every click target calling `_focus()`.
    `Group._focus` only emits a signal, so Groups are not implicated.
  - **Fix deliberately not applied.** `preventScroll` is measured to work but is not obviously
    right: an author firing `Focus` on an off-screen field in a genuinely scrollable container
    expects it scrolled into view. The real question is whether the app root should be a
    hidden-overflow box that overflows at all — a decision about the viewer's layout root, for
    Richard. §1 and §3 of NDA-008 are unaffected and now unblocked; §2's no-scroll bullet moves out.
  - Also seen in passing: with `useRoutes` on and no page paths set, `_updateUrlWithTopPage` pushes
    a bare `#` onto the URL (`http://localhost:8574/#`). Cosmetic, unfiled.

- **2026-07-29 (NDA-016 done — §0 falsified the task's own premise)** — the fifth spec claim to
  fall to implementation, and the most consequential so far: the task was written around
  `Layout.size` having no `else` for an unset `sizeMode`, and **`sizeMode` is never unset.** Read
  live off a real node instance in the preview (reached through the React fiber on the rendered
  element — the viewer target exposes no runtime handle on `window`, but every visual node's DOM
  element leads back to its `noodlNode`): a fresh, never-touched Text node has
  `props.sizeMode === 'contentHeight'` and `props.width === '100%'`. 15 node types placed with no
  parameters at all, and every one carries its declared default.
  - The real defect: children read the parent's layout as `parentLayout` **at their own render**
    and `renderChildren` memoises the elements built from it. The Group's Layout setter wrote
    `props.layout` and called `forceUpdate()` — which re-renders the Group and hands React back the
    *same* children. So a layout change never reached them. Column → row left both Texts at
    `flex-shrink: 0` with no `flex-grow`, both 320px in a 320px row: the first eats the row. That
    is Richard's report exactly, and it is why the folklore workaround works — touching any port on
    a child re-renders *that child*.
  - `setLayout` is now the single writer of `props.layout` after init: it drops the memo,
    re-renders, and no-ops on an unchanged value so the memoisation still pays. Group, Radio Button
    Group, and deprecated Form/Fieldset adopt it. The four `initialize`-time assignments stay
    direct — no children exist yet.
  - §1 built anyway, and it turned out to be reachable from a direction the spec did not consider:
    the generic prop setter *deletes* the prop on `undefined`, so a **connection** into Size Mode
    that abstains still unset it. The port now restores the declared default (Empty-Value
    Contract), non-enum values report through NDA-004 as `dimensions/unknown-size-mode` once at the
    port rather than every render, and `Layout.size`'s `else` is documented rather than silent.
    Found in passing: `width`/`height`'s `onChange` read `value.isFixed` unguarded — an abstaining
    connection was a `TypeError` inside an input setter, not the inert value §0 candidate 4 guessed.
  - **Criterion 4 not run, on purpose.** The phase-23 screenshot corpus photographs editor chrome;
    this change is entirely in the viewer that renders the *user's* app. Running it would have been
    a green that tested nothing. The blast-radius check that does apply — 15 node types through one
    layout switch — was run instead and is recorded in the spec.
  - ⚠️ Method-on-the-node pattern worth reusing: anything a **child** reads off its parent at render
    time is invisible to `forceUpdate` and must clear `cachedChildren`. `props.layout` was the only
    such prop; if another is ever added, it needs the same treatment.

- **2026-07-29 (NDA-004 §1 + §3 priority pair)** — the runtime error channel exists
  (`8cca1a76`, `d491e6c2`, `2c16f6a7`). `runtimeerror.ts` is a plain synchronous bus in
  `noodl-runtime` with no editor dependency; `Node.raiseRuntimeError(code, message, detail?)` is
  the single entry point and fills in provenance itself. `sendWarning` is now a *subscriber*, so
  the editor shows what it always showed while every other runtime gets a structured
  `console.error`. Delivery is hardened deliberately: a throwing subscriber cannot stop the
  others, unsubscribing mid-delivery does not skip a neighbour, and re-entrant raises are
  depth-bounded so an `On App Error` node whose own graph fails cannot recurse the stack away.
  - Both NDA-002 TODOs are wired: the two cycle breakers raise `runtime/cyclic-loop` with a
    `detail` naming which one tripped and the runaway port; Collection listener throws raise
    `collection/listener-threw`, **unattributed** — `Array.prototype.on` keeps no node ref, and
    that gap is written into the contract rather than papered over.
  - `On App Error` shipped (registered in `noodl-runtime`, so it exists in cloud runtime and
    export, not just the browser). Every instance fires; no claiming. `Filter` narrows by code
    prefix, which is why codes are namespaced by node type.
  - **F1 and F1′ are green.** Run Tasks checks its template for a completion port as soon as the
    first task component exists, reports, and ends the run `failure` → `done`. A hang is the only
    outcome downstream cannot react to at all. NDA-009 §1 still owes the earlier editor-time check.
  - §3's priority pair: `Function` gained Success/Failure/Error (the reserved-name problem solves
    itself — author outputs are all `out-`prefixed), `Repeater` gained Items Rendered, fired when
    the operation queue drains rather than when `refresh()` returns.
  - **Live-verified** in the running editor: the library is 156 node types, `On App Error` among
    them, and all three nodes' new ports are present on the real `NodeLibraryData` — so static
    ports coexist with these nodes' dynamic-port machinery, which was the risk worth checking.
  - Second batch (`2be4e44b`): **Send Event, Close Popup, Navigate To Path, External Link,
    Unique Id**. All five had the same shape — an early `return` on the condition an author is
    most likely to hit, with no port and no report on the way out. Close Popup's missing
    `closeCallback` and External Link's popup-blocker `null` are the two the contract names by
    hand. Reporting only: Close Popup's *targeting* stays NDA-010 §2 / NDA-015. **Logic Builder
    untouched on purpose** — another session is mid-rewrite in that file.
  - `NODE-REGISTER.md` verdicts filled in for all eight fixed nodes; its `Mute?`/`Fail?` columns
    are knowingly stale until the catalog is regenerated cleanly.
  - Mute 10 status: 7 done (Function, Repeater, Send Event, Close Popup, Navigate To Path,
    External Link, Unique Id), 3 left (Logic Builder — blocked on another session; Pop Component
    Stack; Response).
  - Not done, and owed: §2's remaining per-node `Failure` outputs; those 3 mute nodes; criterion 2's
    cloud-runtime and **export** legs (the export one is the one the spec says will be forgotten);
    node-catalog regeneration for `On App Error` — **deliberately skipped** because the tree
    carries another session's uncommitted `logic-builder` rewrite and regeneration folds in any
    uncommitted node-source edit. `nodelibraryexport.ts` reads the live register, so the editor
    picker is already correct; only the generated JSON snapshot is stale.

- **2026-07-29 (Tier 1 complete + live QA)** — NDA-003 §2–3 landed (`e707f0cc`…`b2032129`): all
  corpus E-rows green, nullable Variables with `Treat empty as`, httpnode guard helper, E1/E8
  expectations reconciled to the decided contract. NDA-014 gained its **fifth consumer**
  (`61e8b3da`): `catalog:merge` validates against `docs/node-catalog/compatibility.json`, which
  still listed the new casts as rejected — the PORT-TYPE-CONTRACT checklist said four consumers;
  it is five. Consolidated live-editor pass over NDA-002/003/013/014: dev viewer build is fresh
  from source (so the preview runs the new collection code — the *committed* bundles under
  `noodl-editor/src/external/*` and `nodegx-backend/deploy/artifact/` remain stale until rebuilt);
  all collection probes pass in the real preview; zero exceptions; no cyclic-loop warnings; the
  editor's live typecast table carries object/array/color→string. **Tier 1 is done** (NDA-001,
  002, 003, 013) plus NDA-014 of Tier 2; remaining residuals: screenshot-corpus run for NDA-002
  criterion 3, and a live wiring demo of an `object` output to a Text node (table verified live,
  DOM demo not performed).
- **2026-07-29 (execution begins)** — The three gating decisions put to Richard and confirmed (see
  Decisions). All five contracts + the icon model written into `dev-docs/reference/`:
  `REACTIVITY-CONTRACT.md`, `EMPTY-VALUE-CONTRACT.md`, `FAILURE-CONTRACT.md`,
  `PORT-TYPE-CONTRACT.md`, `BINDING-CONTRACT.md`, `ICON-SOURCE-MODEL.md`. NDA-014 §2 applied:
  typecast table gains `object → string`, `array → string`, `color → string`; `setInputValue` gains
  the outbound JSON mirror (Dates keep their `String()` rendering; circular structures warn and
  deliver `''`); catalog and register regenerated; noodl-runtime jest green (1026 passed). NDA-001
  corpus build launched (Opus). ⚠️ The regenerated `node-catalog.json` also reflected *another
  session's uncommitted* logic-builder edits — only the typecast hunks were staged; if the catalog
  looks stale later, that is why.
- **2026-07-29 (later)** — All 16 tasks specced. Added the NDA-012 per-node audit protocol: twelve
  checks derived from defect classes A–F, and `scripts/node-audit/worksheets.js` generating one
  pre-filled worksheet per category (checks B1/B3/C1/E1/H1 answered from the catalog). Audited the
  Variables category as the worked example — 4/4, 3 new defects, one of which is a fix-ordering
  hazard for NDA-003.
- **2026-07-29** — Second pass, from Richard's five further reports. Four confirmed against source
  (Repeater Refresh rebuilding from a stale private copy; Parent Component Object binding to the
  nearest ancestor with no targeting; `object` outputs reaching 4 of 1,750 input ports; `Layout.size`
  having no branch for an unset `sizeMode`). Repeater Item **not** confirmed as broken — but `Try
  Remove` reaches only `forEachActions[0]` while `Added` fans out to all, which is a real asymmetry.
  Two new systemic classes: **E** (type dead ends) and **F** (implicit binding). Four tasks added;
  NDA-013 is Tier 1 because it stands alone and makes the Repeater recoverable before NDA-002.
  Recorded the calibration point: the structural sweep found none of these, so the register's blank
  rows carry no assurance.
- **2026-07-28** — Phase created from Richard's list of eight nodes plus the cross-cutting reactivity
  report. First-pass audit done: catalog swept (155 nodes), four systemic defect classes evidenced
  with file:line citations, eight named nodes read. Register generator added at
  `scripts/node-audit/register.js`. Tier 1 specced. One reported symptom (Component Stack scroll
  jump) could not be located in source and is recorded as unreproduced rather than guessed at.
