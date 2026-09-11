# ELO-001 — A port list cached before the library could answer

**Status:** ✅ **closed 2026-08-11** · **Track ELO** · Filed as SIG-005 **R8**, SIG-006 **R2**

> On a fresh open of a project, every connection in the component the editor lands on reports
> `fromPort === undefined`, so `NodeLibrary.nameForPortType` returns undefined,
> `CanvasTheme.connectionColors` falls through to the *data* pair, and **a signal wire is painted
> green instead of cyan** — until you navigate to another component and back.

Phase 60's premise is *a wire has a kind, and the editor draws it*. In the one graph every builder
sees first, it drew it wrong.

## What was measured, before anything was changed

Driven in the running editor on `lib21-qa`, 2026-08-11, cold boot each time. The landing component
(`/#__page__/Home`) was given one signal wire for the purpose — the existing `net.noodl.controls.button`
already in it, `onClick` → a `String` variable's `saveValue` — staged on disk so it was present at the
first bind rather than created in-session. Removed afterwards; `project.json` restored byte-for-byte
and the SHA checked (`fed8a885…`).

### The trace — a temporary probe in `resolvePorts` and in the `libraryUpdated` handler

```
resolvePorts onClick -> saveValue  from=UNRESOLVED  portsOnFromNode=0  libLoaded=false  typeCtor=UnknownNodeType
libraryUpdated handler in EditorEventBindings, connections=1
resolvePorts onClick -> saveValue  from=UNRESOLVED  portsOnFromNode=0  libLoaded=true   typeCtor=BasicNodeType
```

Read the third line. **The library has loaded and the type has resolved to a `BasicNodeType` — and the
node still reports zero ports.** The re-resolve fires, finds the right type, and still cannot answer.
That is the whole defect in one line, and it is not what it looked like.

### The consequence — composited canvas pixels, same wire, same session

`ed.layoutAndPaint()` to force a frame, then `getImageData` over the graph canvas, counting exact
matches of the dark-theme wire tokens. Selection and highlight cleared first, or the measurement is of
`wireSignalHighlighted`.

| state of `c.fromPort` | `#35c3e8` (signal) | `#45d08a` (data) |
|---|---:|---:|
| `undefined` — as at cold open, per the trace above | **0** | **767** |
| resolved | **751** | **0** |

Not a ratio and not an impression: the signal wire was painted *entirely* in the data colour, and none
of it in its own.

## The cause, and why the obvious reading is wrong

