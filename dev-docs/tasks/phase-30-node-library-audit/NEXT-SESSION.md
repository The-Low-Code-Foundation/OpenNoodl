# Phase 30 — next session

**Written 2026-08-01 (seventh session of the day), current to the stream-D commit.** Work on
`cline-dev` in `/Users/richardosborne/vscode_projects/OpenNoodl`, commit directly to it, **explicit
pathspecs on every commit**, Claude co-author line at the end of each message.

⚠️ **If you write a handover, overwrite this file. Do not add a sibling.** Two files with the same
job is how one of them goes stale unnoticed, which has already happened once in this phase.

⚠️ **If HEAD has moved past the stream-D commit, prefer PROGRESS.md's newest entries to this file.**
But ⚠️ **verify that PROGRESS.md is itself current before trusting it**: stream C updated its
NDA-012 *task-table row* and never added a *Log* entry, so for one whole session the two halves of
that file disagreed about how far the phase had got. Both halves are current as of stream D.

## §0 — the state, re-derived today rather than inherited

| | |
|---|---|
| NDA-012 audit | ✅ **COMPLETE — 17 / 17 categories, 136 of 151 nodes**, twelve checks each |
| NDA-012 remediation | ✅ **Visual: 32 of 47 in-scope ⚠️ cells closed. 15 remain and not one of them is this phase's to fix** — see the table below |
| **NDA-017** | ✅ **CLOSED** — only criterion 6's semantic-validator half is open |
| Gates | viewer jest **577**, runtime **1,758 pass / 13 skipped**, cloud 57, all four catalog gates exit 0, Visual C1 **1228/1228** |
| Root typecheck | ⚠️ **18 errors, all `@noodl-versioning` module-resolution, identical at HEAD** — pre-existing and environmental (that package is not built in this checkout). The previous handover called both typechecks clean; it was wrong, or the checkout differed. The viewer typecheck is genuinely clean |
| Editor jasmine | **1,894 / 0**, last measured 2026-07-30 — **still not re-run and still correct not to be**: nothing since has touched `packages/noodl-editor/src`. Re-run the moment you do (`cd packages/noodl-editor && npm run test:ci`, ~6 min, background it) |

**Every number is reproducible.** The cell count comes from the worksheet, not from a tally beside it:

```bash
awk '/^## In scope/{f=1} /^## Out of scope/{f=0} f' \
    dev-docs/tasks/phase-30-node-library-audit/audit/visual.md \
  | grep -E "^\| (A1|A2|A3|G1|B1|B2|B3|D1|E1|F1|H1) \| ⚠️" \
  | sed -E 's/^\| ([A-Z0-9]+) \|.*/\1/' | sort | uniq -c | sort -rn
```

### Where the 15 remaining cells live — **none is a code change this phase can make**

| Cells | Owner | Note |
|---|---|---|
| 7 `B3` + 4 `B1` | **`ERG-001`** (phase 35) | Outcome ports — `Done`/`Unchanged`/`Failure`/`Completed` as one collision sweep across the Visual family. Adding any one alone half-builds the contract |
| 2 `E1` (Dropdown, Repeater) | **`NDA-014`** | `array` casts only to `collection`. That is the **typecast table's** property, not these nodes'. NDA-014 is Tier 2, 1–2 weeks, flagged expensive to reverse |
| 1 `B2` (`Page`) | **Richard** | §2.1 below |
| 1 `F1` (`Radio Button`) | **design** | §2.2 below |

✅ **`A1`, `A2`, `A3`, `D1`, `G1` and `H1` are closed for the whole category.**

### The known-red register is still **4 rows**

⚠️ **`test.failing` reports as *passed***, so this list is maintained by grep, never by memory:

```bash
grep -rn "test.failing(" packages/noodl-runtime/test packages/noodl-viewer-react/tests
```

| File | Rows | Why red |
|---|---|---|
| `nda-012-cloud-services-category.test.ts` | M1, M2, M3 | `ConfigService.getConfig` latches a rejection for ever and `clearCache()` clears the other field. Filed, not fixed, deliberately |
| `nda-012-logic-builder.test.ts` | L12 | A port cannot change kind on a live node (`deregisterInput` throws on a connected port). Filed |

