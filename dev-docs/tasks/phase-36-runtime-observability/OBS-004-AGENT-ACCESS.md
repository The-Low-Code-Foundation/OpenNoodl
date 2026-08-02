# OBS-004: Agent access

## Metadata

| Field | Value |
|-------|-------|
| **ID** | OBS-004 |
| **Phase** | Phase 36 (Track U) |
| **Tier** | 3 |
| **Priority** | 🟡 Medium — the original ask, deliberately last |
| **Difficulty** | 🟡 Medium |
| **Prerequisites** | OBS-001 (substrate), OBS-002 (walk engine). Better with OBS-003 |
| **Security** | ⚠️ opens a documented local integration point — see below |

## Objective

Let a user's Claude Code — running against the **downloaded, non-dev editor** — observe a running
app, walk its provenance, and act on it.

## Why this is last

It is the question that started the phase, and it is deliberately the final task, because **an agent
is only as good as the tools underneath it.** An LLM over a raw graph dump guesses. An LLM over a
provenance walk with node-authored diagnoses reports facts.

Tiers 1 and 2 are what make this good, and they are worth building whether or not this ships.

## What is already true

The surprising finding from the design pass: **almost nothing is missing.**

| Fact | Where |
|---|---|
| The relay on **8574** is product infrastructure, present in the packaged app | [web-server.js:59](../../../packages/noodl-editor/src/main/src/web-server.js#L59) |
| Any process that opens `ws://localhost:8574` and registers as an `editor` peer receives the full stream | [web-server.js:257-336](../../../packages/noodl-editor/src/main/src/web-server.js#L257-L336) |
| **CDP is not required.** Observation needs only the socket — no debug port, no `--dev`, no env var | — |
| If CDP *were* wanted, it is also already unlocked in the packaged build: `NOODL_REMOTE_DEBUG_PORT` is not dev-gated, and `remote-allow-origins` (the trap that otherwise makes CDP hang silently on Electron 34+) is already handled | [main.js:84-92](../../../packages/noodl-editor/src/main/main.js#L84-L92) |
| No `@electron/fuses` config exists, so nothing else blocks it | [package.json](../../../packages/noodl-editor/package.json) `build` block |

## Scope

### 1. An MCP server that registers on the relay

A WebSocket client, the `register` handshake, and the walk engine from OBS-002.

| Tool | Backed by |
|---|---|
| `start_trace` / `stop_trace` | the OBS-001 `traceEnabled` command |
| `why_is_this_empty(node, port)` | the OBS-002 backward walk |
| `where_did_this_go(event)` | the forward walk |
| `get_warnings` | OBS-003 + the existing `GraphWarnings` on the same connection |
| `get_port_value(node, port)` | [`getConnectionValue`](../../../packages/noodl-runtime/src/editorconnection.ts#L212) |

⚠️ **This server must not be confused with the existing [`@noodl/mcp`](../../../packages/noodl-mcp/).**
That one reads **project directories on disk** and refuses legacy projects — and v2 is still default
off ([featureFlags.ts:22](../../../packages/noodl-editor/src/editor/src/services/ProjectStructure/featureFlags.ts#L22)),
so every real user's project would be refused today. This server reads a **running app over a
socket** and, because OBS-001's dictionary carries names *and* topology, **needs no project access at
all**. That is the specific reason the dictionary ships topology.

Whether the two servers merge later is an open question; they should not be coupled now.

### 2. Input injection

The difference between *"I can read your trace"* and *"I'll click Add To Cart and watch what
happens."*

The relay carries no input command today — the runtime handles `debuggingEnabled`, `modelUpdate`,
`hoverStart`, `getConnectionValue` and nothing that injects events. Two routes:

- **`webContents.sendInputEvent`** on the viewer window via a new relay command. The viewer is a
  `BrowserWindow` the main process already owns. **Preferred** — one channel, no debug port.
- CDP `Input.dispatchMouseEvent` against the viewer target. Works today, needs the env var, and adds
  a second channel for no benefit.

⚠️ **This is not optional for the agent story.** Richard's own framing of the open-ended case was
*"let me fire a couple of buttons and see why"* — that is **agency**, and it is what distinguishes an
agent from a chat box. It is also the piece that makes the in-editor read-only AI and Claude Code
genuinely different products rather than the same one twice.

### 3. Authentication on the relay

⚠️ **Port 8574 is unauthenticated, localhost, and bidirectional.** An `editor`-type peer can already
send to the viewer. Today that is obscure-but-open; **documenting it as an integration point makes it
a real surface**, and adding input injection makes that surface able to drive the user's app.

A token handshake belongs **before** this ships publicly, not after. See [README](./README.md) open
question 4 — the alternative is keeping the server local-only and deferring.

### 4. The in-editor AI path

The editor already has a provider-agnostic AI client (AIX-001) and an `AiChat` component in the
property editor. It should consume the **same** walk engine and tools.

The split that fell out of the design:

| | Reads | Acts | Good at |
|---|---|---|---|
| **In-editor AI** | ✓ | ✕ | "explain this walk to me" |
| **Claude Code** | ✓ | ✓ | "figure out what's wrong" — hypothesis, test, re-run |

Build the tools once; let both consume them. Do not build LLM reasoning into the editor.

## Acceptance

- [ ] A user's Claude Code, against a **packaged** NodeGX with no dev flags, can start a trace,
      click a button in the running preview, and report where the data stopped.
- [ ] The MCP server needs no access to the project on disk, and works on a legacy-format project.
- [ ] The relay rejects unauthenticated peers once the token lands.
- [ ] The walk engine is shared with OBS-002, not reimplemented.

## Notes

The end-state sentence to test against, from the conversation that produced this phase:

> *"Don't worry, I'll click the add to cart button in your app and look at where the new cart item is
> getting stuck or why it's not showing up in the repeater."*

⚠️ One honest limit: if the value reached the repeater and it still rendered nothing, the trace says
"data arrived" and the bug is visual. Diagnosing that needs the DOM, which is the one place CDP
earns its keep. Worth scoping explicitly rather than discovering.
