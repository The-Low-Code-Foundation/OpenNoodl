# Phase 75 — next session

**State as of 2026-08-25 (session 35).** Richard's brief is still **speed: keep knocking out phase
75**, so this file leads with the queue. Take the top unblocked item; dip into the rest when it bites.

**Committed this session:** FIX-025 §12 **driven** plus the tooltip defect that drive found, and
FIX-027 §17 **built and driven**. Two commits, `74ad7282` and `f6d25d19`.

⚠️ **Peers.** `3878` is **opennoodl-78**, this checkout. Other names are other projects.
🔴 **`SendMessage` to a cross-session peer needs the `[ref]`** — the bare name is rejected with the
ref in the error, so just re-send.

## The queue — unblocked, cheapest-first. Take the top one.

| # | item | size | state |
|---|---|---|---|
| 1 | **FIX-027 19 + 20** — the completion moment | **M** | ⬜ next up; see the trap below |
| 2 | **`refusalHeadline` reaches nobody** | **S** | found s34; 4 headlines, 0 callers |
| 3 | **FB-014** search that survives renames | **M** | design + prototype only, pgvector |
| 4 | **FB-005** templates | **S then L+** | **scope doc first** — that doc is the unblocked part |
| 5 | **FB-013** chat | **L** | 🔴 **ruled 08-22: OVERRULED, build it.** Pulls in FB-014's 2nd corpus |

✅ **FIX-025 is fully driven bar two items that are not ours to unblock** — §5 needs Richard signed
*out* of his live community session, §7 needs a real answered thread *and* a platform data fix. Both
are re-scoped in the task file; neither is a queue item any more.

✅ **FIX-027 §17 is CLOSED** — built, driven, and acceptance criterion 4 is met.

🔴 **Before starting item 1, read FIX-027's own warning about it.** 19/20 is *"finishing a lesson
says so, and offers both reset and exit"*, and `reset()` **refuses in two cases** — a platform
lesson, and a local one whose source bundle has gone. *State on a page*'s source is a `/tmp` path
that does not survive a reboot. **A Reset button offered at the completion moment must handle the
refusal**, or it fails in front of the learner at the worst possible moment. That is a decision
about where a pristine copy lives, and `FIX-026-PUT-IT-BACK.md` already holds the argument.

**Blocked on Richard, do not start:** FB-012 and FB-009 (both need *content*), FB-017 scope 2's
`Source Set`, FIX-026 (a)/(b), FIX-027 14/15/16 + 22, tsfixme baseline, prod `ANTHROPIC_API_KEY`
(⚠️ **intro pricing ends 2026-08-31 — six days**), the 15 lessons' prose, Discord's row in the `?`
menu, `/rfps` search.

✅ **Nothing is waiting to deploy.** ⚠️ The *stamp on the box* is still relayed from s19's SSH read —
re-read it before any deploy claim.

## 🔴 The finding of this session: TWO RIGHT SURFACES HID A WRONG THIRD

FIX-025 §12 raises a warning when a wire connects a `string` to a `number` or `boolean` port — the
cast the table permits and the runtime does not perform. Driving it showed the warning reaching the
builder three ways. **Two of them were right, and either one alone would have closed the bug:**

| surface | verdict |
|---|---|
| the wire goes **dashed** on the canvas | ✅ right |
| the **Warnings panel** lists it, naming the connection | ✅ right |
| **hovering the wire** | 🔴 *"This connects a / string / to a / number / port, and…"* — one word per line |

`.popup-layer-tooltip-content` was `display: flex; flex-direction: column`. **A flex container has
no inline formatting context**, so every child is blockified — each `<strong>` *and each bare run of
text between them* becomes its own flex item on its own line. Measured live:
`getComputedStyle(strong).display === 'block'`.

⚠️ **It was never specific to the new warning.** `con-type-mismatch` builds its message the same
way, so every type warning has hovered like that since it was written. The new sentence is simply
long enough that it cannot be missed.

✅ **Carry this**: when a fix reaches the user by more than one surface, *render every one of them*.
The model held the correct string, and two of three surfaces drew it correctly. Reading the model,
or checking either good surface, would have certified a defect that was on screen.

## ✅ Second: FIX-027 §17 built, and the reason it is not a one-line flag flip

A task step never showed its own instructions, because `LessonLayerView` passed
`showPopupWhenSelected={hasConditions === false}` — every task has conditions, so every task was
excluded. **Inverting that flag is worse than the bug**: the effect depends on
`[isSelected, popupContent]`, `loadSteps` rebuilds `popupContent` on every lesson reload, and
`refresh()` fires one on every `Model.*` event — so a flag re-opens the popup on top of the graph
the learner is editing. The flag is gone; `lessoninstructionopen.ts` decides on the **edge** into a
step and remembers a dismissal.

