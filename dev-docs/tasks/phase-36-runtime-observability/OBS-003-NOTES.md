# OBS-003 — build notes

**Built:** 2026-08-02 · commits `995a4906`, `58fd062f`, `0c8b2b8a`, `31422a38`

Built in the primary checkout **while ERG-001 (phase 35) was live in it**, as OBS-002 and OBS-004
were. See [Working alongside phase 35](#working-alongside-phase-35).

**Phase 36 is complete.** All four tasks are built.

## What shipped

| Scope item | State |
|---|---|
| 1 — a convention for runtime invariant checks | ✅ [`DIAGNOSTICS-CONTRACT.md`](../../reference/DIAGNOSTICS-CONTRACT.md), written **before the second check was authored** |
| 2 — a first batch of checks | ✅ three, plus the near-match suggester they share |
| 3 — the catalog as the home for declarations | ❌ **not built, deliberately.** The spec calls it a direction rather than a prerequisite, and three checks is not enough call sites to see the pattern in |
| — layer 3 reaching the walk | ✅ `WalkRow.warnings` is filled in the editor; `nodegx-observe` already filled it |

### The batch

| Key | Node | What it catches |
|---|---|---|
| `repeater/items-not-a-collection` | Repeater | `Items` given a number, object, boolean or **a single record** — anything `Collection.set` will index into and find no `length` on |
| `node/nan-input/<port>` | base `Node` | NaN arriving over any wire |
| `states/unknown-state` | States | **not new.** Gains *"Did you mean "clicked"?"*, and gains clearing |

## The design decision the whole thing rests on

Three channels already existed and nothing said which one a condition belongs on: outcome ports,
`raiseRuntimeError`, and `sendWarning`. The result is visible in the library — five warning-key
naming schemes, two misspelt (`js-parse-waring`, `rest-run-waring-`), one key shared by two
unrelated nodes, and fewer than a third of call sites with any clear at all.

> **A failure is an event. A diagnostic is a predicate.**

A failure happened at a moment, is per-invocation, and a deployed app's operator needs it — the
error bus. A diagnostic is true *continuously* until the author changes something; it has no
moment, so the bus would fire `On App Error` for nothing and print a console line per update in a
deployed app **where nobody can act on it anyway**. Editor-only is the correct audience for a
diagnostic, not a limitation.

⚠️ That is the exact inverse of the Failure Contract's argument, and the contract says so out loud,
because otherwise someone will "fix" diagnostics onto the bus.

`setDiagnostic(key, message | null)` is a **setter, not a report/clear pair**. One call site
expresses the whole predicate, so a stale warning is structurally impossible rather than something
a caller must remember.

## Three things about the channel that were not true

### ⚠️ The warning de-duplicator had never de-duplicated anything

[`editorconnection.activewarnings.ts`](../../../packages/noodl-runtime/src/editorconnection.activewarnings.ts)
opens by claiming it "improves editor performance, especially in larger projects", and compared
payloads with `===`. Every caller in the library builds a fresh object literal, so **every repeat
was sent**. The site that paid for it is `expression-error-<port>`, re-raised from
`_evaluateExpressionParameter` on every update of a node with a broken expression: one WebSocket
message and one Problems-panel re-render per frame, for a warning whose text never changed.

Its four existing rows passed because they compare *strings*, which nothing sends. Now compared by
content, one level deep, with rows written in the shape callers actually use.

### ⚠️ `if (this.context.editorConnection)` is not a gate

A deployed build constructs an `EditorConnection` **on purpose** —
[`noodl-runtime.ts:286`](../../../packages/noodl-runtime/noodl-runtime.ts), *"Create an editor
connection even if we're running deployed… reduce the need for lots of if(editorConnection)"*. So
the guard most existing warning call sites use is **true in production**, and everything behind it
is formatted, serialised and queued. That queue was already a measured leak once. The gate is
`isRunningLocally()`, and `setDiagnostic` uses it.

### ⚠️ A failure raised on the error bus can never be cleared

`createEditorWarningSubscriber` only ever calls `sendWarning`. Nothing goes back. A node that
raises keeps its danger ring and its Problems entry until the project is reloaded — **including
after the author has fixed the cause**.

Recorded in the contract as a Failure Contract question rather than this one's, and then fixed for
`states/unknown-state` specifically, because a live run showed it doing exactly the damage the
contract predicts. `foreach.tsx`'s `repeater/template-script-syntax-error` was already pairing
raise with clear correctly and is the pattern.

## What the corpus caught that review did not

**The Repeater check claimed something the runtime prevents.** The first version said a string on
`Items` renders one item per character — `Collection.set` reads `src.length` and indexes, and a
string has both. It cannot happen: `Items` is an `array`-typed port, so `Node.setInputValue`
`eval`s any string arriving at it (the declared string→array typecast), substitutes `[]` when that
throws, and raises `invalid-array-items` itself. The message described behaviour the runtime
prevents **and** would have duplicated an existing warning — the one thing the convention forbids.

Found by a row failing, not by review. Fourth instance this phase of a surface stating more than it
knew.

## What the live run found

The whole point of running it, and it earned its keep twice.

### ⚠️ The clear was in the wrong place, and the corpus could not see it

The first fix cleared inside `goToState`, after the unknown-state guard. A green corpus row proved
it worked — because that row corrected `"Clicked"` to `"hover"`, a *different* state.

The correction an author actually makes is `"clicked"`: **the state the node is already in**,
because that is what they meant all along. Both `scheduleGoToState`'s `pendingTarget === state`
return and `goToState`'s `internal.state === state` return happen first, so the clear never ran and
the node stayed red. The predicate is about the name on the input, not about whether a transition
results, so it now sits where every request arrives.

*Testing the mechanism is not testing the case.*

### The full loop, on a cold editor

Rig: a `Text` fed from `States.currentState`, with `currentState` set to `"Clicked"` against states
`clicked,hover`. Nothing recorded, no trace, no debugger.

```
? Text.text
  ? States.currentState
       ⚠ Cannot go to state "Clicked" — this node has no such state. Its states are: clicked, hover. Did you mean "clicked"?
```

Structural mode — nothing had fired — and the row still carries the diagnosis. That is layer 1 and
layer 3 together with no recording, which is the design's claim about both.

And the Repeater, driven the same way:

```
Items expects an array, received a number (42). Nothing will render — a Repeater
indexes its input by position, and this value has no length.
```

Setting `Items` to a real array cleared it and the node moved on to reporting its *next* real
problem (`repeater/no-template-for-item`), which is the behaviour a working Problems panel has.

## Acceptance, honestly

| Criterion | Verdict |
|---|---|
| The convention is written down before the second check is authored | ✅ `DIAGNOSTICS-CONTRACT.md`, committed in `995a4906`, before `58fd062f` |
| The States case-mismatch produces a red ring and a Problems entry with the suggestion, no debugger, no trace | ✅ verified live — `getWarnings` returns a ring for the node, the Problems count is 1, and the message carries *Did you mean "clicked"?* |
| Fixing the condition clears the warning | ✅ verified live for **both** checks, and the failing case was found live rather than assumed |
| A busy fixture shows no measurable frame-time regression | ⚠️ **measured, with its uncertainty stated** — see below |
| Warnings appear as ⚠ annotations on an OBS-002 walk | ✅ verified live, in structural mode |

### The frame-time measurement, stated properly

A/B on a 40-wire fan-out graph, 40 000 wire deliveries per run, five runs each, comparing HEAD
against the same file with the `node/nan-input` branch removed:

| | best median | best min |
|---|---|---|
| with the check | 23.38 ms | 23.15 ms |
| without | 22.78 ms | 22.59 ms |

**~14 ns per wire delivery**, on the least-contaminated pair. Run-to-run spread was 22.6–28.5 ms, so
the difference is **inside the noise band** and the number should be read as an upper bound rather
than a measurement. For scale: a frame would need roughly a million wire deliveries for this to
cost 1 ms.

⚠️ Another session was running jest throughout, so absolute figures are contaminated. The A/B
ordering was interleaved to limit that; it does not eliminate it.

## What this does not do

- **No catalog declarations.** Scope item 3, and deliberately: the spec calls designing the
  declaration format before writing checks "the way this task stalls", and three checks is not
  enough to see the pattern.
- **The generic "required input has no connection and no value" check was dropped.** It has no data
  to run on — **no port definition in the library declares a port required**, so the check would
  have had to invent the notion first. Recorded rather than faked.
- **"Nothing reads variable `cart`" was moved out of the batch.** It is a static, whole-graph
  question and belongs in the semantic validator, not in a node-local runtime check. The contract
  says so in *What is not a diagnostic*.
- **The error bus's missing clear path is not fixed generally.** Only `states/unknown-state` pairs
  raise with clear. Every other `raiseRuntimeError` site still leaves a permanent ring.
- **The rendered Problems *panel* was not opened.** `WarningsModel` was read directly — the counts,
  the per-node ring and the per-component list all come from it, and it is what the panel renders —
  but the panel's own DOM was not inspected.

## Traps for the next session

- ⚠️ **`forEachNodeRecursive` stops on a truthy callback return.** `n => out.push(n)` returns the
  new array length, which is truthy, so the walk stops after the first node. This cost several
  minutes of believing a component had one node when it had three. Use a block body.
- ⚠️ **The editor autosaves a component you create through the model straight into the project on
  disk.** A rig built for a live run is a permanent edit to a shared fixture unless you remove it
  *and* restore `rootNodeId`. `setRootComponent` writes `rootNodeId`, and the fixture's was
  ERG-001's `/erg-rig`.
- ⚠️ **The editor renderer dropped to the launcher on its own** partway through, apparently on an
  HMR reload, taking `window.__nodeGraphEditor` with it. Re-check `hasGE` before trusting a probe.
- ⚠️ **A preview reload does not clear the editor's `WarningsModel`.** Stale entries from the
  previous runtime survive and look exactly like fresh ones. Clear per-component before a
  before/after comparison or you will grade the old session.
- **Editor model singletons are not reachable via `require('@noodl-models/…')` from the renderer.**
  Push a fake chunk onto `window.webpackChunknoodl_editor` to capture the webpack `require`, then
  `req('./src/editor/src/models/warningsmodel.ts')`. This is the general recipe for reaching any
  editor module by source path.
- **`npm run cdp -- reload --target=viewer` is the safe reload** — it re-attaches to the fixed
  runtime. Reloading the editor target drops to the launcher.
- The viewer webpack build takes a few seconds after a save; grep the bundle for a phrase from your
  change before concluding the fix does not work.

## Working alongside phase 35

ERG-001 held the same checkout throughout, working on `Filter Collection`, `Map Collection` and
`Set Variable` — all in `nodes/std-library/data/**` and the catalog.

- Territory was **almost** disjoint. The overlap is `node.ts` and `node-definition.d.ts`, both of
  which carry the outcome contract's helpers; the diagnostics work added a sibling method and one
  branch, and was committed within minutes of being written to keep the window small.
- ⚠️ **Their uncommitted work reddens the suite.** Three `filter-records` suites failed mid-session
  against `filterdbmodelsnode.ts` edits in progress. They were green again once ERG-001 committed.
  Attribute a failure by checking `git status` before assuming it is yours.
- **`/erg-rig` in the QA fixture is theirs.** The live run made `/obs-rig` root, then restored it.
- Every commit used explicit pathspecs. No `git add -A`, no `git stash`.

## Gates

| Gate | Result |
|---|---|
| `noodl-runtime` jest | **107 suites, 2008 passing**, 13 skipped |
| `noodl-viewer-react` jest | **59 suites, 802 passing** |
| `noodl-editor` jest (`tests-main` + `tests-unit`) | **10 suites, 101 passing** |
| editor `test:ci` (jasmine) | **2007 specs, 0 failures** |
| `typecheck:runtime` / `:viewer` / `:cloud` / `:editor` / `:editor-tests` | pass |
| `catalog:check`, `catalog:merge:check`, `cloud-library:check` | pass |
| `typecheck:core-ui` | ⚠️ **fails, and did before this task.** `packages/noodl-core-ui/tsconfig.json` declares no `@noodl-versioning` or `@noodl-viewer-cloud/*` path, and pulls in editor files that import them. Nothing here touches those files |
