# Phase 30 — next session

**Written 2026-08-01 (eighth session of the day), current to `1114038a`.** Work on `cline-dev` in
`/Users/richardosborne/vscode_projects/OpenNoodl`, commit directly to it, **explicit pathspecs on
every commit**, Claude co-author line at the end of each message.

⚠️ **If you write a handover, overwrite this file. Do not add a sibling.** Two files with the same
job is how one of them goes stale unnoticed, which has already happened once in this phase.

⚠️ **If HEAD has moved past `1114038a`, prefer PROGRESS.md's newest entries to this file** — but
verify PROGRESS.md is itself current before trusting it. Both its halves (the task table *and* the
Log) are current as of this commit; stream C once updated one and not the other and the file
disagreed with itself for a whole session.

## §0 — the state, re-derived today

| | |
|---|---|
| NDA-012 audit | ✅ **COMPLETE — 17 / 17 categories, 136 of 151 nodes**, twelve checks each |
| NDA-012 remediation | ✅ **Visual: 32 of 47 in-scope ⚠️ cells closed. 15 remain and not one is this phase's** |
| **NDA-012 live QA** | ✅ **Streams C and D driven in the editor this session — all eight claims hold** |
| **NDA-017** | ✅ **CLOSED — all six criteria**, criterion 6 landed this session |
| Gates | viewer jest **579**, runtime **1,758 / 13 skipped**, **editor jasmine 2007 / 0**, all four catalog gates exit 0 |
| Typechecks | viewer clean; root **18 errors, all `TS2307`, all `@noodl-versioning`** — pre-existing and environmental (that package is not built in this checkout) |

⚠️ **The editor jasmine baseline in the last handover was stale and its reasoning was wrong.** It
said 1,894, and that re-running was unnecessary because "nothing since has touched
`packages/noodl-editor/src`". `git log --since=... -- packages/noodl-editor` refutes that in one
line — NDA-017 §2, the whole BCN batch and the `shortDesc` deletion all landed there. Re-measured:
**2007 / 0**. Nothing was lost because it was green, but do not carry a "nothing has touched X"
claim forward without running the command.

**Every number is reproducible.** The cell count comes from the worksheet, not a tally beside it:

```bash
awk '/^## In scope/{f=1} /^## Out of scope/{f=0} f' \
    dev-docs/tasks/phase-30-node-library-audit/audit/visual.md \
  | grep -E "^\| (A1|A2|A3|G1|B1|B2|B3|D1|E1|F1|H1) \| ⚠️" \
  | sed -E 's/^\| ([A-Z0-9]+) \|.*/\1/' | sort | uniq -c | sort -rn
```
→ `7 B3`, `4 B1`, `2 E1`, `1 F1`, `1 B2` = **15**.

### Where the 15 remaining cells live — **none is a code change this phase can make**

| Cells | Owner | Note |
|---|---|---|
| 7 `B3` + 4 `B1` | **`ERG-001`** (phase 35) | Outcome ports as one collision sweep. Adding any one alone half-builds the contract |
| 2 `E1` (Dropdown, Repeater) | **`NDA-014`** | `array` casts only to `collection` — the **typecast table's** property, not these nodes' |
| 1 `B2` (`Page`) | **Richard** | §2.1 |
| 1 `F1` (`Radio Button`) | **design** | §2.2 |

✅ `A1`, `A2`, `A3`, `D1`, `G1`, `H1` closed for the whole category.

### The known-red register is still **4 rows**

⚠️ `test.failing` reports as *passed*, so maintain this by grep, never by memory:

```bash
grep -rn "test.failing(" packages/noodl-runtime/test packages/noodl-viewer-react/tests
```

`nda-012-cloud-services-category.test.ts` M1/M2/M3 (`ConfigService.getConfig` latches a rejection for
ever; `clearCache()` clears the other field) and `nda-012-logic-builder.test.ts` L12 (a port cannot
change kind on a live node). Both filed deliberately.

The 13 skipped runtime rows are not debt: 7 in `agent-live-endpoint.test.ts`, 6 in DEBT-014's
`model-registry-lifetime.test.ts` (`--expose-gc`). Enumerate rather than wonder — `npx jest --json`,
filter `status !== "passed"`.

## §1 — what is actually left

**The two largest items in the last handover are done.** What remains:

