# Next-session prompt — phase 36, after OBS-002

**OBS-001 and OBS-002 are both discharged.** Tier 1 is complete: the trace substrate, and the walk
that makes it visible. Commits `5b423340`, `03a06d41`, `38f75a0f`, `546c9cc4`, plus
[OBS-002-NOTES.md](./OBS-002-NOTES.md), which is the honest account of what shipped and what did not.

Verified live against the QA fixture with a running preview: a cold walk showing real current values
on a graph that had fired nothing, and after Record plus two clicks the same walk switching to a
cause chain reading `fired 2×` on one row rather than six.

Paste the block under the rule. Everything above it is context for choosing.

## Choosing the slice

| Stream | Contents | State |
|---|---|---|
| **A — OBS-003, node diagnostics** | Layer 3. Node-local invariant checks | **Recommended if ERG-001 has stopped.** Zero dependencies, value from the first check |
| **B — OBS-002 tail** | Pinned values, property-editor entry, filters, forward-walk surface | Real but small; the walk works without any of it |
| **C — OBS-004, agent access** | MCP over the relay + input injection | Now genuinely unblocked — it consumes tiers 1 and 2, and tier 1 is done |

**Check `git log --oneline -5` and `git status --porcelain` first.** OBS-003's first batch of checks
targets `states.ts`, the Repeater family, and generic checks in `node.ts` — all live ERG-001
territory. Phase 35 was **still committing during the OBS-002 session** (see below). If it is still
live, take stream B or C, both of which are disjoint from it.

## ⚠️ Phase 35 shared the checkout throughout OBS-002

Not a worktree — the same checkout, concurrently. It worked because territory was disjoint, but
three things are worth carrying:

- **`git stash` is not safe here.** One stash/pop to check whether a test failure pre-dated this
  work briefly removed the other session's uncommitted files. It restored cleanly only because
  nothing wrote during the window. Commit with explicit pathspecs; never `git add -A`.
- **A clean `git status` proves nothing about a concurrent session** — only that they have no
  uncommitted work *at that instant*. Two minutes later there were six modified files. Compare file
  mtimes against `date`.
- **You cannot verify the editor while their runtime code is mid-edit.** The OBS-002 verification
  run ended with a blank renderer and 150 webpack errors in `dbmodelnode2.ts`, an uncommitted
  ERG-001 file. Everything needed had already been checked, but budget for this.

## What OBS-002 gives you

The engine is the reusable part, and **OBS-004 is its second consumer** — that is why it has zero
imports and runs under plain jest with no Electron.

`packages/noodl-editor/src/editor/src/utils/provenance/walkEngine.ts`:

| Call | Does |
|---|---|
| `buildIndex(topology, events, portValues, {recording})` | Precomputed lookups. ⚠️ **Pass `recording` explicitly** — see below |
| `backwardWalk(index, {node, port})` | "Why is this empty?" Picks causal or structural mode from the data |
| `forwardWalk(index, event)` | Filter-by-cause: everything downstream of one event, as a tree |
| `rootEvents(index)` | The uncaused events — actual interactions. Short by construction |
| `portsToResolve(index, target)` | Every port a walk could show, for one batched value request |
| `explainTerminus(index, row)` | "X fired. Its `Items` output has 2 connections. None carried a value." |

`TraceSession.instance` (`utils/provenance/TraceSession.ts`) owns the editor-side state and is the
only thing that touches the relay. `WalkRow.warnings` is an empty array waiting for OBS-003.

⚠️ **`hasTrace` is not `events.length > 0`.** A recording that captured nothing is an answer — every
edge genuinely `never fired` — not an absence. Inferring it from the count reports the single most
informative run as "we know nothing". Found live; pinned by two specs.

⚠️ **A node's input and output may share a name.** `Component Inputs`/`Outputs` re-emit `Result` as
`Result`; `Variable` has a `Value` in and a `Value` out. Use `valueKey(ref, direction)`, never
`portKey`, anywhere both directions share a namespace. A direction-blind key silently truncates
every walk that crosses a component boundary.

## If you take OBS-003

It is the only task in the phase with **no dependencies at all** and it delivers from the first
check. The channel it reports through (`sendWarning` → danger ring + Problems panel entry) has been
shipped and in use for years, and `WalkRow.warnings` is already in the walk's row shape, so a check
written today appears in two surfaces without either being modified.

The worked example from the README is the shape: a States node receives `"Clicked"` but the state is
named `"clicked"`. That diagnosis is `if (!this.states.includes(value)) warn(...)`. Most "aha"
moments are node-local invariants nobody has written yet.

