# Phase 30 — Progress

**Track O — Node Library Audit & Remediation**

**All 16 tasks specced as of 2026-07-29.** NDA-017 added 2026-07-30 from a community report — 17.

| Task | Tier | Status | Notes |
|---|---|---|---|
| NDA-001 Node behaviour corpus | 1 | ✅ **Done** `7a27e7c3` | 34 tests (16 `test.failing`, 18 pinned), wired into `pr.yml` `test-packages` — verified, not assumed. Two spec corrections: **E6 is a failing row** (`undefined` *overwrites* the key with the type default, worse than documented), and E8's propagation half already works — the defect is the `String` cast. F2/F3 are node-boundary/SSR proxies, documented in the corpus README |
| NDA-002 Reactivity contract | 1 | ✅ **Built** `bd6632ca`…`825da393` | R1–R9 green unmarked; all suites green. **`items === arr` does NOT break** — `Collection.get`/`create` return a memoised Proxy, so identity holds and the raw array is simply unreachable. Mutating methods intercepted in the `get` trap (traps alone storm 3–4 changes per `splice`). Perf: only indexed reads regress (~0.3 µs/read Proxy floor; digit-leading fast path recovers 28%). ⚠️ `packages/noodl-editor/src/external/*` + `nodegx-backend/deploy/artifact/` embed stale `collection.ts` copies until rebuilt. Live QA + QA-fixture cyclic-warning check pending |
| NDA-003 Empty-value contract | 1 | ✅ **Built** `e707f0cc`…`b2032129` | All E-rows green unmarked. Nullable Variables shipped with `Treat empty as` (String/Color: `null`/`''`; Number: `null`/`0`; Boolean: `null`/`false`); corpus E1/E8 expectations reconciled to the contract (`null`, not `''`). String `length` returns 0 on null store. httpnode normalised to one helper (both omit; JSON body keeps `null`-is-sent, documented). E5's null-clears-collection worked by accident — now explicit + tested. Enriched catalog needed the NDA-014 compatibility fix first (`61e8b3da`) |
| NDA-013 Repeater Refresh | 1 | ✅ **Done** `0e96c93a` | `refresh()` resyncs from `items`; queue race handled by truncating the ops `set()` just appended (synchronous span, nothing interleaves). Full teardown kept deliberately, documented. Refresh added to Array Map; Array Filter's premise was wrong — its `Filter` signal always re-read fresh, `refresh` added as alias. 3 new corpus rows red→green. Live QA pending |
| NDA-004 Failure contract | 2 | 🔄 §1 done, **§3 COMPLETE 10 of 10**, §2 criterion 4 met; **criterion 2 closed** `382894e4` | Channel at `packages/noodl-runtime/src/runtimeerror.ts`; `On App Error` node; F1/F1′ green. §3: only **Logic Builder** left, still blocked by another session's uncommitted rewrite — `Response` landed 2026-07-29 (it was hiding a `TypeError` out of an input setter *and* a silently-discarded second answer). §2 batch 1: Set Object Properties, Set Record Properties, Add/Remove Record Relation. §2 batch 2 (2026-07-30): **Set Parent Component Object Properties** (reported `Done` for a write into a throwaway record — worst class-B defect so far), **Parent Component Object**, **Video** (×2 failures), plus Component Object and Set Component Object Properties 🔵 on evidence. **Criterion 2 closed 2026-07-30** — and it found that the two legs believed covered were not: `if (this.editorConnection)` is *always* true (`NoodlRuntime` builds one in every runtime and its own comment says so), so `createConsoleErrorSubscriber` was unreachable outside its unit test and a deployed browser build, SSR and SSG produced **no console output at all** for a raised failure. It read as met because both contexts *did* deliver to an `On App Error` node — a surface the author has to opt into. A second defect underneath: the disconnected send queue grew for the life of the page. FINDINGS **H-ii/H-iii**. **§1's catch-all was not creatable** — found 2026-07-30 by regenerating the catalog: `On App Error` was registered, working, and measured working in a deployed build, but absent from `nodelibraryexport.ts`'s curated picker index, so the only way to get one was to hand-write `project.json` — which is what every fixture that measured it did. Criterion 2's own trap one level down. Fixed, 3 corpus rows, ports documented 8/8. **§3's premise widened 2026-07-30 by NDA-012's CustomCode pass**: the ten mute nodes were named individually, and naming them individually missed that they were instances of *"nodes that host user code"*. `Function` had `Success`/`Failure`/`Error` for code that **throws** and nothing at all for code that will not **compile** — the identical defect §2 fixed on `Expression` — and `Script` had no failure surface for either, plus a load path that could hang the node for ever with no report. Both compile paths fixed; `Script`'s **run** path is still editor-only and is filed. **§3's tenth node is unblocked as of `c5d5234f`, and the nine-handover blocker was a misdiagnosis.** Every handover since 2026-07-22 read `logic-builder.ts` as another session's rewrite *in progress*. It was not: `a2db2231` had landed the shared parser, the Blockly editor and both test files **from a different worktree** and left this one file behind in the primary checkout, so the commit titled *"port detection that both windows can reach"* shipped with one window reaching it and the new module imported by nothing that runs. Two tells were available throughout and neither was used — `git log` on the path, and a working-tree mtime (22:34) *earlier* than the commit (22:41). Landed after typecheck, both its suites, the editor suite and all three catalog gates; the only catalog delta is two `editorName: 'hidden'` removals, port sets identical. **§3 CLOSED 2026-07-30 by `Logic Builder`, the tenth and last mute node** — `Success`/`Failure` added, `Success` sent after every output the program wrote has been flagged. Its audit found the compile-failure silence for a **third** time, and running the grep that would have caught the class found a **fifth** host nobody had counted: **`REST` (Data)**, whose two script setters swallow the `SyntaxError` into a `console.log` *and* leave the previous script installed and fetching — the worst of the five, filed for the Data pass. **§3's reserved-name warning was right about the wrong node**: on `Function` the `'out-' + name` prefix made it a non-issue, and on `Logic Builder`, which registers block names verbatim, the collision was already live and silent against the node's *existing* ports before any signal was added. FINDINGS **SR-viii/SR-ix**. **Remaining: the deprecated-five policy question, which gained a fifth data point: `Index To String` is deprecated and its signal ordering is *correct*, unlike several nodes that are not** |
| NDA-005 Port documentation | 2 | 🔄 **§0 + the shared pass done 2026-07-30** | **The premise was half right and the wrong half was load-bearing: `description` was declared on both port types and copied nowhere.** `nodedefinition.ts` built metadata from `tooltip` and never read `description`; the catalog derived its own by *flattening* that tooltip. So the field this task tells an author to write was inert — and the three descriptions NDA-003 wrote on the Variables nodes, about the very contract that task established, reached no consumer. `tooltip` could never have served: it is a popup with a heading that restates the display name (hence the existing 142 reading like *"Clip content Controls if elements that are too big to fit will be clipped Enabled Disabled"*) and **it does not exist on output ports at all**, so half the library was undocumentable by any means. Plumbing fixed, flattened tooltip kept as fallback. House style at [`PORT-DESCRIPTION-STYLE.md`](../../reference/PORT-DESCRIPTION-STYLE.md) (criterion 3 ✅). **The concentration is greater than specced**: 133 port names = 1,861 instances = 70% of the library. 61 names documented in two files → **5.4% → 36.5%, now measured** (catalog regenerated 2026-07-30; the projected 41.2% was optimistic by ~3.5 points on its own denominator, reported as measured rather than reconciled away). Criterion 1 ✅. Criterion 2 needs the per-node tail: nodes at 0% fell 112 → **101**, of which exactly **1 is visual** — so the remainder is non-visual and per-node, which is NDA-012's pass. **The tail started 2026-07-30 inside NDA-012's Cloud Services pass: 148 ports over 21 node types, coverage 39.1% → 44.4% measured, nodes at 0% 83 → 62.** The whole category now reads 100% — with one caveat worth carrying, because it is a hole in the *instrument*: **`Config` reported 100% before this pass and still does, because it has no static ports at all** (`0/0`). Its three real ports are pushed from `setup`, and so are `User`'s three session signals, so a node can read fully documented while its most-used ports are invisible to the catalog, the validator and the AI loop. NDA-005 §0 fixed the plumbing for *declared* ports; `sendDynamicPorts` carries no `description` and nothing has asked it to. **§2 opened 2026-07-30 and scoped by measurement — and the measurement shrank it.** It was raised as "89 nodes, nobody owns this"; in fact **all 89 already carry a per-node `dynamicPorts` record with prose**, so dynamic ports are *not* invisible to the catalog, validator or AI loop. Three bounded gaps survive: 5 nodes report 100% on `0/0` ports (the register must say `n/a`, not 100%), **11** nodes sit on generic boilerplate prose rather than specific (only **3 in the picker** — `Config`, `Array Filter`, `Subscribe To Changes`), and `sendDynamicPorts` should carry `description` for the *fixed-name* dynamic ports. Kept in NDA-005 rather than made a new task because it is this task's own criteria 1 and 2 that the number misreports. **Navigation is the worked example**: it now reads 100% while `Navigate`'s `Target Page` — the input that says where to go — has no sentence anywhere. **Tail: Navigation's 46 ports, coverage 44.4% → 46.1% measured, nodes at 0% 62 → 54.** **Tail continued 2026-07-30 with NDA-012's small remainder: 150 ports over 27 node types, coverage 46.1% → 51.6% measured, nodes at 0% 54 → 31; then `Logic Builder`'s 6, coverage 51.6% → 51.8%, nodes at 0% 31 → 30.** Every one of the 26 nodes in that batch with static ports now reads 100%. **The pass also found the §2 gap is wider than §2 says**: `sendDynamicPorts` is one of *three* dynamic-port mechanisms with no documentation channel. `numberedInputs` writes no metadata entry at all (`nodedefinition.ts:100-131`), so `String Mapper` and `Index To String`'s real ports are invisible to the catalog, the validator and the AI loop; and the **Port Editor panel** mechanism is worse again — `Component Inputs` and `Component Outputs` define every component's public interface and are undocumentable by any means the library has. Six nodes now report 100% on `0/0` ports; the register should say `n/a`. FINDINGS **SR-ii** |
| NDA-006 Columns | 2 | 🔄 **Slices 1+2 done** | **Slice 2's premise was wrong**: a Repeater adds its items as *siblings* of its `ForEachComponent` (`foreach.tsx:472`), so they were always wrapped and sized — filtering the `ForEachComponent` out is *correct*, and F3's original expectation is reconciled, not satisfied. Seven real defects found instead, four of them worse: autofold was dead the moment an author set Horizontal Gap (a units port writes `'16px'`, and `number < string` is `NaN`); a Repeater that was a Columns node's **only** child was dropped from the tree entirely and never mounted; only the **first** of several Repeaters was rendered; wrappers were keyed by position, so a Repeater deleting one row remounted every row after it. Plus `calcAutofold` mutating its caller, folding to *zero* columns (`width: NaN%`), a double space in the layout string doing the same, and `visibility: hidden` painting blank through the whole of SSR. 11 corpus rows, 7 reverts, each reddening only its own. **Slice 3 done 2026-07-30** — Richard chose "both": `Column Sizing` → `Auto Fit` (one input, as many columns as hold their minimum) plus `Medium Below`/`Small Below` layout strings. **Container width, not viewport** — nothing in the editor or styles system has a breakpoint concept to extend (checked), and the node already measures its container, so the same node behaves correctly inside a sidebar or a repeater cell. Static ports, so no dynamic-port machinery and the AI loop sees them. 19 rows, 11 reverts. **Slice 4 (masonry) done** `b33b1b3e`. **Criterion 5's deployed leg run 2026-07-30** (`cc28a4be`): masonry itself is right in a real deploy (tops `0,0,0,40,90,60,160`, height 230), but the *first paint* was a **zero-width strip** — `width: calc(100% + (${marginX}px)` was one parenthesis short, which the CSSOM silently repairs on the client and a serialised `style` attribute does not, dropping `width` and `box-sizing` together. D7 stayed green throughout. See FINDINGS **H-i** |
| NDA-007 Icon sets | 2 | 🔄 **§1 done + renderer built** | Model at [`ICON-SOURCE-MODEL.md`](../../reference/ICON-SOURCE-MODEL.md) — tagged union (`font`/`sprite`/`inline`), sanitise-at-registration policy decided (no existing viewer policy existed to match; checked). **2026-07-30: the union is real in the renderer.** The font-triple splat existed in **six** components, each hard-wired to font semantics — widening the model meant widening it six times or once; now once, in `IconGlyph.tsx`. Criteria 2 and 3 met (font output byte-identical, `iconSize`/`iconColor` identical across kinds via `1em`+`currentColor`). 15 corpus rows. ⚠️ **§2 (registration) and §3 (picker) remain** — a sprite value renders but cannot yet be installed or selected, and the sanitiser runs at render time until §2 gives it a registration to live in. **§2+§3 done** `899ab676`; **criterion 1's deployed leg passed 2026-07-30** — `noodl_modules/` ships verbatim, the font stylesheet is injected, and the sprite `<use>` resolves over http with `getBBox()` 40×38; removing the asset gives `0×0` and no console error, so the witness discriminates |
| NDA-008 Component Stack | 2 | ✅ **Done — all four sections** | **The stack does not scroll** — zero `focus()` calls and zero px moved across navigate/replace/useRoutes, measured. The scroll is browser focus-scroll into the viewer's `overflow: hidden` app root (`viewer.jsx:344-353`), triggered by the library's only DOM focus, `TextInput` (`text-input.ts:211-214`). **Richard chose "Both" (2026-07-29): fix the box, keep the feature.** Applied as `overflow: clip` on the app root — `clip` creates no scroll container at all, where `hidden` creates one only the *browser* can scroll. `TextInput` keeps its plain `.focus()`, so a deliberate `Focus` still scrolls the nearest genuinely-scrollable ancestor. Measured live on the same element in one session: `hidden` 0 → **1762 px**, `clip` 0 → **0 px**. §1 done: replace animates through the same `Transitions` machinery, defaulting to `None` so no existing project starts moving; the `// Only push mode have transition` gate is gone. §3 done: `Popped`/`Failure`/`Error` and **three** codes, not two — the unbriefed one is `transition-in-progress`, i.e. a double-tapped back button used to lose its second tap. **§2 done 2026-07-29**: re-selecting the page already on top used to re-mount it in *both* modes, and push also pushed a duplicate entry (depth 1 → 2), so every click on the active tab lost its state and grew a stack Back had to walk back through. The no-op is **params-aware** — same component with different params is the master→detail idiom and must keep pushing — and replace additionally requires depth 1, since on a deeper stack it still has collapsing to do. `hasNavigated` still fires, or a re-selected tab would be a dead button. **NDA-008 is complete** |
| NDA-009 Run Tasks | 2 | ✅ **Done — all four sections** | **§2 + §3 done 2026-07-30.** The four port names are node inputs now (`Do`/`Success`/`Failure`/`Error` by default), resolved through one `TEMPLATE_CONTRACT` table that the runtime and the editor-time check both read. **They are static string ports, not the enums the spec asked for, and the reason is the spec's own criterion 4**: an enum populated from the template's ports has to arrive through `sendDynamicPorts`, which makes Run Tasks a dynamic-port node — and `nonexistentPort` then *skips* its connections instead of checking them. The "pick one that exists" affordance moved into the warning, which lists the template's actual ports and also covers what a dropdown could not: a port renamed on the template afterwards. §3 raises one `run-tasks/task-failed` per failing task with the item's index and record id, and attaches the template's `Error` output when it has one — because the completion signal is a bare signal and cannot carry a reason. That port is optional and never warned about. 16 rows (K1–K11, I8–I12), four isolated reverts. **Criterion 4 is demonstrable as of 2026-07-30** — the catalog was regenerated and carries all four ports, so `nonexistentPort` can check them; it had been built-but-unprovable for a day. **§4 done 2026-07-30**: `checkTemplateContract` writes the node-card sub-label, so a working node reads `/Task: Do → Success / Failure` on the canvas. §2 is what made it cheap — the three names were already resolved through one table. **Only on success**, which is `resolvedtarget.ts`'s rule applied unchanged (the warning channel already reports the broken case, and it is the same slot as clause (b), so the two cannot disagree on one card). Names shown even at their defaults, because the author who has not read the docs is the one who does not know a contract exists. 7 rows; L2 is what makes L1 mean anything and L7 pins that a broken template *clears* a sub-label it had. §1: the contract is checked when the template is *picked*, not when the run hangs — and when the template's own ports change, which is the half a selection-time check misses (the author is editing a component, not the node they are breaking). **The spec's "warn if any of the three is missing" is graded rather than followed**: reading `startTask`/`itemOutputSignalTriggered` says no `Do` means nothing starts, neither `Success` nor `Failure` means nothing can complete, and **one** of those two missing is a template that *works* — calling that breakage is this phase's own "a Failure port on a node that cannot fail" mistake one level up. 12 rows, split I (the check) / J (the `setup` wiring) because `graph-harness` never calls a module's `setup` and says so. Corpus F1 was already green via NDA-004 §1's runtime backstop; §1 is the earlier report. **§2 (selectable port names) and §3 remain** |
| NDA-010 Popups | 2 | 🔄 **§2 done** | Close Popup now *pulls*: `showPopup` publishes `_popupCloseHandler` on the popup instance and the node walks up to it, so it works from anywhere in the popup's tree — 7 corpus rows, shown to discriminate. Criterion 2 met. **⚠️ §1's premise is partly stale**: `showpopup.ts:129-177` already derives typed `popupParam-*` from the target's input ports and `closeResult-*`/`closeAction-*` from its Close Popup nodes. The real gaps are the hand-typed `results`/`closeActions` on the *Close Popup* side and untyped (`*`) results — re-scoped in the spec. **§3 done 2026-07-30** — one modal slot by default (`When A Popup Is Open` → `Replace It`), `Show On Top` as the opt-in. The policy lives in `NodeContext.showPopup`, not on the node, because two Show Popup nodes cannot see each other — which is why **F2's expectation was reconciled, not satisfied**. The slot is claimed *before* the first `await` or the race just moves. A replaced popup gets a new **`Dismissed`** signal rather than `Closed`, on NDA-004's Open-File-Picker reasoning. Also fixed: `Noodl.Navigation.showPopup` called `undefined.replace` on every ordinary close. Criterion 1 met; **§1 remains**, and this unblocks NDA-004 §2's ⏳ item 3 (Show Popup) |
| NDA-014 Type dead ends | 2 | 🔄 §1+§2 done | Decision at [`PORT-TYPE-CONTRACT.md`](../../reference/PORT-TYPE-CONTRACT.md) (A now, C direction). Table changed (`object`/`array`/`color` → `string`), JSON mirror added in `setInputValue`, catalog + register regenerated, runtime jest green (1,026), editor suite green (1,885 specs incl. validator/catalog-index). Outstanding: live editor check of the 13 `object` outputs |
| NDA-015 Explicit binding | 2 | ✅ **Done + live-verified**; class F tail closed | All three sections. Clause (b) ships as a node-card sub-label over a new `nodesublabel` message — **not** CAN-001/002, which are wire labels, and **not** `metadata.typeLabelOverride`, which is persisted. §3: the FIXME was load-bearing and its own comment described what `scheduleAfterUpdate` already does. **Class F tail closed 2026-07-29**: `_forEachModel`'s 5 sites now resolve through `runtime/src/foreachitem.ts` (FINDINGS F-ii), and the de-duplication this task claimed was **only 1 of 4 call sites** — the other three were still hand-rolled with divergent type lists, which had a *reader and a writer* of the same state landing on different components (FINDINGS F-i′). 34 corpus rows total |
| NDA-016 `Layout.size` | 2 | ✅ **Done** | **§0 resolved: the spec's premise was wrong.** `sizeMode` is never unset — a fresh Text node carries `contentHeight`/`100%`, read live. The real defect is a stale `parentLayout`: children bake the parent's layout in at *their* render, `renderChildren` memoises them, and the Layout setter never invalidated the memo — so a layout change never reached the children, and the first child ate the row. Fixed with `setLayout` as the single writer. §1 built too, on its own terms (an abstaining *connection* can still unset the port). 10 regression tests; 15-node-type live blast-radius check. Criterion 4's screenshot corpus is an instrument mismatch — see the spec |
| NDA-017 Signal input freshness | 2 | 🔄 **§0 done `d6db6f39`; §1 is Richard's** | Community report, **now reproduced** — 10 rows, 4 `test.failing`, including row 4 against the **Function** node, so the reporter's workaround is measured not to be one. The spec's mechanism survived §0 (unlike NDA-008/016). **One correction**: the seed also reaches the graph with *no* `Run` at all — with the signal connected the node never evaluates at boot, yet `connectInput` pushes a confident `0` downstream from `result`'s getter, so §1's option A as written closes three of four doors. Reusable: `update()` is synchronous and `settle()` yields, so a row written with `settle()` reports this whole defect class as absent. The confirmed mechanism: with `Run` connected the value setters go passive and `Run` evaluates whatever is in scope, so an async producer that hasn't landed leaves the previous cycle's value, and `On True`/`On False` pulse downstream while `Result` stays quiet. **Twelve node families**, not one. **§1 is now the blocker and it is a decision for Richard** (never-arrived detection vs. an upstream-pending notion in the runtime vs. making the completion-signal sequencing discoverable) |
| NDA-011 REST → HTTP | 3 | ✅ **Done — §1, §2 decided, §3 already met** | Assessment at [`NDA-011-CAPABILITY-COMPARISON.md`](./NDA-011-CAPABILITY-COMPARISON.md). **There is no resource DSL**: REST is one path template plus two `new Function` scripts, and does *neither* of the things the spec lists as what a DSL is good for. HTTP Request wins every declarative row; REST wins two, both "run some JavaScript". So it is **not** a clean subset → **deprecated, not deleted**, with the conversion path left to LIB-006. §3 needed no work (NDA-003 already made the six guards one helper; `responseHeaders` became usable via NDA-014's `object → string` cast). **Criterion 3 was six nodes, not four** — and they held the *plain* names their modern replacements show via `displayName`, so the picker offered two entries reading "Button" and the deprecated one was as likely to be picked |
| NDA-012 Per-node audit | 3 | 🔄 **15 of 17 categories, 80 of 155 nodes** | **Navigation added 2026-07-30 — all 8 nodes, 15 defects, 8 of 8 nodes affected, 1.88/node: the highest rate of any category and the reversal of the Cloud Services dip.** Headline is **NV-i**: `Page Inputs` had *no connectable ports at all* and had not since the initial commit — its whole `setup` was commented out, so the node that exists to expose a page's own parameters could be added from the picker and wired to nothing. CS-i one step on (there the node could not be added; here it does nothing). Also **NV-ii**, which corrects this file: reordering `Signal To Index` changes nothing observable, because the *visibility* of signal-before-value depends on whether the paired value port was non-`undefined` at connect time — so the class is two situations, not one, and "a test catches it" is not the test. **NV-iii** is a fourth cross-category shape (one-shot state that latches, in Close Popup and Pop Component Stack). **NV-v** is where the rest probably are: 6 of the 15 live in a module's `setup`, which `graph-harness` does not run. 6 fixed, 9 filed. Variables (4/4) as the worked example; **Logic, Math, Events, String Manipulation, Interpolation, Javascript and Sensors added 2026-07-30**, run batched with NDA-005's C1 so each node is read once. **31 new defects in 22 nodes and no find-rate decline.** Two shapes recurred *across* categories, which the per-node reads could not have shown: **signal-before-value** (`Receive Event`, `Signal To Index` — in both, carrying data with a signal is the node's whole purpose) and **a value port whose setter emits**, announcing a change at page load once authored (`Switch`'s `State`, `Counter`'s `Start Value`). Two nodes are clean and both for a recorded reason. **Cloud Services added 2026-07-30 — all 22 nodes, 25 new defects, the largest single-category haul in the phase**, and it corrected this file's own dismissal of two nodes as picker-exempt: **`Sign In With` and `Request Magic Link` cannot be added to a graph at all**, while four deprecated nodes in the same picker group can (FINDINGS **CS-i**). The other headline is **CS-ii**: `Aggregate Records` carried both defects NDA-004 §2 and PLAT-003 had already swept for, because it is the one Cloud Services node in `noodl-viewer-cloud` and both sweeps covered two packages. Fixed; everything else is a verdict. **The per-node rate dipped for the first time (1.41 → 1.14) and the cause is five sibling nodes, not exhaustion** — read the find-rate table before treating it as a stop signal. A **third** cross-category shape joined the two: a create-on-read lookup fed by a value that can be absent. **The small remainder added 2026-07-30 — Component Utilities, Utilities, CustomCode, Animation and Cloud, 27 of 28 nodes, 39 defects in 21 of them, 1.44 per node.** Two categories set records: **Animation 2.50** and **CustomCode 2.00**, both with every node affected. Headlines: **SR-v**, `Date To String`'s `Invalid Date` had never fired because `flagOutputDirty` on a signal output sends a *value* of `undefined` rather than a pulse — and PLAT-003 NOTES §25 had written the line down and correctly left it alone; **SR-iv**, `Script`'s External File mode had **no failure path at all**, so an unreachable URL left the node permanently and silently inert (`isWaitingForExternalFileToLoad` never cleared, `update()` skipping `Node.prototype.update` for ever) — the same class NDA-004 fixed on `Expression` and `Function` and never carried to the other two script hosts; **SR-vi**, a timer leak shared by all four Animation nodes, where the node that gets it right (`Delay`) is filed under a *different category* so no per-category read would compare them; and **SR-iii**, a seventh cross-category shape — structured names concatenated into flat port strings and decoded with `split('-')`, found independently in `Component Object` (fixed) and `States` (filed: the name is genuinely ambiguous and needs an encoding decision). **SR-i** is the counting lesson: Component Utilities scored **0.63**, the lowest in the phase, because four of its eight nodes had already been remediated twice — a low rate with a cause, not a low rate. **`Logic Builder` audited 2026-07-30 — CustomCode is 5/5 and the category's rate rose from 2.00 to 2.80**, because the one node nine handovers had deferred as blocked held **six** defects, more than any other node in it. Three findings reach outside it. **SR-viii**: the compile-failure silence was on *four* of **five** script hosts, not the four SR-iv claimed — running the grep SR-iv had described rhetorically turned up **`REST` in Data**, which swallows the `SyntaxError` and keeps fetching with the *previous* script; four passes found one defect four times, each citing the last, and a class named by its exemplars had silently inherited their category. **SR-ix**: the reserved-name collision NDA-004 §3 predicted as a cost of adding a completion signal was **already live** here, silently, against the node's existing `error` output and `run` input — check whether a stated cost is already being paid. **SR-x**: `__triggerSignal__` was assembled on every execution, documented in a comment, and never passed to the compiled function, so it read `undefined` inside every block program ever run. 5 fixed, 1 filed (a port cannot change kind on a live node; `deregisterInput` throws on a connected port). 🛑 **Data is ON HOLD as of 2026-07-31 — Richard is mid-sprint merging all backends into the same Data nodes, so auditing them now would produce findings and port descriptions against definitions about to be replaced. Visual (29) is the unblocked category and is next.** When the sprint lands, the audit's inputs must be **re-derived, not inherited** (regenerate the catalog; `rm audit/data.md` before regenerating worksheets, which never overwrite; re-measure before planning) and **the merge diff read as an audit input in its own right** — it is new code in the category most likely to carry fresh instances of the known classes. **Only Data and Visual (29) remain.** **Data was re-scoped 2026-07-31 to 42 nodes / 471 ports** — Richard dropped the four deprecated ones (`Collection`, `Model`, `REST2`, `Variable`; 46 ports, 8.9%, all at 0%). Settling it corrected the catalog's `inNodePicker`, which had been reporting five deprecated types as pickable because it mirrored the curated *listing* and not the picker's creatability filter — **measured live: index lists 126, picker offers 121, and the 5 dropped are exactly those types**. That also corrects **CS-i**: the four deprecated auth nodes it contrasts as addable are not. FINDINGS **DA-i**. See the find-rate table |

