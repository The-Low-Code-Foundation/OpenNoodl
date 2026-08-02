# OBS-002 — build notes

**Built:** 2026-08-02 · commits `5b423340`, `03a06d41`, `38f75a0f`, `546c9cc4`

Built in the primary checkout **while ERG-001 (phase 35) was live in the same checkout**. The two
never shared a file; see [Working alongside phase 35](#working-alongside-phase-35) for what that
cost and what it nearly cost.

## What shipped

| Scope item | State |
|---|---|
| 1 — the backward walk engine | ✅ pure, zero imports, 20 jest specs, no Electron |
| 2 — the walk panel | ✅ `ProvenancePanel`, registered at order 9.5, **not** experimental |
| 3 — right-click entry points | ✅ on a **wire** and on a **node's connected inputs**. ❌ not the property editor |
| 4 — click-to-reveal | ✅ `switchToComponent` + node focus. ⚠️ values are **not** pinned |
| 5 — the forward walk | ✅ engine + root-event list. ⚠️ the list lives in the panel's empty state |
| 6 — node ids in the property editor | ⚠️ **in the walk's detail pane, not the property editor** |
| 7 — aggregation | ✅ one row per edge carrying `fired N×` and the last value |
| filter-by-cause | ✅ `forwardWalk` is the filter — a tree walk over `cause`, no scan |

**All three annotation layers are wired**, layer 3 as a field (`WalkRow.warnings`) that OBS-003 fills
without the panel changing shape.

## Acceptance, honestly

| Criterion | Verdict |
|---|---|
| Cold editor, right-click → real current values at each hop | ✅ **verified live** on the QA fixture |
| After a trace, the ✓/✕ boundary at the node that failed to emit | ✅ jest; live run showed the causal-chain half |
| Add-to-cart in ≤10 rows on a 300+ node project | ✅ jest — 300 noisy nodes, ~900 of ~902 events unrelated, walk stays ≤10 rows |
| Clicking a row opens the component and focuses the node | ✅ built. ⚠️ **not driven live** |
| A walk crossing three component boundaries reads as one path | ✅ jest |
| Filter-by-cause reduces a busy trace to one chain in one click | ✅ jest — 502 events → 2 rows |
| An edge that fired 100× renders as one aggregated row | ✅ jest, and **seen live as `fired 2×`** |
| The walk engine has unit tests with no editor or Electron dependency | ✅ `tests-unit/`, plain jest |

## What the walk does not yet answer

- **Values are not pinned on the canvas** after click-to-reveal. It switches component and focuses
  the node; the recorded values stay in the panel.
- **The property editor is untouched.** No per-port right-click, and no node-id footer row. The id
  is in the walk's detail pane instead, which serves the agent story (OBS-004) but not the
  "I'm already in the property editor" path.
- **No filters beyond filter-by-cause.** No search by name or id, no component/port/signal filters.
  Filter-by-cause was the one the spec said to build first and treat the rest as refinement.
- **Signal ports read `undefined` for their current value**, which is truthful but noisy. A signal
  has no value; the row could say so.
- **Layer 3 renders nothing** until OBS-003 populates `warnings`.
- **The forward walk has no dedicated surface.** Root events are listed in the panel's empty state
  and clicking one swaps the tree. It works; it is not designed.

## Design decisions worth carrying forward

### `cause` prunes — it does not merely annotate

The spec frames layer 2 as annotation on top of a structural walk. In practice the walk has **two
modes chosen by the data**:

- **causal** — the target port *did* receive a traced event, so `cause` names the one edge that
  delivered it. The walk follows that chain: one row per hop, **no branching at all**.
- **structural** — nothing arrived (the usual complaint), so there is no chain to follow and the
  walk follows declared wires, **pruning at the first hop that did fire**.

Both produce the same tree shape, so the panel renders one thing. The pruning rule is what bounds
the structural walk: a hop that fired is a leaf, because the question was where the data stopped and
it did not stop there.

### How the port-enumeration trap was avoided

Two rules, both load-bearing, both pinned by specs:

1. **Only declared edges are followed.** The tree is built from `SessionDictionary.edges`, never
   from a node's port list, so an unconnected port cannot enter the walk — there is nothing to
   enumerate. The three-node chain that produced 40+ rows for the old panel produces **four**.
2. **A hop that fired is a leaf** (above).

Stepping from an output port *into* its node still has to pick which inputs are upstream, and the
runtime publishes no node-internal dataflow — so every **connected** input is a candidate. That is
bounded by wire count, not port count, which is the whole difference.

### ⚠️ A node's input and output may share a name

`Component Inputs`/`Component Outputs` re-emit `Result` as `Result`; `Variable` has both a `Value`
in and a `Value` out. A direction-blind port key therefore makes a node's own output look like its
own input, and the cycle guard stops the walk one hop in — **silently truncating every walk that
crosses a component boundary or passes through a Variable**, which is most of them. Keys that share
a namespace across directions carry it (`valueKey`), and the runtime's `getPortValues` takes
direction as part of the request.

Three of the engine's first eighteen specs failed on this. It would not have been found by reading.

### ⚠️ Layer 1 could not have been built on `getConnectionValue`

The spec says layer 1 needs nothing new, citing `getConnectionValue`. That reads `_outputHistory`,
which records what was **sent**, and only while `debugInspectorsEnabled` was true — so on an app
that booted with debugging off it is empty, and every hop would render blank until the user
reproduced the bug they were trying to understand. That is the opposite of layer 1's claim.

`NodeContext.getPortValues` reads the **ports**, which is possible because `OutputProperty#value`
calls the owner's getter on every read. ~60 lines of runtime, 10 corpus rows.

### ⚠️ An input with no declared `default` reads `undefined`

Even when the node behaves as though initialised — nodes seed `_internal` in `initialize` without
touching the port. This is the honest answer ("this input was never set" is what someone asking
"why is this empty?" needs), and inferring a value from internal state would be the walk quietly
making something up. Worth knowing before reading a walk, because it looks like a gap and is not.

## What the live run found that jest could not

Layers 1 and 2 both worked on the first live run. The three defects were around them, and all three
are the same species: **a surface stating more than it knew.**

1. **The no-recording summary asserted the opposite of what it knew.** With no trace every row is
   `unknown`; the summary fell through to *"Every hop upstream carried a value."* The replacement
   for a panel retired for confidently showing wrong data-flow answers did exactly that on its
   first run.
2. **Rows were labelled with runtime type names** — `net.noodl.controls.button.onClick` where the
   canvas says *"Go to the catalogue"*. The dictionary's `name` is the runtime node's `name`, which
   is its **type**. Editor labels are merged in on receipt.
3. **`hasTrace` was inferred from `events.length > 0`** — wrong in exactly the case the feature
   exists for. Record, reproduce, *nothing fires*: reported as "no trace, status unknown" when it is
   the most informative outcome there is and every edge should read `never fired`. Recording state
   is now passed explicitly.

Defect 3 is the one to remember: **a run that captured nothing is an answer, not an absence.** Any
future surface over this trace has the same trap available to it.

## Working alongside phase 35

ERG-001 held the same checkout throughout. Territory was genuinely disjoint (OBS-002 is
`noodl-editor/src/editor/src/**` plus three runtime files phase 35 does not touch —
`nodecontext.ts`, `editorconnection.ts`, `internal.d.ts`), so no worktree was built.

⚠️ **`git stash` is not safe in a shared checkout.** One `stash`/`stash pop` to check whether a test
failure pre-dated this work briefly removed the other session's uncommitted files. It restored
cleanly only because nothing wrote during the window. **Never stash; commit with explicit
pathspecs.** `git add -A` would have swept ~25 of their files into an OBS-002 commit.

⚠️ **`git status --porcelain` being clean proves nothing about a concurrent session** — it proves
the other session has no uncommitted work *at that instant*. Two minutes later there were six
modified files. Check file mtimes against `date`, not just cleanliness.

⚠️ **A live editor cannot be verified while another session's runtime code is mid-edit.** The
verification run ended with a blank renderer and 150 webpack errors in `dbmodelnode2.ts` — an
ERG-001 file, uncommitted and mid-edit. Everything OBS-002 needed had already been verified; the
`recording: true` + zero-events fix is pinned by spec only, not by a live run.

## Traps for the next session

- **Reloading the editor renderer drops to the launcher.** The project is not reopened. Budget a
  reopen after every `cdp reload`.
- **HMR does not reliably pick up new modules under `utils/`.** A label fix looked like it had no
  effect until a full reload. Suspect the reload before suspecting the change.
- **The launcher has two projects named "NodeGX QA Fixture".** They are different projects with
  different components. Index into the card list rather than clicking by name.
- `Model` (shared/model) already declares `once` and `events`. The trace equivalents had to be
  `awaitEvent` and `traceEvents`; the compiler caught both.
- `__nodeGraphEditor.activeComponent.graph.nodeMap` is empty; use `graph.findNodeWithId(id)`.
  Serialising a `NodeGraphNode` through CDP hits "Object reference chain is too long" — project
  fields before returning.

## Open questions

Question 3 in the [README](./README.md) — **rebuild or retire the shelved
`TriggerChainDebuggerPanel`** — is **still open and still Richard's call.** It is left registered,
still `experimental: true`, still reading the old snapshot recorder, with a comment at its
registration saying so. OBS-002 replaces what it was *for*; its forward-chain view remains a genuine
companion surface, and the Provenance panel's root-event list is a first pass at the same idea
rather than a replacement for it.
