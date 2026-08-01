# Phase 30 — next session

**Current to `93c14b59`, written 2026-08-01 (fifth session of the day).** Work on `cline-dev` in
`/Users/richardosborne/vscode_projects/OpenNoodl`, commit directly to it, **explicit pathspecs on
every commit**, Claude co-author line at the end of each message.

⚠️ **This file replaced a second rival handover** (`NEXT-SESSION-HANDOVER.md`, now deleted). Two files
with the same job is how one of them goes stale unnoticed — which is what had happened: the older
`NEXT-SESSION.md` still said *"Data is ON HOLD, start with Visual"* four sessions after Data closed.
**If you write a handover, overwrite this file. Do not add a sibling.**

⚠️ **If HEAD has moved past `93c14b59`, prefer PROGRESS.md's newest log entries to this file.** They
are append-only and always current; this file is rewritten and can lag by one session.

## §0 — the state, re-derived today rather than inherited

| | |
|---|---|
| NDA-012 audit | ✅ **COMPLETE — 17 / 17 categories, 136 of 151 nodes**, twelve checks each, 188 defects |
| NDA-012 remediation | 🔄 **Visual: 20 of 47 in-scope ⚠️ cells closed. 27 remain, of which 7 are `B3` → 20 per-node cells across 12 nodes** |
| Gates | runtime jest **1,751 pass / 13 skipped**, viewer **506**, cloud **57**, all three catalog gates + `cloud-library:check` exit 0, viewer typecheck clean |
| Editor jasmine | **1,894 / 0**, last measured 2026-07-30 — **not re-run since**, because nothing has touched editor source. Re-run it the moment you do (`cd packages/noodl-editor && npm run test:ci`, ~6 min, run it in the background) |

**Every number above is reproducible.** The cell counts come from the worksheet itself, not from a
tally maintained beside it — ⚠️ **which is the lesson of the session that wrote them, because both
revised counts in that table were wrong when first typed:**

```bash
awk '/^## In scope/{f=1} /^## Out of scope/{f=0} f' \
    dev-docs/tasks/phase-30-node-library-audit/audit/visual.md \
  | grep -E "^\| (A1|A2|A3|G1|B1|B2|B3|D1|E1|F1|H1) \| ⚠️" \
  | sed -E 's/^\| ([A-Z0-9]+) \|.*/\1/' | sort | uniq -c | sort -rn
```

### The 13 skipped runtime rows are not debt and not hidden red

Enumerate them rather than wonder: `npx jest --json` and filter `status !== "passed"`. **7 are
`agent-live-endpoint.test.ts`, gated on a live streaming endpoint; 6 are DEBT-014's
`model-registry-lifetime.test.ts`, gated on `--expose-gc`.** Neither is phase 30's, both are
deliberate.

### The known-red register — 7 live `test.failing` rows

⚠️ **`test.failing` reports as *passed*.** A green summary is not the same as nothing red, so this list
has to be maintained by grep rather than by memory:

| File | Rows | Why red |
|---|---|---|
| `nda-012-cloud-services-category.test.ts` | M1, M2, M3 | `ConfigService.getConfig` latches a rejection forever and `clearCache()` clears the other field. **Filed, not fixed, deliberately** — no signed-off criterion is false while it stands |
| `nda-012-logic-builder.test.ts` | L12 | A port cannot change kind on a live node (`deregisterInput` throws on a connected port). Filed |
| `nda-017-signal-input-freshness.test.ts` | 3 rows | **The defect NDA-017 §2 is being built to fix.** These go green as part of that work |

**A fix MUST unmark its rows in the same commit** or CI breaks loudly.

## §1 — do these, in this order

### 1. NDA-017 §2 — the largest genuinely-open piece of work in the phase

**Richard decided §1 on 2026-08-01 and with none of the four options the spec offered** (Decisions
§7). His answer is a **per-input "Run on value change" affordance in the node's config panel**, because
the defect is one level deeper than the spec framed it: *connecting `Run` silently changes what every
other port does.*

