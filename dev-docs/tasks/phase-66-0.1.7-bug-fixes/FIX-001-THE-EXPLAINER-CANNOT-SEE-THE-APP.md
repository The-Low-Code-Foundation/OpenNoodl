# FIX-001 — The explainer cannot see the app

**Report 1 (a, b, c)** · Tier 1 · Effort **M** (1a) + **S** (1b) + **M/L** (1c)

> **Status (session 17, 2026-08-15). ✅ FIX-001 IS CLOSED — all five acceptance criteria driven
> against the running app.** 1a driven s15 (criteria 1–3, one defect found and fixed, `f8f215d0`);
> 1b driven s16 (criterion 4, both entry routes, nothing needed building); **1c built and driven
> s17 (criterion 5)**. Three defects were found across the three drives and all three are fixed.
> The only thing left is the **§1a.5 `backwardWalk` stretch**, which s15 showed is worth
> re-deciding rather than building: the answers already reach the upstream cause via warnings.
> See §"What shipped", §"The drive", §"1b DRIVEN" and §"1c BUILT/DRIVEN" at the foot of this file.

> *"Be able to ask about a node's configuration AND its current input and output signals and values.
> Right now when I said 'why is the output value null?' it wasn't able to detect and explain."*

## Mechanism — pinned in source

The Explain panel assembles **static, authored-only** context. `ExplainPanel.tsx:129` builds the
session from `fromComponentModel(component)` — the active component only, never the project.
`assemble.ts:225-435` includes per-node authored parameters (`graph.ts:119-122`, raw
`node.parameters`), connections, and catalog docs. **No live values, no runtime state, no warnings,
no trace.** `assemble.ts:217-224` states outright that reading outside the component "is a shape
assembly cannot express". So *"why is the output null?"* is unanswerable **by construction** — the
model cannot see the output at all.

**The infrastructure to fix this already exists, editor-side, with no new protocol:**

- `utils/provenance/TraceSession.ts` — `TraceSession.instance.resolvePortValues(ports)` (`:524`) is
  the exact batched call needed; `isPreviewRunning` (`:171`); `refreshTopology()` (`:482`).
- `utils/provenance/walkEngine.ts` — `backwardWalk` (`:454`) **is** `why_is_this_empty`, computed
  not guessed; `portsToResolve` (`:856`) computes the whole port set for one round trip.
- A ready-made React hook to copy: `propertyeditor/components/PortsTab/usePortValues.ts` (SIG-002).
- Diagnostics with no preview needed at all: `WarningsModel.instance` + `provenance/annotateWarnings.ts`.
- The observe MCP already composes exactly this recipe (`packages/nodegx-observe/src/server.ts:186-252`),
  so the pattern is proven; this task builds the editor-side variant.

## 1a — Live values in the explanation (M)

Add an optional `liveValues` layer to `ExplainContext`:

1. On `startExplanation`, if `TraceSession.instance.isPreviewRunning`, compute the port set for the
   included nodes (declared + instance ports, both directions — `GraphNode.ports` carries `plug`),
   call `resolvePortValues()` once.
2. `render.ts:27-42` renders `now = …` beside each authored parameter, plus a `## Runtime` block.
3. Add `WarningsModel` diagnoses via `annotateWarnings` — these need **no** running preview.
4. `prompts.ts:39-84` gains a section distinguishing **authored parameter** vs **current runtime
   value** vs **not running** — the honest-bounds discipline already in the prompt is the template.
5. **Stretch, same task:** when the follow-up question matches "why is X null/empty", run
   `backwardWalk` on the asked-about port and paste the walk into the turn. That is literally
   `why_is_this_empty` answered from the graph.

## 1b — Explain a group of nodes (S — verify first, likely discoverability)

**Already built.** Marquee selection → `useCanvasSelection.ts:53-63` → scope `subgraph`; the menu
label already pluralises (`NodeContextMenu.ts:260`). 🔴 **Reproduce before building anything** —
the report may be a discoverability failure, in which case the fix is copy in
`ExplainPanel.tsx:270-276`, not assembly. Consider raising subgraph neighbour depth 1 → 2 and an
"include N hops" control beside the Detail select.

