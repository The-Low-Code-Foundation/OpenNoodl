# POL-018 — The provenance walk should ask the project, not the preview

**Status:** ⏸ **deferred by decision, not open by neglect.** This is
[POL-010](POL-010-THE-WALK-DOESNT-WALK.md)'s **slice 2**, deferred by Richard on 2026-08-04 and
filed as its own task on 2026-08-06. Nothing here is diagnosis — POL-010 measured the mechanism
live and the evidence is in that file. What this task owes is a design decision on two points, then
a change to **one producer**.

**Filed late, and that is the point.** Richard's decision 6 in
[PROGRESS.md](PROGRESS.md#answered-by-richard--2026-08-04) said in its own words that this was *"the
right destination and its own task"*, and for two days it had neither a row nor a file. The phase's
own pol-013 rule — *anything filed-not-fixed gets a ROW* — reads as being about findings, but a
**deferral is a state too**, and a state carried only as a sentence inside an answer is invisible in
the status line, in the count and in every handover after it. It went invisible inside the phase
that adopted the rule.

## What slice 2 is

The provenance walk makes a claim about **the user's graph**. It sources the structure it walks from
**the running preview**, which contains only what the runtime happened to instantiate.

Those are different graphs, and POL-010 measured the gap twice:

- On Richard's chat project, `refreshTopology()` against the project's own viewer returned **1 node,
  0 edges** — the `App` component's `Router` alone. `Router.startPage` was `/Pages/Signup`, no page
  mounted, and **not one node of the Chat page existed in the runtime** — while the canvas two
  inches to the left of the panel drew the wire the user was asking about.
- The captured fixture
  (`packages/noodl-editor/tests-unit/provenance/fixtures/chat-topology.json`, taken verbatim from the
  running viewer **with the page mounted**) holds 18 nodes and **8 edges where `connections.json`
  declares 12** — counted, not quoted.
  The four missing ones all touch a `JavaScriptFunction`'s dynamic ports (`formatMessages`,
  `nowFn.now`), which the runtime never registered. So the chain from `messagesText.text` back to
  `Query Messages` does not exist in the runtime *even in the good case*.

The second measurement is the stronger argument and it is the one to carry into this task: the
preview-sourced topology is not merely *late*, it is **structurally incomplete for a whole node
family**, and no amount of mounting the right page fixes that.

Slice 2 is: build the topology from `ProjectModel`, and keep the runtime for the two things only it
can answer — **current port values** (layer 1) and **trace events** (layer 2).

What it buys, in the sentence POL-010 says Richard wanted: *"`messagesQuery.items` feeds this, and
it has not run"* — instead of silence, or instead of one row presented as a result.

## Why it was deferred

Richard, 2026-08-04, decision 6 in [PROGRESS.md](PROGRESS.md):

> **POL-010 — build slice 3 and slice 2b. Slice 2 is deferred.** *"I like option B."* […] Sourcing
> the topology from `ProjectModel` is the right destination and its own task — **it carries
> component scoping and a decision about component instances.**

