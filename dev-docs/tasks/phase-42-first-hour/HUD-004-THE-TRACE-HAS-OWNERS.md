# HUD-004 — the trace has owners

Out of [TALK-003](TALK-003-A-RECORDING-HUD.md) Q4, talked 2026-08-05. Richard chose **separate the
switches** over the cheaper "have the runtime echo its state".

**Status: ✅ shipped 2026-08-06.** All five slices. The live data-loss bug is fixed and has a test
that fails without the fix. Several of this doc's line references were wrong; they are corrected
at the bottom, and one of them was wrong about a *mechanism*, not a line — the relay's close
handler did not do what the doc said it did, and taking the doc at its word would have shipped a
regression the moment editor peers got ids.

Independent of [HUD-001](HUD-001-THE-RECORDING-OVERLAY.md)–[003](HUD-003-EXPAND-TO-THE-WALK.md) in
code, but it is what lets the HUD's header be true, and it fixes a live data-loss bug.

## The mechanism today, and the bug nobody has hit yet on purpose

The trace is **one global boolean on the NodeContext**, and the message that sets it carries no
identity at all:

- `NodeContext.setTraceEnabled(enabled)` — `nodecontext.ts`, at the time line 679.
- Fed from `editorconnection.ts` on `cmd: 'traceEnabled'`, gated on `isRunningLocally()`.
- Sent by the editor as `{cmd:'traceEnabled', content:{enabled}}`, **broadcast to every viewer with
  no clientId and no sender** (`ViewerConnection.sendTraceEnabled`).