## 1c — Look inside component instances (M/L)

Deliberately blocked today (`assemble.ts:217-224`). The adapters already exist:
`fromProjectModel` (`graph.ts:180`) adapts the whole project into the same `ExplainGraph`;
`findComponent` (`graph.ts:271`) resolves legacy-vs-path names. Direction: pass the project graph;
when a **selected** node `isComponentRef`, do a second bounded read of that component appended as a
nested section. Dedupe type blocks via `mergeNodeTypes` — `review/componentReads.ts` measured 63%
of context wasted on duplicated port docs; do not repeat that.

## Acceptance criteria

1. With the preview running and a node selected whose output is currently `null`, asking *"why is
   the output null?"* produces an answer that **names the actual runtime value** and (stretch) the
   upstream port where the value stopped.
2. With the preview **stopped**, the same question produces an explicit "no preview running —
   here is what I can say from the graph alone" answer, not a hallucinated value.
3. A node with an editor warning has that warning quoted in the explanation (works preview-stopped).
4. Marquee-select three nodes → right-click → the label reads "Explain these 3 nodes" and the
   answer discusses all three (driven, both entry routes).
5. Selecting a component instance and asking about it yields an answer describing its internal
   nodes, with citations that navigate correctly across the component boundary
   (`canvasLink.ts` `revealCitedNode` must switch components first).
6. Specs stay green: `tests/ai/explain-context.test.ts`, `explain-session.test.ts`,
   `tests/nodegraph/explain-selection.spec.ts`, `tests-unit/leg-003/authoredNotes.test.ts`.

## Open questions needing a ruling

- **Snapshot or live?** Values move; do follow-up turns re-poll and re-send, or is the explanation
  a snapshot with a timestamp? (Recommend: snapshot per turn, re-resolved on each follow-up.)
- **Truncation/redaction** — port values can be large or secret. What cap per value, and is there
  any redaction story?
- ~~**1c depth** — one level in, or recursive? Only when the instance is selected, or for neighbours
  too? Which context bound gives when a nested read doubles the size?~~ **Answered by the §1c build
  (session 17), all three:** *one level*, *selected only*, and *no existing bound gives* — the
  interior gets its **own** budget (40 nodes at node scope, 25 at subgraph, 3 and 2 components
  respectively) and the type block is deduped across parent and interiors, so the growth is bounded
  and the parent's slice is unchanged. Re-open only with a measurement, not a preference.
- The session's *"read-only by construction"* doc claim (`ExplainSession.ts:8-13`) must be re-worded:
  reading port values is still read-only, but the session now holds runtime data.

---

## What shipped — session 14, 2026-08-15

### 1a — built, gated, **not driven**

| File | What it is |
|---|---|
| `explain/runtime.ts` | **new**, pure — the snapshot type, `portsToResolve`, `renderRuntime` |
| `explain/render.ts` | `renderContext(context, runtime?)`; `[now = …]` beside authored inputs |
| `explain/prompts.ts` | new `AUTHORED VALUES ARE NOT CURRENT VALUES` section; `followUpMessage` carries a re-read |
| `explain/ExplainSession.ts` | `resolveRuntime` injection seam; **one read per turn**, inside the busy window |
| `utils/provenance/explainRuntime.ts` | **new** — the only part that touches a socket and a singleton |
| `PortsTab/portValues.ts` | `isReportableValue` extracted so the unset-input rule has **one** copy |
| `ExplainPanel.tsx` | supplies the adapter; the only caller with a socket in reach |
| `tests/ai/explain-runtime.test.ts` | **new**, 22 specs; exported from `tests/ai/index.ts` |

**Five decisions worth not re-litigating:**

1. 🔴 **A missing snapshot renders no Runtime section at all** — which is the exact pre-FIX-001
   output. The MCP assembler and the measurement harness pass no `resolveRuntime` and are
   byte-identical to before. Nothing claims a layer it was not given.
