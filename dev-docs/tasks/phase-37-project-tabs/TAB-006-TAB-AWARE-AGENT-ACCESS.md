# TAB-006: Tab-aware agent access

## Metadata

| Field | Value |
|-------|-------|
| **ID** | TAB-006 |
| **Phase** | Phase 37 (Track V) |
| **Tier** | 3 |
| **Priority** | 🟡 Medium — deliberately last; it consumes tiers 1 and 2 |
| **Difficulty** | 🟢 Easy — the hard parts were built in phase 36 |
| **Prerequisites** | TAB-001, TAB-002 |

## Objective

Make "which project?" answerable to an agent once there is more than one open — for
`nodegx-observe`, for `noodl-mcp`, and for the in-editor assistant.

## The two MCP servers land on opposite sides of this

Recorded first, because the split is what makes this task small.

| | [`noodl-mcp`](../../../packages/noodl-mcp/) | [`nodegx-observe`](../../../packages/nodegx-observe/) |
|---|---|---|
| Reads | a project **directory** on disk | a **running app** over the relay socket |
| Needs the editor | no | yes |
| Bound to | `process.argv` project path ([cli.ts:27](../../../packages/noodl-mcp/src/cli.ts#L27)) | a port: `NOODLPORT \|\| 8574` ([relayClient.ts:119](../../../packages/nodegx-observe/src/relayClient.ts#L119)) |
| Effect of phase 37 | **none — it works unchanged** | **the port stops being a constant** |

### `noodl-mcp` — unaffected, and arguably clarified

It never touches the editor. Tabs are invisible to it. It gets *better* in one respect that is worth
stating: today, an agent editing a project's files on disk while the editor holds a different project
open is a confusing arrangement nobody can describe. With tabs, *"the MCP server is pointed at the
project in tab 2"* is a sentence that means something — which is what open question 6 in the phase
README is about.

> **Phase-42 note (2026-08-05).** [TALK-004](../phase-42-first-hour/TALK-004-THE-MCP-FRONT-DOOR.md)
> tested this split in conversation and it held — which settled a question that was going the other
> way. The instinct was that tabs would make `list_projects` the answer to *"which project should
> the agent edit?"*; it isn't, because the authoring server's `ProjectStore` is constructed once
> from `argv` at spawn ([ProjectStore.ts:107-123](../../../packages/noodl-mcp/src/project/ProjectStore.ts#L107))
> and no code path rebinds it. **The path in the registration command is already that answer**, and
> phase 42 makes it unambiguous by naming each registration after the project
> ([MCP-001](../phase-42-first-hour/MCP-001-CONNECT-AN-AI-AGENT.md)). So `list_projects` and the tab
> directory are **observe-side discovery** — genuinely broken by tabs — and this task should be read
> that way. Phase 42's settings section is the consumer that will want it.
>
> One more thing found while verifying: `nodegx-observe` **never reconnects** and the relay token is
> per-launch, so today a long-lived observe server dies at the next editor restart
> ([MCP-003](../phase-42-first-hour/MCP-003-OBSERVE-RECONNECTS.md) fixes it). Any port-discovery
> work here lands on top of that fix, not beside it.

### `nodegx-observe` — needs the port to become discoverable

The CLI already accepts `--port` ([cli.ts:33](../../../packages/nodegx-observe/src/cli.ts#L33)), so
the plumbing exists. What does not exist is any way for an agent to learn **which port is which
project**. Telling a user to run `lsof` is not an answer.

Note what *doesn't* change: the relay token is minted once per launch, process-wide
([relay-token.js](../../../packages/noodl-editor/src/main/src/relay-token.js)), so **one token
authenticates against every tab's relay**. No new auth surface.

## Scope

### In scope

- [ ] A **tab directory**: an app-wide way to ask "what is open?" answering
      `[{ tabId, projectName, projectPath, port, hasPreview }]`
- [ ] `nodegx-observe` learns to read it and accept `--project <name>` or `--tab <id>` in addition to
      `--port`
- [ ] With exactly one project tab open, `nodegx-observe` with no arguments still just works — the
      common case must not get harder
- [ ] With several open and no selector, it **lists them and stops** rather than guessing
- [ ] A `list_projects` MCP tool so an agent can discover and choose without shell access
- [ ] Confirm per-tab AI context works and is genuinely isolated (see below)

### Out of scope

- Merging the two MCP servers — settled as *split* in phase 36, open question 6
- Any new agent capability; this task is about addressing, not power

### How the directory is served — decide during the task

The token gate applies either way; the choice is about what is least surprising to a CLI that today
opens one socket:

| Option | Note |
|---|---|
| A `clients`-style command on **each** relay, answering about all tabs | Reuses the existing authenticated channel and the `cmd: 'clients'` precedent ([relay-server.js:119](../../../packages/noodl-editor/src/main/src/relay-server.js#L119)) — but you must already know a port to ask |
| One small app-wide discovery endpoint on a fixed port | Solves the bootstrap properly. ⚠️ It is a **new listening surface** and must carry the same token; phase 36's correction — *browsers do not apply the same-origin policy to WebSockets* — applies with full force |
| A file under `userData` listing open tabs | No new port at all, no auth question, trivially readable by a local agent. Staleness after a crash is the cost |

**Recommendation: the `userData` file**, with the relay `clients` command as the authoritative
follow-up once a port is known. It adds no attack surface, and phase 36 established that adding
listening surfaces here has historically been underestimated.

## Per-tab AI: verify, don't assume

[`AiAssistantModel.instance`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/AiAssistantModel.ts#L111)
is a module singleton, and [`router.tsx:160`](../../../packages/noodl-editor/src/editor/src/router.tsx#L160)
calls `resetContexts()` on every project change — so today, opening project B destroys your project A
conversation.

Per-renderer tabs should give per-project AI context **for free**. Two things to check rather than
assume:

- [ ] API credentials are app-wide ([AiCredentials.ts](../../../packages/noodl-editor/src/editor/src/store/AiCredentials.ts))
      and readable from every tab — a key entered in the launcher must work in a tab opened before it
- [ ] A long-running generation is not interrupted by tab switching. It should not be, since nothing
      unmounts — but this is exactly the assumption that would make suspension (open question 1)
      unsafe later, so establish the baseline now

## Success criteria

- [ ] `nodegx-observe` with one project open: unchanged behaviour, no new flags needed
- [ ] With three open: it lists projects with names and ports, and attaches to the one named
- [ ] An agent with both MCP servers can determine that a directory and an open tab are the same
      project
- [ ] Two tabs hold independent AI conversations, and switching between them preserves both
- [ ] No new unauthenticated listening surface (verify against phase 36's
      [OBS-004 notes](../phase-36-runtime-observability/OBS-004-NOTES.md))
