# Phase 75 — next session

**State as of 2026-08-25 (session 34).** Richard's brief is still **speed: keep knocking out phase
75**, so this file leads with the queue. Take the top unblocked item; dip into the rest when it bites.

**Committed this session:** FB-021 scope 2 **driven**, plus the defect that drive found and its fix.

⚠️ **Peers.** `3878` is **opennoodl-78**, this checkout. Other names are other projects.
🔴 **`SendMessage` to a cross-session peer needs the `[ref]`** — the bare name is rejected with the
ref in the error, so just re-send.

## The queue — unblocked, cheapest-first. Take the top one.

| # | item | size | state |
|---|---|---|---|
| 1 | **FIX-025 §5/§7/§12** (phase-74 dir) | **S/M** | **already built** — needs only the editor drive |
| 2 | **FIX-027 17, 19, 20** (phase-74 dir) | **S/M** | ⬜ unblocked, no ruling needed |
| 3 | **`refusalHeadline` reaches nobody** | **S** | 🆕 found s34 — see below; 4 headlines, 0 callers |
| 4 | **FB-014** search that survives renames | **M** | design + prototype only, pgvector |
| 5 | **FB-005** templates | **S then L+** | **scope doc first** — that doc is the unblocked part |
| 6 | **FB-013** chat | **L** | 🔴 **ruled 08-22: OVERRULED, build it.** Pulls in FB-014's 2nd corpus |

✅ **FB-021 is CLOSED** — scopes 1/2/3/4, the canvas, and both popup entry paths, all driven.

**Blocked on Richard, do not start:** FB-012 and FB-009 (both need *content*), FB-017 scope 2's
`Source Set`, FIX-026 (a)/(b), FIX-027 14/15/16 + 22, tsfixme baseline, prod `ANTHROPIC_API_KEY`
(⚠️ **intro pricing ends 2026-08-31 — six days**), the 15 lessons' prose, Discord's row in the `?`
menu, `/rfps` search.

✅ **Nothing is waiting to deploy.** ⚠️ The *stamp on the box* is still relayed from s19's SSH read —
re-read it before any deploy claim.

## 🔴 The finding of this session: TWO CORRECT FUNCTIONS COMPOSED THE FORBIDDEN SENTENCE

FB-021's whole point is that *"N ports this wire can't reach"* must **never** appear over a
switched-off port — it is the opposite claim, and it is the reading Jordan arrived at four times.
Session 33 built it, specced it, mutation-checked it, and committed it. **Session 34 opened the popup
and the forbidden sentence was on screen.**

Mid-drag the fully-refused groups fold into one block. It held **8 gated ports and one
type-mismatched `Focus`** — mixed, so `dominantReason` answered `'other'` (deliberately, and rightly,
for two kinds of *refusal*) and the summary read **"9 ports this wire can't reach."**

Neither function was wrong. `refusedGroupSummary('gated')` is right and specced. `dominantReason` is
right and specced. **The defect lived only in the composition**, and only on the surface that shows
*before anything is expanded*.

⚠️ **The obvious fix is the same defect reversed**: letting `gated` win in `dominantReason` puts
*"switched off by a setting"* over the type-mismatched row. The answer was `partitionGated` — the two
kinds never share a line. ✅ Both halves gained: `Focus` recovered *"1 signal input · a moment, not a
value"*, which the merge had also cost it.

✅ **Carry this**: when a task says *"output X must never appear over Y"*, **assert that over the
composed output**, not over each function that contributes to it. And ask what a summary says when
the set holds **both** kinds — a homogeneous fixture never reaches it.

## 🔴 Second finding, and it is queue item 3: `refusalHeadline` HAS NO CALLER

`grep -rn refusalHeadline packages/` returns `portCopy.ts` (the definition) and **two test files.**
Nothing in `src/` calls it. FB-021's `'This port is switched off by another setting.'` branch — and
the three pre-existing SIG-001 headlines beside it — grade **dead code**. The sentence a user reads
comes from `p.message` via `PortItem` → `DocsPopup`'s `docsRefusal`, which s34's drive confirmed.

🔴 **And session 33 mutation-checked that branch.** A mutant changes the function's output and the
spec reads the output, so **it dies whether or not anything calls the function**. The harness worked
perfectly and certified dead code. ✅ **Mutation testing proves the spec reads the function; only a
caller-grep proves the function reaches the user.** One grep, and neither the suite nor the mutant
can do it for you.

⚠️ Left alone on purpose: wiring the headline in changes the explainer for **four** refusal reasons
at once — SIG-001's surface — which needs its own drive, not a slipped-in line. That is item 3.

## Driving — what worked, exactly

✅ **The full open-a-project sequence from the renderer**, since no editor global exists and
`require()` fails on the webpack aliases:

```js
let wr; window.webpackChunknoodl_editor.push([['probe'+Date.now()],{},r=>wr=r]);   // module registry
LocalProjectsModel.instance.openProjectFromFolder(dir)   // → loadProject → router.route
```
The router is found by walking fibers from `#root` for `memoizedProps.route.router` — **3 nodes in**.

✅ **The live `NodeGraphEditor`, more robustly than `__nodeGraphEditor`** (which is often the
detached one): walk fibers from `#root` for an object with `interaction` **and** `roots` **and**
`overlays`, checking the **hooks chain** (`memoizedState.next…`), not just `memoizedProps`. Found at
**scanned = 4**.

✅ **Opening the connection popup is two lines below the mouse gesture**, exactly what
`InteractionController`'s `mouseup` runs:

