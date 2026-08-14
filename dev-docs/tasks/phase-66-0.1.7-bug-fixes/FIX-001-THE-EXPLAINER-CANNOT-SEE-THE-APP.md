# FIX-001 — The explainer cannot see the app

**Report 1 (a, b, c)** · Tier 1 · Effort **M** (1a) + **S** (1b) + **M/L** (1c)

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
