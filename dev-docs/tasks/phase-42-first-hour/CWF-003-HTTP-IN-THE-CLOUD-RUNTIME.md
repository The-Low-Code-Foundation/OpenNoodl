# CWF-003 — Cloud functions can only make HTTP calls with the deprecated node

**From:** [TALK-001](TALK-001-THE-CLOUD-WORKFLOW-AUDIT.md) Pile 1.3.
**Status:** open, unowned. Small, independent, high ergonomic payoff.

## The mechanism, exactly

`registerNodes` in the **shared** runtime entry point registers `restnode` (the deprecated `REST2`)
and has the modern one commented out:

```
require('./src/nodes/std-library/data/restnode'),
// require('./src/nodes/std-library/data/httpnode'), // moved to viewer for debugging
```
([noodl-runtime.ts:174-175](../../../packages/noodl-runtime/noodl-runtime.ts#L174-L175))

The **browser** viewer re-registers it on its own
([noodl-viewer-react/src/register-nodes.js:64](../../../packages/noodl-viewer-react/src/register-nodes.js#L64)),
so the modern `HTTP Request` node exists in the frontend and nowhere else. The **cloud** viewer
registers only four nodes of its own
([noodl-viewer-cloud/src/nodes/index.ts](../../../packages/noodl-viewer-cloud/src/nodes/index.ts) —
`request`, `response`, `sendemail`, `aggregatenode`) and inherits everything else from the shared
list. Net effect: a cloud function's HTTP picker offers only the deprecated node.

**The fix is one line in the cloud viewer's list, not uncommenting the shared one.** Uncommenting
the shared line double-registers in the browser viewer, which already has its own require.

## What to check before calling it done

Two things the "one line" framing hides:

1. **`fetch` and `FormData`.** `httpnode` uses `fetch` ([httpnode.ts:697](../../../packages/noodl-runtime/src/nodes/std-library/data/httpnode.ts#L697))
   and `new FormData()` for multipart ([httpnode.ts:560](../../../packages/noodl-runtime/src/nodes/std-library/data/httpnode.ts#L560)).
   Node implementations run in the **host process**, not in the isolate, so both should come from
   Node's globals — but the isolate *also* defines a bridged `global.fetch`
   ([sandbox.isolate.js:101-125](../../../packages/noodl-viewer-cloud/src/sandbox.isolate.js#L101))
   and defines no `FormData`. Establish which `fetch` the node actually gets by driving a real
   request, and test a multipart body specifically — it is the one that will throw if the
   assumption is wrong.
2. **Editor-connection wiring.** The comment says "moved to viewer for debugging": `httpnode`
   installs graph-model listeners for its debug inspector
   ([httpnode.ts:1277-1281](../../../packages/noodl-runtime/src/nodes/std-library/data/httpnode.ts#L1277-L1281)).
   Confirm those are inert (or harmless) when there is no editor connection, which is the cloud
   case. That listener is the likely reason it was pulled out in the first place — find out rather
   than assume the removal was arbitrary.

## Done when

- A cloud function with an `HTTP Request` node performs a real GET and a real POST-with-JSON
  against a live endpoint, driven, with the response visible.
- Multipart either works or is explicitly documented as browser-only on that node's page.
- The deprecated `REST2` stays registered (existing projects use it) but is not what a new author
  reaches first.

## Traps

- ⚠️ **The cloud runtime ships as a prebuilt bundle.** A source change in `noodl-viewer-cloud` or
  `noodl-runtime` does not reach the running product until the bundle is rebuilt
  (`packages/noodl-viewer-cloud` → `npm run build`, and the copies under
  `noodl-editor/src/external/cloudruntime/`). A green typecheck proves nothing here; the
  deploy/runtime artifacts are gitignored and nothing rebuilds them automatically.
- The node library the editor shows for cloud functions **comes from connected clients**, not from
  a static list ([workflowNodeLibrary.ts:8-10](../../../packages/noodl-editor/src/editor/src/models/workflow/workflowNodeLibrary.ts#L8-L10)
  documents the same door for workflows). If the node does not appear in the picker, suspect the
  client connection before suspecting the registration.