1. **The three Visual prose defects** — ⚠️ **ask first, see §2.** `DV-vi` (`Slider`'s drifted private
   `addBorderInputs`, incl. `Slider.tsx:45`'s stray assignment writing four invalid CSS keys),
   `DV-vii` (`Page`'s dead `Title`/`Url Path` — **also `Page`'s `B2`**, blocked on §2.1), `DV-ix`
   (`Component Stack` derefs `pages[0].id` behind a `length === 0` guard, so a *malformed* `pages`
   throws). ⚠️ **"No ⚠️ cell" is not "nothing open".**
2. **The live-QA tails on NDA-002 / NDA-013 / NDA-014** — ⚠️ **status genuinely unclear; re-derive,
   do not inherit.** Their task rows say *"live QA pending"* while the Audit-coverage table says the
   2026-07-29 pass verified Tier 1 in the running editor. One is stale and the register cannot say
   which. **This is now the only unresolved bookkeeping item in the phase.**
3. **The seven questions in §2**, none of which blocks anything.
4. **Handing `ERG-001` (11 cells) and `NDA-014` (2 cells) their inputs** — both specced, neither is
   phase 30's.

**There is no remaining code change in Visual that this phase owns and can make unilaterally.**

## §2 — what needs Richard. Surface it; do not decide it.

1. ⚠️ **`Page`'s `Title` port is dead, and fixing it is an ownership decision.** `getTitle()` /
   `getUrlPath()` are called by nothing, which is also the mechanism behind `Page`'s `B2` (the cell
   had been filed with **no mechanism at all**). The blocker: **the Router already sets the document
   title from its own copy** (`router.tsx:428`, and again on navigate — *confirmed live this
   session*: an in-place title edit plus `Reset` moved `document.title`), so if the Page node called
   `Noodl.SEO.setTitle` they would fight, Router winning on every navigate. *Who owns the document
   title — the Page node or the Router?* One line either way; not a call to make quietly.
2. **`Radio Button` cannot name its group.** Class F's remedy is *an explicit target* **and** *a
   visible indication of what was resolved*. The second is built and live-verified. The first needs a
   name→group registry like `Component Stack`'s and `Page Router`'s — which is exactly why both of
   *their* `F1` cells pass. A design change rather than a remediation.
3. ⚠️ **NDA-017 §2 has one site that does not follow the decision word for word.** The *definition*
   port (`expression`, `functionScript`) keeps the old `!isInputConnected('<control signal>')` guard.
   Making it unconditional is the literal reading of "`Run` is purely additive", and it would **run
   every `Run`-driven script once at load, including the ones that POST.** One line; a real
   behaviour change to shipped projects.
4. **`Value Changed` cannot see an Object or Array being edited.** Needs a decision, not a patch.
5. **NDA-010 §1 item 1** — should a popup's Component Outputs *be* its close results. ⚠️ Re-read
   `showpopup.ts` first: `:129-177` already derives typed `popupParam-*` and
   `closeResult-*`/`closeAction-*`, so §1's premise is partly stale. The real gaps are the
   hand-typed `results`/`closeActions` on the *Close Popup* side, and results being untyped (`*`).
6. **The picker-integrity question — a missing *check*, not a bug.** `SignInWith` and
   `RequestMagicLink` creatable but **unlisted**; four password/verify nodes **listed but not
   creatable**; `On App Error` registered and working but absent; `Page Inputs` in the picker with no
   connectable ports. **Each was found by a different accident and none by any check this phase runs.**
7. **No pickable node can make an outgoing HTTP request from a cloud function.** `net.noodl.HTTP` is
   `availableIn: ['browser']`; `REST2` is cloud-capable but deprecated *and* filtered from the
   picker; `noodl.cloud.request` is the *incoming* trigger. The hole **predates** the `inNodePicker`
   fix, so that fix made it discoverable rather than real.

## §3 — carry these; they were learned the hard way

### The ones this session added

- ⚠️ **A fake is a claim about the shape of the real collaborator, and nothing checks that claim.**
  The corpus rows for `Scroll To Element` were green and always had been, because they handed it
  `{ getRef: () => ({ current: el }) }` — an accessor **no real node populates**. They tested the
  reason-string logic perfectly and the resolution not at all. When a fake stands in for a runtime
  object, name the accessor the runtime *actually* populates and leave the others **present and
  empty**, so a regression reddens instead of quietly passing. `DV-xvii`.
- ⚠️ **A stable wrong answer is not a timing bug.** `Scroll To Element` reported "it may not be
  mounted", which reads like a diagnosis and sent the first read straight at mount ordering. What
  settled it was asking the target for `getRef()` **after the page had been idle for minutes** and
  getting `{current: undefined}` still. *Check the settled state before theorising about frames.*
