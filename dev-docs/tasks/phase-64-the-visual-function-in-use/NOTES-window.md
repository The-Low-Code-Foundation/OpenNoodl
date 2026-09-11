# VFN-004 — the window says where it belongs

Session notes, branch `vfn-window` (worktree, forked from `cline-dev` at `76dfece7`).

---

## What was built

Five files changed, four added. The shape is: **one pure module holds every decision, one impure
module holds every touch of the project and the canvas, and the React component holds neither.**

| File | Role |
| --- | --- |
| `views/CanvasTabs/tabLocation.ts` *(new)* | Every decision, pure, **imports nothing**. Label, truncation, cross-tab disambiguation, the away predicate, the activation decision, the two refusal sentences, the reopen-refresh diff. |
| `views/CanvasTabs/tabNavigation.ts` *(new)* | The only place the Logic Builder navigates. Component-by-id lookup, live name resolution, `switchToComponent`, the toasts. |
| `views/CanvasTabs/useActiveComponentId.ts` *(new)* | Reads the canvas's active component id and keeps it current. A derivation, not a store. |
| `tests-unit/vfn-004/tab-location.test.ts` *(new)* | 52 specs. |
| `views/CanvasTabs/CanvasTabs.tsx` | Renders `Component · Node` in three spans, the away ring, the tooltip; click → `switchTab` + `onTabActivate`. |
| `views/CanvasTabs/CanvasTabs.module.scss` | `.TabComponent` / `.TabSeparator` / `.TabNode` / `.AwayMark` / `.Tab.isAway`. |
| `contexts/CanvasTabsContext.tsx` | `Tab` gains `componentId`, `componentName`, `componentPath`; reopening a tab refreshes them. |
| `views/nodegrapheditor/OverlayViews.ts` | Supplies `onTabActivate: navigateToTabComponent`. |
| `.../DataTypes/LogicBuilderWorkspaceType.ts` | Reads `node.owner.owner` at the emit site and puts the component on the event. |

### The one thing that was already on disk

The component was **one dereference** from the emit site the whole time. `NodeGraphNode.owner` is
the `NodeGraphModel`; `NodeGraphModel.owner` is the `ComponentModel`. The exporter, the compiler
and `ViewerConnection` all do that walk. Nothing was plumbed — a field was read.

### The trap, and what was done instead

🔴 `Router.route()` early-returns when `this._route === args.to`, so editor→editor it is a **silent
no-op** that is indistinguishable from a dead click handler. It is not used. `navigateToTabComponent`
goes through `NodeGraphContextTmp.switchToComponent` — the door the components panel, the search
panel, the problems panel and the provenance panel all use.

Read back rather than assumed, in `views/nodegrapheditor.ts:556-662`:

- the component-swap work (rebind, history push, `HighlightManager`) is **inside**
  `if (this.activeComponent !== component)`, so passing the component already on screen rebinds
  nothing and pushes no history;
- the `args?.node` branch runs **regardless**, and does `clearSelection()` → `selectNode(node)` →
  `moveRoots(...)` to centre it;
- it re-finds the node by `.id` in the graph it has just bound, so `{ id: nodeId }` is the honest
  argument (`ProblemsPanel` and `ChangeReviewDocument` pass the same stand-in).

That is why "navigate" and "select in place" are one call with a different `pushHistory`, rather
than two code paths that can drift apart.

### Navigation identity

**`ComponentModel.id`, never a name.** Checked that ids are real rather than theoretical: all 21
components of `dev-docs/qa-fixtures/nodegx-qa-fixture/project.json` carry one, and all four
`new ComponentModel(...)` creation sites in the editor pass `guid()`. `ProjectModel` has no lookup
by id, so `findComponentById` scans `getComponents()` — once per tab click.

Names are **display only**, and are re-resolved from the id on every render so a rename reaches
the label. The snapshot is the fallback, which is correct: the only case the project cannot answer
for is a component that has been deleted, and that is exactly when the snapshot is all there is.

### No second source of truth

- The window's open-ness is still derived from which tabs are open **and nothing else**;
  `closeTabs` is still one transition and still the only emitter of `LogicBuilder.AllTabsClosed`.
  Neither was touched.