- Sent identically by the observe MCP (`relayClient.setTraceEnabled`).
- The relay forwards messages **verbatim** — it never stamps a sender
  ([relay-server.js:150-164](../../../packages/noodl-editor/src/main/src/relay-server.js#L150-L164)).

⚠️ **And neither editor peer registered a `clientId`.** The editor sent
`{cmd:'register', type:'editor', token}` ([ViewerConnection.ts:103](../../../packages/noodl-editor/src/editor/src/ViewerConnection.ts#L103))
and `nodegx-observe` sent the same. So `_handle.clientId` was `undefined` for both, they were
filtered out of the relay's own `clients` listing
([relay-server.js:118-129](../../../packages/noodl-editor/src/main/src/relay-server.js#L118-L129)),
and there was **no identity in the system to own a switch with**. That is the real cost of Q4, and
it is why this is a task rather than a line.

Two consequences, both real:

1. **An agent's `stop_trace` disarmed a human's recording**, with no UI signal — already noted as a
   trap in [FH-011](FH-011-RECORD-RECORDS-NOTHING.md).
2. **An agent's `start_trace` destroyed it.** `setTraceEnabled(true)` replaced the buffer
   unconditionally (`this._traceBuffer = new TraceBuffer()`) — so arming while someone else was
   mid-recording silently deleted everything they had captured. This one is data loss, not
   confusion, and it is not in FH-011.

## What shipped

**Ownership is a set, and capture is "the set is non-empty".**

**Slice 1 — editor peers have identities.** ✅ `ViewerConnection.clientId` (`editor-xxxxxxxx`) and
`RelayClient.clientId` (`observe-xxxxxxxx`), both minted once and sent on `register`. Verified
against the OBS-004 discovery path as the doc asked: `discoverClients` keeps only
`entry.type === 'viewer'` entries
([relayClient.ts:597-604](../../../packages/nodegx-observe/src/relayClient.ts#L597-L604)), so editor
peers appearing in the relay's listing changes nothing for it.

⚠️ **But it did break something else, which this doc did not predict — see the corrections.**

**Slice 2 — `traceEnabled` carries `owner`.** ✅ The runtime keeps `_traceOwners: Set<string>`:

- `owner` arming → add; `owner` disarming → delete.
- `traceEnabled` is derived (`set.size > 0`) and stays a plain boolean, so the hot-path checks in
  `outputproperty.ts` and `node.ts` are untouched.
- The buffer is created **only on empty→non-empty** and dropped **only on non-empty→empty**. This
  is the data-loss fix, and `trace-ownership.test.js` asserts the *buffer's* lifetime rather than
  the boolean's — a fix that made the flag a set and still recreated the buffer would pass a
  "capture is still on" test and lose the recording anyway.
- A message with no `owner` maps to a single legacy key, so anything not yet updated behaves
  exactly as it does now.
- `traceEnabledChanged` accepts both the old bare boolean and the new `{enabled, owner}`.

**Slice 3 — release on disconnect.** ✅ The relay now announces authorised **non-viewer**
disconnects toward viewers as `{cmd:'peerDisconnected', clientId}`; the runtime drops that owner
and disarms if it was the last. Without this, slice 2 turns a temporary confusion into a permanent
one — the same class as FH-011's "a project switch leaves the runtime tracing forever".

**Slice 4 — the runtime says who is tracing.** ✅ `getTraceState` → `traceState`
(`{enabled, owners, highestSeq}`), handled in `ViewerConnection` alongside the other inbound trace
commands and surfaced on `TraceSession` as `otherOwners` / `joinedExistingTrace`. The HUD header
reads `recording · 12 events · also traced by an agent`, and
`joined a trace already running · also traced by an agent` when you armed into one.

⚠️ **`highestSeq` is the load-bearing half, not `owners`.** `TraceSession.start()` set `lastSeq = 0`
because arming had always cleared the runtime buffer. Under slice 2 it no longer does, so the first
pull would return the *other* owner's history and present it as what you just recorded. The session
now asks for the state **before** it arms (same socket, so the runtime answers about the pre-arm
world) and holds its first pull until the answer lands — with a deadline, so a viewer bundle too
old to answer behaves exactly as it did before. The same trap exists on `nodegx-observe`'s side of
the socket and is fixed the same way.

**Slice 5 — specs.** ✅ Runtime side is jest: `packages/noodl-runtime/test/trace-ownership.test.js`
(8 specs — two owners, one stops, capture continues; a second arm does not replace the buffer; last
owner leaves, buffer dropped; a crashed peer released; a legacy anonymous peer unchanged;
`getTraceState`). Editor side is jasmine, in `tests/utils/tracesession.spec.ts`. Relay side is
`tests-main/relay-auth.test.js` (3 specs), because the announcement is a wire behaviour and the
failure mode is silence.

Also shipped: **the `start_trace` / `stop_trace` tool descriptions were lies as of this commit.**
They told the agent it was clearing the editor's trace and stopping the world. They now say it
joins and releases.

## Criteria

1. ✅ Editor recording + agent `start_trace` → the human's events are still there afterwards.
   (`trace-ownership.test.js`, first spec.)
2. ✅ Agent `stop_trace` while the editor records → the editor keeps recording, and the HUD says the
   agent has gone (`the agent has stopped tracing · still recording` — the *departure* is stated,
   because a header that quietly loses a phrase looks exactly like one that never had it).
3. ✅ Kill the MCP process mid-trace → the relay announces it, the runtime releases that ownership,
   and pressing Stop in the editor actually stops capture.
4. ✅ An older peer that sends no `owner` behaves exactly as today.
5. ✅ Deployed runtimes are unaffected — every command here, including the new `getTraceState` and
   `peerDisconnected`, stays behind `isRunningLocally()`.
6. Live-QA recipe below; not driven by this session (a dev launch rewrites the example project and
   the checkout is shared). **Jest cannot see criteria 1–3 end to end** — it sees each half.

## Traps

- The `isRunningLocally()` gate is a security boundary, not a formality — the trace captures every
  value in the app ([editorconnection.ts:266-280](../../../packages/noodl-runtime/src/editorconnection.ts#L266-L280)).
  Nothing added here widens it: both new commands sit inside it, including `peerDisconnected`,
  which only *releases* a capability — a command handled on a deployed runtime is a command an
  attacker can probe for.
- The relay's authorisation gate is per-socket and checked on `register`
  ([relay-server.js:89-104](../../../packages/noodl-editor/src/main/src/relay-server.js#L89-L104));
  a `clientId` is a label, never a credential. Ownership is not a trust decision anywhere: the
  runtime never asks who an owner *is*, only whether the set is empty.
- `seq` is monotonic within a session and **restarts on preview reload**. A reload also resets
  ownership, since the fresh `NodeContext` starts with an empty owner set — FH-011 slice 3's re-arm
  re-sends the owner, not just the boolean, and there is a spec for that sentence.

## Corrections to this doc's own references

| Was | Is | Notes |
|---|---|---|
| `nodecontext.ts:679-696` — `setTraceEnabled` | 679-695 | Right. |
| `ViewerConnection.ts:469-474` — `sendTraceEnabled` | 475-480 | Off by six. |
| `relayClient.ts:369-370` — the MCP's send | 376 (the *re-arm*); the real one is `setTraceEnabled` at 611 | The doc pointed at the reconnect path, not the command. |
| `relayClient.ts:136` — the MCP's register | 238 | A hundred lines out. |
| `relayClient.ts:360-364` — `resolveClientId` filters on `type === 'viewer'` | `discoverClients` at 597-604 | Right claim, wrong function: `resolveClientId` (574) does no filtering at all; the filter is in the discovery it delegates to. |
| `relay-server.js:119-128` — the `clients` listing | 118-129 | Right. |
| `relay-server.js:184-188` — "announces disconnects only toward editors" | 186-190 | The *claim* was right and incomplete: see below. |
| `ViewerConnection.ts:201-215` — inbound trace commands | 207-225 | Off by six. |
| `TraceSession.ts:190-197` — `start()` sets `lastSeq = 0` | 260-273 | Wrong region. |
| `TraceSession.ts:150-156` — the renumber detection | 209-222 | Wrong mechanism: 150-156 is where listeners are registered. Same error HUD-003's doc made. |

### The one that mattered

> "The relay announces disconnects only *toward editors* today (`broadcastMessage(msg, 'viewer')`
> inverts the type)"

True, and it left out the half that bites: **the close handler ran that broadcast for _every_
socket type, not only for viewers.** It got away with it because editor peers had no `clientId`, so
the message named nobody and every editor ignored it. Slice 1 gives editor peers ids — at which
point, without a gate, closing one editor window tells every other editor that client
`editor-a1b2c3d4` has disconnected: an export cache dropped and a `viewerClientsChanged` fired for
a viewer that never existed. The close handler is now explicitly branched on `_handle.type`, and
there is a spec for each direction.

## Live QA

Needs **three** processes: the editor, a preview, and `nodegx-observe` attached to the same relay.
Both themes for the header (the owners phrase is `--theme-color-fg-muted` inside the pill).

**The data-loss fix — this is the one to actually prove.**

1. Editor + preview open. Press **Record** on the canvas pill. Click your app until the counter
   reads something distinctive — say 20 events. Note the number.
2. Now, from the agent side, call **`start_trace`**.
3. ⚠️ **The editor's count must not drop.** Before this change it went to 0 and every event the
   user had captured was gone from the runtime, unrecoverably — no Refresh, no Stop, nothing. The
   header should now also read `… · also traced by an agent`.
4. Click the app some more; the count keeps climbing from where it was.
5. Call **`stop_trace`**. The editor keeps recording — the counter keeps climbing — and the header
   reads `the agent has stopped tracing · still recording`.
6. Press **Stop** in the editor. Open Provenance: every event from step 1 onwards is in the
   recorded interactions, including the ones from before the agent joined.

**The reverse direction.**

7. With nothing recording, call `start_trace`, then call `get_trace` / `where_did_this_go` to see
   the agent capture on its own. Now press **Record** in the editor. The header says
   `joined a trace already running`, and — the subtle one — the editor's counter starts from
   **zero**, not from the agent's history. If it opens on the agent's events, `highestSeq` is not
   being read.
8. Press **Stop** in the editor. The agent's `get_trace` still works and its capture continues.

**The crashed agent (slice 3).**

9. Editor recording, agent `start_trace`, then **kill the MCP process** (`Ctrl-C` it, or kill the
   pid) without calling `stop_trace`.
10. The editor header drops the agent phrase within ~1.5s.
11. Press **Stop** in the editor, then press **Record** again and watch the counter. It must start
    from zero and climb — proving capture really stopped in between. Before slice 3 the runtime
    still held the dead agent's ownership, so Stop stopped nothing and the buffer never emptied.

**The legacy path (criterion 4).**

12. Anything that still sends `{enabled}` with no `owner` — an old viewer bundle, a hand-rolled
    socket client — must behave exactly as it always did: arming clears, disarming drops.
