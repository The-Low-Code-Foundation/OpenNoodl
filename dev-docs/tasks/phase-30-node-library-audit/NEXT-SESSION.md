# Phase 30 — next session handover (written for Opus, 2026-07-29)

Work on branch `cline-dev`, commit directly to it, no task branches, no PRs. Use explicit pathspecs
on every commit — the tree **still** carries another session's uncommitted work (Blockly editor and
its four new untracked files, `logic-builder.ts` + untracked `logic-builder-io.ts` and its two test
files, icon assets, `scripts/generate-icons.js`, core-ui icons, and both `node-catalog*.json` files)
that must never ride along. End commit messages with the Claude co-author line.

## Where the phase stands

**Tier 1 is done and live-verified.** NDA-001 corpus (`7a27e7c3`), NDA-013 (`0e96c93a`), NDA-002
(`bd6632ca`…`825da393`), NDA-003 (`e707f0cc`…`b2032129`), NDA-014 (`61e8b3da`).

**Tier 2 is close.** Complete: NDA-008 (all four sections), NDA-015 + class F, NDA-016, NDA-010 §2,
NDA-014 §1–2. Since the last handover:

- **The live-QA backlog is cleared** — three tasks' worth of code had passed jest and never been
  watched running. Five claims, one editor launch, **all pass**. Details in `PROGRESS.md`; the two
  measurement techniques worth reusing are in "Driving the editor" below.
- **NDA-004 §3 is 9 of 10** (`d21154e1`). `Response` landed and was hiding a **crash**, not just
  silence. Only `Logic Builder` is left, still blocked.
- **NDA-004 §2 has its first batch** (`70d3e2ce`) and a **triage of all 50** in the register
  (`6bd442c0`).

Six normative docs in `dev-docs/reference/`: `REACTIVITY-CONTRACT.md`, `EMPTY-VALUE-CONTRACT.md`,
`FAILURE-CONTRACT.md`, `PORT-TYPE-CONTRACT.md`, `BINDING-CONTRACT.md`, `ICON-SOURCE-MODEL.md`.
**`BINDING-CONTRACT.md`'s two added sections are worth reading before you touch anything that
resolves a target without a wire**: "How to obey it" names the helpers, and "The two walks" is a
table you will otherwise get wrong.

Gates as of `6bd442c0`: **1,081 runtime jest, 145 viewer jest, 52 cloud jest, 1,885 editor jasmine
(0 failures)**. The editor suite was last run at `63f76b62` and nothing since has touched the editor.

## Rules that will bite you if skipped

**The corpus uses `test.failing`.** A red row is green in CI until fixed; the moment your fix makes a
row pass, `test.failing` FAILS loudly — unmark it in the same commit as the fix. Conventions in
`packages/noodl-runtime/test/corpus/README.md`; the viewer half (and the newer non-`test.failing`
contract rows) in `packages/noodl-viewer-react/tests/corpus/README.md`.

**Catalog regeneration folds in ANY uncommitted node-source edits.** After
`node scripts/node-catalog/generate.js` or `npm run catalog:merge`, stage only your hunks
(`git apply --cached` with a filtered diff). A typecast or port change has **five** consumers:
`nodelibraryexport.ts`, `node-catalog.json`, the register (`node scripts/node-audit/register.js`),
the validator/editor suite, and `docs/node-catalog/compatibility.json` (gates `catalog:merge`).

**Editing runtime types breaks the viewer typecheck until you rebuild declarations.** Run
`npm run build:types` in `packages/noodl-runtime`. A stale `dist-types/` reports the error against
`dist-types/src/internal.d.ts`, not the file you edited. `dist-types/` is gitignored; never commit it.

**Viewer ts-jest targets pre-ES2015.** `for…of` over a Map iterator in runtime source fails the
entire viewer suite with TS2802 — use `forEach` into an array.