2. 🔴 **A failed read is not "no preview running".** They are different states and the prompt gives
   *opposite* instructions for them ("start it" vs "it is not answering"). `RuntimeSnapshot.error`
   keeps them apart; collapsing them would put the wrong instruction in for whichever it guessed.
3. 🔴 **Criterion 2 is met by words, not by omission.** A context that simply stops after the node
   types is indistinguishable, to a model, from "every value was null" — and it will answer as if it
   had seen them. The no-preview branch says so explicitly. This is the criterion most likely to be
   "passed" by a build that did nothing.
4. 🔴 **`[now = …]` sits beside the authored value, never over it**, and is omitted when they agree —
   including when the two were merely **cut at different lengths** (assembly allows 400 characters at
   node scope, the runtime layer 200). Equality alone would have printed a change that never
   happened, on every long script body.
5. **Snapshot per turn**, re-resolved on each follow-up, per the recommendation in the open questions
   above. `followUpMessage` states that the new block replaces the earlier one — a follow-up answered
   from the opening turn's numbers is the failure mode that looks exactly like a correct answer.

**The port set is bounded and the rule is deliberate:** every output of a *selected* node (an output
has no authored value, so the runtime is the only place it exists), its fed-or-authored inputs, and
for every other node only the ports on a wire inside the context. Signals are excluded throughout.
Selected nodes are emitted first, so a cap cannot cut away the thing the question was about.

**Not done:** the `backwardWalk` stretch in §1a.5. It needs a topology and a question→port match, and
the task marks it as a stretch on criterion 1; the criterion's non-stretch half is what shipped.

### 1b — reproduced from source: **discoverability, exactly as the task predicted**

🔴 **Read before building anything here: the mechanism is complete on both routes.**

- **Panel route.** `scopeForSelection` (`ExplainPanel.tsx:59-63`) already returns `subgraph` for >1
  and already labels the button `Explain these N nodes`.
- **Canvas route.** `NodeContextMenu.ts:280` already pluralises the same way and
  `rememberTarget(componentName, selectedNodes.map(n => n.model.id))` captures **every** id.
- **The selection survives the panel switch.** `panelHoldsCanvasSelection`
  (`EditorEventBindings.ts:120-122`) lists `ExplainPanel_ID`, so opening Explain does *not* deselect
  — the trap that bites the Properties panel does not apply here.
- **`getSelectedNodes()` returns the whole selection**, not a clipboard-filtered subset
  (`EditorClipboard.ts:32` → `[...editor.selector.nodes]`).
- Marquee is picked up: `useCanvasSelection` re-reads on `mouseup` while the panel is active,
  because the canvas emits no event for a marquee.

⚠️ **This is a reading, not a run.** Criterion 4 asks for it *driven, both entry routes*, and that
has not happened. What the reading rules out is "assembly cannot do it" — so a session that picks
this up should drive it, and if it reproduces, look at the *label and affordance*, not at assembly.
The one substantive knob the task names — subgraph `neighbourDepth` 1 → 2 (`assemble.ts:70`) — is a
judgement call, not a defect, and is still open.

### Gates

Recorded in the phase's `NEXT-SESSION-PROMPT.md` §2 with the reading and its caveats.

---

## The drive — session 15, 2026-08-15

**Criteria 1, 2 and 3 pass.** Driven on a scratchpad **copy** of `NodeGX QA Fixture`, component
`/erg-rig`, selected node `c1` (`Counter`), question *"Why is the output value null?"* — asked once
with the preview running and once with it stopped.

### Why this fixture, and what makes the result proof rather than a plausible story

`t1`–`t4` carry **no authored `text` parameter** and the `Counter`s **no authored parameters at
all**. So pressing the button *N* times puts **N** into `c1.currentCount` — and **N appears nowhere
in the authored graph**. A model cannot derive it. Two runs used **7** and then **4**, so a stale
read would have been visible as well.

