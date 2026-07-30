# Phase 30 — next session handover (rewritten for Opus, 2026-07-30, late)

Work on branch `cline-dev`, commit directly to it, no task branches, no PRs. Use explicit pathspecs
on every commit — the tree **still** carries another session's uncommitted work (Blockly editor and
its four new untracked files, `logic-builder.ts` + untracked `logic-builder-io.ts` and its two test
files, icon assets, `scripts/generate-icons.js`, core-ui icons, and both `node-catalog*.json` files)
that must never ride along. End commit messages with the Claude co-author line.

## Where the phase stands

**Tier 1 is done and live-verified.** NDA-001 corpus (`7a27e7c3`), NDA-013 (`0e96c93a`), NDA-002
(`bd6632ca`…`825da393`), NDA-003 (`e707f0cc`…`b2032129`), NDA-014 (`61e8b3da`).

**Tier 2 is all but done.** Complete: NDA-008 (all four sections), NDA-015 + class F, NDA-016,
NDA-010 §2 and §3, NDA-014 §1–2, **NDA-006 (all four slices)**, **NDA-007 (all three sections)**,
**NDA-011**, and **NDA-004 §2's criterion 4 for every node that is a coding task**.

**Two sessions ran in parallel through 2026-07-30 and both finished their lists.** What is left of
Tier 2 is listed under "The work, in order" below and it is short — the ⏳ list that dominated three
handovers is closed. Read that section before anything else; several items you may remember as open
are not.

Since the last handover:

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

**2026-07-30, later still: the deployed build was run for the first time, and it found three
defects** — two of them in criteria already signed off. `cc28a4be` (NDA-006 §5), `382894e4`
(NDA-004 §2 criterion 2), `c598206e` (NDA-009 §1). Read FINDINGS **defect class H** before item 1
below; the one-line version is that *a criterion whose last clause names a build nobody runs is a
criterion that grades the build everybody runs.* Gates after it: **runtime jest +19 from that
workstream, viewer jest 362**, all three typechecks clean.

**Gates as of `6f166ccb` + the catalog correction: 1,194 runtime jest, 367 viewer jest, 1,894 editor
jasmine (0 failures), all three typechecks clean, `catalog:merge:check` green.** ⚠️ `catalog:check` is
red in a tree carrying the other session's generator work, and that is *their* pending commit, not a
stale artifact — see the schema trap in §0.

Older, kept for the notes around it — gates as of `899ab676`: **1,119 runtime jest, 359 viewer jest, 1,894 editor jasmine (0 failures)**;
cloud jest 52, unchanged and untouched since `d21154e1`. The editor suite was run twice at
`899ab676` — see the barrel trap below for why once was not enough. All three packages typecheck
(`npx tsc --noEmit`) — but see
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

Four things the 2026-07-30 third batch established, plus a fifth from NDA-017 §0. **Three of them
mean a row can look green and pin nothing**, which is worse than a missing test, so they are not
optional reading.

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
5. **`update()` and `settle()` are not interchangeable, and picking the wrong one hides a whole
   defect class** (added by NDA-017 §0). `graph.update()` is **synchronous** — it drains the dirty
   list and the after-update callbacks without yielding — while `settle()` awaits the macrotask queue
   between frames. So a producer that lands its value from a `setTimeout` **cannot** have landed
   across an `update()`, and *can* across a `settle()`. Any row about a node acting on inputs that
   have not arrived — the whole of NDA-017's twelve families — must use `update()` to hold the race
   open. Written with `settle()`, the producer wins and the row reports the defect as **absent**,
   green and meaningless. This is the timing half of harness fact 2: that one says which values can
   reach a port, this one says *when*.

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

The ⏳ list is closed. **Do not start from a spec body in this phase without re-reading the
mechanism** — the count of stale premises is now *thirteen*, and NDA-007 §2's was stale in the
useful direction: the thing it said did not exist had existed for years, and finding that turned a
"two asset pipelines have to agree" task into one manifest field.

### 0. What the 2026-07-30 **final** session did — read this first

