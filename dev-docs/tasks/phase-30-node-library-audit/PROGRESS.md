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
| NDA-008 Component Stack | 2 | 🔄 **§0/§1/§3 done** | **The stack does not scroll** — zero `focus()` calls and zero px moved across navigate/replace/useRoutes, measured. The scroll is browser focus-scroll into the viewer's `overflow: hidden` app root (`viewer.jsx:344-353`), triggered by the library's only DOM focus, `TextInput` (`text-input.ts:211-214`). **Richard chose "Both" (2026-07-29): fix the box, keep the feature.** Applied as `overflow: clip` on the app root — `clip` creates no scroll container at all, where `hidden` creates one only the *browser* can scroll. `TextInput` keeps its plain `.focus()`, so a deliberate `Focus` still scrolls the nearest genuinely-scrollable ancestor. Measured live on the same element in one session: `hidden` 0 → **1762 px**, `clip` 0 → **0 px**. §1 done: replace animates through the same `Transitions` machinery, defaulting to `None` so no existing project starts moving; the `// Only push mode have transition` gate is gone. §3 done: `Popped`/`Failure`/`Error` and **three** codes, not two — the unbriefed one is `transition-in-progress`, i.e. a double-tapped back button used to lose its second tap. Only §2's re-mount bullet is left |
| NDA-009 Run Tasks | 2 | ⬜ Not started | §1 alone closes corpus F1 |
| NDA-010 Popups | 2 | 🔄 **§2 done** | Close Popup now *pulls*: `showPopup` publishes `_popupCloseHandler` on the popup instance and the node walks up to it, so it works from anywhere in the popup's tree — 7 corpus rows, shown to discriminate. Criterion 2 met. **⚠️ §1's premise is partly stale**: `showpopup.ts:129-177` already derives typed `popupParam-*` from the target's input ports and `closeResult-*`/`closeAction-*` from its Close Popup nodes. The real gaps are the hand-typed `results`/`closeActions` on the *Close Popup* side and untyped (`*`) results — re-scoped in the spec. §3 (stack policy, corpus F2) untouched |
| NDA-014 Type dead ends | 2 | 🔄 §1+§2 done | Decision at [`PORT-TYPE-CONTRACT.md`](../../reference/PORT-TYPE-CONTRACT.md) (A now, C direction). Table changed (`object`/`array`/`color` → `string`), JSON mirror added in `setInputValue`, catalog + register regenerated, runtime jest green (1,026), editor suite green (1,885 specs incl. validator/catalog-index). Outstanding: live editor check of the 13 `object` outputs |
| NDA-015 Explicit binding | 2 | ✅ **Done + live-verified**; class F tail closed | All three sections. Clause (b) ships as a node-card sub-label over a new `nodesublabel` message — **not** CAN-001/002, which are wire labels, and **not** `metadata.typeLabelOverride`, which is persisted. §3: the FIXME was load-bearing and its own comment described what `scheduleAfterUpdate` already does. **Class F tail closed 2026-07-29**: `_forEachModel`'s 5 sites now resolve through `runtime/src/foreachitem.ts` (FINDINGS F-ii), and the de-duplication this task claimed was **only 1 of 4 call sites** — the other three were still hand-rolled with divergent type lists, which had a *reader and a writer* of the same state landing on different components (FINDINGS F-i′). 34 corpus rows total |
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