⚠️ **Do not start from the spec body.** §0's correction is written into the spec in place, and the
recommendation the spec makes was rejected.

Four constraints, all from Richard's message, and each one is a way the build can reintroduce the trap:

- **`Run` becomes purely additive.** The checkboxes are the *only* thing governing auto-run. Wiring
  `Run` adds a trigger; it never un-ticks anything. Auto-clearing the boxes makes the trap *visible*
  rather than removing it.
- **Default is all inputs ticked** — today's behaviour for a node with no `Run`, so nothing changes
  until an author deliberately unticks. ⚠️ And **a declared default does not run its setter** (A-D1),
  so the default behaviour must be correct without it having run.
- **Several ticked inputs changing in one frame produce one run, not three.**
- **A node that has never evaluated reports `null`**, not the confident `0` its getter pushes today.
  Richard's words: *"a null value if nothing has ever come in"*.
- **Keep the `Run` port.** An async re-fetch returning an identical value fires no change, so a node
  that must re-run per fetch still wires `Run` to a completion signal.

**Scope is the whole twelve-family table, not `Expression` alone.** The three red rows in
`nda-017-signal-input-freshness.test.ts` are the acceptance test, and row 4 already covers `Function`,
so the reporter's workaround is measured not to be one.

⚠️ **Reusable, and it will bite:** `update()` is synchronous and `settle()` yields, so **a row written
with `settle()` reports this whole defect class as absent.**

### 2. Visual remediation, stream C — 20 per-node cells across 12 nodes

Full per-cell list: run the `awk` above, or read `audit/visual.md`. Grouped by shape, cheapest first:

| Shape | Cells | Note |
|---|---|---|
| **`D1` bare-string contracts** | Columns, Page, Page Router, Repeater | `layoutString` `'1 a 1'` → a `NaN` column; `urlPath`'s derived default is unsanitised (`Order #1 & Co` → `order-#1-&-co`); Page Router double-decodes a path parameter (`decodeURI` then `decodeURIComponent`, two different rules); `templateScript` compiled from a bare string |
| **`B1`+`B2` deployed diagnosis** | Drag, Group, Page, Repeater (×2 cells each) | ⚠️ **Split these two checks and do only `B2`.** See the decision below |
| **`A3`** | Group, Video | Both are pre-mount guard asymmetries — `Group`'s two scroll actions check `innerReactComponentRef` at *different times*, and `Video`'s four actions drop silently. One shape, two nodes |
| **`E1` type dead ends** | Video, Dropdown, Repeater | `Video`'s `pause`/`reset` are declared `boolean` and implemented with `valueChangedToTrue` while `play`/`restart` are `signal` — four ports, one contract, two spellings. Dropdown's and Repeater's are both `items: 'array'`, which is a **library-wide** question for NDA-014, not these nodes' bug |
| **`A1`, `F1`** | Radio Button | `Radio Button` has no `Changed` output at all; and its group is resolved through a React context with **no `Group` port**, so one rendered outside a group is visibly a control and functionally inert — the category's only class-F instance |
| **`A2`** | Page Router | `resetAsync` still compares page-info by identity, so editing a page's path *in place* leaves an explicit `Reset` re-reading nothing. Deliberately untouched by stream A |

⚠️ **A decision stream B made and did not have to escalate, recorded so it is not relitigated: do
`B2` now and leave `B1` to `ERG-001`.** `B2` is "the diagnosis reaches a deployed app", which is
NDA-004's error-channel leg and independent. `B1` is *a port*, and `ERG-001` owns
`Done`/`Unchanged`/`Failure`/`Completed` as one set for exactly these nodes — adding `Failure` alone
now half-builds that contract, and a half-built outcome contract is worse than none. Same reasoning
the worksheet already applies to `B3`.

