# BST-003 — The on-ramp, before there is a project

**Status:** 📋 open · **Track: the editor** · **depends on BST-001 and BST-004** ·
⚠️ **contains a decision for Richard (§2)**

## The gap, stated precisely

Everything in this phase is worth nothing if nobody is ever told it exists.

Today the only surface that mentions MCP is a **collapsed** section inside Editor Settings
([`McpSettingsSection.tsx:72`](../../../packages/noodl-editor/src/editor/src/views/panels/SettingsPanel/sections/McpSettingsSection.tsx#L72)),
and with no project open its authoring half withholds its own command:

> *"Open a project first. This server is pointed at one project directory on disk, and that path is
> half the command."*
> ([`mcpCommands.ts:208-212`](../../../packages/noodl-editor/src/editor/src/views/panels/SettingsPanel/sections/mcpCommands.ts#L208))

and the section's prose says the rest out loud:

> *"Create the project here in NodeGX first, then point the agent at it. The authoring server works
> inside a project that already exists; it will not make you one."*
> ([`McpSettingsSection.tsx:79-80`](../../../packages/noodl-editor/src/editor/src/views/panels/SettingsPanel/sections/McpSettingsSection.tsx#L79))

**After BST-001 that sentence is false**, which makes this task partly a correction and not only an
addition.

## §1 — Where it goes

The launcher, on the projects page
([`ProjectsPage.tsx`](../../../packages/noodl-editor/src/editor/src/pages/ProjectsPage/ProjectsPage.tsx)),
**visible with zero projects** — which is the whole point, and the condition
[TALK-004's Q1](../phase-42-first-hour/TALK-004-THE-MCP-FRONT-DOOR.md#L66) could not satisfy when it
chose Settings ("the authoring command needs a project path"). That objection is spent: the bootstrap
command has no project path in it.

One card, beside the existing "new project" affordances, saying what it is for in the user's terms —
*build it by describing it, in Claude Code* — and one action.

⚠️ **The card does not disappear once projects exist.** The user who has one project and has never
connected an agent is the same user; they are just further along. What changes is the copy, and
whether the card is prominent or a row.

## §2 — ⚠️ The decision for Richard: what the action does

Three shapes, and they are genuinely different products.

| | What the user does | Cost | The objection |
|---|---|---|---|
| **A. Copy a command** | Copies, opens a terminal, pastes | Zero new mechanism — MCP-001's clipboard pattern verbatim | **It is the failure we are fixing.** The user who could not find Settings is not more likely to open a terminal. A designer on Windows may never have opened one |
| **B. Run it for them** | Clicks "Connect Claude Code". The editor spawns `claude mcp add …` and reports what happened | One spawn from main, on the `ServiceSupervisor` precedent | Requires the `claude` CLI on PATH. **A Claude Code desktop-app user may not have it**, and the failure has to be legible rather than a silent non-zero exit |
| **C. Write the config directly** | Same click; the editor edits the client's own config file | No CLI dependency at all | We would be writing another application's configuration by hand, to an undocumented schema we do not own, which can change under us. It is also the one option that can corrupt something the user cares about |

**My recommendation is B, with A as the visible fallback and C refused.**

B is the only one that answers the observed complaint, and its failure mode is honest: if `claude` is
not on PATH we say so and show the command, which is A. C trades a legible dependency for an
invisible one — the schema is not ours, and a malformed write breaks a tool the user was already
using successfully for other work. That is a much worse outcome than "we could not find the CLI".

⚠️ **B must report what it did, in the user's words, and where.** `--scope user` puts the
registration in every directory ([`mcpCommands.ts:70-79`](../../../packages/noodl-editor/src/editor/src/views/panels/SettingsPanel/sections/mcpCommands.ts#L70)),
which is right for a bootstrap server and is *not* what a user expects a button in an app to do. Name
the server, say it is available in any folder, and say how to remove it. A silent success is the
uninstall problem in [TASKS.md](TASKS.md#what-is-deliberately-not-here) arriving by a different door.

**This decision blocks the task and nothing else in the phase.** BST-001, 002, 004, 005 and 006 can
all proceed while it is open.

## §2a — F14, measured 2026-08-11 — and it moves the recommendation

⚠️ **The recommendation above was written before F14 was measured. Measuring it changed two of the
three rows.** What follows is what was actually observed, not what was expected.

**1. A desktop-app user does not have the CLI, and the docs say so outright.**
[The desktop quickstart](https://code.claude.com/docs/en/desktop-quickstart) states: *"The desktop
app includes Claude Code. You don't need to install Node.js or the CLI separately. **To use `claude`
from the terminal, install the CLI separately.**"* The app's own pitch is *"No terminal required."*
Confirmed against the installed bundle: `/Applications/Claude.app`
(`com.anthropic.claudefordesktop` 0.5.0) contains **no** `claude` binary, no bundled `node`, and
nothing claude-code shaped anywhere in it.

🔴 **So B's failure path is not the edge case — for this card's stated audience it is the default
case.** The designer who installed the desktop app because they did not want a terminal is precisely
the user who has no `claude` to spawn. The card would be A wearing a button.

**2. And B fails a second way, independently, even when the CLI *is* installed.** Under a
Finder-launched app's inherited `PATH=/usr/bin:/bin:/usr/sbin:/sbin`, `which claude` exits 1 on this
machine — the CLI is an npm global under nvm, and `.zshrc` is never read. This is **F79 exactly**,
one task later, about a different binary. It is *not* a reason to reject B: BST-004 already built the
two-stage probe that solves it (process PATH first, then `$SHELL -lic`, cached). Measured here at
**2.27s** for the login-shell probe. But it means B costs that machinery, not one `spawnSync`.

**3. 🔴 The objection to C is much weaker than stated, and this is the finding that matters.**
§2 rejects C as *"writing another application's configuration by hand, to an undocumented schema we
do not own."* Measured:

- `claude mcp add --scope user` writes **`~/.claude.json`**, top-level key **`mcpServers`** — verified
  by adding and removing a probe registration against the real CLI.
- The CLI **names the file on stdout**: `File modified: /Users/richardosborne/.claude.json`.
- The docs state that Desktop and CLI **share configuration**, *"MCP servers"* named explicitly, and
  the uninstall page documents `~/.claude.json` as a Claude Code file.

So it is Claude Code's own store, shared by both surfaces, named by the tool itself. Writing it is
still writing a file whose schema we do not control — that risk is real and unchanged — but it is a
long way from reverse-engineering a foreign app, and **it is the only one of the three options that
works for the user this card exists for.**

⚠️ **A consequence for whichever shape wins:** `buildBootstrapCommand` returns a *shell string*. C
needs the **parts** (`command`, `args`, `env`) to write JSON. That is a small refactor of one
function, not a new mechanism — but it is not free, and the string form is what is currently built
and tested.

**The measurement does not decide this on its own** — C's schema risk is a judgement call about what
breaks worst, and that is Richard's. It does establish that the ranking in §2's table was built on a
premise that did not survive contact.

## §3 — What the command is

One server, one name, no project path:

```
claude mcp add --scope user nodegx -- <runtime> <…>/noodl-mcp.cjs --allow-writes
```

- **`nodegx`, unsuffixed.** [TALK-004 decision 4](../phase-42-first-hour/TALK-004-THE-MCP-FRONT-DOOR.md#L150)
  makes per-project registrations carry the project slug, and that stays true for the settings
  section. This one is not per-project — there is no project — so it takes the plain name.
  ⚠️ **It therefore collides with nothing and is claimed forever**: `authoringServerName()` produces
  `nodegx-<slug>` ([`mcpCommands.ts:135-138`](../../../packages/noodl-editor/src/editor/src/views/panels/SettingsPanel/sections/mcpCommands.ts#L135)),
  never bare `nodegx`, so the namespaces do not overlap. Assert that.
- **`--allow-writes` is mandatory.** Without it `create_project` is not registered at all
  ([`server.ts:146`](../../../packages/noodl-mcp/src/server.ts#L146)) and the card connects a server
  that cannot do the thing the card promises.
- **`<runtime>` is BST-004's answer**, not `node`. That is why this task depends on it.
- The entry path comes from the resolver that already exists
  ([`resolveMcpServer.js`](../../../packages/noodl-editor/src/main/src/mcp/resolveMcpServer.js)) via
  the `mcp:front-door` IPC round trip
  ([`mcpFrontDoor.js`](../../../packages/noodl-editor/src/main/src/mcp/mcpFrontDoor.js)) — this task
  adds a row to that answer, it does not add a resolver.

⚠️ **Build the string in `mcpCommands.ts`**, beside the two that exist. Its header states the rule:
what the copied text *says* is the deliverable, and it is only assertable if building it needs neither
React nor a clipboard ([`mcpCommands.ts:1-27`](../../../packages/noodl-editor/src/editor/src/views/panels/SettingsPanel/sections/mcpCommands.ts#L1)).
The shell-quoting is already solved there, including the Windows-path case
([`:141-161`](../../../packages/noodl-editor/src/editor/src/views/panels/SettingsPanel/sections/mcpCommands.ts#L141)) — do not write a second quoter.

## §4 — The settings section stops contradicting us

Two edits, and they are not cosmetic:

1. The prose at
   [`McpSettingsSection.tsx:78-80`](../../../packages/noodl-editor/src/editor/src/views/panels/SettingsPanel/sections/McpSettingsSection.tsx#L78)
   says the server will not make you a project. **After BST-001 it will.** Rewrite it to say what is
   now true: this command binds one project; the bootstrap server on the launcher makes new ones.
2. The `unavailable` string for a closed project
   ([`mcpCommands.ts:208-212`](../../../packages/noodl-editor/src/editor/src/views/panels/SettingsPanel/sections/mcpCommands.ts#L208))
   is still correct — that command genuinely does need a path — but it should point at the launcher
   card rather than dead-ending.

## Acceptance

- The launcher, **with zero projects**, offers the connection. Drive it on a profile with an empty
  project list, not by reasoning about the empty state.
- The action succeeds on a machine with the `claude` CLI, and the registration is usable from an
  **unrelated working directory** — that is what `--scope user` is for and it is the half that
  silently fails if the scope is wrong.
- On a machine **without** the CLI, the failure names the reason and falls back to a copyable command
  that is correct. Verify by running it.
- What was registered, where, and how to remove it is stated after success.
- `nodegx` never collides with a `nodegx-<slug>` registration; a project named `nodegx` does not
  produce one. (`projectSlug` already handles the `observe` collision the same way —
  [`mcpCommands.ts:120-134`](../../../packages/noodl-editor/src/editor/src/views/panels/SettingsPanel/sections/mcpCommands.ts#L120).)
- The command string is built in `mcpCommands.ts` and unit-tested there, DOM-free.
- The settings section no longer claims the server cannot create a project.
- **The consequence, not the mechanism:** after the click, a fresh Claude Code session in a folder
  with nothing to do with NodeGX can answer *"what can you do with NodeGX?"* from the server's own
  instructions. A successful `claude mcp add` is not the deliverable.

## Register

| # | Finding | State |
|---|---|---|
| F10 | The launcher has never had an MCP surface; the only one is a collapsed Settings section, gated on an open project | ✅ verified, [`McpSettingsSection.tsx:72`](../../../packages/noodl-editor/src/editor/src/views/panels/SettingsPanel/sections/McpSettingsSection.tsx#L72), [`mcpCommands.ts:208`](../../../packages/noodl-editor/src/editor/src/views/panels/SettingsPanel/sections/mcpCommands.ts#L208) |
| F11 | TALK-004's reason for choosing Settings over the launcher — "the authoring command needs a project path" — **does not apply to the bootstrap command** | ✅ verified, [TALK-004 Q1](../phase-42-first-hour/TALK-004-THE-MCP-FRONT-DOOR.md#L66) |
| F12 | The settings copy actively tells the user the opposite of what BST-001 makes true | ✅ verified, [`McpSettingsSection.tsx:79-80`](../../../packages/noodl-editor/src/editor/src/views/panels/SettingsPanel/sections/McpSettingsSection.tsx#L79) |
| F13 | Bare `nodegx` cannot collide with per-project names, which are always `nodegx-<slug>` | ✅ verified, [`mcpCommands.ts:135-138`](../../../packages/noodl-editor/src/editor/src/views/panels/SettingsPanel/sections/mcpCommands.ts#L135) |
| F14 | Whether a Claude Code **desktop app** user has the `claude` CLI on PATH | ✅ **measured 2026-08-11 — they do not.** See §2a. The docs say it in as many words, and the bundle confirms it |
| F85 | 🔴 **Even a machine that *has* the CLI cannot spawn it from a Finder-launched editor.** Under the inherited `PATH=/usr/bin:/bin:/usr/sbin:/sbin`, `which claude` exits 1 on this machine — the CLI is an npm global under nvm. This is **F79 exactly**, and BST-004 already built the fix | ✅ measured; reuse BST-004's two-stage probe |
| F86 | 🟠 **`--scope user` writes Claude Code's own `~/.claude.json` → top-level `mcpServers`**, and the CLI prints `File modified: /Users/richardosborne/.claude.json` on stdout. Desktop and CLI **share MCP configuration** (documented). This is not "another application's undocumented schema" | ✅ measured, and it weakens §2's objection to C |