| Criterion | Result | What was required, and what happened |
|---|---|---|
| **1** live values | ✅ | Answer: *"the runtime shows `c1`.currentCount = 7 and `t1`.text = 7"* — then **4** on the re-run. It also **corrected the false premise** in the question ("isn't null — it's at 7"), which authored data alone cannot support. |
| **2** preview stopped | ✅ | Answer: *"Nothing is running right now, so I can't point to a specific current value"* — and it separated the two states explicitly: *"the cause isn't something happening at runtime — it's that a required input is simply unconnected."* **Not hedging**, which was the bar. |
| **3** warning quoted | ✅ | Both editor warnings quoted **verbatim** and attributed to the editor (*"the editor's own warning says…"*), **with the preview stopped**, as the criterion requires. |

🔴 **The strongest evidence is that the two runs answer the same question on the same node in
opposite ways.** That is what separates a working runtime layer from one that is never consulted.

**Stretch (§1a.5) still not built.** The answers *did* name the upstream cause (`obj.modelId` and
`filt.items` unwired) — but from the **warnings**, not from `backwardWalk`. Criterion 1's stretch
half remains open.

### 🔴 The defect the drive found — fixed in `f8f215d0`

**A node nobody asked about was reported as "not mounted in the running app right now."**

`renderRuntime` computed absence as `context.nodes − liveNodeIds`, but a node only enters
`liveNodeIds` if **one of its ports was in the request** — and `portsToResolve` asks only about the
selected node and ports on a wire, **excluding signals throughout**. `btn`, `obj` and `filt` connect
to `c1` only by signals, so **zero** of their ports were requested (the whole request was 2 ports
over a 5-node context), and all three were declared not mounted.

All three were demonstrably **running**: I had clicked `btn` seven times, and `obj.completed` and
`filt.completed` had each fired seven times — that is what drove counters 2 and 4. The model relayed
the falsehood faithfully (*"the button isn't currently on screen"*), because `prompts.ts` tells it a
not-mounted node *"is often the entire answer to why is this empty"*. **The lie was load-bearing.**

⚠️ **`runtime.ts` already guarded this exact failure shape** one line at a time — *"asking the
runtime for a port in the wrong direction returns `exists: false`, which reads as 'the node is not
mounted' and is a lie"* — and still derived the general case wrongly.

**The fix:** snapshots carry `askedNodeIds`; absence is `asked − answered`, never
`everything − answered`; a reader that cannot say what it asked makes **no absence claim at all**.
Verified on known-good and known-broken input and required to **disagree** (asked-and-silent still
reports absence; never-asked and undefined both stay silent), then re-driven end-to-end: the false
line is gone while the real values and warnings remain.

🔴 **No spec caught it and no gate could** — every spec built its own snapshot and so encoded the
same assumption. Two regression specs now cover it.

---

## 🚗 1b DRIVEN — criterion 4, both entry routes, session 16, 2026-08-15

**Criterion 4 passes on both routes. The session-14 source reading was right: the mechanism was
already complete, and nothing needed building.** FIX-001 is now open only on §1c.

Fixture: `/Library/Widgets/Fix014Probe` in a scratchpad copy of the QA fixture (authored during the
FIX-014 drive in the same session), three logic nodes with distinctive authored labels.

### The claims, pinned before driving

Four falsifiable sentences, the load-bearing one being **B4: the answer names all three nodes by
their actual names** — with the rule that **the question must not name them**, so a generic answer
about "the selected nodes" cannot pass. The three names were known to me and unguessable from the
question (I typed no question at all; the button was clicked).

### Panel route — marquee → label → answer

A **real marquee drag** over the canvas (`Input.dispatchMouseEvent`, press-move-release, not a
programmatic `selector.select`), because the mouseup re-read is the mechanism under test:

1. ✅ `selector._selected` held exactly **3** — *Click counter*, *Formats the count into the title*,
   *Gate kept true; placeholder…*.