**The catalog block is gone, and it was never real.** Both `node-catalog*.json` had been dirty with
another session's Logic Builder work for four handovers and the standing instruction was to
coordinate. But their hunks were *derivable* — the two `editorName` removals from `logic-builder.ts`,
the whole enriched diff from the dirty `enrichment/logic-builder.json` and its example — so
regeneration would **reproduce** their tree, not clobber it. That is a testable claim: back both files
up twice (scratchpad *and* the git index), regenerate, diff. `Logic Builder` was not in the
changed-node list at all. **The question is never "is it dirty", it is "does regeneration reproduce
it"** — and one reversible experiment beat four sessions of waiting.

Staging kept their work out by *constructing* the blob rather than filtering hunks in a 1.1 MB JSON:
regenerated catalog with `HEAD`'s `Logic Builder` substituted back in, staged with `git hash-object -w`
+ `git update-index --cacheinfo`. `json.dumps(…, indent=2, ensure_ascii=False)` round-trips both files
byte-identically to what `JSON.stringify(…, null, 2)` writes, so the substitution provably changes
nothing else. **Their work is still dirty in the tree, untouched.**

Landed this session (`7e2cdac9`, `4e4d1cf3`, `4be365a6`, `47f67846`, `6f166ccb`):

- **Catalog regenerated.** NDA-009 criterion 4 and NDA-005 criterion 1 both stopped being
  built-but-unprovable. Coverage **5.4% → 39.1% measured**; nodes at 0% **112 → 83**. ⚠️ The
  projected 41.2% was optimistic — reported as measured, not reconciled away.
- **`On App Error` was registered but not in the picker**, so the Failure Contract's catch-all half
  could not be added to a graph; every measurement that found it working found it in a script-written
  fixture. Criterion 2's own trap one level down. Fixed. Also wrote its enrichment entry, which
  regeneration had turned into a **live CI failure** (`catalog:merge:check --require-coverage`).
- **NDA-012 is 8 of 17 categories, 22 of 155 nodes**, run batched with NDA-005's C1. **31 new defects,
  no find-rate decline.** Two shapes recur *across* categories, which the per-node reads could not
  have shown — see the find-rate table in `PROGRESS.md`.
- **NDA-010 §1** items 2 and 3 done, item 1 is a decision (in the spec). **NDA-009 §4 done — NDA-009
  is complete.**