**The committed viewer bundles are stale.** `packages/noodl-editor/src/external/*` and
`packages/nodegx-backend/deploy/artifact/` embed old copies. Anything grading those artefacts is
testing old code. The dev webpack watch does not dirty them.

**Three jest packages now, not two.** `noodl-runtime`, `noodl-viewer-react` and — since this session
used it — `noodl-viewer-cloud` (`packages/noodl-viewer-cloud`, 52 tests). Run `npx jest` from
*inside* each package; from the repo root it picks up the root babel config and dies on
`import { …, type X }`. Editor tests are jasmine-not-jest: `cd packages/noodl-editor && npm run
test:ci` (webpack + electron, ~6 min, run in background).

⚠️ **The runtime jest count is not reproducible from a clean checkout.** Jest picks up the other
session's uncommitted `logic-builder-*.test.ts` files, so "1,081" includes them. Trust the *delta*
you introduce, not the absolute number.

⚠️ **One flaky runtime failure is on record and unexplained.** A single full run failed at
`test/runtimeerror.test.ts:247` with the console subscriber throwing; it passed in five subsequent
full runs, in isolation, and paired with the new corpus file. Shape suggests `console.error` after
env teardown from a neighbouring file under parallel load. If you see it again, that is a second
data point worth chasing — do not assume it is the code you just wrote.

`FINDINGS.md` has the defect evidence with `file:line` citations. Trust it over the task specs where
they disagree — **twelve** spec claims have now fallen to implementation.

## Driving the editor — the corrections that cost time

Use the `run-editor` skill for the basics. Additions, newest first:

- **A state-survival check needs an identity witness, not just a value.**
  `net.noodl.controls.textinput` renders `class="… input-<nodeId>"`. The typed text surviving proves
  nothing on its own; the *class being unchanged* is what distinguishes "same instance" from
  "re-mounted and coincidentally restored".
- **Sample the right structure.** Component Stack's `_internal.stack` collapses to one entry the
  instant a replace starts — the outgoing pages are dropped from the DOM at transition end. A probe
  watching `stack.length` sees no overlap and reads as "it did not animate"; `getChildren().length`
  shows 1 → **2** → 1. Sample per `requestAnimationFrame` and dedupe by a composite key.
- **Switching the canvas to another component from CDP:**
  `ed.getActiveComponent().owner.components` is the project's component list and
  `ed.switchToComponent(comp)` moves the canvas — that is how you read a *different* component's
  `runtimeSubLabel`. `node.setParameter(name, value)` on a graph-model node edits live and the
  preview rebuilds, so a fixture mistake is fixable without a relaunch.
- **The launcher card selector is `[class*=__Card--]`.** `[class*=LauncherProjectCard]` matches the
  label `<span>` itself, so `closest()` returns the span and the click lands on nothing useful. Tag
  it (`el.setAttribute('data-qa','target')`) and click the attribute.
- `pkill` (SIGTERM) does not kill the dev Electron. Use
  `pkill -9 -f "OpenNoodl/node_modules/electron/dist"` and wait for the pid to go
  (`until ! pgrep -f … ; do sleep 1; done`). Never `pkill -f Electron`.
- Run every `npm run cdp` **from the repo root**. Bash cwd persists across calls, and a stray
  `cd packages/…` makes every later `cdp` call fail with `Missing script: "cdp"`.
- Getting a graph in front of the editor: back up and overwrite the `project.json` of a registered
  scratch project (`~/Library/Application Support/NodeGX/recently_opened_project.json` lists them;
  `VerifyFix4` is a throwaway and has been restored). Kill with `-9` before rewriting, or the
  shutdown save overwrites you. Restore and diff afterwards to prove it.
- Reaching canvas node views from CDP: `window.__nodeGraphEditor`. `ed.model.roots` is the graph
  model's roots; `ed.roots` the view roots (with `typeDisplayName()`, `nodeSize`). `ed.forEachNode`
  only walks *visual* roots, so a non-visual node is invisible to it — use `ed.roots` directly.
  `ed.model.roots.find(n => n.id === …).getHealth()` gives the warning text.