**Three prose defects are open too and none of them is a cell**, so the cell count does not see them:
`DV-vi` (`Slider`'s drifted private `addBorderInputs`, including `Slider.tsx:45`'s stray assignment
writing four invalid CSS keys into the style object), `DV-vii` (`Page`'s `Title` and `Url Path` ports
are **dead** — `getTitle()`/`getUrlPath()` are called by nothing in the repository, and a Page node
cannot set the browser tab title), `DV-ix` (`Component Stack` derefs `pages[0].id` behind a
`length === 0` guard, so a *malformed* `pages` throws). ⚠️ **"No ⚠️ cell" is not "nothing open"** —
`Slider` is the worked example and is why the summary says so out loud.

### 3. One small owed item, under an hour

⚠️ **`description` is canonical was decided by Richard on 2026-08-01 and is written down nowhere
normative.** It is asserted in phase 35's `ERG-001` §5 and referenced in Decisions §10, but neither
`NDA-005-PORT-DOCUMENTATION.md` nor `dev-docs/reference/PORT-DESCRIPTION-STYLE.md` contains it —
checked. Three channels now document ports (`description`, `tooltip`, enrichment `ports`) and the
precedence exists only in a commit message. **Write it into NDA-005; it is that task's own criterion
that the number misreports.**

⚠️ **This section had a second item and it was wrong — recorded because the mistake is this file's own
subject.** It said *"`Run Tasks` has no worksheet entry and no port descriptions — Data's only
in-scope node still at 0%"*, carried from a note written before Data closed. Re-derived from the
catalog: `Run Tasks` reads **14/14 documented**, and `audit/data.md:687` gives it a full twelve-check
entry with five defects found and fixed. **A handover figure goes stale exactly as fast as the work it
describes** (Decisions §6) — including inside the handover that quotes the rule. Re-derive every number
you carry; the commands are in §0.

### 4. Fix three stale status cells in PROGRESS.md while you are in there

**Every one of these was found by reading the register against the code, not by trusting it.**

⚠️ **The status column and the note in the same cell disagree, in three rows** — and the note is the
current one in all three:

| Row | Status column says | Its own note says |
|---|---|---|
| NDA-006 | 🔄 Slices 1+2 done | slices 3 **and** 4 done, criterion 5's deployed leg run |
| NDA-007 | 🔄 §1 done + renderer built | §2+§3 done `899ab676`, criterion 1's deployed leg passed |
| NDA-009 | ✅ Done — all four sections | ends *"§2 and §3 remain"* — a **stale trailing sentence** |

⚠️ **This is the third time this register has been wrong in the status column while its prose was
right**, and it defeats the mitigation banked for it: *"read to the end of the section"* does not work
when the stale sentence **is** the end of the section. **Only a date or commit stamp indicates
currency.** Consider stamping every cell.

## §2 — what needs Richard. Surface it; do not decide it.

**Nothing here blocks §1.** Four questions, down from eight — three were answered on 2026-08-01 and
one was dissolved by phase 34.

1. **`Value Changed` cannot see an Object or Array being edited.** Needs a decision, not a patch.
2. **NDA-010 §1 item 1** — should a popup's Component Outputs *be* its close results. ⚠️ Re-read
   `showpopup.ts` first: §1's premise is **partly stale**, since `:129-177` already derives typed
   `popupParam-*` and `closeResult-*`/`closeAction-*`. The real gaps are the hand-typed
   `results`/`closeActions` on the *Close Popup* side and results being untyped (`*`).
3. **The picker-integrity question — and it is a missing *check*, not a bug.** Four members:
   `SignInWith` and `RequestMagicLink` are creatable but **unlisted**; the four password/verify nodes
   are **listed but not creatable**; `On App Error` was registered and working but absent from the
   picker; `Page Inputs` was in the picker with no connectable ports. **Each was found by a different
   accident and none by any check this phase runs.** Password reset and email verification have no
   picker presence at all while BAK-002 ships the server flows.
4. **No pickable node can make an outgoing HTTP request from a cloud function.** `net.noodl.HTTP` is
   `availableIn: ['browser']`; `REST2` is cloud-capable but deprecated *and* filtered from the picker;
   `noodl.cloud.request` is the *incoming* trigger. The hole **predates** the `inNodePicker` fix, so
   that fix made it discoverable rather than real.