The reason is scope, not doubt. Slice 3 (the four distinguishable foundations) and slice 2b (forget
the previous project's graph) were the *visible* fix and were free; slice 2 carries two genuine
design decisions that deserve a task rather than a polish slot. POL-010 landed slices 3, 2b and 4,
so the panel now **says why it cannot answer** rather than showing one row as though it were a
result. That is what makes this deferrable rather than blocking.

## The two things it carries

Both are Richard's calls, not the builder's. Neither has an answer yet, and the current design gets
both for free from the runtime dictionary — which is precisely why moving to the project surfaces
them.

### Open question 1 — component scoping: how far may a walk cross a component boundary?

The runtime dictionary is flat and scoped by construction: it contains one instantiated tree, and
each entry carries a `component` string
(`packages/noodl-runtime/src/nodecontext.ts:829` — `buildSessionDictionary`). A project-sourced
topology has **every component in the project at once**, and two components may hold
identically-shaped graphs with different ids.

POL-010's own note on slice 2 states the requirement without answering it: *"it needs
component-scoping (a walk should not cross into an unrelated component's identically-named node)"*.

The shapes on the table, none of them chosen:

- **(a) Never cross.** A walk stops at a `Component Inputs` node and says so. Cheapest, and honest;
  it also means the walk cannot answer the most common real question, *"where did this value come
  from?"*, whenever the answer is one component up.
- **(b) Cross through the component interface.** A `Component Inputs` port continues into whichever
  parent instance supplies it — which is exactly what question 2 is about.
- **(c) Cross, but only where the runtime confirms an instance.** A hybrid: project structure,
  runtime instance identity. Keeps the walk grounded but reintroduces the dependency on what is
  mounted.

**Ask Richard which, with the cost of (b) in hand — see question 2.**

### Open question 2 — what does a hop *mean* in a component instantiated three times?

The runtime has instances; the project has a component *definition*. A `Component Inputs.title` port
in the definition is fed by **N** different wires, one per instance, and the project cannot tell you
which one you are looking at — the panel's question is asked about a node in a graph the user is
*editing*, and the editor's canvas shows the definition, not an instance.

The shapes, again unchosen:

- **(a) Report all N.** The walk branches: *"`title` is fed by 3 instances of this component —
  `Home.CardA.label`, `Home.CardB.label`, `Settings.Row.label`."* Truthful, and it turns a chain
  into a tree, which is the thing OBS-002 deliberately does not do (`cause` **prunes** the tree, and
  the retired Data Lineage panel died of 40+ noise steps).
- **(b) Stop at the boundary and name the fan-out.** One row: *"fed by the component's `title`
  input, wired by 3 instances."* Keeps the chain a chain.
- **(c) Disambiguate from the runtime when exactly one instance is live**, fall back to (b)
  otherwise. Best answer when the preview is running; a second, quieter dependency on what is
  mounted.

**Ask Richard.** ⚠️ Do not answer this by building it — the walk's whole claim is that it reads in
one glance, and (a) is the option that can quietly destroy that property.

## The seams

The change is to **one producer**. `walkEngine` takes a `Topology`; where that topology comes from
is `TraceSession`'s business.

| Seam | File | What it is |
|---|---|---|
| The type the engine consumes | `packages/noodl-editor/src/editor/src/utils/provenance/walkEngine.ts:63` | `interface Topology { nodes: Record<string, NodeInfo>; edges: Edge[] }`. `NodeInfo` is `{ name, type, component }` (`:47`), `Edge` is `{ from: EdgeRef, to: EdgeRef }` (`:58`), `EdgeRef` is `{ node, port }` (`:53`). **The target shape is small.** |
| Where the topology is held today | `packages/noodl-editor/src/editor/src/utils/provenance/TraceSession.ts:84` | `public topology: Topology = { nodes: {}, edges: [] }` — *"Empty until a viewer answers."* |
| Where it arrives from the runtime | `TraceSession.ts` `listen()`, the `TraceDictionary` handler (~`:185–192`) | `this.topology = withEditorLabels(dictionary); this.hasTopology = true;` |
| The pull | `TraceSession.ts:441` `refreshTopology()` | Returns the last-known topology immediately when there is no `clientId`. **This is the method that changes**, or gains a project-sourced sibling. |
| The label merge that already reaches into the project | `TraceSession.ts:62` `withEditorLabels()` | Already calls `ProjectModel.instance.findNodeWithId(id)?.label` to replace runtime *type* names with the labels the user typed. **A project-sourced topology makes this function's job disappear** — the labels are native. |
| The reset | `TraceSession.ts:546` `forget()`, hooked at `:183` on `ProjectModel.instanceHasChanged` | POL-010 slice 2b. A project-sourced topology changes what this must clear, and possibly makes half of it unnecessary. |
| Preview liveness | `TraceSession.ts:164` `get isPreviewRunning()` | `this.clientId !== undefined`. Feeds `foundationOf`'s `previewRunning` argument. |
| The foundation the panel renders | `walkEngine.ts:363` `foundationOf`, `:402` `describeFoundation` | `no-graph` / `node-absent` / `port-unwired` / `walkable`. ⚠️ **`node-absent` largely stops being reachable** once the topology is the project's — its sentence (*"is not running in the preview"*) is about the runtime and would become a lie. Whether it survives, and in what wording, is part of this task. |
| Where the runtime builds today's dictionary (for reference only — do not change it) | `packages/noodl-runtime/src/nodecontext.ts:829` `buildSessionDictionary` | Walks `rootComponent.nodeScope.getAllNodesRecursive()` and collects edges off `node._outputList[].connections`. A node never instantiated has no `_outputList`, so **its wires do not exist**. This is the mechanism, stated once. |
| The project's own edge list | `packages/noodl-editor/src/editor/src/models/nodegraphmodel/NodeGraphModel.ts:38` | `connections: Connection[]`, where `Connection` is `{ fromId, fromProperty, toId, toProperty, … }` (`:14`). One `NodeGraphModel` per component, reached as `ComponentModel.graph` (`componentmodel.ts:23`). |
| Per-component node iteration | `componentmodel.ts` `forEachNode`, used all over `projectmodel.ts` (e.g. `:73`, `:439`, `:1235`, `:1363`) | The existing house pattern for walking a project's nodes. |

### The consumers, all three

1. **`ProvenancePanel.tsx`** — `TraceSession.instance` at `:66`, `buildIndex(session.topology, …)`
   at `:131` and `:154`, `session.refreshTopology()` at `:149` and `:217`.
2. **`RecordingOverlay.tsx`** (HUD-001/002, later than POL-010) — `:82`, and `:190` reads
   `session.topology.nodes[nodeId]?.component` to scope badges to the canvas being looked at.
   ⚠️ **This consumer did not exist when POL-010 deferred slice 2** and it is the one most likely to
   be surprised: a project-sourced topology contains nodes with no runtime existence, and a badge is
   a claim that something *fired*.
3. **OBS-004 / `noodl-mcp`** — runs `walkEngine` with no renderer. **`walkEngine.ts` must stay
   import-free.** That is why this is a change to a producer and not to the engine.

## What to build

**Slice 1 — get the two answers.** Questions 1 and 2 above. Nothing else can be specified until they
are answered; in particular the criteria below are written against option (b)+(b) as the cheapest
coherent pair and must be rewritten if Richard picks otherwise.

**Slice 2 — a project topology producer.** A pure function from `ProjectModel` (or from a component
plus a scope rule) to `Topology`, living beside `TraceSession` rather than inside `walkEngine`.
Node ids are already the editor's ids and the runtime uses the same ones — POL-010 proved this by
measurement, and it killed a whole candidate mechanism, so **do not re-derive it**.

**Slice 3 — reconcile the foundations.** `no-graph` and `node-absent` are runtime-shaped. Decide
what each means when structure comes from the project and values come from the runtime, and keep the
distinction the panel now has: *structure absent* vs *never ran*. The second is the answer Richard
originally wanted and neither wording says it today.

**Slice 4 — the three consumers, deliberately.** `ProvenancePanel` gains completeness;
`RecordingOverlay` must **not** start badging nodes that cannot fire; OBS-004 must keep working with
no renderer.

## Criteria

⚠️ Written against the unanswered questions above. **Criteria 2 and 5 are provisional** and are the
ones that move if Richard picks a different option.

1. Asking why `Filter Messages By Conversation.items` is empty walks back to `Query Messages` and
   names it, **with no page mounted in the preview** — the exact thing POL-010 could not do, on the
   exact project it was reported against.
2. *(provisional — question 1)* A walk does not cross into an unrelated component's
   identically-named node, demonstrated on a project that has two.
3. A node the runtime never instantiated appears in the walk with its structure and an explicit
   *"has not run"* — not blank, and not silently omitted.
4. `walkEngine.ts` still imports nothing, and the `noodl-mcp` provenance path still works with no
   renderer.
5. *(provisional — question 2)* A component instantiated more than once produces the agreed answer,
   demonstrated on a fixture with three instances.
6. `RecordingOverlay`'s badges are unchanged in behaviour: nothing badges a node that has not fired.
7. The four missing `JavaScriptFunction` edges from POL-010's fixture are present in the
   project-sourced topology — i.e. **12 edges where the runtime gave 8**, on the same project.

## Traps

- **The engine is not the defect**, measured: four hops from one edge on real runtime ids. Resist
  loosening *"only declared edges are followed"* — a walk that enumerates ports is how the retired
  Data Lineage panel produced 40+ noise steps.
- **Node ids in a NodeGX project are not UUIDs.** Agent-authored and fixture projects use readable
  ids (`filterCollection`, `btn`, `t1`). POL-010 lost a whole candidate to this assumption.
- **A held topology outlives its viewer**, which is why `foundationOf` takes `previewRunning`
  separately from `hasTopology`. A project-sourced topology outlives it by design, so the
  liveness signal becomes *more* load-bearing, not less.
- `withEditorLabels` exists only because the runtime dictionary's `name` is the node's **type**.
  Deleting it is part of the win — but check nothing else has come to depend on its side effects.
- `cause` **prunes** the tree when a trace exists. A recorded walk is a chain, not a search. Do not
  read a short recorded walk as the same defect as a short structural one.
