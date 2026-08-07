# CWF-008 — A cloud function cannot build a list

**From:** [TALK-007](TALK-007-WHAT-CLOUD-FUNCTIONS-SHOULD-HAVE.md) Pile A, validated by Richard
2026-08-05 (§6b).
**Status:** ✅ **slices 1, 2, 3, 4b and 5 shipped 2026-08-06.** Cloud picker **48 → 62 node types**;
browser vocabulary byte-identical bar the two fields that record where a node lives. Slice 4 (the
Cloud Function node) is **deferred** — see the slice. Driven, not inferred:
[`cloud-array-vocabulary.test.ts`](../../../packages/nodegx-backend/tests/cloud-array-vocabulary.test.ts).

## Why this one first

Everything else in phase 42 assumes "workflows orchestrate, cloud functions compute"
([BACKEND-AUTHORING-MODEL](../../reference/BACKEND-AUTHORING-MODEL.md)). A function that cannot
build, filter or reshape a list cannot hold up that half of the bargain. It can *iterate* (Run
Tasks) and it can *query* (11 record nodes) — it just cannot produce the thing it iterates over.

## The mechanism, exactly

`@noodl/runtime`'s `registerNodes` is the list every runtime gets; `noodl-viewer-react` registers
extra nodes **on top** and never subtracts ([noodl-runtime.ts:166-275](../../../packages/noodl-runtime/noodl-runtime.ts#L166-L275)).
So "browser-only" is, for most of these, an accident of which file the `require` sits in — not a
dependency. Verified on every node below: they import `@noodl/runtime` and `@noodl/types` and
nothing else. No React, no DOM.

Since TALK-007 Pile B there is also a `type !== 'cloud'` block at the foot of that function — the
subtraction that did not exist. A node moved into the shared list and *not* added to that block
reaches both runtimes; the browser keeps everything it has today.

## Slices

### Slice 1 — arrays (the actual gap)

| Node | Type name | Today |
|---|---|---|
| Array | `Collection2` | viewer |
| Create New Array | `CollectionNew` | viewer |
| Insert Object Into Array | `CollectionInsert` | viewer |
| Remove Object From Array | `CollectionRemove` | viewer |
| Clear Array | `CollectionClear` | viewer |
| Array Filter | `Filter Collection` | viewer |
| Array Map | `Map Collection` | viewer |
| Static Array | `Static Data` | viewer |

⚠️ **`Collection` patches `Array.prototype` and that is load-bearing** (PLAT-003). These nodes all
import `@noodl/runtime/src/collection`, which the cloud runtime already loads — but nothing has
exercised the collection path server-side before. Drive a real function that builds, filters and
maps a list end to end; do not conclude from registration.

⚠️ **Static Array parses CSV inline** as well as JSON. That overlaps [CWF-012](CWF-012-CSV.md) —
check what its parser does before writing a second one.

✅ **Shipped 2026-08-06.** All eight moved to `@noodl/runtime/src/nodes/std-library/data/` (plus
their shared helper `collection-failure.ts`); the viewer's `require`s are commented out the way
every earlier move commented its own. Driven through `POST /functions/shapeList`: a JSON array in
the request body → `Array` → `Array Filter` → `Array Map` → the response, with no code node in the
graph. The conversion from plain JSON to records happens in `Array.prototype.set`, which runs
`Model.create(item)` for anything that is not already a record (`collection.ts:502`) — that is what
makes an `Items` wire from the Request node work at all, and it is worth knowing before designing
around it.

⚠️ **Two `default`s in this family are inert, and it bites the moment you author a graph by hand.**
`initializeDefaultValues` fills `_inputValues` and nothing ever pushes those through the setters
(`nodedefinition.ts:481`) — the repo's most-repeated trap. So `Array Filter`'s `enabled: true`
leaves `_internal.enabled` undefined and the node passes **everything** through unfiltered, and
`Array Map`'s `mapScript` default never compiles, so the node reports `array-map/script-failed`
with "unknown error". Both are pre-existing and affect the browser identically; both are worked
around in the driven spec by carrying the values as *parameters*, which is what the editor writes
once an author touches the field. **Filed, not fixed** — the fix is a `props.x ?? fallback` read in
each node body, and it changes browser behaviour, so it wants its own task.

> ✅ **Corrected and closed 2026-08-06 — `9446e6fc`, see [README § Filed, not fixed](README.md#filed-not-fixed).**
> The mechanism above is exactly right and **one of the two nodes was not affected by it**. Both
> `default`s are inert; only Array Map had no other way of establishing the state. **Array Filter's
> `initialize` sets `this._internal.enabled = true` itself** (`filtercollectionnode.ts:168`), so a
> hand-authored filter has always filtered — measured, 3 records in and 1 out with no `enabled`
> parameter anywhere. That line now carries a comment saying it is load-bearing, and a spec asserts
> it, because deleting it as "redundant beside the `default`" would create the defect this
> paragraph describes. **Array Map was real**, and is fixed by compiling the declared default in
> `initialize` — Array Filter's own answer — rather than by a `?? fallback` at the read site.

⚠️ **A *named* array is process-wide, in the cloud too.** `Model` has a `Scope` and `CloudRunner`
mints one per request; `Collection` has **no `Scope` at all**, so `Collection.get('cart')` reads one
module-level table for the life of the server process. Two concurrent requests that both name an
array share it, and it outlives the response. The anonymous tier — which is what `Create New
Array`, `Array Filter`, `Array Map` and `Static Array` all build — is unaffected. **Deferred, not
overlooked:** scoping only these nodes would split the registry against `cloudstore` and
`javascriptnodeparser`'s `Noodl.Arrays`, so a Function node and an Array node naming the same array
would get two different ones. The full note is on `collectionnode2.ts`'s `setCollectionID`.

### Slice 2 — scratch state

| Node | Type name | Note |
|---|---|---|
| Variable | `Variable2` | reads a named variable |
| Set Variable | `Set Variable` | writes one |
| Component Object | `net.noodl.ComponentObject` | per-**instance** shared state, no wires |
| Set Component Object Properties | `net.noodl.SetComponentObjectProperties` | |

**Component Object is the interesting one and Richard asked for it by implication** ("the object
nodes"). A cloud function is created per request and torn down on send
([index.ts:81-94](../../../packages/noodl-viewer-cloud/src/index.ts#L81-L94)), so a component
object *is* per-request state — exactly right, and safer than a Variable whose scope in the cloud
runtime is the thing to establish in this slice. **Establish it:** two concurrent requests to the
same function must not see each other's values. That is the test that matters, and it is the one
that would have caught Global Store had anyone written it.

✅ **Shipped 2026-08-06 — and the doc's own premise about *why* it was safe was wrong.**

Neither node was per-request. Both reached for the **bare module-level `Model`**, not
`nodeScope.modelScope`, so `CloudRunner.run`'s per-request `Model.Scope` (and its `reset()` on
send) never applied to them. What that meant in practice:

- **Variable was a real cross-request leak.** `--ndl--global-variables` is one record for the whole
  process, so two concurrent requests writing the same variable name overwrite each other, and the
  value survives the response for the life of the server. The driven spec fails on the unfixed code
  — verified by reverting the fix and watching it go red — which is the only reason it is worth
  keeping.
- **Component Object escaped by accident, not by design.** Its key is
  `componentState<instance id>` and the top-level instance id is `<requestId>-<functionName>`, so
  two requests happened not to collide. But the record was never dropped, so every request left one
  behind in a table nothing clears.
- **A third, quieter consequence:** `createNoodlContext` has always read `Variables` off the
  *scoped* registry (`expression-evaluator.ts:128`), and `javascriptnodeparser`'s
  `getComponentScopeForNode` has always used `(nodeScope.modelScope || Model)` for the component
  record. Moving these two nodes in unscoped would have shipped a runtime where an Expression
  reading `Variables.x` and a `Set Variable` writing `x` resolve to two different records — the
  Expression seeing `undefined`, forever, with nothing to diagnose from.

All four sites (`variablenode2`, `setvariablenode`, `componentobject`, `componentutils/base`) now
read `(this.nodeScope.modelScope || Model)`, which is the idiom every other data node in the
runtime already used. **The browser is unaffected**: `modelScope` is undefined all the way up the
scope chain there (`componentinstance.ts:86`), so the expression is the global registry exactly as
before. The array mutators' record lookups (`Model.get`/`Model.exists`/`Model.create` in Insert,
Remove and Array Map) were brought onto the same scope for the same reason.

Parent Component Object / Set Parent Component Object Properties: **not** in this slice. A function
graph rarely nests, and "parent" has no meaning at the top of one. Add later if a real case appears.

### Slice 3 — logic

| Node | Type name | Note |
|---|---|---|
| Switch | `Switch` | multi-way; the cloud has only two-way Condition |
| Number Remapper | `Number Remapper` | range maths |

**Struck by Richard:** Value Changed. A cloud function is one pass; a node that fires when a value
differs from last time has no "last time" worth having.

✅ **Shipped 2026-08-06.** Both moved; neither imports anything but `@noodl/types` and the outcome
helper. Value Changed stays in the viewer, as struck.

### Slice 4 — the Cloud Function node, and a question ⏸ DEFERRED

⏸ **Not attempted 2026-08-06, deliberately.** Items 2 and 3 below are a *decision* (what identity a
server-to-server call carries, and whether the node is a transport node or a call node), and both
answers bind the workflow join as well. Building the node first would answer them by accident,
which is precisely what item 2 warns against. It needs Richard, not a session.

Richard: *"add cloud function (a function calling another function could be useful)"*. Agreed on the
use, but **this is not a move**:

1. `cloudfunction2.ts` calls `new XMLHttpRequest()` ([line 33](../../../packages/noodl-viewer-react/src/nodes/std-library/data/cloudfunction2.ts#L33)).
   The cloud runtime has no `window`. It needs the same branch `restnode` carries
   ([restnode.ts:309-313](../../../packages/noodl-runtime/src/nodes/std-library/data/restnode.ts#L309-L313)) —
   and TALK-007 §3.2 measured that Node's `fetch` is right there.
2. It sends `X-Parse-Session-Token` from the browser session store ([line 69](../../../packages/noodl-viewer-react/src/nodes/std-library/data/cloudfunction2.ts#L69)).
   **Server-side there is no session store.** So: does a function calling a function run as the
   original caller (forward the incoming token — the Request node already resolved it), as nobody,
   or as the system? This is the same hole as the workflow join, where a step invokes a function
   with **no session token** and any function without `Allow Unauthenticated` fails. Answer it once,
   here and there, or it will be answered twice differently.
3. Consider calling **in-process** rather than over HTTP. `WorkflowRunner` already resolves and runs
   a function by name; a loopback HTTP call from a server to itself pays a socket and re-does auth
   for no benefit. This is a design choice, not a detail — it decides whether the node is a
   transport node or a call node.

### Slice 4b — ✅ ANSWERED: the loop already works, and needs no code

Richard, 2026-08-05: *"Yeah it is a For Each, call it whatever TF you want, I just meant we need a
way to loop over array items to apply a function to each item (like a list of new users comes in and
you want to register each one, one by one, looping them through a signup function)."*

**Driven, and it works today.** A cloud function taking `{users: [...]}` → Run Tasks over the array
→ a cloud **helper component** per item → each item's own data reaching an upstream call → the
function answering once the run is Done. Kept as a spec:
[`cloud-run-tasks-loop.test.ts`](../../../packages/nodegx-backend/tests/cloud-run-tasks-loop.test.ts).
Concurrency honoured, empty list handled.

So there is **nothing to build for the loop**. What is missing from Richard's exact example is only
the *signup node* ([CWF-015](CWF-015-SERVER-SIDE-USERS.md)) and, if the list needs shaping first,
slice 1 of this task.

**What remains is naming and legibility, which is real:**

- The node is called **Run Tasks**. Nobody hunting for a loop searches for that. ⚠️ **The doc's
  premise was wrong: it carried no `searchTags` at all** — the field was absent, not thin.
  ✅ **Shipped 2026-08-06:** `for each`, `foreach`, `loop`, `iterate`, `each`, `map`, `batch`,
  `queue`, `concurrency`. This is the only entry in the whole task that changes what the *browser*
  picker does, and it changes only what finds the node, not what it is.
- The per-item unit is a **cloud helper component**, and nothing on the canvas says so. The picker
  refusing cloud functions is correct — a function is an HTTP-addressable endpoint with a
  Request/Response contract, not a subroutine with a `Do`/`Success` contract — but the refusal is
  silent. A "create a template component for this" gesture on the Template port is the same shape as
  [CWF-004](CWF-004-THE-TRANSFORM-STEP.md)'s "new function from this step".
- ⚠️ The template contract is four **string** port names (`Do`/`Success`/`Failure`/`Error`), matched
  by string. A template that does not satisfy it fails at run time, not authoring time — and see
  [CWF-018](CWF-018-A-FUNCTION-THAT-NEVER-ANSWERS.md) for what that failure did to the request.

**Still open:** whether the Cloud Function node (slice 4) can also be a Run Tasks template once it
exists in the cloud — that would give "call this *function* per item" without changing the picker
rule, because the template would be a component wrapping a function call. Decide after slice 4.

### Slice 5 — the snapshot and the bundle

- `npm run cloud-library:generate`, commit, and confirm `cloud-library:check` is green.
- `npm run catalog:generate` + `catalog:merge` — the nodes' `availableIn` gains `"cloud"`.
- ⚠️ **The cloud runtime ships as a prebuilt bundle.** Nothing reaches the product until
  `noodl-viewer-cloud` is rebuilt and the copies under `noodl-editor/src/external/cloudruntime/`
  are refreshed. A green typecheck proves nothing here.

✅ **Snapshots regenerated and committed 2026-08-06.** Cloud library **48 → 62**; the 14 additions
are exactly the moved types and nothing else, and `typecasts`/`dynamicports`/`colors`/`nodeIndex`
are byte-identical. The catalog stays at 153 node types: the only per-node changes across the whole
file are `availableIn` (`["browser"]` → `["browser","cloud"]`) and `providedBy`
(`noodl-viewer-react` → `noodl-runtime`) on those 14, plus Run Tasks' new `searchTags`. Every port,
type, description and dynamic-port rule is unchanged — which is the "browser vocabulary unchanged"
criterion, measured rather than asserted.

⚠️ **The bundle is still stale.** `noodl-viewer-cloud`'s prebuilt bundle and the copies under
`noodl-editor/src/external/cloudruntime/` were **not** rebuilt in this session (they are gitignored
and nothing rebuilds them automatically). The editor's *picker* is driven by the committed
`cloud-node-library.json` and is therefore correct now; a function actually *running* these nodes
in the packaged product needs that rebuild.

## Done when

- ✅ A cloud function, **driven** against a real backend, receives a JSON array in its request,
  filters and maps it with nodes, and returns the result — no Function node involved.
- ✅ Two concurrent requests to a function using Component Object and Variable do not see each
  other's state (slice 2's real criterion). Both halves of this spec were confirmed to go **red**
  against the unscoped code before the fix landed.
- ✅ The browser vocabulary is **unchanged**: same node count, same behaviour. Diffed — see slice 5.
- ✅ `cloud-library:check`, `catalog:check`, `catalog:merge:check` green and committed.
- ⏸ Not live-QA'd in the editor: the picker is driven by the committed snapshot, which is green,
  but nobody has opened a cloud-function canvas and placed an Array node.

## Traps

- ⚠️ **A registered node is not a working node.** TALK-007's whole finding was nine nodes registered
  in the cloud for months that nobody had ever run there. Drive every node in this task; a green
  snapshot is a claim about registration, not behaviour.
- ⚠️ ~~**`Filter Array` and `Map Array` run a per-item expression/script.**~~ **Half wrong, checked
  2026-08-06.** Only **Array Map** compiles anything: `new Function('map', 'object', script)`
  (`mapcollectionnode.ts:113`), which is fine server-side for the reason TALK-007 §3.1 gives.
  **Array Filter compiles nothing** — it applies a *declarative* filter object built from its
  `filterFilter*` parameters through `applyFilter` (`$eq`, `$gt`, …, plus a `RegExp` for the
  `regex` operator). There is no eval on that path and never was.
- ⚠️ The picker groups by the hardcoded `nodeIndex` in `nodelibraryexport.ts`. A node whose category
  is not in that index registers fine and **appears nowhere**. Check the picker, not the JSON.
  ✅ Checked: all 14 moved types were already in that index (Array subcategory, Read & Write Data,
  Component Utilities, Logic, General Utils), and the index is emitted whole for both runtimes — so
  the additions land in the picker without touching it.
