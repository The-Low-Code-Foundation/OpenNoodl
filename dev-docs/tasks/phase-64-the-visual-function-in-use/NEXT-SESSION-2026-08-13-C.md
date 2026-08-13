# Next session — Phase 64 (VFN): five tasks are merged and none of them is driven

**Read this, then [TASKS.md](TASKS.md).** Supersedes
[NEXT-SESSION-2026-08-13-B.md](NEXT-SESSION-2026-08-13-B.md), whose first item — landing the
four-agent batch — is done and merged.

## Where the phase actually stands

| | |
|---|---|
| **VFN-001 / 002 / 003** | ✅ built **and driven**. Tier 1 is closed |
| **VFN-004 / 007 / 008 / 011 / 012** | 🟡 built, merged, gates green — **zero of them driven** |
| **VFN-005** | criterion 1 answered (occlusion). Geometry work open |
| **VFN-006, VFN-009, VFN-010** | 📋 open. **VFN-009 is now unblocked** — VFN-008 landed |
| **VFN-013, VFN-014** | 📋 new, from Richard's live test. **Both mechanisms already pinned in source** |

Gates on `cline-dev`: **165 suites / 2453 passing**, `tsc` clean, `cloud-library:check` green.

---

## 🔴 Richard's three asks, in his words — these lead

He drove the merged build on 2026-08-13 and reported exactly three things. Two are now tasks with
the mechanism already found; one was "not built yet" and is simply next.

### 1. VFN-013 — "the values that show during the run are hard to see, covered a bit by blocks"

[VFN-013-THE-VALUES-YOU-CANNOT-READ.md](VFN-013-THE-VALUES-YOU-CANNOT-READ.md) · ~half a day

`BlockValueBadges.ts:210` anchors every badge at `-(width + 6)` — outside the block's **own** left
edge. Top-level block: empty canvas, and the left-to-right data-path reading works exactly as
designed. **Nested block: its left edge is inside its parent's body, so the badge lands on the
parent** — and nested is the common case, because that is what an expression is.

⚠️ **The anchor is not wrong, its assumption is.** Do not just move badges right or up; that throws
away the reading that works. Make placement nesting-aware.

### 2. VFN-014 — "the generated code looks absolutely nutter butter"

[VFN-014-THE-CODE-NOBODY-CAN-READ.md](VFN-014-THE-CODE-NOBODY-CAN-READ.md) · ~half a day

*View Code* shows the **probe-instrumented** build, because that is what `generatedCode` holds. The
probes are LGC-003's value tracing and must stay in what runs — but `withBlockProbes` is **scoped,
not installed**, so a probe-free rendering is one call away with no second generator. The gibberish
identifiers are Blockly block ids quoted *by* the probes and leave with them.

🔴 **Its criterion 5 is reproduce-first and is the highest-value ten minutes in this phase.** The
screenshot assigns `Outputs["result"]` from `1 + 2`, and nothing named `result` — and no literal
`1 + 2` — was on that canvas. Either the My Blocks inliner emits a definition at top level (a
sibling of the already-filed "a placed call block publishes no ports"), **or `generatedCode` is
stale, which means the app runs a program the canvas no longer shows.** The second reading is
serious enough to check before building anything else here.

### 3. "I can't see the project backpack / global backpack saved blocks editor" — correct, not built

**VFN-009** ([the library in the project](VFN-009-THE-LIBRARY-IN-THE-PROJECT.md), ~2 days) then
**VFN-010** ([the backpack in the launcher](VFN-010-THE-BACKPACK-IN-THE-LAUNCHER.md), ~1 day).
009 was deliberately held out of the last batch because it needed VFN-008's description field to
have somewhere to live. **That dependency is now satisfied.**

⚠️ VFN-009 §2 forbids widening `Tab.nodeId` to mean "node **or** definition" and asks for a
discriminated `subject`. `tabsClosedByNodeRemoval` is already correct under that design — it never
closes a tab without a `nodeId`. Add the field; do not touch that predicate.

---

## 🔴 The thing Richard did not ask for, and the reason this phase exists

**Five merged tasks have never been run.** That is the same position tier 1 was in this morning —
and driving tier 1 found that one task's *stated instrument was wrong*, and that VFN-007's four
eliminated candidates had all missed the real cause.

**Bundle it.** Live QA is serial across this machine, so one drive session should close:

- **VFN-004** — the canvas actually moves on tab click; clicking in place changes no component; the
  away ring in both themes.
- **VFN-007** — a click on the consequence note selects the row; Tab and arrows in a rendered dialog.
- **VFN-008** — save a description, restart the editor, read it back.
- **VFN-011** — 🔴 **nine owed drives, four of which could still show the feature does not work.**
  No bench frame has ever reached the badge layer. Start here.
- **VFN-012** — the flyout renders its label/button items; *Open app settings* reaches the panel;
  the `⚠` mark's contrast on a hue-90 block.
- **VFN-014 criterion 5** — the `Outputs["result"]` question above, which is three gestures.

Each agent listed its own owed criteria in `NOTES-bench.md`, `NOTES-saveblock.md`,
`NOTES-window.md`, `NOTES-config.md`. Read those; they are specific.

## Defects found and filed, none fixed

