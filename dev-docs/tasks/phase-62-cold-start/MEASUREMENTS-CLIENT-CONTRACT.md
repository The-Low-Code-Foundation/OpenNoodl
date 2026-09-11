# Phase 62 — what the client actually does

**Measured 2026-08-11**, against **Claude Code 2.1.217** (`@anthropic-ai/claude-code`, the npm global
under nvm — the same binary `probeBinary.js` finds), on macOS 25.5.0.

These are the four unverified premises BST-002 and BST-005 were gated on. All four are now measured,
**with zero model spend**: no conversation turn was taken in any run. Three confirmed a design; the
fourth **reversed one**.

## §0 — The rig

`scratchpad/probe/server.js` — a throwaway raw-JSON-RPC stdio MCP server, ~120 lines, no SDK. It logs
every inbound method with a millisecond offset and answers `initialize`, `tools/list`, `tools/call`,
`ping`, `resources/list`, `prompts/list`.

🔴 **It reveals its second tool on a TIMER, not on a tool call**, and that is the whole reason this
cost nothing. A reveal triggered by `tools/call` needs a model to make the call. A reveal triggered
3s after `notifications/initialized` needs only a client that has *booted*, and booting an
interactive session makes no model request at all.

Driven as:

```
{ sleep 2; printf '\r'; sleep 30; } | script -q /dev/null \
  claude --mcp-config <cfg>.json --strict-mcp-config
```

`script` allocates the pty an interactive session needs; the `\r` answers the trust-folder prompt,
which sits *in front of* MCP connection and will otherwise look exactly like "the server never
spawned". `--strict-mcp-config` keeps the run off Richard's real registrations.

## §1 — ✅ F91: Claude Code **does** re-list on `notifications/tools/list_changed`

**This is BST-002's gate, and the answer is yes.** §1 of that task is the whole task; the third-state
fallback is not needed.

```
     2ms  BOOT
     3ms  <-  initialize id=0
    89ms  <-  notifications/initialized
    90ms  <-  tools/list id=1
    90ms     TOOLS/LIST  returning 1 tool(s); revealed=false
  3091ms  REVEAL  (timer 3s after initialized) -> emitting notifications/tools/list_changed
  3094ms  <-  tools/list id=2
  3094ms     TOOLS/LIST  returning 2 tool(s); revealed=true
```

**3ms** from notification to re-list.

⚠️ **And the control, which is the half that could have disconfirmed it** (A19's lesson from phase
58 — *"the instrument was missing the half that could disconfirm the change"*). Identical server,
identical 30s window, reveal and notification deleted:

```
     4ms  BOOT
     6ms  <-  initialize id=0
   111ms  <-  notifications/initialized
   111ms  <-  tools/list id=1
   112ms     TOOLS/LIST  returning 1 tool(s); revealed=false
```

One `tools/list`, and no second one ever. So the re-list in the treatment is caused by the
notification and is not a poll.

## §2 — ✅ F92: `.mcp.json`'s key shape, read off the client that writes it

Not guessed and not read from documentation — produced by `claude mcp add --scope project`, which is
the client writing its own format:

```json
{
  "mcpServers": {
    "probe": {
      "type": "stdio",
      "command": "node",
      "args": ["/abs/path/server.js", "--project-arg"],
      "env": {}
    }
  }
}
```

**Byte-identical in shape to the `~/.claude.json` → `mcpServers` entry BST-003 measured** (F86), which
is why `BootstrapRegistration` in `mcpCommands.ts` already describes it exactly. One interface, two
files.

## §3 — ✅ F93: an unapproved project server is inert, not broken

With that `.mcp.json` present and never approved:

```
probe: node …/server.js --project-arg - ⏸ Pending approval (run `claude` to approve)
```

and **the probe's log file does not exist** — the process was never spawned. Every other registered
server in the same run connected normally.

So the degradation BST-005's acceptance asks for is the actual behaviour: **no tools, a named reason,
and a working client.** Not a broken client, and not silent — the pending state is printed in
`claude mcp list` and prompted for on first `claude` in the folder.

⚠️ `enableAllProjectMcpServers` in a project `.claude/settings.local.json` did **not** move it out of
pending for `claude mcp list`. Approval for that command comes from the interactive prompt.

## §4 — 🔴 F94: user scope **shadows** project scope on the same name — this reverses BST-005 §2

The one measurement that changed a decision.

Both registered at once, same name `nodegx`, different args so they are distinguishable:

| Registration | Args |
|---|---|
| `claude mcp add --scope user nodegx` | `… USER-SCOPE` |
| `.mcp.json` in the project | `… PROJECT-SCOPE` |

`claude mcp list`, run **inside the project folder**:

```
nodegx: node …/server.js USER-SCOPE - ✔ Connected
```

**One row.** The project-scope entry is not listed at all — not as connected, not as pending, not as
a conflict. Remove the user-scope one and the project-scope entry appears in the same cwd:

```
nodegx: node …/server.js PROJECT-SCOPE - ⏸ Pending approval
```

### Why this is not academic

BST-005 §2 argued for the bare name `nodegx` because *"inside a file that only applies to this folder
there is nothing to collide with"*. **There is exactly one thing to collide with, and BST-003 puts it
there**: the launcher's "Connect Claude Code" card registers `nodegx` at **user scope**
(`BOOTSTRAP_SERVER_NAME`, `mcpCommands.ts`). So the intended cold-start sequence —

1. user clicks the launcher card → user-scope `nodegx`, **unbound**
2. agent runs `create_project` → project written, with a `.mcp.json` naming `nodegx`
3. user opens that folder tomorrow

— ends with step 3 silently loading **step 1's unbound bootstrap server**. The agent gets
`list_projects` and `create_project` in a folder that already is a project, no authoring tools, and
nothing anywhere says why. That is this phase's founding complaint, arriving through the file written
to prevent it.

🔴 **So BST-005 writes the per-project name** — `authoringServerName(dir)` → `nodegx-<slug>`, the
TALK-004 decision-4 name — and not the bare `nodegx`. The per-project name exists to stop
registrations overwriting one another; it turns out project scope does not exempt a file from that,
it just makes the overwrite invisible.

## §5 — Incidental

⚠️ **F82 did not reproduce.** `nodegx-observe` reported `✘ Failed to connect` in the first
`claude mcp list` of the night and `✔ Connected` twenty minutes later, same command, same binary
under `/Applications/NodeGX.app`. Whatever it is, it is intermittent rather than a broken
registration, and it is not the flat failure the register records.
