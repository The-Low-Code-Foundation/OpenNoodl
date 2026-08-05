# HUD-004 — the trace has owners

Out of [TALK-003](TALK-003-A-RECORDING-HUD.md) Q4, talked 2026-08-05. Richard chose **separate the
switches** over the cheaper "have the runtime echo its state".

Independent of [HUD-001](HUD-001-THE-RECORDING-OVERLAY.md)–[003](HUD-003-EXPAND-TO-THE-WALK.md) in
code, but it is what lets the HUD's header be true, and it fixes a live data-loss bug.

## The mechanism today, and the bug nobody has hit yet on purpose

The trace is **one global boolean on the NodeContext**, and the message that sets it carries no
identity at all:

- `NodeContext.setTraceEnabled(enabled)` —
  [nodecontext.ts:679-696](../../../packages/noodl-runtime/src/nodecontext.ts#L679-L696).
- Fed from `editorconnection.ts:266-273` on `cmd: 'traceEnabled'`, gated on `isRunningLocally()`.
- Sent by the editor as `{cmd:'traceEnabled', content:{enabled}}`, **broadcast to every viewer with
  no clientId and no sender** ([ViewerConnection.ts:469-474](../../../packages/noodl-editor/src/editor/src/ViewerConnection.ts#L469-L474)).
- Sent identically by the observe MCP ([relayClient.ts:369-370](../../../packages/nodegx-observe/src/relayClient.ts#L369-L370)).
- The relay forwards messages **verbatim** — it never stamps a sender
  ([relay-server.js:150-164](../../../packages/noodl-editor/src/main/src/relay-server.js#L150-L164)).

⚠️ **And neither editor peer registers a `clientId`.** The editor sends
`{cmd:'register', type:'editor', token}` ([ViewerConnection.ts:103](../../../packages/noodl-editor/src/editor/src/ViewerConnection.ts#L103))
and `nodegx-observe` sends the same ([relayClient.ts:136](../../../packages/nodegx-observe/src/relayClient.ts#L136)).
So `_handle.clientId` is `undefined` for both, they are filtered out of the relay's own `clients`
listing ([relay-server.js:119-128](../../../packages/noodl-editor/src/main/src/relay-server.js#L119-L128)),
and there is **no identity in the system to own a switch with**. That is the real cost of Q4, and
it is why this is a task rather than a line.

Two consequences, both real today:

1. **An agent's `stop_trace` disarms a human's recording**, with no UI signal — already noted as a
   trap in [FH-011](FH-011-RECORD-RECORDS-NOTHING.md).
2. **An agent's `start_trace` destroys it.** `setTraceEnabled(true)` replaces the buffer
   unconditionally (`this._traceBuffer = new TraceBuffer()`,
   [nodecontext.ts:684-690](../../../packages/noodl-runtime/src/nodecontext.ts#L684-L690)) — so
   arming while someone else is mid-recording silently deletes everything they had captured. This
   one is data loss, not confusion, and it is not in FH-011.

## What to build

**Ownership is a set, and capture is "the set is non-empty".**

**Slice 1 — editor peers have identities.** Both `ViewerConnection` and `nodegx-observe`'s
`relayClient` mint a `clientId` and send it on `register`. Safe against the OBS-004 discovery path:
`resolveClientId` filters on `entry.type === 'viewer'`
([relayClient.ts:360-364](../../../packages/nodegx-observe/src/relayClient.ts#L360-L364)), so
editor peers appearing in the listing changes nothing for it — verify that before relying on it.

**Slice 2 — `traceEnabled` carries `owner`.** The runtime keeps `_traceOwners: Set<string>`:

- `owner` arming → add; `owner` disarming → delete.
- Capture is on while the set is non-empty (`traceEnabled` becomes derived, so the hot-path checks
  in `outputproperty.ts` and `node.ts` are untouched).
- The buffer is created **only on empty→non-empty** and dropped **only on non-empty→empty**. This
  is the data-loss fix.
- A message with no `owner` maps to a single legacy key, so anything not yet updated behaves
  exactly as it does now.

**Slice 3 — release on disconnect, or an agent that crashes traces forever.** The relay announces
disconnects only *toward editors* today (`broadcastMessage(msg, 'viewer')` inverts the type,
[relay-server.js:184-188](../../../packages/noodl-editor/src/main/src/relay-server.js#L184-L188)),
so a viewer never learns that a peer went away. Announce authorised non-viewer disconnects toward
viewers as well; the runtime drops that owner and disarms if it was the last. Without this, slice 2
turns a temporary confusion into a permanent one — the same class as FH-011's "a project switch
leaves the runtime tracing forever".

**Slice 4 — the runtime says who is tracing.** A `traceState` reply (`{enabled, owners, highestSeq}`)
handled in `ViewerConnection` alongside the other three inbound trace commands
([ViewerConnection.ts:201-215](../../../packages/noodl-editor/src/editor/src/ViewerConnection.ts#L201-L215))
and surfaced on `TraceSession`. The HUD header then reads `recording` or
`recording · also traced by an agent` — and, when you arm into a trace someone else already
started, `joined a trace already running`.

⚠️ That last state needs `highestSeq`. `TraceSession.start()` sets `lastSeq = 0`
([TraceSession.ts:190-197](../../../packages/noodl-editor/src/editor/src/utils/provenance/TraceSession.ts#L190-L197))
because arming has always cleared the runtime buffer. Under slice 2 it no longer does, so the first
pull would return the *other* owner's history and present it as what you just recorded. Start from
the runtime's current seq instead.

**Slice 5 — specs.** Runtime side is jest (`packages/noodl-runtime`, `test/`): two owners, one
stops, capture continues; second arm does not replace the buffer; last owner leaves, buffer
dropped. Editor side is jasmine.

## Criteria

1. Editor recording + agent `start_trace` → the human's events are still there afterwards.
2. Agent `stop_trace` while the editor records → the editor keeps recording, and the HUD says the
   agent has gone.
3. Kill the MCP process mid-trace → the runtime releases its ownership; pressing Stop in the editor
   actually stops capture.
4. An older peer that sends no `owner` behaves exactly as today.
5. Deployed runtimes are unaffected — every one of these commands stays behind `isRunningLocally()`.
6. Verified with the editor and `nodegx-observe` running against one preview. Jest cannot see this.

## Traps

- The `isRunningLocally()` gate is a security boundary, not a formality — the trace captures every
  value in the app ([editorconnection.ts:266-273](../../../packages/noodl-runtime/src/editorconnection.ts#L266-L273)).
  Nothing added here may widen it.
- The relay's authorisation gate is per-socket and checked on `register`
  ([relay-server.js:89-104](../../../packages/noodl-editor/src/main/src/relay-server.js#L89-L104));
  a `clientId` is a label, never a credential. Do not let ownership become a trust decision.
- `seq` is monotonic within a session and **restarts on preview reload**
  ([TraceSession.ts:150-156](../../../packages/noodl-editor/src/editor/src/utils/provenance/TraceSession.ts#L150-L156)).
  A reload also resets ownership, since the fresh `NodeContext` starts with `traceEnabled = false`
  — FH-011 slice 3's re-arm has to re-send the owner, not just the boolean.