```js
nge.interaction.draggingConnection = { fromNode, toNode, popupOpen: true,
                                       mouseTarget: { global: { x, y } } };
nge.openConnectionPanels();     // async: setTimeout(…, 0) inside
```

🔴 **STEP 2 renders TWICE per drag and they are different code paths.** `toProps` is mounted with
`sourcePort: undefined` before a from-port is picked, and re-rendered with it after. A list built
only inside `if (sourcePort !== undefined)` is wrong in the first; a mark applied *before* the
`getConnectionStatus` pass is wiped in the second. **Drive both.**

✅ **And a control that proves the source-port pass RAN**: a signal input (`Focus` on a `Group`)
appears refused only in the second. Without it, *"my mark survived"* and *"the pass never happened"*
read identically.

✅ **`PopupLayer.instance.hidePopouts(true)` dismisses them cleanly** — reach it via
`wr.c['./src/editor/src/views/popuplayer.ts'].exports`. This retires the old "close() removes
nothing, so click outside the popout" workaround for the programmatic case; measured 6 → 0 blocks,
and the next open gave exactly two bars rather than four.

⚠️ **Hover works with a plain synthetic event** — `el.dispatchEvent(new MouseEvent('mouseover',
{bubbles: true}))` opens the explainer; React's delegated handler takes it, unlike clicks.

- ✅ **Drive a COPY.** This one did, cleaned up with `removeProject(id)` + deleting the copy, and
  `dev:stop` reported **26 processes** while sparing all **12** MCP helpers.
- ⚠️ The eval context persists variables — wrap probes in an IIFE.
- ⚠️ `cdp click` takes a **selector only**; there is no `--text` flag.

## Gates, this tree (OpenNoodl, `cline-dev`) — 🔴 re-measure, never quote

- `npm run test:ci`: **2849 / 4 — THE FLOOR**, all four `AIX-006 style vocabulary`, **matched by
  name**. Default ceiling, run alone on an idle machine (pageout Δ **0** over 5 s), 19:13 → 19:28.
  ✅ Grades the FB-021 popup fix, which is the tree that was committed unchanged straight after.
- `npm run test:main`: **336 files / 5444 specs / 0 failures** (was 335/5438; +1 file, +6 specs).
- `npm run typecheck:editor`: **0 errors**.
- 🔴 **`npm run typecheck:core-ui` is a PRE-EXISTING DIRTY GATE: 44 errors, none ours.**
- Not run, nothing touched them: `typecheck:viewer`, `noodl-runtime`, all of `nodegx-community`.

🔴 **The completion notification said "exit code 0" over a log whose last line is `EXIT=1` and whose
summary line says `4 failures`. SEVENTH session.** ✅ **Completion is the summary line, never an exit
code.** Poll with `until grep -qE "Jasmine: [0-9]+ specs"`.

## Still open, owned by nobody

- 🆕 **`refusalHeadline`'s four headlines reach nobody** — queue item 3 above.
- 🆕 ⚠️ **Two small things FB-021 leaves undriven**: the gated block is no longer given
  `canRedirect` (the fixture produced no confident redirect, so the distinction was never
  exercised — needs a `String` output at a `Button`); and the **mixed-group** case, a group with
  connectable ports *and* both kinds of refusal. Every group on a `Group` node was homogeneous.
- 🔴 **FB-002's selected pill is 1.16:1 against the panel** — the active fill, and 1.24:1 between the
  active and inactive label, while the border is **identical** in both states. Every individual
  label passes AA (7.9–8.5:1); *which pill is on* does not. **Text contrast is not the same
  measurement as state visibility.** It is NAT-008's shared `.FilterPill`, so the **people directory
  has the same invisible selection**. ✅ Cheapest real fix: move the state onto the **border**, the
  one edge already at 3.57:1 — not a brighter fill. ⚠️ Must be measured in **both** themes.
- ⚠️ **The platform sends `firstReplyMinutes: null` on a thread with `replyCount: 1`**, so the
  accepted thread reads *"no reply yet"* on every surface, web included. Unowned.
- ⚠️ **`MIRROR_THREAD_WINDOW = 100` is a copy of the platform's limit and nothing checks it.** If the
  platform *lowers* its limit the bound line silently stops drawing while the list really is
  partial. Three lines in `nodegx-community`'s `mirror.ts` + `route.ts` to send the window it used.
- ⚠️ `.property-port-gate-target`'s outline and `.Bench`'s gutter are both unmeasured in pixels.
- ⚠️ **Only `Group` was driven** for FB-021; the other 174 types are covered by the catalog sweep,
  which grades *sentences*, not rendering.
- ⚠️ FB-022's crosshair settled by mechanism, not pixels; **one commit in three dropped focus,
  uncharacterised**; FB-016's auto-margin branch never exercised in a running app.
- ⚠️ **`AskAboutNodeDialog.module.scss` uncommitted — fourteenth session.** Belongs to no session;
  Richard's call. Same for the phase-70/71/72 working files and the phase-50/68 notes.
- The highlighter's disposal bug: a **selected** node whose element has gone is never removed from
  `selectedNodes`, so it is revisited and `remove()`d every frame.
- Unchased: `SidebarModel.switch('PortEditor')` crashes the panel; Settings clips two rows; a
  `Number` node draws a group literally called `ADVANCED` beside the synthetic `Advanced CSS`;
  `getConnectionSourceLabel` returns nothing for the checkbox row; `check:css` in `nodegx-community`
  has one pre-existing non-ours violation.
- ⚠️ **Pre-existing, not ours**: the projects page logs `Encountered two children with the same key`
  for one project id, and `feed.json` 404s.