### The 13 skipped runtime rows are unchanged and are not debt

7 are `agent-live-endpoint.test.ts`; 6 are DEBT-014's `model-registry-lifetime.test.ts`
(`--expose-gc`). Enumerate rather than wonder: `npx jest --json` and filter `status !== "passed"`.

## §1 — do these, in this order

### 1. ⚠️ Live QA for streams C **and** D — the largest owed item in the phase

**Two full sessions of Visual fixes have never been driven in the editor**, and every one of them is
a viewer change, so **none of it reaches a deployed app** until
`npm run build --prefix packages/noodl-viewer-react` runs. `noodl.deploy.js` is gitignored and
nothing rebuilds it.

What to check, chosen because jest deliberately cannot make these claims:

| Claim | How |
|---|---|
| **Stream C** — a real React mount flushes the pre-mount queue | Fire `Play` on a Video inside a Page being navigated to; fire `Scroll To Element` on a Group inside a Repeater row being added |
| **Radio Button `Changed`** | Two radios in a group: clicking one fires `Changed` on **both** (the selected and the deselected); setting the *group's* `Value` from the graph fires neither |
| **Radio Button `F1`** | Drop a Radio Button **outside** any group — expect `radio-button/no-group` in the warnings panel, and the button to render **unchecked** |
| **Columns `D1`** | Type `1 a 1` into Layout String — expect two columns *and* a warning naming `"a"` and both counts |
| **Page Router `D1`** | Navigate to a page parameter containing a literal `%`. Before the fix this threw a `URIError`; it should now route |
| **Page Router `A2`** | Edit a page's path in the Pages list *without* re-adding it, then fire `Reset` — the router should rebuild |

⚠️ **Read runtime failures out of the editor's warnings panel, not the viewer console** — see §3.

### 2. NDA-017's last open half — the semantic validator

Criterion 6: *"the semantic validator flags the mis-sequenced graph"* — a `Run` driven by something
other than its inputs' producers. The port-docs half is done. The checkbox makes the mis-sequenced
graph much less costly but does not make it **visible**, so this is still worth building.

### 3. The three non-cell Visual prose defects — ⚠️ ask first (§4)

`DV-vi` (`Slider`'s drifted private `addBorderInputs`, incl. `Slider.tsx:45`'s stray assignment
writing four invalid CSS keys), `DV-vii` (`Page`'s dead `Title`/`Url Path` — **now also `Page`'s
`B2`**, see §2.1), `DV-ix` (`Component Stack` derefs `pages[0].id` behind a `length === 0` guard, so
a *malformed* `pages` throws). ⚠️ **"No ⚠️ cell" is not "nothing open".**

## §2 — what needs Richard. Surface it; do not decide it.

**Nothing here blocks §1.**

1. ⚠️ **`Page`'s `Title` port is dead, and fixing it is an ownership decision.** `DV-vii` says
   `getTitle()`/`getUrlPath()` are called by nothing. That is also the mechanism behind `Page`'s
   `B2` cell — the cell had been filed with **no mechanism at all**, and reading for one produced
   this. The blocker: **the Router already sets the document title from its own copy**
   (`router.tsx:428`, and again on navigate), so if the Page node called `Noodl.SEO.setTitle` they
   would fight, with the Router winning whenever it navigates. *Who owns the document title — the
   Page node or the Router?* One line of code either way; not a call to make quietly.
2. **`Radio Button` cannot name its group.** Class F's remedy is *an explicit target* **and** *a
   visible indication of what was resolved*. The second is built. The first needs a name→group
   registry of the kind `Component Stack` and `Page Router` have — which is precisely why both of
   *their* `F1` cells pass. Worth doing, and a design change rather than a remediation.
3. ⚠️ **NDA-017 §2 has one site that does not follow the decision word for word.** The *definition*
   port (`expression`, `functionScript`) keeps the old `!isInputConnected('<control signal>')` guard.
   Making it unconditional is the literal reading of "`Run` is purely additive", and it would **run
   every `Run`-driven script once at load, including the ones that POST.** One-line change; a real
   behaviour change to shipped projects.