**Still blocked, unchanged:** `Logic Builder` (NDA-004 §3's last mute node) — `logic-builder.ts` is
still dirty with the other session's rewrite. Check `git status` on it first.

⚠️⚠️ **The five-consumers note is not enough: catalog regeneration also folds in uncommitted
changes to the *generator*, and those rewrite the artifact's schema across all 156 nodes.** The
other session began SUB-013 (parameter encodings) mid-session — `scripts/node-catalog/generate.js`,
`extractor-entry.js` and `lib/build-catalog.js` all dirty, plus a dozen untracked files — and a
regeneration after that point added a `parameterEncoding` block to **every node**. It rode into
`4be365a6` before it was caught, and was corrected in the following commit by stripping the key.

**The node-level substitution that keeps another session's node work out cannot catch this**, and
that is the lesson: it guards a *node*, and a generator change is a *schema* change. Two detections
that do work, both cheap:

- `npm run catalog:check` going red **when you have changed nothing** means the generator moved under
  you, not that your artifact is stale. That is what surfaced this.
- `git status --porcelain scripts/node-catalog/` before regenerating, and again before staging.

The verification that made the fix safe is reusable: strip the new key, then assert the result differs
from the last-known-good commit **only** in the ports you documented — node set identical, every
node-level field identical, every port identical once `description` is removed. It came back as
exactly the 11 nodes, which is what makes it a correction rather than a hope.

⚠️ **New harness fact, and it cost a green row that pinned nothing.** `setInputValue` on a
**runtime-discovered** port is a no-op: `registerInputIfNeeded` only runs when a *connection* targets
the port, so the call logs `node doesn't have input <name>` and returns. A row driving Event Sender's
payload that way measured nothing — and its control passed too, because `Received` fires regardless of
payload. **A control that does not depend on the thing under test cannot detect that the thing never
happened.** Drive dynamic ports over a wire, and assert the value actually arrived.

### 0a. Decisions waiting on Richard — none of them is a coding task

Consolidated here because they were scattered across four sections. **NDA-017 §1 is the only one that
blocks anything.**

1. **NDA-017 §1 — blocks §2, and it is the biggest.** Never-arrived detection (cheap, closes the seed
   case) vs. an upstream-pending notion in the runtime (phase-sized, closes the case the community
   actually reported) vs. making NDA-004 §3's completion-signal sequencing discoverable through docs
   and the semantic validator. The spec recommends **A + C now, B separately**. §0 added a constraint
   to A in place: the seed also reaches the graph with **no `Run` at all**, and a control-signal check
   cannot see that route. Details in §2b.
2. **Two creatable nodes read "Delete Record"** — `DeleteDbModelProperties` (Parse-wire) and
   `noodl.byob.DeleteRecord` (BYOB). Either family gives up the plain label; which is canonical is the
   question WF-007 left open. Details in §4, evidence in `FINDINGS.md`.
3. **NDA-004 §2's ⏳ item 9, the deprecated five** — should a deprecated node gain a failure surface at
   all. **2026-07-30 added the strongest data point yet**: `Script Downloader` does network I/O against
   author-supplied URLs and has **no failure surface whatsoever** — no `onerror`, no raised code, no
   console line of its own, so a 404 gives an author a `Loaded` that never fires and nothing to learn
   from. The case for "yes" is easier here than for any of the others. The Javascript worksheet has it.
   ⚠️ A second data point cuts the other way and is worth knowing before deciding: **`Number Blend` is
   deprecated and is the *healthier* of its pair** — it does Color Blend's job over a type with neither
   the format ambiguity nor the dead end. **Deprecation does not track quality here.**
4. **NDA-010 §1 item 1 — should a popup's Component Outputs *be* its close results?** Close Popup still
   names results by hand in a `results` stringlist. Deriving them from the component's output ports
   instead would redefine what a Component Output on a popup means — today they go nowhere, since a
   popup instance is created by `showPopup` rather than wired into a parent. Coherent, arguably right,
   and a semantic change with a compatibility cost the typing fix (already landed) does not carry.
   Three options are written into the spec. **Blocks nothing.**
5. **`Value Changed` cannot see an Object or Array being edited**, and the fix needs a decision rather
   than a patch: comparing aggregates by content would fire on every keystroke into a bound Object. The
   options are a **Deep Compare** input, a documented limitation (done — the port sentence now says
   it), or routing authors to the Object/Array change signals. Logic worksheet. **Blocks nothing.**

### 0b. What the 2026-07-30 late session did, and what it leaves

- **The confirmatory live run is DONE** (`847c6282`). All three witnesses pass — masonry at authored
  widths in the script-stripped SSG page, and the `[noodl] … [expression/compile-failed]` line in
  both the SSG build's stdout and the deployed browser console. **Item 1 below is closed**; it is
  kept for the recipe, which is still the way to drive a deploy headlessly. FINDINGS **H-iv**.
  The fixture generator now creates the `Expression` this needs and the README records that the
  *absence* of an `On App Error` node is load-bearing.
- **NDA-009 §2 + §3 are done**, so **NDA-009 is complete bar §4** (a design question). See the
  log entry; the reusable half is that *the spec's own criterion 4 ruled out the mechanism the spec
  asked for* — enum ports mean `sendDynamicPorts` means a dynamic-port node means the validator
  stops checking the node's ports altogether.
- **NDA-005's §0 and its shared pass are done.** The premise was half right in a way that would have
  wasted the whole task: **`description` was declared on both port types and copied nowhere**, so
  the field the task tells you to write reached no reader — including three descriptions NDA-003 had
  already written. Plumbing fixed, house style settled at
  [`PORT-DESCRIPTION-STYLE.md`](../../reference/PORT-DESCRIPTION-STYLE.md), 61 shared port names
  documented, projected coverage **5.4% → 41.2%**. **What is left is the per-node tail** — 106 nodes
  still at 0%, almost all non-visual — and the spec's own advice is right: do it inside NDA-012's
  category pass, because check C1 *is* this task and the node is already open.
- **Catalog regeneration and `Logic Builder` are still blocked** and were re-checked at 2026-07-30
  late: `node-catalog.json`, `node-catalog-enriched.json` and `logic-builder.ts` are all still dirty
  with the other session's work. **NDA-009 §2 added four more ports to the debt** —
  `taskStartInput`, `taskSuccessOutput`, `taskFailureOutput`, `taskErrorOutput` on `RunTasks` — and
  they are what makes NDA-009's criterion 4 demonstrable, so that criterion is *built but not
  provable* until the catalog runs.

### 1. ~~The two deployed-build legs~~ — DONE 2026-07-30, and they found three defects

`cc28a4be` (NDA-006 §5), `382894e4` (NDA-004 §2 criterion 2). **NDA-007 criterion 1 passed as
written.** Full account in `PROGRESS.md`'s newest log entry and FINDINGS **defect class H**; the
one-line version is that a criterion whose last clause names a build nobody runs is a criterion
that grades the build everybody runs.

~~**What is left of it is one confirmatory launch**~~ — **run 2026-07-30, all three witnesses pass**
(`847c6282`, FINDINGS **H-iv**). The recipe below is kept because it is the reusable half, and
because the *new* finding from running it is that **the deploy output is itself a fixture you can
edit**: substituting `width:calc(100% + 0px)` → `width:calc(100% + (0px)` in the served HTML and
reloading discriminates H-i in seconds, with no rebuild. Any defect whose evidence is a serialised
attribute can be checked that way. The steps as run:

1. `node scripts/nda-live-qa/make-fixture.js "<VerifyFix4>/project.json"` and `make-iconsets.js`
   (⚠️ `VerifyFix4` currently *holds* the fixture — the previous handover's "restored to Hello
   World" is stale; the session scratchpad was cleared before it could be put back).
2. Launch, open the project, and deploy from CDP — recipe below.
3. **Masonry first paint**: strip every `<script>` from the SSG `dist/index.html`, serve it, and
   the seven items should now be at their authored widths instead of 0px. Under the defect the
   container measured 110px and every item 0.
4. **The console line**: add an `Expression` with `expression: "1 +* "` to the graph. Expect
   `[noodl] Expression (App): The expression could not be compiled … [expression/compile-failed]`
   in the browser console *and* in the SSG build's stdout. Under the defect there was none in
   either, while an `On App Error` node received it in both — which is exactly how the leg passed
   review three times.

**Driving a deploy headlessly, which is the reusable half.** `deployToFolder` is on no global and
Node's `require` cannot reach it (webpack bundle), and the UI path is a native folder dialog CDP
cannot answer. In dev the chunk ids are the source paths:

```js
let rq; self.webpackChunknoodl_editor.push([['qa'], {}, (r) => { rq = r; }]);
const { createEditorCompilation } = rq('./src/editor/src/utils/compilation/compilation.editor.ts');
const { ProjectModel } = rq('./src/editor/src/models/projectmodel.ts');   // exact path; a regex
                                                                          // match finds Lessons* first
await createEditorCompilation(ProjectModel.instance)
  .deployToFolder('<dir>', { environment: undefined, runtimeType: 'ssr' }); // omit for CSR
```

Then `npm install && npm run build:ssg && npm run ssg` **inside the output folder**. Note the SSG
reads its graph from the `{{#export#}}` splice in **`ssg.js`**, not from `public/index-<hash>.js` —
patching the latter changes the hydrated page and nothing the prerender sees, which cost a full
build to notice.

Fixture and CDP measurement recipes: `scripts/nda-live-qa/` (`make-fixture.js`, `make-iconsets.js`,
README).

### 2. NDA-004's remaining tails

- **⏳ item 9, the deprecated five** — an open *policy* question for Richard, not a coding task:
  should a deprecated node gain a failure surface at all. The deprecated pair that already *had* one
  was fixed under B-iv, so this is only about the ones that do not.
- **`Logic Builder`, the last mute node** (§3, 9 of 10). Still blocked by the other session's
  uncommitted rewrite — `logic-builder.ts` was still dirty at 2026-07-30 16:00, along with
  `logic-builder-io.ts` and two untracked test files. **Check `git status` on it first and skip if
  it is still dirty.**
- ~~**Criterion 2's cloud-runtime and export legs.**~~ **Closed 2026-07-30** (`382894e4`) — and the
  editor and browser legs it was measured against turned out to be uncovered too. See item 1.

### 2b. NDA-017 — §0 is done, §1 is Richard's and it blocks everything else

Added by the parallel session on 2026-07-30 (`d6db6f39`, `47c80295`), after this handover's first
draft — so it is absent from the sections above.

**§0 reproduced all four claims and the spec's mechanism held**, which is the first §0 in this phase
not to falsify its own task. Ten rows in
[`nda-017-signal-input-freshness.test.ts`](../../../packages/noodl-runtime/test/corpus/nda-017-signal-input-freshness.test.ts),
four `test.failing`. The one that matters is **row 4**: the Function node reproduces the
previous-cycle defect too, so the reporter's stated workaround (abandon Expression for Function)
bought nothing, and the remedy has to cover the whole twelve-family table.

**Do not start §2.** §1 is a decision for Richard — never-arrived detection (cheap, closes the seed
case) vs. an upstream-pending notion in the runtime (phase-sized, closes the *reported* case) vs.
making NDA-004 §3's completion-signal sequencing discoverable through docs and the semantic
validator. The spec recommends **A + C now, B as a separate decision**, and §0 added a constraint to
A that is written into the spec in place: the seed also reaches the graph with **no `Run` at all**,
by `connectInput` pushing `result`'s getter over the initial `cachedValue`, and a control-signal
check cannot see that route.

⚠️ **If you write rows anywhere in this class, read the frame note first** — it is in "Harness facts"
terms and it is the difference between measuring the defect and reporting it absent: `update()` is
synchronous, `settle()` yields, and a row written with `settle()` lets an async producer win the race.

### 3. ~~Catalog regeneration~~ — **DONE 2026-07-30** (`7e2cdac9`), see §0

Kept below only for the five-consumers note, which is still the rule. The rest is historical: the
debt is paid, both gates are green, and the "coordinate before running it" warning was resolved by
testing whether regeneration reproduced the other session's work rather than by waiting for them.

<details><summary>The original entry</summary>

### 3-old. Catalog regeneration — now the largest single owed item, and **still blocked**

⚠️ **Checked 2026-07-30 16:00 and it is not safe to run.** Both
`packages/noodl-types/src/node-catalog.json` and `node-catalog-enriched.json` are dirty with the
other session's Logic Builder work (`editorName: hidden` removed from two ports, the whole
`logic-builder` enrichment block rewritten, and a `workspace`/`generatedCode` parameter pair added
to `code-logic-builder-greeting`). Regenerating would clobber it. **Coordinate before running it** —
this needs the other session to land or drop its catalog changes first.

The debt has grown for four more tasks. It owes, on top of
everything the previous handover listed: **`packing`** (Columns, NDA-006 §4), **`sizing`**,
**`mediumBreakpoint`/`mediumLayout`/`smallBreakpoint`/`smallLayout`** (NDA-006 §3), **`stackPolicy`**
and **`Dismissed`** (Show Popup), the six controls' `deprecated: true` (NDA-011), and — new
2026-07-30 — **`taskStartInput`/`taskSuccessOutput`/`taskFailureOutput`/`taskErrorOutput`** on
`RunTasks` (NDA-009 §2). Read the five-consumers note under "Rules that will bite you" before
running it.

⚠️ **NDA-005 raised the stakes on this too.** 61 port descriptions were written 2026-07-30 and
**none of them is visible to the catalog, the semantic validator or the AI authoring loop until
regeneration runs** — which is three of the four reasons NDA-005 exists. Coverage is 5.4% on paper
and a projected 41.2% in the source. `scripts/node-audit/register.js` reads the catalog, so the
number cannot move until then either.

⚠️ **The RunTasks four are not just debt, they are a criterion.** NDA-009's criterion 4 — "the
semantic validator can check the Run Tasks contract" — is what those ports are *for*, and
`nonexistentPort` reads the catalog. Until regeneration runs, that criterion is built and not
provable. It is also the reason the ports are static rather than the enums the spec asked for; the
whole argument is in the spec under §2 and in `runtasks.ts`'s comment on `taskStartInput`.

~~**`NODE-REGISTER.md`'s `Mute?`/`Fail?` columns are wrong until this runs.**~~ Regenerated
2026-07-30; the columns are current.

</details>

### 4. One new defect, filed and deliberately not fixed

**Two creatable nodes read "Delete Record"** — `DeleteDbModelProperties` (the Parse-wire family) and
`noodl.byob.DeleteRecord` (the BYOB family), same label, same category, neither deprecated. Found by
checking NDA-011's criterion 3 against the *whole registry* rather than the six nodes its spec named:
grouping all 156 registered types by picker label leaves eleven duplicated labels, ten of which are a
deprecated node shadowing its replacement, and this is the only one with two live entries. The rest of
the two record families were named to avoid exactly this ("Create New Record" vs "Create Record",
"Query Records" vs "Query Data"); delete is where the disambiguating word ran out.

**It needs Richard, not a patch:** either the Parse-wire or the BYOB family gives up the plain label,
and which family is canonical is the question WF-007 left open. Written up in `FINDINGS.md`.

### 5. Then Tier 3

**NDA-005** (port docs — batch with NDA-012), ~~**NDA-009 §1/§2/§3**~~ (**all done 2026-07-30**;
only §4, a design question, remains — and it is now cheaper than the spec assumed, because §2 gave
the node three named ports a card summary could render), **NDA-010 §1** (re-scoped in place; do not
start from the spec body), and **NDA-012**, which is 1 of 17 categories. NDA-012's Data and Cloud Services worksheets were the specced input to
NDA-004 §2 — run them for the *other eleven* checks now, not for the failure question, which the
triage covered.

## Parked / later

Everything that was on this list is now either done or moved into "The work, in order" above. What
remains parked:

- **NDA-010 §1 — re-scoped, do not start from the spec body.** Its premise is partly stale:
  `showpopup.ts` already derives typed `popupParam-*` from the target component's input ports
  and `closeResult-*`/`closeAction-*` from its Close Popup nodes. The real gaps are the hand-typed
  `results`/`closeActions` on the *Close Popup* side and results being untyped (`*`). The correction
  is written into the spec in place.
- **An `inline` icon set is declarable but not installable** (NDA-007). §1's union renders all three
  kinds and §2/§3 install `font` and `sprite`; `inline` is deferred with a reason, not skipped —
  previewing one means putting its markup into the *editor's own* document, which is a different
  trust question from putting it in the app's. If it is picked up, the registration-time scrub that
  `ICON-SOURCE-MODEL.md` calls for becomes possible for the first time, because an inline set is the
  only installable kind that would *store* markup.

Done since the last handover and struck from this list: ~~NDA-010 §3~~ (`c8c26382`), ~~NDA-011~~
(`069621be`), ~~NDA-006 slice 4~~ (`b33b1b3e`), ~~NDA-007 §2–3~~ (`899ab676`).

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

- **An inline style is a *value* on the client and a *declaration list* on the server, and CSS
  repairs one but not the other.** React sets each property through the CSSOM, where a value is
  parsed in isolation and an unterminated block is closed at end-of-input — so
  `calc(100% + (0px)` is valid, renders correctly, and serialises back looking fine. `renderToString`
  emits the whole object as one `style` attribute, where the same unclosed block swallows the `;`
  and **every declaration after it**. Which ones are lost depends on key order in the style object,
  so the assertion to write is *parenthesis balance*, not the literal string. One character; the
  whole of every Columns node's SSR/SSG output.
- **`if (context.editorConnection)` is always true, in every runtime.** `NoodlRuntime` constructs one
  unconditionally and its own comment says it "act[s] as a no-op" when deployed. Anything branching
  on its *presence* has one live branch. The discriminators that work: `runningInEditor` (false in
  deployed browser/SSR/SSG, but **true in a deployed cloud function**, which never passes
  `runDeployed`), `editorConnection.isConnected()` (deterministically false with no socket), and
  `editorConnection.runtimeType` (`'browser'` vs `'cloud'`). This is also the shape to check the next
  time a comment claims something is inert when unused — that one was half true for years.
- **A criterion can be met through a surface the author has to opt into.** NDA-004 criterion 2 asked
  for a raised error to be observable in four runtimes. In the deployed browser build and in SSG it
  *was* — through an `On App Error` node the fixture happened to contain. The default channel, which
  is what an ordinary app has, produced nothing at all in either. Check a criterion through the path
  a project gets **without doing anything**, not through the one your fixture was built to exercise.
- **The SSG prerender reads its graph from `ssg.js`, not from `public/`.** The export JSON is
  spliced into `ssg.js` at deploy time (`{{#export#}}`); `public/index-<hash>.js` is the *browser*
  copy. Editing the latter to set up a prerender experiment changes the hydrated page and nothing
  the prerender sees — and the run completes cleanly, so the only tell is that your change had no
  effect.
- **`EventSender` has no `off`.** It has `on`, `removeListenersWithRef` and `removeAllListeners`
  only. Unregistering one callback means the ref-keyed path, whose listeners live in a `Map` that
  `emit` walks with `for…of` — the banked silent-transpile trap. Prefer designing so a stale
  listener is *harmless* (re-read the state on every call) over reaching for a removal that does not
  exist.
- **`graph-harness` never calls a node module's `setup`**, and says so in its own comment. Anything
  in `setup` — every editor-time dynamic port and every editor-time warning in the library — is
  untested by the corpus unless you drive `setup` yourself against a fake graph model. It is cheap;
  NDA-009's J-rows are the worked example.
- **Reaching editor internals from CDP: use the webpack chunk registry.** Nothing in the compilation
  or project-model layer is on a global, and Node's `require` cannot load a webpack module. In dev
  the module ids are source paths:
  `self.webpackChunknoodl_editor.push([['x'],{},r => rq = r])`. Ask for modules by **exact path** —
  a regex for `projectmodel` matches `LessonsProjectModel.ts` first.
- ⚠️ **The session scratchpad can be cleared mid-session.** Backups of files you are about to revert
  belong somewhere you control, or in a commit. This session lost the `VerifyFix4` Hello World
  backup and three deploy trees that way; nothing important, because the code was already committed,
  but the reverts would have been unrecoverable a few minutes earlier.

- **The editor's jasmine suite is a barrel of explicit exports, so a new test file does not run.**
  `tests/index.ts` → `tests/utils/index.ts` → `export * from './yourfile.test'`. Add a spec file
  without registering it and the suite reports **the same total, 0 failures**, having executed none
  of it. The detection rule is the reusable part: **a run that adds rows and does not move the total
  is a discovery failure, not a passing suite.** Same shape as the phase's own "testing a helper is
  not testing that anything calls it", one layer out — writing a test is not registering it.
- **A banked measurement technique belongs to a *question*, not to a subject.** The per-instance
  `input-<guid>` class is the right witness for "did this node survive" (NDA-008) and a **false pass**
  for "did React re-mount this component" (NDA-006 §2): the guid is minted in the node's
  `initialize()`, and a remount does not recreate the node. Reconciliation is only observable as **DOM
  element identity** — capture references before the mutation and compare with `===`. Carrying a
  technique to a neighbouring question is how you get a green that means nothing.
- **An `<svg><use href>` that fails renders nothing and says nothing.** No console error, no network
  entry to notice, just an empty box the size you asked for. Two ways to get there: the target id is
  not in the document *yet* (it does not retry when it arrives), or the reference is external and the
  document is a `file://` page, which Chromium treats as cross-origin. The only cheap witness that a
  glyph actually painted is a **non-zero `svg.getBBox()`**.
- **An early `return null` in a React component is a time bomb once the component grows hooks.**
  `Columns` opened with `if (!props.children) return null;` ahead of every hook, so deleting a node's
  last child changed the hook count and React threw — and live graph editing deletes children. It
  reads as defensive code. Worth grepping for.
- **A criterion about the *registry* has to be checked against the registry.** NDA-011 criterion 3
  said no two nodes should read the same in the picker, and was verified against the six nodes its
  spec named. One `reduce` over `NodeLibraryData.nodetypes` in the running editor finds eleven
  duplicated labels and the one pair that is still live.
- **Do not return a node view's `.type` from a CDP `eval`.** It serialises the entire node definition
  *and the project graph reachable from its listeners* — tens of thousands of characters for what you
  wanted to be one string.

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
