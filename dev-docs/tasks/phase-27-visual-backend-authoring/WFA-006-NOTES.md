# WFA-006 — Notes

**Status:** ✅ Complete. Every success criterion driven in the running editor and screenshotted; the
live pass found and fixed one defect in this task's own code.
**Spec:** [WFA-006-STEP-TO-FUNCTION-DESCENT.md](./WFA-006-STEP-TO-FUNCTION-DESCENT.md) ·
**Decisions:** [WFA-006-ASSESSMENT.md](./WFA-006-ASSESSMENT.md)

**Commits**

| Commit | What |
|---|---|
| (assessment) | The step-1 and step-7 decisions, and the walker audit, written before any code |
| `d6ccd115` | Resolution, the card, the descent, the trail crumb, the reverse lookup, F54 |
| (this) | The live pass, and a row that painted the old name beside the new name's answer |

**Screenshots:** [screenshots/wfa-006/](./screenshots/wfa-006/)

---

## The headline: two stores, and the difference is the feature

A workflow step and a cloud function live in different places and are allowed to disagree — the step
in a backend's data directory, the function in the project. Everything in this task falls out of
refusing to collapse that:

```
inProject   ProjectModel has /#__cloud__/<ref>          true | false      (always knowable)
deployed    <ref> in GET /admin/workflows.functions      true | false | null
```

`deployed`'s third value is WFA-005's, reused rather than reinvented: **"the backend could not be
asked" is never reported as "it is not there"**, because a wrong warning about a working step is
worse than no warning. The two facts derive four states — `resolved-in-project`, `deployed-only`,
`unresolved`, `unknown` — plus `unnamed` for a step that names nothing yet, which the backend refuses
to save anyway (`kind "call-function" needs a ref`). One function answers, and the card, the property
editor, the right-click menu and the descent all read it, so none of them can disagree.

**Which step kinds:** never a list. `spec.invokesFunction` comes from the served catalog, so
`for-each` is covered without being named — which is what the spec's Out of Scope asks for ("it is
the same descent"). Live, `Each order line` reads `For Each · chargeLine · not found` with the same
danger ring as the two `call-function` steps beside it.

## What each state does, and what it deliberately does not

| State | Card | Warning | Double-click |
|---|---|---|---|
| `resolved-in-project`, deployed | `Retry · chargeCard` | — | descends |
| `resolved-in-project`, not deployed | `… · in this project · not deployed yet` | — | descends; the row offers **Deploy it** |
| `deployed-only` | `… · deployed, not in this project` | — | says so, offers nothing clever (Out of Scope) |
| `unresolved` | `… · not found` | dashed danger ring + ⚠ | says it will fail at run time |
| `unnamed` | `Retry` | dashed danger ring + ⚠ | says the backend will refuse to save it |
| `unknown` | `Retry · chargeCard` — **nothing** | — | says the backend could not be asked |

`deployed-only` and `unknown` are **not** warnings, and that is the whole discipline: the first is a
legitimate state (a function deployed from another project) and the second is an unanswered question.
`unknown` also says nothing on the *card*, because the answer has not arrived yet and a card reading
"cannot check" on every step until the fetch lands is noise — the property editor says it, because
selecting a step is asking.

The visible-without-interaction half rides `WarningsModel`, which the painter already reads for the
dashed danger ring and the glyph, so **no painter changed**. Those warnings are filed under the
workflow adapter's name and are not `showGlobally`, so they count towards the toolbar badge only
while that workflow is the open canvas — confirmed live (⚠ 3 on All Nine Kinds, ⚠ 1 on Order
Pipeline, and it fell to ⚠ 2 the moment the function was created).

## The descent, and the two shared surfaces it touches

The canvas learns nothing. It asks the graph model whether it wants the gesture:

```ts
const graph = editor.model as unknown as { handleDoubleClick?: (nodeId: string) => boolean };
if (typeof graph?.handleDoubleClick === 'function' && graph.handleDoubleClick(node.model.id)) return;
```

— the same shape as WFA-004's `getContextMenuActions` hook, and the same reason: the knowledge of
what a node points at stays in the graph.

**The trail crumb is a normal trail item.** The way back is `descentFor(componentName)`, a pointer in
its own tiny module (`workflowDescent.ts`) rather than a field on `WorkflowEditorService`, because
the trail renderer, the document and the service would otherwise form an import cycle for the sake of
one pointer. `OverlayViews.updateTitle` prepends an item carrying the workflow's own canvas adapter,
so clicking it goes through exactly the `switchToComponent` path every other crumb goes through. The
shared `NodeGraphComponentTrail` component gained **one optional slot** and nothing else — an
ordinary component's trail takes the code path it took before, which is what the spec's
shared-trail trap asks for and what the live pass re-checked.

