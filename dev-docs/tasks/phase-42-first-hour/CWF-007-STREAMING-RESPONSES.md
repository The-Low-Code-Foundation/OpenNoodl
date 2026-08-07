# CWF-007 — Streaming from the backend to the app (the LLM case)

**From:** [TALK-001](TALK-001-THE-CLOUD-WORKFLOW-AUDIT.md) **Q5, decided 2026-08-05**: design it
now, build it after the Pile 1 plumbing. This is the one genuinely *new* capability in the audit —
everything else in the track is a hole to fill.
**Status:** design doc, unowned, **not a build task yet**. Argue with it before anyone codes.
**All four questions are now answered** — see the block immediately below. What is left is the build,
scheduled after alpha.

## ✅ DECISIONS — 2026-08-06 (Richard). Do not relitigate these.

| Q | Decision |
|---|---|
| **Q1 — transport** | **Channel first.** The app fires a normal request, then subscribes to a named channel on the existing `GET /realtime` SSE hub. Chosen for the three properties the HTTP-response variant cannot have: it **survives a page reload**, it **works when no caller is waiting**, and it inherits auth, reconnection, connection counting and `closeWithGoodbye` shutdown rather than reinventing them. Layer 4 (a workflow publishing *"step 3 of 7"*) then falls out nearly free. **Accepted cost:** two round trips, and it is *not* what an LLM SDK looks like — so expect to want the HTTP-response variant eventually. It is not ruled out; it is not first, and adding it later must not produce two paths that differ silently. |
| **Q2 — who may read a channel** | **The authenticated session that started it.** Nobody else may subscribe, whatever channel id they know. Record-change subscriptions keep their existing posture; **only the new channel kind gets this rule.** The reasoning is FH-024's, one day old: *reachability is not access control*, and a transport whose reachability was mistaken for its access control is now this repo's most-repeated security defect. Explicitly **rejected: a capability URL** (the id is the secret) — that is the OBS-004 relay and the FH-024 admin API pattern, and shipping it would be the third instance of one class. |
| **Q3 — one node family with Subscribe To Changes?** | Answered 2026-08-05 — **separately, deliberately.** See below; unchanged. |
| **Q4 — when** | **After alpha.** Streaming stays a design doc; phase 41 (accessibility) keeps its place as the scheduled phase, on the ground that a runtime emitting one aria attribute and deleting every focus ring is a launch-quality problem in a way that a missing new capability is not. Streaming is the **first substantial post-alpha capability**. |

### ⚠️ Q1 and Q2 interact, and the build must resolve it rather than discover it

Q1 was chosen partly because a channel **works when no caller is waiting** — a scheduled workflow
publishing progress. Q2 binds read access to **the authenticated session that started it**. A
scheduled workflow has no session: it runs as system, on a trigger, with nobody signed in.

So the two answers do not compose for exactly the case Q1 named as a reason to prefer channels, and
**neither answer is wrong** — the gap is real and is recorded here rather than resolved by whoever
happens to write layer 1 first. Restated as the question the build owes:

> **Who may read a channel that no session created?**

Candidates, unranked and undecided: the channel is admin-only (the History Panel already shows runs
to an admin, so workflow progress may simply be an admin surface); or a workflow-published channel
declares a reader at publish time, which is Q2's rejected ACL re-entering by the back door for a case
where there is no session to bind to; or workflow progress is a *different* channel kind from a
function's user-facing stream, with the admin posture, and the two never mix.

⚠️ **Do not settle this by widening Q2.** The failure shape to avoid is a "system channels are public
because there's no session" branch, which is instance three of the class arriving through a case
nobody was looking at.

### What layer 2 still owes, now that Q1 is settled

The isolate finding below means user code *can* consume a streaming upstream API, so layer 2's hard
question is **what a node exposes**, not whether the engine allows it. And the isolate path stays
real for whatever deploys through it — a streaming node must **refuse there loudly**, or the two
paths differ silently.

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

## Questions for Richard — ALL ANSWERED 2026-08-06, see the decisions block at the top

Kept with their original wording, because the options that were rejected are part of the record.

1. ~~Channel-based (survives reload, works without a caller) or HTTP-response-based (what an LLM SDK
   looks like)? Or both, and in which order?~~ ✅ **Channel first.**
2. ~~Who may read a channel — the authenticated user who started it, an ACL, or anyone with the id?~~
   ✅ **The authenticated session that started it.** The capability-URL option was rejected by name.
