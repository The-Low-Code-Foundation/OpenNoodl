# Node Library Audit — First-Pass Findings

**Created:** 2026-07-28
**Status:** evidence gathered, not yet remediated. Every claim below carries a file:line citation.
**Scope of this pass:** the four systemic defect classes, plus the eight nodes Richard named by hand.
The remaining per-node work is tracked in [`NODE-REGISTER.md`](./NODE-REGISTER.md).

---

## How this pass was done

The catalog at [`packages/noodl-types/src/node-catalog.json`](../../../packages/noodl-types/src/node-catalog.json)
enumerates **155 nodes** with their full port schemas. That gives the audit a denominator and lets a
class of defect be counted rather than anecdotally reported. [`scripts/node-audit/register.js`](../../../scripts/node-audit/register.js)
derives the machine-checkable smells; everything else here came from reading the implementations.

The headline numbers, all reproducible:

| Measure | Count | Share |
|---|---|---|
| Catalogued nodes | 155 | — |
| Ports across all nodes | 2,650 | — |
| **Ports carrying a description** | 142 | **5%** |
| **Nodes where *no* port is documented** | 112 | **72%** |
| Nodes with a signal input + signal outputs but **no failure/error output** | 50 | 32% |
| Nodes with a signal input and **no signal output at all** | 10 | 6% |
| Deprecated nodes | 23 | 15% |
| Deprecated **but still in the node picker** | 4 | — |
| Nodes with no docs URL | 14 | 9% |

---

## Defect class A — the reactivity contract is not a contract

This is the one Richard described as cutting across everything, and it is the most valuable finding
in the pass, because it explains failures in Object, Array, Variable, Repeater and every Cloud Data
node at once. It is **not** one bug. It is three separate layers that each decided independently what
"changed" means.

### A1 — `Model` is correct. The collection is not.

