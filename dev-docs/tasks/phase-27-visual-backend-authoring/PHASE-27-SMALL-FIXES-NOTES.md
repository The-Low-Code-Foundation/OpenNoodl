# Phase 27 small fixes — F26 and F37

Two independent long-unowned defects from phase 27, done on branch `wt-fixes` off `32e3a946`, as
two commits. They share no files.

---

## F26 — every name prompt was an eight-line code editor

### What was wrong

`StringInputPopup` had exactly one appearance: a line-number gutter, a 200px-tall monospace box with
`rows={8}`, and the placeholder `// Add your comment here...`. That is a faithful port of a legacy
**node comment** template, and every other caller inherited it — including *New component name*,
which is the first prompt a user meets when creating a cloud function.

### What changed

`StringInputPopupOptions` gained two fields:

| field | default | meaning |
|---|---|---|
| `multiline?: boolean` | **`false`** | render the gutter + textarea (the comment editor) |
| `placeholder?: string` | `''`, or the comment hint when `multiline` | the empty-field hint |

The view splits into `SingleLineView` and `MultilineView` behind one `StringInputPopupView`; the
Ok/Cancel row is shared. `multiline` never changes for a live instance (it comes from constructor
options), so each variant owning its own `useState` is safe.

The single-line variant also answers **Enter** (Ok) and **Escape** (Cancel). A one-line name prompt
that cannot be answered with the key already under the user's hand is the other half of this defect.