- **2026-07-29 (class F tail — `_forEachModel`'s five sites, and the walk that was never actually
  shared)** — the highest-value item left in the implicit-binding class, plus a defect found on the
  way in that was worse than the one being fixed.
  - **All five `_forEachModel` sites now go through one resolver**, `runtime/src/foreachitem.ts`:
    the two node files (`modelnode2`, `dbmodelnode2`), the two CRUD mixins (`modelcrudbase`,
    `dbmodelcrudbase`, which reach seven node types between them) and
    `javascriptnodeparser`. Every one of them used to end
    `setModel(component !== undefined ? component._forEachModel : undefined)` — so **`Id Source =
    From repeater` outside a Repeater bound to nothing and said nothing.** Now: optional
    `Repeater Component` input (a), the resolved template on the node card (b), and
    `repeater-item/no-item-in-scope` · `/target-not-found` · `/target-has-no-item` (c).
  - **There are two producers, not one.** `runtasks.ts:193` sets `_forEachModel` with the same
    `createNode` extraProps shape as the Repeater. The name, the docs and the spec all say
    "Repeater"; the messages say "Repeater or Run Tasks", because telling an author with a task
    template that they are not inside a Repeater sends them hunting a bug that is not there.
  - **The fifth site had to be lazy, and that is the interesting half.** `Component.RepeaterObject`
    is built for *every* Function node in the project, not only ones whose author asked for an item,
    so resolving eagerly would have filed a failure against every Function node in every
    non-repeated component. It is a getter on the component scope object — which is safe because
    the scope is handed to the user's script by reference, never spread or serialised. A corpus row
    pins the laziness, and it is the row that goes red if anyone "simplifies" it back.
  - **One of the five was crashing, not falling silent.** `dbmodelnode2.setModel` dereferenced its
    argument unguarded — a live defect carried as a comment since PLAT-003 NOTES §27.3 — so a
    `Record` set to "From repeater" outside a repeater threw a `TypeError` from inside an input
    setter. Its twin the Object node always guarded. The twins now agree.
  - **No `resolutionIsLoud` gate here, deliberately, and the reason is worth carrying.**
    `parentcomponentobject.ts` needs one because it looks for a *node* in an ancestor's scope that
    may not exist yet. This protocol has no such window: `extraProps` land on the instance at
    `nodecontext.ts:398-403`, *before* `setComponentModel` builds any inner node. Gating would only
    have delayed a true report. Written into BINDING-CONTRACT so a third case picks deliberately.
  - **⚠️ NDA-015's own claim was wrong, and this is the ninth spec/log claim to fall.** "One
    implementation now, in `componentwalk.ts`" — in fact **one of four** call sites had adopted it.
    `setparentcomponentobjectproperties.ts`, `parentcomponentstate.ts` and `javascriptnodeparser.js`
    were still hand-rolled *with their own type lists*, and those lists disagreed. F-i describes two
    readers disagreeing; what was actually shipping is **a reader and a writer of the same state
    disagreeing** — `Parent Component Object` read `/Outer` while the `Set Parent Component Object
    Properties` node beside it wrote `/Root`, whenever a deprecated `Component State` sat nearer
    than a modern Component Object. All four now share the walk *and* the type list
    (`COMPONENT_OBJECT_TYPES`). The deprecated node's list stays narrower on purpose: widening it
    would have moved bindings rather than aligned them.
  - **`componentwalk.ts` now documents that there are two walks**, and they are not
    interchangeable — the visual-aware ancestor walk for "an ancestor owning a node of type X", and
    the new self-inclusive `scopeChain` (`parentNodeScope` only) for ambient properties. Using the
    wrong one moves bindings silently, so the table is in the contract.
  - **18 new corpus rows, all shown to discriminate** by three separate revert-and-rerun passes:
    reverting the resolver reddens 8 of 13 and leaves all 5 controls green (including "the innermost
    Repeater wins", which pins that existing bindings did *not* move); narrowing the write-side type
    list back reddens the read/write agreement row alone; making the Function-node scope eager
    reddens the laziness row alone.
  - Gates: runtime jest **1,075** (was 1,072), viewer jest **140** (was 125), both typechecks green.
  - ⚠️ **Catalog regeneration owed** — same blocker as NDA-004 and NDA-015 before it: the tree still
    carries another session's uncommitted node-source edits, and regeneration folds them in. Seven
    node types gain a `repeaterComponent` input: **Object** (`Model2`), **Record** (`DbModel2`),
    **Set Object Properties**, **Set Record Properties**, **Delete Record**, **Add Record
    Relation**, **Remove Record Relation**. The two `Create New …` nodes correctly do *not* —
    `addModelId({ includeOutputs: true })` leaves `includeInputs` falsy, which is right for a node
    that creates rather than references. `nodelibraryexport.ts` reads the live register, so the
    editor picker and property panel are already correct; only the generated JSON snapshot is stale.
  - Owed: live QA (jest only so far).

- **2026-07-29 (NDA-008 §1 + §3)** — the last two open sections of the Component Stack task.
  - **§1: replace had no animation *surface*, not just no animation.** `replaceAsync` deleted every
    current page before creating the new one, so there was never anything to transition from, and
    the entry it pushed carried no `transition` at all. Three places encoded the split — the viewer,
    the Navigate node's `navigate()` (which forwarded no transition in replace mode), and its
    `_updatePorts`, whose comment `// Only push mode have transition` was the defect stated out
    loud. Replace is now "push, then drop the previous entries once the transition completes".
  - **The default did not move, on purpose.** Push has always defaulted to `Push`, replace has never
    animated; matching them would silently animate every replace node in every existing project. So
    the transition port's default is per mode — `Push` for push, `None` for replace. Half the new
    rows pin that rather than the feature.
  - **Found on the way: `getChildren()` returns the live array**, and both `replaceAsync` and
    `resetAsync` removed while iterating it by index — so with two children they deleted one and
    left the other mounted for ever. Invisible while a stack had one visible child. Fixed in both.
  - **§3: three silent failures, not the two the spec named.** `Pop Component Stack` gains
    `Popped`/`Failure`/`Error` with `pop-component-stack/no-stack-in-scope`, `/stack-at-root` and
    `/transition-in-progress`. The third was not in the brief and is the one authors actually hit:
    `back()` returned early while animating, so **a double-tapped back button lost its second tap
    without trace**.
  - `PageStack.back()` returns a `StackBackResult` rather than `void`. The stack deliberately does
    *not* raise — it did not fail; the Pop node was asked to act and could not, and it owns the port
    and the provenance. A callback returning nothing counts as success, because `_setBackCallback`
    is reachable across the node-type boundary and "told us nothing" must not read as failure.
  - 12 new rows (7 + 5), the §1 ones verified discriminating. Viewer jest **125**, runtime jest
    **1,072**, viewer typecheck green.
  - Owed: live QA of both (jest only so far), and NDA-004's last two mute nodes are now **Response
    and Logic Builder** — Logic Builder still blocked by another session's uncommitted rewrite.

- **2026-07-29 (NDA-008 §0 fixed — Richard chose "Both")** — the scroll jump is closed at the viewer's
  app root, and `TextInput` keeps its plain `.focus()` so a deliberate `Focus` still brings an
  off-screen field into view.
  - **The fix is one property, and it is `clip` rather than `hidden`.** `overflow: hidden` still
    creates a *scroll container* — it removes the scrollbars, not the scrolling — so the browser can
    scroll it (any real DOM focus does) while the user cannot scroll it back. `overflow: clip`
    creates no scroll container at all, so neither side can, and the two agree again. Focus-scroll
    then lands on the nearest ancestor that genuinely *is* scrollable — a Group with scroll enabled
    — which is exactly the behaviour `preventScroll: true` would have destroyed.
  - **Measured live, both ways, on the same element in one session**, with a page 2400 px tall in a
    529 px viewport and an input 2018 px below the fold: with `hidden`, focusing it moved the app
    root **0 → 1762 px**; with `clip`, **0 → 0 px**. Window and body stayed at 0 throughout.
  - **`#root` in the two host pages is changed too, and is honestly labelled as defensive.** It is
    *not* the element that caused this: measured at 0 px even with the app root fixed, because its
    only child is `height: 100%` and its content never exceeds it. Kept because it is the identical
    trap one layout change away, with both declarations (`hidden` then `clip`) so Safari < 16 keeps
    today's behaviour instead of falling back to `visible` and letting content escape.
  - Only two host pages are tracked (`noodl-viewer-react/static/{viewer,deploy}/index.html`);
    `noodl-editor/src/external/*/index.html` are build artefacts.
  - Viewer jest 113 green, viewer typecheck green.

- **2026-07-29 (NDA-015 §1–§3 + NDA-010 §2 — the Binding Contract, applied)** — both named nodes now
  obey all three clauses, and the sweep the spec asked for turned up more than the spec named.
  - **The walk existed four times and had already drifted.** `parentcomponentobject.ts`,
    `setparentcomponentobjectproperties.ts`, `javascriptnodeparser.js` and the deprecated
    `parentcomponentstate.ts` each carried a hand-copied `getParentComponent`. The `.js` one accepts
    the deprecated `'Component State'` node type; the two TS ones do not. So **a Function node
    reading `Component Object` and a Parent Component Object node sitting in the same place could
    resolve to different ancestors**, silently. One implementation now, in
    `runtime/src/componentwalk.ts`, and the Component Object family accepts both types.
  - **Close Popup was pushed to; now it pulls.** `showPopup` handed its close callback only to
    `getNodesWithType('NavigationClosePopup')` on the popup's *own top-level scope*, so a Close
    Popup one component deeper was never given one — that is the whole of "very hard to find the
    right place to put the close popup node". It now publishes `_popupCloseHandler` on the popup's
    component instance (unconditionally: the old registration ran only when a top-level Close Popup
    happened to exist) and the node walks up to it. The handed callback is still preferred, so
    graphs that work today take the path they took before.
  - **Clause (b) needed a new channel, and the spec pointed at the wrong one.** CAN-001/002 are
    *connector* labels — text on a wire — and carry nothing about a node. The surface that works is
    the node card's sub-label, which the painter already draws and which nothing at runtime could
    reach. New one-way `nodesublabel` message → `NodeGraphNode.runtimeSubLabel` → the existing
    sub-label paint. **Not** `metadata.typeLabelOverride`, the other writer of that slot: metadata is
    persisted, and writing a runtime value there would dirty `project.json` on every preview (class
    F46). **Not** a warning either — a binding that worked is not a problem.
  - **One canvas node is many runtime nodes.** `ResolvedTargetReporter` aggregates a graph node's
    live instances before sending, keyed per `NodeContext`. When instances genuinely disagree it says
    "→ 2 targets: A, B" rather than showing whichever updated last — which is the contract's litmus
    test answered honestly, not a fallback.
  - **§3: the FIXME was load-bearing and its own comment described the fix it was waiting for.**
    `scheduleAfterUpdate` is not a timer — `updateDirtyNodes` drains `callbacksAfterUpdate` after the
    dirty-node loop *within the same pass*, re-looping until settled, so the whole tree exists by
    then. `nodeScopeDidInitialize` alone is genuinely too early (it fires part-way through the
    parent's node-creation loop). Reworded, not deleted, and now also the point at which reporting
    goes loud: raising before it would report a failure on every correctly-wired graph on load.
  - **Sweep result (criterion 4), recorded in FINDINGS as F-i/F-ii.** The class is wider:
    `_forEachModel` — "the current Repeater item" — is resolved by the same kind of walk in **five**
    places (`modelcrudbase`, `modelnode2`, `dbmodelcrudbase`, `dbmodelnode2`, `javascriptnodeparser`),
    each ending in a silent `undefined`. So **Id Source = Repeater Item outside a Repeater binds to
    nothing and says nothing**. Not fixed — five files this task does not otherwise touch — but named
    as `findAncestorWithProperty` so a sixth spelling is not invented. Highest-value item left in the
    class. What the sweep *cleared* is recorded too.
  - **Harness gaps closed, both worth knowing.** `frame()` now emits `frameStart`/`frameEnd` like
    `NoodlRuntime._doUpdate` — it did not, so anything deferred with `scheduleNextFrame` (closing a
    popup) never ran and read as a node doing nothing. And `graph.errors` exposes the error channel
    directly, because `editorConnection.warnings` carries only the message, not the `code`.
  - **NDA-004 assertion moved with it:** Close Popup's `Error` output now carries the same sentence
    as the raised event instead of a shorter separate one — the Failure Contract asks for exactly
    that, and two wordings of one failure is "no information one level up" in miniature.
  - 16 new corpus rows, verified discriminating: removing the pull seam reddens 4 of the popup rows
    and leaves the pinned control green. Gates: runtime jest **1,072**, viewer jest **113** (was 97),
    editor jasmine **1,885 / 0 failures** — all unchanged from baseline apart from the additions.
  - ⚠️ **Catalog not regenerated** for the two new `targetComponent` inputs, same reason as NDA-004:
    the working tree still carries another session's node-source edits and regeneration folds them
    in. `nodelibraryexport.ts` reads the live register, so the editor's picker and property panel are
    already correct; only the generated JSON snapshot is stale.
  - ✅ **Live-QA'd in the running editor**, which is the half jest cannot reach. A scratch project
    with `App > /Outer > /Inner`, both outer components owning a Component Object:
    - the implicit node's card reads **`→ /Outer`** in the sub-label slot, muted, under the wrapped
      title — the correct ancestor, not the nearer one it shares a component with;
    - its card is **78 px** against the sibling's **64 px**, so `relayout` did run and the card grew
      by exactly the sub-label line rather than painting text into an old box;
    - the sibling targeting a non-existent `/Nowhere` shows **no** sub-label and instead carries the
      dashed danger ring, the warning glyph and `No ancestor component named "/Nowhere"` on hover,
      with the toolbar warning count at 1 — so clause (c) reaches the editor through NDA-004's
      channel and the editor's warning adapter, unchanged;
    - `targetComponent [input component]` is present in the node type's exported ports, so the
      property panel offers the component picker **without** the catalog regeneration below.

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
