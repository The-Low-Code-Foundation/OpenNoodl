# Phase 39 — handover prompt

Written 2026-08-04 at the end of the **second** build session (`d7d8a8d4`…`466be3ef`).
Paste the block below into a fresh session.

---

Continue `dev-docs/tasks/phase-39-alpha-polish` (Track X — the twelve things I hit driving the editor
for an hour as an alpha user). Read `PROGRESS.md` first; it is current as of commit `466be3ef` on
`cline-dev`.

## Where it stands

Done and verified in the running editor: **POL-001** (the settings crash — the alpha blocker),
**POL-002** (links + Learn tab), **POL-003** (rail contrast + Lucide glyphs), **POL-004** (undefined
CSS tokens + a new gate), **POL-005** (backend surfaces at 860px), **POL-009** (a pin belongs to one
canvas).

Nothing is now "built but unwatched" — the last session's two unverified items were driven and both
pass, and neither needed a code change.

**POL-010 is diagnosed but not fixed.** Slice 1 is written into its spec with the evidence. Do not
re-diagnose it.

Not started: **POL-006**, **POL-007**, **POL-008** (Part A undiagnosed), **POL-011**, **POL-012**,
**POL-013**, and two the verification pass found rather than me: **POL-014** and **POL-015**.

## Do these first, in this order

1. **POL-008 Part A is the last undiagnosed item, and its first slice is diagnosis, not repair.**
   Three candidates; the spec says not to start fixing until the answer is one of them. It is the
   only thing left in the phase whose mechanism nobody knows. It needs the no-provider driver —
   `dev-docs` has the recipe and three of them already exist.

2. **POL-014 and POL-015 are both worse than anything left on my original list**, and neither is on
   it, because neither is reachable in the hour I spent:

   - **POL-014** — the Data Browser reads `record.id`; every record carries `objectId`. Clicking one
     cell opens an edit box in **every row**, and deleting a record accepts the confirm and silently
     does nothing. Five consequences, all observed live. A small fix with a real test.
   - **POL-015** — the Workflows panel **cannot create the first workflow on a backend**. The create
     form's backend list is derived from the workflows that already exist, so with none it passes
     `''`. Every other workflow path works; only creation is broken. A first-run blocker that nobody
     who already has a workflow will ever see.