## Audit coverage

| | Count | |
|---|---|---|
| Nodes with a machine-derived smell row | 155 | ✅ `NODE-REGISTER.md` |
| Nodes with a pre-filled audit worksheet | 155 | ✅ `audit/`, 17 category files |
| Nodes whose implementation has been read | **80** | 8 named by Richard + 5 from his second list + Boolean/Color, then NDA-012's fifteen categories |
| Nodes fully audited against the 12 checks | **80** | 15 of 17 categories, **all complete**: Variables, Logic, Math, Events, String Manipulation, Interpolation, Javascript, Sensors, Cloud Services, Navigation, Component Utilities, Utilities, **CustomCode (5 of 5)**, Animation, Cloud. Remaining: **Visual (29)**, unblocked and next; **Data 🛑 HELD** pending Richard's backend-merge sprint (42 in scope of 46 — four deprecated dropped 2026-07-31 — but re-derive after the merge) |
| Systemic defect classes identified | 8 | A reactivity, B failure, C documentation, D string contracts, **E type dead ends**, **F implicit binding**, **G signal/value ordering** (G came from a community report, not from either pass), **H the deployed build nobody ran** |
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

6. 🛑 **NDA-012/NDA-005 Data is HELD** pending Richard's sprint merging all backends into the same
   Data nodes (told to the session 2026-07-31). **Visual is next instead.** The hold is about
   *sequencing*, not scope: a per-node audit and its C1 port descriptions are written against the
   ports a node has, and the merge is precisely what changes them. **On resume, re-derive rather
   than inherit** — regenerate the catalog, `rm audit/data.md` before regenerating worksheets (they
   never overwrite), re-measure ports/documented/0% before planning, and **read the merge diff as an
   audit input**: it will be the newest code in the category, and the phase's three recurring
   shapes (create-on-read lookups fed by an absent key, one-shot latching state, a `Failure` on a
   value-arrival path) are exactly what new backend plumbing tends to reintroduce.