- ⚠️ **Fixing the silence is what makes the next defect visible — and it may name the wrong cause.**
  `DV-xvii` needed *both* of this category's own fixes to land before it could produce any symptom:
  `withInnerComponent` to stop the action being dropped, then `B2` to stop the resolution failing
  silently. Expect a class of defect to surface *behind* every diagnosis this phase adds.
- ⚠️ **Design the live-QA witness to fail differently from the defect, or it measures nothing.** Two
  of this session's first witnesses were worthless and both looked fine: the lone Radio Button had a
  `Value` (the old bug needed `undefined === undefined`), and the Video failure counter would have
  read `1` either way — `onPlaybackFailure` fires from the element's own `error` event as well as
  from a rejected `play()`, *and* `play()` never reaches `startPlayback` without a `canplay` an
  unplayable source never sends. **Before believing a green live reading, say out loud what it would
  read under the old code.**
- 💡 **`wantToPlay` is the witness for Video's queue, not any output.** It is set by `play()`
  unconditionally and by nothing else. Reach it through the React fiber → `noodlNode` →
  `innerReactComponentRef`.
- 💡 **Instrument the component *prototype*, not the instance, when you need to observe a mount.**
  The instance is recreated; the prototype survives navigation. Wrap, then navigate away and back.
- ⚠️ **A published warning count is a cheap, exact assertion.** The chip read `3` at load with
  exactly three expected raises, and `4`/`5` at the right moments. Predict the number before opening
  the panel.
- ⚠️ **The editor's shutdown save persists live model edits into the fixture.** Parameters set via
  `__nodeGraphEditor.model` are written to `project.json` when the app stops. Regenerate a fixture
  before reusing it, or know what you changed.
- ⚠️ **A validator rule written to its own spec's literal wording can be unbuildable.** NDA-017
  criterion 6 asks for "a `Run` driven by something other than its inputs' producers"; that flags a
  Button driving `Run` with Text Input values — the canonical **correct** graph, and the reporter's
  own. **Measure a candidate rule against the false-positive corpus before writing it up**, and make
  the controls graphs the *rejected* reading would have flagged.
- 💡 **Derive a rule's node set from the catalog, not a list in the rule.** `runOnChange-*` ports are
  in the generated catalog, so `catalog:check` keeps the validator and the runtime honest for free.

### About this phase's own instruments

- ⚠️ **A cell's check letter is where someone filed it, not what it is.** The `A3` pre-mount class had
  three instances; one was filed under `B1`. **When you bank a lesson, bank the query.**
- ⚠️ **A worksheet cell can be confidently wrong about which half is broken** — `Group`'s `A3`,
  `Page Router`'s `A2`. Making the two halves "agree" would have closed both and fixed nothing.
- ⚠️ **When a cell names a *comparison* as the defect, check that the two things compared are two
  things.** `Page Router` held a *reference* to the very index entry it compared against.
- ⚠️ **A recorded consequence can outlive the fix that changed it, including one from your own phase.**
  Re-derive the mechanism from the code before fixing what a cell says.
- ⚠️ **A fix that changes no behaviour can still be a fix** (`Video`'s ports, read only by the panel —
  which is where the wrong affordance was drawn).
- ⚠️ **A grepped table of "the same idiom" may not be.** NDA-017's spec listed twelve families sharing
  one guard; only five suppress a value *setter*.
- ⚠️ **`EMPTY-VALUE-CONTRACT` has two answers and the port's *type* picks.** No representable empty
  state → **abstain**; has one → **clear**.
- ⚠️ **Only a date or commit stamp indicates currency.** "Read to the end of the section" does not
  help when the stale sentence *is* the end of the section.

### About writing rows that measure something

- ⚠️ **Run every new row against the OLD code first, and predict which rows a revert reddens.** Nine
  reverts across stream D and this session, nine correct predictions. **Say the number out loud.**
- ⚠️ **A row that stays green under revert is not necessarily a bad row** — it may guard an
  *implementation choice* rather than the defect.
- ⚠️ **A control can prove nothing in two distinct ways**: the code under test never ran, *or* both
  outcomes coincide in the fixture's state. The *pair* is the instrument.
- ⚠️ **A corpus row sets a parameter on a graph that is already built. A saved project applies it
  *first*, while the graph is still being constructed.** If a feature is configured by a parameter,
  one row must load it from `data.components[].nodes[].parameters` — **and the live fixture should
  author it as a saved parameter too**, which is how Columns' `D1` got its strongest reading.
- ⚠️ **A declared `default` never runs its setter** (A-D1), so the panel and the runtime read
  different defaults and **both** must be declared.