It reads like load ordering, and SIG-005 filed it as load ordering. The listener is not the problem —
[`EditorEventBindings.ts:58-70`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/EditorEventBindings.ts#L58-L70)
subscribes to `libraryUpdated` and re-resolves every connection's ports, and the trace proves it runs,
with the connection in hand, after the library has loaded.

The problem is what it finds.
[`NodeGraphNode.getPorts()`](../../../packages/noodl-editor/src/editor/src/models/nodegraphmodel/NodeGraphNode.ts#L501):

```ts
if (!this._ports) {
  var ports = this.type.ports ? this.type.ports : [];   // UnknownNodeType -> []
  …
  this._ports = ports;                                  // and [] is TRUTHY
} else ports = this._ports;
```

`NodeGraphEditorConnection.connect()` calls `resolvePorts()` at bind time — inside the window where
the library is still empty — so the first caller banks an **empty array**, and `[]` passes
`if (!this._ports)` for the rest of the session. The guard cannot tell "not computed" from "computed
against nothing".

Two listeners then fire on `libraryUpdated` and between them they miss it by one tick:

- `EditorEventBindings` re-resolves every connection **synchronously** — off the stale cache.
- [`NodeGraphModel.ts:144-149`](../../../packages/noodl-editor/src/editor/src/models/nodegraphmodel/NodeGraphModel.ts#L144-L149)
  only *schedules* `updateTypes()`, and `scheduleUpdateTypes` is a `setTimeout(…, 1)`.
  `updateType()` **does** clear `_ports` — one tick after the only thing that would have re-read it.

So the cache is repaired and nothing re-resolves again. `fromPort` stays `undefined` until the next
`bindModel`, which is exactly what navigating away and back does. ⚠️ **This is also why probing the
live editor a few seconds after opening shows a perfectly healthy cache (`_ports.length === 103`) and
a broken `fromPort`** — the evidence of the cause has already been cleaned up by the time you look for
it. The first attempt at this diagnosis was abandoned on that reading; only the in-boot trace settles
it.

## The fix

One condition, at the cache:

```ts
if (!NodeLibrary.instance.typeIsMissing(type)) this._ports = ports;
```

A list derived from a type the library could not answer for is not memoised, so the next caller
re-derives it. After the library loads, `EditorEventBindings`' existing synchronous re-resolve finds
103 ports instead of 0 and the wire resolves in the same tick it always tried to.

**Why the cache and not the ordering.** Re-ordering the two listeners would fix the wire and leave
every other consumer that read the node during the window — the property panel, warnings, the node
picker — holding the same empty list. And it would have to stay ordered. The cache is the one place
the mistake is made.

**Why it does not cost the hot path.** `typeIsMissing` is consulted only on a cache miss, and only a
*missing* type declines to cache. A node whose type resolved memoises exactly as before — graded, so
that a later refactor cannot quietly turn `getPorts` into a per-call rebuild. The re-derivation path
for a genuinely unknown node calls `getNodeTypeWithName` on each access, which is the same shape the
`type` getter has always had for an unresolved type (`_type` stays undefined, so every `.type` access
already re-asks) — this adds a caller to an existing pathology rather than a new one.

## The gate

`packages/noodl-editor/tests/models/NodeGraphNodePortCache.test.ts`, three specs, in the Electron
Jasmine suite (`test:ci`) — reachable only from there, because `NodeGraphNode` pulls in `NodeLibrary`,
`WarningsModel` and `UndoQueue`, and `tests-unit/`'s allowlist is import-free modules by design.

1. **resolves the port once the type arrives, even though it was asked first** — the defect itself.
2. **resolves it synchronously, in the tick the library reloads in** — the part that matters, since
   the editor's only re-resolve is inside the `libraryUpdated` handler. A repair that landed on
   `NodeGraphModel`'s deferred `updateTypes()` would pass spec 1 and still leave the wire green.
3. **still caches the port list of a type that did resolve** — the perf guard above.

⚠️ **Proved red by reverting the fix and running the full suite**, not by reading its own green line —
SIG-003's `catalog:groups:check` shipped a first version that read a field its source lacked and
printed a confident `✓ 0`. Specs 1 and 2 fail with the guard removed; spec 3 passes either way, which
is correct, since it grades what must *not* change.

## Register

| # | Finding | State |
|---|---|---|
| **R1** | 🔴 **The evidence destroys itself.** `NodeGraphModel.scheduleUpdateTypes()` clears every node's `_ports` a tick after the library loads, so by the time anything can be probed from the console the cache is healthy and only `fromPort` is stale. That reading — "the model is fine, so this is pure load ordering" — is wrong, and it survives any amount of source reading. **A defect inside a boot window has to be measured inside the boot window.** | ✅ recorded |
| **R2** | ⚠️ **`[]` is truthy, and every `if (!cache)` in this codebase is blind to it.** The distinction between *not computed* and *computed against nothing* is not expressible in the guard the editor uses everywhere. See the track README. | 📋 open — worth a sweep |
| **R3** | ℹ️ **`getPorts()` aliases the type's own array.** When a node has no instance or dynamic ports, `ports = this.type.ports` by reference, and the `each`/`sort` below mutate and reorder the **type's** port list in place; `_ports` then aliases it. Pre-existing, untouched by this fix, and a live trap for anything that assumes a type's declaration order is stable. | 📋 open — not this task |
