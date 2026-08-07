# CWF-003 — Cloud functions can only make HTTP calls with the deprecated node

**From:** [TALK-001](TALK-001-THE-CLOUD-WORKFLOW-AUDIT.md) Pile 1.3.
**Status:** ✅ **shipped 2026-08-06.** One registration line in the cloud viewer's list; cloud
picker **62 → 63** node types. Driven — a real GET, a real POST-with-JSON and a real multipart POST
from inside a cloud function, each verified at the upstream:
[`cloud-http-node.test.ts`](../../../packages/nodegx-backend/tests/cloud-http-node.test.ts).

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

1. ~~**`fetch` and `FormData`.**~~ **ANSWERED, 2026-08-05** — [TALK-007 §3.2](TALK-007-WHAT-CLOUD-FUNCTIONS-SHOULD-HAVE.md).
   The isolate is not in the picture: `sandbox.isolate.js` is **Parse-era dead code** referenced by
   nothing, and the CloudRunner runs in the backend's own Node process
   ([WorkflowRunner.ts:34](../../../packages/nodegx-backend/src/workflow/WorkflowRunner.ts#L34)). So
   the node gets **Node 22's own globals**. Measured inside a real cloud function, through
   `POST /functions/:name`: `fetch`, `FormData`, `Blob`, `File`, `Headers`, `Request`, `Response`,
   `ReadableStream`, `btoa` are all `function`; `new FormData()` round-tripped a field and
   `new Blob(['hi']).text()` returned `"hi"`. **`httpnode`'s multipart path has what it needs** —
   drive it once to confirm the node, but the global it depends on is no longer in doubt.
   (Also measured: a `REST2` node in a cloud function made a real `GET` against a live upstream. The
   deprecated node's server branch works, which is the cheap fallback if item 2 below bites.)
2. ~~**Editor-connection wiring.**~~ **ANSWERED, 2026-08-06 — and the guess in the last sentence
   was wrong.** `httpnode`'s `setup()` does install graph-model listeners for its debug inspector,
   but it early-returns unless `context.editorConnection.isRunningLocally()`
   ([httpnode.ts:1249-1252](../../../packages/noodl-runtime/src/nodes/std-library/data/httpnode.ts#L1249-L1252)),
   and the cloud runtime only sets `isRunningLocally` when it was asked to connect to an editor,
   which `nodegx-backend` never does. That guard is not special to this node: `restnode`,
   `filtercollectionnode`, `setvariablenode` and half a dozen others carry the identical two lines
   and have been in the cloud registry for months. **So the listener was never the reason it was
   pulled out** — "moved to viewer for debugging" meant what it says, a shorter rebuild loop.

3. **One thing neither check mentioned, and it matters more than either.** `httpnode` calls
   `fetch(url, …)` **unconditionally** ([httpnode.ts:697](../../../packages/noodl-runtime/src/nodes/std-library/data/httpnode.ts#L697)).
   There is no `XMLHttpRequest` branch, so it needs none of the `typeof window` work
   [CWF-008](CWF-008-THE-CLOUD-VOCABULARY.md) slice 4 has to do for `cloudfunction2.ts`. That is
   the whole reason this task is a one-liner and that one is not.

## Done when

- ✅ A cloud function with an `HTTP Request` node performs a real GET and a real POST-with-JSON
  against a live endpoint, driven, with the response visible. Both assert on the **upstream's**
  record of the call as well as the response body — TALK-007's REST probe answered 200 while its
  body was empty, so a green response proves nothing on its own.
- ✅ Multipart works. Driven: Body Type `form` produces a real `multipart/form-data` request with
  the boundary `fetch` chose, and the field arrives. Nothing to document as browser-only.
- ✅ The deprecated `REST2` stays registered and untouched. Note the framing was understated: it
  carries `deprecated: true`, so the picker never offered it (TALK-007 §1 measured 58 registered,
  57 offered). Before this change a cloud author could reach **no** HTTP node at all from the
  picker — not "the wrong one first".
- ⏸ Not live-QA'd in the editor. The picker reads the committed `cloud-node-library.json`, which
  now carries `net.noodl.HTTP`, but nobody has opened a cloud-function canvas and placed one.

## Traps

- ⚠️ **The cloud runtime ships as a prebuilt bundle.** A source change in `noodl-viewer-cloud` or
  `noodl-runtime` does not reach the running product until the bundle is rebuilt
  (`packages/noodl-viewer-cloud` → `npm run build`, and the copies under
  `noodl-editor/src/external/cloudruntime/`). A green typecheck proves nothing here; the
  deploy/runtime artifacts are gitignored and nothing rebuilds them automatically.
  ⏸ **Still outstanding after this change** — the bundle was not rebuilt in the session that
  shipped it. The backend's *tests* consume `noodl-viewer-cloud/src` directly (jest
  `moduleNameMapper`), and so does its esbuild step, so the driven evidence is real; what is stale
  is the checked-in editor copy.
- ⚠️ **An unregistered node type does not error — it hangs.** Removing the registration line does
  not turn the specs red in the usual way; the request never reaches a Response node and
  `POST /functions/:name` has no timeout, so all three specs sit for their full 40 seconds. Recorded
  because it is the same shape as [CWF-018](CWF-018-A-FUNCTION-THAT-NEVER-ANSWERS.md) and it is how
  "this node is not in the cloud" presents from outside.
- The node library the editor shows for cloud functions **comes from connected clients**, not from
  a static list ([workflowNodeLibrary.ts:8-10](../../../packages/noodl-editor/src/editor/src/models/workflow/workflowNodeLibrary.ts#L8-L10)
  documents the same door for workflows). If the node does not appear in the picker, suspect the
  client connection before suspecting the registration.