1. ✅ **A placed saved block publishes no ports — FIXED 2026-08-13 on `vfn-c-ports`.** The call
   block now states its definition's ports in `extraState.ports` and `detectIO` reads them, so the
   workspace stays the single source of truth and nothing outside it is consulted. 🔴 **Plumbing
   the shelves through to port detection — the route this line recommended — was rejected**: the
   backpack shelf lives in `EditorSettings` and can never reach the viewer window, so that route
   would publish ports for a project-scoped block and not for a backpack-scoped one — and the block
   that produced the finding was **backpack-only**. Measured on the real `vfn64-qa` artefacts:
   `result` appears, typed `number`. It also fixes the interface rails and the bench, which the
   finding never mentioned were blind. 🔴 **The canvas half still needs a drive** — see
   [`NOTES-ports.md`](NOTES-ports.md).
2. 🔴 **The drift gate caught a runtime defect on its first run.** A reserved `send signal` fails
   inside `_createExecutionContext` *during* the run and the success path then writes
   `executionError = null` over it — so a program sending `done` pulses **Failure and Success** with
   a blank error. The bench mirrors it deliberately rather than correcting it.
3. ⚠️ **`BaseDialog`'s measuring copy is tab-reachable.** `pointer-events: none; opacity: 0` hides
   it from the mouse and the eye, not the keyboard — so **every focusable element in every dialog in
   the editor is in the tab order twice, invisible copy first.** One attribute (`inert`) closes the
   class. Cheap, editor-wide, needs a drive to verify.
4. ⚠️ **`VariablesSection.tsx:407` documents `Noodl.Config.get('key')`**, which cannot work —
   `Config` is a Proxy, there is no `get` method, so the expression is `undefined`. The panel
   teaches the one spelling that silently fails.

## Suggested shape for the session

The four-agent batch worked well: four worktrees, one merge, ~35 minutes of orchestration. Repeat it.

| Agent | Tasks | Notes |
|---|---|---|
| A | **VFN-013 + VFN-014** | Richard's two asks. Both mechanisms pinned; neither needs research |
| B | **VFN-009** | The library manager. Biggest, now unblocked |
| C | **the placed-block ports defect** | Design decision in `noodl-runtime`; give it room to propose rather than patch |
| D | **VFN-006** + `BaseDialog` `inert` | Both are overlay/dialog work and were held out of the last batch |

Then **you** do the drive, in the primary checkout, after merging. Do not give a drive to an agent —
`lerna exec` resolves to the primary checkout regardless of where it is launched, so an agent's
`dev:debug` would exercise the wrong code *and* kill Richard's editor and MCP servers.

## Working conditions, and one trap I created today

**Gates.** `test:main` = `cd packages/noodl-editor && npx jest` (from that dir — the repo root picks
up the wrong babel config). `test:ci` only if `packages/noodl-editor/tests/` is touched, ~35 min.
`cloud-library:check` if ports change. Compare **names**, never counts.

🔴 **`git add -A` cost an hour today, in exactly the way the register warns about.** Resolving a
merge conflict inside a worktree, it staged the five per-package `node_modules` **symlinks** that
`make-worktree.sh` creates. Merging that branch replaced five real `node_modules` directories in the
primary checkout with symlinks pointing at *themselves*; recovery was `npm install`. `.gitignore`
did not catch it because `node_modules/` — with a trailing slash — matches directories and **not
symlinks**; the slashless spelling is now there too (`64d8b0e0`). **Stage explicit pathspecs, most
especially when resolving a conflict, which is when you are least inclined to look.**

🔴 **Launching the dev stack kills the checkout's MCP servers.** `scripts/start.ts:199` sweeps with
the same matcher `dev:stop` uses, *before* starting anything. Count first
(`ps aux | grep "[n]oodl-mcp"`) and raise it rather than absorbing it. To stop, kill the
`scripts/start.ts` pid — **never `npm run dev:stop`**.

**The checkout is shared.** A third session's `PortsTab/`, `TraceSession.ts` and
`port-values.spec.ts` have been uncommitted since 2026-08-12. Never `git add -A`; never `git stash`.

## The drive recipe that closed tier 1

```js
// module handle — a repeated chunk id NEVER calls back, so __wr stays undefined
let wr; window.webpackChunknoodl_editor.push([['probe_'+Math.random()],{},r=>{wr=r}]);
// open the window with no selection, exactly as the Properties panel button does:
EventDispatcher.instance.emit('LogicBuilder.OpenTab', { nodeId, nodeName, workspace, generatedCode });
// select a canvas node — e.roots are VIEWS, e.model.roots are MODELS
e.selectNode(e.roots.find(v => v.model.id === 'c6'));
```

Fixture: `vfn64-qa` in `NodeGX test projects/` (a throwaway copy of `lgc010-drive`; node `c6` in
`/ErgCodes`). Real key events need `Input.dispatchKeyEvent` — a synthesised `KeyboardEvent` lets you
*construct* the composed path VFN-001 is supposed to *observe*.

🔴 **Every dialog assertion must filter `:not([class*=MeasuringContainer])` and hit-test with
`elementFromPoint` before clicking**, because `BaseDialog` renders the body twice and the phantom
button sits *above* the real one. Three "the prompt did not re-open" readings were that, not a
defect.

## The pattern that has paid every time in this phase

Every correction here came from **building the instrument and watching it disagree with the story**:
VFN-001's fix sketch was insufficient and the spec caught it; VFN-002's *stated instrument* was
wrong and the control caught it; VFN-007's four eliminated candidates were all correctly eliminated
and the real cause was a fifth, found by reading the DOM rather than the source.

🔴 **A suite of absences is indistinguishable from an instrument that measured nothing.** Every
criterion in this phase is an absence. Each one closed so far carries a negative control that goes
red on demand. Keep doing that — it is the only reason any of these results can be trusted.