It is a **pointer, not a mode**: `descentFor` answers only for the exact function the descent landed
on, so navigating anywhere else stops matching and the crumb disappears with nothing to tear down.
Confirmed live twice — once by opening the same function from the Components panel (chips, no crumb)
and once by clicking the crumb back (crumb gone, bar reads `SQLite backend › Order Pipeline`).

**F48 is closed as a rule rather than per caller.** `NavigationHistory` resolves entries through
`ProjectModel.getComponentWithName`, which cannot find a workflow, so an entry pushed for one is a
dead stop. WFA-004 kept workflows out by passing `pushHistory: false` at its one call site; this task
adds a second door, and a rule every caller must remember is a rule that gets forgotten. It is now
decided by runtime type in `switchToComponent`, where the runtime type has just been computed.

## Step 1's answer: `NodeReferencesPanel` could not be reused

Recorded in full in the assessment §1, before anything was built. Every load-bearing assumption in
that panel is false for a workflow: it indexes `ProjectModel` synchronously by node **type**, and a
workflow is in no project, has no nodes, is fetched **per backend** over IPC and may be unreachable.
Reusing it would have meant replacing everything except the file name. It is also registered
`experimental: true`, so it is not in the rail — the state WFA-002 found Execution History in (F18).

What was built instead is in the bar the descent's crumb lands in: **Used by 2 workflows**, opening a
menu of `<backend> · <workflow>` entries that open that workflow, and **Deploy to SQLite backend**
beside it. The descent and its reverse then live in the same strip of screen.

## F54 — found by reading, before any of it

`fetchTriggerTargets` read `GET /admin/workflows`'s `functions: {name, workflow}[]` as
`status.functions.map(String)`, which yields `["[object Object]"]`. Two consequences in WFA-005's
shipped surface: the trigger target picker listed a placeholder instead of the function names, and
`isTargetResolved` then answered **false for a function that is deployed** — precisely the wrong
warning about a working trigger that its own `null` state exists to prevent.

It was invisible in WFA-005's live pass for the reason its notes record: *"With no functions deployed
the picker said 'No functions on this backend'"*. WFA-006 reads the same list, so there is now one
reader (`deployedFunctionNames`) with a spec that asserts the object shape the backend actually
serves.

## §7 — the decision, and the correction the test forced

**A rename does not rewrite backend-held workflow definitions.** Six reasons in the assessment §2;
the first is decisive on its own: `BackendManager.createBackend` initialises `projectIds: []` and
nothing ever writes to it (WFA-001), so "this project's backends" is *every running local backend* —
a rename in one project would rewrite definitions another project is authoring against.

**Writing the test corrected the spec's own wording, and the live pass confirmed the correction.**
Success criterion 7 says a rename makes referencing steps show as *unresolved*. Immediately after a
rename that is false, and saying it would be its own wrong warning: the backend is still serving the
function under the old name, so **the step still runs**. Live, in one sequence:

| Moment | State | Card |
|---|---|---|
| before | `resolved-in-project` | `Retry · chargeCard` |
| rename `chargeCard` → `chargeCardV2` | `deployed-only` | `… · deployed, not in this project`, still healthy |
| the autosave push lands | `unresolved` | `… · not found`, danger ring |
| retarget from the row's `chargeCardV2` chip | `resolved-in-project` | `Retry · chargeCardV2` |

Which is also the strongest argument for the decision: an automatic fix-up at rename time would
rewrite a step that is **working**. The definition's `ref` was never touched at any stage —
`toInput()` still read `chargeCard` throughout.

Retargeting is one click because the row lists the names that exist, labelled by where they are:
*In this project* and *Deployed on SQLite backend, not in this project*. Deliberately not merged into
one list — one of those is a graph you can open and the other is not.

## The walker audit (assessment §4)

The F49/F51 shape — a shared structure growing a member every existing walker assumed could not
exist — has bitten this phase twice, so every walker was re-read before building. Nothing needed
changing, and the reason is worth stating: **resolution state is not a parameter**. It lives in
`metadata` and in `WarningsModel`, neither of which `toInput` walks, so the card grew and the step
did not. There is a spec asserting exactly that (`JSON.stringify(step)` contains no resolution text),
because a param the backend does not know is a 400 on save.