2. ✅ Opening the Explain panel **kept all 3** (FH-008's `panelHoldsCanvasSelection` confirmed live,
   not just in source), and the panel scope line read **"3 nodes in /Library/Widgets/Fix014Probe."**
3. ✅ The button read exactly **"Explain these 3 nodes"**.
4. ✅ The answer named **all three**, quoted `cond`'s authored note verbatim, and traced the loop
   between them.

✅ **The singular is right too:** a marquee that caught one node relabelled the button
**"Explain this node"** — the pluralisation was observed in both directions, not assumed.

### Canvas route — right-click → menu → panel

🔴 **A synthetic DOM `MouseEvent` with `button: 2` does nothing.** `InteractionController` reads
`evt.button === 2` off its own dispatcher, so the menu never opens and the call reports success.
A genuine `Input.dispatchMouseEvent` with `button: 'right'` is required; `cdp.js` has no such
command, so one was written against its exported `connect`/`appTarget`
(`scratchpad/rightclick.js`).

With 3 nodes selected, right-clicking one of them:

1. ✅ The menu item read **"Explain these 3 nodes"** — and the selection stayed at 3, because the
   gesture handler keeps a multi-selection when the node under the cursor is already in it.
2. ✅ Clicking it opened the panel with **"3 nodes in /Library/Widgets/Fix014Probe."** — the
   remembered target carried all three ids across the panel switch.
3. ✅ The answer discussed **all three** by name.

### A free check on session 15's fix

The panel-route answer ended: *"Nothing is currently running/mounted for any of these nodes, so I
can't report actual current values."* That absence claim is **correctly scoped to the nodes actually
asked about** — the `asked − answered = absent` fix from session 15 behaving properly on an
unrelated drive, on a component that genuinely is not mounted.

### One thing that cost time, worth not repeating

⚠️ **`nodeSize` is not a node's selectable bounds.** A marquee drawn tightly around two nodes'
`nodeSize` boxes selected **zero**; a wider rectangle around the same two selected both. This looked
exactly like "overlapping nodes cannot be marquee-selected" and was nearly written up as a defect.
It is not one — the rendered bounds (ports, labels) extend past `nodeSize`.

⚠️ **`window.__nodeGraphEditor` is set in `render()`, so the last editor to render wins** — after an
AI build it points at the **detached preview canvas** (`roots: []`, element measures 0×0) while the
live graph has 9 roots. Navigating does not re-register it. The live editor is
**`NodeGraphContextTmp.nodeGraph`**, reachable through the webpack module cache.

---

## 1c BUILT — looking inside a component instance, session 17, 2026-08-15

**Built and gated; not yet driven.** Criterion 5 is the drive this owes.

| File | What changed |
|---|---|
| `explain/types.ts` | `ContextNestedComponent`; `ExplainContext.nested?`; two new option bounds; `stats.nestedNodeCount?` |
| `explain/graph.ts` | `isInterfaceNodeType` exported — the rule `componentPorts` already used, now named |
| `explain/assemble.ts` | `contextNode()` factored out; `readInterior` + `assembleNested`; type docs merged across parent and interiors |
| `explain/render.ts` | `renderConnections` factored out; `renderNested`; the `## Inside the component instances that were selected` section |
| `explain/prompts.ts` | new `NODES INSIDE A COMPONENT INSTANCE` section |
| `explain/citations.ts` | `citableNodeIds`, `componentForCitedNode`, `componentsInExplanation` — resolution now spans the boundary |
| `explain/ExplainSession.ts` | the debug line reports which interiors were read, and how much of each |
| `ExplainPanel.tsx` | passes the **project** graph (`explainGraph`), and a per-citation component resolver |
| `components/ExplanationView.tsx` | optional `componentForNode` — a citation can now navigate to another component |
| `tests/ai/explain-nested.test.ts` | **new**, 25 specs; exported from `tests/ai/index.ts` |

### Six decisions worth not re-litigating