⚠️ Read [ERG-001's outcome-contract work](../phase-35-authoring-ergonomics/) first if phase 35 has
landed — it has been rewriting exactly these nodes' failure reporting, and a diagnostic check that
duplicates a `reportOutcome` call is noise rather than signal.

---

## The prompt

Continue phase 36 (Track U) on branch `cline-dev` in `/Users/richardosborne/vscode_projects/OpenNoodl`.

**First, check whether another session holds the checkout:** `git log --oneline -5` and
`git status --porcelain`, then compare a modified file's mtime against `date` — a clean status only
means they have nothing uncommitted *right now*. An uncommitted file whose mtime is hours old is
orphaned work: read it, then commit or discard it deliberately. **Never `git stash` in a shared
checkout, and never `git add -A`.**

**Read first, in this order:**

1. `dev-docs/tasks/phase-36-runtime-observability/README.md` — the design position. "The log is
   never the surface" and "scale comes from topology, not filtering" are the whole spec.
2. `dev-docs/tasks/phase-36-runtime-observability/OBS-002-NOTES.md` — what tier 1 actually shipped,
   what it does not yet answer, and the three defects the live editor found that jest could not.
3. The task file for whichever stream you pick (`OBS-003-NODE-DIAGNOSTICS.md` /
   `OBS-004-AGENT-ACCESS.md`).
4. `packages/noodl-editor/src/editor/src/utils/provenance/walkEngine.ts` — its module header
   records the failure it exists to avoid, and both rules that avoid it.
5. `packages/noodl-editor/tests-unit/provenance/walkEngine.test.ts` — the clearest statement of what
   the walk guarantees. If you need a behaviour it does not assert, it is not guaranteed.

**Two facts about the runtime that decide designs:**

- **Delivery is queued, not a call stack.** `OutputProperty.sendValue` pushes into the target's
  `_inputValuesQueue`; the target drains it in its own `update()`. This is why `cause` rides in a
  parallel `_inputCauseQueue`. Any new causal work must respect it.
- **`cause: 0` means root** — a timer, a DOM event, boot. It does not mean "unknown".

**Traps:**

- ⚠️ **Reloading the editor renderer drops to the launcher** — the project is not reopened.
- ⚠️ **HMR does not reliably pick up new modules under `utils/`.** Suspect a stale module before
  suspecting your change.
- ⚠️ The launcher lists **two** projects named "NodeGX QA Fixture", with different components.
  Index into the card list rather than clicking by name.
- `__nodeGraphEditor.activeComponent.graph.nodeMap` is empty; use `graph.findNodeWithId(id)`.
  Serialising a `NodeGraphNode` through CDP hits "Object reference chain is too long" — project the
  fields you want before returning.
- `Model` (shared/model) already declares `once` and `events`; pick other names.
- Editor specs are **jasmine, not jest** — except `tests-main/` and `tests-unit/`, which are plain
  jest and where pure code belongs.
- The editor takes a **single-instance lock**. If another session is driving it, never run
  `dev:stop` — it kills by checkout and takes their run down too.

**Definition of done for OBS-003:** a check that fires on a real project, reaches **both** the
Problems panel and the walk's row detail, and has a corpus row proving it fires on the bad input and
stays silent on the good one.

**Report at the end:** which of the four OBS tasks are discharged, and whether the shelved
`TriggerChainDebuggerPanel` was rebuilt or retired — open question 3, still Richard's call.

## Open questions for Richard — still unanswered

1. **Buffer default.** Shipped at **250k events** with a **200-char value-preview cap**. The real
   memory lever is the character cap, not the event count. Untested at scale.
2. **Session boundary.** Shipped as **clear on trace start and on preview reload**, not time-based.
3. **Does the shelved panel get rebuilt or retired?** Untouched. `TriggerChainDebuggerPanel` is
   still registered `experimental: true` in
   [router.setup.ts](../../../packages/noodl-editor/src/editor/src/router.setup.ts) and still reads
   the old snapshot recorder. OBS-002 replaced what it was *for*, but its forward-chain view is a
   genuine companion surface and the Provenance panel's root-event list is a first pass, not a
   replacement.
4. **OBS-004 scope.** Unchanged — token first, or keep the MCP server local-only and defer?
5. **New: is the property editor worth a per-port entry?** OBS-002's entry points are the canvas
   wire and node menus. The spec's scope items 3 and 6 also wanted a property-editor right-click and
   a node-id footer row; neither was built, and the property editor is the legacy non-React one.
