# `nodegx-observe` — debugging a running NodeGX app from an agent

**OBS-004, phase 36 (Track U).** A second MCP server in this package. It has nothing to do with
the `noodl-mcp` server beside it, and the difference is the whole point:

| | `noodl-mcp` | `nodegx-observe` |
|---|---|---|
| Reads | a project **directory** on disk | a **running app** over a socket |
| Needs the editor | no | yes — running, with a preview |
| Project format | v2 only; refuses legacy | **any** — it never sees the project |
| Answers | "what does this project contain?" | "why did nothing happen when I clicked?" |
| Can act | edits files (with `--allow-writes`) | clicks and types in the running app |

They share a package for packaging reasons only: one dependency set, one build, one install.
No shared code path. Whether they should merge is deliberately left open.

## Why it needs no project access

Because OBS-001's session dictionary ships **topology**, not just names. A peer that reads it
knows every node's id, label, type and component *and* every connection between them — which
is everything the provenance walk needs. That is the specific reason the dictionary carries
edges, and it is what makes this server work on a project it cannot see, in a format it does
not understand.

## Setup

The editor must be running with a project open and the preview started.

```json
{ "mcpServers": { "nodegx-observe": { "command": "nodegx-observe" } } }
```

Authentication is automatic: the editor mints a relay token each launch and writes it to
`<userData>/relay-token` (mode 0600), and this server reads it from there.

```
macOS    ~/Library/Application Support/NodeGX/relay-token
Linux    ~/.config/NodeGX/relay-token
Windows  %APPDATA%\NodeGX\relay-token
```

⚠️ The directory is named after the app's **product name** (`NodeGX`), not the npm package
name. Override with `--token <token>` or `NODEGX_RELAY_TOKEN` if your build differs.

⚠️ **The token changes every time the editor restarts.** If the server was started against an
older launch it will refuse to connect and say so; restart it.

## The loop it is built for

```
start_trace                 # begin capturing every value on every wire
click { nodeId: "…" }       # or ask the user to reproduce
why_is_this_empty { nodeId: "…", port: "Items" }
```

`why_is_this_empty` computes where the data stopped by diffing what *should* be connected
(topology) against what *actually fired* (trace). It does not search a log, and it is bounded
by graph topology rather than by event volume — four hundred unrelated nodes firing
continuously are not upstream of the port you asked about, so they never appear.

## Tools

| Tool | Answers |
|---|---|
| `start_trace` / `stop_trace` | begin/end capture. ⚠️ **global** — see below |
| `list_nodes` | the address book; every other tool takes a node id |
| `why_is_this_empty` | *"I clicked X and nothing appeared in Y."* The backward walk |
| `list_root_events` | the actual interactions in the trace. Short by construction |
| `where_did_this_go` | everything downstream of one event. The filter that matters |
| `get_port_value` | a port's value **right now**, no recording needed |
| `get_warnings` | what the app is complaining about, from the nodes themselves |
| `click` / `set_text` | drive the app, addressed by node id |

### `why_is_this_empty` works with no recording

Layer 1 of the walk needs nothing to have fired. With no trace it reports each hop's *current*
value, which answers the state-provenance class of question — *"why is this label showing
X?"*, *"why is this padding 10px?"* — on a cold app. Start a trace and the same surface gains
the ✓/✕ frontier, which **is** the bug.

### Things it will tell you that look like gaps and are not

- **An input with no declared default reads `undefined`**, even on a node that behaves as
  though initialised. Nodes seed their internal state without touching the port. "This input
  was never set" is the honest answer to "why is this empty?".
- **A signal port has no value.** `undefined` there is truthful, not missing data.
- **`unknown` is not `never fired`.** With no recording, nothing is known about firing. The
  walk says so rather than guessing — a previous debug panel was retired for confidently
  showing wrong dataflow answers.
- **A recording that captured nothing is an answer**, not an absence. It means every edge
  genuinely never fired, which is usually the most informative run you will get.

## Limits, stated rather than discovered

- **There is one runtime, and the trace switch is global.** `start_trace` also starts — and
  clears — the trace the editor's own Provenance panel is showing. Two consumers of one
  running app can surprise each other.
- **Input injection dispatches DOM events, so `event.isTrusted` is false.** NodeGX's own nodes
  do not check it; an embedded third-party React component might. CDP remains the escape hatch.
- **A node id can name many elements.** Everything inside a Repeater exists once per row under
  the same id. `click` reports `matched` on success as well as failure; pass `index` to choose.
- **`get_warnings` only covers what happened since this server connected.** Warnings are
  pushed when they occur; there is no backlog to fetch. Reproduce, then ask.
- **If the value reached the node and it still rendered nothing, the trace says "data
  arrived"** and the bug is visual. Diagnosing that needs the DOM, which is the one place CDP
  earns its keep. This server will not find it.

## Security

Port 8574 is the editor's project relay. It is product infrastructure — it serves the preview,
so it runs in the packaged app — and it used to accept any connection. Browsers do not apply
the same-origin policy to WebSockets, so any page a user visited could open it, register as an
editor peer, and read the project export and every traced value out of the running app.

OBS-004 closed that: every peer presents the launch token in its `register`, and a peer that
has not is neither sent to nor read from. See
`packages/noodl-editor/src/main/src/relay-token.js`.

The token is a **per-launch capability, not a password**. It is readable by any process running
as the user, which is the ordinary local-tooling bar and is not protection against a process
that is already you.