**Closed since the last handover, so they are not asked again:**

- ~~NDA-017 §1~~ → Decisions §7. ~~The deprecated five~~ → Decisions §11 (no revivals). ~~`shortDesc`~~
  → Decisions §10 (deleted, 57 sites). ~~The `Repeater`'s `null` semantics~~ → Decisions §9 (it clears).
- ~~**Two creatable nodes read "Delete Record"**~~ — ⚠️ **dissolved by phase 34, verified today**, not
  decided. It deleted the five `noodl.byob.*` types, so only one `Delete Record` remains. Re-derived
  over the whole catalog rather than for that one label: **no two creatable non-deprecated nodes share
  a picker label.** The ten surviving duplicates are all deprecated↔replacement pairs, which is the
  known and accepted case. *A question can be answered by another workstream while you are still
  carrying it.*
- ~~The three port-documentation channels' precedence~~ → decided (`description` is canonical), but see
  §1.3: **decided is not written down.**

## §3 — carry these; they were learned the hard way

### About this phase's own instruments

- ⚠️ **A rule you cannot execute is a rule you will restate rather than apply.** *"A mechanism defect
  and its consequence are two different claims"* was written into FINDINGS `DV-ii` on 2026-08-01, and
  the **next instance of that exact finding, in the same category, hours later, was still diagnosed
  from the source, fixed, committed, and reverted.** The form that works is operational: *before
  filing "the declared default does not render", grep `assets/style.css` for a class rule carrying the
  same value.* **When you bank a lesson, bank the query.**
