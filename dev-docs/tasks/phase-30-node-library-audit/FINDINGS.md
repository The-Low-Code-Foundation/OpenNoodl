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

### B-i — a write that reported success and went nowhere (2026-07-30)

`Set Parent Component Object Properties` is the worst instance of class B found so far, and it is
not a silence. `setparentcomponentobjectproperties.ts` walked up for an ancestor owning a Component
Object and returned `undefined` when there was none. The shared base at
`componentutils/base.ts` passed that straight into `Model.get`, and `Model.get(undefined)` is the
**anonymous tier** (`packages/noodl-runtime/src/model.ts:205-212`): it mints a fresh, unnamed record
on every call, which nothing else in the graph can reach and nothing holds a reference to.

So the node wrote every wired property into a throwaway and emitted `Done`. Every other class-B
defect in this phase made a working node look broken. This one made a broken node look like it
worked, which is the one thing the Failure Contract says a completion signal must never do.

Generalised into the Binding Contract: **a walk that can return nothing must never hand that nothing
to a create-on-read lookup.** The miss has to be a branch, not a value.

### B-ii — the Video node's two invisible failures (2026-07-30)

`HTMLMediaElement.play()` returns a promise, and `Video.tsx` dropped it at all three call sites
(`play`, `restart`, and the deferred play in `onCanPlay`). Under the browsers' autoplay policy a
`Play` on a page the user has not yet interacted with rejects with `NotAllowedError` and nothing
happens: no warning, no signal, no console line. This is almost certainly the most-hit single defect
in the phase, because it fires on every autoplaying video in every deployed app.

The register's triage predicted that one from the node's category. Reading the file found a second
it could not have: the `<video>` element's **`error` event had no listener at all**. A 404 source or
an undecodable one never fires `canplay`, so a `Play` sets `wantToPlay` and waits for ever — exactly
as if nobody had pressed it. `Image` has had an `On Error` port all along; `Video` never got one.

The third finding is the one that constrains the fix: `AbortError` — `play()` superseded by a
`pause()` or a new `src` — rejects on a graph that is working exactly as written. It is deliberately
**not** reported, and `SILENT_PLAY_REJECTIONS` in `Video.tsx` is where that decision lives.

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

> **RESOLVED 2026-07-29 by NDA-008 §0 — and the caution above was worth every word.** The stack
> moves the scroll position **0 px** on a switch and calls `focus()` **0 times** (patched and
> counted, across navigate/replace/`useRoutes` on and off). The scroll is the browser focusing an
> element inside the viewer's `overflow: hidden` app root (`viewer.jsx:344-353`) — which stops the
> *user* scrolling, not the browser, so the jump is one-way and the header never comes back. The
> only DOM focus in the library is `TextInput` (`text-input.ts:211-214`). Full account in
> [`NDA-008-COMPONENT-STACK.md`](NDA-008-COMPONENT-STACK.md) §0.

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

# Second pass — defects found outside the original eight

**Added 2026-07-29.** The first pass read only the eight nodes Richard named and swept the other 147
*structurally* (ports, signals, docs coverage). A structural sweep cannot find "works until you add a
second one", so it found none of the five defects below. Richard reported four of them from memory;
the fifth (class E) fell out while confirming the third.

Two of these generalise into new systemic classes.

## Defect class E — `object` and `array` are dead ends in the type system

This started as "there were output types on Function and Script nodes that don't work, like objects".
It is not a Function-node bug. It is the port type table.

The Function/Script node offers `object` as an output type, and the value it carries is fine. The
problem is what an `object` port is allowed to *connect to*. From the catalog's typecast table:

```
{ "from": "object", "to": [] }        ← casts to nothing
{ "from": "string", "to": [ …, "array", "object" ] }   ← but string casts INTO object
```

So an `object`-typed output connects only to an input *exactly* typed `object`. Counting those across
the whole library:

| | Count |
|---|---|
| Input ports in the library | 1,750 |
| **Input ports typed `object`** | **4** — `Global Store.initialState`, `Server-Sent Events.headers`, `State Snapshot.snapshotData`, `Send Email.variables` |
| Input ports typed `*` (wildcard) | 12 |
| Output ports typed `object` | 13 |

