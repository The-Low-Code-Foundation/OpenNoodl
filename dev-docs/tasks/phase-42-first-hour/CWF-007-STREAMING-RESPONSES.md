# CWF-007 — Streaming from the backend to the app (the LLM case)

**From:** [TALK-001](TALK-001-THE-CLOUD-WORKFLOW-AUDIT.md) **Q5, decided 2026-08-05**: design it
now, build it after the Pile 1 plumbing. This is the one genuinely *new* capability in the audit —
everything else in the track is a hole to fill.
**Status:** design doc, unowned, **not a build task yet**. Argue with it before anyone codes.

## Why it is impossible today, at all three layers

1. **The function answers exactly once.** The cloud `Response` node
   ([noodl-viewer-cloud/src/nodes/cloud/response](../../../packages/noodl-viewer-cloud/src/nodes/cloud/))
   completes the request. There is no "send a chunk and stay open".
2. **The workflow engine has no streaming.** A run produces `output` at the end
   ([WorkflowEngine.ts:632](../../../packages/nodegx-backend/src/workflow/WorkflowEngine.ts#L632));
   [CWF-002](CWF-002-THE-WORKFLOW-RETURN.md) makes that reach the caller, once.
3. **The realtime hub is DB-subscriptions only.** `GET /realtime` is a real SSE stream with a
   subscription registry ([HttpServer.ts:427-432, 1726-1740](../../../packages/nodegx-backend/src/server/HttpServer.ts#L1726-L1740),
   `RealtimeHub`), but what you can subscribe *to* is record change — there is no channel a
   function can publish arbitrary events on.

The transport already exists and is production-shaped (connection counting, goodbye-on-shutdown,
a metrics gauge). What is missing is a **publish side** and a **node vocabulary**.

## The shape to argue about

**Layer 1 — a publishable channel.** Extend `RealtimeHub` with named channels a cloud function may
publish to, and a subscription kind beside the db-change one. Everything about auth, reconnection
and shutdown is inherited rather than reinvented. ⚠️ The access posture is the first question, not
the last: `GET /realtime` is `{ kind: 'public' }`
([HttpServer.ts:427](../../../packages/nodegx-backend/src/server/HttpServer.ts#L427)) — a channel
carrying an LLM's output to one user must not be readable by every page that knows the URL. This
repo has already shipped a relay that was readable by any web page; do not ship the second one.

**Layer 2 — the function side.** A `Stream Response` node (or a `chunk` input on `Response`): emit
now, keep the request open, complete explicitly. Decide whether the stream rides the *HTTP response*
(true chunked/SSE reply to the caller's request) or the *realtime channel* (the caller fires a
normal request, then subscribes). My lean: the **channel**, because it survives a page reload, works
for a workflow with no caller waiting, and reuses everything above. The HTTP-response variant is
what people expect from an LLM API, so expect to want both eventually — pick one and say why.

**Layer 3 — the client vocabulary.** A frontend node that subscribes and emits per-chunk outputs.
This is the same node shape as [TALK-005](TALK-005-BACKEND-BOUND-REALTIME.md)'s **Subscribe To
Changes** — one node family, two subscription kinds. Designing them separately manufactures a twin;
this doc and TALK-005 should be answered together.

**Layer 4 — workflows.** A workflow step that publishes progress ("step 3 of 7") on the run's
channel. Cheap once layer 1 exists, and it is what makes long workflows watchable.

## Questions for Richard

1. Channel-based (survives reload, works without a caller) or HTTP-response-based (what an LLM SDK
   looks like)? Or both, and in which order?
2. Who may read a channel — the authenticated user who started it, an ACL, or anyone with the id?
3. Does this ship with the Subscribe To Changes node as one family, or separately?
4. Is streaming alpha-facing, or the first thing after alpha? (Decided: after Pile 1 — confirm that
   still holds once you see the shape.)

## Traps to carry into the build

- ⚠️ `server.close()` hangs while an SSE connection is open — already known and already handled by
  `closeWithGoodbye` ([HttpServer.ts:1149-1151](../../../packages/nodegx-backend/src/server/HttpServer.ts#L1149-L1151)).
  Any new long-lived stream must register with the same shutdown path or production ops regresses.
- ⚠️ A `wait`-style long-lived workflow already holds a process and a concurrency slot for its whole
  duration (WF-001 residual). A streaming step must not multiply that.
- The isolate's bridged `fetch` ([sandbox.isolate.js:101](../../../packages/noodl-viewer-cloud/src/sandbox.isolate.js#L101))
  is request/response shaped. A function that calls a *streaming* upstream API (the actual LLM) may
  not be able to consume it inside the sandbox at all — check this early, because it decides whether
  layer 2 is even reachable from user code.