- ⚠️ **`EMPTY-VALUE-CONTRACT` has two answers for an empty arrival and the port's *type* picks, not
  judgement.** No representable empty state → **abstain** (`Drag` positions, `Slider` `Value`,
  `Radio Button Group` `Value`). Has one → **clear** (`Text Input`'s `startValue` → `''`). Two
  opposite treatments landed in one session and reading them as an inconsistency would be the mistake.
- **A check that closes to zero across a category is worth reading as a class before it is filed as a
  list.** `G1` closed for all seven Visual nodes and the seven answers were seven *different* wrong
  ones — a crash, a throw from the guard itself, a truthiness test, `|| 0`, a raw store, an identity
  compare, a pass-through into the DOM. One question asked by seven authors.
- ⚠️ **A summary of a worksheet must be derived from the worksheet.** Twice now: the unreproducible
  "31 defects / 41 cells", then two wrong rows in the by-check table one revision later.
- ⚠️ **A low find rate needs a cause before it is evidence.** Three times: Cloud Services' dip was
  sibling dilution, Component Utilities' was prior remediation, Data's 0.86 was prior work *plus* the
  first evidence that newer code carries fewer of these defects. None was exhaustion, and none was
  distinguishable from it by the number alone.
- ⚠️ **A count of look-alike call sites is a hypothesis about them, not a description.** `setError` was
  "22 copies of one helper"; fourteen posted to `sendWarning`, **six posted nowhere at all**, and three
  of those had no `Failure` port either.

### About writing rows that measure something

- ⚠️ **Run every new row against the OLD code first, and predict which rows a revert reddens before
  running it.** Stream B predicted 8, 5 and 3 and got exactly those.
- ⚠️ **A control can prove nothing in two distinct ways.** FINDINGS `B-x`: *the code under test never
  ran.* And its generalisation from stream B: **both outcomes coincide in the fixture's state.**
  `Slider`'s `initialize` seeds `props.value = props.min`, so on a handle that has never moved
  "abstained" and "clamped to `Min`" are the same reading. **Make the control prove the code ran, and
  that the two outcomes are distinguishable.**
- ⚠️ **Where a port's behaviour is switched by whether *another* port is connected, connectedness is a
  fixture parameter.** `Text Input` has two modes (`isInputConnected('set')`); `Clear`'s defect lives
  in one and `startValue`'s in the other. One fixture measured a single mode while reporting on both
  and read three genuine controls as failures.
- ⚠️ **"Move the side effect out of render" is a browser rule.** SSR runs `renderToString` and
  **effects never run**, and `injectSeo` builds the served `<head>` from the buffer `setMeta` fills —
  so an unconditional `useEffect` empties every SSR/SSG page's meta tags while `ssr-inject-seo.test.js`
  stays **green**, because it tests the transform and not the producer. Check with
  `typeof document === 'undefined'`: `server-core.js` shims `globalThis.location` and nothing else, and
  the repo has no jsdom.
- ⚠️ **`graph.signalsFor` does not prove a port exists** — assert `hasOutput` too.
- ⚠️ **`flagOutputDirty` on a `type: 'signal'` output sends a *value*, not a pulse** (`node.ts:647`).
  Silent, typechecks, never fires. A test asserting on the sender's own signal log cannot tell the
  difference — wire the port to a receiver.
- ⚠️ **A declared `default` never runs its setter**, and that decides *where* a default-value fix
  lives, not just how to write the row.
- ⚠️ **`Utils.updateStylesForClass` returns early when `document` is undefined** (`utils.ts:27`) and
  the viewer corpus runs `testEnvironment: node` — a row about injected CSS must **stub a document** or
  it passes having measured nothing.
- ⚠️ **`createNodeFromReactComponent` folds `inputProps` into `inputs`**, so the two default routes are
  indistinguishable on the created node. Compare behaviourally (`props.<name>` on a bare node).
- ⚠️ **The editor jasmine suite is a barrel of explicit exports.** An unregistered spec file **does not
  run** and the total does not move. **A run that adds rows and does not move the total is a discovery
  failure, not a passing suite.**
- ⚠️ **Run each jest suite from inside its package.** From the repo root the root babel config picks
  the file up and `import type` is a syntax error — which reads as a broken test, not a wrong cwd.
- ⚠️ `npx jest 2>&1 > file` loses stderr (wrong redirect order; jest's summary is on stderr). Use
  `> file 2>&1`.
- ⚠️ **A corpus node id of `'set'` fails graph construction** — `Collection` patches
  `Array.prototype.set` as read-only.

### Live QA

- ⚠️ **Read runtime failures out of the editor's warnings panel, not the viewer console.** The viewer's
  `console.error` is **not** mirrored into `.logs/dev.log`, and racing `cdp console` against preview
  boot is unreliable. `npm run cdp -- click "[class*=WarningsChip]"` then read `body.innerText`; the
  message arrives with node provenance (*"At node Slider in component App"*).
- ⚠️ **`__nodeGraphEditor.model` parameters can be set live and they DO reach the viewer.**
  `node.setParameter(name, value)` re-runs the setter in the preview, and `null` is delivered as
  `null` — only `undefined` queues the port default. **This is the cheapest way to drive an
  empty-value check**, no UI needed.
- **Reach a runtime node from the preview through the React fiber.** No handle on `window`: walk
  `el.__reactFiber$…` up `.return` to `memoizedProps.noodlNode`, then `getVisualParentNode()` to climb.
  `_internal` is then readable. Read state a call *later* than the one that sets it — the frame counter
  only ticks when the update loop runs.
- **A live discrimination check for CSS provenance costs one eval**: delete the injected `<style>`
  elements from the document and re-measure `getComputedStyle(el, '::placeholder')`. That is what
  settled the `DV-ii` revert.
- **Build a purpose-built fixture whose nodes carry only what an author would have typed** — mandatory
  when the claim is about an *untouched* port. Two generators exist:
  `scripts/nda-live-qa/make-fixture.js` (NDA-006/007/010/011) and `make-controls-fixture.js`
  (Slider/Text Input/Radio Button/Drag). Register by patching
  `~/Library/Application Support/NodeGX/recently_opened_project.json` **with the app stopped**; there
  is no open-by-path hook in the renderer.
- **CDP:** `--target=editor` for the project window, `--target=dashboard` for the launcher,
  `--target=viewer` for the preview. `findNodeWithId` returns the **canvas view** — read `.model` for
  `parameters`/`dynamicports`. **Never return a node view's `.type`** from an eval; it serialises the
  whole definition and the graph reachable through its listeners. **Wrap every eval in an IIFE** (the
  eval context persists and `const` redeclaration throws). Never `cdp reload`.
- `cdp click` takes only a selector and hits the **first** match — use `:nth-of-type(n)` for siblings.
  The launcher card is `s.closest('[class*=__Card--]')`; `[class*=LauncherProjectCard]` matches the
  label span itself.
- ⚠️ **`npm run cdp -- click` scrolls the target into view before clicking**, so it cannot measure
  scroll-on-click. Use `element.focus()` directly.
- ⚠️ **The launcher's `VerifyFix3`/`VerifyFix4` scratch projects are EMPTY** — wrecked by earlier dev
  launches. **A dev launch rewrites the `agent-chat` example project** (minifies `project.json`, drops
  `rootComponent`) on open *and* shutdown — check `git status` after every editor session and revert.
  It did not fire this session because the fixture lives outside the repo.
- **Stop the stack when done** (`npm run dev:stop`) — three webpack watchers otherwise keep
  recompiling. SIGTERM does not kill the dev Electron; use `pkill -9` and wait for the pid to go.
- ⚠️ **Re-verify a citation against the code before working from it, even one this phase wrote days
  ago.** Page Router `:272`/`:284` → `:280`/`:292`; Radio Button Group `:82` → `:85`; Slider `:205` →
  `:220`. Same code every time.
- ⚠️ **A stack trace naming a method does not name the node.** `Component Stack` and `Page Router`
  both have a `resetAsync` and a `Pages` port, with **incompatible shapes** and nothing reporting the
  mismatch. Three diagnoses of one exception were wrong before the line was found in the *served*
  bundle (`curl localhost:8574/noodl.viewer.js`) and grepped **backwards** for the enclosing `name:`.

### Shipping and hygiene

- ⚠️ **Every Visual fix so far is a viewer change, so none of it reaches a deployed app** until
  `npm run build --prefix packages/noodl-viewer-react` runs. `noodl.deploy.js` is gitignored and
  nothing rebuilds it automatically.
- **Catalog:** `node scripts/node-catalog/generate.js`, `node scripts/node-catalog/merge.js`, then
  `npm run catalog:check`, `catalog:merge:check`, `catalog:examples` **and `cloud-library:check`** —
  the first can pass while the others are stale. **Make the strong assertion**: strip the fields you
  added and the catalog is *byte-identical to HEAD*. That is what surfaced the logic-builder delta as
  a two-line diff that read as innocuous.
- ⚠️ **Never `git checkout <path>` to undo a probe.** Copy the file aside first and `cp` it back.
- **One worktree, three branches, clean tree at `93c14b59`.** An uncommitted file is orphaned work,
  not another session's — read it, then commit or discard deliberately. ⚠️ **An inherited "do not
  touch" is a hypothesis too**: nine handovers deferred `logic-builder.ts` as another session's
  in-progress rewrite; `git log --oneline -- <path>` and a working-tree mtime *earlier* than the commit
  were available throughout, and it took under an hour and held six defects.

## §4 — where phase 30 ends

**The remainder is small and mostly owned elsewhere.** After §1's four items, what is left of this
phase is: `ERG-001`'s 7 `B3` cells and 4 `B1` cells (phase 35), the three Visual prose defects, the
four questions in §2, and the live-QA tails on NDA-002 / NDA-013 / NDA-014 — ⚠️ **whose status is
genuinely unclear and should be re-derived, not inherited.** Their task rows say *"live QA pending"*
while the Audit-coverage table says the 2026-07-29 pass verified Tier 1 in the running editor. One of
those is stale and the register cannot tell you which, which is §1.4's problem in a second place.