- Reaching runtime nodes in the preview: walk `el.__reactFiber$…` up `.return` until
  `memoizedProps.noodlNode`, then `node.nodeScope.getNodeWithId('<graph node id>')` reaches any
  sibling, including non-visual ones. Patch `sendSignalOnOutput` to count signals.
- `npm run cdp -- click` scrolls its target into view first, so it cannot measure scroll-on-click.
  Use `element.focus()` / `dispatchEvent` directly when the scroll position is the measurement.
- The phase-23 screenshot corpus photographs **editor chrome only**. It cannot see anything
  `noodl-viewer-react` renders, so it is the wrong acceptance test for any viewer/layout change.

**Fixture gotchas that read as broken code:** the Repeater's `templateType` enum is
`explicit`/`dynamic` — not `component`, and a wrong value renders zero rows, which looks exactly
like the binding under test being broken. `PageStackNavigate` is **Push Component To Stack** (the
Component Stack one, and what NDA-008 §2 is about); `RouterNavigate` is Navigate. Page Stack's pages
are a `pages` proplist of `{id,label}` plus a `pageComp-<id>` parameter each.

## The work, in order

### 1. NDA-004 §2 — the largest remaining block, and it is now a list

`NODE-REGISTER.md` has a **§2 triage of all 50**, split into **read** (binding) and **reasoned**
(provisional). Criterion 4 is *not* met and the section says so. Its ⏳ list is ordered by expected
yield; start at the top. The two worth naming here:

- **Video** — `HTMLMediaElement.play()` returns a *rejected promise* under browser autoplay policy.
  Real, common, and currently completely invisible. Likely the highest-value single ✅ left.
- **The Component Object family** (Component Object, Parent Component Object, Set Component Object
  Properties, Set Parent Component Object Properties) — NDA-015 gave these *raising* but never gave
  them `Failure` **ports**. The resolution and the message already exist, so these are the cheapest
  remaining ✅s.

**Before adding any `Failure`, check whether the trigger is an author `Do` or a value arriving.**
This is the lesson the first batch paid for: `Model2.scheduleStore` has the identical
`if (!internal.model) return;` as the four nodes that were fixed, and it must stay silent — it has
no `Do`, it is reached from `userInputSetter` on every `prop-…` value, so failing there fires on the
ordinary boot path. The fix was built, tested, and reverted when the rows showed it. The Array
family in the ⏳ list poses the same question.

**And check whether the report already exists.** The rule the batch settled on: raise in `explicit`
mode only, fire the graph surface in both. In `foreach` mode `foreachitem.ts` has already raised the
precise reason a binding missed, and a second vaguer event on one root cause is the contract's own
"two wordings of one failure".

### 2. NDA-004's other tails

- **`Logic Builder`, the last mute node.** Still blocked by another session's uncommitted rewrite.
  **Check `git status` first and skip if `logic-builder.ts` is still dirty.**
- **Criterion 2's cloud-runtime and export legs.** One raised error, observed in all four contexts.
  Editor and browser are covered; cloud and export are not, and the spec itself predicts export is
  the one that gets forgotten. It still is. The `Response` work touched `noodl-viewer-cloud`, so the
  cloud leg is now the shorter of the two.
- **`dbmodelcrudbase.setError` still uses `sendWarning` as its channel**, not the bus — so every
  Record node's failure is graph-observable everywhere but invisible to `On App Error` and to a
  deployed console. Fixing it is one helper, but `clearWarnings` clears the key `'storage-op-warning'`
  and the bus subscriber keys warnings by `code`, so the two must move together. Contained and
  worthwhile; deliberately not done in the same commit as the per-node work.
