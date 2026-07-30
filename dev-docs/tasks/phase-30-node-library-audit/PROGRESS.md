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
| NDA-006 Columns | 2 | ⬜ Not started | Checked: `Columns.tsx` is the **only** file special-casing `ForEachComponent`. Slice 4 (Fable) is gated on slices 2–3 |
| NDA-007 Icon sets | 2 | 🔄 §1 done | Model at [`ICON-SOURCE-MODEL.md`](../../reference/ICON-SOURCE-MODEL.md) — tagged union (`font`/`sprite`/`inline`), sanitise-at-registration policy decided (no existing viewer policy existed to match; checked) |
| NDA-008 Component Stack | 2 | ✅ **Done — all four sections** | **The stack does not scroll** — zero `focus()` calls and zero px moved across navigate/replace/useRoutes, measured. The scroll is browser focus-scroll into the viewer's `overflow: hidden` app root (`viewer.jsx:344-353`), triggered by the library's only DOM focus, `TextInput` (`text-input.ts:211-214`). **Richard chose "Both" (2026-07-29): fix the box, keep the feature.** Applied as `overflow: clip` on the app root — `clip` creates no scroll container at all, where `hidden` creates one only the *browser* can scroll. `TextInput` keeps its plain `.focus()`, so a deliberate `Focus` still scrolls the nearest genuinely-scrollable ancestor. Measured live on the same element in one session: `hidden` 0 → **1762 px**, `clip` 0 → **0 px**. §1 done: replace animates through the same `Transitions` machinery, defaulting to `None` so no existing project starts moving; the `// Only push mode have transition` gate is gone. §3 done: `Popped`/`Failure`/`Error` and **three** codes, not two — the unbriefed one is `transition-in-progress`, i.e. a double-tapped back button used to lose its second tap. **§2 done 2026-07-29**: re-selecting the page already on top used to re-mount it in *both* modes, and push also pushed a duplicate entry (depth 1 → 2), so every click on the active tab lost its state and grew a stack Back had to walk back through. The no-op is **params-aware** — same component with different params is the master→detail idiom and must keep pushing — and replace additionally requires depth 1, since on a deeper stack it still has collapsing to do. `hasNavigated` still fires, or a re-selected tab would be a dead button. **NDA-008 is complete** |
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