3. Then the rest, cheapest first: **POL-007** (the Build panel's row min-width exceeds its 400px
   panel — mechanism confirmed), **POL-012**, **POL-011**, **POL-006**, **POL-013**.

   POL-006 is the one with leverage: **POL-008 Part B is explicitly gated on it** ("re-judge after
   POL-006"), and the repo already ships all ~1998 Lucide glyphs as a bundled webfont, so it is
   wiring rather than sourcing.

## What this session found that the specs did not

- **NodeGX node ids are not UUIDs.** POL-010's stronger candidate was built on the premise that they
  are, and that a node id equal to a node name meant edge lookup was broken. Every node in my chat
  page is named (`filterCollection`, `messagesQuery`, `pageInputs`); so is every node in the QA
  fixture (`btn`, `t1`, `filt`). Nothing was failing to join, and a whole candidate died. **Check
  what a value normally looks like before deciding it looks wrong.**

- **A pure function is cheap to exonerate — do it before suspecting it.** `walkEngine.backwardWalk`
  was suspect #1 for a walk that showed one hop. Calling it directly with a topology captured
  verbatim from a running viewer returned **four** rows from one declared edge. Two minutes, and it
  moved the search upstream to the producer, where the defect was.

- **"Preview live" means a viewer is attached, not that your component is mounted in it.** The trace
  topology is built from `rootComponent.nodeScope.getAllNodesRecursive()`, so it describes what the
  runtime *instantiated*. On my chat project it contained one node — the Router — while the canvas
  beside the panel drew the wire I was asking about. Any panel that answers from the runtime is
  answering about the runtime, and has to say so.

- **A singleton with no reset serves the previous project.** `TraceSession` reported
  `hasTopology: true` with 12 nodes of the last project's component after switching projects.
  `grep` for a reset path in that file finds nothing.

- **The setup for a verification is where the blockers are.** POL-009 took ten minutes to verify and
  an hour to reach, because creating the workflow it needed is broken (POL-015). POL-005's layout
  pass needed records in a table, and putting them there is what surfaced POL-014. Neither defect
  would have been found by reading code.

- **A spec's own confirmed premise can still be wrong.** POL-005 slice 4 asserted the surfaces keep
  float/full via `⋯`. They have no mode buttons at all — Backend Services' panel header has 6
  buttons, a surface's has 1. Count the thing before confirming it exists.

## Harness facts worth keeping

- **`window.confirm` in Electron is a native modal that CDP cannot dismiss.**
  `Page.handleJavaScriptDialog` answers *"No dialog is showing"* while every subsequent `cdp eval`
  hangs indefinitely. The way out is a real keystroke:
  `osascript -e 'tell application "System Events" to tell process "Electron" to set frontmost to true' -e 'delay 1' -e 'tell application "System Events" to keystroke return'`.
  (VS Code now has the accessibility permission this needs.)

- **Reading React state through a DOM node's `__reactFiber$` can return the alternate fiber**, one
  render stale. A `currentStepIndex` read that way said `1` while the timeline rendered `Step 1 / 3`
  (index 0), and nearly produced a false defect report. Assert on rendered text for anything
  rendered; use the fiber only for values that never reach the DOM.

- **`document.getElementById` returns the FIRST match.** Tagging elements with a fixed probe id
  without clearing the previous one silently clicks the wrong element — it cost this session three
  wasted screenshots that all looked plausible. Always
  `document.querySelectorAll('#probe-x').forEach(e => e.removeAttribute('id'))` first, and filter
  candidates by `getBoundingClientRect().top > 0` because detached menu nodes linger at 0,0.

- The webpack module-cache probe still works and is the fastest way into any singleton:
  `window.webpackChunknoodl_editor.push([[Symbol()],{},req => cache = req.c])`, then look up by
  module path fragment. Re-push it after a route change; it survives HMR.

## Working rules

- Commit straight to `cline-dev`. No branches, no PRs.
- **Another session still has uncommitted work** in `projectmodel.ts`, `projectmodel.editor.ts`,
  `LocalProjectsModel.ts`, `ProjectImporter.ts`, `analyze.ts`, `featureFlags.ts`,
  `VersionControlPanel/**` and `nodegx-observe`. It was untouched across this whole session —
  re-check whether it is still there and still theirs. **Never `git add -A`, never stash**, and
  pathspec-scope every commit. POL-006 needs a line in `LocalProjectsModel.ts`, which is on that
  list; stage that hunk surgically (`git hash-object -w` + `git update-index --cacheinfo`) rather
  than sweeping their work in.
- The editor suite is `npm run test:ci` from `packages/noodl-editor`. **Only the `Jasmine:` line
  counts** — a run that dies without one graded nothing. Baseline is 2137 specs, 0 failures.
- Gates to keep green: `npx tsc --noEmit -p tsconfig.json`, `npm run tokens:css`.
- Verify in the running editor, not only in jest. The `run-editor` skill has the recipe. **HMR will
  not apply a change to an already-mounted panel; restart the stack before concluding a fix did
  nothing.** Stop the stack when you are done (`npm run dev:stop`).
- **Work on a copy of any project you drive.** Copy it into the scratchpad and open that. This
  session did, and both originals — the QA fixture and my chat project — came through untouched.
  Clean up anything you write into a real local backend; this session removed its eight scratch
  records and its workflow definition afterwards.
- Ask me if a decision is genuinely mine. My four earlier answers (Inter; you pick the icon list but
  ship a way for users to add their own; `IconSize` scoped and filed; a styling floor in CONVENTIONS
  after the font lands) are recorded in `PROGRESS.md` — don't re-ask them.

## Two questions for me, both recorded, neither urgent

1. **Should a backend surface be able to reach full mode deliberately?** POL-005 removed
   `openFull()`, which was the only route it had — and it was firing unasked. All seven are usable at
   860 and I said that width "looks perfect", so nothing I wanted was lost. But it is a real
   reduction and it is my call, not the task's.
2. **How far should POL-010's fix go?** Sourcing the walk's topology from `ProjectModel` instead of
   the runtime makes it answer about the graph the user is looking at, which is what the panel claims
   to do — but it costs component-scoping and a decision about component instances that the runtime
   dictionary got for free. The cheap alternative is slice 3 alone: the panel stops presenting one
   row as a result and says which of four states it is in.
