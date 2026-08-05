# CWF-008 — A cloud function cannot build a list

**From:** [TALK-007](TALK-007-WHAT-CLOUD-FUNCTIONS-SHOULD-HAVE.md) Pile A, validated by Richard
2026-08-05 (§6b).
**Status:** open, unowned. **The highest-value task on the track** — it is the only one that removes
a *cannot* rather than adding a convenience.

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

Parent Component Object / Set Parent Component Object Properties: **not** in this slice. A function
graph rarely nests, and "parent" has no meaning at the top of one. Add later if a real case appears.

### Slice 3 — logic

| Node | Type name | Note |
|---|---|---|
| Switch | `Switch` | multi-way; the cloud has only two-way Condition |
| Number Remapper | `Number Remapper` | range maths |

**Struck by Richard:** Value Changed. A cloud function is one pass; a node that fires when a value
differs from last time has no "last time" worth having.

### Slice 4 — the Cloud Function node, and a question

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

- The node is called **Run Tasks**. Nobody hunting for a loop searches for that. It already carries
  `searchTags`; "for each", "loop", "iterate", "map" belong in them. Cheap, and it is most of the
  problem.
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

## Done when

- A cloud function, **driven** against a real backend, receives a JSON array in its request, filters
  and maps it with nodes, and returns the result — no Function node involved.
- Two concurrent requests to a function using Component Object and Variable do not see each other's
  state (slice 2's real criterion).
- The browser vocabulary is **unchanged**: same node count, same behaviour. Diff the browser node
  library before/after; a move that changes the browser is a bug, not a move.
- `cloud-library:check`, `catalog:check`, `catalog:merge:check` green and committed.

## Traps

- ⚠️ **A registered node is not a working node.** TALK-007's whole finding was nine nodes registered
  in the cloud for months that nobody had ever run there. Drive every node in this task; a green
  snapshot is a claim about registration, not behaviour.
- ⚠️ **`Filter Array` and `Map Array` run a per-item expression/script.** Check what they compile
  with and whether it matches the cloud story — `new Function` in a request-scoped node is fine
  (TALK-007 §3.1), but confirm rather than assume.
- ⚠️ The picker groups by the hardcoded `nodeIndex` in `nodelibraryexport.ts`. A node whose category
  is not in that index registers fine and **appears nowhere**. Check the picker, not the JSON.