1. 🔴 **The interior is a separate section, not more entries in `context.nodes`.** Four things take
   their meaning from "`context.nodes` is one component's slice": the runtime port set
   (`portsToResolve`), the warning filter in `renderRuntime`, the node budget in `bounds`, and what
   `revealCitedNode` may reach without switching components. Folding another component's nodes into
   that list would have redefined all four silently. The pre-existing spec *"does not include the
   interior of a component instance"* therefore still passes — so it was **renamed and re-commented**
   to say what it now actually guards, because a spec whose name describes an abandoned promise is
   worse than no spec.
2. 🔴 **Selected instances only, one level deep.** A neighbour that happens to be an instance stays a
   box; otherwise the size of an answer depends on what the selection sits *next to*. This is the
   ruling FIX-001's open questions asked for ("one level in, or recursive? only when selected?").
3. 🔴 **A component the graph cannot resolve is skipped silently.** Assembly cannot tell "this
   project has no such component" from "the caller handed me one component" — the panel passes the
   project, the MCP and review assemblers pass what they have. A bounds note would be a guess about
   the caller. Gated: with a single-component graph the rendered context is **byte-identical** to
   the pre-1c output.
4. 🔴 **Interface nodes survive the bound first.** `Article Page Header` has its `Component
   Inputs`/`Outputs` at index 11 and 12 of 22 — a document-order read cut to 5 nodes drops exactly
   the boundary the parent wired to, and answers "what happens to what I send in" with the one part
   of the graph that cannot say. What is *kept* is still emitted in document order.
5. 🔴 **The §1a absence rule, one layer down.** No runtime value is read for an interior node, so an
   interior node is absent from the Runtime section — and "absent" reads as "not mounted", which the
   prompt calls *"often the entire answer to why is this empty"*. Both the render and the prompt say
   outright that nobody asked. A spec asserts `renderRuntime` never names an interior node.
6. **Type documentation is merged across the parent and every interior**, deduped by type name, with
   the parent's types first so a type budget cuts interior docs before the selection's. AIX-010
   measured 63% of a review context going to duplicated port docs; this does not repeat it.

### 🔴 The defect the build found by reading — the click that would have erased its own answer

The panel disposes a session when the user navigates away, comparing
`state.context.component.name !== selection.componentName`. That rule was exactly right for four
months: citations never pointed outside the explained component, so leaving it meant every link in
the answer was now off screen.

**§1c makes an interior citation a navigation away.** `useCanvasSelection` refreshes on
`activeComponentChanged`, so clicking a link into the instance's interior would have satisfied that
comparison and **disposed the explanation the click came from** — the panel blanking at the exact
moment the feature worked, and the navigation still succeeding, so it would have read as "the answer
disappears when I click a link" rather than as anything to do with §1c.

Fixed before driving: `componentsInExplanation(context)` returns the parent **plus every interior
read**, and the panel disposes only when the user goes somewhere in neither. A spec pins it.

⚠️ **This was found by reading the diff, not by a gate and not by a drive** — no spec covers the
panel's disposal effect (React, so out of reach of both runners), and a drive that clicked the
citation would have seen the navigation work and might well have scored criterion 5 a pass while the
answer vanished underneath it.

### The instruments were checked against each other

Three mutations, each required to make the specs **disagree** with the green run:

| Mutation | Result |
|---|---|
| interior read disabled entirely | **16 of 25 fail** (the 9 survivors are the negative specs, which *should* pass with the feature off) |
| interface-priority ordering removed | **exactly 1 fails** — the bound spec, as designed |
| `citableNodeIds` blind to interiors | **exactly 1 fails** — the citation-resolution spec |

### Gates

| Gate | Reading | When |
|---|---|---|
| editor `tsc --noEmit` | ✅ **0 errors** | after every edit, last at 17:0x |
| `eslint` on the changed surfaces | ✅ clean | — |
| `tests/ai/explain-nested.test.ts` | ✅ **25/25**, plain-Node jest under a scratch config | — |
| `tests/ai/explain-context.test.ts` | ✅ **30/30**, same runner — the pre-existing assembly suite | — |
| `test:ci` | ✅ **at the floor — 6 failures by name**, `totalCount` 2843, seed 39393, results mtime **18:13:32**. The 29 new specs all ran and passed | 18:13 |

