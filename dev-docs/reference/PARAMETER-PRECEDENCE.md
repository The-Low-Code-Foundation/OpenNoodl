# Parameter Precedence — what wins when a port is both set and connected

**Status:** Descriptive. Written 2026-08-24 (phase 75, FB-018 scope 3) by reading the runtime,
not by changing it. **Applies to:** every input port that has both a stored parameter and an
incoming connection.

This rule was, until this file existed, derivable **only** from the execution order of two
functions in two files. Nothing in the editor said it, nothing in the docs said it, and a test
user hit it in his first hour.

## The report this came from

> *"The user was confused about what value was 'winning' — he hooked up a connector with a
> number value to the width input, then changed the width manually in the props panel, and
> couldn't understand why changing it manually showed the change on the screen, but then it
> reset to the connected value on refresh."*

🔴 **He was reading the system correctly.** Both halves of what he saw are what the runtime does.
The bug was never that the value was wrong — it was that nothing on screen could have told him
which value he was looking at.

## The rule

**A stored parameter is the fallback. The connection supplies the value — but only from the
moment it actually delivers one.**

Concretely, and this is the part that surprises people:

> **A connection that has never sent anything does not override the parameter.** The typed
> value is live, is what renders, and stays live until the source next fires.

That is why "the connection wins" is the wrong sentence to put in front of an author. It is
false in exactly the state the confused author is standing in.

## Why — the two places it is decided

### 1. At load: nodes and their parameters first, connections second

[`nodescope.ts:428`](../../packages/noodl-runtime/src/nodescope.ts#L428) — `setComponentModel`
creates **every** node before attaching **any** connection:

```ts
for (const nodeModel of componentModel.getAllNodes()) { ... }        // queueInput(...) per parameter
componentModel.getAllConnections().forEach((conn) => this.addConnection(conn));
```

Each node queues its stored parameters as it is created
([`nodescope.ts:210`](../../packages/noodl-runtime/src/nodescope.ts#L210), `node.queueInput`).
So by the time connections are attached, the typed value is already in place — and whether it
survives is decided by the next step.

### 2. At attach: a connection pushes only a value it actually has

[`node.ts:526–528`](../../packages/noodl-runtime/src/node.ts#L526-L528), in
`addInputConnection`:

```ts
var outputValue = sourcePort.value;
if (outputValue !== undefined) {
  this._setValueFromConnection(inputName, outputValue);
}
```

🔴 **`undefined` is not a value here, it is an absence, and the difference is the whole rule.**
A source whose output is `undefined` at attach time pushes nothing, the queued parameter is
never overwritten, and the port renders the typed value. A source that already holds a value
overwrites the parameter immediately — which is the "it reset on refresh" half of the report.

⚠️ Signals take the branch above it: a source that sent a signal this update replays it rather
than pushing a value, so signal ports are not part of this rule at all.

## What the author is shown

FB-018. A connected row renders the **binding chip** in place of its control — the value is not
editable-looking, because editing it writes a fallback, not a value. The chip carries this rule
as its tooltip, from
[`bindingTooltip()`](../../packages/noodl-core-ui/src/components/property-panel/BindingChip/BindingChip.tsx):

> This input is driven by *&lt;source&gt;*. The value you typed is used only while the connection
> hasn't sent anything.

⚠️ **That wording is chosen to be true before the first push and after it**, for the reason
above. Do not "simplify" it to *the connection wins* or *the connection overrides your value*;
`tests-unit/fb-018/bindingChipRows.test.tsx` asserts against both of those words on purpose.

Which rows chip and which do not is recorded, per row class, in
[`connectedRowPolicy.ts`](../../packages/noodl-editor/src/editor/src/views/panels/propertyeditor/DataTypes/connectedRowPolicy.ts),
and graded against the dispatch chain in `Ports.ts`.

## What this file does NOT say

- ⚠️ **It does not endorse the ordering.** FB-018 deliberately changed no runtime behaviour: a
  panel that describes the system honestly is a smaller and safer change than one that
  re-times connection attachment, and the blast radius of the latter belongs to FB-019.
- ⚠️ **The live-editing path was not traced end to end.** What is verified here is the load
  path (the two files above) and the observable behaviour the report describes. The
  reconstruction that a *later* parameter edit overwrites a value the connection already pushed
  — until the source next fires — is consistent with both, and was reproduced by hand by two
  people independently (FB-018's ground truth, and Jordan's session-2 §2.3), but it is not
  pinned by a spec in this repo.
- ⚠️ **Nothing here is about which value is *stored*.** The parameter survives a connection
  untouched in the project file; disconnecting restores it. The chip hides the field, it does
  not clear the value.