🔴 **The measurement that makes it a fix rather than a hope.** *"The popup stayed dismissed"* and
*"nothing re-rendered"* are the same observation. `refresh` was wrapped and counted: three real
`setParameter` writes drove it **7 times**, and the popup stayed shut. Without that number the drive
proves nothing.

🔴 **And no gate in this repo compiles either file.** `LessonItem.jsx` and `LessonLayerView.jsx` are
`.jsx`; `packages/noodl-editor/tsconfig.json` does not set `allowJs`. ⚠️ **And `test:ci` does not
cover them either** — contrary to what the standing memory says about `.jsx` files. Checked
empirically: the only occurrence of `LessonItem.jsx` in `tests/index.bundle.js` is a **comment
inside `lessonformat.ts`**; neither view is in the tests graph, because `tests/lessons/` grades
`lessonevalconditions`, `lessonformat` and `worked-lesson`, not the views. **Running the app is the
only thing that reads them.**

## Carried from session 34, still worth reading

- 🔴 **Two correct functions composed a forbidden sentence.** FB-021 requires that *"N ports this
  wire can't reach"* never appear over a switched-off port. `refusedGroupSummary` was right and
  specced; `dominantReason` was right and specced; a mixed group of 8 gated ports and one
  type-mismatched `Focus` made them compose the forbidden line. ✅ **Assert the forbidden output
  over the COMPOSED result, not over each contributor** — and ask what a summary says when the set
  holds **both** kinds, because a homogeneous fixture never reaches it.
- 🔴 **`refusalHeadline` has no caller** — queue item 2. `grep -rn refusalHeadline packages/` finds
  the definition and two test files; nothing in `src/`. Session 33 *mutation-checked* that branch
  and it passed, because a mutant changes the output and the spec reads the output — **it dies
  whether or not anything calls the function.** ✅ **Mutation proves the spec reads the function;
  only a caller-grep proves the function reaches the user.**

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

### 🆕 Added this session

🔴 **DRIVING A LESSON WRITES TO RICHARD'S OWN PROGRESS.** Both lessons exist only in
`~/Library/Application Support/NodeGX/Learning` — there is no copy to drive. Opening one writes to
it and `model.next()` advances his progress **for real**. ✅ `cp -R` the whole `Learning` directory
first, restore after, and **verify by checksum**, not by eye:

```bash
find "$L" -type f -exec md5 -q {} \; | sort | md5 -q     # 57 files → c346394c…
```

✅ **Two-step open from the launcher, and the first call does NOT open anything.**
`openProjectFromFolder` only *adds* an unknown folder to the list — `loadProject` runs on the
second call, and **neither sets `ProjectModel.instance` nor routes**. The launcher card's own
handler does (`ProjectsPage.tsx:1042`). Simplest reliable route: call it once to register the
folder, then **click the card** — tag it with `setAttribute('data-drive',…)` from `eval`, because
`cdp click` takes a selector only.

✅ **Reaching a view instance: wrap its prototype method and let the app call it.**
`window.__wr.c['./src/editor/src/views/lessonlayer2.ts'].exports.LessonLayer.prototype.refresh` —
wrap it, poke a `setParameter`, and `this` arrives. ⚠️ The module's export is **named**
(`LessonLayer`), not `default`; assuming `default` throws inside the eval and the error is easy to
miss in the tail of the output.

✅ **A canvas wire's own handler can be driven directly**, which beats synthesising a canvas
hit-test: `conn.mouse('move', conn.pointOnCurve(0.5), {button:0, pageX, pageY})` runs the real
`hitTest` → `showTooltip` path. Read the result off
`PopupLayer.instance.tooltipContent.innerHTML`.

⚠️ **Don't filter the DOM for tooltip text with `children.length === 0`** — the tooltip's container
has `<strong>` children, so that filter finds nothing and reads as "not rendered".

✅ **`detectIO` headlessly, before launching anything.** A Visual Function fixture's ports can be
confirmed in two seconds from plain Node, so a silent readout later cannot be blamed on a fixture
that never published the ports. Worth doing every time a drive depends on a hand-written workspace.


## Gates, this tree (OpenNoodl, `cline-dev`) — 🔴 re-measure, never quote