5. **NDA-012/NDA-005 Data scope** — deprecated nodes are **out of scope** for the per-node audit and
   for C1 coverage. Decided by Richard 2026-07-31 ("drop them if they're deprecated"). Data is
   **42 nodes / 471 ports**. ✅ Decided. This is narrower than the standing deprecated-node *policy*
   question (§ open items), which is about what happens to those nodes in the product; this decides
   only what the audit spends time on. It also settles §1.3 of the previous handover, which had
   proposed dropping three of the four.

## Find rate (NDA-012 stop signal)

| Category | Nodes audited | Nodes with ≥1 defect | New defects |
|---|---|---|---|
| Variables | 4 / 4 | 4 | 3 |
| Logic | 7 / 7 | 6 | 5 |
| Math | 2 / 2 | 2 | 6 |
| Events | 2 / 2 | 2 | 4 |
| String Manipulation | 3 / 3 | 2 | 4 |
| Interpolation | 2 / 2 | 2 | 4 |
| Javascript | 1 / 1 | 1 | 4 |
| Sensors | 1 / 1 | 1 | 1 |
| Cloud Services | 22 / 22 | 17 | 25 |
| Navigation | 8 / 8 | **8** | 15 |
| Component Utilities | 8 / 8 | 3 | 5 |
| Utilities | 8 / 8 | 7 | 12 |
| CustomCode | **5 / 5** | **5** | **14** |
| Animation | 4 / 4 | **4** | **10** |
| Cloud | 3 / 3 | **3** | 4 |
| **15 of 17 categories** | **80 / 155** | **67** | **116** |

**CustomCode took the record at 2.80 per node once its fifth node was added, Animation is second at
2.50, and the running average is now 1.45 across 80 nodes.** Four categories have *every* node
carrying at least one defect — Animation, CustomCode, Cloud and Navigation.

⚠️ **CustomCode's rate went *up* when the last node was added, and that node was the one deferred as
blocked.** `Logic Builder` carried **six** defects, more than any other node in the category, while
the estimate that finally scheduled it was "~30 minutes". The ordering heuristic ranks categories by
expected yield and had no signal at all for the node nobody had read — which is the same reason the
82 unread rows are unaudited rather than clean.

**Component Utilities' 0.63 is the first low score in the phase with a stated cause rather than an
inferred one**, and the distinction is the whole point of this table. Four of its eight nodes had
already been remediated twice — NDA-015 put the entire binding contract in
`parentcomponentobject.ts`, and NDA-004 §2 batch 2 covered the two `Set …` nodes and both Component
Objects. `net.noodl.ParentComponentObject` came out clean on all twelve checks, the only node in the
phase to manage it. **A category the phase has already worked over finds less, which is what
"already worked over" means.** Cloud Services' 1.14 was sibling dilution; this one is prior work;
neither is exhaustion.

Counting note: the Animation figure counts each *shape* once, not each site — the timer leak has
four sites, the unguarded easing curve three, and two more have two each. The per-node worksheet
figures are correspondingly higher. See FINDINGS **SR-i**.

**There is still no evidence of a declining find rate anywhere in this protocol after 79 nodes**, and
the two categories left (Data 46, Visual 29) are the two the spec ranked highest-yield.

**The Navigation entry also carries the clearest evidence yet for *where* the remaining defects are:
six of its fifteen live in a module's `setup`**, the editor-time dynamic-port derivation that
`graph-harness` does not run. See FINDINGS **NV-v**.

**No decline in absolute terms — Cloud Services is the largest single-category haul in the phase —
but the per-node rate moved for the first time**, from ~1.41 over the first eight categories to
**1.14** over Cloud Services. That is worth reading carefully rather than as a stop signal, because
the cause is structural and is visible in the data: **five of the 22 nodes are clean, and all five
are the same twenty lines parameterised** (`Log In`, `Log Out`, `Request Password Reset`,
`Send Email Verification`, `Sign Up` — one `UserService` method each, over the methods that have no
HTML parsing, no missing-session branch and no cache). A category with sibling nodes dilutes the
per-node rate without saying anything about how much is left in the library. The stop rule is a
category producing **nothing new**, and this one produced 25.

⚠️ **The per-node verdicts in the Cloud Services worksheet add to 34, not 25.** Nine defects live in
a shared helper or the shared picker index and are counted once, per NDA-012's batching warning. This
table reports distinct defects; the per-node figure is a usage count.

Two nodes were clean in earlier categories for recorded reasons (`Inverter`, `Unique Id`).

**A fourth shape joined on 2026-07-30 — one-shot state that is not one-shot.** `Close Popup`'s close
action and `Pop Component Stack`'s back action are both written by their trigger and never cleared, so
the *second* use of the node reports the first one's outcome. It is not an ordering defect and it is
invisible to any test that exercises the node once — which is why the twelve checks missed it, since
none of them asks what happens the second time. FINDINGS **NV-iii**.

