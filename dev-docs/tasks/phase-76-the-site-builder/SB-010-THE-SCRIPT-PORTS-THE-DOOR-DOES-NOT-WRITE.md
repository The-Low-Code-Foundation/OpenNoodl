# SB-010 — The script ports the authored door does not write

**Status: ⬜ OPEN — measured, worked around in SB-004, not fixed.** Found by SB-004 §7's
real-backend run (2026-08-26 s4) and filed rather than absorbed, because the workaround is per-graph
and the gap is per-door: **every cloud component any agent authors through the MCP door has it.**

Evidence: `packages/nodegx-backend/tests/sb004-publication-invariant.test.ts` — the spec
*"🔴 declares every custom JavaScript signal output as a port"*, which re-derives the expected set
from each script and is graded by a mutant. It is an assertion on SB-004's graphs, not a fix.

## The defect

A `JavaScriptFunction` node's `Outputs.done()` is a **call**. It resolves only if `out-done` is on
the node's model as a `signal` port:

```ts
// simplejavascript.ts:634-636
_isSignalType: function (name) {
  return this.model.outputPorts[name] && this.model.outputPorts[name].type === 'signal';
}
```

Those ports are derived by parsing the script — and the derivation lives in the node module's
`setup()`, which returns before doing anything unless there is a live editor:

```ts
// simplejavascript.ts:772-775
setup: function (context, graphModel) {
  if (!context.editorConnection || !context.editorConnection.isRunningLocally()) return;
```

**A deployed backend has no editor connection**, and `WorkflowRunner` constructs its `CloudRunner`
with `connectToEditor: false` unconditionally. So the ports must already be in the graph.

They are, for an editor-drawn component: the derivation runs in the *editor's* viewer, the ports
come back over `sendDynamicPorts`, and the node carries `exportDynamicPorts: true` so `exportNode`
writes them into the bundle. They are **not**, for an MCP-authored one: the door writes the nodes
and wires it was given and derives nothing.

## What it costs

Measured on `claimSite`, the first cloud function SB-004 §7 ever called:

```
[noodl] JavaScriptFunction (/#__cloud__/claimSite): The script threw: Outputs.ok is not a function
        [function/script-threw]
[WorkflowRunner] Function claimSite failed after 30004ms: … did not send a response within 30000ms
```

No Response node is reached, so `POST /functions/claimSite` **504s after thirty seconds**. All six
of SB-004's code nodes had at least one dead signal. Nothing before the run could see it: the door
validated the graph as well-formed, and it *accepted the wires from those very ports* — so it knows
the port exists at validation time and simply does not persist it.

⚠️ **The built-in `success`/`failure` outcome outputs are unaffected** — they are declared on the
node type. That is why `cloud-run-tasks-loop.test.ts` has worked all along with `ports: []` on its
JavaScript node: its worker signals through `js.success`, never through a named `Outputs.x()`. The
gap is invisible to every existing spec for exactly that reason.

## The fix, and the two questions it has to answer

`_parseScriptForErrorsAndPorts` → `JavascriptNodeParser.parseAndAddPortsFromScript` already does the
derivation and imports nothing editor-shaped. The natural place is the authored write path, so a
component lands on disk carrying what the editor would have written.

1. **Which door.** `create_component`/`update_component` and the plan door both write graphs;
   the derivation belongs wherever the two already share (SB-001 put `checkRuntimeContext` in the
   shared gate for the same reason).
2. **Whether it writes or warns.** Writing a port the author did not send is the door editing the
   author's graph — defensible here, because it is *derived from the script the author did send* and
   the alternative is a graph that cannot run. A warning is the weaker option and would leave every
   existing authored component broken. **Needs a corpus sweep before it blocks**, like SB-009.

⚠️ **Same shape as SB-009 and worth reading beside it**: both are cases where a check or a
derivation exists, is correct, and is behind `isRunningLocally()`. That predicate is turning into a
class of defect — anything an agent authors is by definition not being watched by an editor.

## Related

- SB-004 §6 **F10** — the finding, with the workaround SB-004 took.
- SB-011 — the other half of the same class: `pointsTo`'s refusal is *reported* through
  `editorConnection`, so on a backend it is not reported at all.
- SB-009 — a component reference checked one way and not the other.