⚠️ **`explain-runtime.test.ts` and `explain-session.test.ts` cannot run in the plain-Node runner** —
they import `ExplainSession` → `AiClient` → editor singletons, which is the boundary `jest.config.js`
documents. They are `test:ci`'s to prove, and `test:ci` is the only gate that covers `tests/ai/` at
all. The scratch-jest readings above are **early feedback, not the gate**.

✅ **A peer's `test:main` (203 suites / 3138, 0 failures, 17:30) graded this tree** — including
`tests-unit/leg-003/authoredNotes.test.ts`, which imports `assembleContext`. ⚠️ Its honest scope:
plain-Node jest never compiles `views/`, so the panel half is untouched by it.

### 🔴 Two gate traps this task walked into, in the same failure

The first `test:ci` **exited 0 with no `test-results.json` written** — the documented signature of a
broken build, and it was one: the webpack compile failed on **one line of the new spec**.

```
TS2339: Property 'arrayContaining' does not exist on type '{ … jasmine … }'
```

1. 🔴 **`expect.arrayContaining` is a jest API; `tests/` runs under jasmine.** The plain-Node jest
   runner used for early feedback *has* it, so the spec compiled and passed 26/26 there and failed
   the real build. **Rule for that technique: only use matchers both runners have** — `toContain`
   twice instead. Early feedback from a different runner is worth having and is not the gate.
2. 🔴 **`npx tsc --noEmit -p tsconfig.json` never reads `tests/` at all.** Its `include` is
   `["src/editor", "src/shared", "src/main", "@include-types"]`, and
   `tsc -p tsconfig.json --listFiles | grep -c "noodl-editor/tests/"` returns **0** — measured, not
   inferred. So "editor typecheck: 0 errors" says **nothing** about any spec file. The only thing
   that typechecks `tests/` is `test:ci`'s webpack, whose failure mode is an exit code of 0.

Together: a type error in a spec is invisible to the typecheck, invisible to the plain-Node runner,
and reported by the one gate that covers it as a **silent pass**.

---

## 🚗 1c DRIVEN — criterion 5, session 17, 2026-08-15

**Criterion 5 passes.** With it, **FIX-001 is closed**: 1a driven (s15), 1b driven (s16), 1c built
and driven (s17). Only the §1a.5 `backwardWalk` stretch remains, and s15 already showed its marginal
value is lower than the task assumed.

Fixture: a scratchpad copy of `fix018-drive` — the only project on this disk with placed component
instances — with **two tokens planted in interiors only**: `MARROWFAT 4193` on a Text inside
`/Widgets/Product Card`, and `kestrelRebate` in an Expression inside `/Logic/Cart Totals`. Neither
string exists in `/App`, neither is derivable from a component name, and **the question named
neither**: the opening turn was the "Explain this node" button with nothing typed.

### The claims, pinned before driving

Seven, written to `DRIVE-CLAIMS.md` before the editor was launched. The load-bearing three are
C3 (the answer quotes a token that only the interior read could supply), C4 (it cites an interior id)
and C5 (clicking that citation crosses the component boundary).

| # | Claim | Result |
|---|---|---|
| C1 | selecting the card instance yields one interior, 2 nodes, 0 omitted | ✅ `/Widgets/Product Card`, `instanceIds: [bbbbbbbb…102]` |
| C2 | the **rendered** context carries the token and the interior id | ✅ both; 4,326 chars against the control's 2,372 |
| C3 ⭐ | the **answer** quotes `MARROWFAT 4193` | ✅ verbatim — *"authored as the literal string \"MARROWFAT 4193\""* |
| C4 ⭐ | the answer cites an interior id | ✅ **2 of its 4 citations** are `cccccccc…` ids, which do not exist in `/App` |
| C5 ⭐ | clicking one switches component **and** selects the node | ✅ `activeComponent` `/App` → `/Widgets/Product Card`, selection `cccccccc…101` "Product name" |
| C6 | control: a non-instance node yields no interior and no token | ✅ `nested: []`, `covers: ['/App']` only |
| C7 | two instances of one component collapse to one interior | ✅ one section, **two** `instanceIds`, `kestrelRebate` present |