- **Catalog regeneration**, still skipped for the same reason (the tree is still dirty). Now owed
  for: `On App Error`; Parent Component Object's and Close Popup's `targetComponent`; Pop Component
  Stack's `Popped`/`Failure`/`Error`; Navigate's transition ports in replace mode; **Response's**
  `Sent`/`Failure`/`Error`; **Set Object Properties'** `Failure`/`Error`; and `repeaterComponent` on
  seven node types — Object (`Model2`), Record (`DbModel2`), Set Object Properties, Set Record
  Properties, Delete Record, Add Record Relation, Remove Record Relation. (The two `Create New …`
  nodes correctly do *not* get it: `addModelId({ includeOutputs: true })` leaves `includeInputs`
  falsy, which is right for a node that creates rather than references.) `nodelibraryexport.ts` reads
  the live register so the editor picker and property panel are already correct — verified live —
  only the generated JSON snapshot is stale. **`NODE-REGISTER.md`'s `Mute?`/`Fail?` columns are wrong
  until this runs**; its hand-written Verdict column and the triage section are the current truth.

### 3. Small residuals

- **`Set Parent Component Object Properties` has no explicit target.** It shares the walk and the
  type list now, so it can no longer disagree with its reader — but BINDING-CONTRACT §(a) is still
  owed. It is the last ⚠️ row in that doc's table. Small, and the pattern is right there in
  `parentcomponentobject.ts`.
- **Two live checks left over from the QA pass**, both cheap once an editor is up: the **screenshot
  corpus** (NDA-002 criterion 3; harness at `dev-docs/tasks/phase-23-visual-refresh/corpus/`,
  `run.sh` wraps it) and the **object→Text DOM demo** (a Function node's `object` output wired to a
  Text node showing JSON — the cast table is verified live, the wiring demo never was).
- **Unfiled cosmetic:** with `useRoutes` on and no page paths set, the Component Stack's
  `_updateUrlWithTopPage` pushes a bare `#` onto the URL.

## Parked / later

- **NDA-010 §1 — re-scoped, do not start from the spec body.** Its premise is partly stale:
  `showpopup.ts:129-177` already derives typed `popupParam-*` from the target component's input ports
  and `closeResult-*`/`closeAction-*` from its Close Popup nodes. The real gaps are the hand-typed
  `results`/`closeActions` on the *Close Popup* side and results being untyped (`*`). The correction
  is written into the spec in place.
- **NDA-010 §3** (stack policy, corpus row F2) is untouched and unchanged. Sequence NDA-004 §2's
  **Show Popup** row after it, not before.
- **NDA-005** (port docs — batch with NDA-012), **NDA-006** (Columns; slices 1–2 Sonnet, slice 3
  needs a breakpoint decision from Richard, slice 4 gated), **NDA-007 §2–3** (build against
  `ICON-SOURCE-MODEL.md`), **NDA-011** (assessment first), **NDA-009 §1** — the editor-time Run Tasks
  template check, which catches F1's mistake earlier than the runtime backstop NDA-004 added.
- **NDA-012** is 1 of 17 categories. Its **Data** and **Cloud Services** worksheets are the specced
  input to NDA-004 §2 and would sharpen the ⏳ list, but the triage now covers the same ground for
  the failure question specifically — run them for the *other eleven* checks, not for this one.

## Executor guidance

Spec metadata names a recommended executor per task/section. Implementation against a red corpus with
a written contract is reliably delegable. **Live diagnosis and anything touching cross-cutting
runtime semantics deserve Opus directly** — class F was five files across three packages, and the
valuable part of it was not the code.

**The phase's single most reliable lesson, now with twelve data points: a spec premise is a
hypothesis, not a fact.** NDA-016's, NDA-008 §0's, NDA-015 §1's canvas-surface suggestion, NDA-015
§3's FIXME, NDA-010 §1's port derivation, NDA-008 §3's "two failures" (there were three), NDA-008
§2's "a re-mount" (it was a re-mount *and* a duplicate stack entry), F-ii's "five silent bindings"
(one was a crash), and now **NDA-004 §3's "ten nodes that emit nothing"** — `Response` was not
merely mute, it threw a `TypeError` out of an input setter. A mechanical pass would have added a
`Sent` port and left the crash in place.