- `npm run test:ci`: **2849 / 4 — THE FLOOR**, all four `AIX-006 style vocabulary`, **matched by
  name**. Default ceiling, run alone with the stack down, 19:50 → 20:05. ✅ Grades the FIX-025 §12
  tooltip fix. ⚠️ **It does NOT grade FIX-027 §17** — that landed after this run's webpack, and
  nothing in the tests graph compiles the lesson views anyway (see above).
- `npm run test:main`: **338 files / 5457 specs / 0 failures** (was 337/5448 after the §12 spec, and
  336/5444 at the start of the session; +2 files, +13 specs over the session).
- `npm run typecheck:editor`: **0 errors**, twice.
- `npm run tokens:css`: clean — *"every `var(--…)` in 319 stylesheets names a defined property."*
- 🔴 **`tsc -p packages/noodl-editor/tsconfig.tests-main.json` is NOT a gate and reports 31 errors**
  — re-confirmed 08-25, unchanged, in `erg-005/componentContract.pending.ts`, `nodegrapheditor.ts`,
  `NodeGraphContext.tsx`, `UseCanvasView.ts`, `Icon.tsx`. **None ours.** It is only ts-jest's
  `tsconfig`; no npm script or workflow runs it.
- Not run, nothing touched them: `typecheck:viewer`, `typecheck:core-ui` (a known 44-error dirty
  gate), `noodl-runtime`, all of `nodegx-community`.

🔴 **The completion notification said "exit code 0" over a log whose last line is `exited 1` and
whose summary says `4 failures`. EIGHTH session.** ✅ **Completion is the summary line, never an
exit code.** Poll with `until grep -qE "Jasmine: [0-9]+ specs"`.

## Still open, owned by nobody

- **`refusalHeadline`'s four headlines reach nobody** — queue item 2 above.
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
  accepted thread reads *"no reply yet"* on every surface, web included. Unowned — and it is
  **FIX-025 §7's second cause**, which the editor-side fix cannot reach. 🔴 **Do not patch
  `replyLatency` to look at `replyCount` without deciding the other half**: its own docstring says
  `null` minutes is what the health readout counts as `unreplied`, so the **tab's count is wrong by
  the same data** and fixing only the row leaves the two disagreeing on screen.
- ⚠️ **`MIRROR_THREAD_WINDOW = 100` is a copy of the platform's limit and nothing checks it.** If the
  platform *lowers* its limit the bound line silently stops drawing while the list really is
  partial. Three lines in `nodegx-community`'s `mirror.ts` + `route.ts` to send the window it used.
- ⚠️ `.property-port-gate-target`'s outline and `.Bench`'s gutter are both unmeasured in pixels.
- ⚠️ **Only `Group` was driven** for FB-021; the other 174 types are covered by the catalog sweep,
  which grades *sentences*, not rendering.
- ⚠️ FB-022's crosshair settled by mechanism, not pixels; **one commit in three dropped focus,
  uncharacterised**; FB-016's auto-margin branch never exercised in a running app.
- ⚠️ **`AskAboutNodeDialog.module.scss` uncommitted — fifteenth session.** Belongs to no session;
  Richard's call. Same for the phase-70/71/72 working files and the phase-50/68 notes.
- The highlighter's disposal bug: a **selected** node whose element has gone is never removed from
  `selectedNodes`, so it is revisited and `remove()`d every frame.
- Unchased: `SidebarModel.switch('PortEditor')` crashes the panel; Settings clips two rows; a
  `Number` node draws a group literally called `ADVANCED` beside the synthetic `Advanced CSS`;
  `getConnectionSourceLabel` returns nothing for the checkbox row; `check:css` in `nodegx-community`
  has one pre-existing non-ours violation.
- ⚠️ **Pre-existing, not ours**: the projects page logs `Encountered two children with the same key`
  for one project id, and `feed.json` 404s.
- 🆕 ⚠️ **A wire warning is silent for two seconds after you draw it.** `EVALUATE_HEALTH_DEBOUNCE_MS`
  is 2000 and the urgent lane is 50; `con-type-unconverted` is deliberately on the lazy one.
  Measured: absent at +0.5 s, present at +4 s. Working as designed, but Richard's original *"it
  didn't throw an error"* has a two-second window in which it is still true.
- 🆕 ⚠️ **A tooltip has no `max-width`,** so a long health message draws a very wide box — 1074 px
  for the `number` sentence in a 1368 px window. It fits today and wraps rather than overflowing;
  on a narrow window it is untested. `.popup-layer-tooltip-content p` caps at 268 px, but bare
  inline markup is capped by nothing.
