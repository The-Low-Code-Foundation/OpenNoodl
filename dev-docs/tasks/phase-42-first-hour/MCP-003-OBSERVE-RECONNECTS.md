# MCP-003 — `nodegx-observe` survives an editor restart

**Created:** 2026-08-05, out of [TALK-004](TALK-004-THE-MCP-FRONT-DOOR.md) decision 6.
**Status:** specified, not started. **Gates:** [MCP-001](MCP-001-CONNECT-AN-AI-AGENT.md)'s observe
button. **Depends on:** nothing.

This was not in TALK-004's research. It was found while verifying it, and it is the reason the
observe half of the front door cannot ship first: **the command we would be handing out stops
working the next time the user restarts the editor, and says nothing useful when it does.**

## The mechanism

Three facts that are individually fine and together are the bug.

1. **The relay token is minted per editor launch.** `relay-token.js` writes a fresh token to
   `<userData>/relay-token` at every start;
   [token.ts:4-6](../../../packages/nodegx-observe/src/token.ts#L4) documents this, and
   `findRelayToken` reads the file **once**, in
   [cli.ts:60](../../../packages/nodegx-observe/src/cli.ts#L60), before the server is built.
2. **`RelayClient.connect()` connects exactly once.**
   [relayClient.ts:129-171](../../../packages/nodegx-observe/src/relayClient.ts#L129) attaches
   `open`, `message`, `close` and `error` handlers, but every one of them is guarded by `if
   (settled) return`. Once the initial promise resolves, a later `close` does nothing at all: no
   retry, no state change, no log. There is no reconnect path in the file.
3. **An MCP client keeps a stdio server alive for the whole session.** Claude Code spawns the
   process once and holds it.

Compose them. The user copies the command; it works. They quit the editor and start it again — a
new token, a new relay, and a socket on the old one that closed while nobody was listening. From
that moment every tool call reaches
[relayClient.ts:293-297](../../../packages/nodegx-observe/src/relayClient.ts#L293):

```ts
private send(message: Record<string, unknown>): void {
  if (!this.socket || this.socket.readyState !== 1) {
    throw new Error('Not connected to the NodeGX relay.');
  }
```

So it fails loudly — good — but **permanently**, and the message does not tell the user that
restarting the MCP server fixes it. Nine tools, all dead, with a string that reads like a bug in
NodeGX.

⚠️ **This is worse than the current no-door.** Today nobody can connect, and nobody blames us for
it. With MCP-001 and without this, the first-run experience is "it worked, then it broke, and the
error doesn't say why" — which is what people remember.

## Why the loud failure must survive the fix

[cli.ts:70-76](../../../packages/nodegx-observe/src/cli.ts#L70) carries a deliberate design note
worth honouring:

> Fail here rather than registering the tools and letting each one fail in turn. A server that
> starts cleanly and then answers "could not connect" to every call reads as a broken server;
> refusing to start reads as "the editor is not running", which is what is actually true.

The fix must not turn that into a hang or a silent degrade. **Startup keeps refusing when the relay
is absent**; only the *already-running* server learns to recover.

## Slices

### Slice 1 — reconnect on close, re-reading the token

Give `RelayClient` a lifecycle beyond the first connect.

- Keep the `settled` guard for the **initial** promise; add a separate persistent `close` handler
  that fires after settling and schedules a reconnect.
- On reconnect, **call `findRelayToken()` again** rather than reusing `options.token`. This is the
  whole point: a new editor launch means a new token, and the stale one produces close code 4401
  forever. Take the `--token` / `$NODEGX_RELAY_TOKEN` precedence from
  [token.ts:54-75](../../../packages/nodegx-observe/src/token.ts#L54) unchanged — an explicit token
  stays explicit.
- Exponential backoff with a ceiling (start ~500ms, cap ~10s), and no unbounded retry log spam —
  stderr is the human channel, so log the first failure and then every escalation, not every
  attempt.
- Reconnect on **any** post-settle close, not only 4401. The common case is the editor being gone
  for thirty seconds, which closes the socket with no code of interest.

⚠️ **Do not retry faster than the 250ms accept heuristic.**
[relayClient.ts:139-147](../../../packages/nodegx-observe/src/relayClient.ts#L139) distinguishes
"accepted" from "refused" by *nothing happening for 250ms* — there is no `registered` ack for an
editor peer. A backoff shorter than that races its own success detection.

### Slice 2 — a truthful message while disconnected

`send()` keeps throwing, but with a string that reflects reality:

- Disconnected and retrying → say the editor connection dropped, that the server is retrying, and
  that the usual cause is the editor being restarted or closed.
- Never say "not connected" without saying what to do about it. The bar is
  [`describeMissingToken`](../../../packages/nodegx-observe/src/token.ts#L78), which is written to
  be actionable rather than accurate-and-useless — same standard here.

### Slice 3 — the state a reconnect must not silently lose

Two pieces of state live across a connection and need an explicit decision, not a default.

- **`traceEnabled`.** [relayClient.ts:370](../../../packages/nodegx-observe/src/relayClient.ts#L370)
  sends it fire-and-forget. After a reconnect the relay knows nothing about it, so an armed trace
  silently disarms — the same class of defect as
  [FH-011](FH-011-RECORD-RECORDS-NOTHING.md)'s "preview reload silently disarms with no re-arm".
  Re-send the last requested value on reconnect.
- **`highestSeq` and the event buffer.**
  [relayClient.ts:280](../../../packages/nodegx-observe/src/relayClient.ts#L280) absorbs events
  against a monotonic `highestSeq`. **Check whether a fresh runtime restarts its sequence at zero**
  — if it does, a retained `highestSeq` discards every event from the new session and the tools go
  quiet while appearing connected, which is the worst available failure. Verify before choosing
  between resetting the buffer and keeping it.

### Slice 4 — put the package in a gate

`test:packages` in the root `package.json` scopes `@noodl/mcp` and **not** `@noodl/observe`. Add
it, alongside the tests this task earns.

⚠️ Adding a package to `test:packages` makes its suite red-for-commits from that moment. Run it
first; do not discover a pre-existing failure through the gate.

## Success criteria

- [ ] With the observe server running, quit the editor and start it again: tools work afterwards
      with no user action, against the **new** token.
- [ ] While the editor is down, a tool call returns a message that names the cause and the fix.
- [ ] Startup with no editor running still **refuses to start** (the cli.ts:70 contract).
- [ ] An explicit `--token` is still honoured across reconnects.
- [ ] A trace armed before a restart is armed after it — or the tool says plainly that it is not.
- [ ] `npm run test:packages` runs `@noodl/observe` and is green.

## Traps

- **`--target=editor` attaches to the PREVIEW.** If this gets driven live, the editor CDP note in
  the harness applies as usual; never `cdp reload`.
- **A restart is a stop.** Verifying this fix means actually quitting and relaunching the editor —
  not reloading a window, which does not mint a new token and therefore does not test the bug.
- The relay token file is mode 0600 and named after `productName` (`NodeGX`), not the npm name —
  [token.ts:24-29](../../../packages/nodegx-observe/src/token.ts#L24). Any test that writes a fake
  token must respect both.