[`model.ts:314-339`](../../../packages/noodl-runtime/src/model.ts#L314-L339) is well-behaved:
`set` notifies whenever `oldValue !== value`, which correctly includes a transition *to* `null`,
and it offers `forceChange` and `silent` escape hatches. Nothing needs fixing here.

The collection is a different story. `Collection` is not a class — it is a set of properties patched
onto `Array.prototype` ([`collection.ts:63-235`](../../../packages/noodl-runtime/src/collection.ts#L63-L235)).
Exactly five operations notify:

| Notifies | Silent |
|---|---|
| `add`, `addAtIndex`, `remove`, `removeAtIndex`, `set` | `push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`, `arr[i] = x`, `arr.length = 0` |

And then [`collection.ts:63-71`](../../../packages/noodl-runtime/src/collection.ts#L63-L71) hands the
raw array straight out:

```js
Object.defineProperty(Array.prototype, "items", {
  get(this: PatchedArray) { return this; },
```

`items` **is** the array. So the moment any user code — a Function node, a workflow step, an exported
module — reaches for `.items`, or simply treats the collection as the array it genuinely is, every
mutation from that point on is invisible to the `on('change')` listeners that fourteen nodes rely on
(`collectionnode2.ts:187`, `filtercollectionnode.ts:243`, `mapcollectionnode.ts:136`,
`dbcollectionnode2.ts:339`, `options.ts:62`, and others).

**This is exactly the reported symptom**: "using a JS node and `Noodl.Array` to add something doesn't
trigger the change signal". It is not intermittent and it is not mysterious — `push` was never wired
up. The rule an author actually has to internalise today is *"only the five verbs notify, and nothing
tells you which five"*, which is not a rule anyone can be expected to hold.

A second, quieter problem in the same file: `notify` is `async` and `await`s each listener
([`collection.ts:171-179`](../../../packages/noodl-runtime/src/collection.ts#L171-L179)), and so are
`add`/`remove`. A synchronous-looking `arr.add(x)` therefore settles a turn later than the caller
expects, and a listener that throws rejects a promise nobody holds.

### A2 — `undefined` and `null` are conflated, inconsistently, at four different layers

Richard's second symptom — "if the value was not null and then becomes null, that doesn't register,
and the old value is stuck" — is a defect *class*, not a single guard. Different layers guard on
different things:

| Layer | Guard | Effect |
|---|---|---|
| [`node.ts:426`](../../../packages/noodl-runtime/src/node.ts#L426) | `if (outputValue !== undefined)` | on connect, an undefined upstream value never seeds the input |
| [`modelcrudbase.ts:308`](../../../packages/noodl-runtime/src/nodes/std-library/data/modelcrudbase.ts#L308) | `if (value !== undefined)` | Set Object Properties silently skips the key rather than clearing it |
| [`collectionnode2.ts:112`](../../../packages/noodl-viewer-react/src/nodes/std-library/data/collectionnode2.ts#L112) | `if (value === undefined) return;` | the Array node ignores the write entirely |
| [`string.ts:24`](../../../packages/noodl-runtime/src/nodes/std-library/variables/string.ts#L24) | `String(value)` | a String variable fed `null` stores the **literal text `"null"`** |

That last one deserves calling out on its own. `cast: String` means `null` becomes `"null"` and
`undefined` becomes `"undefined"` — four and nine characters of visible garbage in the UI, and both
are truthy, so every downstream `Condition` takes the wrong branch. `Number`'s cast is no better:
`Number(null)` is `0` (indistinguishable from a real zero) and `Number(undefined)` is `NaN` (which
fails `!==` against itself, so [`variablebase.ts:98`](../../../packages/noodl-runtime/src/nodes/std-library/variables/variablebase.ts#L98)
reports `changed` on *every* set once a NaN lands).

**There is no defined semantics for "empty" anywhere in the runtime.** That is the actual defect. The
fix is not to patch four guards — it is to decide what `null` means (clear the value), what
`undefined` means (no opinion, leave it alone), write it down, and make all four layers obey it.

### A3 — `Variable` swallows the first change, `States` can swallow any of them

[`variablebase.ts:96-106`](../../../packages/noodl-runtime/src/nodes/std-library/variables/variablebase.ts#L96-L106)
only fires `changed` when `currentValue !== value`, which is right — but `initialize` seeds
`currentValue` with `startValue`, so a Variable that is *set* to its start value fires nothing, and
an author wiring "set to 0 then react" gets silence.

`States` is worse, and it is the direct cause of "sometimes triggering a state change using the state
value input doesn't trigger the state change output":

```ts
// states.ts:416-428
scheduleGoToState: function (this: StatesInstance, state: string) {
  this._internal.goToState = state;
  if (this.hasScheduledGoToState) return;   // <-- coalesces
  ...
}
// states.ts:430-434
goToState: function (this: StatesInstance, state?: string) {
  if (internal.state === state) return;      // <-- and then discards
```

State changes inside one update pass are **coalesced to the last one**. Go `A → B → A` within a
frame and `goToState` is called once with `A`; `internal.state` is already `A`; it returns; **no
signal fires at all**, and no `stateChanged`, and no `reached-A`. The intermediate `B` never happened
as far as anything downstream is concerned. There is additionally a deliberate first-transition
swallow at [`states.ts:407-412`](../../../packages/noodl-viewer-react/src/nodes/std-library/states.ts#L407-L412)
(`valuesAreInitialised`), which is defensible on its own but compounds the impression of randomness.

---

## Defect class B — 32% of action nodes cannot report failure

Fifty nodes take a signal input, emit signal outputs, and have no `Failure`/`Error` output among
them. Ten more take a signal input and emit **no** signal at all — `Send Event`, `Repeater`,
`Function`, `Logic Builder`, `Close Popup`, `Pop Component Stack`, `Navigate To Path`, `Unique Id`,
`External Link`, `Response`. Nothing downstream can sequence off "that finished", let alone "that
failed".

This is the structural reason behind Richard's "no information when it fucks up". It is not a
missing log line; the node has nowhere to *put* the information. Where a node does detect a problem
it usually routes to `editorConnection.sendWarning`, which is **editor-only** — it does not exist in
a deployed app, in cloud runtime, or in export.

## Defect class C — 95% of ports are undocumented

2,508 of 2,650 ports carry no `description`. 112 of 155 nodes have not a single documented port.

This is not a cosmetic docs gap, because three consumers read that field:

1. the property panel and connection panel, which is where an author asks "what does this do";
2. the semantic validator (SUB-006) and enrichment (SUB-005), which can only check what is described;
3. **the AI authoring loop** (AIX-002/AIX-011), where port descriptions are the primary signal the
   model has for choosing a port. 95% blank is why the model guesses.

Fourteen nodes additionally have no docs URL at all, and four deprecated nodes are still in the node
picker.

## Defect class D — string-matched contracts with no validation

`Run Tasks` is the clearest case and explains "god help you trying to get the Run or Do signal to
pass in there". The node drives its task component by *string*:

> "there is no port wiring between the template and this node, which is why the signal names
> `'Success'` and `'Failure'` are matched by string below" — [`runtasks.ts:24-28`](../../../packages/noodl-runtime/src/nodes/std-library/runtasks.ts#L24-L28)

It pulses an input literally named `'Do'` ([`runtasks.ts:234`](../../../packages/noodl-runtime/src/nodes/std-library/runtasks.ts#L234))
and listens for outputs literally named `'Success'` / `'Failure'`
([`runtasks.ts:347-351`](../../../packages/noodl-runtime/src/nodes/std-library/runtasks.ts#L347-L351)).
Name your component output `Done` and nothing happens, forever, with no warning — the four
`sendWarning` calls at `runtasks.ts:246-258` cover other conditions, not this one.

The same pattern appears in the popup nodes via dynamic `popupParam-` / `closeResult-` port prefixes
([`showpopup.ts:91-99`](../../../packages/noodl-viewer-react/src/nodes/navigation/showpopup.ts#L91-L99)),
and it is why the semantic validator has to skip port checks on "dynamic" nodes — the contract is
not expressible, so it cannot be checked.

---

## The eight named nodes

### 1. Columns — `net.noodl.visual.columns`

Three distinct defects, one of them a plain bug.

**The layout array is mutated in place.** [`Columns.tsx:43-47`](../../../packages/noodl-viewer-react/src/components/visual/Columns/Columns.tsx#L43-L47):

```js
const newLayout = layout;      // not a copy
if (rowWidth.expected < rowWidth.min) {
  newLayout.pop();
}
```

`calcAutofold` then recurses on its own mutated output
([`Columns.tsx:18-27`](../../../packages/noodl-viewer-react/src/components/visual/Columns/Columns.tsx#L18-L27)).
The only responsive behaviour the node has is *popping columns off the end* until the row fits — it
cannot reflow `1 2 1` into two rows, cannot change ratios per breakpoint, and cannot grow back
without a fresh render pass.

**There are no breakpoints.** The entire responsive API is one `layoutString` (`'1 2 1'`) plus a
single `minWidth` ([`columns.ts:40-100`](../../../packages/noodl-viewer-react/src/nodes/visual/columns.ts#L40-L100)).
There is no way to express "3 up on desktop, 2 on tablet, 1 on mobile", which is the request every
real layout makes.

**Repeaters bypass the column layout entirely.** [`Columns.tsx:119-134`](../../../packages/noodl-viewer-react/src/components/visual/Columns/Columns.tsx#L119-L134)
filters `ForEachComponent` *out* of `children` and renders it separately at line 154, outside the
`.column-item` wrapper that carries the width:

```jsx
{forEachComponent && forEachComponent}
{children.map((child, i) => ( <div className="column-item" style={{ width: ... }}> ))}
```

with the comment "ForEachComponent breaks the layout but is needed to send onMount/onUnmount". So
Columns + Repeater — the single most common reason to reach for Columns — produces unwrapped,
unsized children. Masonry is not merely absent; **ordinary column layout over a repeater does not
work**, and the fix for masonry has to start here.

Also worth fixing while in there: `visibility: hidden` until the first `ResizeObserver` callback
([`Columns.tsx:141`](../../../packages/noodl-viewer-react/src/components/visual/Columns/Columns.tsx#L141))
means the node renders blank on first paint and renders blank under SSR, which is why the catalog
marks it `partial`.

### 2. Icon — `net.noodl.visual.icon`

The node itself is thin and fine ([`icon.ts`](../../../packages/noodl-viewer-react/src/nodes/visual/icon.ts),
45 lines). The problem is the shape of `Noodl.Icon`: a `{ class, code, codeAsClass }` triple that the
renderer splats into a `<span>`
([`Icon.tsx:32-38`](../../../packages/noodl-viewer-react/src/components/visual/Icon/Icon.tsx#L32-L38)).

That model assumes **icon-font semantics** — a CSS class plus a codepoint. It cannot represent an SVG
sprite, an inline SVG set, or an icon component library, which is what essentially every modern icon
set ships as. Adding a custom set therefore means getting a font *and* a stylesheet into the editor's
own document (so the picker can render it) *and* into the viewer document (so the app can), through
two different asset paths. That is the "very tricky to add custom icon sets and actually see them"
complaint, and it is a design limit rather than a bug.

Related, already-known: `IconSize` is inert at all 130 call sites in the editor UI (see the
`uix-010` note) — a separate issue in the editor chrome, not this node, but it will come up in the
same conversation.

### 3. Component Stack — `navigation-stack.tsx`

894 lines. The mode split Richard describes is real: transitions are constructed only on the stack
path ([`navigation-stack.tsx:717-765`](../../../packages/noodl-viewer-react/src/nodes/navigation/navigation-stack.tsx#L717-L765)),
so "replace" has no animation surface at all. There is one thing worth correcting in the brief: I
could not find any `scrollIntoView`/`scrollTo` call in this file — the scroll-jump on switching is
therefore coming from somewhere else (browser focus restoration, the router, or a `Page` mount), and
**that needs to be reproduced live before it is specified**, or the fix will be aimed at the wrong
component. This is the one item in the eight where I have a symptom and no confirmed cause.

### 4. Run Tasks — see defect class D above

Additionally: `sendSignalOnInput(taskComponent, 'Do')` at
[`runtasks.ts:234`](../../../packages/noodl-runtime/src/nodes/std-library/runtasks.ts#L234) reaches
into another component's scope to pulse it, which is why the setup feels like action-at-a-distance —
there is no wire to look at, so there is nothing on the canvas that explains the coupling.

### 5. Show / Close Popup

Both symptoms are structural.

**Data in and out is by dynamic string-prefixed ports.** `popupParam-*` on the way in, `closeResult-*`
on the way out ([`showpopup.ts:91-99`](../../../packages/noodl-viewer-react/src/nodes/navigation/showpopup.ts#L91-L99), [`showpopup.ts:140`](../../../packages/noodl-viewer-react/src/nodes/navigation/showpopup.ts#L140),
[`closepopup.ts:118`](../../../packages/noodl-viewer-react/src/nodes/navigation/closepopup.ts#L118)).
Nothing type-checks the pair, and the validator has to skip it.

**Close Popup finds its target through an injected callback, not a wire.** `_setCloseCallback`
([`closepopup.ts:64-66`](../../../packages/noodl-viewer-react/src/nodes/navigation/closepopup.ts#L64-L66))
is called by whatever mounted the popup; `showPopup` passes `senderNode: this.nodeScope.componentOwner`
([`showpopup.ts:78`](../../../packages/noodl-viewer-react/src/nodes/navigation/showpopup.ts#L78)).
So whether a given Close Popup node works depends on which component scope it happens to sit in, with
no visible indication. That is precisely "very hard to find the right place to put the close popup
node so that it actually works".

**Nothing de-duplicates shows.** `scheduleShow` coalesces within one update pass
([`showpopup.ts:63-73`](../../../packages/noodl-viewer-react/src/nodes/navigation/showpopup.ts#L63-L73))
but two passes, or two Show Popup nodes, stack two popups. There is no "already showing" guard and no
stack policy.

### 6. States — see A3 above

### 7. Array nodes — see A1 above

### 8. REST node — `restnode.ts`

671 lines, plus [`httpnode.ts`](../../../packages/noodl-runtime/src/nodes/std-library/data/httpnode.ts)
at 1,078 lines covering overlapping ground. The "cute little REST custom language" is the
resource-definition string format. The audit position is straightforward: **there are now two HTTP
nodes and the newer one does not need the DSL.** The task is to confirm `httpnode` is a superset in
practice, then deprecate the REST node's DSL path rather than improve it. Note `httpnode.ts:353-462`
carries six separate `!== undefined && !== null` guards — same defect class A2, same file.

---

## What this pass did *not* cover

- **147 of 155 nodes** have only their machine-derived smell row in `NODE-REGISTER.md`. No
  implementation has been read for them.
- The Component Stack scroll behaviour is **unreproduced** (see above).
- No live verification of any finding. Everything here is read from source. The `run-editor` skill and
  the NodeGX QA fixture exist to change that, and the first task of the phase should be a failing-test
  corpus rather than a fix.
- Deprecated-node dispositions (23 nodes) have not been decided.