4. **`Value Changed` cannot see an Object or Array being edited.** Needs a decision, not a patch.
5. **NDA-010 §1 item 1** — should a popup's Component Outputs *be* its close results. ⚠️ Re-read
   `showpopup.ts` first: `:129-177` already derives typed `popupParam-*` and
   `closeResult-*`/`closeAction-*`, so §1's premise is partly stale. The real gaps are the
   hand-typed `results`/`closeActions` on the *Close Popup* side, and results being untyped (`*`).
6. **The picker-integrity question — a missing *check*, not a bug.** `SignInWith` and
   `RequestMagicLink` creatable but **unlisted**; four password/verify nodes **listed but not
   creatable**; `On App Error` registered and working but absent; `Page Inputs` in the picker with
   no connectable ports. **Each was found by a different accident and none by any check this phase
   runs.**
7. **No pickable node can make an outgoing HTTP request from a cloud function.** `net.noodl.HTTP` is
   `availableIn: ['browser']`; `REST2` is cloud-capable but deprecated *and* filtered from the
   picker; `noodl.cloud.request` is the *incoming* trigger. The hole **predates** the `inNodePicker`
   fix, so that fix made it discoverable rather than real.

## §3 — carry these; they were learned the hard way

### The ones stream D added

- ⚠️ **When a cell names a *comparison* as the defect, check that the two things being compared are
  two things.** `Page Router`'s `A2` was filed as identity-versus-value; the router held a
  *reference* to the very index entry it compared against, so identity and value agreed and the
  implied one-character fix would have changed nothing. What was missing was a **snapshot** of what
  had been rendered. Second instance in this category, after `Group`'s `A3`. FINDINGS `DV-xiii`.
- ⚠️ **A recorded consequence can outlive the fix that changed it — including a fix from your own
  phase.** `Columns`' `NaN` column became a silent *drop* when NDA-006 added a finite-check;
  `Drag`'s `B2` had already been closed by stream B's `G1` fix and nobody re-read the cell.
  `DV-xiv`. **Re-derive the mechanism from the code before fixing what a cell says.**
- ⚠️ **`decodeURI` and `decodeURIComponent` are different functions and neither is idempotent.**
  `decodeURI` leaves the reserved set encoded and decodes everything else — so it turns
  `encodeURIComponent`'s `%25` back into a bare `%`, and the *next* `decodeURIComponent` throws
  `URIError`. Decode once, at the level that owns the delimiter, **after** the split. `DV-xv`.
- ⚠️ **`instanceof` against an undeclared global is a `ReferenceError`, not `false`.**
  `ref instanceof HTMLElement` threw wherever there is no DOM — on a node declaring SSR `safe`.
  Guard with `typeof HTMLElement !== 'undefined'`.
- ⚠️ **A truthy default on a React context makes "no provider" undetectable.**
  `createContext({...undefined fields})` is truthy, so `ctx ? ctx.selected === value : false` takes
  the first branch either way. Use `null`. This one had a visible consequence nobody had looked at:
  a groupless Radio Button rendered **permanently checked**.
- ⚠️ **`scrollIntoView` scrolls the nearest scrollable *ancestor*, so scrolling the wrong element
  never fails** — it moves a different container. Check `container.contains(element)`.
- 💡 **The corpus is the cheapest defect-finder in the phase.** Nine filed cells produced **four
  unfiled defects**, all found while writing rows for something else. Its two most productive
  properties are accidental: it runs without a DOM, and it forces someone to state what "working"
  means for a path nobody had stated it for. `DV-xvi`.
- **Route an editor-only `sendWarning` to the bus, but keep the `clearWarning`.** The bus has no
  un-raise, so without the clear a value that was briefly wrong while being typed leaves a warning
  for the session. And **one code per node-concern**: the bus keys the editor warning by `code`, so
  three ports raising the same code occupy one slot and fixing one clears the others' warning.
- **Dedupe per-item raises.** The editor's warning panel collapses by code; the `console.error`
  subscriber a deployed app uses does **not**. A 5,000-row Repeater would emit 5,000 lines.