**An `object` output can reach four destinations in the entire product.** And because the Function
node defaults an untyped output to `*` ([`simplejavascript.ts:442`](../../../packages/noodl-runtime/src/nodes/std-library/simplejavascript.ts#L442),
`node.parameters['outtype-' + p.label] || '*'`), **selecting the correct type makes the port strictly
less useful than leaving it alone**. That is a UI that punishes the author for being accurate, which
is a fair description of "output types that don't work".

The same is half-true of `array`: it casts only to `collection` and back. The 13 `object` outputs
include `HTTP Request.responseHeaders`, `Query Data.firstRecord` and every `error` port on the Cloud
Data nodes — i.e. the error objects from defect class B are themselves nearly unconnectable.

Fixing this is a type-table decision, not a node fix: either `object` gains casts (to `string` via
JSON, at minimum), or `*` becomes the honest default and the enum stops offering a choice that makes
things worse.

## Defect class F — implicit nearest-ancestor resolution, with no way to target

Richard's report: "you can't target a specific component object with the Parent Component Object
node, so if you've made a couple of components that both have Component Objects in them and you nest
the components, sometimes the wrong Component Object will be updated."

Confirmed, and it is not "sometimes" — it is deterministic and undiscoverable.
[`parentcomponentobject.ts:149-186`](../../../packages/noodl-viewer-react/src/nodes/std-library/componentutils/parentcomponentobject.ts#L149-L186)
walks up the component tree and returns the **first** ancestor that contains a
`net.noodl.ComponentObject` node:

```ts
if (parent.nodeScope.getNodesWithType('net.noodl.ComponentObject').length > 0) {
  return parent;
}
return getParentComponent(parent);   // otherwise keep walking
```

There is no name input, no id input, no depth input — **nothing on the node lets an author say which
ancestor they meant**. Nest two components that each own a Component Object and the inner node
silently binds to the nearer one. The node does expose the resolved name in `getInspectInfo`
([`parentcomponentobject.ts:101-103`](../../../packages/noodl-viewer-react/src/nodes/std-library/componentutils/parentcomponentobject.ts#L101-L103)),
which is the only way to find out what happened, and only while inspecting.

Worse, the resolution is not stable. One branch walks `getVisualParentNode()`
([`parentcomponentobject.ts:159`](../../../packages/noodl-viewer-react/src/nodes/std-library/componentutils/parentcomponentobject.ts#L159)),
so **the binding can change when the visual tree changes**, and there is a standing
`//FIXME: temporary hack` at [line 88](../../../packages/noodl-viewer-react/src/nodes/std-library/componentutils/parentcomponentobject.ts#L88)
deferring resolution by a frame because the parent's node scope may not exist yet. That is where the
"sometimes" comes from.

**This is the same shape as the Close Popup defect** in the first pass: a node that finds its target
by walking scope, with no way to name the target and no indication of what it found. Treat them as
one class. The fix is the same in both: an optional explicit target, and a *visible* indication of
what was resolved when it is left implicit.

### The class F sweep — done 2026-07-29 (NDA-015 §2, criterion 4)

Both named nodes are fixed. The sweep the spec asked for — grep `getNodesWithType`,
`parentNodeScope`, `getVisualParentNode`, `componentOwner` across `noodl-runtime/src/nodes` and
`noodl-viewer-react/src/nodes` — found the class is **wider than the two reported nodes**, in two
directions the specs did not name.

**F-i. The walk itself existed four times, and had already drifted.** The recursive
`getParentComponent` was hand-copied into `parentcomponentobject.ts`,
`setparentcomponentobjectproperties.ts`, `javascriptnodeparser.js` and the deprecated
`parentcomponentstate.ts`. Three of them are not identical: the `.js` copy accepts the deprecated
`'Component State'` node type as well as `'net.noodl.ComponentObject'`, the two TypeScript copies
accept only the latter. So **a Function node reading `Component Object` and a Parent Component Object
node sitting in the same place could resolve to different ancestors**, with nothing to say so. Closed
by moving the walk to `noodl-runtime/src/componentwalk.ts` and having the Component Object family
accept both types.

**F-i′. F-i was only a quarter closed, and the live half was worse than the half that was fixed.**
Re-read on 2026-07-29 while doing F-ii: only `parentcomponentobject.ts` had actually adopted
`componentwalk.ts`. `setparentcomponentobjectproperties.ts`, `parentcomponentstate.ts` and
`javascriptnodeparser.js` were **still hand-rolled**, still carrying their own type lists — so the
drift F-i describes was still shipping, in a worse direction than the one it names:

| Site | Accepted | Direction |
|---|---|---|
| `parentcomponentobject.ts` | modern + deprecated | **read** |
| `javascriptnodeparser.js` | modern + deprecated | read (Function nodes) |
| `setparentcomponentobjectproperties.ts` | modern only | **write** |
| `parentcomponentstate.ts` (deprecated node) | deprecated only | read/write |

F-i's example is two *readers* disagreeing. The live one is a **reader and a writer of the same
state disagreeing**: with a deprecated `Component State` on `/Outer` and a modern Component Object
on `/Root`, `Parent Component Object` read `/Outer` while the `Set Parent Component Object
Properties` node beside it wrote `/Root`. The author sees a value that never changes and a write
that never lands, with nothing on the canvas to explain it. Now closed for real — all four go
through `componentwalk.ts`, and the type list is a shared constant (`COMPONENT_OBJECT_TYPES`) rather
than four hand-written lists. The deprecated node's list stays deliberately narrower; widening it
would have *moved* bindings rather than aligned them, which is written into the code.

Worth generalising: **"de-duplicated into one place" is a claim to re-check, not a fact to inherit.**
The commit that created `componentwalk.ts` converted one of four call sites and described the job as
done.

**F-i″. And sharing the walk was still not the end of it (2026-07-30).** With all four sites on
`componentwalk.ts` the reader and the writer could no longer *disagree*, but the writer still had no
explicit target — the last ⚠️ row in `BINDING-CONTRACT.md`'s table — and, worse, no answer for the
case where the shared walk returns nothing. That is B-i above: it handed the `undefined` to
`Model.get` and reported `Done`. Closed 2026-07-30; `Set Parent Component Object Properties` now
obeys all three clauses, with the same `targetComponent` input spelled identically to its reader's
so the pair can be aimed together.

The pattern across F-i, F-i′ and F-i″ is worth stating plainly: **each round of "this is now
consistent" left a real defect behind, and each one was found by reading rather than by grep.**

**F-ii. `_forEachModel` is the same defect class — five sites. ✅ Closed 2026-07-29.** All five now
resolve through `noodl-runtime/src/foreachitem.ts`, which implements the three clauses once: an
optional `Repeater Component` input (a), the resolved template on the node card (b), and
`repeater-item/no-item-in-scope` · `/target-not-found` · `/target-has-no-item` (c). 16 corpus rows,
shown to discriminate. Three things the original write-up did not know:

- **There are two producers, not one.** `runtasks.ts:193` sets `_forEachModel` with the same
  `createNode` extraProps shape as the Repeater, so the messages name both — telling an author with
  a Run Tasks template that they are "not inside a Repeater" would send them hunting a bug that is
  not there.
- **The fifth site could not be fixed like the other four.** `Component.RepeaterObject` is computed
  for *every* Function node in the project, not only ones whose author asked for a repeater item, so
  raising eagerly would have filed a failure against every Function node in every non-repeated
  component. It is a lazy getter; only a script that reads it can be told it resolved nothing.
- **One of the five was crashing, not falling silent.** `dbmodelnode2.setModel` dereferenced its
  argument unguarded (a documented live defect, PLAT-003 NOTES §27.3), so a `Record` set to "From
  repeater" outside a repeater threw a `TypeError` from inside an input setter. Its twin the Object
  node always guarded. Fixed with the rest.

The original write-up follows.

**F-ii (as first written).** "The current Repeater item"
is resolved by walking `parentNodeScope.componentOwner` upwards until a component carries
`_forEachModel`:

| File | Line |
|---|---|
| `data/modelcrudbase.ts` | 104–106 |
| `data/modelnode2.ts` | 126–128 |
| `data/dbmodelcrudbase.ts` | 292–294 |
| `data/dbmodelnode2.ts` | 153–155 |
| `javascriptnodeparser.js` | 429–432 (`_findForEachModel`) |

Every one ends `setModel(component !== undefined ? component._forEachModel : undefined)` — so setting
**Id Source = Repeater Item on a node that is not inside a Repeater silently binds to nothing**, which
is clause (c) exactly. Nested Repeaters give the same undiscoverable nearest-wins binding as clause
(a). Not fixed here: it is five files this task does not otherwise touch, each needing its own corpus
row, and the shape is named as `findAncestorWithProperty` in `componentwalk.ts` so a sixth spelling
does not get invented. **This is the highest-value remaining item in class F.**

> Path correction: all five sites are in **`packages/noodl-runtime/src/`**, not the viewer — the
> table's bare `data/…` prefixes read as viewer paths and are not.

**What the sweep cleared.** The other `componentOwner` hits are not this class: they read
`componentOwner.name` to attribute a warning (~20 sites), or `componentOwner` for the node's *own*
scope rather than an ancestor's. `getNodesWithType` on a `graphModel` (Users, HTTP, REST, BYOB, …) is
editor-time port plumbing over the whole project, not a scope walk. Routers and Page Stacks target by
an explicit name already, so they satisfy clause (a) and only lack (b).

## The Repeater does not re-read its source on Refresh

Richard: "when an array feeding into the repeater is changed… not through the standard Noodl node
system… the repeater doesn't update, and using the Refresh signal does fuck all."

Both halves confirmed, and they are **two separate bugs**.

The first half is defect class A1 — the source collection never notifies on `push`, so
`onItemsCollectionChanged` never runs. The `items` setter also early-returns on an unchanged
reference ([`foreach.tsx:209`](../../../packages/noodl-viewer-react/src/nodes/std-library/data/foreach.tsx#L209),
`if (value === this._internal.items) return;`), so re-sending the same mutated array does nothing either.

The second half is its own defect and the more damning one. The Repeater keeps a private copy of the
collection — "so we don't have to refresh all content if the input items collection changes"
([`foreach.tsx:162`](../../../packages/noodl-viewer-react/src/nodes/std-library/data/foreach.tsx#L162)) —
and **`refresh()` rebuilds from that copy, never from `items`**:

```ts
// foreach.tsx:509-527
refresh: async function () {
  this._deleteAllItemNodes();
  ...
  for (let i = 0; i < internal.collection.size(); i++) {   // <-- the private copy
    const model = internal.collection.get(i);
    await this.addItem(model, baseIndex + i);
  }
}
```

`internal.collection` is only resynced by `internal.collection.set(internal.items)`, which runs from
`onItemsCollectionChanged` (never fires — see above) and `scheduleCopyItems` (only when a *different*
array object arrives). So Refresh tears down every item node and rebuilds them from stale data,
producing byte-identical output at the cost of a full re-render. It does not do nothing; it does a
lot of work and changes nothing, which is worse.

**Fix is one line in shape**: `refresh()` must resync from `items` before rebuilding. That is what a
signal named Refresh means, and it makes the Repeater recoverable even while class A1 is outstanding
— which is a good argument for landing it *before* NDA-002.

`Array Filter` and `Array Map` are downstream of the same A1 defect
([`filtercollectionnode.ts:243`](../../../packages/noodl-viewer-react/src/nodes/std-library/data/filtercollectionnode.ts#L243),
[`mapcollectionnode.ts:136`](../../../packages/noodl-viewer-react/src/nodes/std-library/data/mapcollectionnode.ts#L136)),
and neither has a Refresh input at all.

## Text sizes to content until you touch Size Mode

Richard: "the text node starts off as responsive width, but if you add two text nodes side by side
the first one will take up 100% of the width, unless you change to fixed width and back to
responsive, then it works."

> **SUPERSEDED 2026-07-29 by NDA-016 §0.** The mechanism below is wrong, and the "gap" it records
> was the tell. `sizeMode` is **never unset** — a fresh, never-touched Text node reads
> `props.sizeMode === 'contentHeight'`, `props.width === '100%'` off the live node in the preview,
> and so does every one of 15 visual node types placed with no parameters. The symptom is a stale
> `parentLayout`: a child copies its parent's layout into its props when *it* renders,
> `renderChildren` memoises the result, and the Group's Layout setter re-rendered only itself — so
> the change never reached the children. Full account and fix in
> [`NDA-016-LAYOUT-SIZEMODE.md`](NDA-016-LAYOUT-SIZEMODE.md) §0. Kept verbatim below because the
> reasoning is sound and still wrong, which is the useful part: every step of it checks out against
> the source, and the conclusion does not survive one reading of the running app.

Partially confirmed, with the mechanism identified and one gap.

[`layout.ts:60-67`](../../../packages/noodl-viewer-react/src/layout.ts#L60-L67) is the whole of size
resolution:

```ts
if (props.sizeMode === 'explicit')          { style.width = props.width; style.height = props.height; }
else if (props.sizeMode === 'contentHeight') { style.width = props.width; }
else if (props.sizeMode === 'contentWidth')  { style.height = props.height; }
// no else
```

**There is no `else`.** When `sizeMode` is unset, `style.width` is never assigned from `props.width`,
so it keeps whatever `defaultCss` gave it — for Text, `width: 'auto'`
([`text.ts:30-33`](../../../packages/noodl-viewer-react/src/nodes/visual/text.ts#L30-L33), carrying a
`// FIX:` comment). `flexShrink` is then set to `0` unconditionally at
[`layout.ts:69`](../../../packages/noodl-viewer-react/src/layout.ts#L69), and the percentage →
`flexGrow` conversion at [`layout.ts:71-75`](../../../packages/noodl-viewer-react/src/layout.ts#L71-L75)
is gated on `isPercentage(style.width)` — which `'auto'` is not. So an unset `sizeMode` yields a
non-shrinkable, non-growing item: the first one takes the row. Setting Size Mode explicitly and back
puts a real value on the port, the branch runs, `width` becomes `'100%'`, and both children get
`flexGrow` and share.

**The gap:** `sizeMode` is declared with `default: 'contentHeight'`
([`node-shared-port-definitions.ts:638-653`](../../../packages/noodl-viewer-react/src/node-shared-port-definitions.ts#L638-L653))
and defaults *are* copied into props at
[`react-component-node.ts:823-841`](../../../packages/noodl-viewer-react/src/react-component-node.ts#L823-L841),
so on this reading `props.sizeMode` should already be set and the symptom should not occur. Something
between those two — port registration order, a `dynamicports` interaction, or the editor writing the
parameter only on first edit — is dropping it. **This one needs the running editor to finish
diagnosing.** The missing `else` is a real defect regardless and should be closed either way; it is
the same undefined-versus-explicit confusion as defect class A2, in the layout engine.

## Repeater Item: only the first one gets the remove handshake

I could not reproduce "doesn't work at all" from source — the node is in the picker, not deprecated,
and both its signals are wired from the Repeater
([`foreach.tsx:454`](../../../packages/noodl-viewer-react/src/nodes/std-library/data/foreach.tsx#L454)
for `Added`, [`foreach.tsx:479`](../../../packages/noodl-viewer-react/src/nodes/std-library/data/foreach.tsx#L479)
for `Try Remove`). Two things are worth recording anyway:

1. **Asymmetric fan-out.** `Added` is signalled on *every* Repeater Item node in the template (a loop
   at line 454); `Try Remove` is sent only to `forEachActions[0]` (line 479). A template with two
   Repeater Item nodes gets one that never receives the remove handshake, and since `Try Remove` is a
   handshake the Repeater *waits* on, this is a plausible source of "it doesn't work".
2. **A mechanism was deleted from under it.** The node used to publish `itemAction-…` ports whose
   handler called a `signalItemAction` that no node ever defined — "dead *and* broken", removed under
   DEBT-006 ([`foreachactions.ts:86-89`](../../../packages/noodl-viewer-react/src/nodes/std-library/data/foreachactions.ts#L86-L89)).
   If the memory is of item actions rather than of the node itself, that is what it is.

---

## What these passes did *not* cover

- **142 of 155 nodes** have only their machine-derived smell row in `NODE-REGISTER.md`. No
  implementation has been read for them. The second pass is direct evidence that the structural sweep
  under-reports: five real defects in the first six nodes anyone looked at closely.
- ~~**Two findings are unfinished.**~~ **Both closed 2026-07-29 in the running editor, and both
  turned out to be aimed at the wrong file** — which is the strongest argument in this document for
  the "reproduce before speccing" rule. The Component Stack does not scroll (NDA-008 §0); the Text
  sizing default was never unset, and the real defect was a stale `parentLayout` (NDA-016 §0).
- No live verification of *any* finding. Everything here is read from source.
- Deprecated-node dispositions (23 nodes) have not been decided.
