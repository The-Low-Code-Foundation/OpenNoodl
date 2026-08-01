# Phase 30 — next session

**Current to `f100d2ce`, written 2026-08-01 (sixth session of the day).** Work on `cline-dev` in
`/Users/richardosborne/vscode_projects/OpenNoodl`, commit directly to it, **explicit pathspecs on
every commit**, Claude co-author line at the end of each message.

⚠️ **If you write a handover, overwrite this file. Do not add a sibling.** Two files with the same
job is how one of them goes stale unnoticed, which has already happened once in this phase.

⚠️ **If HEAD has moved past `f100d2ce`, prefer PROGRESS.md's newest entries to this file.** They are
append-only and always current; this file is rewritten and can lag by one session.

## §0 — the state, re-derived today rather than inherited

| | |
|---|---|
| NDA-012 audit | ✅ **COMPLETE — 17 / 17 categories, 136 of 151 nodes**, twelve checks each |
| NDA-012 remediation | 🔄 **Visual: 23 of 47 in-scope ⚠️ cells closed. 24 remain, of which 7 are `B3` and 4 are `B1` — both ERG-001's — so 13 in-scope cells across 10 nodes** |
| **NDA-017** | ✅ **CLOSED** — §0, §1, §2 built across fifteen families and live-verified. Only criterion 6's semantic-validator half is open |
| Gates | runtime jest **1,758 pass / 13 skipped**, viewer **519**, cloud 57, all four catalog gates exit 0, both typechecks clean |
| Editor jasmine | **1,894 / 0**, last measured 2026-07-30 — **still not re-run, and still correct not to be**: nothing this session touched `packages/noodl-editor/src`. Re-run it the moment you do (`cd packages/noodl-editor && npm run test:ci`, ~6 min, background it) |

**Every number is reproducible.** The cell count comes from the worksheet, not from a tally beside
it:

```bash
awk '/^## In scope/{f=1} /^## Out of scope/{f=0} f' \
    dev-docs/tasks/phase-30-node-library-audit/audit/visual.md \
  | grep -E "^\| (A1|A2|A3|G1|B1|B2|B3|D1|E1|F1|H1) \| ⚠️" \
  | sed -E 's/^\| ([A-Z0-9]+) \|.*/\1/' | sort | uniq -c | sort -rn
```

### The known-red register is now **4 rows**, down from 7

⚠️ **`test.failing` reports as *passed***, so this list is maintained by grep, never by memory:

```bash
grep -rn "test.failing(" packages/noodl-runtime/test packages/noodl-viewer-react/tests
```

| File | Rows | Why red |
|---|---|---|
| `nda-012-cloud-services-category.test.ts` | M1, M2, M3 | `ConfigService.getConfig` latches a rejection for ever and `clearCache()` clears the other field. Filed, not fixed, deliberately |
| `nda-012-logic-builder.test.ts` | L12 | A port cannot change kind on a live node (`deregisterInput` throws on a connected port). Filed |

**NDA-017's three rows are unmarked and green.** A fix MUST unmark its rows in the same commit.

### The 13 skipped runtime rows are unchanged and are not debt

7 are `agent-live-endpoint.test.ts` (live streaming endpoint); 6 are DEBT-014's
`model-registry-lifetime.test.ts` (`--expose-gc`). Enumerate rather than wonder:
`npx jest --json` and filter `status !== "passed"`.

## §1 — do these, in this order

### 1. Visual remediation, stream D — 13 in-scope cells across 10 nodes

Run the `awk` above for the list, or read `audit/visual.md`. Grouped by shape:

| Shape | Cells | Note |
|---|---|---|
| **`D1` bare-string contracts** | Columns, Page, Page Router, Repeater | `layoutString` `'1 a 1'` → a `NaN` column; `urlPath`'s derived default is unsanitised (`Order #1 & Co` → `order-#1-&-co`); Page Router **double-decodes** a path parameter (`decodeURI` then `decodeURIComponent`, two different rules); `templateScript` compiled from a bare string |
| **`B2` deployed diagnosis** | Drag, Group, Page, Repeater | "the diagnosis reaches a deployed app" — NDA-004's error-channel leg, independent of `B1` |
| **`E1` type dead ends** | Dropdown, Repeater | Both are `items: 'array'`, which is a **library-wide** question for NDA-014, not these nodes' bug. Read NDA-014 before touching either |
| **`A1`, `F1`** | Radio Button | No `Changed` output at all; and its group is resolved through a React context with **no `Group` port**, so one rendered outside a group is visibly a control and functionally inert — the category's only class-F instance |
| **`A2`** | Page Router | `resetAsync` compares page-info by identity, so editing a page's path *in place* leaves an explicit `Reset` re-reading nothing |