- ⚠️ **A component method that reports a reason must return a *string*, and the node must check
  `typeof reason === 'string'`.** The existing premount-test fake returns `calls.push(...)` — a
  **number**, which is truthy. A check written as `if (reason)` raises spuriously against every
  existing fake.
- ⚠️ **`inputMappingScript` and friends are *dynamic* ports** — `setInputValue` on one that has not
  been through `registerInputIfNeeded` registers nothing, the setter never runs, and the row reads
  as "the fix does not work" while measuring nothing.
- 💡 **Real React effects can be tested in this package** even though `jest-environment-jsdom` is
  absent: construct `new JSDOM(...)`, assign `window`/`document`/`navigator`/`HTMLElement` and
  `IS_REACT_ACT_ENVIRONMENT` onto `globalThis`, then `createRoot` + `act` from `react`. Recipe in
  `nda-012-radio-button-group.test.tsx`. `renderToStaticMarkup` runs **no** effects.
- **NDA-005's C1 port-count pin covers the *Record family only***, not every node — which is why
  adding `Radio Button`'s `Changed` output tripped nothing. The catalog gates are what catch a new
  port; run all four.

### About this phase's own instruments

- ⚠️ **A cell's check letter is where someone filed it, not what it is.** The `A3` pre-mount class
  had three instances; one was filed under `B1`. **When you bank a lesson, bank the query.**
- ⚠️ **A worksheet cell can be confidently wrong about which half is broken** — `Group`'s `A3`,
  `Page Router`'s `A2`. Making the two halves "agree" would have closed both cells and fixed nothing.
- ⚠️ **A fix that changes no behaviour can still be a fix** (`Video`'s `boolean`+`valueChangedToTrue`
  ports, read only by the editor panel — which is where the wrong affordance was drawn).
- ⚠️ **A grepped table of "the same idiom" may not be.** NDA-017's spec listed twelve families
  sharing one guard; only five suppress a value *setter*.
- ⚠️ **A summary of a worksheet must be derived from the worksheet**, and **a low find rate needs a
  cause before it is evidence.**
- ⚠️ **`EMPTY-VALUE-CONTRACT` has two answers and the port's *type* picks.** No representable empty
  state → **abstain**; has one → **clear**.
- ⚠️ **Only a date or commit stamp indicates currency.** "Read to the end of the section" does not
  help when the stale sentence *is* the end of the section.

### About writing rows that measure something

- ⚠️ **Run every new row against the OLD code first, and predict which rows a revert reddens before
  running it.** Seven reverts in stream D, seven correct predictions (1, 2, 3, 1, 2, 2, 3). **Say
  the number out loud; being one out is information.**
- ⚠️ **A row that stays *green* under revert is not necessarily a bad row.** Stream D's non-ASCII
  URL row passes against the old code by design — it guards an *implementation choice* (deny-list
  over allow-list) rather than the defect, and it is the row that changed the implementation.
- ⚠️ **A control can prove nothing in two distinct ways**: the code under test never ran, *or* both
  outcomes coincide in the fixture's state. The *pair* is the instrument.
- ⚠️ **A corpus row sets a parameter with `setInputValue` on a graph that is already built. A saved
  project applies the parameter *first*, while the graph is still being constructed.** **If a
  feature is configured by a parameter, one row must load it from
  `data.components[].nodes[].parameters`.**
- ⚠️ **The affordance can be wrong while the behaviour is right** — a declared `default` never runs
  its setter (A-D1), so the panel and the runtime read different defaults and **both** must be
  declared.
- ⚠️ **`update()` is synchronous and `settle()` yields**, so a row written with `settle()` reports
  the whole signal-freshness defect class as absent.
- ⚠️ **`flagOutputDirty` on a `type: 'signal'` output sends a *value*, not a pulse** (`node.ts:647`).
- ⚠️ **The Group's React component pulls in three ES-module scroll plugins ts-jest will not
  transform.** Mock the three **local** modules under
  `src/components/visual/Group/scroll-plugins/…` — *not* the `@better-scroll/*` packages, which are
  not resolvable from a test.
