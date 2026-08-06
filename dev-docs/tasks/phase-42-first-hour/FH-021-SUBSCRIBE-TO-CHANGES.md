# FH-021 — A standalone Subscribe To Changes node

**Status:** ✅ **shipped 2026-08-06** — slices 1–6 built, slice 7 items 1 and 2 covered in-process.
`SubscribeToChanges` is registered browser-only, in the Cloud Data section of the picker, with a
`node:` capability row and a full enrichment entry plus a validated example. Two things this doc
got wrong, both load-bearing, are recorded below.

**⚠️ The doc's slice 3 is wrong about the filter's shape, and the shipped layer was wrong with
it.** `RealtimeSubscribeOptions.where` was typed as the **neutral** `Filter`, and the only wire
that reads it — `NODEGX_SSE` — hands it straight to our backend, which evaluates a subscription
filter in the **Parse-style `$` grammar** (`nodegx-backend/src/realtime/filter.ts`, `matchOperator`
throws on anything else and `RealtimeHub` then fails **closed**). A neutral filter therefore
produces a subscription that connects, confirms, reports `Subscribed`, and delivers nothing at all,
silently. The existing transport row asserted `{title: {equalTo: 'x'}}` reaching the wire and was
green either way — a pass-through assertion cannot see the difference. Closed here: the contract
now declares `RealtimeFilter` (the backend's own dialect), the type is threaded through
`RealtimeSubscription` and `SseDialect.subscribeRequest`, the fixture was corrected, and the node
sends `QueryUtils.convertVisualFilter`'s Parse document.

**⚠️ Slice 1's `browserOnlyNodes` coordination note is stale.** No such identifier exists. What
landed is an inline `if (noodlRuntime.type !== 'cloud')` register block at the foot of
`registerNodes` — an *additive* browser-only list, not a subtraction — so the node is registered
there **only**, not in the shared list as well. Absence from the cloud picker was checked, not
inferred: `cloud-node-library.json` has 63 `nodetypes` and `SubscribeToChanges` is not one of them
(it appears in the shared `nodeIndex`, which `createnodeindex.ts` filters by resolvable type —
exactly as the nine AIX-005 nodes do).

**Also fixed in passing, because they taught the opposite of what shipped:** the `DbCollection2`
enrichment documented a port called `realtimeEnabled` (the port is `realtime`) and claimed realtime
is "gated by the backend's descriptor — a backend that cannot do realtime does not offer it", which
is the reverse of the shipped decision; and `cloud-record-live-refresh.json` set a parameter named
`realtimeEnabled`, which no port has ever read. Both corrected.

**Not built:** slice 7 items 2 and 3 as *live* passes. The Directus key-only delete and the Supabase
disclosure are driven end to end in `realtime-transports.test.ts` against the real transports on
injected globals, but no live PocketBase/Directus/Supabase instance was stood up in this session —
see the live-QA recipe in the handover. The docs page (slice 4 item 3) is a URL this repo does not
own; the content belongs to the docs repo.

Covers reported item **2**. Decided in [TALK-005](TALK-005-BACKEND-BOUND-REALTIME.md) (had
2026-08-05) — read its decisions table and its **four corrections** before starting; two of them
contradict the shape TALK-005's own closing paragraph proposed.

**Not blocked on anything.** Every seam is load-bearing today. This is assembly, not invention:
the five-transport realtime layer, the backend picker, the collection dropdown and the whole
output vocabulary already exist and are already measured live (BCN-008).

## What this is, in one sentence

A node you drop on the canvas that says *"tell me when anything in this collection changes"* —
zero configuration against the built-in backend, and an honest sentence on `Realtime Error` when
the selected backend cannot push.

## Why it is not the WebSocket node

`net.noodl.WebSocket` stays exactly as it is. Our backend has **no WebSocket server at all** —
[nodegx-backend](../../../packages/nodegx-backend/src/) has no upgrade handling and no `ws`
dependency; realtime is the SSE `/realtime` endpoint served by
[RealtimeHub](../../../packages/nodegx-backend/src/realtime/RealtimeHub.ts), per BAK-001. Of the
six backend types the transports are nodegx → SSE, PocketBase → SSE, Directus → WebSocket, Parse →
LiveQuery (probe-gated), Supabase → none, custom → none. Hiding that behind one node is the entire
point of `IRealtimeAdapter`.

The only WebSocket-node change in this task is **slice 5** (its description).

## Slice 1 — the node

New file `packages/noodl-runtime/src/nodes/std-library/data/subscribetochanges.ts`, registered in
the **Records** block of [`noodl-runtime.ts`](../../../packages/noodl-runtime/noodl-runtime.ts)
beside `dbcollectionnode2`.

⚠️ **This node must not reach the cloud function vocabulary — and registering it naively will put
it there.** That list reaches *every* runtime; the browser viewer adds to it and never subtracts.
It is how AIX-005's nine browser-state nodes ended up offered on a server-side function canvas for
months (TALK-007 §2). A long-lived SSE subscription inside a request/response cloud function is the
same mistake with a socket attached.

⚠️ **Coordinate before writing this line.** As of 2026-08-05 a parallel session is mid-change in
this file: its docblock already instructs *"add to `browserOnlyNodes` rather than deleting a
`require`"*, but **`browserOnlyNodes` does not exist anywhere in the repo yet** — the prose landed
ahead of the list, uncommitted. So:

- If the subtraction list has landed by the time you build: register in the shared list **and add
  this node to `browserOnlyNodes`**.
- If it has not: register in the browser viewer's own list
  ([`register-nodes.js`](../../../packages/noodl-viewer-react/src/register-nodes.js)), which is
  browser-only by construction, and leave a comment pointing at the pending subtraction.
- Either way, **check the node's absence from the cloud picker**, don't infer it. The list this
  node is in is not the same question as the list the picker reads.

Definition metadata, following `DbCollectionNode`
([:203-209](../../../packages/noodl-runtime/src/nodes/std-library/data/dbcollectionnode2.ts#L203-L209)):

```
name:            'SubscribeToChanges'
displayName:     'Subscribe To Changes'
category:        'Cloud Services'
color:           'data'
usePortAsLabel:  'collectionName'
ssr:             { compat: 'client-only' }
```

⚠️ **Do not reuse `noodl.byob.SubscribeToChanges`.** That type name belonged to the retired
Directus-only node, saved projects that contain it were never migrated to this behaviour, and
fresh-start compatibility is not a constraint on this repo. A new name means an old graph fails
loudly rather than silently acquiring different semantics.

⚠️ `ssr: { compat: 'client-only' }` is the seam Query Records **could not use** — it has to run
during a server render, which is why it gates the *capability* instead
([:668-679](../../../packages/noodl-runtime/src/nodes/std-library/data/dbcollectionnode2.ts#L668-L679)).
This node has no such obligation, so the declaration is the whole SSR story here. Don't copy the
`platform.isSSRServer()` check across; it would be a second mechanism for one rule.

## Slice 2 — ports

**Inputs.** All minted at runtime, same as the Record family — this node has no static `inputs`.

| Port | Source |
|---|---|
| Backend picker (`backendId`) | `recordBackendPickerPorts` ([record-ports.ts:119-121](../../../packages/noodl-runtime/src/nodes/std-library/data/record-ports.ts#L119-L121)) — `_active_` default, hidden when the project has one backend. **This is the "our backend is the easy path" lever**; don't hand-roll it. |
| Class (`collectionName`) | `recordClassPorts` ([record-ports.ts:124+](../../../packages/noodl-runtime/src/nodes/std-library/data/record-ports.ts#L124)) — introspected schema of whichever backend is selected. |
| Filter | The visual filter, **nodegx-only** — see slice 3. |
| `enabled` (boolean, default `true`) | Lets a graph stop a subscription without deleting the node. Query Records' equivalent is the `realtime` checkbox itself; this node needs its own switch because it has nothing else to do. |

**Outputs.** Copy the Realtime group verbatim from
[dbcollectionnode2.ts:459-558](../../../packages/noodl-runtime/src/nodes/std-library/data/dbcollectionnode2.ts#L459-L558)
— `subscribed`, `realtimeStatus`, `realtimeError`, `realtimeFailure`, `created`, `updated`,
`deleted`, `changed`, `changedEvent`, `changedRecord`, `changedRecords`, `changedRecordId`. Same
names, same descriptions, same `group: 'Realtime'`. Two nodes disagreeing about what "Changed
Record Id" means is the twin this task must not create.

⚠️ **No `runOnValueChange` guard on the change handler.** Query Records has one
(`shouldRunOnValueChange('records')` at
[:770](../../../packages/noodl-runtime/src/nodes/std-library/data/dbcollectionnode2.ts#L770))
because a change there triggers a *re-query*. This node fires signals and nothing else, so there
is nothing to guard and adding a checkbox would be a control that does nothing.

⚠️ **Ports are never gated on backend support.** This is the correction in TALK-005 — the shipped
decision is that the capability stays visible and explains itself
([:1242-1245](../../../packages/noodl-runtime/src/nodes/std-library/data/dbcollectionnode2.ts#L1242-L1245),
[nodeCapabilities.ts:83-87](../../../packages/nodegx-backend-contract/src/nodeCapabilities.ts#L83-L87)).
`realtimeSupportFor` decides at runtime and the reason lands on `Realtime Error`.

## Slice 3 — the filter, and its disclosure

Declare the filter port. Pass it as `options.where`.

⚠️ **It reaches a server on nodegx only.**
[`NODEGX_SSE.subscribeRequest`](../../../packages/noodl-runtime/src/api/backends/realtime/SseTransport.ts#L112)
sets `subscription.filter`; `POCKETBASE_SSE` and `DirectusWebSocketTransport` never read
`options.where`. Query Records deliberately sends none at all for this reason
([:638-643](../../../packages/noodl-runtime/src/nodes/std-library/data/dbcollectionnode2.ts#L638-L643)).

Richard's decision is to ship it anyway, **disclosed** — the built-in backend does accept one and
it is useful today. So:

- The port tooltip says which backends honour it and that the others deliver the whole collection.
- ⚠️ **Never filter client-side as a fallback.** BCN-003's rule: a transport that cannot filter
  server-side must not filter client-side and call it the same thing. Four filter dialects already
  cost a task to collapse; a fifth, implemented in a node, is worse than an unfiltered stream.
- The catalog/enrichment entry (slice 4) states the same, because that is where the agent reads it.

## Slice 4 — make it discoverable

The report is itself the evidence for this slice: the capability shipped and its owner didn't know.

1. **`nodeCapabilities.ts`** — a node-level binding to `realtime.subscribe`
   ([NODE_CAPABILITIES](../../../packages/nodegx-backend-contract/src/nodeCapabilities.ts#L69)).
   Unlike `DbCollection2` this takes a **`node:`** row, not a `ports:` row — the whole node is
   unusable where realtime is, so the gate belongs on the node (the `noodl.cloud.aggregate`
   precedent, same file).
2. **Catalog + enrichment** — regenerate, don't hand-edit
   `packages/noodl-types/src/node-catalog.json` / `node-catalog-enriched.json`
   (`scripts/node-catalog/`). ⚠️ A stale catalog snapshot has already been red-for-commits once in
   this repo when a generator change wasn't regenerated; run the check, don't assume.
3. **Docs page** — `docs: 'https://docs.noodl.net/nodes/data/cloud-data/subscribe-to-changes'`,
   and the page names the two holes (slice 6).

## Slice 5 — the WebSocket node's description

One string. `net.noodl.WebSocket`
([websocket.ts](../../../packages/noodl-runtime/src/nodes/std-library/agent/websocket.ts)) gains a
line saying it is for third-party sockets and device telemetry, and that **project backend data
uses Subscribe To Changes**. This is the whole of Q2's outcome — no backend mode, because for our
own backend there is no socket to connect to.

## Slice 6 — say what doesn't work

Both holes are named on the node and in its docs, not fixed here (TALK-005 Q3):

- **Supabase**: no transport was ever built. `realtimeSupportFor('supabase')` returns
  `unsupported` with `SUPABASE_REALTIME_REASON`
  ([realtime/index.ts:88](../../../packages/noodl-runtime/src/api/backends/realtime/index.ts#L88)),
  so the node reports a sentence rather than sitting `connecting`. Unmeasured — it was never in the
  BCN-008 rig.
- **SSR**: the SSE transports have only ever been exercised against an `EventSource` shim, never a
  real server render. `client-only` (slice 1) is what makes that not matter for *this* node, and
  that should be stated rather than left as an assumption.
- **Parse**: `conditional` — LiveQuery runs as a separate server and was measured **absent** in our
  rig. The probe decides at runtime; the reason string already explains it.

## Slice 7 — verification

The bar BCN-008 set, and the one this must clear:

1. **Corpus/unit test** against the local backend — subscribe, write from a second client, assert
   the signal set and `changedRecordId`. Follow
   [`realtime-transports.test.ts`](../../../packages/noodl-runtime/test/backends/realtime-transports.test.ts).
2. **Live-verify one non-nodegx transport** — PocketBase (SSE) or Directus (WebSocket). ⚠️ On a
   Directus **delete** the frame carries the key only, so `changedRecord` is null and
   `changedRecordId` is the output that works
   ([:534-535](../../../packages/noodl-runtime/src/nodes/std-library/data/dbcollectionnode2.ts#L534-L535)).
   Verify that specific case; a test that only exercises create/update will pass while the delete
   path publishes `{}`.
3. **Live-verify the disclosure** — point it at Supabase and confirm `Realtime Error` carries the
   reason and `Realtime Failure` fires. A capability that fails silently is the exact defect
   `conditional` was invented to prevent, and only driving it proves otherwise.
4. Editor suite: **only the `Jasmine:` line counts.**

## Its sibling, deliberately not built here

[CWF-007](CWF-007-STREAMING-RESPONSES.md)'s streaming node subscribes to a channel a cloud function
publishes on. TALK-005 Q4 settled that as a **separate node**, sharing `RealtimeSubscription` but
not a node definition: different payloads (a row versus an arbitrary chunk) and different auth
postures — `GET /realtime` is `{ kind: 'public' }` today, which is survivable for record changes
and is not for an LLM's output addressed to one user. That is a decision, not a deferral; CWF-007
Q3 is answered. Don't collapse them later without reading both.