- The active component is **read** from `NodeGraphEditor` via `activeComponentChanged`, seeded
  from the live value at mount. `useActiveComponentId` stores no state of its own beyond the copy
  React needs to re-render, and never writes back. Same shape `ExecutionOverlay` uses.

### The away mark is a shape

A hollow ring (`border: 1.5px solid currentColor`, 7 px) that is **absent from the DOM** when the
canvas is showing the tab's component, plus the component segment in italic. Neither is a colour,
so both survive a screenshot and a greyscale print. The same fact is in the tab's `title` in words
(`aria-hidden` on the ring, so it is announced once and not twice).

`data-away="true|false"` and `data-test="logic-builder-tab"` are on the tab element, so a drive can
assert the state without reading pixels.

---

## Proved

`cd packages/noodl-editor && npx jest` — **158 suites / 2317 passing**. Baseline was 157 / 2265;
the delta is exactly this task's one suite and its 52 specs. `npx tsc -p tsconfig.json --noEmit`:
**0 errors**, and `--listFiles` confirms all four new modules are in the program (a clean typecheck
of files the compiler never opened is the failure mode being ruled out here).

### The negative controls were driven red, not asserted to exist

🔴 A suite of absences is indistinguishable from an instrument that measured nothing. Each
implementation was mutated to its constant form and the suite re-run; the file was restored and
the suite re-run green each time.

| Mutation | Specs that went red |
| --- | --- |
| `isTabAway` → `return true` | 4 |
| `tabActivation` → `return 'navigate'` | 5 |
| `truncateWithEllipsis` → `return value` | 5 |
| `componentGoneMessage` → `return ''` (the silent-refusal shape) | 5 |
| `tabLabel` → drop the component half | 5 |
| `tabLocationRefresh` → always report a change | 3 |
| `componentLabelsFor` → always the short name | 4 |

In every case the *named* control spec was among the failures, so the controls are not decorative.

### Criteria the specs actually cover

| AC | Status | What was graded |
| --- | --- | --- |
| 1 — tab reads `Component · Node` | ✅ **decision proved** | Label shape, no "Logic Builder", component-side-only truncation, `Unnamed` fallback, no dangling separator. Not the rendered pixels. |
| 2 — click navigates and leaves the node selected | ✅ **proved and DRIVEN (session D)** | `tabActivation` returns `navigate`. That `switchToComponent` then changes the canvas was read from its source when this was written — it is now measured live: `activeComponent` → `/ErgCodes`, selection `['c6']`. |
| 3 — click while already there selects and navigates nowhere | ✅ **proved and DRIVEN (session D)** | `tabActivation` returns `select` and `pushHistory` is `false`. Confirmed live: selection `['c6']`, component unchanged. |
| 4 — away mark present exactly when away | 🟡 **predicate proved, DRIVEN in both states; contrast owed** | Both polarities, plus "no component open" and the never-mark-a-locationless-tab rule. Captured live: **italic when away, upright when home, identical colour** — shape only. 🔴 `--theme-color-fg-default-shy` on the tab background is still unmeasured. |
| 5 — two tabs distinguishable from the labels alone | ✅ **proved** | Including the hard case: two components sharing a last path segment (`/Admin/Home`, `/Pages/Home`) fall back to full paths when both tabs are open. |
| 6 — deleted component leaves the tab open with a named refusal | 🟡 **decision and sentence proved, toast owed** | `refuse-missing` is returned, the message names the component and says the blocks stay. That `ToastLayer.showError` renders is not graded. |

---

## Owed — **updated after DRIVE-2026-08-13-C and -D**

⚠️ This list was written before any drive. **Session C found the whole feature dead** (item 5 below
was the failure, and it was worse than this note guessed); session D fixed it and drove items 1, 2,
3 and 5. **Item 4 and half of item 3 remain owed**, along with items 6 and 7, which nobody has
looked at. See [DRIVE-2026-08-13-D.md](DRIVE-2026-08-13-D.md).

I could not drive the editor: `npm run dev` in this worktree resolves through `lerna exec` to the
**primary** checkout, so it would exercise the wrong code and kill a human's editor and MCP
servers. Every item below is a *consequence* that only the real app can report.