⚠️ **And the signal-before-value shape turned out to be two situations, not one.** Reordering
`Signal To Index` changes nothing observable, because whether the class is *visible* depends on
whether the paired value port held a non-`undefined` value at connection time (`connectInput` pushes
only then, `node.ts:452`, and the receiver's queue is per port). `Receive Event`'s payload reads
`undefined` until an event arrives, so its defect was live; `Signal To Index` initialises its index to
`0`, so its identical source order is masked. **A future sweep for this class cannot use "does a test
catch it" as the test.** FINDINGS **NV-ii**.

**Three shapes have now recurred across category boundaries**, up from two:

- **Signal before value** — `Receive Event`, `Signal To Index`, and now the deprecated
  `Query Collection`, which pulses `Modified` and *then* flags the counts the pulse is about. The
  node that replaced it deleted the signal rather than moving one line.
- **A value port whose setter emits** — `Switch`'s `State`, `Counter`'s `Start Value`.
- **A create-on-read lookup fed by a value that can be absent** — `Model.get(undefined)` /
  `Collection.get(undefined)`, and now `Record`'s `Id` input, where `typeof null === 'object'` routes
  a cleared value into `Model.create(null)` and binds the node to a throwaway record. The banked note
  predicted this one in as many words.

**Two defect shapes recurred across category boundaries**, which is the first structural result this
protocol has produced that the per-node reads could not:

- **Signal before value.** `Receive Event` (`eventreceiver.ts:106`) and `Signal To Index`
  (`signaltoindex.ts:64`) both announce and *then* update the values the announcement is about, so a
  node acting on the pulse reads the previous event's data. In both cases carrying data alongside a
  signal is the node's entire purpose. `Unique Id` and `On App Error` do it correctly and both were
  written under NDA-004's rule — the ordering rule exists, and these nodes predate it.
- **A value port whose setter emits.** `Switch`'s `State` and `Counter`'s `Start Value` both read as
  "where this starts" and both announce a change at page load once authored. The control that
  distinguishes them from a false alarm is that an *unset* port is silent, because a declared
  `default` does not run its setter at construction.

Three new defects in the *simplest* category in the library — `latestValue` initialising to `0`
regardless of type, `color` being a type dead end, and the String `length` getter that will throw the
moment NDA-003 makes `null` storable. Consistent with the second-pass calibration. Stop NDA-012 when
this table shows a category producing nothing new.

## Log

- **2026-08-01 (NDA-012 Data — the hold is lifted, and the first family cost the schema).** Phase 34
  landed, so Data is unblocked. The inputs were **re-derived rather than inherited**, exactly as the
  hold prescribed: `catalog:generate` (clean, 151 types), `audit/data.md` deleted and regenerated,
  every number re-measured before planning. **Two carried premises were stale and both are corrected
  here.**

  ⚠️ **The incoming handover named Data and Cloud Services as the two remaining categories. Cloud
  Services was audited on 2026-07-30** — 22/22 nodes, 25 defects, in this same file. The two
  remaining are **Data** and **Visual (29)**. The error is traceable: BCN-010-NOTES §12, written to
  unblock this work, says *"Phase 30 deliberately did not start `audit/data.md` (46 entries) or
  `audit/cloud-services.md` (22)"*, and it was written before phase 30's Cloud Services pass landed.
  A note written to hand work over goes stale exactly as fast as the work it describes.

  ⚠️ **Data is 41 nodes in the catalog and 37 in scope, not 46/42.** The five `noodl.byob.*` entries
  the old worksheet carried have been deleted by phase 34, so the 2026-07-31 figure of *42 nodes /
  471 ports* was stale the moment BCN-004 step 7 merged. Measured now: **37 in-scope nodes, 433
  ports, 55 documented (12.7%), 20 nodes at 0%.** The four deprecated nodes stay out of scope per
  Richard's decision and are all still at 0%, so the denominator moved and the numerator did not.

  **6 of the 37 audited — the five Record verbs and Filter Records — 4 defects in 4 of them.**
  Worksheet: [`audit/data.md`](./audit/data.md); findings **DA-ii…DA-v**.

  **The headline is DA-ii, and it corrupts the backend schema.** `Add`/`Remove Record Relation` send
  `targetCollection: Model.get(targetModelId)._class`, and `Model.get` **mints a record on read**, so
  an id arriving from a URL parameter or a text field — rather than from a query result — resolves to
  a record nothing has loaded, with `_class: undefined`. `validateInputs` checked the *id* and never
  the *record*. **Measured on the rig's real Parse Server**: the class-less Pointer is refused with
  `107 Could not add field` — so the node does report failure — **and the field is written into the
  class schema anyway as `Relation<undefined>`**, after which every correct write to that relation
  fails `111 schema mismatch`. The relation name is burned for the life of the class, **by the
  attempt that failed**. Both nodes fixed.

  This is the phase's third recurring shape with a twist worth carrying: **the value is not absent.**
  The id is present and valid; what is absent is the record behind it. Every earlier instance was
  "the key is missing", so a sweep for that shape would have walked straight past this one.

  **DA-iii is two ways an Access Control rule silently does nothing**, both in the shared `_getACL`
  and so shared by Create Record and Update Record. A rule whose `Target` was never opened fell
  through every branch and contributed **nothing** — while the node's own port builder twenty lines
  up already reads an unset target as `user`; "add a rule, untick Write" therefore produced an ACL
  identical to adding no rule at all, and the record was written with no access control. And a `user`
  rule that cannot resolve a user wrote the key `acl['undefined']`, locking the record to a principal
  that cannot exist — *and* making the object non-empty, so the "no rules, no ACL" path could not
  rescue it. Both fixed. ⚠️ **The reason neither had coverage is the more portable lesson**:
  `record-backend-routing.test.ts`, the suite that exists to drive these nodes, stubs
  `_getACL: () => undefined` in its instance factory. **A stub in a shared test factory is a coverage
  hole with no warning label, and it is invisible from the file that has the defect.**

  **DA-iv is a fix that reaches nobody, and says so.** `Delete Record`'s `shortDesc` carried Create
  Record's sentence — "Stores any amount of properties…" — on the node that deletes one. Fixed, and
  recorded as shadowed: `shortDesc` is **not** exported to the catalog (regenerating gave a
  byte-identical file) and its only consumer is `ContextBuilder.ts:228` as
  `enriched?.summary ?? node.shortDesc`, where this node's enrichment always wins. The field is
  rotting more widely — four Array siblings share one sentence describing the *noun* across four
  different verbs — which is NDA-005 §0's `description` finding again, in a second field.

  **DA-v is filed, not fixed**, and the reasoning is the point: Filter Records calls
  `Model.get(objectId)` on every `save` for its class, minting records it does not hold into a strong
  global registry. The guard wants `Model.exists` — but the same line is *also* the documented
  wrong-scope read, so fixing the leak alone leaves the node still not re-filtering. It wants both,
  with a scoped-store fixture that does not exist.

  ✅ **Every fix has a discrimination check and each was verified to have actually landed before its
  result was believed.** Five mutations, each reddening only its own rows: the unset-target default
  (D1 alone), the undefined-user guard (D1+D2 — recorded, because D1's row depends on both fixes),
  each relation check (D3, D4), the `shortDesc` (D5). Every mutation was `grep`ed in the patched file
  before the run, which is the failure mode the phase-34 handover warned about.

  **Also checked and recorded as clean** rather than left ambiguous: `acl-<id>-<field>` is safe from
  the `split('-')` class because proplist ids are 4-char base-36 (no hyphen); Filter Records' simpler
  `setup` is *not* missing pre-existing nodes, because `GraphModel.addComponent` emits `nodeAdded`
  for every node already in a component; `displayNodeName` and `displayName` cannot diverge.

  Gates: runtime jest **1,683 passing / 0 failures** (was 1,673; +10 is exactly the new rows), 90/91
  suites; runtime typecheck clean; `catalog:check`, `catalog:merge:check` and `cloud-library:check`
  all green at 151 types / 151 documented / 58 cloud types. **`cloud-library:check` is in the gate
  list now** — phase 34 found it had been red unnoticed.

  ⚠️ **The category is 6 of 37. Two families remain**: the Array/Object/Variable family (~14 nodes)
  and the agentic/streaming family (~16 AIX nodes — SSE, WebSocket, Global Store, Action Dispatcher,
  Stream Buffer and siblings), plus `Run Tasks`, already covered by NDA-009. **C1 port descriptions
  are owed for all six nodes audited so far** and are the reason the category still reads 12.7%.

- **2026-07-31 (Data HELD — Richard is merging the backends into these nodes).** Told to the session
  the same day the scope was settled: a sprint is in flight to **merge all backends into the same
  Data nodes**. The audit is held rather than descoped. **Visual (29) is now the next NDA-012 work**
  and is unblocked. The reasoning, so a later session does not relitigate it: NDA-012's twelve
  checks and NDA-005's C1 are both written **per port**, and merging the backend paths is precisely
  a change to which ports exist — so an audit run now would produce descriptions, verdicts and
  corpus rows against definitions about to be replaced, which is the most expensive wasted work
  available in this phase. **On resume, re-derive rather than inherit**: `catalog:generate`;
  **`rm audit/data.md` before regenerating worksheets**, because `worksheets.js` never overwrites
  and a stale file looks freshly generated; re-measure ports/documented/0% *before* planning, as the
  2026-07-30 entry did. And **read the merge diff as an audit input in its own right** — it will be
  the newest code in the category, and this phase's recurring shapes (a create-on-read lookup fed by
  a key that can be absent, now three registries deep; one-shot state that latches; a `Failure` on a
  path driven by a value arriving rather than an author `Do`) are the ones new backend plumbing
  reintroduces. The deprecated-node scope decision is unaffected and stays: if the merge deletes or
  supersedes those four, that is consistent with it. `REST` stays **filed, not fixed**. Handover
  updated at [`NEXT-SESSION.md`](./NEXT-SESSION.md) §1.0. The sprint is **Track — phase 34,
  `dev-docs/tasks/phase-34-one-backend-contract/`** (`BCN-001` adapter contract, `BCN-002` Parse-wire
  adapter), another session's work and uncommitted at the time of writing — read it, never commit it.

- **2026-07-31 (NDA-012 Data — scope settled, and the instrument that set it was wrong).** Richard
  asked whether the Data nodes were awaiting reprovisioning onto BYOB now that Parse is retired, and
  whether the pass could skip them. **They are not, and the premise needed one correction that
  reverses the conclusion**: WF-007 retired the Parse *dashboard* and *server*, not the Parse
  **wire**, which `nodegx-backend/src/server/parse-wire.ts` implements deliberately because
  `api/cloudstore.js` speaks it — so the Record family is the front door to the *built-in* backend
  and BYOB is a **parallel** path for external ones, not its replacement. Two handover corrections
  fell out: the "legacy Object/Variable/Collection" family is client-side state, not backend code,
  and the Record family is **split across two categories** (verbs in `Data`, `Record`/`Config`/
  `Cloud File`/`Sign File URL` in `Cloud Services`), so this pass documents the verbs and not the
  noun. Cloud Services needs nothing either way — it already reads 100%.
  **Decision (Richard): drop the deprecated nodes. Data is 42 nodes / 471 ports, not 46 / 517.**
  The four dropped are 46 ports, 8.9% of the category, **all at 0%** — the denominator moves, not
  the numerator. `REST`'s SR-viii compile-failure defect is **filed, not fixed**: it fires only for
  a project that already contains a REST node, which the 2026-07-30 fresh-start decision puts
  outside the design constraints.
  **The question could not be answered without correcting the catalog.** `inNodePicker` was
  reporting `true` for `REST2` and the four `net.noodl.user.*` password/verification nodes because
  it was derived from membership of `nodelibraryexport.ts`'s curated index — but the picker builds
  through `createnodeindex.ts`, which puts every listed name through `getCreateStatus`, and
  `componentmodel.ts:292-295` refuses anything deprecated. **Measured live against a real
  `ComponentModel`: the index lists 126, the picker offers 121, and the 5 dropped are exactly the
  five deprecated-but-listed types**, with five non-deprecated controls staying creatable. Fixed by
  ANDing with `!deprecated`; the regenerated catalog flips those five booleans and **strip that one
  field and it is byte-identical to HEAD**. All three catalog gates green; `audit/data.md`
  regenerated (it was unaudited *and* predated REST2's deprecation, so it carried no flag at all).
  **This corrects FINDINGS CS-i**, whose contrast — two nodes unreachable "while four deprecated
  ones can be added" — was an inference from a listing: those four are listed and then dropped, so
  they are equally unreachable. Net, **six auth nodes are unreachable by two different mechanisms**
  (`SignInWith`/`RequestMagicLink` creatable but unlisted; the four listed but not creatable), which
  leaves password reset and email verification with no picker presence at all while BAK-002 ships
  the server-side flows behind them. ⚠️ **The diagnosis was wrong twice first**, and the lesson is in
  FINDINGS **DA-i**: the initial mechanism (`|| !!metadata.module`) had a discrimination check that
  appeared to confirm it — **a discrimination check confirms a partition, not the cause you
  attribute it to.** Also: `scripts/node-audit/worksheets.js` stamps "not in picker" from this flag,
  so every worksheet the phase audits from was repeating it.

- **2026-07-30 (NDA-012 + NDA-005: `Logic Builder` — the blocked node was the worst node, and the
  grep nobody ran found a fifth).** One node, all twelve checks, batched with NDA-005's C1 — 6 port
  descriptions, **coverage 51.6% → 51.8% measured, nodes at 0% 31 → 30**. **6 defects in one node:
  more than any other node in CustomCode, and the category's rate rose from 2.00 to 2.80 when it was
  added.** It closes **NDA-012's CustomCode category (5 of 5)** and **NDA-004 §3 (10 of 10 — the
  mute ten are done)**. Worksheet: [`audit/customcode.md`](./audit/customcode.md); the three findings
  that reach outside the node are FINDINGS **SR-viii…SR-x**. 5 fixed, 1 filed.

  ⚠️ **The headline is a correction to this file, made by running a grep it had already claimed
  credit for.** SR-iv, written hours earlier in the same phase, named `Expression` and `Function`,
  said the class was "nodes that host user code", and put the count at four. `Logic Builder` turned
  out to have the same compile-failure silence for the **third** time — and then the query SR-viii
  was about to describe as *"it is a grep"* was actually run, and it returned a **fifth**:
  **`REST` (`REST2`), in Data**, where `restnode.ts:178-184` and `:194-201` each compile an author
  script inside an input setter and swallow the `SyntaxError` into a `console.log`. It is the worst
  of the five, because the assignment sits *inside* the `try`: a broken edit to the Request or
  Response script leaves **the previous script installed and fetching**, so the author watches a
  request they have already changed. Filed for the Data pass rather than fixed here. **Four passes
  found one defect four times, one node at a time, over two days, each citing the last.** Two rules
  banked: *when a fix's own message says "the identical defect X had already fixed on Y", that
  sentence is a query and nobody has run it*; and *a class named by its exemplars inherits their
  category* — "the script hosts" meant CustomCode to four consecutive passes while the fifth sat in
  Data the whole time.

  **The reserved-name collision NDA-004 §3 predicted was already live, and the prediction was about
  the wrong node.** §3 warned that a built-in completion signal on a node with author-declared ports
  "needs a reserved name that cannot collide". On `Function` that solved itself — author outputs are
  registered as `'out-' + name`. `Logic Builder` registers block-declared names **verbatim**, and so
  the collision was not a cost of adding `Success`/`Failure` at all: it had been live and silent
  against the node's existing ports. A block program running `set output "error"` had its value
  discarded by `registerOutputIfNeeded`'s early return and then flagged the *built-in* `error`
  output, whose getter returns the last execution error; a `Define input` named `run` was published
  as a **second** `run` port, so an author could wire a value into what is really the built-in
  signal. Six names are now reserved and a write to a reserved output raises
  `logic-builder/reserved-port-name`. ⚠️ **The read side is undetectable** — a program reading
  `Inputs["run"]` gets `undefined` and nothing can see that it did — and is recorded as such rather
  than papered over. **The rule: before accepting a stated cost of a change, check whether it is
  already being paid.**

  **A third fix is a field that was built on every call and never delivered.**
  `_createExecutionContext` assembled `__triggerSignal__` — comment: *"for conditional logic"* — and
  `_compileFunction`'s parameter list stopped one short of it, so it read `undefined` inside **every
  block program ever run** and a node with two signal inputs could not tell which had fired. Beside
  it sat a `this.sendSignalOnOutput` alias that could never have worked either, since a
  `new Function` body is sloppy-mode and called with no receiver. Both typechecked, both carried
  comments describing their purpose, and neither was reachable. **A well-commented field is not an
  exercised one; count the parameters at the call site against the ones at the declaration.**

  Also fixed: a bare-string `throw` reported the **empty string**, because `error.message` on a
  non-`Error` is `undefined` and the getter turns that into `''` — the node's only failure surface,
  blank, for a failure that did happen (`simplejavascript.ts:327` had already made this choice).
  Filed and not fixed: changing a block from `Define input` to `Define signal input` leaves the live
  port its old kind — the `_io()` memo is *not* at fault, it is invalidated correctly; the cause is
  `registerInputIfNeeded`'s early return on an existing port, and the repair needs
  `deregisterInput`, which throws on a connected port. Row **L12**, `test.failing`.

  ✅ **The discrimination check predicted its own failures and got them exactly.** Reverting the six
  guarded behaviours while keeping the port declarations (so the harness still wires) was predicted
  to redden **L1, L5, L6, L7, L8, L9, L11** and leave **L2, L3, L4, L10** green — and it did, with
  L12 still reproducing. **L2 is the load-bearing control**: a node with no blocks yet must stay
  silent, or the L1 fix would report "failure" on every unconfigured Logic Builder in every project.
  The signal rows go through a **real receiver** with `sink.update()` draining the queue, not the
  sender's own signal log — the `flagOutputDirty`-on-a-signal-port trap SR-v found on
  `Date To String` is exactly the thing a sender-side log cannot see.

  **Nine handovers called this file blocked and the audit took under an hour.** `git log --oneline --
  <path>` was available throughout and settles it in one command. The estimate that finally
  scheduled the work was "~30 minutes"; the node held six defects, the most in its category. The
  ordering heuristic ranks by expected yield and had no signal for the node nobody had read.

  Gates: runtime jest **1,243** (was 1,231, +12 rows), runtime typecheck clean, `catalog:check`,
  `catalog:merge:check` and `catalog:examples` all exit 0. The catalog delta was checked with the
  strong assertion rather than by eye — **strip the 6 descriptions and the 2 new outputs and the
  result is byte-identical to HEAD**.

- **2026-07-30 (NDA-012 + NDA-005: Navigation, and the node that was never usable).** All 8 nodes,
  all twelve checks, batched with NDA-005's C1 — **46 port descriptions, coverage 44.4% → 46.1%
  measured, nodes at 0% 62 → 54**. **15 defects in 8 nodes — every node in the category — and at
  1.88 per node the highest rate of any category so far.** The Cloud Services dip is reversed and its
  stated cause (sibling nodes diluting an average) is confirmed rather than replaced. Worksheet:
  [`audit/navigation.md`](./audit/navigation.md); the five findings that reach outside the category
  are FINDINGS **NV-i…NV-v**. 6 fixed, 9 filed.

  **The headline is a node that has never worked.** `Page Inputs` — whose whole purpose is giving a
  page access to its own path and query parameters — shipped with the entirety of its module `setup`
  commented out, and `git show b9c60b07` has it commented in this repository's **initial commit**.
  `sendDynamicPorts` was therefore never called for it, and every real output it has is a `pm-*`
  announced from there. The runtime half was intact throughout: the Router calls `_setPageParams`,
  `registerOutputIfNeeded` resolves `pm-*`. What was missing was the editor ever being *told* the
  ports exist — and a port the editor does not know about cannot be connected to. Meanwhile the node
  sits in the curated picker at `nodelibraryexport.ts:568`, so an author could add it, fill in both
  stringlists and find nothing to wire. **This is CS-i one step further along**: there the node could
  not be added, here it can be added and does nothing. Restored in TypeScript; 5 corpus rows, and
  detaching `setup` again reddens all five outright.

  ⚠️ **The `Signal To Index` fix corrected this file's own account of the signal-before-value class,
  and the correction is the more valuable half.** It was left standing last session precisely so it
  would get its own discrimination check rather than ride along on `Receive Event`'s. **The check
  then refused to discriminate** — restoring the original statement order leaves every row green.
  That is a real difference between the two nodes, not a weak row. A receiver's input queue is **per
  port** (`_inputValuesQueue` is `{ [portName]: value[] }`, drained via `Object.keys` at
  `node.ts:531,543`), so which of a pulse and its paired value lands first is decided by **which port
  name was inserted first**, not by the order the node sent them. That insertion happens at
  *connection* time, and only `if (outputValue !== undefined)` (`node.ts:452`). `Signal To Index`
  initialises its index to `0`, so `value` is queued at connect and drains ahead of `pulse` for the
  life of the node — masking the source order. `Receive Event`'s payload reads `undefined` until an
  event arrives, so its `pulse` key is created first and its defect was live. **Whether this class is
  visible depends on an accident of the node's `initialize`, not on its ordering.** The reorder was
  kept because it removes the dependence on the accident, and the corpus says so in as many words
  rather than claiming a repair it cannot demonstrate. Banked: **a future sweep for this class cannot
  use "does a test catch it" as the test.**

  **A fourth cross-category shape: one-shot state that is not one-shot.** `Close Popup`'s close
  action and `Pop Component Stack`'s back action are each written by their trigger and never cleared,
  so the *second* use of the node reports the first one's outcome — close a popup through `Save`,
  close it later through the plain `Close`, and the Show Popup node fires `Save` again, running the
  author's save branch for an interaction the user never made. Not an ordering defect: correct on
  first read, wrong on every read after. **Invisible to any test that exercises the node once**,
  which is why the twelve checks did not find it — none of them asks what happens the second time.
  Both fixed, both reverts discriminating.

  ⚠️ **Six of the fifteen defects live in a module's `setup`, which no ordinary corpus row can
  reach** — `graph-harness` does not call `setup` and says so in its own comment. Two of them are
  `showpopup.ts` dedupe guards sitting twenty lines from `navigate.ts:304,318`, which are the same
  two guards written correctly: one compared a bare action name against a prefixed `p.name` and so
  never matched, the other had no guard at all. Every node in this category derives its most
  important ports in `setup`. **A defect class that only exists in code no harness runs will keep
  being found one file at a time** — an argument for making the fake-graph-model harness NDA-009 and
  NDA-010 each built separately into a shared fixture. FINDINGS **NV-v**.

  **NDA-005 §2 was opened and scoped by measuring it, and the measurement shrank it.** It came in as
  "89 of 156 nodes have dynamic ports and nobody owns this". Measured: **all 89 already carry a
  per-node `dynamicPorts` record** — mechanisms, editor adapter, prose description — so dynamic ports
  are *not* invisible to the catalog, the validator or the AI loop. Three bounded gaps survive: 5
  nodes report 100% on `0/0` static ports (the register must say `n/a`, not 100%); **11** nodes sit
  on generic boilerplate prose where the other 78 have specific, and only **3 of the 11 are in the
  picker** (`Config`, `Array Filter`, `Subscribe To Changes`); and `sendDynamicPorts` should carry a
  `description` for the *fixed-name* dynamic ports. Kept as NDA-005 §2 rather than a new task,
  because it is this task's own criteria 1 and 2 that the number misreports. **Navigation is the
  worked example** — it now reads 100% documented while `Navigate`'s `Target Page`, the input that
  says where to navigate, has no sentence anywhere.

  Also filed rather than fixed, each with a citation in the worksheet: `RouterHandler` drops a
  navigation to an unknown router **silently and forever**, growing an unbounded queue as it goes
  (the H-iii shape); with exactly one router registered it **ignores the `Router` input entirely**;
  `Navigate To Path` writes a `null` parameter into the URL as the four characters `null` and
  interpolates query values **unencoded** (the third unencoded-URL instance this phase);
  `Push Component To Stack` looks the same Page Stack up twice with only one of the two lookups
  defaulting to `Main`, and types its `pm-*` params `'*'` where NDA-010 §1 fixed exactly that
  asymmetry for popups one file over (**NV-iv**); `External Link` opens a tab without
  `noopener,noreferrer` when `Open In New Tab` is delivered `undefined`, because two adjacent lines
  disagree about what abstaining means.

  ✅ **`Page Inputs` was live-verified in the running editor, and that mattered** — the corpus rows
  drive `setup` against a *fake* graph model, so they prove the derivation and not that the editor
  draws a connectable port. Opened the QA fixture, added a `Page Inputs` node through
  `nodeOperations.createNewNode`, set `pathParams: 'productId,tab'` and `queryParams: 'tab,sort'`, and
  the node's `dynamicports` came back as exactly three output ports in group `Parameters` —
  `pm-productId`, `pm-tab`, `pm-sort`, with `tab` appearing in **both** lists and producing **one**
  port, which is the dedupe confirmed on the real path. Then wired `pm-productId` into a Text node's
  `text`: the connection is in the model and the node card renders with the port and the wire
  attached. Before this change the card had no ports and that wire could not have been drawn.

  ⚠️ Not established, and deliberately not claimed either way: the property panel's stringlist editor
  showed the `Path Parameters` / `Query Parameters` group headers but no entries, after a parameter
  set **programmatically** rather than through the panel. That is as likely to be an artifact of
  bypassing the UI as a defect, the panel's stringlist editor is untouched by this change, and
  `Navigate To Path` has carried a `displayName` on the same port type since before it. Worth ten
  minutes with the `+` button next session before anyone treats it as a finding.

  Gates: runtime jest **1,218** (+20 net incl. the other session's files), viewer jest **367**,
  cloud jest **57**, editor jasmine **1,894 / 0 failures**, runtime + viewer-react + viewer-cloud
  typechecks clean. Catalog regenerated by substitution; **the strong assertion holds** — strip the
  three port fields this session touched and the result is byte-identical to HEAD apart from
  `PageInputs.parameterEncoding`, which flipped `known: false → true` *because* restoring its `setup`
  let the deriver observe the port generation. 46 ports gained a description; exactly one changed,
  `Signal To Index`'s `signalTriggered`, which had documented its own defect — the banked rule
  applied for the second time. Both catalog gates verified green against a clean logic-builder
  checkout (they read the working tree, so they are red in this tree by construction).

- **2026-07-30 (the two audit-driven fixes that needed no decision).** Both were written up with
  citations by earlier NDA-012 batches and neither had been started.

  **`Receive Event` announced before its payload landed.** `handleEvent` pulsed `Received` and *then*
  flagged the payload outputs, so a node acting on the signal read the previous event's data — or
  nothing at all on the first event. Carrying data alongside a signal is the node's entire purpose,
  so the ordering defeated the reason it exists. The fix is one statement's position, and what
  settles it is program order: both `flagOutputDirty` and `sendSignalOnOutput` push into the
  receiving node's input queue, so the values now queue ahead of the pulse. **The existing corpus row
  was inverted, not deleted** — it asserted the defect (`seen === [undefined]`) and is now the
  regression guard for the fix (`seen === [7]`); restoring the old order reddens it while the wiring
  control stays green. Its `Received` port description had to change too: it documented the defect
  in as many words ("but before the payload outputs have been updated"), which is what a description
  written during an audit will do. ⚠️ **`Signal To Index` still has the shape** and is deliberately
  left — a different worksheet, and it deserves its own discrimination check rather than riding
  along. Two instances made it a class; fixing one does not retire it.

  **`Number Remapper`'s default configuration was a constant.** Both input endpoints defaulted to
  `0`, which is `_calculateNewOutputValue`'s degenerate branch, so `Remapped Value` was
  `Output Minimum` for every input — the Expression-returns-`0` shape, a failure value
  indistinguishable from a legitimate answer, sitting in the state every freshly dropped node was
  in. **Reporting it would have been the wrong repair**: an unconfigured node is degenerate for the
  whole boot path, so a `Failure` here fires on a graph the author is still building — the banked
  "a Failure port that can fire on the happy path" rule. The fix is a default that is not a lie: an
  input maximum of 1, against the `Output Minimum`/`Output Maximum` defaults of 0..1, so a fresh
  node passes its input through rather than flatlining.

  ⚠️ **And the fix had to go in `initialize`, not on the port's `default`** — the banked fact
  ("a declared `default` does not run its setter at construction") decides where a default-value fix
  lives, not just how to write a control row. Reverting only `initialize` while leaving `default: 1`
  reddens the row, which confirms the banked fact from the other direction. The two are set together
  purely so the property panel and the running node agree.

  Gates: runtime jest **1,200** (+2), viewer 367, editor jasmine 1,894/0, typechecks clean, both
  catalog gates green. Catalog regenerated; the substituted blobs differ from HEAD in exactly three
  ports — `Event Receiver.eventReceived`'s description and `Number Remapper`'s two input-range ports.

- **2026-07-30 (NDA-012 + NDA-005: Cloud Services, and the dismissal that was written the same day
  as the finding it dismissed).** All 22 nodes, all twelve checks, run batched with NDA-005's C1 —
  **148 port descriptions, coverage 39.1% → 44.4% measured, nodes at 0% 83 → 62**. **25 new defects
  in 17 nodes**, the largest single-category haul in the phase. Worksheet:
  [`audit/cloud-services.md`](./audit/cloud-services.md); the three findings that reach outside the
  category are FINDINGS **CS-i…CS-v**.

  **The headline is a correction to `FINDINGS.md` itself.** Last session's `On App Error` entry
  found four non-deprecated types absent from the picker with one catalog query — a good query — and
  then explained three of them away in a sentence. Two of those three explanations were invented:
  there is no "sign-in flow" that creates `net.noodl.user.SignInWith` or
  `net.noodl.user.RequestMagicLink`, and one grep across the editor, the runtime and the viewer
  returns nothing outside the nodes' own definition files. So **two of the three nodes BAK-004
  shipped cannot be added to a graph**, while the same picker group offers four *deprecated* auth
  nodes — an author looking for passwordless sign-in finds the superseded password flow instead.
  Neither has a `docs` URL either. `Page`, the third, really is created by `RouterAdapter`. The
  lesson generalises the banked one about traps by one step: **a dismissal is a hypothesis too**, and
  checking this one cost a single grep.

  **One defect was fixed rather than filed, and the rule is about criteria rather than size.**
  `Aggregate Records` wrote its failure message to `_internal.err` against a getter reading
  `_internal.error` — the **third** live instance of a shape PLAT-003 fixed in `dbcollectionnode`
  (§23.4) and again in `dbcollectionnode2` (§27.3) — *and* raised nothing on the error channel, which
  is B-iv's condition that NDA-004 §2 reported closed for the family. Both sweeps covered
  `noodl-runtime` and `noodl-viewer-react`; this node is the only Cloud Services node in
  `noodl-viewer-cloud`. **A criterion met over two packages is not met over three.** Rows C1–C5 in
  [`nda-012-aggregate-records.test.ts`](../../../packages/noodl-viewer-cloud/tests/nda-012-aggregate-records.test.ts),
  each half reverted separately and reddening only its own row. The reusable half is that **C1
  asserts through the output's getter and never through `_internal`**: the defect *is* a
  writer/reader field mismatch, so an assertion on either field alone cannot see it.

  ⚠️ Getting that row to run at all needed `DOM` and `ES2021.WeakRef` libs in
  `packages/noodl-viewer-cloud/tsconfig.tests.json`. Before this, any test in that package that
  `require`d one of its own **node modules** died compiling `@noodl/runtime` with
  `TS2304: Cannot find name 'location'` — so the package could test its plain modules and not its
  nodes, which is a large part of *why* its one node was never swept. Worth checking the same way
  wherever a package's node coverage looks thin.

  **The sharpest new defect is deliberately left red.** `ConfigService.getConfig` deletes its
  in-flight-promise field *after* the `await`, so a rejection latches it: every later caller is
  handed the same rejected promise without reaching the transport, and `clearCache()` — the only
  recovery, and what the editor calls on a schema change — clears the *other* field. Under it, the
  `Config` node has no `Failure`, no `Error`, no raise and a `.then` with no `.catch`. A backend
  briefly down at page load leaves every Config node blank and silent for the life of the page.
  Three `test.failing` rows plus a control in
  [`nda-012-cloud-services-category.test.ts`](../../../packages/noodl-runtime/test/corpus/nda-012-cloud-services-category.test.ts);
  a candidate `try`/`finally` fix reddens all three and leaves the control green, so they are known
  to discriminate. Not fixed, because unlike the Aggregate case no signed-off criterion is false
  while it stands — NDA-012 produces verdicts.

  **Defect class D got its textbook case, twice in one file.** Parse's verify-email and
  reset-password endpoints answer with HTML, and `UserService` reads the outcome out of the page.
  The success test is `indexOf(…) !== -1`; the *second* test on both is a bare
  `if (response.indexOf('Invalid …'))`, which is truthy exactly when the phrase is **absent**. So
  `Verify Email` and `Reset Password` report "Invalid verification token" for a network failure and
  a rate limit alike, and Reset Password's unreachable branch says "Failed to verify email". Same
  bare-pattern class SUB-013 hit the same day in the catalog generator; two independent instances is
  enough to make it a grep. `verifyEmail` also interpolates username and token into a query string
  unencoded, forty lines above a method that encodes both of its interpolations.

  **And one node's `Do` is a black hole.** `UserService.setUserProperties` wraps its whole body in
  `if (_cu !== undefined)`, so `Set User Properties` triggered while signed out calls neither
  callback: no `Success`, no `Failure`, no `Error`, no console line, and it re-arms. Every sibling
  reports a missing session because the backend refuses the request; this one never gets that far.
  It is the Failure Contract as *sequencing* — a signal input whose terminating signal is
  conditional is, on that condition, a mute node.

  **The find rate dipped for the first time (1.41 → 1.14 per node) and it is not exhaustion.** Five
  of the 22 nodes are clean and all five are the same twenty lines parameterised over the one
  `UserService` method with no HTML parsing, no missing-session branch and no cache. A category with
  sibling nodes dilutes a per-node rate without saying anything about the library. The stop rule is a
  category producing *nothing new*; this one produced 25. A **third** cross-category shape also
  joined the two on record — a create-on-read lookup fed by a value that can be absent, here
  `Record`'s `Id` input, where `typeof null === 'object'` routes a cleared value into
  `Model.create(null)` and binds the node to a throwaway record whose generated id it then reports.
  The banked note predicted that one in as many words.

  ⚠️ **A coverage number can be 100% and mean nothing.** `Config` read 100% *before* this pass and
  still does: it has `0/0` static ports, because all three of its real ports are pushed from `setup`.
  `User`'s three session signals are the same. So a node can read fully documented while its
  most-used ports are invisible to the catalog, the validator and the AI loop. NDA-005 §0 fixed the
  plumbing for *declared* ports; `sendDynamicPorts` carries no `description` and nothing has asked it
  to. That is the next real question for NDA-005's criterion 2, and it is bigger than the tail.

  **And the audit's own tooling had the defect NDA-011 filed.** `register.js` preserved hand-written
  verdicts across regenerations keyed on the bare display name, *stripping* the ` _(deprecated)_`
  suffix — so a deprecated node and its replacement were one key. The library has **ten** such pairs,
  precisely because NDA-011 criterion 3 found the deprecated nodes holding the plain names their
  replacements show through `displayName`. Writing two different verdicts for the two Cloud Function
  nodes is what surfaced it: one was silently copied onto the other and the loser vanished on the
  next run. Keyed on the rendered cell now. One collision survives on purpose — `Delete Record`,
  where both nodes are live and neither is deprecated, which is the decision waiting on Richard;
  the comment says so rather than adding a column to work around a defect that has a proper fix
  pending. **A defect filed against the product had a second victim in the instrument measuring it.**

  Gates: runtime jest **1198** (+4), viewer jest 367 (unchanged), **cloud jest 57** (+5, and the
  package can now test its nodes), all three typechecks clean, `catalog:merge:check` green.

- **2026-07-30 (NDA-012 + NDA-005: seven categories, 18 nodes, and two shapes that cross category
  lines)** — runtime jest 1,172 → **1,181** (+9, two new corpus files), viewer **367** unchanged,
  both typechecks clean, both catalog gates green. Port documentation **36.5% → 39.1%**; nodes at 0%
  **101 → 83**; C1 closed outright for all seven categories.

  Run as NDA-005 §0 recommends — **one read per node, verdict and port sentences written together**,
  because opening the file is the expensive part and the sentence is nearly free once it is open. That
  batching is the whole reason 18 nodes fit in a session.

  **31 new defects in 22 audited nodes, and the rate has not declined across eight categories.** The
  two clean nodes are clean for reasons worth recording rather than by luck: `Inverter` is the only
  node in its category with a correct empty-value policy, and `Unique Id` was fixed by NDA-004 §3 last
  week.

  **The result that the per-node reads could not have produced is two defect shapes that cross
  category boundaries.** *Signal before value* — `Receive Event` and `Signal To Index` both announce
  and then update the data the announcement is about, and in both cases carrying data alongside a
  signal is the node's entire purpose. `Unique Id` and `On App Error` get it right and both were
  written under NDA-004 §3's rule, so this is a library that has the rule and predates it in places.
  *A value port whose setter emits* — `Switch`'s `State` and `Counter`'s `Start Value` both read as
  "where this starts" and both announce a change at page load once authored.

  **A row in the second corpus file looked green and pinned nothing, and the control passed too.**
  `setInputValue('amount', …)` on Event Sender is a no-op — `amount` is runtime-discovered and
  `registerInputIfNeeded` only runs when a *connection* targets it, so the call logs "node doesn't
  have input amount" and returns. The watcher saw `undefined` because nothing was ever sent, not
  because of the ordering under test; and the "delivers the event" control passed anyway, because
  `Received` fires regardless of payload. Fixed by wiring the payload over a wire and asserting the
  receiver **holds 7 by the end of the frame** while the node acting on the pulse saw `undefined` —
  which is what makes the row a measurement. Banked as a harness fact: **a dynamic port cannot be
  driven by `setInputValue`, and a control that does not depend on the payload cannot detect that.**

  Two findings are not defects and are the more useful half. **`Number Blend` is deprecated and is the
  healthier of the pair** — it does Color Blend's job over a type with no format ambiguity and no dead
  end, so deprecation does not track quality and whatever decides the deprecated dispositions should
  not assume it does. And **`Script Downloader` is the strongest argument yet in the deprecated-five
  question**: a node that does network I/O against author-supplied URLs and has no failure surface at
  all is a much easier case for "yes, it still needs one" than the others.

  Two more worth flagging for later work rather than fixing here: **the Events channel is a bare
  string on both sides and only the empty-name case is caught**, but the editor already walks every
  `Event Sender` to derive payload ports (`eventreceiver.ts:158-169`), so the wrong-name check is that
  same walk asking a different question. And **`Number Remapper` ships in a degenerate configuration** —
  `Input Minimum` and `Input Maximum` both default to `0`, equal endpoints take the
  `normalizedValue = 0` branch, and every freshly dropped node reports a constant with no warning.
  Same shape as Expression's plausible `0`.

- **2026-07-30 (catalog regeneration — thirteen sessions of debt, and the node nobody could add)** —
  runtime jest 1,169 → **1,172** (+3, one new corpus file), viewer **367** unchanged, editor jasmine
  unchanged. Port documentation **5.4% → 36.5% measured**.

  **The block was not real, and the check that established that is the reusable half.** Both
  `node-catalog*.json` had been dirty with another session's Logic Builder work for four handovers,
  and the standing instruction was to coordinate rather than overwrite. But their hunks were
  *derivable*: the two `editorName: "hidden"` removals come from `logic-builder.ts` (still dirty,
  and now carrying no `editorName` at all) and the whole enriched diff from the dirty
  `enrichment/logic-builder.json` + `examples/code-logic-builder-greeting.json`. So regeneration
  would **reproduce** their working tree, not clobber it — which is a testable claim, not a hope.
  Tested it: backed both files up twice (scratchpad *and* the git index, per the banked
  scratchpad-can-be-cleared trap), regenerated, and diffed. `Logic Builder` did not appear in the
  changed-node list at all, and its enriched entry and example are byte-identical to their dirty
  state. **A blocked-on-another-session file is worth one reversible experiment before it costs a
  fourteenth session** — the question is never "is it dirty" but "does regeneration reproduce it".

  **Staging was the part that needed care, and a diff filter was the wrong tool.** Their work had to
  stay out of the commit while staying in the working tree. Rather than hand-filter hunks in a 1.1 MB
  JSON, the staged blob was *constructed*: take the regenerated catalog, substitute `HEAD`'s
  `Logic Builder` node (and, in the enriched file, `HEAD`'s example) back in, and stage that with
  `git hash-object -w` + `git update-index --cacheinfo`. Byte-exactness is checkable up front —
  `json.dumps(…, indent=2, ensure_ascii=False)` round-trips both files identically to what
  `JSON.stringify(…, null, 2)` writes — so the substitution provably changes nothing else.

  **Two criteria stopped being merely built.** NDA-009 criterion 4: `RunTasks`'s four contract ports
  (`taskStartInput`/`taskSuccessOutput`/`taskFailureOutput`/`taskErrorOutput`) are in the catalog, so
  `nonexistentPort` can check them. NDA-005 criterion 1: **996 → 1,004 of 2,747 ports = 36.5%**, up
  from 5.4%.

  ⚠️ **The projected 41.2% was optimistic and the measured number is 36.5%** — reported as measured,
  not reconciled away. Part is denominator drift (the style doc's 2,654 ports are 2,747 now, four
  tasks having added ports since), but 1,004/2,654 is still only 37.8%, so the projection over-counted
  by ~3.5 points on its own terms. Nodes at 0% fell 106 → **101**, of which exactly **1 is visual**.

  **Regeneration turned `catalog:merge:check` red, and that was a latent CI failure rather than a new
  one.** `pr.yml:138` runs it with `--require-coverage`, and the `On App Error` node NDA-004 §1 added
  had no enrichment entry — invisible until the node reached the catalog. Written
  (`docs/node-catalog/enrichment/on-app-error.json`); **156/156 nodes documented**, both gates green.

  **And the regeneration found a defect that four months of NDA-004 work had not: `On App Error` was
  not in the node picker.** `inNodePicker` is derived from `nodelibraryexport.ts`'s `coreNodes`, which
  is a curated index rather than a projection of the register — so the contract's catch-all half was
  registered, working, measured working in a deployed build, and **impossible for an author to add**.
  Every measurement that found it working found it in a script-written fixture. This is criterion 2's
  own trap one level down: there a criterion was met through *a surface the author has to opt into*;
  here the surface could not be opted into at all. One query over the regenerated catalog lists the
  four non-deprecated types with `inNodePicker: false` — the other three (`Page`, the two
  `net.noodl.user.*`) are legitimately created through other flows. Fixed, three corpus rows, revert
  reddens one and leaves both controls green. The control is doing real work: `toContain` over ~130
  names passes for almost anything, so a second row pins a registered type that is *deliberately*
  absent. FINDINGS has it in full.

  Also documented `On App Error`'s eight ports while the file was open (NDA-005 tail, 8/8), which is
  the batching NDA-005 §0 recommends and NDA-012 will run at scale.

- **2026-07-30 (NDA-005 §0 + the shared pass — the field nothing read)** — runtime jest 1,164 →
  **1,169**, viewer 362 → **367**, editor jasmine unchanged, all typechecks clean. Projected port
  documentation **5.4% → 41.2%**.

  **The task says "write a `description` for every port". `description` was declared on both port
  types and copied nowhere.** `nodedefinition.ts` built its metadata from `tooltip` and never looked
  at `description`; `build-catalog.js` then derived the catalog's own `description` by flattening
  that tooltip. So the field an author would naturally reach for was inert, and **the three
  descriptions NDA-003 had already written — on the Variables nodes, about the very contract that
  task established — reached no consumer at all.** Writing 2,508 more would have produced 2,508 more
  of the same. This is the phase's declared-but-inert shape again (UIX-010's `IconSize`,
  PLAT-005's `_variant`), and the fourteenth stale spec premise.

  **`tooltip` could not have stood in for it, on two independent grounds.** It is the editor's hover
  popup, so it opens with a heading that restates the display name and may carry image captions —
  which is exactly why the library's 142 "documented" ports read like *"Clip content Controls if
  elements that are too big to fit will be clipped Enabled Disabled"*. And **`tooltip` does not
  exist on output ports at all**, so roughly half the library could not be documented by any means.
  The flattening is kept as a *fallback* rather than deleted, or those 142 would go to zero on the
  way to being improved.

  **The concentration is greater than the spec stated, and it is the whole lever.** 29 visual nodes
  carry **1,767 of 2,654** ports (67%), averaging 61 each; **133 distinct port names account for
  1,861 instances — 70% of the entire library**. 61 names documented across two files
  (`react-component-node.ts`'s universal base and `node-shared-port-definitions.ts`'s mixins) cover
  **952 port instances**.

  **Criterion 2 is barely moved by that, and saying so is the point.** Nodes at 0% went 112 → **106**,
  because the 126 non-visual nodes hold 887 ports of their own and share almost nothing. Visual nodes
  at 0% are down to **2 of 29**. So the tail is per-node, and it is exactly what NDA-012's category
  pass already opens each node to read — check C1 *is* this task.

  **M-rows exist because a visual port takes three routes into the compiled node** (`addInputs`,
  `addInputCss`, `addInputProps`) and `createNodeFromReactComponent` moves them across.
  It assigns rather than rebuilds, so the field survives — but this phase has already watched
  `IconType.openPicker` drop three fields of a union one line after they were produced, and a
  rebuild here would silently take 70% of the library's descriptions with it. M5 is the control that
  catches the realistic *bulk-pass* mistake rather than a plumbing one: two neighbouring margin ports
  both saying "left", which every per-port assertion passes.

  ⚠️ **Projected, not measured.** `scripts/node-audit/register.js` reads `node-catalog.json`, and
  regeneration is still blocked. Until it runs, none of these sentences is visible to the catalog,
  the semantic validator or the AI authoring loop — which are three of the four reasons the task
  exists.

- **2026-07-30 (NDA-009 §2 + §3 — the contract as configuration, and which task failed)** —
  **NDA-009 is complete** bar §4, which is a design question rather than a fix. Runtime jest
  1,148 → **1,164** (+16: K1–K11, I8–I12); viewer jest 362 unchanged; all three typechecks clean.

  **The spec asked for enum inputs and the right answer is string inputs, because of the spec's
  own criterion 4.** §2 said "three enum inputs populated from the template's actual ports". An
  enum whose options come from another component has to arrive through `sendDynamicPorts` — and
  that is what makes a node a *dynamic-port* node, at which point `nonexistentPort.ts:73` stops
  reporting bad ports on it and merely skips them. The change meant to let the validator check
  this contract would have stopped it checking any of Run Tasks' ports at all. Static ports are
  also what the *catalog* carries, which is what makes the feature reachable by the AI authoring
  loop — the same trade-off NDA-006 §3 made, for the same reason.

  So the affordance moved rather than being dropped: `checkTemplateContract` now lists the ports
  the template *does* have (`… it has "Done", "Broke"`). That covers a case a dropdown could not
  — the author who renamed the port on the **template** after the node was set up, who is never
  looking at the node they broke. **A dropdown is one way to answer "which names may I use", not
  the only one, and the cheaper one survived a constraint the spec did not know about.**

  **§3's "why" cannot come from the node, because the completion signal is a bare signal.** One
  `run-tasks/task-failed` is raised per failing task carrying `itemIndex` and `itemId` — the two
  things that let an author find the record again — and the message says `Task 3 of 50 failed`.
  For the reason, the node reads the template's `Error` output if it has one. **That fourth port
  is optional and never warned about**, on I3's reasoning one port further out: a task component
  that cannot explain its failures is a legitimate shape, and requiring the port would be this
  phase's own "a Failure port on a node that cannot fail" mistake again. I12 is the row that
  stops a later sweep "completing the set".

  **One correction to a thing that reads as a defect and is not.** `Model.create` consumes `id`
  as the *record id* and skips it when copying (`model.ts:230-238`), so an item whose only field
  is `id` produces an empty `data`. K7 asserted on `item` alone first and read as §3 losing the
  payload. `itemId` and `item` are two halves of one identity and the row now asserts both — the
  banked "a fixture being too thin looks exactly like the code being broken" shape, in the
  reporting channel this time.

  Also: the item index is captured when the queue is built, not looked up later, because
  `indexOf` collapses duplicate items onto one position — and fifty identical records is exactly
  the shape this node is for.

  **Four isolated reverts, each reddening only its own rows.** A (literal port names) → K1, K5;
  B (no per-task report) → K7–K10 with K11 green; C (honour an emptied field) → K4; D (never
  read the error output) → K9 with K10 green. I9's own first assertion was wrong rather than the
  code — it forbade `"Success"` anywhere in the message, where the affordance list correctly
  contains it; the diagnosis and the port list are two clauses and only the first is about what
  is wrong.

  ⚠️ **This adds four static input ports to Run Tasks and the catalog cannot be regenerated**
  (still blocked — see below). `taskStartInput`/`taskSuccessOutput`/`taskFailureOutput`/
  `taskErrorOutput` are invisible to `node-catalog.json`, `NODE-REGISTER.md` and the semantic
  validator until it runs, which means **criterion 4 is built but not yet demonstrable.**

- **2026-07-30 (the confirmatory deploy — the three fixes watched running)** — no runtime change;
  fixture + docs only. **All three witnesses pass.** FINDINGS **H-iv** has the table.

  This closes the one piece of live work the deployed-build workstream owed. Every defect in class H
  was measured live and every *fix* was pinned only by the corpus, so a second Deploy To Folder
  (same headless chunk-registry recipe, `runtimeType: 'ssr'`, then `npm run build:ssg && npm run
  ssg`) was run to watch the fixed state.

  - **Masonry first paint** (SSG `dist/index.html` with every `<script>` stripped): container
    **1280px**, all seven items **427px**, and `box-sizing` still present in the serialised `style`
    attribute. Under the defect the items were 0px.
  - **The console line, twice.** `[noodl] Expression (App): The expression could not be compiled:
    Unexpected token '*' [expression/compile-failed]` appears in the **SSG build's stdout** with the
    full structured payload (`nodeId`/`componentName`/`nodeType`/`code`/`message`/`detail`) *and* in
    the **deployed browser console** as a `console.error`. There was none in either before.
  - **The fixture has no `On App Error` node**, deliberately and now recorded in its README as
    load-bearing. That absence is the whole point: criterion 2 passed three reviews because the
    fixture it was checked against happened to contain one.

  **The reusable half is that the deploy output is itself a fixture you can edit.** The masonry
  witness was discriminated without rebuilding anything: substituting `width:calc(100% + 0px)` →
  `width:calc(100% + (0px)` in the served HTML and reloading collapses the masonry container to
  **0** and reproduces H-i's recorded 110px/28px on the breakpoint container. Any defect whose
  evidence is a *serialised attribute* can be discriminated this way, in seconds rather than a
  full deploy-and-build cycle.

  Small correction to H-i, written into FINDINGS in place: the recorded 110px shrink-to-fit
  container is the **breakpoint** Columns node, not masonry. Masonry goes to **0** — its children
  are absolutely positioned, so it has nothing to shrink to fit.

  Also re-confirmed on the hydrated page: masonry tops `0,0,0,40,90,60,160`, height **230**, which
  is what the corpus computes and the second independent measurement of it.

  ⚠️ **Catalog regeneration and `Logic Builder` are both still blocked** — checked at the top of this
  session: `packages/noodl-types/src/node-catalog.json`, `node-catalog-enriched.json` and
  `packages/noodl-runtime/src/nodes/std-library/logic-builder.ts` are all still dirty with the other
  session's work.

- **2026-07-30 (NDA-017 §0 — reproduced, and the spec's mechanism survived)** — `d6db6f39`,
  `47c80295`. Ten rows in
  [`nda-017-signal-input-freshness.test.ts`](../../../packages/noodl-runtime/test/corpus/nda-017-signal-input-freshness.test.ts),
  four `test.failing`. Runtime jest 1,148 / 0 failures; typecheck clean. **§1 is now the blocker and
  it is Richard's decision, not a coding task.**

  **This is the first §0 in the phase that did not falsify its own task.** NDA-008's, NDA-016's and
  NDA-010 §1's premises all fell; this one held — the `connected control signal ⇒ passive setters`
  idiom is exactly what the community reported, and every case the spec named reproduced. Worth
  recording as a data point *against* over-generalising the phase's own lesson: a spec premise is a
  hypothesis, and hypotheses are sometimes right. What changed is the cost of checking, not the
  verdict.

  **Row 4 is the one that changes the task's shape.** The reporter's stated workaround was to
  abandon Expression for Function, and Function re-publishes the previous cycle's answer under
  identical conditions. "Twelve families, not one node" is now measured rather than grepped, and the
  remedy §1 chooses has to be applied across the table or the next report reads the same.

  ⚠️ **The frame discipline decides whether this defect class is visible at all.** `graph.update()`
  is synchronous — dirty list plus after-update callbacks, no yield — while `settle()` awaits the
  macrotask queue between frames. A producer that lands its value from a `setTimeout` therefore
  cannot have landed across an `update()`, which is exactly the real timing being modelled: `Run` on
  one frame, the async answer some frames later. **A row written with `settle()` lets the producer
  win the race and reports the defect as absent.** Anything else in this class needs the same care.

  ⚠️ **The correction: the seed reaches the graph with no `Run` at all.** §0 predicted an early
  `Run`. With the signal connected the node **never evaluates at boot** — `signalsFor` is empty for
  the whole of it — yet a downstream node still receives a confident `0`, pushed by `connectInput`
  from `result`'s getter over the initial `cachedValue`. Same shape as row 1, different route, and
  **§1's option A as written cannot reach it** because no control signal is involved. Amended into
  the spec in place rather than left for the builder, since the whole point of §1 is that the remedy
  is chosen once for twelve families.

  **Discrimination, run against the mechanism rather than a fix**, because a §0 has no fix to
  revert. Dropping the `run` guard from Expression's two value setters reddens exactly the passivity
  control and the "never corrects it" characterisation and moves neither Function row; dropping it
  from `setScriptInputValue` reddens exactly the two Function rows and moves nothing in Expression.
  That establishes both that the guard is the mechanism and that the two nodes are independent
  measurements rather than one leaking into the other.

  Row 3 measured: two `Run` pulses with nothing changed upstream deliver **two** signal pulses and
  **one** value — observable only downstream. Left as a characterisation row rather than
  `test.failing`, because whether the two ports should agree is §1's call.

- **2026-07-30 (the deployed build, run at last — NDA-006 §5, NDA-007 §1, NDA-004 §2 criterion 2,
  and NDA-009 §1)** — `cc28a4be`, `382894e4`, `c598206e`. **Three defects, and the shape they share
  is the finding.** Runtime jest +19 rows from this workstream; viewer jest 359 → **362**; all
  typechecks clean.

  **Two criteria in this phase end with "…in a deployed build", and both had been deferred by more
  than one session.** One Deploy To Folder — driven headlessly from CDP, served over http, measured
  in a separate Chrome — settled both and found three defects no test in the repo could catch. The
  generalisation is in FINDINGS as **defect class H**, and it is worth more than any of the three:
  *a criterion whose last clause names a build nobody runs is a criterion that grades the build
  everybody runs.* The legs already signed off were signed off in the editor and the preview, which
  share a code path with each other and not with the artefact a user receives.

  **How to drive a deploy without clicking anything**, because this is the reusable half and it took
  a while to find. `deployToFolder` is not on any global and its module cannot be reached by Node's
  `require` (it is inside a webpack bundle), but in dev the chunk ids *are* the source paths, so
  `self.webpackChunknoodl_editor.push([['x'],{},r => …])` hands you `__webpack_require__` and from
  there `compilation.editor.ts` and `projectmodel.ts` come out by path. Driving the UI instead does
  not work: the folder picker is a native dialog CDP cannot answer. `runtimeType: 'ssr'` gives the
  layered SSR build; SSG is then `npm install && npm run build:ssg && npm run ssg` **inside the
  output folder**.

  **NDA-007 criterion 1 passes, and the witness discriminates.** `noodl_modules/` shipped verbatim
  (absent from `build/ignore.ts`'s defaults, as §2 predicted), the font set's stylesheet was
  injected as `/noodl_modules/qa-fontset/assets/qafont.css` and its rules are live in the page, and
  the sprite `<use href="noodl_modules/qa-sprites/assets/sprite.svg#qa-star">` resolved over http:
  `getBBox()` **40×38** inside a 48px box, filled `rgb(255,153,0)` from `currentColor`. Removing the
  asset and reloading gives `0×0`, the glyph box still exactly 48×48, and **nothing in the console**
  — the banked "an empty box the size you asked for" trap, observed rather than quoted.

  **NDA-006 criterion 5 passes for masonry and failed for everything around it.** The packed layout
  in a real deploy is exactly what the corpus computes — tops `0,0,0,40,90,60,160`, lefts
  `0/400/800`, container height **230**. But the *first paint*, which is what SSG output contains,
  was a zero-width strip: every masonry item 0px wide, container 110px. The cause is one missing
  parenthesis in `width: calc(100% + (${marginX}px)`, and **it survived because CSS repairs it on
  one path and is destroyed by it on the other** — the CSSOM parses a value in isolation and closes
  the unterminated block at end-of-input, while a serialised `style` attribute is a declaration
  list, where the unclosed block swallows the `;` and every declaration after it. `width` *and*
  `box-sizing` were both dropped. Which ones are lost depends on key order in the style object,
  which is why D11 asserts balance rather than the literal. **D7 stays green under the revert** —
  its markup assertions were satisfied by a page that painted nothing.

  And the comment three lines above the bug describes the bug: slice 1 removed `visibility: hidden`
  for "painting blank through the whole of SSR/SSG". It painted blank anyway. *A recorded fix for
  one cause of a symptom is what makes the symptom look accounted for.*

  **NDA-004 criterion 2: the two legs thought covered were not, for the same reason as the two that
  were owed.** Chasing cloud and export found that `if (this.editorConnection) … else console` is
  **always** the first branch: `NoodlRuntime` constructs an `EditorConnection` in every runtime and
  says so in a comment — "it won't connect and act as a no-op". So `createConsoleErrorSubscriber`
  was unreachable outside its own unit test, and the contract's headline clause ("every other
  runtime gets a structured console line so a failure is never fully silent") was true of the bus
  and false of every runtime that ships. Measured in the deployed browser build and the SSG build:
  `['editorWarningSubscriber']` and no console output in either.

  **Both contexts did deliver to an `On App Error` node, complete and structured — which is why the
  leg read as met.** Criterion 2 had been checked through the surface an author has to opt into. An
  app without that node reported nothing at all, anywhere.

  Underneath it, a second defect: `send`'s disconnected flush returned early **without clearing
  `sendTimer`**, so after the first flush in a deployed build every later `send` queued and nothing
  re-armed — `sendQueue` grew for the life of the page, driven by exactly the diagnostics that could
  never be delivered. *A "no-op when unused" claim written in a comment is a hypothesis like any
  other*; this one was half true, and the wrong half was load-bearing.

  **NDA-009 §1 built** (`c598206e`), and the spec's "warn if any of the three is missing" is graded
  rather than followed literally, because reading `startTask` and `itemOutputSignalTriggered` says
  the three ports are not equally fatal: no `Do` and nothing starts; neither `Success` nor `Failure`
  and nothing can complete; **one** of those two missing is a template that works. Reporting that as
  breakage would be this phase's own "a Failure port on a node that cannot fail" mistake one level
  up. It also re-checks when the *template's* ports change, which is the half a selection-time check
  misses and the more insidious one — the author is editing a component, not the node they are
  breaking. Listeners are never removed deliberately: `EventSender` has no `off`, only the ref-keyed
  path, and ref-registered listeners live in a `Map` that `emit` walks with `for…of` — the banked
  silent-transpile trap. A stale listener costs one redundant check that reaches the right answer.

  **`graph-harness` cannot test a node module's `setup`** — it never calls one, and says so in its
  own comment — so J1–J5 drive the real `setup` against a fake graph model. That split is the
  phase's "testing a helper is not testing that anything calls it", applied before it bit.

  ~~⚠️ **Owed: the fixed state has not been watched running.**~~ **Done 2026-07-30** — see the newest
  log entry and FINDINGS **H-iv**. What was measured live here is the *defect*, in all three cases;
  what pins the fixes is the corpus (D11–D13, G1–G3, H1–H4, I1–I7, J1–J5), each shown to
  discriminate under an isolated revert.

  ⚠️ **`VerifyFix4` now holds the live-QA fixture again**, not Hello World; the session scratchpad
  was cleared before it could be put back. It regenerates either way from `scripts/nda-live-qa/`.

- **2026-07-30 (NDA-017 added — defect class G, from the community)** — spec only, no code. A Noodl
  community report of the Expression node re-emitting its previous answer when `Run` fires before an
  async input has landed. Checked against the phase's existing findings first: **it is not covered**.
  Class A is "does a mutation notify?" and class B is "can a failure be reported?"; here the
  notification arrives and nothing fails — it arrives *after* the signal that consumed the value. The
  mechanism is confirmed from source (the `isInputConnected('run')` guard on every value setter) and
  **the reporter's workaround is not one**: the Function node has the identical idiom and is worse,
  since `runScript` is `async`. Twelve node families share it. Two smaller things fell out: the
  unchanged-output gate means a stale evaluation pulses `On True`/`On False` downstream while `Result`
  stays quiet, and NDA-004 B-iii's "no values-have-not-arrived window" reasoning is right about
  reporting and wrong about evaluation — the `0` seed is what makes the stale answer plausible. §0
  reproduction is blocking and §1 is a decision for Richard.

- **2026-07-30 (NDA-007 §2 + §3 — registration and the picker)** — `899ab676`. **NDA-007 is
  complete** bar criterion 1's deployed leg. 9 rows (editor jasmine 1,885 → **1,894**), live-verified
  end to end in the editor.

  **The spec's premise was wrong in the most useful direction, and its own "investigate first" is
  what found it.** §2 said "an icon set should be declared once and become available to both the
  editor picker and the viewer. Today there is no such declaration." There is, and it has been there
  for years: a module directory under `noodl_modules/` whose `manifest.json` carries
  `type: 'iconset'`. **LIB-003 already made `scanModuleManifests` the single scanner of that
  directory**, and both consumers already read it — the picker through `ProjectModel`, the preview
  and deploy HTML through `injectIntoHtml`. So criterion 4, *exactly one place registers a set*, was
  **nearly met before the task started**; what was missing is any way for a set to be something
  other than a font. The change is one manifest field (`iconSource`), one asset field (`sprite`) and
  one shaping layer beside `toInjectModules` — not a new mechanism, which is what the spec's own
  warning about "a parallel asset pipeline nobody maintains" was afraid of.

  **The asymmetry that made §2 small, and it is the design result worth keeping.** A **font** set is
  only renderable once a stylesheet and a font file are in the *document* — that is precisely why
  "add a custom icon set" meant fighting two asset pipelines, and it is what `browser.stylesheets`
  exists for. A **sprite** set is not: `{ kind: 'sprite', url, symbolId }` is self-describing, the
  URL is an ordinary project asset, and `noodl_modules/` ships verbatim in a deploy (checked: absent
  from `build/ignore.ts`'s defaults). **Nothing is injected anywhere for a sprite to render in the
  app — the value is the registration.** The hard half of this task only ever existed for fonts.

  **Two silent failures, one of them the reason §3 could have looked impossible.** An external
  `<use href="file:///…#id">` renders **nothing** from the editor document — it is a `file://` page
  and Chromium treats the reference as cross-origin — with no error in the console, so the picker
  would have been a grid of blank cells with no clue why. Serving the sheet from the preview's web
  server is a different origin again. The sheet is therefore inlined into the editor document with
  symbol ids namespaced by sheet URL, and `LoadIconSets` **awaits** that before calling back, because
  a `<use>` whose target is not in the document yet draws nothing and does not retry when it
  arrives. The app has no equivalent problem, which is the same asymmetry again.

  The second: **`IconType` narrowed every picked value** to `{ class, code, codeAsClass }`
  (`IconType.ts`, in `onIconSelected`). Even with a picker that could offer a sprite set, the three
  fields describing one were dropped one line later — by code that reads exactly like a copy. Worth
  generalising: *a rebuild-the-object line is a schema assertion*, and it silently outvotes whatever
  the union says.

  **Two sanitisers now, and it is not §1's six-copies mistake repeated.** The viewer's
  `sanitizeInlineIconSvg` is regex-based because it must run under SSR and `testEnvironment: node`,
  where there is no parser to borrow. The editor's `scrubSvgTree` is `DOMParser`-based because it has
  one, and because the editor document is the privileged one. Same policy, different capabilities —
  and `noodl-editor` **cannot** import the viewer's anyway: the viewer is a built artefact the editor
  loads, not a source dependency. The genuinely shared part (which kind a value is, and what value a
  glyph makes) is one module, `shared/utils/iconsets.ts`. The test for "is this a duplicate" is
  whether the two would have to change together; these would not.

  **A correction to `ICON-SOURCE-MODEL.md`'s own sanitisation policy**, written into it in place.
  The model said the scrub belongs at registration time and §2 would move it there. It cannot,
  because the two *installable* kinds — `font` and `sprite` — **store no markup at all**; a sprite
  set stores a URL. There is no stored form for a registration-time scrub to clean. Render time is
  the only boundary that exists until an `inline` *set* becomes installable.

  **`inline` sets stay declarable-but-not-installable**, deliberately. Previewing one means putting
  its markup into the editor's own document, a materially different trust question from putting it
  in the app's. An `inline` *value* reaching the node still renders (§1). Recorded with the reason
  rather than left as an unexplained gap.

  Also: one editor-side glyph renderer (`components/IconGlyphPreview.tsx`) now serves the picker cell
  and the property-panel thumbnail — **two more copies of the font splat**, on this side of the
  fence, which §1's count of six did not include. And a pre-existing manifest inconsistency left
  alone rather than widened: `sprite` is *module*-relative (like `main`, `dependencies`) while
  `browser.stylesheets` is *project*-relative.

  **Live QA, both kinds, one project.** A sprite set and a font set installed side by side: the
  picker lists both, draws the sprite previews (non-zero `getBBox()`, which is the only cheap witness
  that a `<use>` resolved — a blocked one is `0x0` with no error), stores
  `{kind:'sprite',url,symbolId}` for a sprite pick and exactly `{class,code,codeAsClass}` with **no
  `kind`** for a font pick, the thumbnail renders both, and the app renders both at 48px in the
  authored colour. The font set's stylesheet is injected into the app document by the pre-existing
  `injectIntoHtml`, from the same manifest the picker read. ⚠️ **Criterion 1's deployed build is
  still owed** — expected to work, not verified. ⚠️ Criterion 2's named instrument, the screenshot
  corpus, **cannot photograph this node**; a row pinning the exact font key set does the job the
  criterion wanted.

  **The suite went green having never run the new file, and the spec count was the only tell.** The
  editor's jasmine suite is a **barrel of explicit exports** (`tests/index.ts` →
  `tests/utils/index.ts`), so a new `*.test.ts` is invisible until it is added to it: 1,885 specs,
  0 failures, and 9 rows that had never executed. This is the banked spec-barrel trap re-hit, and
  the useful part is the detection rule — **a run that adds rows and does not move the total is a
  discovery failure, not a passing suite.** It is also the same shape as the phase's own lesson one
  layer further out: testing a helper is not testing that anything calls it, and *writing* a test is
  not registering it.

  Fixture and the measurement recipes are committed at `scripts/nda-live-qa/`.

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
