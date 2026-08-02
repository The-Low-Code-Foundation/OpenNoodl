# OBS-003: Node-local diagnostics

## Metadata

| Field | Value |
|-------|-------|
| **ID** | OBS-003 |
| **Phase** | Phase 36 (Track U) |
| **Tier** | 2 |
| **Priority** | 🟠 High — highest value-per-hour in the phase |
| **Difficulty** | 🟢 Easy per check, unbounded in aggregate |
| **Prerequisites** | **none** |
| **Ships** | incrementally, from the first check |
| **Status** | ✅ **Built** 2026-08-02 — see [OBS-003-NOTES.md](./OBS-003-NOTES.md) |

## Objective

Have nodes report their own suspicious conditions at runtime, so that the most common "aha" moments
are a red ring and a Problems entry rather than a debugging session.

## The argument

The worked example from the design conversation: a States node received `"Clicked"` but the state is
named `"clicked"`. The capital C broke it.

That diagnosis is:

```js
if (!this.states.includes(value)) {
  this.context.editorConnection.sendWarning(componentName, this.id, 'states-unknown-state', {
    message: `Received "${value}" — no such state. Defined: ${this.states.join(', ')}`
  });
}
```

The States node **knows its own state names**. An LLM would also catch this — expensively,
non-deterministically, and only when online. It is a very costly way to run a string comparison the
node can run itself, offline, instantly, every time, and point at the exact node while doing it.

⚠️ **This is the task that most changes how the product feels, and it is the one with no
dependencies.** It can ship before OBS-001 and OBS-002, on infrastructure that already exists.

## What already exists

| Fact | Where |
|---|---|
| `sendWarning(componentName, nodeId, key, warning)` — the comment says it "draws the danger ring and files an entry in the Problems panel" | [editorconnection.ts:480](../../../packages/noodl-runtime/src/editorconnection.ts#L480) |
| `clearWarnings(componentName, nodeId)` — warnings are keyed and clearable, so a fixed condition un-rings | [editorconnection.ts:514](../../../packages/noodl-runtime/src/editorconnection.ts#L514) |
| Already called from ~6 places in the base Node class and from `nodescope.ts` for unknown node types | [node.ts:227](../../../packages/noodl-runtime/src/node.ts#L227), [:305](../../../packages/noodl-runtime/src/node.ts#L305), [:375](../../../packages/noodl-runtime/src/node.ts#L375), [:854](../../../packages/noodl-runtime/src/node.ts#L854), [nodescope.ts:178](../../../packages/noodl-runtime/src/nodescope.ts#L178) |
| Warnings reach the editor over the same relay as everything else | — |

**Nothing needs building.** This task is a body of authored checks plus the discipline for writing
them.

## Scope

### 1. A convention for runtime invariant checks

Before writing checks, write down the rule — this is the same failure mode phase 30 and phase 35
found repeatedly (*"the nodes are not individually bad so much as individually inconsistent, because
nobody wrote down the rule they all had to satisfy"*).

The convention needs to settle at minimum:

- **Warning keys** — stable, namespaced per node type, so `clearWarnings` works and duplicates
  collapse.
- **When to clear** — a warning must disappear when the condition resolves, or the Problems panel
  becomes noise and gets ignored.
- **Warning vs error** — a suspicious input is a warning; nothing here should be fatal.
- **Cost** — these run on the hot path. They must be cheap, and ideally only run when the input
  actually changes rather than on every update.
- **Where they live** — colocated with the node, not in a central registry.

### 2. A first batch of checks

Chosen because they are the failures that actually cost people afternoons:

| Node | Condition | Message shape |
|---|---|---|
| **States** | received a state name that matches no defined state | `Received "Clicked" — no such state. Defined: clicked, hover` |
| **States** | received a name differing only by case from a real one | `Did you mean "clicked"?` — the exact worked example |
| **Repeater** | `Items` received a non-array | `Items expects an array, received a string` |
| **Repeater** | `Items` received an array of primitives where objects are indexed | — |
| **Set Variable** | wrote to a variable **nothing reads** | `Nothing reads variable "cart"` — static, from topology |
| **Array / Object nodes** | received `undefined` on a required input | — |
| **Any node** | a required input has no connection and no value | — |

The last two are generic and belong in the base Node class rather than per node type.

### 3. The catalog as the home for declarations

The enriched node catalog (SUB-005) already carries per-node semantics. Declaring invariants there —
rather than hand-writing each check inline — is the scalable shape, and makes the checks visible to
the validator and the MCP server as well as the runtime.

⚠️ Treat this as a **direction, not a prerequisite**. Hand-write the first batch, extract the pattern
once there are enough of them to see it. Designing the declaration format before writing any checks
is the way this task stalls.

## Relationship to the rest of the phase

This is **layer 3** of OBS-002's walk. A hop that carries a warning renders with ⚠ and the message
inline — which is what turns a walk that says *"it stopped here"* into one that says *"it stopped
here, and this is why"*.

It is also what makes OBS-004 good. An agent reading a walk annotated with node-authored diagnoses is
reporting facts. An agent reading a bare graph is guessing.

## Acceptance

- [x] The convention is written down before the second check is authored —
      [`DIAGNOSTICS-CONTRACT.md`](../../reference/DIAGNOSTICS-CONTRACT.md), committed before the
      batch.
- [x] The States case-mismatch scenario produces a red ring and a Problems entry with the
      suggestion, with no debugger open and no trace running. **Verified live.**
- [x] Fixing the condition clears the warning. **Verified live for both checks — and the case where
      it did *not* clear was found live, not by the corpus.**
- [x] A busy fixture shows no measurable frame-time regression. **~14 ns per wire delivery, inside
      this machine's run-to-run noise.** Measured A/B rather than asserted; see the notes.
- [x] Warnings appear as ⚠ annotations on an OBS-002 walk. **Verified live, in structural mode** —
      a cold editor with nothing fired.

## What changed against this spec while building

⚠️ **The worked example was already half-built.** `_failUnknownState` (NDA-004 §2) already raised
`states/unknown-state` and already listed the real state names. What was missing was the *"Did you
mean?"* half — which is the actual example, because listing the names only helps an author who
reads the list and spots one capital letter.

⚠️ **Two of the proposed checks were dropped, and why matters.**

- *"Any node — a required input has no connection and no value."* **No port definition in the
  library declares a port required.** The check has no data to run on; it would have had to invent
  the notion first.
- *"Set Variable — wrote to a variable nothing reads."* This is a **static, whole-graph** question,
  not a node-local invariant, and belongs in the semantic validator. The contract's *What is not a
  diagnostic* section says so.

⚠️ **"Repeater — Items received an array of primitives where objects are indexed" was not built.**
It needs to know how the template indexes its item, which is not knowable from the Repeater. The
plain non-array case is built and is the one that costs afternoons.

⚠️ **The spec assumed `sendWarning` was the whole channel. It is now one of three**, and the
contract's first job turned out to be saying which conditions belong on which — the Failure
Contract and the Outcome Contract both landed after this task was written.

## Notes

There is no natural end to this task — it accumulates as node types get checks. Define a first batch,
ship it, and treat further checks as ordinary node-library maintenance rather than a phase deliverable.