1. ✅ **CLOSED — the canvas actually moves (AC 2).** Driven: away → click the tab →
   `activeComponent` is `/ErgCodes` and the selection is `['c6']`, both read from the running
   editor rather than inferred from a call. 🔴 The instrument matters: **`ed.selection` does not
   exist — it is `ed.selector._selected`**, and the wrong accessor reads `[]`, which nearly filed a
   false *"navigates but does not select"*.
2. ✅ **CLOSED — clicking while already there changes no component and pushes no history (AC 3).**
   Selection `['c6']`, component unchanged.
3. 🟡 **HALF CLOSED — the away mark in a screenshot (AC 4).** Captured in both states: the away
   state renders the component segment **italic**, the home state upright, and the colour is
   `rgb(139, 149, 161)` in *both* — so the mark is **shape only**, which is what AC 4 asked for and
   is colourblind-safe by construction. 🔴 **Still owed: the contrast reading.**
   `--theme-color-fg-default-shy` has never been measured against either tab background;
   `scripts/devtools/icon-contrast.js` is the instrument, and it needs a running editor.
4. 🔴 **OWED — the toast (AC 6).** Delete the component out from under an open tab, click the tab,
   and check a named error toast appears **and** the tab and its blocks are still there.
5. 🔴 **THIS WAS THE FAILURE, AND IT WAS NOT `componentId`'s arrival — it was its *content*.** The
   `owner.owner` walk was fine; `ComponentModel.id` was `undefined` on 5 of 7 components of a v1
   project, so every tab silently never wore an away mark. Exactly the **quiet** failure this item
   predicted, one level lower down than it looked. Fixed with `componentInstanceId`
   (`models/componentIdentity.ts`) and driven. ⚠️ **The lesson generalises: check the identifier
   before blaming the mechanism.**
6. ✅ **CLOSED by consequence — `activeComponentChanged` reaches the window.** It is emitted on
   `EventDispatcher.instance` by `NodeGraphEditor.switchToComponent`, but **only inside** the
   `activeComponent !== component` guard, so the repaint was load-bearing on that guard. Session D
   navigated to `/App` and `data-away` flipped to `true` — the event arrives and the guard holds for
   the frontend graph. (Item 7 is the case it does *not* cover.)
7. 🔴 **OWED — two node graphs, one event.** The editor has a frontend and a backend `NodeGraphEditor`,
   and `activeComponentChanged` is emitted on the shared dispatcher by both while
   `useActiveComponentId` reads `NodeGraphContextTmp.nodeGraph` (the *active* one). Opening a
   backend component may or may not make a frontend tab read "away" correctly. Untested, and worth
   a deliberate look.

---

## Deliberate decisions worth not re-litigating

- **The window still does not close on navigation.** That was ruled 2026-08-13 and is untouched.
- **"Logic Builder:" is out of the tab.** The window carries `aria-label="Logic Builder"` and its
  title bar is two pixels away; the tab's width now buys the answer instead.
- **The component side truncates, never the node side.** The node name is the more specific half
  and is what tells two open tabs apart. Enforced twice and consistently: a character cap in
  `tabLocation.ts` (22) and `text-overflow: ellipsis` on `.TabComponent` alone.
- **A tab with no `componentId` is never marked away.** An absence of knowledge must not be
  published as an assertion, or a tab opened before this field existed wears a permanent
  "you are elsewhere" mark that no navigation can clear.
- **Two refusals, not one.** "This tab never learned where it came from" and "the component has
  been deleted" are different failures; collapsing them would tell a builder whose component is
  intact that it has been deleted.
- **Reopening the blocks refreshes the names but never the workspace.** The tab is *ahead* of the
  model — an edit reaches the node 300 ms after it settles — so copying the model's workspace over
  the tab would eat the author's last few seconds. There is a spec for this that offers a
  `workspace` and checks it is dropped.

## Known limitation, out of scope

`Tab.nodeName` is still a snapshot, and a node renamed while its tab is open still reads the old
name until the blocks are reopened. That is pre-existing and the task says so. It was **not** made
worse: navigation depends on ids only, and the component name is re-resolved every render, so the
snapshot is now a fallback rather than the source of truth. Doing the same for `nodeName` would
mean resolving a node id through `ProjectModel.findNodeWithId` on every render of the tab bar,
which is a different (and larger) question about how the window subscribes to the model.
