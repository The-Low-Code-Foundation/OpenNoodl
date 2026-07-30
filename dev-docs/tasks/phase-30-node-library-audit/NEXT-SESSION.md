# Phase 30 — next session handover (written for Opus, 2026-07-30)

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
- **NDA-004 §2's second batch landed 2026-07-30** — `84d2968a` (Component Object family + Video),
  `187900ff` (Expression), `88300a2a` (the Record family's failure *channel*). Four ✅, two 🔵 on
  evidence, 44 corpus rows. **The triage's predictions were wrong in both directions**, which is
  the thing to carry forward rather than the code: the family predicted to be "the cheapest
  remaining ✅s" contained the phase's worst class-B defect, and the node predicted to have one
  failure had two.
- **NDA-004 §2's third batch landed 2026-07-30** — `2f7bc0cf` (Array mutators), `56de20b5` (States),
  `f478123b` (Open File Picker). ⏳ items **6, 5 and 2** closed; 45 corpus rows, 16 reverts. Six ✅,
  two 🔵. **The reusable half is four things the discrimination check found that no test failure
  would have** — read "Harness facts" below before writing a single row, because two of them mean
  rows you write can pin nothing at all while looking green.

- **NDA-004 §2 closed its last coding items on 2026-07-30** — `2f519c1d` (item 4), `2a448a45` +
  `1579121f` (all 21 remaining `setError` helpers, FINDINGS B-iv **closed**), `928531ce` (Array
  Filter), `e442c9a1` (item 7), `27184f12` (Show Popup), `674aee0f` (the `hasOutput` top-up).
  **Criterion 4 is met for every node that is a coding task**; only the deprecated-five policy
  question is left. ~80 new corpus rows. The reusable half is in FINDINGS **B-viii…B-xi**, and the
  one to read first is **B-x**: three controls written this session proved nothing, all by
  asserting an absence in a state where the code under test never ran.

- **A second session ran four tasks in parallel on 2026-07-30**, on files disjoint from NDA-004's
  ⏳ list: **NDA-006** slices 1–3 (`b09b9785`, `f3b0aba4`), **NDA-010 §3** (`c8c26382`), **NDA-011**
  (`069621be`), **NDA-007**'s renderer half (`f85be46f`). Two consequences for whoever picks this
  up: NDA-004 §2's **Show Popup** row is unblocked, and NDA-006 slice 4 is unblocked. **Four of
  those four tasks had a stale headline premise** — the pattern is now strong enough to plan for:
  read the mechanism before trusting a spec's stated defect. Details in `PROGRESS.md`'s log.

Six normative docs in `dev-docs/reference/`: `REACTIVITY-CONTRACT.md`, `EMPTY-VALUE-CONTRACT.md`,
`FAILURE-CONTRACT.md`, `PORT-TYPE-CONTRACT.md`, `BINDING-CONTRACT.md`, `ICON-SOURCE-MODEL.md`.
**`BINDING-CONTRACT.md`'s two added sections are worth reading before you touch anything that
resolves a target without a wire**: "How to obey it" names the helpers, and "The two walks" is a
table you will otherwise get wrong.

Gates as of `3b1beb48`: **1,119 runtime jest, 349 viewer jest, 1,885 editor jasmine (0 failures)**;
cloud jest 52, unchanged and untouched since `d21154e1`. The editor suite was last run at `63f76b62`
and nothing since has touched editor source. Both packages typecheck (`npx tsc --noEmit`) — but see
the red-suite warning below, which applies to the typecheck too: `noodl-viewer-react/src/types.ts`
and the `components/controls` files were mid-edit by another session and reported errors that were
not this workstream's.

⚠️ **A red runtime suite may not be yours.** Two sessions have been committing to this tree, and
twice during 2026-07-30 a full run showed failures that were purely the *other* session's
mid-edit files (`nda-004-user-auth-error-channel.test.ts`, then `signfileurl.test.ts` +
`statehistory.test.ts`). Check `git status --porcelain` on the failing file's directory before
believing a failure belongs to your diff.

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

**~~The committed viewer bundles are stale.~~ CORRECTED 2026-07-30 — they are not committed at
all.** `packages/noodl-editor/src/external` and `packages/nodegx-backend/deploy/artifact/` are
**gitignored, with zero tracked files** (`.gitignore:187`, `packages/nodegx-backend/.gitignore:9`).
`git status` cannot show them dirty because git does not track them, which is why the old note read
them as frozen. They are ordinary build output: a live webpack watch *does* rebuild `external/`, and
on 2026-07-30 it had already picked up that session's source edits before the tests ran. So the risk
is the opposite of the one recorded — anything grading them is testing **whatever was last built**,
which may be newer or older than your working tree depending on whether a watch is running. Check
`ps aux | grep webpack` before trusting or distrusting them.

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

## Harness facts — read before writing a corpus row

Four things the 2026-07-30 third batch established. **Two of them mean a row can look green and pin
nothing**, which is worse than a missing test, so they are not optional reading.

1. **`graph.signalsFor` does not prove a port exists.** It records the port name *before* delegating,
   and `Node.sendSignalOnOutput` on a name the node lacks only `console.log`s and returns. Deleting a
   node's `failure` output leaves every `expect(signalsFor(id)).toContain('failure')` row **green** —
   verified by doing it. Assert `node.hasOutput('failure')` as well whenever the *port* is part of
   the claim. **The batch-1 and batch-2 §2 files have this gap and should be topped up.**
2. **`undefined` cannot reach an input setter over a connection.** `Node.prototype.sendValue`
   (`node.ts:635-637`) drops it at the sender. Any row that drives `undefined` down a wire pins
   nothing. (`outputproperty.sendValue` does *not* filter, which is what makes this look reachable —
   the filter is one layer up, in the method `flagOutputDirty` actually calls.) The only sender is a
   **parameter reset**: `NodeModel.setParameter(name, undefined)` deletes the parameter and
   `node.ts:871-882` queues the port's default.
3. **No node↔node-model event is delivered in `noodl-viewer-react`'s jest at all**, so you cannot
   drive a parameter edit there. `setNodeModel` registers with a *ref*, so its listeners live in
   `EventSender.listenersWithRefs` — a `Map` that `emit` walks with `for…of` — and this package
   compiles sibling-package sources at `target: "es5"` with no `downlevelIteration`, turning that
   into an index loop over `map.length`: `undefined`, so **zero iterations, silently**. Ref-less
   listeners on the same emitter work, which is why nothing had noticed. Rows needing a real
   parameter edit belong in `noodl-runtime`'s half of the corpus. This **extends** the banked
   pre-ES2015 trap rather than restating it — that one says the symptom is a loud `TS2802`, and here
   there is no error at all, because a cross-package source is transpiled with these options but its
   diagnostics are never surfaced.
4. **No exception from any input setter is a crash.** `nodecontext.ts:220-228` wraps every node's
   `update()` in a `catch` that only `console.error`s. So "the node throws" is not by itself evidence
   of a crash, and a row asserting "it does not propagate" will pass with the fix removed. The cost is
   still real and still worth reporting — `Node.update` rethrows to that catch, so the rest of that
   node's pass (remaining queued inputs, after-update callbacks) is abandoned, and the sole diagnosis
   is an unstructured console line with no code and no provenance. Pin the *structure* of the report
   instead.

There is also **no `jest-environment-jsdom` in this monorepo**. A node whose `initialize` touches
`document` cannot be constructed under `testEnvironment: node`; stub what it reaches for, as
`nda-004-open-file-picker.test.ts` stubs `document` and `nda-004-video-playback.test.tsx` stubs a
media element. And a **mixin must merge into whichever method bag the node already uses**:
`nodedefinition.ts:266` reads `opts.methods || opts.prototypeExtensions`, so handing a `methods` bag
to a node that declares `prototypeExtensions` **deletes every method it had**.

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

### 1. NDA-004 §2 — **done**, bar one policy question

**Criterion 4 is met for every node that is a coding task** (2026-07-30). Every ⏳ entry in
`NODE-REGISTER.md`'s triage is struck through except **item 9, the deprecated five**, which is a
scope decision for Richard — whether deprecated nodes are in scope at all — and not something an
implementer should settle. Closed this session:

| What | Commit |
|---|---|
| Item 4 — Push Component To Stack / Navigate | `2f519c1d` |
| FINDINGS B-iv — the user/auth eleven `setError` helpers | `2a448a45` |
| FINDINGS B-iv — the last ten | `1579121f` |
| Array Filter | `928531ce` |
| Item 7 — Filter Records, State History, Stream Buffer, Set Variable, Repeater Item | `e442c9a1` |
| Item 3 — Show Popup | `27184f12` |
| The `hasOutput` top-up, and the Send Event defect it found | `674aee0f` |

**The four questions still apply to any node you audit** and are unchanged — they are below,
under "Four questions". What this session added to them:

1. **A grouping predicts nothing about the answers, and the register's own bullets are guesses.**
   Item 7's five nodes had four different verdicts. Array Filter's "you will need a flag set by the
   signal handlers" turned out to be already in the source, inverted, as
   `isInputConnected('filter') === false`. Item 4's "a target page that does not resolve" named one
   drop of **five**, none of them in the file the register cited.
2. **The false-success shape is three registries deep** and the banked rule was too narrow. It is
   not only create-on-read lookups: `Set Variable` did `Model.set(undefined, value)`, which makes
   `undefined` a property name on the record every Variable node shares and then reports `Done`.
   The general form is **any keyed operation whose key can be absent, where the absent case is
   representable** — see FINDINGS B-ix.
3. **A fix reported as done is a hypothesis too.** Send Event was ✅ from batch 1 on the strength of
   a `Failure` signal and a raised code, and had **no `Error` port at all**. FINDINGS B-xi.

⚠️ **Read FINDINGS B-x before writing any control that asserts an absence.** Three controls written
this session proved *nothing*, and all three were the same mistake: asserting silence in a state
where the code under test never ran. An early-return dedup made a guard unreachable; a boot-path
control never reached the scheduler; and two controls passed **vacuously** because `signalsFor` on
a node that failed to construct returns `[]`. Make the control prove the code *did* run.

### 2. NDA-004's other tails — **this is where the remaining work is**

- **Live QA. Owed, and now larger than the nine it used to be.** Nothing fixed on 2026-07-30 has
  been watched running: batch 2's four, batch 3's five, and this session's **twelve more** (Push
  Component To Stack, Navigate, Array Filter, Filter Records, Set Variable, Stream Buffer, Repeater
  Item, Show Popup, State Snapshot, Undo/Redo, Subscribe To Changes, Send Event). All pass jest.
  Three earn a launch on their own:
  - **Open File Picker's `Cancelled`** — its rows stub `document`, and the real `cancel` event is
    the one thing a stub cannot vouch for.
  - **States** — the property panel must show two new static ports on a node whose port set is
    otherwise entirely dynamic.
  - **Show Popup's `show-popup/target-failed`** — the rows drive it through a rejected promise in
    jest; what a real editor does with an unhandled-rejection-turned-raise is worth seeing once.
  ⚠️ A dev editor and a webpack watch were running in this tree at the end of this session
  (another workstream's). Check `ps aux | grep "[O]penNoodl/node_modules/electron/dist"` before
  launching a second one, and remember that a dev launch rewrites the example project's
  `project.json` on open *and* shutdown.
- **`Logic Builder`, the last mute node.** Still blocked: `logic-builder.ts` was still dirty at the
  end of this session. **Check `git status` first and skip if it is.**
- **Criterion 2's cloud-runtime and export legs.** Unchanged and still owed. One raised error,
  observed in all four contexts; editor and browser are covered, cloud and export are not, and the
  spec predicts export is the one that gets forgotten. It still is. The `Response` work touched
  `noodl-viewer-cloud`, so the cloud leg is the shorter of the two.
- ~~**The 21 remaining `setError` helpers**~~ — **done**, `2a448a45` + `1579121f`. And **B-iv's own
  table was wrong**, which is the part to carry: it counted twenty-two definitions and read them as
  copies of one that posted to `sendWarning`. Fourteen do. **Six posted nowhere at all**, which is
  worse rather than lesser, and three of those had no `Failure` port either. Corrected in place in
  FINDINGS.
- **Catalog regeneration**, still skipped — the tree is still dirty. The owed list has grown; on top
  of everything the previous handover listed, add `Failure`/`Error` on **Push Component To Stack**,
  **Navigate**, **Array Filter**, **Filter Records**, **Set Variable**, **Stream Buffer**, **Show
  Popup**, **State Snapshot**, **Undo/Redo**, **Subscribe To Changes**, and `Error` on **Send
  Event**. `nodelibraryexport.ts` reads the live register, so the editor picker and property panel
  are already correct — only the generated JSON snapshot is stale. **`NODE-REGISTER.md`'s
  `Mute?`/`Fail?` columns are wrong until this runs**; the hand-written Verdict column and the
  triage section are the current truth.
- **Show Popup's one residual**: `NodeContext.showPopup` opens with `if (!this.onShowPopup) return;`,
  so a runtime with no popup host — an SSR render, a cloud function — resolves *successfully* having
  done nothing. Distinguishing that needs a change in `nodecontext.ts`, which was another
  workstream's file this session, so it was recorded rather than reached for.

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
- ~~**NDA-010 §3**~~ — **done 2026-07-30 (`c8c26382`), so NDA-004 §2's Show Popup row is unblocked.**
  One modal slot by default (`When A Popup Is Open` → `Replace It`), `Show On Top` as the opt-in.
  The policy lives in `NodeContext.showPopup`, not on the node.
- **NDA-005** (port docs — batch with NDA-012) and **NDA-009 §1** — the editor-time Run Tasks
  template check, which catches F1's mistake earlier than the runtime backstop NDA-004 added.
- **NDA-006 slice 4 (masonry)** — now unblocked; slices 1–3 landed 2026-07-30 (`b09b9785`,
  `f3b0aba4`). Read the §3 ports first: `Column Sizing` (`Auto Fit`) and the container-width
  breakpoints already exist, and masonry has to decide its ordering *against* them.
- **NDA-007 §2–3** (registration path + editor picker) — the larger half, and the only part left.
  §1's union is **implemented in the renderer** (`f85be46f`): one `IconGlyph.tsx` replaced six
  copies of the font splat, so a `sprite`/`inline` value renders, sizes and colours correctly today.
  What is missing is any way to *install* or *select* one. Build against `ICON-SOURCE-MODEL.md`,
  whose "Implementation status" section says exactly what is and is not there.
- ~~**NDA-011**~~ — **done 2026-07-30 (`069621be`).** REST deprecated, not deleted; six shadowing
  control nodes taken out of the picker. See `NDA-011-CAPABILITY-COMPARISON.md`.
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

**Fifth: five identical-looking call sites are not five instances of one defect.** The batch
found `if (!internal.model) return;` in five schedulers. Four were the defect and one was correct
behaviour. Read what *reaches* each site before treating the shape as the diagnosis.

**Sixth, new: the triage's own confidence grades are the thing to distrust, in both directions.**
Batch 2 worked two ⏳ entries and a "reasoned" one. The family predicted to be "the cheapest
remaining ✅s" contained the phase's **worst** class-B defect — a node reporting `Done` for a write
that went nowhere — and two nodes that turned out to be 🔵. The node predicted to have one failure
had two. A "reasoned" verdict is a prediction about where to spend the next read, exactly as the
register says; treat a *read* verdict's neighbours as unread even when they share a file.

**Seventh, new: a trap in this document can be wrong too.** The stale-bundles note was, for three
sessions. It asserted that two build directories were committed and frozen; both are gitignored with
zero tracked files, which is *why* `git status` never showed them dirty. Re-check a trap the same way
you re-check a spec premise — especially one whose evidence is an absence.

Fence agent territories by file and forbid them `PROGRESS.md` — the coordinator owns it. Update
`PROGRESS.md` and the `phase-30-node-library-audit` memory as tasks land, not at the end.

## Traps banked, cumulative

- **`Collection.get(undefined)` is the second instance of the create-on-read trap, so it is a
  pattern now.** `collection.ts:721-727` is the anonymous tier — a fresh, differently-named
  collection on every call — exactly as `Model.get(undefined)` is at `model.ts:205-212`. Both made a
  node bound to a throwaway and reporting `Done`. Batch 2 said "worth grepping for other
  `Model.get(<maybe-undefined>)` call sites"; widen that to **any create-on-read lookup fed by a
  value that can be absent**.
- **On a port only a parameter can empty, `undefined` is a deletion, not an abstention.** The
  Empty-Value Contract's "`undefined` abstains" is a statement about ports a *wire* can feed. Where
  the runtime filters `undefined` at the sender (it does — see Harness facts 2), the only sender is
  an author clearing the field, and honouring that as "no opinion" leaves the node acting on a target
  the author has just removed from it. Same silence, different wrong target.
- **A fix that only reports can leave the mechanism of the damage in place.** States' unknown-state
  guard has to *refuse to move*: transitioning to a state whose values do not exist is what zeroed
  every value. A revert that reports-but-still-transitions is the discrimination check that makes
  that a tested decision rather than a preference.
- **"The missing counterpart to Success" is not automatically a `Failure`.** Open File Picker's was a
  cancelled dialog, which is a legitimate empty result — the contract lists it among the things that
  must *not* raise, so it got a `Cancelled` **completion** signal that raises nothing. Ask which of
  the contract's two clauses a gap falls under before reaching for `Failure`.
- **Grouping nodes by the question they pose predicts nothing about the answers.** The three Array
  mutators pose one question and had three different wrong answers to it (editor-only warning, total
  silence, uncaught `TypeError`). The grouping is how you choose what to read next, and that is all
  it is.

- **A `Failure` port that can fire on the happy path is worse than no port.** The contract says so
  and the Object node is the worked example. The test is "who triggers this scheduler", not "does
  this branch mean something went wrong". Batch 2 added the inverse case: Expression *can* safely
  have one, because `registerInputIfNeeded` seeds its discovered inputs to `0` rather than
  `undefined`, so it never passes through a "values have not arrived yet" state. **The seeding is
  load-bearing for the port's safety, and a corpus row pins it.**
- **A miss handed to a create-on-read lookup is a false success, not a silence.**
  `Model.get(undefined)` mints a fresh anonymous record (`model.ts:205-212`), so `Set Parent
  Component Object Properties` wrote every property into a throwaway and emitted `Done`. Anywhere a
  walk can return nothing, the nothing must be a *branch*, not a value passed onward. Worth grepping
  for other `Model.get(<maybe-undefined>)` call sites.
- **Two nodes can be one file parameterised and still deserve opposite verdicts.** `Set Component
  Object Properties` (🔵, its record is its own component's) and `Set Parent Component Object
  Properties` (✅) share `componentutils/base.ts`. `canFailToResolve` is opt-in there so the self
  variant carries no vestigial port, and **two corpus rows pin the absence of that port** — a later
  mechanical sweep "finishing the family off" is the regression they exist to catch.
- **Reverting a fix is not always a clean discrimination check.** Video's `AbortError` row reddens
  under two different reverts for two different reasons: emptying `SILENT_PLAY_REJECTIONS` fails it
  on its assertion (correct), while deleting the promise handling fails it as an *unhandled
  rejection* (incidental). Run the revert that targets the specific decision, and read the failure
  mode, not just the red.
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