⚠️ **Do `B2` and leave `B1` to `ERG-001`** — a decision stream B made, recorded so it is not
relitigated. `B1` is *a port*, and ERG-001 owns `Done`/`Unchanged`/`Failure`/`Completed` as one set
for exactly these nodes; adding `Failure` alone half-builds that contract. Same reasoning the
worksheet already applies to `B3`.

**Three prose defects are open and none is a cell**, so the count does not see them: `DV-vi`
(`Slider`'s drifted private `addBorderInputs`, incl. `Slider.tsx:45`'s stray assignment writing four
invalid CSS keys), `DV-vii` (`Page`'s `Title` and `Url Path` ports are **dead** — `getTitle()` /
`getUrlPath()` are called by nothing, and a Page node cannot set the browser tab title), `DV-ix`
(`Component Stack` derefs `pages[0].id` behind a `length === 0` guard, so a *malformed* `pages`
throws). ⚠️ **"No ⚠️ cell" is not "nothing open".**

### 2. Live QA for stream C, and a build the fixes have not reached

⚠️ **Every Visual fix so far is a viewer change, so none of it reaches a deployed app** until
`npm run build --prefix packages/noodl-viewer-react` runs. `noodl.deploy.js` is gitignored and
nothing rebuilds it.

Stream C (`e673c770`, `f100d2ce`) is jest-verified with discrimination in three directions but has
**not** been driven in the editor. The claim to check is the one the corpus deliberately cannot
make: that a real React mount flushes the queue. Fire `Play` on a Video inside a Page being
navigated to, and a `Scroll To Element` on a Group inside a Repeater row being added.

### 3. NDA-017's last open half — the semantic validator

Criterion 6: *"the semantic validator flags the mis-sequenced graph"* — a `Run` driven by something
other than its inputs' producers. The port-docs half is done (seven descriptions that stated the
trap as if it were the design are gone). The checkbox makes the mis-sequenced graph much less
costly but does not make it visible, so this is still worth building.

### 4. Whether the three non-cell Visual defects and NDA-014 are this phase's

See §4. Ask before spending a session on either.

## §2 — what needs Richard. Surface it; do not decide it.

**Nothing here blocks §1.**

1. ⚠️ **NDA-017 §2 has one site that does not follow the decision word for word, and it is the only
   judgement call in the build.** The *definition* port — `expression`, `functionScript` — keeps the
   old `!isInputConnected('<control signal>')` guard. Every *value* setter is governed by a checkbox,
   so wiring `Run` no longer changes what they do; but this port carries the node's own code and is
   set at load on every node in the project. Making it unconditional is the literal reading of
   "`Run` is purely additive", and it would **run every `Run`-driven script once at load, including
   the ones that POST.** Recorded at both call sites and in the spec. If Richard wants the literal
   reading it is a one-line change — and a real behaviour change to shipped projects.
2. **`Value Changed` cannot see an Object or Array being edited.** Needs a decision, not a patch.
3. **NDA-010 §1 item 1** — should a popup's Component Outputs *be* its close results. ⚠️ Re-read
   `showpopup.ts` first: `:129-177` already derives typed `popupParam-*` and
   `closeResult-*`/`closeAction-*`, so §1's premise is partly stale. The real gaps are the
   hand-typed `results`/`closeActions` on the *Close Popup* side, and results being untyped (`*`).
4. **The picker-integrity question — a missing *check*, not a bug.** Four members: `SignInWith` and
   `RequestMagicLink` creatable but **unlisted**; four password/verify nodes **listed but not
   creatable**; `On App Error` registered and working but absent from the picker; `Page Inputs` in
   the picker with no connectable ports. **Each was found by a different accident and none by any
   check this phase runs.**
5. **No pickable node can make an outgoing HTTP request from a cloud function.** `net.noodl.HTTP` is
   `availableIn: ['browser']`; `REST2` is cloud-capable but deprecated *and* filtered from the
   picker; `noodl.cloud.request` is the *incoming* trigger. The hole **predates** the `inNodePicker`
   fix, so that fix made it discoverable rather than real.

**Closed since the last handover:** ~~NDA-017 §1~~ → decided and now built. ~~`description` is
canonical is written down nowhere normative~~ → it was in NDA-005 §3 all along, and is now in
`PORT-DESCRIPTION-STYLE.md` too, which is the half that was genuinely missing.

## §3 — carry these; they were learned the hard way

### The one that cost the most this session

⚠️ **A corpus row sets a parameter with `setInputValue` on a graph that is already built. A saved
project applies the parameter *first*, while the graph is still being constructed.** That single
ordering difference is why NDA-017's fifteen green families still shipped a defect that **broke the
Expression node outright** the moment an author unticked a box: the parameter reached
`registerInputIfNeeded` before the port it governs existed, landed in the expression *scope*, and
`_compileFunction` then built a `Function` with a parameter called `runOnChange-a`, threw, and the
node evaluated to `0` for the rest of the session. **If a feature is configured by a parameter, one
row must load it from `data.components[].nodes[].parameters`.**