3. ~~Does this ship with the Subscribe To Changes node as one family, or separately?~~
   ✅ **Answered 2026-08-05 ([TALK-005](TALK-005-BACKEND-BOUND-REALTIME.md)): separately, and
   deliberately.** Two nodes sharing `RealtimeSubscription` but not a node definition — a record
   change carries a row with a primary key, a channel carries an arbitrary chunk, and the auth
   postures differ (question 2 below is the live one for channels; record changes inherit the
   query routes' posture). Recorded as a decision so the pair is not later mistaken for a twin and
   collapsed. [FH-021](FH-021-SUBSCRIBE-TO-CHANGES.md) builds the record-change half now; nothing
   in it forecloses this doc's shape.
4. ~~Is streaming alpha-facing, or the first thing after alpha?~~ ✅ **After alpha**, confirmed
   2026-08-06 now that Pile 1 has landed and the shape is visible. Accessibility (phase 41) keeps
   its place ahead of it.

## Traps to carry into the build

- ⚠️ `server.close()` hangs while an SSE connection is open — already known and already handled by
  `closeWithGoodbye` ([HttpServer.ts:1149-1151](../../../packages/nodegx-backend/src/server/HttpServer.ts#L1149-L1151)).
  Any new long-lived stream must register with the same shutdown path or production ops regresses.
- ⚠️ A `wait`-style long-lived workflow already holds a process and a concurrency slot for its whole
  duration (WF-001 residual). A streaming step must not multiply that.
- ✅ ~~The isolate's bridged `fetch` is request/response shaped — check this early, because it decides
  whether layer 2 is even reachable from user code.~~ **CHECKED 2026-08-06. Layer 2 IS reachable, and
  the trap does not apply to the runtime we ship.**

  Both halves measured:

  1. **The trap is accurate about the isolate.** `global.fetch` at
     [sandbox.isolate.js:101-124](../../../packages/noodl-viewer-cloud/src/sandbox.isolate.js#L101)
     resolves **one** `res` whose `body` is a finished **string**; `.json()` is `JSON.parse(res.body)`
     and `.text()` is `Promise.resolve(res.body)`. There is no `ReadableStream`, no `getReader()`, no
     async iterator. Inside the isolate a streaming upstream API is fully buffered before user code
     sees a byte, so it genuinely cannot be consumed incrementally.
  2. **But the isolate is not the path.** `sandbox.isolate.js` is referenced by exactly three things —
     `webpack-configs/webpack.isolate.{dev,prod}.js` and the prebuilt `dist/main.js` — and
     **`nodegx-backend` contains zero references to `isolate`, `isolated-vm` or a vm sandbox.** Its
     `@cloud-runtime` alias resolves to
     [`noodl-viewer-cloud/src/index.ts`](../../../packages/noodl-viewer-cloud/src/index.ts)
     (`scripts/build.js:38`, `tsconfig.json:26`, `jest.config.js:16`), which references no sandbox and
     does not shadow `fetch`. So `WorkflowRunner`'s `CloudRunner` runs functions **in the host Node 22
     process with the real global `fetch`**, whose `Response.body` *is* a `ReadableStream`.

  This is the same finding [TALK-007](TALK-007-WHAT-CLOUD-FUNCTIONS-SHOULD-HAVE.md) reached from the
  other side — *a Function node is an unsandboxed Node 22 script*. **Consequence for this design:**
  layer 2's hard question is not "can user code consume a stream" (it can) but "what does a node
  expose", which is a vocabulary decision rather than an engine limit. ⚠️ **The isolate path is still
  real for whatever deploys through it** — if a streaming node ships, it must either refuse there
  loudly or the two paths will differ silently, which is the failure mode this repo keeps rediscovering.

- ⚠️ **Question 2 is the same question as [FH-024](FH-024-THE-LOCAL-ADMIN-API-IS-CROSS-ORIGIN-READABLE.md),
  and this would be the THIRD instance of the class.** This page already says *"do not ship the second
  one"* about OBS-004's relay. FH-024 was filed 2026-08-06 and is the second — a local admin API
  readable cross-origin by any web page, for the same reason both times: a transport whose reachability
  was mistaken for its access control. `GET /realtime` being `{ kind: 'public' }` is that shape
  pre-loaded. **Whatever FH-024's fix establishes about who may read a local endpoint, this channel
  inherits it** — decide question 2 against that fix rather than on its own.
