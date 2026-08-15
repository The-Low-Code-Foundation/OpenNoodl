# FIX-001 — The explainer cannot see the app

**Report 1 (a, b, c)** · Tier 1 · Effort **M** (1a) + **S** (1b) + **M/L** (1c)

> **Status (session 14, 2026-08-15).** **1a is built and gated; it is not driven.** 1b is
> **verified from source as discoverability — no code is missing on either route**, and that
> reading is not a repro. 1c is untouched. See §"What shipped" at the foot of this file.

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