`ExecutionOverlay` needed nothing either, and by design rather than luck: it recomputes
`getNodeBounds` per render precisely because "the open graph changes underneath us". Descending
mid-pin is that case, and it was seen live doing the right thing — *"Showing 2 of 6 steps — 4 are not
in this graph"* while a pinned Order Pipeline run was viewed over the All Nine Kinds canvas.

## Tests

- **`tests/workflow/functionrefresolution.test.ts` — 15 specs** on the pure helper: all five states,
  that being in the project wins even when the backend was never asked, that `deployed-only` and
  `unknown` are not "broken", the prefix convention (anchored, so `/Utils/#__cloud__/x` is not a
  cloud function), and F54's object-shaped list including the "an initialised backend with no
  functions is an ANSWER" case that makes "not deployed" sayable at all.
- **`tests/workflow/functiondescent.test.ts` — 17 specs** on the document: what each state puts on
  the card, that only a broken step is flagged, that `for-each` is covered from
  `spec.invokesFunction` rather than a list, the §7 rename in both its stages, the suggestion
  labelling, the `ref` port type, and the walker invariant above.
- **Editor 1823 specs / 0 failures** (was 1791). **Backend 66 suites / 715** — unchanged, because
  this task is editor-only. Editor typecheck clean, hex-colour ratchet holding at 16.

**The TSFixme gate is red on `cline-dev` and was already red before this task.** Measured rather than
assumed: `git archive HEAD` into a clean tree scores **TSFixme +16 / any +9** against a baseline
pinned at `b22cfab0`, 48 commits back. WFA-006 adds **+1 and +1** — one `args: TSFixme` consistent
with the five sibling `TypeView`s in the same file, and the `(window as any).require('electron')`
idiom every renderer client module uses. Deliberately **not** re-baselined here: doing so would
launder 48 commits of someone else's drift into this commit, and PLAT-004's rule is to raise it
deliberately and say so. Filed as **F55**.

## The live pass

Driven over CDP against the real SQLite backend on `:8578`, from the launcher, in the `VerifyFix4`
scratch project. Zero `renderer:exception` lines across the whole session.

| Criterion | Evidence |
|---|---|
| A step whose `ref` does not resolve is visibly wrong **before any interaction** | All Nine Kinds opened with three dashed danger rings and ⚠ glyphs — `intake`, `chargeCard`, `chargeLine` — and the toolbar reading ⚠ 3, against a backend serving no functions at all ([01](./screenshots/wfa-006/01-unresolved-cards.png)) |
| All three missing-function cases produce distinct, accurate messages | `not found` / `deployed, not in this project` / `cannot check`, each in the card, the property editor and the toast, naming the backend every time ([02](./screenshots/wfa-006/02-cannot-open.png)) |
| Double-clicking a `call-function` step opens that function's graph | `charge` → `chargeCard`'s Request/Response graph ([03](./screenshots/wfa-006/03-descent-trail.png)) |
| **The trail reads `Order Pipeline › chargeCard`, with no `#__cloud__` segment** | Exactly that, with `chargeCard` as the current pill ([03](./screenshots/wfa-006/03-descent-trail.png)) |
| The crumb navigates back | Clicking `Order Pipeline` returned to the workflow canvas and the bar re-read `SQLite backend › Order Pipeline` |
| A function's canvas lists the workflows that reference it | *Used by 2 workflows* → `SQLite backend · All Nine Kinds`, `SQLite backend · Order Pipeline`; clicking the first **opened that workflow** ([04](./screenshots/wfa-006/04-used-by.png)) |
| The card updates live as the project changes | Creating `/#__cloud__/chargeCard` in the Components panel flipped `Retry · chargeCard · not found` to `Retry · chargeCard`, healthy, on a canvas that was already open — and dropped All Nine Kinds' badge from ⚠ 3 to ⚠ 2 |
| An in-project, not-yet-deployed function can be deployed from the descent | *Deploy to SQLite backend* on the function's own canvas; the toast names the backend, and `GET /health` went from `functions: []` to `[{name: "chargeCard"}]` |
| **The edit → deploy → run → inspect loop** | Same workflow, same payload, twice. Before: `charge` **ERROR**, 2 attempts, *Error routed to Log failure*, `Function "chargeCard" returned HTTP 500` ([05](./screenshots/wfa-006/05-loop-before-error.png)). Then descend, edit the function, **Deploy** from its trail, run again: `charge` **SUCCESS**, 1 attempt, `logfail` skipped, badges `✓ 7ms / ✓ 0ms / ✓ 1ms` pinned on the workflow canvas ([06](./screenshots/wfa-006/06-loop-after-success.png)) |
| Renaming makes the breakage visible | The four-stage sequence above, ending one click from repaired ([07](./screenshots/wfa-006/07-rename-broke-it.png), [08](./screenshots/wfa-006/08-resolved-row.png)) |
| Ordinary component navigation did not regress | `/#__page__/Home` trail reads `#__page__ › Home` with no chips and no crumb; double-clicking a plain `Text` node selects it, opens the property editor, stays put, and throws nothing |

