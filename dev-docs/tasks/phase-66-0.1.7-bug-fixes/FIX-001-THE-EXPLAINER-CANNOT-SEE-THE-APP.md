# FIX-001 — The explainer cannot see the app

**Report 1 (a, b, c)** · Tier 1 · Effort **M** (1a) + **S** (1b) + **M/L** (1c)

> **Status (session 16, 2026-08-15).** **1a is built, gated AND DRIVEN — criteria 1, 2, 3 all
> pass against the running app.** The 1a drive found one real defect, now fixed (`f8f215d0`).
> **1b is DRIVEN — criterion 4 passes on both entry routes**, and the session-14 source reading
> was right: nothing needed building. **1c is the only part still open.** See §"What shipped",
> §"The drive" and §"1b DRIVEN" at the foot of this file.

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
- **1c depth** — one level in, or recursive? Only when the instance is selected, or for neighbours
  too? Which context bound gives when a nested read doubles the size?
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
