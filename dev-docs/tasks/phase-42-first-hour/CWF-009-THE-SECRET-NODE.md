# CWF-009 — A cloud function has secrets and no way to ask for one

**From:** [TALK-007](TALK-007-WHAT-CLOUD-FUNCTIONS-SHOULD-HAVE.md) §6 row 3, approved 2026-08-05.
**Status:** open, unowned. **Sequence this before [CWF-010](CWF-010-THE-CRYPTO-KIT.md) —** JWT,
payments and every third-party API are notional until there is a door to a credential.

## The two halves, and only one is missing

**Reading secrets already works, badly.** TALK-007 §3.1 measured a Function node inside a cloud
function reaching `process.env` in full — 79 keys. So the capability is not the gap. The gap is that
the only way to use it is to type `process.env.STRIPE_KEY` into a script and hope the deploy set it.

**The proper store already exists, and nothing in the runtime can see it.**
[SecretsStore](../../../packages/nodegx-backend/src/config/SecretsStore.ts) is the one convention
(WF-005): `<dataDir>/secrets.json`, mode 0600, **namespaced by subsystem**, whole-file
read-modify-write so independent writers never clobber each other. `webhooks`, `email` and auth
already own namespaces; `security` owns `adminToken`. It is deliberately **not** part of the
diffable config that deploys with the backend — it is machine-local credential material.

Nothing binds it to the cloud runtime. A cloud function cannot read it at all.

## The design questions, which are the actual work

1. **Which namespace do user secrets live in?** The convention says one top-level key per subsystem
   and never write another's. `functions` or `project` is the obvious new one — but decide it here
   and write it into `SecretsStore`'s doc comment, because that comment is what the next subsystem
   reads.
2. **May a function read any secret, or only its own namespace?** Today the trust model is flat: the
   author of a function is the person who deploys the backend. That changes the day an **agent**
   writes a function (TALK-007 §3.1 consequence 3). Recommend: a function reads only the user
   namespace, never `webhooks`/`email`/`adminToken` — and the node cannot express those names.
3. **How does a secret get *in*?** An editor UI (a Secrets section in the Cloud Functions panel or
   backend settings), the admin API, or the deploy target provisioning `secrets.json`. All three
   eventually; pick the first one and say so.
4. **What does the editor show?** Names, never values. A secrets panel that can read back a value is
   a secrets panel that has to be permissioned.

## Slices

### Slice 1 — the namespace decision, written down

One paragraph in `SecretsStore.ts`'s module comment and one in
[BACKEND-AUTHORING-MODEL](../../reference/BACKEND-AUTHORING-MODEL.md). No code. Do not skip: the
convention composes *because* it is documented in one place.

### Slice 2 — the runtime binding

The cloud runtime runs **in the backend's own process** (TALK-007 §3.1), so this is a direct call,
not a protocol: expose a resolver the way `_noodl_send_email` is exposed for the Send Email node
([service.ts:53](../../../packages/nodegx-backend/src/service.ts#L53) and its comment at 380-382 —
that node runs inside this same process via `WorkflowRunner`'s `CloudRunner`). Copy that seam
exactly; it is the precedent for "a cloud node reaching a backend subsystem".

### Slice 3 — the Secret node

- One input: the secret's **name** (an enum if the editor knows the names, a string if not).
- One output: the value.
- Failure output + a runtime error when the name does not resolve, per the
  [Failure Contract](../../reference/FAILURE-CONTRACT.md). A missing credential must be loud —
  silently emitting `undefined` turns into a 401 from someone else's API an hour later.
- ⚠️ **It must not appear in the browser runtime.** This is the first node deliberately built
  cloud-only; register it in `noodl-viewer-cloud/src/nodes/index.ts` alongside Request/Response,
  *not* in the shared list. A Secret node in a browser bundle is a secret in a browser bundle.

### Slice 4 — getting one in

Minimum: the admin API path plus a documented `secrets.json` shape. Editor UI can follow, but say
in the task which one shipped so nobody assumes the other exists.

## Done when

- A cloud function reads a secret by name through the node, uses it in an HTTP call, and **the value
  appears in no export, no log line and no error message** — grep the execution history and the ops
  log for it as part of the test, not by eye.
- An unknown name fails loudly with a diagnosable message.
- The node is absent from the browser node library (`catalog:check` will record `availableIn:
  ["cloud"]` — the first node with that value; if it says `browser` you registered it in the wrong
  list).

## Traps

- ⚠️ **Redaction already exists** ([ops/redact.ts](../../../packages/nodegx-backend/src/ops/redact.ts))
  and the execution history has a scrubber (`noodl-viewer-cloud/src/execution-history/scrub.ts`).
  Find out what they already redact before adding a third mechanism.
- ⚠️ `secrets.json` is **machine-local and not deployed**. A function that works locally and fails
  in production because nobody provisioned the secret is the expected failure — make the error say
  so, in those words.
- ⚠️ Whole-file read-modify-write is the convention *because* subsystems write concurrently. A
  writer that reads a namespace and writes only it will destroy `adminToken`.