**Second: a claim that something was cleaned up is a hypothesis too.** NDA-015 recorded "one
implementation now, in `componentwalk.ts`". It was one of four call sites, and the three left behind
carried divergent type lists that made a *reader and a writer of the same state* land on different
components. Re-check "de-duplicated", "unified", "now shared" the same way you re-check a defect.

**Third: a success criterion can name the wrong instrument.** NDA-016 criterion 4 demanded a
screenshot-corpus run for a change the corpus cannot photograph. Say so, and run the check that does
apply, rather than collecting a meaningless green or silently skipping.

**Fourth: show your rows discriminate.** Every fix in this phase has been verified by temporarily
removing the fix and confirming the right rows go red while the pinned controls stay green. It is
cheap, and it is the difference between a test and a decoration. It also catches a *fixture* being
too thin, and — new this session — it catches a fix that is **wrong**: the Object node's rows went
green, and the control row showing `Failure` on the ordinary path is what stopped it shipping.

**Fifth, new: five identical-looking call sites are not five instances of one defect.** The batch
found `if (!internal.model) return;` in five schedulers. Four were the defect and one was correct
behaviour. Read what *reaches* each site before treating the shape as the diagnosis.

Fence agent territories by file and forbid them `PROGRESS.md` — the coordinator owns it. Update
`PROGRESS.md` and the `phase-30-node-library-audit` memory as tasks land, not at the end.

## Traps banked, cumulative

- **A `Failure` port that can fire on the happy path is worse than no port.** The contract says so
  and the Object node is the worked example. The test is "who triggers this scheduler", not "does
  this branch mean something went wrong".
- **A completion signal can be impossible to fire after the work.** `Response`'s callback tears the
  request scope down synchronously before resolving, so `Sent` must fire *before* delivery, and the
  "can I still act" question has to be asked as a separate query (`_requestIsOpen()`) rather than
  read from the action's return value. Check for the same shape anywhere an action deletes its own
  scope — Run Tasks tears down its task components on completion for the same reason.
- **The `_forEachModel` sites are in `packages/noodl-runtime/src/`, not the viewer.** FINDINGS' bare
  `data/…` prefixes read as viewer paths and are not. (Corrected in place.)
- **There are two component walks and they are not interchangeable** — see BINDING-CONTRACT's table.
  `componentAncestors`/`findAncestorWith*` take the *visual* parent when there is one and exclude
  self; `scopeChain` follows `parentNodeScope` only and **includes** self. Ambient properties
  (`_forEachModel`, `_popupCloseHandler`) need the second. Collapsing them looks like tidying and
  silently moves bindings.
- **Whether clause (c) needs an "is it loud yet" gate depends on the protocol.** Hunting a *node* in
  an ancestor's scope does (it may not exist yet). Reading an *ambient property* does not —
  `extraProps` land at `nodecontext.ts:398-403`, before `setComponentModel` builds any inner node.
- **Where a resolution is computed for every node whether or not it is wanted, make it lazy.** A
  getter on the Function node's component scope is safe because the scope is handed to the user's
  script by reference, never spread or serialised.
- **Run Tasks tears down its task components when a run completes**, so a node inside one is gone by
  the time you look. Leave the template's completion unwired to hold the instance open for probing.
- A `.js` file in `noodl-runtime/src` can `require` a `.ts` sibling — jest transforms both, and
  `javascriptnodeparser.js` already did it for `./model`.
- **TypeScript cannot check which mixins a node definition composed.** `modelcrudbase`'s
  `scheduleStore` guards `this._failNoModel` and raises a named error if it is absent, rather than
  letting a forgotten `addFailure` become a `TypeError` thrown out of a scheduler.