- ⚠️ **`Utils.updateStylesForClass` returns early when `document` is undefined** and the viewer
  corpus runs `testEnvironment: node`.
- ⚠️ **Run each jest suite from inside its package.** From the repo root the root babel config picks
  the file up and `import type` is a syntax error.
- ⚠️ `npx jest 2>&1 > file` loses stderr (wrong redirect order). Use `> file 2>&1`.
- ⚠️ **The editor jasmine suite is a barrel of explicit exports.** An unregistered spec **does not
  run** and the total does not move.
- ⚠️ **A corpus node id of `'set'` fails graph construction** — `Collection` patches
  `Array.prototype.set` as read-only.
- ⚠️ **`defineNode` is idempotent and its prototype methods are writable**, as of 2026-08-01.

### Live QA

- ⚠️ **Read runtime failures out of the editor's warnings panel, not the viewer console.**
  `npm run cdp -- click "[class*=WarningsChip]"` then read `body.innerText`.
- ⚠️ **A connection to a port that does not exist is dropped in total silence.** **Check port names
  against the catalog before believing a null reading.**
- ⚠️ **The preview runs the bundle it loaded.** `curl localhost:8574/noodl.viewer.js | grep` to see
  what is actually served; restart the stack rather than touching a parameter.
- **Reach a runtime node from the preview through the React fiber.** Walk `el.__reactFiber$…` up
  `.return` to `memoizedProps.noodlNode`, then `nodeScope.getNodeWithId('<id>')`.
- **`__nodeGraphEditor.model` parameters can be set live and DO reach the viewer.** `null` is
  delivered as `null`; only `undefined` queues the port default.
- ⚠️ **`g.selectNode` wants a node *view*, not a model** — `g.findNodeWithId(id)` returns the view.
- **Register a fixture** by patching `~/Library/Application Support/NodeGX/recently_opened_project.json`
  **with the app stopped**. Three generators exist in `scripts/nda-live-qa/`.
- **CDP:** `--target=editor` for the project window, `--target=dashboard` for the launcher,
  `--target=viewer` for the preview. **Wrap every eval in an IIFE.** Never return a node view's
  `.type`. Never `cdp reload`. `cdp click` takes only a selector and hits the **first** match.
- ⚠️ **A dev launch rewrites the `agent-chat` example project** on open *and* shutdown — check
  `git status` after every editor session.
- **Stop the stack when done** (`npm run dev:stop`).
- ⚠️ **Re-verify a citation before working from it, even one written the same day.**

### Shipping and hygiene

- **Catalog:** `node scripts/node-catalog/generate.js`, `node scripts/node-catalog/merge.js`,
  `npm run cloud-library:generate`, then `catalog:check`, `catalog:merge:check`, `catalog:examples`
  **and `cloud-library:check`** — the first can pass while the others are stale.
- ⚠️ **Never `git checkout <path>` to undo a probe.** Copy the file aside first and `cp` it back.
- **One worktree.** An uncommitted file is orphaned work, not another session's — read it, then
  commit or discard deliberately.

## §4 — where phase 30 ends

**Visual remediation is done to the boundary of what this phase owns.** What is left, in full:

1. **Live QA for streams C and D** (§1.1) — the largest owed item, and the only one that is pure
   execution.
2. **NDA-017's validator half** (§1.2).
3. **The three Visual prose defects** — `DV-vi`, `DV-vii`, `DV-ix`. ⚠️ `DV-vii` is now also `Page`'s
   `B2` and is blocked on §2.1.
4. **The seven questions in §2.**
5. **The live-QA tails on NDA-002 / NDA-013 / NDA-014** — ⚠️ **status genuinely unclear and should
   be re-derived, not inherited.** Their task rows say *"live QA pending"* while the Audit-coverage
   table says the 2026-07-29 pass verified Tier 1 in the running editor. One is stale and the
   register cannot tell you which.
6. **Handing `ERG-001` (11 cells) and `NDA-014` (2 cells) their inputs** — both are specced and
   neither is phase 30's.
