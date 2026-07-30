# Phase 30 — Progress

**Track O — Node Library Audit & Remediation**

**All 16 tasks specced as of 2026-07-29.** None started.

| Task | Tier | Status | Notes |
|---|---|---|---|
| NDA-001 Node behaviour corpus | 1 | ✅ **Done** `7a27e7c3` | 34 tests (16 `test.failing`, 18 pinned), wired into `pr.yml` `test-packages` — verified, not assumed. Two spec corrections: **E6 is a failing row** (`undefined` *overwrites* the key with the type default, worse than documented), and E8's propagation half already works — the defect is the `String` cast. F2/F3 are node-boundary/SSR proxies, documented in the corpus README |
| NDA-002 Reactivity contract | 1 | ✅ **Built** `bd6632ca`…`825da393` | R1–R9 green unmarked; all suites green. **`items === arr` does NOT break** — `Collection.get`/`create` return a memoised Proxy, so identity holds and the raw array is simply unreachable. Mutating methods intercepted in the `get` trap (traps alone storm 3–4 changes per `splice`). Perf: only indexed reads regress (~0.3 µs/read Proxy floor; digit-leading fast path recovers 28%). ⚠️ `packages/noodl-editor/src/external/*` + `nodegx-backend/deploy/artifact/` embed stale `collection.ts` copies until rebuilt. Live QA + QA-fixture cyclic-warning check pending |
| NDA-003 Empty-value contract | 1 | ✅ **Built** `e707f0cc`…`b2032129` | All E-rows green unmarked. Nullable Variables shipped with `Treat empty as` (String/Color: `null`/`''`; Number: `null`/`0`; Boolean: `null`/`false`); corpus E1/E8 expectations reconciled to the contract (`null`, not `''`). String `length` returns 0 on null store. httpnode normalised to one helper (both omit; JSON body keeps `null`-is-sent, documented). E5's null-clears-collection worked by accident — now explicit + tested. Enriched catalog needed the NDA-014 compatibility fix first (`61e8b3da`) |
| NDA-013 Repeater Refresh | 1 | ✅ **Done** `0e96c93a` | `refresh()` resyncs from `items`; queue race handled by truncating the ops `set()` just appended (synchronous span, nothing interleaves). Full teardown kept deliberately, documented. Refresh added to Array Map; Array Filter's premise was wrong — its `Filter` signal always re-read fresh, `refresh` added as alias. 3 new corpus rows red→green. Live QA pending |
| NDA-004 Failure contract | 2 | 🔄 §1 done, §3 **9 of 10**, §2 two batches | Channel at `packages/noodl-runtime/src/runtimeerror.ts`; `On App Error` node; F1/F1′ green. §3: only **Logic Builder** left, still blocked by another session's uncommitted rewrite — `Response` landed 2026-07-29 (it was hiding a `TypeError` out of an input setter *and* a silently-discarded second answer). §2 batch 1: Set Object Properties, Set Record Properties, Add/Remove Record Relation. §2 batch 2 (2026-07-30): **Set Parent Component Object Properties** (reported `Done` for a write into a throwaway record — worst class-B defect so far), **Parent Component Object**, **Video** (×2 failures), plus Component Object and Set Component Object Properties 🔵 on evidence. **Remaining: §2's ⏳ list in the register, criterion 2's cloud + export legs, catalog regeneration** |
| NDA-005 Port documentation | 2 | ⬜ Not started | Do the shared port definitions first and re-measure; batch with NDA-012 |
| NDA-006 Columns | 2 | 🔄 **Slices 1+2 done** | **Slice 2's premise was wrong**: a Repeater adds its items as *siblings* of its `ForEachComponent` (`foreach.tsx:472`), so they were always wrapped and sized — filtering the `ForEachComponent` out is *correct*, and F3's original expectation is reconciled, not satisfied. Seven real defects found instead, four of them worse: autofold was dead the moment an author set Horizontal Gap (a units port writes `'16px'`, and `number < string` is `NaN`); a Repeater that was a Columns node's **only** child was dropped from the tree entirely and never mounted; only the **first** of several Repeaters was rendered; wrappers were keyed by position, so a Repeater deleting one row remounted every row after it. Plus `calcAutofold` mutating its caller, folding to *zero* columns (`width: NaN%`), a double space in the layout string doing the same, and `visibility: hidden` painting blank through the whole of SSR. 11 corpus rows, 7 reverts, each reddening only its own. **Slice 3 done 2026-07-30** — Richard chose "both": `Column Sizing` → `Auto Fit` (one input, as many columns as hold their minimum) plus `Medium Below`/`Small Below` layout strings. **Container width, not viewport** — nothing in the editor or styles system has a breakpoint concept to extend (checked), and the node already measures its container, so the same node behaves correctly inside a sidebar or a repeater cell. Static ports, so no dynamic-port machinery and the AI loop sees them. 19 rows, 11 reverts. **Slice 4 (masonry) is now unblocked. Live QA owed** — the key fix is not reachable without a DOM |
| NDA-007 Icon sets | 2 | 🔄 **§1 done + renderer built** | Model at [`ICON-SOURCE-MODEL.md`](../../reference/ICON-SOURCE-MODEL.md) — tagged union (`font`/`sprite`/`inline`), sanitise-at-registration policy decided (no existing viewer policy existed to match; checked). **2026-07-30: the union is real in the renderer.** The font-triple splat existed in **six** components, each hard-wired to font semantics — widening the model meant widening it six times or once; now once, in `IconGlyph.tsx`. Criteria 2 and 3 met (font output byte-identical, `iconSize`/`iconColor` identical across kinds via `1em`+`currentColor`). 15 corpus rows. ⚠️ **§2 (registration) and §3 (picker) remain** — a sprite value renders but cannot yet be installed or selected, and the sanitiser runs at render time until §2 gives it a registration to live in |
| NDA-008 Component Stack | 2 | ✅ **Done — all four sections** | **The stack does not scroll** — zero `focus()` calls and zero px moved across navigate/replace/useRoutes, measured. The scroll is browser focus-scroll into the viewer's `overflow: hidden` app root (`viewer.jsx:344-353`), triggered by the library's only DOM focus, `TextInput` (`text-input.ts:211-214`). **Richard chose "Both" (2026-07-29): fix the box, keep the feature.** Applied as `overflow: clip` on the app root — `clip` creates no scroll container at all, where `hidden` creates one only the *browser* can scroll. `TextInput` keeps its plain `.focus()`, so a deliberate `Focus` still scrolls the nearest genuinely-scrollable ancestor. Measured live on the same element in one session: `hidden` 0 → **1762 px**, `clip` 0 → **0 px**. §1 done: replace animates through the same `Transitions` machinery, defaulting to `None` so no existing project starts moving; the `// Only push mode have transition` gate is gone. §3 done: `Popped`/`Failure`/`Error` and **three** codes, not two — the unbriefed one is `transition-in-progress`, i.e. a double-tapped back button used to lose its second tap. **§2 done 2026-07-29**: re-selecting the page already on top used to re-mount it in *both* modes, and push also pushed a duplicate entry (depth 1 → 2), so every click on the active tab lost its state and grew a stack Back had to walk back through. The no-op is **params-aware** — same component with different params is the master→detail idiom and must keep pushing — and replace additionally requires depth 1, since on a deeper stack it still has collapsing to do. `hasNavigated` still fires, or a re-selected tab would be a dead button. **NDA-008 is complete** |
| NDA-009 Run Tasks | 2 | ⬜ Not started | §1 alone closes corpus F1 |
| NDA-010 Popups | 2 | 🔄 **§2 done** | Close Popup now *pulls*: `showPopup` publishes `_popupCloseHandler` on the popup instance and the node walks up to it, so it works from anywhere in the popup's tree — 7 corpus rows, shown to discriminate. Criterion 2 met. **⚠️ §1's premise is partly stale**: `showpopup.ts:129-177` already derives typed `popupParam-*` from the target's input ports and `closeResult-*`/`closeAction-*` from its Close Popup nodes. The real gaps are the hand-typed `results`/`closeActions` on the *Close Popup* side and untyped (`*`) results — re-scoped in the spec. **§3 done 2026-07-30** — one modal slot by default (`When A Popup Is Open` → `Replace It`), `Show On Top` as the opt-in. The policy lives in `NodeContext.showPopup`, not on the node, because two Show Popup nodes cannot see each other — which is why **F2's expectation was reconciled, not satisfied**. The slot is claimed *before* the first `await` or the race just moves. A replaced popup gets a new **`Dismissed`** signal rather than `Closed`, on NDA-004's Open-File-Picker reasoning. Also fixed: `Noodl.Navigation.showPopup` called `undefined.replace` on every ordinary close. Criterion 1 met; **§1 remains**, and this unblocks NDA-004 §2's ⏳ item 3 (Show Popup) |
| NDA-014 Type dead ends | 2 | 🔄 §1+§2 done | Decision at [`PORT-TYPE-CONTRACT.md`](../../reference/PORT-TYPE-CONTRACT.md) (A now, C direction). Table changed (`object`/`array`/`color` → `string`), JSON mirror added in `setInputValue`, catalog + register regenerated, runtime jest green (1,026), editor suite green (1,885 specs incl. validator/catalog-index). Outstanding: live editor check of the 13 `object` outputs |
| NDA-015 Explicit binding | 2 | ✅ **Done + live-verified**; class F tail closed | All three sections. Clause (b) ships as a node-card sub-label over a new `nodesublabel` message — **not** CAN-001/002, which are wire labels, and **not** `metadata.typeLabelOverride`, which is persisted. §3: the FIXME was load-bearing and its own comment described what `scheduleAfterUpdate` already does. **Class F tail closed 2026-07-29**: `_forEachModel`'s 5 sites now resolve through `runtime/src/foreachitem.ts` (FINDINGS F-ii), and the de-duplication this task claimed was **only 1 of 4 call sites** — the other three were still hand-rolled with divergent type lists, which had a *reader and a writer* of the same state landing on different components (FINDINGS F-i′). 34 corpus rows total |
| NDA-016 `Layout.size` | 2 | ✅ **Done** | **§0 resolved: the spec's premise was wrong.** `sizeMode` is never unset — a fresh Text node carries `contentHeight`/`100%`, read live. The real defect is a stale `parentLayout`: children bake the parent's layout in at *their* render, `renderChildren` memoises them, and the Layout setter never invalidated the memo — so a layout change never reached the children, and the first child ate the row. Fixed with `setLayout` as the single writer. §1 built too, on its own terms (an abstaining *connection* can still unset the port). 10 regression tests; 15-node-type live blast-radius check. Criterion 4's screenshot corpus is an instrument mismatch — see the spec |
| NDA-011 REST → HTTP | 3 | ✅ **Done — §1, §2 decided, §3 already met** | Assessment at [`NDA-011-CAPABILITY-COMPARISON.md`](./NDA-011-CAPABILITY-COMPARISON.md). **There is no resource DSL**: REST is one path template plus two `new Function` scripts, and does *neither* of the things the spec lists as what a DSL is good for. HTTP Request wins every declarative row; REST wins two, both "run some JavaScript". So it is **not** a clean subset → **deprecated, not deleted**, with the conversion path left to LIB-006. §3 needed no work (NDA-003 already made the six guards one helper; `responseHeaders` became usable via NDA-014's `object → string` cast). **Criterion 3 was six nodes, not four** — and they held the *plain* names their modern replacements show via `displayName`, so the picker offered two entries reading "Button" and the deprecated one was as likely to be picked |
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

- **2026-07-30 (NDA-006 slice 4 — masonry)** — `b33b1b3e`. **NDA-006 is complete**, four slices. 10
  corpus rows, 7 reverts each reddening only its own, viewer jest **359**, live-verified.

  **The spec named the right trade-off and missed the deciding option.** It framed the choice as CSS
  `columns` (cheap, reorders children column-major) versus a JS-measured absolute layout (preserves
  order, needs measurement). There is a third, cheaper than both and not mentioned: **a `<div>` per
  column with the items distributed into them**, which needs no measurement at all because the
  browser stacks each strip. That is what I would have built. It is wrong for a reason that only
  exists because of slice 2: inserting or removing one item shifts every later item's column, so an
  item changes **parent**, and React unmounts and remounts it however it is keyed. That is the
  remount storm slice 2 fixed — and masonry over a Repeater is the request, so **the one structure
  that has to survive insert and remove is the one that would not.** Keeping a flat, stably-keyed
  child list and moving items with `top`/`left` is what costs the measurement, and that is what buys.

  Generalisable, and it is the ninth spec premise this phase has had to correct but a *new* shape:
  **the cheapest implementation of a new slice can be excluded by a defect an earlier slice fixed.**
  The exclusion is invisible from the spec, which was written before slice 2 knew what its defect was.
  Re-read the slices you already landed before choosing between the options a later one offers.

  **The ordering an author gets, decided and documented: row-major, as authored.** Item `i` is in
  column `i % columnAmount` — the *same* assignment Rows mode already makes for the width — so
  switching Rows → Masonry never moves an item to another column and never changes its width. It only
  stops each wrap line aligning to its tallest item. That framing is why `Item Packing` is a separate
  input from `Column Sizing` rather than a third value on it: packing is not a way of deciding how
  many columns there are, so it composes with `Auto Fit` and the slice 3 breakpoints instead of
  having to reinvent them.

  **Balanced (shortest-column-first) packing is rejected on a feedback argument, not a cost one.**
  With unequal fractions an item's width depends on which column it lands in, its height on its
  width, and the packing on its height: no fixed point, and it oscillates on exactly the layouts
  `'1 2 1'` was added for. Round-robin has stable widths. So columns are ragged, and that is on the
  port's own tooltip — criterion 4 asks for the ordering to be *documented*, and an author reading
  the property panel is where that has to land.

  **A latent hooks-order bug in the same function, found by adding hooks to it.** `if
  (!props.children) return null;` was the first statement, ahead of `useRef`/`useState`/`useEffect`.
  A Columns node whose last child is deleted therefore renders fewer hooks than the previous pass and
  React throws — and deleting a child while the app runs is what live graph editing *is*. Moved
  below the hooks. Worth grepping for: an early `return null` in a component that later grew hooks is
  a silent time bomb, and it reads as defensive code.

  **Live QA, and one measurement that is only available live.** Seven boxes of known unequal heights
  over three columns pack to the computed tops (`0,0,0,40,90,60,160`), lefts (`0/33.3/66.7%`) and a
  container height of **230** — the tallest column, not the sum. Growing one box from 40 to 140 moves
  the item below it to 140 and the next in that column to 260, container height 330, **and every
  wrapper is still the same DOM element** — the flat-list guarantee, observed. That is the
  `ResizeObserver` → offsets → `position: absolute` wiring, which no row in this package can reach.
  The slice 2 key fix was re-checked after the restructure and still holds.

  ⚠️ Criterion 5's **deployed** leg is still owed: row D7 pins the unmeasured render through
  `react-dom/server`, but nobody has looked at masonry in a real deploy. Catalog regeneration owes
  `packing` as well now.

- **2026-07-30 (live QA of the parallel batch — NDA-006, NDA-010 §3, NDA-011)** — five claims, one
  editor launch, **all five pass**, and the pass turned up one defect of its own. Nothing shipped in
  that batch had been watched running.

  **The Columns wrapper-key fix is verified, and it needed a witness the tests cannot have.** There
  is no jsdom and no `react-test-renderer` in `noodl-viewer-react`, so B4 pins the precondition and
  says so. In the editor: a Columns node whose **only authored child** is a Repeater over four
  records; remove the record at index 1 from the Repeater's source collection; then compare the
  surviving `.column-item` wrappers and their `<input>`s against **references captured before the
  removal**. With the fix, `[0,2,3]` survive by strict `===` identity, the `data-qa-was` expandos set
  on the original elements are still on them, hand-set `input.value`s on rows 2 and 3 are intact, and
  `document.activeElement` is still row 2's input. With `key={child.key ?? i}` reverted to `key={i}`:
  three wrappers survive but they are wrappers **0, 1, 2** — positions, not children — the inputs at
  positions 1 and 2 are DOM elements that did not exist before, both typed values are back to their
  `startValue`, and the focused input is **no longer in the document**. Exactly the described defect,
  and the revert flips every one of the five measurements.

  **What the right witness is, generalised.** The obvious instrument — the per-instance
  `input-<guid>` class that NDA-008's state check used — proves *nothing* here, and would have
  produced a false pass. That guid is minted in the node's `initialize()`, and a React
  unmount/remount does not recreate the *node*; the class is identical under the bug. Reconciliation
  is only observable as **DOM element identity**, so the measurement has to hold references across
  the mutation. A banked technique is a technique *for a question*; carrying it to a neighbouring
  question is how you get a green that means nothing.

  **Columns + Repeater as the only child renders**, and the rows get column boxes: container 3 has
  four `.column-item`s, each holding a distinct `input-<guid>`. **Auto Fit and both breakpoints are
  right at four container widths**, measured by setting the wrapper's width and letting the node's own
  `ResizeObserver` fire — 1200 / 900 / 700 / 450 px gives `1 1 1 1` → `1 1 1 1` → `1 1` → `1` for the
  breakpoint node (medium 800, small 500) and 6 / 4 / 3 / 2 columns for Auto Fit (`minWidth` 200,
  `marginX` 0). Small is reached before medium, as the row asserts.

  **NDA-010 §3's stack policy holds on the real path.** Two Show Popup nodes wired from one Button's
  `Click`, both on the default `Replace It`: one popup in the DOM (`POPUP-B`), `popupStack.length`
  1, and the superseded node sent **exactly one signal — `Dismissed`**. No `Closed`, no `failure`.
  That is the distinction the task argued for, observed rather than reasoned.

  **NDA-011's picker claim holds**, and checking it properly found a defect the task missed. The
  picker's search for "Button" returns three entries — Button, Radio Button, Radio Button Group —
  and all six legacy controls carry `deprecated` while all six `net.noodl.controls.*` do not
  (`Options`/`Range` never collided: their replacements are "Dropdown" and "Slider"). But grouping
  **all 156** registered types by picker label — one `reduce` over `NodeLibraryData.nodetypes` —
  leaves eleven duplicated labels, and one of them has two *creatable* entries:
  `DeleteDbModelProperties` and `noodl.byob.DeleteRecord` both read **"Delete Record"** in category
  **Data**. Filed in `FINDINGS.md`; deliberately **not** fixed, because it is a naming decision
  between the Parse-wire and BYOB families rather than a mechanical one. **A criterion about the
  registry has to be checked against the registry** — reading the nodes one spec named finds only
  the instances that spec knew about.

  NDA-007's renderer half was not exercised: a `sprite`/`inline` value renders, but §2/§3 are
  unbuilt so there is no way to *get* one onto the port without hand-editing, and §1 already carries
  15 rows plus a narrowing the compiler enforces. It belongs to the §2/§3 launch, not this one.

  No code changed. Fixture and technique in `NEXT-SESSION.md`.

- **2026-07-30 (NDA-004 §2 — criterion 4's last coding items: Array Filter, item 7, Show Popup)** —
  `928531ce`, `e442c9a1`, `27184f12`, plus `674aee0f`. **Criterion 4 is now met for every node
  that is a coding task**; the only ⏳ left in the register is item 9, the deprecated five, which
  is a scope decision for Richard. Runtime jest 1,119, viewer jest 349.

  **Array Filter** — the trigger flag the register asked me to invent was *already in the source*,
  inverted: every value-arrival path is guarded by `isInputConnected('filter') === false`, so all
  that was missing was a record of which kind of run the deferred callback is running. And the
  triage predicted one failure where there are two: `applyFilter` builds a `RegExp` from the
  author's `Value` port **per item**, so a malformed pattern throws out of a scheduled callback
  into the blanket catch. Clear Array's shape, reached from a typo in a text field. The two are
  gated differently on purpose — "no array yet" is a state the graph passes through, a pattern
  that cannot compile never is.

  **Item 7** — five nodes, four answers. **Set Variable** is the phase's worst shape in one of its
  simplest nodes: `Model.set(undefined, value)` neither throws nor no-ops, it writes a key
  literally named `undefined` on the shared variables record and fires `Done`. Third confirmed
  false-success instance, reached by not filling in a field. **Repeater Item** was the **sixth**
  hand-rolled `_forEachModel` read — NDA-015 converged five and recorded "one implementation now",
  and the one it missed is the node *named after the mechanism*. **Filter Records** is Array
  Filter's twin, read rather than assumed. **Stream Buffer** ✅ with a deliberate non-fix: an empty
  `Flush` is a legitimate empty result. **State History** 🔵, in a family with two ✅ siblings.

  **Show Popup** — sequenced after NDA-010 §3 as the register asked. Every outcome it had was an
  outcome of a popup that *opened*, so "never opened" and "not finished with yet" were the same
  observable. And the second failure is a crash: `showPopup` is `async`, `getComponentModel`
  throws for an unregistered name, and the node dropped the promise — an **unhandled rejection**,
  which is not even caught by `nodecontext.ts`'s blanket catch. Fixed from the node so as not to
  touch `nodecontext.ts`, which another workstream held this session.

  **The `hasOutput` top-up found a present defect, not a future one.** Retro-fitting those
  assertions to the batch-1/2 files was meant to protect against regression; it found that
  **Send Event has fired a `Failure` with no `Error` port since batch 1** — a raised code and
  nothing an author can read on the canvas, which the contract calls out by name. The rows
  written at the time asserted the signal and the code, so two batches went by.

  **Three discrimination checks failed and were fixed, all the same way.** A control that was
  supposed to prove "this does not fire on the happy path" stayed green with the guard removed,
  three times: `setError`'s early-return dedup made the agent nodes' guard unreachable from a
  fresh node; Array Filter's boot control set no parameters, so the scheduler was never reached;
  and Filter Records' two controls passed **vacuously** because `signalsFor` on a node that failed
  to construct returns `[]`. The generalisation is in FINDINGS: a "does this stay silent" control
  has to drive the state the method is actually called in, and has to be able to tell *silent*
  from *absent*.

- **2026-07-30 (NDA-004 §2 — the 21 remaining `setError` helpers)** — FINDINGS B-iv **closed**, in
  two commits: `2a448a45` (the user/auth eleven) and `1579121f` (the last ten). 66 new corpus rows
  plus assertions added to four existing ones. Runtime jest 1,109, viewer jest 298.

  **B-iv's own table was wrong, and the correction is the finding.** It counted twenty-two
  `setError` *definitions* and read them as copies of one that posted to
  `editorConnection.sendWarning`. Fourteen do. **Six posted nowhere at all** — the message reached
  the `Error` port and stopped — and that is *worse*, not lesser: an editor-only diagnosis at least
  exists while an author is building; these had none in any runtime, the editor included. Three
  nodes (Subscribe To Changes, State Snapshot, Undo/Redo) also had **no `Failure` port**, so they
  failed both clauses of the contract at once and the register's `Fail?` column saw neither.

  Generalised in FINDINGS: **a count of look-alike call sites is a hypothesis about them, not a
  description.** That is the phase's fifth lesson applied to a finding *in our own notes* rather
  than to source, and the third time a claim of ours has needed re-checking the way a spec premise
  does.

  On code namespaces: `record/storage-op-failed` is right where seven node types share one funnel
  and the message distinguishes them; it is wrong where each node has its own funnel and the
  *operation* is the distinguishing fact, so the user/auth eleven get `user/<operation>-failed`.
  Same question, opposite answers, for a reason that is legible either way.

  The deprecated pair moved despite ⏳ item 9 being open, because that question is whether
  deprecated nodes should *gain* failure surfaces and these already had them. Deprecated
  `dbcollectionnode` is the nicest outcome: its `_internal.err`-vs-`error` port bug stays (PLAT-003
  §23.4 — fixing it changes behaviour), but the raise carries the message, so the contract's "a
  `Failure` must be accompanied by a message" is met without touching the port.

  **Two discrimination checks found problems, one of them in a control I had just written.**
  Reverting only `clearWarnings` reddens exactly the eleven round-trip rows; reverting only the
  raise reddens the channel rows and turns the round-trip rows back green — the pair is what shows
  they pin the *pairing*. And the `message !== undefined` guard survived its first control:
  `setError` opens with `if (this._internal.error === message) return`, so on a node that has never
  failed the guard is unreachable. The path that reaches it is a clear following a **real** error —
  the moment the node starts working again, which is precisely when an unguarded port would report
  `Failure`. Banked: an early-return dedup can make a happy-path control unreachable.

  Four existing `statehistory.test.ts` assertions read `expect(signals).toEqual([])` while being
  named "reports an out-of-range jump" and "reports a store nothing is tracking" — they encoded the
  defect, not the claim, and now assert `['failure']` and the raised code. Two other test harnesses
  build a fake node by binding the definition's methods onto a plain object, so `raiseRuntimeError`
  did not exist on them; both now record and assert it rather than stubbing it away.

- **2026-07-30 (NDA-007 — the icon source model, made real in the renderer)** — §1's union
  implemented; **§2 and §3 deliberately not attempted**, and the row above says so rather than
  reading as a finished task.

  **The reason "add a custom icon set" was hard is that the font assumption was written down six
  times.** `Icon`, `Button`, `Checkbox`, `RadioButton`, `Select` and `TextInput` each carried their
  own copy of the `codeAsClass ? … : …` splat — the same eight lines, differing only in which local
  `style` object they passed and, in `RadioButton`'s case, one extra class. So widening `Noodl.Icon`
  meant widening it in six places, and every future kind would have cost six more. It is one place
  now (`IconGlyph.tsx`). Class F's shape again, in a corner nobody had counted.

  **What made one renderer possible is the size/colour rule from §1**, and it is worth stating as a
  design result rather than a detail: the caller passes the style it *already built for the font
  case* — `fontSize` carrying `iconSize`, `color` carrying `iconColor` — and the SVG kinds inherit
  both by sizing at `1em` and filling with `currentColor`. So no caller needs a per-kind branch. Had
  the union required callers to know which kind they held, six copies would have become six copies
  of something bigger.

  **A revert that could not be written.** The discrimination pass covers the sanitiser and the class
  ordering and the `1em`/`currentColor` normalisation, but removing the sprite branch is rejected by
  the *compiler*: the discriminant is what narrows `Icon`, so deleting the narrowing makes `class`,
  `code` and `codeAsClass` stop existing. Recorded as a stronger guarantee than a red row, not
  waved through as untested.

  **A gap in my own rows, found by the revert pass and worth generalising.** I9–I14 called
  `sanitizeInlineIconSvg` directly, so deleting the renderer's *call* to it left all six green — a
  suite proving a sanitiser that nothing was wired to. I15 goes through the render path and reddens.
  Same failure mode as NDA-006's B4 and NDA-010's F2 stub: **testing the helper is not testing that
  anything calls the helper.**

  The scrub is regex-based on purpose — it runs under SSR and under `testEnvironment: node`, where
  there is no parser to borrow — so it is conservative by construction. One trap in writing it: the
  bare-value alternative in the `href` pattern has to exclude quote characters, or it matches a
  *quoted* fragment reference as an unquoted token starting at the `"` (which is not `#`, so the
  lookahead on the quoted branches never gets a say) and strips the one reference an inline set
  legitimately needs.

  ⚠️ **§2 (one registration path) and §3 (the picker) are the larger half and remain.** A `sprite`
  or `inline` value renders correctly, but nothing installs a set and the editor's icon picker
  (`iconpicker.jsx`, `IconType.ts`, `IconInput.tsx`) still assumes font semantics — so getting such
  a value onto the port today means script or hand-editing. The sanitiser also still runs at render
  time, because there is no registration for it to live in. Criterion 1 (end to end, deployed) is
  **not** met and criterion 4 (exactly one place registers a set) is not started.

  15 corpus rows, viewer jest **313**, typecheck clean.

- **2026-07-30 (NDA-011 — REST → HTTP)** — an assessment task that closed on the first reading,
  because the thing it was written to evaluate does not exist.

  **There is no resource DSL.** §1 asked what "the REST node's resource DSL" expresses and listed
  the things a DSL earns its keep with: multiple related endpoints declared once, shared auth and
  headers across a resource. **REST does neither.** One node is one `resource` string; there is no
  resource object and nothing is shared. What it actually has is a path template (`{name}`,
  substituted at `restnode.ts:415-421`) and two `new Function` scripts. So "invest in the DSL or
  replace it" was never the choice — and Richard's "cute little rest custom language" is, on
  inspection, a `String.replace` loop and two script ports.

  HTTP Request wins **every** declarative row of the comparison, several of them because REST has
  no declarative surface at all: query parameters, headers, body and auth are *script-only* on REST.
  REST wins exactly two rows, and they are the same capability twice — arbitrary JavaScript before
  the request and after the response.

  **That is why it is deprecated and not deleted.** §2's preference for deletion rests on REST being
  a true subset, and it is not; the scripts have no HTTP Request equivalent and no *mechanical*
  conversion. Deleting it would remove the one capability with nothing to convert it into, before
  anything exists to convert the graphs that use it. `deprecated: true` takes it out of the picker
  while existing graphs keep loading. Revisit once LIB-006's conversion report says what the scripts
  were really used for — if it is all extraction, deletion becomes correct.

  One templating difference worth keeping: **REST substitutes from the whole input bag**, so any
  input named `id` rewrites any `{id}` in the path whether that was intended or not. HTTP Request
  substitutes only from declared `path-*` ports.

  **§3 was already done, by NDA-003** — the six inline empty-value guards are one helper with one
  documented exception (JSON bodies, where `null` and omission genuinely differ). And
  `responseHeaders` is usable despite still being `object`-typed, because NDA-014 §2's
  `object → string` cast landed.

  **Criterion 3 was six nodes, not four, and the count was the least of it.** `button`, `checkbox`,
  `options`, `radiobutton`, `range` and `text-input` all sit in `nodes-deprecated/controls/`, are
  all registered, and none carried the flag — and `deprecated: true` is exactly what makes a node
  non-creatable (`componentmodel.ts:292-295`). The sting is the naming: the deprecated ones hold the
  **plain** names (`name: 'Button'`) while their modern replacements are `net.noodl.controls.*` with
  the same word supplied via `displayName`. The picker showed two entries reading "Button" and no
  way to tell them apart. All six marked. Only two editor *test* fixtures use these types, and the
  flag blocks creation rather than loading, so nothing that exists stops working.

  ⚠️ Two defects in `restnode.ts` read and **deliberately left** (both already recorded verbatim in
  the source from PLAT-003 §27.3): the `_xhr` handlers `delete` a property off the `XMLHttpRequest`
  rather than the node, so a later Cancel can abort a finished request; and the default Request
  script's help text is truncated by a `;` one line early. Fixing a node on its way out of the
  picker is work with no user.

  Runtime typecheck clean, viewer typecheck clean. ⚠️ Six runtime jest failures at the time of
  writing are in `signfileurl.test.ts` and `statehistory.test.ts` — the **other session's**
  uncommitted §2 item 7 batch (`statesnapshotnode.ts`, `undonode.ts`, `signfileurl.ts` all dirty),
  not this work. Catalog regeneration owed, as everywhere in this phase.

- **2026-07-30 (NDA-010 §3 — the popup stack policy)** — settled as the spec recommended, **one
  modal slot by default**, with `Show On Top` as a per-node opt-in. Done ahead of NDA-004 §2's ⏳
  item 3, which is sequenced behind this decision; that item is now unblocked.

  **Where the policy had to live, and why F2 pointed away from it.** NDA-001's F2 row asserted that
  two Show Popup nodes pulsed in one frame make a *single* `context.showPopup` call. They cannot.
  Neither node can see the other, so no guard either one carries would help — the only thing that
  can arbitrate is the `NodeContext` they share. The row could not have found that, because its
  proxy **stubs `context.showPopup`**, which is the function the fix belongs in. Generalisable:
  *a proxy that stubs a boundary cannot test a fix on the other side of it*, and a row written
  before anyone knew which side that was will point away from the fix rather than at it. F2 is
  reconciled and now pins the node's half — both nodes ask — with the outcome asserted against the
  real `showPopup` in `nda-010-stack-policy.test.ts`.

  **The slot is claimed synchronously, before the first `await`,** and that is the whole
  correctness argument. `showPopup` awaits `createNode`, so two calls in one update pass both run
  to that point before either resumes; a check made after `createNode` sees an empty stack in
  *both* and stacks them anyway. The revert that moves the `popupStack.push` three lines down
  reddens exactly the two same-frame rows and leaves the two-frame row green — the race, isolated.

  **A replaced popup gets `Dismissed`, not `Closed`.** `Closed` is where an author puts the
  save-or-commit work, and firing it for a popup that was superseded — often before it was ever
  drawn — runs that branch for an interaction that did not happen. Same shape as NDA-004's
  `Cancelled` on Open File Picker: a legitimate non-failure outcome that already had a signal it
  was being conflated with. A popup dismissed before its group reached the viewer also has its node
  deleted on the way out, or the component scope it built leaks.

  **A second defect on the same path, unrelated to stacking**: `Noodl.Navigation.showPopup` did
  `action.replace('closeAction-', '')`, and `action` is `undefined` for an ordinary close — only a
  *named* close action supplies one. So every scripted popup closed the normal way threw a
  TypeError out of the close handler instead of resolving its promise. The awaited API never
  returned. Guarded, and the dismissal path resolves too, or the caller waits for ever.

  **Migration (criterion 4).** Four library prefabs use Show Popup, one node each, so the default
  changes nothing for three of them. **Toast and loading-spinner opt into `Show On Top`** — they
  are overlays, not modals, and under the new default showing a spinner would have closed an open
  modal. That is the one case where "accidental stacking is the problem, deliberate stacking is
  rare" does not hold, and it is worth remembering that the rare case was sitting in the library.

  5 corpus rows, 5 reverts, each reddening only its own. Viewer jest **298**, runtime jest 1,105
  passing. ⚠️ Two failures in `nda-004-user-auth-error-channel.test.ts` are the **other session's
  uncommitted work**, not this: that file is untracked and `user.ts`/`setuserproperties.ts` are
  mid-edit. Catalog regeneration still owed — `stackPolicy` and `Dismissed` are live in the register
  but not in the generated JSON snapshot. Live QA owed.

- **2026-07-30 (NDA-006 slices 1+2 — Columns)** — run alongside NDA-004 in a second session, on
  disjoint files. Seven defects in one 180-line component, and the task's own headline defect was
  not among them.

  **The premise, falsified.** Slice 2 said Columns "filters `ForEachComponent` out of children and
  renders it separately, so Columns + Repeater produces unwrapped, unsized children", and offered
  three fixes in preference order. All three would have made it worse. A Repeater does not render
  its items: `internal.target.addChild(itemNode, index)` (`foreach.tsx:472`) adds them as
  **siblings** of the `ForEachComponent`, under the same visual parent. So the items were always in
  `props.children` and always got a `.column-item` box. The `ForEachComponent` renders `null` and
  must *not* get one — an empty box would consume a fraction slot and shift every real item's
  width. The exclusion the spec called the bug is the one correct line in the block. NDA-001's F3
  row is **reconciled** rather than satisfied, and now asserts the widths a Repeater's siblings get
  (slots 0 and 1 of `'1 2 1'`, not 1 and 2) — which is the half of F3 that was right.

  **What was actually wrong with Columns + Repeater** — three defects, two of which render nothing
  at all:

  - `renderChildren` returns a bare element, not an array, when a node has exactly one child. The
    single-child branch tested for `ForEachComponent` and then put it in **neither** bucket — it
    assigned `forEachComponent` only in the array branch. So a Repeater that was a Columns node's
    only child was dropped from the tree, never mounted, and with `repeaterDisabledWhenUnmounted`
    on never drained `mountedOperations`. **A Columns node containing nothing but a Repeater
    rendered nothing, permanently.**
  - `find`, not `filter`: the second Repeater in a Columns node was never rendered, same
    consequence one node along.
  - The wrapper was keyed by **position** while its child carries the stable `reactKey` every
    visual node renders with (`react-component-node.ts:1200`). Removing item 0 kept wrapper 0 and
    handed it a different child, whose key no longer matched — so React unmounted and remounted it,
    and the same cascaded down the list. **A Repeater deleting one row tore down every row after
    it**, losing focus, scroll, media playback and any transition in flight. `Group` keys children
    directly and has never had this, which is why "Columns is worse with a Repeater" was true
    without anyone finding a missing width.

  **Autofold was dead code on any authored project, and the input that turns it off is the one
  next to the input that gives it a purpose.** `marginX` and `minWidth` are declared
  `{ name: 'number', units: ['px'] }`, and that port shape writes `value.value + value.unit` —
  the *string* `'16px'`. `acc.min + parseFloat(minWidth) + marginX` is then string concatenation,
  and `number < string` coerces to `NaN`, which is false, so the fold never fired. It fired on a
  **default** project only because `columns.ts:29` seeds bare numbers and a definition's own
  `initialize` runs last (`react-component-node.ts:865`). Setting Horizontal Gap silently disabled
  the node's only responsive behaviour; Min Column Width sits in the same panel.

  Generalisable, and worth a grep beyond this node: **a units-typed port's value is a string in
  `props`, and only ever a number before the author touches it.** Any arithmetic on one that does
  not go through a `parseFloat` works in exactly the state nobody ships.

  Three more, all of the "renders `NaN`" family: `calcAutofold` popped the **caller's** array
  (`newLayout = layout`) and then compared a total taken *before* that pop against the array it had
  since shortened — two readings that were never independent; folding had no floor, so a container
  narrower than one minimum column folded to **zero**, making `fractionSize` `Infinity` and
  `columnAmount` `0`, and `layout[i % 0]` is `layout[NaN]` — every child `width: NaN%`; and a
  double space in the layout string (`'1  2'`) put one `NaN` in the fractions and did the same,
  with no warning, because the port's `layout-type-warning` only checks the value is a *string*.

  **`visibility: hidden` until measured is gone.** It painted blank on first render and, since a
  server render never gets a `ResizeObserver` callback, blank for the whole of SSR/SSG — which is
  why the catalog marks Columns `partial`. The authored layout is right at the width it was
  designed for, so it renders, and autofold reflows once measured. Deliberate flash, documented.

  11 new corpus rows in `nda-006-columns-layout.test.tsx`, **7 temporary reverts, each reddening
  only its own rows**. Viewer jest **239** (was 228), typecheck clean. ⚠️ **The key fix is not
  covered**: keys are not in markup and reconciliation needs a DOM, and this package has neither
  jsdom nor `react-test-renderer`. B4 pins the precondition and says so in the row rather than
  counting it. **Live QA owed**, and it is the fix that most needs it.

  **Slice 3 followed the same day.** Richard chose **both** surfaces, as the spec recommended:
  `Column Sizing` → `Auto Fit` covers most layouts with one input (as many equal columns as will
  hold `Min Column Width`, ignoring the layout string entirely), and `Medium Below` / `Small Below`
  layout strings cover the rest.

  **It keys off container width, not viewport width, and that decided the "project-level or
  per-node" question the spec left open.** Nothing in the editor or the styles system carries a
  breakpoint concept to extend — checked; every `breakpoint` hit in the codebase is AI
  prompt-caching — so this was inventing one either way. Columns already measures its own
  container, and keying off that means the same node behaves correctly inside a sidebar, a modal or
  a repeater cell, where viewport width says nothing useful. A project-level viewport set would have
  been the more conventional answer and the wrong one.

  Two named steps rather than an open list, deliberately: they are **static ports**, so they need no
  dynamic-port machinery and they are visible to the picker, the catalog and the AI authoring loop.
  A breakpoint set without a layout beside it is **inert rather than half-applied**, and a row pins
  that. Small is checked before medium — reversing them returns the tablet layout for a phone, and
  a row pins that too.

  19 corpus rows now, 11 reverts. Viewer jest **331**. **Slice 4 (masonry) is unblocked.**

- **2026-07-30 (NDA-004 §2 — Push Component To Stack and Navigate)** — ⏳ item 4, both nodes, `2f519c1d`.
  Two ✅, 14 corpus rows, viewer jest 228 (delta +14; the absolute count now also carries another
  session's untracked Columns rows).

  The prediction named **one** drop — "a target page that does not resolve" — and there were
  **five**, none of them in `navigate.ts`, the file the register cited. Both nodes call a handler
  which calls a collaborator which returns bare: three guards in `navigateAsync`, the *same three
  copied* into `replaceAsync`, and two in `router.tsx`.

  The reusable part is not the fix. **The transitioning guard is NDA-008 §3's own case, unfixed on
  the other side.** That task fixed exactly this on the Pop node and wrote that it was "the one
  authors actually hit, because a double-tapped back button used to lose its second tap without
  trace". The push side has the identical guard, three functions above the code that was edited, in
  the same file, in the same phase — because the fix was scoped by *node* rather than by the *shape*
  it had found. Generalised in FINDINGS B-viii: when a fix is scoped to a node, check whether the
  collaborator it corrected has other callers with the same need.

  Second: **`target` is an enum input, and a wire can feed an enum any string at all** — B-vi's
  States lesson turning up in an unrelated node a day later, which promotes it from an anecdote
  about `States` to a property of enum ports.

  New shape for the contract's "where does the report go" question: NDA-008 §3 settled *whose*
  failure this is (the node that asked, not the stack), but `back()` is synchronous and returns a
  result, while navigate/replace go through the stack's `asyncQueue` and outlive the caller's frame.
  A `hasFailed` callback beside the existing `hasNavigated` is that same decision expressed for an
  async call. Its optionality is load-bearing: `Noodl.Navigation.navigate` from a project's own
  JavaScript reaches both handlers and supplies neither callback, and raising on the stack would
  attribute a script's mistake to a node the author did not write.

  Deliberately not fixed: a Stack or Router *name* matching nothing is queued for a stack that may
  still mount, so at the instant of the call a typo and a not-yet-mounted stack are
  indistinguishable. Nothing honest to raise.

  Discrimination checked in three passes, and the middle one earned its keep: bare-returning
  `navigateAsync` alone reddens its five rows and leaves the replace row **green**, which is what
  pins that `replaceAsync`'s separate copy of the same three guards is independently held rather
  than incidentally covered.

- **2026-07-30 (NDA-004 §2 — Open File Picker)** — ⏳ item 2, one node, and the entry where a
  prediction was wrong in a way that *improved* the fix.

  The item read "has `success` and no counterpart; cancel and read-error are both real". Cancel is
  real. **It is not a failure**, and that distinction is the whole design. A user declining a dialog
  is a legitimate empty result, which the contract lists among the things that must not raise, so a
  `Failure` there would fire on a graph working exactly as written — the Object node's rule again,
  arrived at from the opposite direction. It gets a `Cancelled` *completion* signal instead, raising
  nothing, and a row asserts the error channel stays empty on that path. The gap it closes is real
  and total: with no `cancel` listener, "the user chose a file" and "the user changed their mind"
  were the same observable — `Success` in one case and, for ever, nothing in the other.

  **There is no read error.** The prediction assumed one; the node never reads the file. Recorded as
  absent rather than invented, which is the third time this phase a predicted failure mode turned out
  not to exist.

  **There was a third failure the prediction did not have**, and it is the one that lied: `change`
  can arrive with an empty `FileList`, and the node assigned `files[0]` unconditionally — discarding
  the file already picked — then fired `Success` with all five outputs reading `undefined`.

  **The correction worth more than the fix.** The first draft claimed an unguarded `click()` throw
  "propagates out of an input setter", the shape §3 found in `Response`. The discrimination check
  showed that row green with the `try`/`catch` removed: `nodecontext.ts:220-228` wraps every node's
  `update()` in a `catch` that only `console.error`s. So no exception from any input setter in this
  codebase is a crash — **"the node throws" is not by itself evidence of one.** The cost is still
  worth reporting (`Node.update` rethrows, so the rest of that node's pass is abandoned, and the sole
  diagnosis is an unstructured console line with no code or provenance), so the row was reshaped to
  pin the contract clause that actually differs — structured, not a string — and it discriminates.

  12 corpus rows, six reverts, each reddening only its own rows. Viewer jest **214** (was 202),
  typecheck clean, no runtime source touched. Limitation recorded: no `jest-environment-jsdom`
  exists here, so the rows stub `document` — the node's `initialize` calls `createElement` and cannot
  be constructed otherwise. Same call as the Video rows' stub media element, one step further out.

- **2026-07-30 (NDA-004 §2 — States)** — ⏳ item 5, one node, and the first entry in a while where
  the prediction was simply correct: `goToState` with a name that is not in the list. What the
  prediction could not say is which *class* of defect it is.

  It is the Expression class, not the silence class. An unknown name has no `value-<state>-<name>`
  parameters, so the transition timer's `onStart` fell through to `stateValues[prefix + v] || 0` and
  animated **every value to 0** — zero for numbers, black for colours. The node then wrote the bogus
  name to its `State` output and fired `stateChanged`, so everything downstream was told the
  transition had succeeded. `reached-<state>`, the one signal that would have looked wrong, never
  fired for the trivial reason that no such port exists for a state that does not exist. So the
  author's evidence was: the state machine moved, and all the values collapsed to zero.

  Two things worth carrying:

  **The fix has to refuse to move, not just report.** Transitioning to a state whose values do not
  exist *is* the mechanism of the damage, so a raise on its own would leave the zeroing in place. A
  corpus revert that reports-but-still-transitions reddens exactly the three rows about the node's
  observable state, which is what makes that distinction a tested decision rather than a preference.

  **The guard is narrower than "not in the list", and the control proves it.** It fires only for a
  **truthy** unknown name, because a falsy request is resolved to the first state one line above —
  that is the boot path, and `states`'s own setter depends on it. Reverting just the falsy resolution
  reddens exactly the "an empty State value raises nothing" control. That is the Object node's
  lesson applied as a test instead of an assumption.

  Reachability is unglamorous and total: `State` is an enum input, and a wire can feed an enum any
  string. A Text Input, a Record property, or a state renamed in the editor while something upstream
  still spells it the old way.

  10 corpus rows, four reverts, each reddening only its own rows. Viewer jest **202** (was 192),
  typecheck clean, no runtime source touched. One incidental harness note: `reached-<state>` is a
  runtime-discovered output that `onFinish` gates on `hasOutput`, so an unwired control reads as "the
  transition never completed" — the row wires a sink to it.

- **2026-07-30 (NDA-004 §2 — the Array mutators)** — ⏳ item 6, five of six nodes decided, and the
  interesting part is again not the code.

  **The trigger question resolved cleanly and the framing was still wrong.** The register warned
  that the Array family poses the Object node's question — author `Do`, or value arriving? It does,
  and the answer separated the six neatly: the three *mutators* take a `Do` (✅), while `Array` (its
  `Id` is a value arriving) and `Create New Array` (builds its own collection) are 🔵 for the two
  reasons the Object family had already established. What "the same question" hid is that the three
  mutators had **three different wrong answers** to it: `Insert` warned the editor and returned
  behind an `if (this.context.editorConnection)`; `Remove` had two bare `return`s and told nobody,
  anywhere; and `Clear` had no guard at all and threw an uncaught `TypeError` out of a scheduled
  callback. Grouping nodes by the question is useful for *choosing* what to read and says nothing
  about what a read will find.

  **The `Model.get(undefined)` trap has a second instance, so it is a pattern now.**
  `setCollectionID` handed its id straight to `Collection.get`, whose `undefined` branch is the
  anonymous tier — a fresh, differently-named collection every call. A missing Array Id therefore
  bound the node to a throwaway rather than leaving it unbound: the `=== undefined` guard passed,
  the mutation landed, and the node reported **`Done`** for a write nothing in the graph could read.
  Same shape as batch 2's `Set Parent Component Object Properties`, different registry. Batch 2
  recommended grepping for other `Model.get(<maybe-undefined>)` sites; the recommendation should be
  widened to any create-on-read lookup fed by a value that can be absent.

  Fixed as **one mixin** (`collection-failure.ts`), not three copies, per B-iv. Two things that mixin
  had to get right: `nodedefinition.ts:266` reads `opts.methods || opts.prototypeExtensions`, so
  handing a `methods` bag to a node that declares `prototypeExtensions` **deletes** every method it
  had (two of the three consumers use the old name); and raise and clear must name the same `code`,
  because the editor subscriber keys by it.

  **Three premises fell, two of them mine, and all three came from the discrimination check rather
  than a failing test.** (1) `undefined` cannot reach an input setter over a connection —
  `Node.prototype.sendValue` drops it at the sender, so the first draft's wire-driven rows pinned
  nothing and stayed green with the fix removed. I had read `outputproperty.sendValue`, which does
  not filter; the filter is one layer up, in the method `flagOutputDirty` actually calls. (2) That
  forced the port's empty-value reading to change: the only sender that can pass `undefined` is a
  parameter reset, so `undefined` here means *an author cleared the field*, and honouring the
  contract's default "abstain" would leave the node writing to an array the author had just removed
  from it — a stale target instead of a throwaway one, no louder. Both empty values unbind, and the
  generalisation is worth keeping: **"undefined abstains" is a statement about ports a wire can
  feed; on a port only a parameter can empty, `undefined` is a deletion.** (3) `signalsFor` does not
  prove a port exists — deleting the `failure` output reddened *nothing* until three `hasOutput`
  rows were added, because the harness records the port name before delegating and
  `sendSignalOnOutput` on an unknown name only logs. The existing §2 corpus files share that gap.

  **A harness limit worth knowing before the next batch: no node↔node-model event is delivered in
  `noodl-viewer-react`'s jest at all.** `setNodeModel` registers its listeners *with a ref*, so they
  live in a `Map` that `emit` walks with `for…of`; this package compiles sibling sources at
  `target: "es5"` with no `downlevelIteration`, which becomes an index loop over `map.length` —
  `undefined`, so zero iterations, **silently**. Ref-less listeners on the same emitter work, which
  is why nothing had noticed. This extends the banked pre-ES2015 trap rather than restating it: that
  trap says the symptom is a loud `TS2802`, and here there is no error, because a cross-package
  source is transpiled with these options but never diagnosed. Rows needing a real parameter edit
  belong in the runtime half of the corpus.

  `Array Filter` is deliberately left ⏳ — it is the family's genuinely mixed case, reached from the
  `Filter`/`Refresh` signals *and* from the `enabled` setter and the collection-change callback, so
  a raise there fires on the boot path.

  23 corpus rows, six reverts run, each reddening only its own rows with every pinned control green.
  Viewer jest **192** (was 169), runtime jest 1,095 unchanged (no runtime source touched), viewer
  typecheck clean. Catalog regeneration still owed and still blocked by the dirty tree.

- **2026-07-30 (NDA-004 §2 — the Component Object family and Video)** — two entries on the ⏳ list,
  seven nodes read, and the triage's own predictions were wrong in both directions.

  **The Component Object family: predicted "the cheapest remaining ✅s", delivered 2 ✅ and 2 🔵 —
  one of them the worst class-B defect in the phase.** The prediction was that NDA-015 had given
  these nodes the *raise* and they only wanted ports. That described `Parent Component Object`
  exactly, and nothing else.

  `Set Parent Component Object Properties` was not mute. Its walk returned `undefined` when no
  ancestor owned a Component Object, and the shared base handed that to `Model.get` — whose
  `undefined` branch (`model.ts:205-212`) is the **anonymous tier**, minting a fresh unnamed record
  on every call. The node wrote every wired property into a throwaway and emitted **`Done`**. Every
  other defect in this phase made a working node look broken; this one made a broken node look like
  it worked. It also picked up BINDING-CONTRACT §(a)'s explicit target while the file was open,
  which closes **the last ⚠️ row in that document's table** for a non-deprecated node.

  The other two are 🔵 *on evidence*, and the pair is the phase's shape-versus-substance lesson at
  its sharpest: `Set Component Object Properties` and `Set Parent Component Object Properties` are
  the same file, parameterised, and they get opposite verdicts — the self variant's record is its
  own component's, which exists by definition. `canFailToResolve` is opt-in in the base for exactly
  that reason, so the self variant carries no vestigial `Failure` port. Two corpus rows pin the
  **absence** of those ports, because "finish the family off" is precisely what a later mechanical
  sweep would do.

  **Video: the prediction was right and incomplete.** `HTMLMediaElement.play()`'s rejected promise
  was dropped at all three call sites — the autoplay-policy failure the register named, and probably
  the most-hit single defect in the phase, since it fires on every autoplaying video in every
  deployed app. Reading the file found a second the category-level reasoning could not have: the
  `<video>` element's **`error` event had no listener at all**, so a 404 or undecodable source
  produced total silence. `Image` has had an `On Error` port all along.

  The constraint on that fix is the interesting half. `AbortError` — a `play()` superseded by the
  author's own `pause()` or a new `src` — rejects on a graph working exactly as written. Reporting
  it would fire `Failure` on the happy path. `SILENT_PLAY_REJECTIONS` is where that lives, and it
  was verified by emptying it and watching one row redden on its assertion while the rest stayed
  green.

  **24 corpus rows, all shown to discriminate**, in two files. Reverting the writer's failure branch
  reddens 5 and leaves both pinned controls green; reverting the reader's ports reddens exactly 2;
  the two Video reverts redden 5 and 1 respectively. Gates: viewer jest **169** (was 145), runtime
  jest 1,081 unchanged (no runtime source touched), viewer typecheck clean.

  **A banked trap was wrong and is corrected.** "The committed viewer bundles are stale —
  `packages/noodl-editor/src/external/*` and `packages/nodegx-backend/deploy/artifact/` embed old
  copies" — neither is committed. Both are **gitignored with zero tracked files**
  (`.gitignore:187`, `nodegx-backend/.gitignore:9`), and a live webpack watch had already rebuilt
  `external/` with this session's changes before the tests ran. The real risk is the opposite of the
  one recorded: they are build output that is only stale when nothing is watching, not stale
  artefacts frozen in git. Anything grading them is testing *whatever was last built*, which is
  worth knowing before trusting or distrusting it.

  **Expression (⏳ item 1) — ✅, and the finding is the fallback value.** Both failure modes
  returned `0`. That is worse than silence, because `0` is *plausible*: `Is False` fires, `Is True`
  does not, and every downstream branch takes exactly the path a legitimate zero would send it
  down. The compile path was also misreporting itself — `_compileFunction` returned `undefined`,
  `_calculateExpression` called `.apply` on it, and the resulting `TypeError` was the only
  diagnosis that ever reached a deployed runtime; the author's actual syntax error lived in
  `evalCompileWarnings`, which is `sendWarning` and therefore editor-only.

  Generalised: **when auditing a silent failure, ask what value it falls back to.** A fallback
  indistinguishable from a legitimate result is strictly worse than an obviously wrong one, and the
  register's `Fail?` column cannot see the difference.

  The port is safe here for the exact reason it was not on the Object node, and inverted:
  `registerInputIfNeeded` seeds every discovered input to `0`, not `undefined`, so the node never
  passes through a "values have not arrived yet" state. A corpus row pins the seeding, because the
  safety of the port depends on it. 8 rows, discriminating (silencing the report reddens 4, all
  three pinned controls stay green). Runtime jest **1,089** (was 1,081).

  **`dbmodelcrudbase.setError` moved to the bus — and "one helper" was 22.** The standing note
  scoped this as a single helper. It is **22 separate `setError` definitions across 22 files**,
  each with its own copy of the same `sendWarning` call, reached from ~80 call sites: 5 in Record
  CRUD, 11 in user/auth, 2 agent, 2 other, 2 deprecated. Same shape as F-i one layer down — a
  helper that looks shared, copied.

  This also means **the class-B count understates the problem**: all 22 of those nodes *have*
  `failure`/`error` ports, so the register's `Fail?` column passes them, while every one still
  sends its *diagnosis* to a channel that does not exist outside the editor.

  `dbmodelcrudbase` is done — it raises `record/storage-op-failed`, and the editor keeps exactly
  what it had because the bus's subscriber forwards to `sendWarning` with the identical
  `{ showGlobally: true, message }` payload it used to build by hand. The other **21 are open and
  now enumerated in FINDINGS B-iv.** The trap that makes each one two changes: the bus's editor
  subscriber keys its warning by the raised **`code`**, so any `clearWarning` still naming the old
  hand-written key clears nothing and the node accumulates a warning it can never shed. 6 rows,
  discriminating — reverting to `sendWarning` reddens the 3 bus rows and leaves the 3
  "nothing regressed" rows green, which is the split that matters for criterion 3.

  One of those 6 rows also cost a wrong first attempt worth recording: "give it a class name and
  expect silence" is **not** a control, because with a class name the node gets past the guard
  under test and into the *next* `setError` — which is the first §2 batch's fix working. The
  fixture was too thin, not the code. It discriminates on the message instead.

  **Owed from this batch:** catalog regeneration (still blocked — the tree still carries another
  session's uncommitted node-source edits), now also for `Set Parent Component Object Properties`'
  `targetComponent`/`Failure`/`Error`, `Parent Component Object`'s `Failure`/`Error`, Video's
  `Playback Failure`/`Error`, and Expression's `Failure`/`Error`. Live QA of all four nodes in a
  running editor. The 21 remaining `setError` helpers.

- **2026-07-29 (live QA of three tasks, NDA-004 §3's last reachable mute node, and §2's first
  batch)** — the biggest un-run instrument was run, and it found nothing wrong; the code work that
  followed found something the spec's own framing would have got wrong.

  **Live QA — five claims, one editor launch, all pass.** A scratch project with a Repeater over a
  static array, a two-page Component Stack driven by real button clicks, and a popup whose Close
  Popup node sits one component deeper than the popup's top level.
  - **Class F, both directions.** The Object node with `Id Source = From repeater` *outside* a
    Repeater reads `healthy: false` with exactly the specced message; *inside* the template its card
    reads **`→ /Item`**, aggregated from the two live instances into one target. The sub-label
    replaces the type-name line, which is what `typeDisplayName()` documents.
  - **NDA-008 §2** — clicking the already-active tab: the text typed into that tab survived, and so
    did the input's per-instance class (`input-5d8a50d9-…` unchanged), which is what distinguishes
    "same instance" from "re-mounted and coincidentally restored". Depth 1 → 1, entries 1 → 1,
    `navigated` fired. **Control:** clicking the *other* tab still pushes, 1 → 2. So the no-op is
    specific to "already showing", not a blanket suppression.
  - **NDA-008 §1** — replace animates, and the *surface* is there: sampling per frame, the stack
    holds **2 children with both "TAB B" and "TAB A" in the DOM** for ~23 frames, then settles to 1.
    Worth knowing for the next session: `_internal.stack` collapses to one entry *immediately*, so a
    row watching `stack.length` sees nothing — the overlap is in `getChildren()`.
  - **NDA-008 §3** — all three codes confirmed: `stack-at-root` and `transition-in-progress` driven
    at the stack (`back()` returns the `StackBackResult`), and `no-stack-in-scope` end-to-end through
    the Pop node, which turned the node card red with the right message.
  - **NDA-010 §2** — the deep Close Popup closes the popup, and its card reads **`→ /Popup`**. That
    is the pull seam and clause (b) working together in the real app.

  **NDA-004 §3 — `Response`, the last mute node not blocked by another workstream.** It hid two
  different things behind having no outputs at all, and one of them was a crash: an unguarded
  `this._internal._sendResponseCallback(...)`, i.e. a `TypeError` thrown out of an input setter,
  for any Response node that was not part of the function component when the request arrived.
  The other was the *second* answer to a request, discarded silently in
  `noodl-viewer-cloud/src/index.ts`.
  - **`Sent` fires before delivery, and that ordering is forced, not chosen.** The callback tears
    the request down synchronously — `functionComponent._onNodeDeleted()` then
    `requestScope.reset()`, *before* resolving — so a completion signal sent afterwards reaches a
    graph that no longer exists. A `_requestIsOpen()` query was added beside the callback so the
    "already answered" case can be reported while the node still exists to report it.
  - 6 rows in a package whose jest runner exists but had only two suites; cloud suite **52** (was
    46). Shown to discriminate three ways: disabling the two guards reddens exactly the two guard
    rows; moving `Sent` after delivery reddens the ordering row and the fallback row.

  **NDA-004 §2 — first batch, "the Do that did nothing".** Five sites in the Object/Record family
  opened with `if (!internal.model) return;`. Four were the defect and **one was not**:
  - **Set Object Properties**: `Do` with no object wrote nothing, emitted nothing, said nothing.
    Now `Failure`/`Error` and `set-object-properties/no-object`.
  - **Set Record Properties**: the two branches of one enum disagreed. `Store Type = cloud` has
    always answered a missing Id with `setError('Missing Record Id')`; `local` returned silently.
    Same node, same author mistake, and whether they were told depended on a dropdown.
  - **Add / Remove Record Relation**: `validateInputs` opened with `if (!this.context
    .editorConnection) return;` — so **in a deployed app it validated nothing**, and the caller
    then hit two bare `return`s. It now returns the verdict and the caller fails through `setError`.
  - ⚠️ **The Object node looks identical and must stay silent.** `Model2.scheduleStore` has the same
    line, but the node has **no `Do`** — it is reached from `userInputSetter`, i.e. from any value
    arriving at a `prop-…` port. An Object node whose Id has not arrived yet hits that branch once
    per incoming value *on the ordinary boot path*; the values are deliberately retained and written
    when an object appears. Adding `Failure` there was built, tested, and **reverted** when the rows
    showed it firing on the happy path. The comment and a corpus row now hold that shut.
  - **The raise is `explicit`-mode only; the graph surface fires in both.** In `foreach` mode
    `foreachitem.ts` has already raised the precise reason, and a second vaguer event on one root
    cause is the "two wordings of one failure" the contract calls noise.
  - 6 corpus rows, verified discriminating: reverting the guard reddens 4 and leaves both pinned
    controls green.

  **Register:** an NDA-004 §2 triage of all 50, split into **read** (binding) and **reasoned**
  (provisional, a prediction about where to read next) — criterion 4 is *not* met and the section
  says so. 8 Verdict cells filled. Next-pass order is written down, highest-yield first; the two
  worth naming are **Video** (`HTMLMediaElement.play()` rejects under autoplay policy — a real,
  common, invisible failure) and the **Component Object family**, which NDA-015 gave *raising* but
  never gave `Failure` **ports**, so they are the cheapest remaining ✅s.

  Gates: runtime jest **1,081** (was 1,075), viewer jest **145**, cloud jest **52** (was 46), both
  typechecks green. ⚠️ One full runtime run failed once in `runtimeerror.test.ts:247` with the
  console subscriber throwing, and passed in the five full runs after it, plus in isolation and
  paired — recorded rather than dismissed; the shape (a `console.error` after teardown) suggests an
  async leak from a neighbouring file under parallel load, not a defect in the code changed here.

- **2026-07-29 (NDA-008 §2 — the Component Stack as a tab system; the task is now complete)** — the
  section asked for the behaviour to be *checked* before being assumed broken. It was, and it was
  broken in both modes, one of them worse than the brief said.
  - **Measured, not read.** Re-selecting the page already on top: `navigate` created a fresh
    component *and* pushed a duplicate stack entry (depth 1 → 2, children 1 → 2); `replace` created
    a fresh one and destroyed the old. So a tab click lost the tab's state either way, and push
    additionally grew a stack that Back then had to walk back through — the extra half the bullet
    did not predict.
  - **The no-op is params-aware, and that is the whole of its safety.** "Same component" alone
    would have broken the ordinary stack idiom: master → detail(id=1) → detail(id=2) is the same
    component three times and must keep pushing. Comparison is shallow and by identity — params are
    port values and may be arbitrary objects, so a deep compare would be expensive *and* wrong (two
    structurally equal Models are not interchangeable), and anything shallow-unequal falls through
    to today's exact behaviour.
  - **Replace needs one more condition than push.** Its post-condition is "one deep, showing the
    target", so a no-op is only correct when that is already true; on a deeper stack it still has
    collapsing to do. The tab case is depth 1 by construction and lands on the no-op.
  - **`hasNavigated` still fires on the no-op.** The request *was* satisfied. Swallowing the
    completion callback would have turned a re-selected tab into a dead button, which is the same
    silent-failure class §3 had just removed from the Pop node one commit earlier.
  - Harness note: `makeStack`'s fake stack entries carried only `pageInfo.label`. That was enough
    for the §1 rows and would have made every §2 row pass by never matching — they now carry the
    resolved `id`, as the real `_findPage` returns.
  - 5 rows, shown to discriminate: removing both guards reddens exactly the two no-op rows and
    leaves the different-params, deeper-stack and different-page controls green. Viewer jest **145**
    (was 140), viewer typecheck green.

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