`popuplayer.css` grew `.string-input-popup--single` (320px, instead of the comment editor's 500px)
and `.string-input-popup-singleline`. The gutter/wrapper rules are untouched and now belong to the
comment editor alone. There is a second, older copy of `.string-input-popup*` in
`src/assets/css/style.css`; it is not touched, and it still loses because `popuplayer.css` is
`require`d from `popuplayer.ts` and so is injected after the `<link>` in `index.html`.

### The call sites — all five of them

The spec said four. There are **five**, and the set is not the set the spec named.

| # | Call site | Prompt | Treatment |
|---|---|---|---|
| 1 | `views/nodegrapheditor/NodeGraphEditorNode.ts:577` (`showCommentEditPopup`) | `Comment for "<node>"` | **`multiline: true` — kept.** This is the one the code editor was written for: a node comment is free text, already `splitCommaSeparated: false`, and its current appearance is correct. |
| 2 | `views/panels/componentports.tsx:256` (`onAddPortClicked`) | `New port name` | single-line, `placeholder: 'e.g. title, subtitle'` |
| 3 | `views/panels/componentports.tsx:339` (`onAddGroupClicked`) | `New group name` | single-line, `placeholder: 'e.g. Layout'` |
| 4 | `views/panels/ComponentsPanelNew/ComponentTemplates.ts:41` (`ComponentTemplate.createPopup`) | `New component name` | single-line, `placeholder: 'e.g. ProductCard'` |
| 5 | `views/panels/ComponentsPanelNew/hooks/useComponentActions.ts:378` (`handleAddFolder`) | `New folder name` | single-line, `placeholder: 'e.g. Screens'` |

Note on #2: `performAdd` splits the value on commas, so a single line genuinely holds the whole
answer — the eight rows were never load-bearing there either.

`PageComponentTemplate.createPopup` (`ComponentTemplates.ts:222`) is a **different** React popup
(`PageComponentTemplatePopup`) and is untouched.

### ⚠️ The spec's list of callers was stale

The task statement (written 2026-07-28) named "component creation, component ports, `PropListType`
and `StringListType`". **`PropListType` and `StringListType` no longer call this popup at all** —
ERG-003 §3 replaced both add-flows with inline editing, and both files now carry a comment saying
so (`PropListInput.tsx:221`, `StringListInput.tsx:26`). In their place the current set has two
callers the spec did not know about: *New group name* and *New folder name*. Finding the callers by
grep rather than by the spec's list is what caught this.

### Could not verify

- The editor's own specs are Jasmine-in-Electron via `test:ci`, which this session must not run
  (another session holds the dev stack). `packages/noodl-editor/jest.config.js` is `testEnvironment:
  'node'` and scoped to `tests-main/` + `tests-unit/` for *pure* code — no React, no DOM — so this
  popup cannot be covered there without changing a config two sibling agents also touch. No new
  automated test for F26.
- **What was run:** `npx tsc -p packages/noodl-editor/tsconfig.json --noEmit` → **exit 0, zero
  diagnostics.** Plus reading every call site.

### The live check the orchestrator should run

Four things to look at, all in one editor session:

1. **Components panel → `+` (header) → any template** (e.g. *Visual Component*): the *New component
   name* prompt must be a **one-line field, ~320px wide**, hinting `e.g. ProductCard`, with no
   line-number gutter and no `// Add your comment here...`. Typing a name and pressing **Enter**
   must create the component.
2. **Components panel → folder row context menu → New folder**: same single-line treatment, hint
   `e.g. Screens`.
3. **Component ports panel → `+` on an input/output group**: *New port name*, single line, hint
   `e.g. title, subtitle`. `a, b` must still create **two** ports (the comma split is unchanged).
   The `+` beside a group header gives *New group name*.
4. **Right-click a node on the canvas → the comment action** (`showCommentEditPopup`): this one must
   **still** be the eight-row code box with the gutter and the `// Add your comment here...`
   placeholder. If it lost its gutter, the regression is here.

---

## F37 — a doubled workflow name in schedule-triggered executions

### ⚠️ The premise does not reproduce. There is no double composition in the code.

The report was `countOrdercountOrderss` in the execution list for a schedule-triggered run, with the
suspicion that "the trigger dispatcher's execution record vs. the engine's" composed the name twice.

`workflow_name` has **exactly three writers** in the whole monorepo (verified by grepping
`startExecution` / `createExecution` across every package — nothing outside
`execution-history/` calls either):

| writer | value written |
|---|---|
| `nodegx-backend/src/workflow/WorkflowRunner.ts:253` | `functionName` — i.e. `trigger.target.name`, verbatim |
| `nodegx-backend/src/workflow/WorkflowEngine.ts:401` | `def.name \|\| def.id` |
| `nodegx-backend/src/triggers/dispatcher.ts:248` | `input.workflowId` — i.e. `trigger.target.name`, verbatim (the loud rejection record) |

A schedule fire reaches all three depending on the target and on whether the target exists, so the
new spec drives a **real** `CronScheduler` catch-up fire into a **real** `TriggerDispatcher`,
`WorkflowRunner`/`CloudRunner`, `WorkflowSubsystem` and `ExecutionHistory`, over a bundle file named
`countOrders.workflow.json` containing `/#__cloud__/countOrders` — the exact shape the defect was
reported on — and asserts the recorded name in each of the three cases.

**All three pass on the unmodified code.** No production change was made, because there is nothing
in the composition to change.

### What was ruled out, and how

Everything between the fire and the pixel:

- **Not a doubled record either.** `StepExecutor` calls `WorkflowRunner.invokeFunction` (the
  deliberately unlogged one), so a workflow step that runs a function does not write a second
  execution record. The function-target spec asserts `rows` has length **1**.
- **Not the read path.** `store.rowToExecution` maps `workflow_name` straight through;
  `ExecutionHistory.list` and `byob-admin.listExecutions` pass rows unmodified; the editor's
  `ExecutionHistoryManager.listMerged`/`stampSource` only add `metadata.sourceId/sourceName`.
- **Not the display.** `ExecutionItem.tsx:48` and `ExecutionDetail.tsx:96` each render
  `{execution.workflowName}` alone; the backend's own admin dashboard renders `x.workflowId` alone
  (`src/admin/ui/index.html:1329`).
- **Not the value fed in.** `target.name` is written verbatim from the picked/typed name
  (`triggerEditing.ts:62,118`), from MCP (`backendTools.ts` passes the object straight through), and
  proxied unchanged by `BackendManager.js:265`. `def.name` is written verbatim by
  `WorkflowRegistry.upsert` from `WorkflowDocument.toInput()`. The deploy bundle name
  (`cloudBundleName`) is `<safe project name>-<hash>` and never touches the function name.
- **Not a since-fixed regression.** The last commit to touch `triggers/`, `workflow/` or
  `execution-history/` is `46093239` (WFA-008) — phase 27's own tail. The code has not moved since
  the observation.

### The one reading that survives — unconfirmed

`countOrdercountOrderss` and `countOrderscountOrders` are **anagrams of each other**: same 22
characters, the two `s`es in different places. The second is exactly `name + name`. That is what a
human transcribing a long camelCase string by eye from a screenshot produces. Since no code composes
`name + name`, the likeliest remaining explanation is that the *stored* `target.name` on that QA
backend was itself doubled — typed, pasted, or written by an agent through
`create_backend_trigger`, which accepts any string. `WorkflowRunner.run` then records it verbatim,
which is correct behaviour: a trigger pointing at a function that does not exist is supposed to show
its name and fail loudly, and the third spec case pins exactly that.

**If the orchestrator can still reach that backend's `triggers.json`, reading `target.name` on the
schedule trigger settles it in one line.** Without it, this is where the evidence stops.

### What shipped

`packages/nodegx-backend/tests/triggers-schedule-name.test.ts` — 3 specs, the requested "fire a
schedule and assert the name", now standing as a regression guard over all three writers rather than
over one. **Run: `npx jest tests/triggers-schedule-name.test.ts` from
`packages/nodegx-backend` → 3 passed, 3 total.** (Run directly, not via `lerna exec`, which resolves
the package root to the primary checkout.)

### Could not verify

- No live QA of the execution list: this session must not launch the editor.
- Whether the original `countOrders` trigger definition was itself doubled. That data is on the QA
  backend's data directory, not in the repo.

---

## Collision risk with sibling agents

- **WFA-009** (dynamic ports on the cloud Response node — `nodelibrary.ts`, the exporter, the
  generated cloud node library): **no overlap.** F26 touches only `PopupLayer/`, `popuplayer.css`,
  `componentports.tsx`, `ComponentTemplates.ts`, `useComponentActions.ts` and
  `NodeGraphEditorNode.ts`. F37 adds one new file under `packages/nodegx-backend/tests/`.
- **WFA-007** (workflow canvas / AI proposal review): **no overlap.** Nothing here touches
  `models/workflow/`, the workflow canvas views, or any trigger source file — F37 changed **no**
  production code at all.
- `PROGRESS.md` and `OPEN-WORK.md` were deliberately not edited; F26's row and F37's row are the
  orchestrator's to update at merge time.
