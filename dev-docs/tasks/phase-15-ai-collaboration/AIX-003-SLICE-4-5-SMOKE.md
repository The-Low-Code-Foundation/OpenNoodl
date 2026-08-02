# AIX-003 — the slice-4/5 UI pass, and the asset that made it possible

_2026-08-02. Commits `74c4b4a8` (fix + spec) and `e3838bf5` (the asset).
Provider spend: **$0.00** — this pass makes no provider calls at all._

The slice-4/5 UI smoke had been owed across three sessions. It is done, and it
found a defect that made the change rail's central interaction unusable.

## Why it kept not happening

The change-review document cannot be reached without a staged candidate, and
staging one meant paying a provider and waiting on a model. The previous session
tried to sidestep that by mounting `ChangeReviewDocument` directly through the
webpack-require probe; it rendered nothing (`Element type is invalid … got:
undefined`) and was recorded as attempted-not-completed. That was the right call
— the document normally arrives through `AppRegistry`'s document path, which
ad-hoc mounting bypasses, so even a successful hand-mount would have been
smoke-testing something the app never does.

## The asset

`packages/noodl-editor/scripts/aix15-live/scripted-session.js`

The seam is the **provider boundary and nothing else**. `AiClient` is a plain
object literal, so two properties can be replaced at runtime in the running
editor:

- `chatStream` → replays a recorded candidate as a `submit_component` tool call,
  streaming its arguments in chunks so the preview canvas's partial-payload
  scanner runs the same path it runs live;
- `isConfigured` → `true`, so the panel enables its button with no API key
  present. There is no key to leak: this is genuinely no-provider, not
  cheap-provider.

`AuthoringSession` resolves `AiClient.chatStream` at call time, so the patch also
takes effect on sessions already built. Everything downstream is the app's own
code: the Build panel, the session loop, the SUB-006 gate, the style lint,
`AppRegistry`. The script fills the panel's fields, presses its real button,
waits for the staged summary, and presses "Review changes".

### It is a check, not just a stager

| Check | What it actually tests |
|---|---|
| staged nodes / connections vs the recording | the inverse of `buildCandidate` — drop a field it needed and the gate rejects or stages something smaller |
| rail row count vs `<slug>.changes.json` | the diff adapter end to end: the **live** base plus the recorded candidate must reproduce the change set recorded beside it |
| turn count vs the editor's own style lint | AIX-006 gives a candidate with raw values exactly one advisory pass |
| session mode vs `isNewComponent` | the panel routed to `createUpdate` or `create` as the recording did |

**All four recordings pass, 20/20**, in both create and update mode, 15–40 nodes.
The rail's summary line reproduces the recorded run's wording exactly — for
example `share-popup` renders "1 addition, 11 changes", the same string the
live-provider run recorded.

## 🔴 The defect the smoke existed to find

**Clicking any change row, or "Walk through", closed the review document** and
returned the app to the editor document, ~246 React warnings deep. Traced with a
patched `AppRegistry.openDocument`:

```
switchToComponent(component, { node })      nodegrapheditor.ts:605
  -> clearSelection()
  -> SelectionActions.deselect()
  -> SidebarModel.instance.hidePanels()     ← global chrome
  -> SidebarModel.switch()
  -> router.setup.ts onOpen
  -> AppRegistry.openDocument(EditorDocumentProvider.ID)
```

`hidePanels()` is the app's chrome, and a read-only editor is a *view of a
graph*, not the app's canvas. Every other action in `SelectionActions` already
returns early when `readOnly`; `deselect` was missed — and it is the one reached
with **no gesture on the canvas at all**, because `switchToComponent` clears the
selection before it selects. Row-click focus alone was enough.

The same guard covers the other two documents that build their own read-only
editor: the version-control diff and the authoring preview.

**Two lessons in one defect.**

