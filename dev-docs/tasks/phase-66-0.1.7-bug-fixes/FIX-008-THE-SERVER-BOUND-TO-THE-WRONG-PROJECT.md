# FIX-008 — The server bound to the wrong project

**Report 5** · Tier 1 · Effort **S+S/M** (minimum), **M** (full)

> *"I clicked the 'Connect MCP' in the launcher, and it threw an error about already being
> connected … then Claude Code complained constantly about the MCP being bound to a different
> project."*

## This is not one bug — it is three, and all three are pinned

**Physical evidence on this machine:** `~/.claude.json` user scope holds `nodegx` (unbound
bootstrap) **and** `nodegx-puppy-test-3` (hard-wired to one project, at user scope — visible in
every folder). Of 44 project folders in `NodeGX test projects/`, exactly **one** has a `.mcp.json`.
That is the whole bug in two facts.

### 1. "Already connected" is a bad message, not an error

`ConnectAgentCard` → `useConnectAgent.ts:64-91` → `main/src/mcp/connectBootstrapServer.js:202`.
`claude mcp add` **refuses an existing name** ("MCP server already exists in user config", CLI
2.1.228); `connectBootstrapServer.js:242-249` surfaces that as a red failure — deliberately no
file-write fallthrough (`:20-24`). Nothing pre-reads the existing registration (the config parse at
`:129-156` already exists and isn't consulted); there is no `already-connected` card state
(`ConnectAgentCard.tsx:40`); state resets to `idle` on every mount (`useConnectAgent.ts:36`). The
requested end state was already true — the user was shown a failure for a success.

### 2. Existing projects never get a `.mcp.json`

BST-005's per-project write **exists and is correct** (`authoringServerName()` →
`nodegx-<slug>`, `mcpCommands.ts:188-189`; render/never-overwrite/gitignore in
`models/template/agentConfig.ts:232-268`) — but runs on **project creation only**
(`LocalProjectsModel.ts:237-242`, called solely from `newProject`; MCP `createProject.ts:612`).
There is **no open-project hook**; backfill-on-open was left optional in BST-005 §4 and never taken
up (`NOTES-BST-002-005.md` §4 row 6). The gitignore banner even claims "created **or opened**"
(`agentConfig.ts:124-128`) — currently false. So 43 of 44 projects on this disk open in Claude Code
with only the user-scope servers visible: the unbound `nodegx` and someone else's
`nodegx-puppy-test-3`.

### 3. The Settings command manufactures wrongly-scoped globals

Settings → "Connect an AI agent" copies a command with `--scope user` (`MCP_SCOPE`,
`mcpCommands.ts:133` — shared by the bootstrap and per-project rows) — which is how
`nodegx-puppy-test-3` became global. And `CLAUDE.md`'s own escape hatch (`agentConfig.ts:205-211`)
points users at exactly that command. Worse: a user-scope `nodegx-<slug>` **silently shadows** the
project-scope twin of the same name (F94, measured — the project entry is simply absent from
`claude mcp list`).

A wrongly-bound server is nearly undetectable in-session: the bound directory appears **only** in
the `initialize` instructions (`instructions.ts:59`); `get_project_info` returns the name but not
the directory (`tools/read.ts:89-105`); every write it accepts lands in the other project,
validated and silent.

## Fix direction

| # | Fix | Where | Effort |
|---|---|---|---|
| A | **Idempotent, honest Connect.** Pre-read `~/.claude.json`; identical entry → `ok: 'already-registered'` with a "Connected" card state; different entry (stale path) → offer remove + re-add. Never render the CLI's refusal raw. | `connectBootstrapServer.js`, `useConnectAgent.ts`, `ConnectAgentCard.tsx` | S |
| B | **Backfill `.mcp.json` + `CLAUDE.md` on project open.** One call to `installProjectAgentConfig` on the open seam, honouring the existing never-overwrite rule (`agentConfig.ts:243-249`). Fix the false gitignore banner. Closes every pre-BST-005 project. | `LocalProjectsModel` / open seam | S–M |
| C | **Per-project Settings command becomes `--scope project`.** Split `MCP_SCOPE`: bootstrap stays `user` (it has no folder); per-project writes the project's own `.mcp.json`. Update `McpSettingsSection.tsx:163`, copy, `tests-unit/mcp-001`; add a cleanup hint for existing user-scope `nodegx-<slug>` entries. | `mcpCommands.ts` | M |
| D | **A door into an existing project for the bootstrap server** — an `open_project(dir)` tool calling `binding.bind()` (the mechanism exists and already re-briefs: `createProject.ts:520-535`, `disclosure.ts:183-206`; it is merely gated to newly-created dirs). Minimum: `NO_PROJECT_REFUSAL` and `list_projects` emit the exact `claude mcp add --scope project …` line for the directory instead of prose. | `noodl-mcp` | M (note-only S) |
| E | **`get_project_info` returns the bound directory** so a mis-bound server is detectable from any tool call. | `tools/read.ts:89-105` | S |

**Minimum that closes the report: A + B.** A+B+C stops it recurring. D removes the class.

## Acceptance criteria

1. Clicking Connect twice shows "Connected — registered as `nodegx`" the second time, not a red error.
2. Opening a pre-existing project (no `.mcp.json`) in the editor writes `.mcp.json` + `CLAUDE.md`
   (never overwriting either if present), and a subsequent Claude Code session in that folder lists
   `nodegx-<slug>` as connectable.
3. The Settings per-project command registers at project scope; `claude mcp list` from that folder
   shows the project entry.
4. `get_project_info` output contains the bound directory.
5. MCP suite green (`@noodl/mcp`), `tests-unit/mcp-001` updated, and the BST-005 acceptance
   ("same two files, same shape, both creators") re-verified.

## Open questions

- Which seam do **all** open routes cross (launcher row, recents, `projectFromDirectory`,
  drag-drop, clone)? Backfill must sit on the one they share or it recreates "depends how you
  opened it".
- Posture: is writing into a folder the user merely *opened* acceptable? (Both files are
  ignored/machine-local; BST-005 chose create-only deliberately — this reverses that, say so.)
- Cleanup of existing stale user-scope registrations (`nodegx-puppy-test-3` is visible in every
  folder forever until removed) — a "registered elsewhere" list in Settings?
- With C, two NodeGX servers can be visible in one session (project's own + a stale global bound
  elsewhere). Better or worse for the model? Untested — measure once before shipping C's copy.