- ⚠️ **`update()` is synchronous and `settle()` yields**, so a row written with `settle()` reports the
  whole signal-freshness defect class as absent.
- ⚠️ **`flagOutputDirty` on a `type: 'signal'` output sends a *value*, not a pulse** (`node.ts:647`).
- ⚠️ **The Group's React component pulls in three ES-module scroll plugins ts-jest will not
  transform.** Mock the three **local** modules under `src/components/visual/Group/scroll-plugins/…`
  — *not* the `@better-scroll/*` packages, which are not resolvable from a test.
- ⚠️ **`Utils.updateStylesForClass` returns early when `document` is undefined**, and the viewer
  corpus runs `testEnvironment: node`. The same absence makes `instanceof` against a DOM global a
  **`ReferenceError`, not `false`** — guard with `typeof X !== 'undefined'`, and guard it at the
  shared accessor rather than at one call site.
- ⚠️ **Run each jest suite from inside its package.** From the repo root the root babel config picks
  the file up and `import type` is a syntax error.
- ⚠️ `npx jest 2>&1 > file` loses stderr (wrong redirect order). Use `> file 2>&1`.
- ⚠️ **The editor jasmine suite is a barrel of explicit exports** (`tests/index.ts` →
  `tests/validation/index.ts` → the spec). An unregistered spec **does not run** and the total does
  not move. Adding a `describe` to an already-registered file is free.
- ⚠️ **A corpus node id of `'set'` fails graph construction** — `Collection` patches
  `Array.prototype.set` as read-only.

### Live QA

- ⚠️ **Read runtime failures out of the editor's warnings panel, not the viewer console.**
  `npm run cdp -- click "[class*=WarningsChip]"` then read `body.innerText`.
- ⚠️ **A connection to a port that does not exist is dropped in total silence.** Check port names
  against the catalog before believing a null reading.
- ⚠️ **The preview runs the bundle it loaded.** A viewer source change does **not** hot-reload into an
  open preview. Wait for the served bundle
  (`until curl -s localhost:8574/noodl.viewer.js | grep -q '<your change>'; do sleep 5; done`) and
  then **restart the stack** — `window.__yourGlobal` surviving is the tell that it did not reload.
- **Reach a runtime node from the preview through the React fiber.** Walk `el.__reactFiber$…` up
  `.return` to `memoizedProps.noodlNode`, then `nodeScope.getNodeWithId('<id>')`.
- 💡 **Reach the whole project model from the editor**: `__nodeGraphEditor.model.owner.owner` is the
  project — `.components.find(c => c.name === '/#__page__/Detail').graph.findNodeWithId(id)`. That
  edits a component the canvas is **not** showing, which `__nodeGraphEditor.model` alone cannot.
- ⚠️ **`m.nodeMap` is empty; use `m.findNodeWithId(id)`.** And `g.selectNode` wants a node *view* —
  `g.findNodeWithId(id)` returns the view.
- **Register a fixture** by patching `~/Library/Application Support/NodeGX/recently_opened_project.json`
  **with the app stopped**. Four generators in `scripts/nda-live-qa/`; read each one's header table
  before changing a graph.
- **CDP:** `--target=editor` for the project window, `--target=dashboard` for the launcher,
  `--target=viewer` for the preview. **Wrap every eval in an IIFE.** Never return a node view's
  `.type`. Never `cdp reload`. `cdp click` takes only a selector and hits the **first** match — for
  the second of two identical elements use a structural selector
  (`div > *:nth-child(13).ndl-controls-button` worked).
- ⚠️ **A dev launch rewrites the `agent-chat` example project** on open *and* shutdown — check
  `git status` after every editor session.
- **Stop the stack when done** (`npm run dev:stop`).

### Shipping and hygiene

- **Catalog:** `node scripts/node-catalog/generate.js`, `node scripts/node-catalog/merge.js`,
  `npm run cloud-library:generate`, then `catalog:check`, `catalog:merge:check`, `catalog:examples`
  **and `cloud-library:check`** — the first can pass while the others are stale.
- ⚠️ **Never `git checkout <path>` to undo a probe.** Copy the file aside first and `cp` it back.
- **One worktree.** An uncommitted file is orphaned work, not another session's.

## §4 — where phase 30 ends

Visual remediation is done to the boundary of what this phase owns, NDA-017 is closed, and the owed
live QA is discharged. What is left is §1's four items — of which only **§1.2** (the NDA-002 /
NDA-013 / NDA-014 live-QA tails, status genuinely unclear) is work rather than a question, and it is
bookkeeping rather than code.