- *The React warnings were the symptom, not the cause.* "Attempted to
  synchronously unmount a root while React was already rendering" and "triggering
  nested component updates from render is not allowed" both name
  `AuthoringPreviewDocument`, not the review — they are what a document being
  unmounted mid-render looks like from inside. A first fix that deferred the
  canvas work into a `useEffect` was reasoned from those warnings, changed
  nothing, and was reverted. What actually answered it was instrumenting
  `openDocument` and reading the stack.
- *A component verified in isolation is not a component verified in place.* The
  2026-07-24 notes record row-click canvas navigation as live-verified. It was —
  on an editor that was not inside a document whose sidebar could be hidden.

Regression spec: `packages/noodl-editor/tests/nodegraph/selectionactions-readonly.spec.ts`
(3 specs).

## What the smoke measures, with the fix in

Against `share-popup` (40 nodes, 12 changes, update mode) and repeated on the
other three:

| Step | Measured |
|---|---|
| Before / Changes / After | three **distinct rendered frames** — compared by screenshot hash, since the canvas is painted pixels and the DOM cannot answer it |
| walkthrough | label relabels "Walk through" → "Next"; three distinct frames over three steps; "Previous" disabled before the first |
| exclude | closes forward over dependents — 1, 2, 4 and 38 rows across the four recordings |
| Accept relabel | "Accept all" → "Accept 11 of 12" |
| restore | returns the clicked row and its prerequisites |
| Accept N of M | "Updated /Pop-ups/Share/Share Popup" — the write lands |

## Two things worth a decision, not a patch

1. **Exclude and restore are deliberately asymmetric.** Rejection closes forward
   over dependents (`excludedWith`), restoration closes back over prerequisites
   (`requiredWith`). So on `settings-page`, excluding the page root dropped **38
   of 39** rows and immediately restoring it brought back **1**. That is the
   documented design and the closures are individually correct — but a reviewer
   who excludes a container and changes their mind has no single control that
   returns them to where they were. Adjacent to the open design question in
   `AIX-003-LIVE-ROUND-TRIP.md`; both are about what a review *means*.
2. **Past 20 changes the rail starts collapsed**, so counting exclude controls on
   a large proposal returns **zero** — indistinguishable from a rail that has
   lost its controls. It reported exactly that on the first run here. The script
   now expands every group before it measures. Worth remembering for any probe of
   this rail: expand the tree before reading it.

## Running it

```bash
# editor must be up: npm run dev:debug
node packages/noodl-editor/scripts/aix15-live/scripted-session.js \
  --candidate=share-popup --copy-corpus --smoke
```

`--copy-corpus` copies `packages/noodl-editor/tests/testfs/git-repo-utf8` to a
temp dir first — the editor rewrites and minifies a project it opens, and that
corpus is a tracked test fixture. **`--smoke` accepts, and accepting writes**, so
a second smoke of the same candidate against the same project finds nothing left
to diff; the script says so in those words rather than reporting a bare count
mismatch.

Without `--smoke` it stages and opens the review and stops there, which is the
form AIX-008's and AIX-011's panel smokes need — they are the same shape, and the
same patch of `AiClient` serves `PlanningSession` and `DocSession` too.

## ⚠️ One trap this cost time to

**HMR does not apply a change to `SelectionActions`.** The module has no accept
handler, so the update is declined and the old module is retained — the running
bundle kept reporting the unguarded `deselect` while the source had the fix, and
the smoke kept failing identically. `webpack-dev-server` said "App updated" and
then "Nothing hot updated", which reads like success. Verify the *running* code
before concluding a fix does not work:

```bash
npm run cdp -- eval "(() => { const m = window.__aix15wr('./src/editor/src/views/nodegrapheditor/SelectionActions.ts'); return /readOnly/.test(m.SelectionActions.prototype.deselect.toString()); })()"
```

A full `dev:stop` + relaunch was the only thing that picked it up.

## Gates

`npx tsc --noEmit` clean in `noodl-editor`. `npm run test:ci` **2080 specs, 0
failures** (the three new specs confirmed present in the run, not inferred).
`npm run catalog:check` green — "Committed catalog is up to date".