### 🔴 Two controls, because a pass on its own proves less than it looks

**The token control (C6).** A drive where the answer merely *describes* an instance would have passed
a lazy reading — a model can say "it renders a product card" from the component's name alone. So the
claim was written against a string a model cannot derive. And the control shows where it comes from:
selecting the plain `Expression` in the same component, in the same session, produces a context with
**no interior, no token, and `/App` as the only component covered**.

**The disposal control.** C5's real risk was the opposite of failure — that the answer survived the
navigation because I had *broken disposal altogether* rather than narrowed it. So the same session
was then navigated to `/Logic/Cart Totals`, a component the explanation does **not** cover:
the session was **dropped** (`answerBlocks: 0`), as it should be. Survives what it covers, drops what
it does not — the two readings disagree, which is what makes either of them evidence.

✅ **The §1a discipline held one layer down, unprompted.** With a preview running, the answer said
*"the preview is running, but it didn't return values for any port in this context, so I can't
confirm what's actually rendering on screen right now versus what's authored"* — and made **no**
"not mounted" claim about the interior nodes, which is exactly the lie §1a was fixed for.

### Two observations worth not re-learning

🔴 **The model hedged about a read that was complete — found by drive, fixed, and re-driven.**

Run 1 ended: *"this is only a 2-node, bounded read of the interior, so I can't rule out the component
having its own Inputs defined elsewhere."* The read was **whole** (2 of 2 nodes, `nodesOmitted: 0`)
and the component provably has **no** interface. Both facts were in the context — one as *two numbers
to compare* ("2 node(s) in total, 2 shown"), the other as a **line that was simply absent**, because
`it takes in:` rendered only when the port list was non-empty.

**Fix — the empty cases are now stated, never omitted:**

| Case | Was | Is |
|---|---|---|
| no input ports | *(line absent)* | `it takes nothing in: it has no Component Inputs ports at all.` |
| no output ports | *(line absent)* | `it gives nothing out: it has no Component Outputs ports at all.` |
| whole interior read | two numbers to compare | `That is the whole component — nothing inside it was left out of this read.` |

**Re-driven, same node, same fixture, no question typed.** Run 2: *"it exposes no Component Inputs
or Component Outputs ports at all … Because it has zero input ports, everything it displays is fixed
by what's authored inside the component itself … there's no mechanism visible here for /App to change
the product shown."* **Definite where run 1 hedged, and the definite claim is the true one.** Run 2
also kept the §1a honesty unprompted: *"no runtime values were read for any port on either the
instance or its interior nodes."*

⚠️ **The interface is computed from *all* of the component's nodes, not the kept ones** — so
"it has no Component Inputs ports at all" stays true when the node bound cuts the read short. A spec
pins exactly that, because computing it from `kept` would turn "cut short" into "has no outputs".

🔴 **This is `asked − answered` in different clothes, and it is the third time this rule has bitten
this one feature** (§1a's no-preview branch, §1a's absence claim, now §1c's empty interface):
**an absence a reader has to derive gets derived wrongly. Write the empty case as text.**

⚠️ **The click's reported coordinates did not match the rect measured one call earlier** (`284,481`
against a box at y 414–429). The effect was correct — the right node was selected — but the
measurement and the click were **two `cdp` invocations**, and the panel moved between them. Do not
claim "clicked at the measured point" across two connections; claim the effect.

**Cost:** one AI turn. C1, C2, C6 and C7 were checked by calling the *pure* assembler over the live
editor's own project graph through the webpack module cache, which needs no provider at all.
`fromProjectModel` took **0.7 ms** for this project — ⚠️ 3 components, so that is a smoke test, not a
scale measurement.