⚠️ **And the affordance can be wrong while the behaviour is right.** The same feature rendered its
checkboxes **unticked** on nodes that were running ticked, because the runtime reads
absent-as-ticked and the *panel* reads the port's declared `default`. Both have to be declared, and
they are not redundant — they are needed together **because** a declared default never runs its
setter (A-D1): the default is panel-only, which is what makes it safe, and is exactly why the
runtime cannot rely on it.

### About this phase's own instruments

- ⚠️ **A cell's check letter is where someone filed it, not what it is.** The `A3` pre-mount class
  had three instances; one was filed under `B1`, because that cell's sentence contained two defects
  (*"dropped … with no report"*). Counting `A3` cells found two of three. The shared shape was
  visible only by grepping the mechanism — `innerReactComponentRef &&` — which is the operational
  form the `DV-ii` lesson prescribes. **When you bank a lesson, bank the query.**
- ⚠️ **A worksheet cell can be confidently wrong about which half is broken.** `Group`'s `A3` was
  filed as an *asymmetry*, with the sibling that checks inside `scheduleAfterInputsHaveUpdated`
  reading as the careful one. Neither worked — the ref commits after the graph update either way —
  so **making the two agree would have closed the cell and fixed nothing.**
- ⚠️ **A fix that changes no behaviour can still be a fix.** `Video`'s `pause`/`reset` were declared
  `boolean` with `valueChangedToTrue`, and `valueChangedToTrue` already replaces `type` with the
  signal type — so the runtime and the catalog always called them signals. The `boolean` was read
  only by the editor panel, which is precisely where the wrong affordance was drawn.
- ⚠️ **A grepped table of "the same idiom" may not be.** NDA-017's spec listed twelve families
  sharing one guard. Reading them, only five suppress a value *setter*; the rest suppress a
  *subscription*, which is the same trap with no port to hang an affordance on — and three more
  families were missing from the table entirely.
- ⚠️ **A summary of a worksheet must be derived from the worksheet**, and **a low find rate needs a
  cause before it is evidence.** Both have caught this phase out more than once.
- ⚠️ **`EMPTY-VALUE-CONTRACT` has two answers and the port's *type* picks.** No representable empty
  state → **abstain**; has one → **clear**. Two opposite treatments in one session is not an
  inconsistency.

### About writing rows that measure something

- ⚠️ **Run every new row against the OLD code first, and predict which rows a revert reddens before
  running it.** Six cuts this session; every count predicted correctly but one — I said the
  abstaining-getters revert would redden 3 and it reddened 4, because the untick control also
  asserts the abstention. **Say the number out loud; being one out is information.**
- ⚠️ **A control can prove nothing in two distinct ways**: the code under test never ran, *or* both
  outcomes coincide in the fixture's state. NDA-017's untick control stays **green** when the guard
  is reverted, because a reverted guard and an unticked box are the same reading. Its partner — the
  ticked-default row — is what discriminates, and the *pair* is the instrument.
- ⚠️ **`update()` is synchronous and `settle()` yields**, so a row written with `settle()` reports
  the whole signal-freshness defect class as absent.
- ⚠️ **`flagOutputDirty` on a `type: 'signal'` output sends a *value*, not a pulse** (`node.ts:647`).
  Wire the port to a receiver; a sender's own signal log cannot tell the difference.
- ⚠️ **A declared `default` never runs its setter** — and that decides *where* a default-value fix
  lives, not just how to write the row.
- ⚠️ **The Group's React component pulls in three ES-module scroll plugins ts-jest will not
  transform.** `jest.mock` all three (recipe in `nda-016-layout-sizemode.test.ts` and
  `nda-012-visual-premount-actions.test.ts`) or the suite fails to parse and reads as a broken test.
- ⚠️ **`Utils.updateStylesForClass` returns early when `document` is undefined** and the viewer
  corpus runs `testEnvironment: node` — a row about injected CSS must stub a document.
- ⚠️ **Run each jest suite from inside its package.** From the repo root the root babel config picks
  the file up and `import type` is a syntax error, which reads as a broken test rather than a wrong
  cwd.
- ⚠️ `npx jest 2>&1 > file` loses stderr (wrong redirect order). Use `> file 2>&1`.
- ⚠️ **The editor jasmine suite is a barrel of explicit exports.** An unregistered spec **does not
  run** and the total does not move. A run that adds rows without moving the total is a discovery
  failure.
- ⚠️ **A corpus node id of `'set'` fails graph construction** — `Collection` patches
  `Array.prototype.set` as read-only.