### The defect the pass found — in this task's own row

The `ref` row painted **the old name beside the new name's resolution**. Two faults, one symptom:
`renderReact` read `this.value` (filled once when the row is built, refreshed only by the row's own
`write`) where every sibling type reads through `getParameter`; and the property editor does not
rebuild a row on `parametersChanged`, so nothing re-rendered it at all when the value changed from
elsewhere — an undo, MCP, or the retarget chip.

Fixed on both counts: read the parameter, and subscribe to **both** ways this row can go stale —
`parametersChanged` on the node (the value changed) and the document's `resolutionChanged` (the
*world* changed: a deploy, a backend starting, a function renamed). A row still reading "not deployed"
after you deployed it is the stalest kind of lie.

**Verifying it needed a clean restart**, and that is WFA-005's HMR trap arriving from a new angle: the
module hot-updated (the HMR log names it) but `Ports.ts` did not, so the dispatch kept handing out
the *previous* class object and the fix could not run. After a restart the row updates on both paths.

### Driving notes, on top of WFA-004's and WFA-005's

- **`setsid` does not exist on macOS.** WFA-005's launch recipe (`setsid nohup … & disown`) fails
  with `command not found` and the editor never starts — which looks exactly like a launch that
  died, because `.logs/dev.log` is never created. `nohup … < /dev/null & disown` is the recipe.
- **Kill the old instance properly.** `pkill -f "OpenNoodl/node_modules/electron/dist"` sometimes
  leaves the process alive; the second launch then prints *"Noodl is already running"*, fails to bind
  9222, and exits — and the log line that says so is 12 lines above the end. Check
  `lsof -ti:9222` is empty before relaunching, and `kill -9` the survivors.
- **Canvas nodes have no selectors.** `scripts` worth keeping are in this session's scratchpad:
  one asks the renderer for `getNodeBounds(stepId)` + `getPanAndScale()` and dispatches real
  `Input.dispatchMouseEvent` pairs at the card's **title bar** (the middle of a tall card lands on a
  port row); another clicks a viewport point with a chosen `clickCount`, which is the only way to
  produce a genuine double-click.
- **A panel's buttons move when it shows a detail.** Clicking Execution History's *Run a workflow…*
  at remembered coordinates opened an execution instead, twice. Re-read the button's box in the same
  eval that clicks it.
- **Four copies of the property editor are mounted at once** (the F34 hidden-but-mounted shape), so
  `document.querySelector` returns a zero-sized one. Filter every query on
  `getBoundingClientRect().width > 0` — the last match is the visible one.
- **F26 is still there**, met head-on: creating a cloud function prompts for its name in an 8-line
  code editor with a line-number gutter.

## Open items to hand on

| # | Item |
|---|---|
| a | **F55** — the TSFixme/`any` ratchet is red on `cline-dev` (+16/+9 at HEAD, before this task) because the baseline is pinned 48 commits back. It needs a deliberate re-baseline in a commit of its own, by someone who can say which of those markers are intended. |
| b | **F27 stands and was hit** — a Response node's dynamic parameter port does not survive the export, so a deployed function cannot return a value through one. This live pass worked around it by changing the function's *status*, not its body. It is still unowned. |
| c | The `Both Ways` trigger fixture from WFA-005 was **deleted** (its `*/2` schedule was firing into the execution list every two minutes and made the inspector unreadable). WFA-005's open item (d) said to. |
| d | Order Pipeline's `decide` condition on the local backend was `{"$path":"total"} gt 250` — a bare `total` is not a scope root, so the branch could never be true. Corrected to `{"$path":"body.total"} gt 100` and saved, which is why it now routes to `charge`. |
| e | Two edits *inside* the cloud function's own graph (the Request→Response wire, and `allowNoAuth`) were made through the model rather than by dragging on Canvas2D. The gesture under test was the descent, the deploy and the run, all of which were driven as real clicks; but the "edit it" in §8's loop is honestly a model write plus a real deploy. The property-editor toggle for `allowNoAuth` did not respond to a dispatched click at its box — worth a look, since it is a plain checkbox row every node type uses. |