- ⚠️ **`defineNode` is now idempotent and its prototype methods are writable.** Both were false
  until this session, and neither had a symptom until something tried to *wrap* a method. If you
  wrap `registerInputIfNeeded` again, that is why it works.

### Live QA

- ⚠️ **Read runtime failures out of the editor's warnings panel, not the viewer console.** The
  viewer's `console.error` is not mirrored into `.logs/dev.log`. `npm run cdp -- click
  "[class*=WarningsChip]"` then read `body.innerText`; the message arrives with node provenance.
- ⚠️ **A connection to a port that does not exist is dropped in total silence.** The NDA-017 fixture
  wired the Text Input's value output as `text`; it is **`onTextChanged`**. Every Expression's scope
  stayed `{}` and the whole thing read as *"the fix does not work live"*. **Check port names against
  the catalog before believing a null reading.**
- ⚠️ **The preview runs the bundle it loaded.** A source change reaches jest immediately and the
  running viewer not at all — `curl localhost:8574/noodl.viewer.js | grep` to see what is actually
  served, and restart the stack rather than touching a parameter to force a re-send.
- **Reach a runtime node from the preview through the React fiber.** Walk `el.__reactFiber$…` up
  `.return` to `memoizedProps.noodlNode`, then `nodeScope.getNodeWithId('<id>')`. `_internal` is then
  readable, and this is how all four NDA-017 claims were measured.
- **`__nodeGraphEditor.model` parameters can be set live and DO reach the viewer.** `null` is
  delivered as `null`; only `undefined` queues the port default.
- ⚠️ **`g.selectNode` wants a node *view*, not a model** — `g.findNodeWithId(id)` returns the view.
  Passing the model throws inside `getNodePanelName`.
- **Register a fixture** by patching `~/Library/Application Support/NodeGX/recently_opened_project.json`
  **with the app stopped**; there is no open-by-path hook in the renderer. Three generators exist in
  `scripts/nda-live-qa/`.
- **CDP:** `--target=editor` for the project window, `--target=dashboard` for the launcher,
  `--target=viewer` for the preview. **Wrap every eval in an IIFE.** Never return a node view's
  `.type`. Never `cdp reload`. `cdp click` takes only a selector and hits the **first** match.
- ⚠️ **A dev launch rewrites the `agent-chat` example project** on open *and* shutdown — check
  `git status` after every editor session. It did not fire this session because the fixture lives
  outside the repo.
- **Stop the stack when done** (`npm run dev:stop`) — three webpack watchers otherwise keep
  recompiling.
- ⚠️ **Re-verify a citation before working from it, even one written days ago.** Caught again this
  session: the previous handover's §1.3 asserted a rule was written down nowhere normative, and it
  was in NDA-005 §3, dated the same day the handover was written.

### Shipping and hygiene

- **Catalog:** `node scripts/node-catalog/generate.js`, `node scripts/node-catalog/merge.js`,
  `npm run cloud-library:generate`, then `catalog:check`, `catalog:merge:check`, `catalog:examples`
  **and `cloud-library:check`** — the first can pass while the others are stale.
- 💡 **SUB-013's encoding generator *observes* dynamic ports by driving the node**, so a new
  dynamic-port family appears in the catalog diff with a derived pattern. That is free evidence the
  ports really reach the editor — `runOnChange-<expression>` and `runOnChange-in-<scriptInput>` both
  showed up without being authored.
- ⚠️ **NDA-005 C1 pins the static port *count* per node**, so a deliberately added port must be
  re-derived there. It is doing its job when it fails.
- ⚠️ **Never `git checkout <path>` to undo a probe.** Copy the file aside first and `cp` it back.
- **One worktree, clean tree at `f100d2ce`.** An uncommitted file is orphaned work, not another
  session's — read it, then commit or discard deliberately.

## §4 — where phase 30 ends

**The remainder is small and mostly owned elsewhere.** After §1: `ERG-001`'s 7 `B3` and 4 `B1` cells
(phase 35), the three Visual prose defects, NDA-017's validator half, the five questions in §2, and
the live-QA tails on NDA-002 / NDA-013 / NDA-014 — ⚠️ **whose status is genuinely unclear and should
be re-derived, not inherited.** Their task rows say *"live QA pending"* while the Audit-coverage
table says the 2026-07-29 pass verified Tier 1 in the running editor. One is stale and the register
cannot tell you which.

⚠️ **Three register cells were fixed this session, and two task specs disagreed with the register in
the same way.** The rule that catches the next one: **only a date or commit stamp indicates
currency.** The three fixed cells are stamped; the rest are not. "Read to the end of the section"
does not help when the stale sentence *is* the end of the section — which is exactly what NDA-009's
was.
