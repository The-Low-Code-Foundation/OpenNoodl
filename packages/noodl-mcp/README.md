# @noodl/mcp — NodeGX MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server that exposes
NodeGX (OpenNoodl) **v2 project directories** to external AI agents: open,
inspect, author and validate projects programmatically — no editor process, no
whole-project context.

The design goal (Phase 13, Gate G1): *an agent can author a correct new page
having read only that page's parent, the relevant slice of the node catalog,
and the validator's feedback — never the entire project.*

## Quick start

**The easiest way to get this right is not to type it.** NodeGX's
**Settings → Editor → Connect an AI agent** has a Copy button that emits the command below with
your installation's path and your open project's path already filled in, and a per-project server
name (MCP-001). Everything here is the same thing, written out.

There is no URL and nothing to start: this is a **stdio** server that your MCP client spawns
itself. Create the project in NodeGX first, then point the agent at it — this server authors
inside a project that already exists; it will not make you one.

### Client configuration

Claude Code:

```bash
claude mcp add --scope user nodegx-<project-slug> -- node <path-to>/noodl-mcp.cjs <project-dir> --allow-writes
```

Two details that are not decoration:

- **`nodegx-<project-slug>`, not `nodegx`.** The server is bound to the project path in argv at
  spawn time and never rebinds, so one registration is one project. A fixed name means the second
  project you add silently replaces the first. The editor slugs the project **directory basename**
  for this.
- **`--scope user`.** `claude mcp add` defaults to `local`, which ties the registration to the
  directory you happened to run it in — from anywhere else it looks as though it vanished.

Generic MCP host config, for clients that are not Claude Code:

```json
{
  "mcpServers": {
    "nodegx-<project-slug>": {
      "command": "node",
      "args": ["<path-to>/noodl-mcp.cjs", "<project-dir>", "--allow-writes"]
    }
  }
}
```

Drop `--allow-writes` for a read-only server.

### Where the bundle is

Shipped inside the app by MCP-002:

```
macOS     /Applications/NodeGX.app/Contents/Resources/noodl-mcp/noodl-mcp.cjs
Windows   %LOCALAPPDATA%\Programs\NodeGX\resources\noodl-mcp\noodl-mcp.cjs
Linux     /opt/NodeGX/resources/noodl-mcp/noodl-mcp.cjs   (deb)
```

A Linux AppImage mounts itself at a different path on every launch, so there is no fixed answer
there — take the path from the settings section, which asks the running app.

### Contributors, working in a checkout

```bash
# build both MCP bundles once
npm run build:sidecars

# read-only (default)
node packages/noodl-mcp/dist/noodl-mcp.cjs /path/to/project

# with authoring tools
node packages/noodl-mcp/dist/noodl-mcp.cjs /path/to/project --allow-writes
```

The `dist/noodl-mcp.cjs` bundle is self-contained (format engines and the
enriched node catalog are compiled in) — only Node ≥ 18 is required.

### The project has to be v2

The target must be a **v2 project directory** (`nodegx.project.json` /
`components/_registry.json`). Legacy monolithic `project.json` projects are
detected and refused with a pointer to the editor's migration — and the settings
section performs the same check before it offers you a command, so a legacy
project is a message on screen rather than a spawn failure in your terminal.

## Component identity

| Form | Example | Where |
|------|---------|-------|
| `path` | `Pages/Home` | canonical tool identifier, registry keys, directories |
| `legacyName` | `/Pages/Home` | `component.json`'s `path` field; **the `type` of a node that instantiates the component** |

Every tool accepts either form; responses carry both.

## Tools

### Read (always available)

| Tool | Purpose |
|------|---------|
| `get_project_info` | Metadata, settings, root component, routes, style names, stats, server mode. Call first. |
| `list_components` | Registry rows (path, legacyName, type, counts). Filters: `type`, `path_prefix`. |
| `get_component` | Full graph of one component + `revision` token. `include_usages` lists instantiations. |
| `search_project` | Locate nodes by `node_type` and/or `text` across components without reading graphs. |
| `explain_component` | Structured description: visual tree, logic nodes, data flow, component refs. |
| `list_node_types` | Compact catalog rows with one-line summaries. Filters: `category`, `query`, `visual_only`. |
| `get_node_type` | Full enriched entries (ports + semantics, whenToUse, runtime behavior, example ids) for up to 8 named types. |
| `list_examples` / `get_example` | Browse and fetch validated example graph fragments. |
| `validate_component` / `validate_project` | SUB-006 semantic diagnostics on demand (`strict` promotes unknown types to errors). |

### Backend permissions — read (always available)

Unlike every other tool, these talk to a **running** `nodegx-backend` over HTTP
(discovered under `~/.noodl/backends/`, admin credential read from the backend's
own `secrets.json`). See [BAK-003](../../docs/runtime/BACKEND-ACCESS-CONTROL.md).

| Tool | Purpose |
|------|---------|
| `list_backends` | Configured local backends: id, name, port, reachable, whether the admin credential is present. |
| `list_backend_processes` | What is actually running, from the durable spawn records (AAQ-011/F13): pid, port, which spawner owns it (this server or the editor), and whether that owner is still alive. `reap: true` also stops the ones no live owner claims. |
| `get_backend_permissions` | Full access-control config: CLPs, creator-owns, function/file rules, whether enforcement is active. |
| `list_backend_roles` / `list_backend_api_keys` | Roles + members; keys (names, scopes, status — never secrets). |
| `check_backend_access` | Server-side dry run: does a hypothetical principal get `find`/`get`/… on a collection, or call a function? Names the deciding rule. Verify a change took effect without a live session. |
| `get_backend_ops_config` | Operational config (BAK-009): rate-limit policy per route class, trusted proxies, log level, CORS origins, audit retention, metrics. Read this when a call comes back 429 — it says which class the route is in and what its budget is. |
| `query_backend_audit` | The privileged-action trail: permission/role/key edits, schema changes, backups and restores, config edits, admin logins and failures — with actor, origin, outcome, and the request id that ties each to the access log. |

### Author + backend permissions — write (only with `--allow-writes`)

| Tool | Purpose |
|------|---------|
| `create_component` | New component from nodes/connections. Validated before writing. |
| `update_component` | One component change: full `set` replacement **or** a batch of `operations` (`add_node`, `update_node`, `remove_node`, `add_connection`, `remove_connection`, `set_visual_roots`, `set_ports`, `set_component_info`). Supports `if_revision`. |
| `delete_component` | Refuses while referenced (lists usages) unless `force`. |
| `create_plan` / `stage_plan_operation` / `apply_plan` / `discard_plan` | AIX-011 project-scope staging: declare a multi-component change as an ordered plan (creates before the updates that use them), stage each operation's graph **in memory** — validated against the project *plus* the plan's other staged operations, so an update may instantiate a sibling create — then `apply_plan` writes the complete set at once. Skips are the explicit partial apply and must be dependency-closed; discarding (or never applying) leaves the project byte-identical. Doc operations are plannable but refuse to apply until the project-docs write path (AIX-009) lands. Plans live in the server process. |
| `provision_backend` / `stop_backend` | AAQ-011/F13 — **create, start and bind a backend for this project**, pre-seeding the collections you name, so an external agent can build a full-stack app end to end. Reuses this project's backend of the same name rather than making a second, adopts it if already running, and refuses (changing nothing) if the project already points elsewhere. ⚠️ The one effect here that is not undoable, which is why it is a tool of its own and not a plan operation: `apply_plan` promises all-or-nothing, and a running process and a created database are neither. Lifecycle: the backend carries `--parent-pid`, the owner heartbeats a durable record, and a `noodl-mcp` that is killed outright has its backends reaped by the next one to start. |
| `set_collection_permissions` / `reset_collection_permissions` | Lock/open a collection (per-op rules + creator-owns), or revert to defaults. Rejected with the reason on a malformed rule or a system collection. |
| `create_backend_role` / `delete_backend_role` / `assign_role_user` | Manage roles and membership (`assign_role_user` with `remove: true` revokes). |
| `create_backend_api_key` / `revoke_backend_api_key` | Issue a scoped key (secret returned once) or revoke one. |

**Write policy.** Every write is validated first — JSON-schema structure, then
the semantic validator with unknown node types promoted to errors (pass
`allow_unknown_types: true` for module-provided nodes). New errors reject the
write with diagnostics that carry a `suggestion` and valid `alternatives`;
nothing is written on rejection. Warnings are written and reported.
Pre-existing errors in a component never block editing it ("don't make it
worse" gate).

**Concurrency.** Optimistic: pass the `revision` from `get_component` as
`if_revision` to fail cleanly on drift; the server additionally re-stats files
before writing and refuses if anything changed since it read them. Writes are
atomic (temp file + rename). This is conflict *detection*, not locking — keep
projects under git and avoid pointing an editor and a writing agent at the
same component simultaneously.

## Example session

Goal: *add a Settings page with a back button, linked from Home.*

```
→ get_project_info                       {}
← { name: "Demo App", rootComponent: { path: "App" }, mode: "read-write", … }

→ list_components                        { "type": "page" }
← { components: [ { path: "Pages/Home", legacyName: "/Pages/Home", … } ] }

→ get_component                          { "path": "Pages/Home" }
← { revision: "a4a9260622c4", nodes: [ …Page → Group → Text/Button…,
    { id: "nav", type: "RouterNavigate" } ], connections: [ btn.onClick → nav.navigate ] }

→ get_node_type                          { "type_names": ["Page", "RouterNavigate", "net.noodl.controls.button"] }
← ports with semantics, whenToUse, example ids

→ create_component
  { "path": "Pages/Settings",
    "nodes": [
      { "id": "page",   "type": "Page",  "parameters": { "title": "Settings" } },
      { "id": "layout", "type": "Group", "parent": "page" },
      { "id": "title",  "type": "Text",  "parent": "layout", "parameters": { "text": "Settings" } },
      { "id": "back",   "type": "net.noodl.controls.button", "parent": "layout", "parameters": { "label": "Back" } },
      { "id": "nav",    "type": "RouterNavigate", "parameters": { "target": "/Pages/Home" } } ],
    "connections": [ { "fromId": "back", "fromProperty": "onClick", "toId": "nav", "toProperty": "navigate" } ] }
← { created: "Pages/Settings", legacyName: "/Pages/Settings", revision: "…",
    validation: { summary: { errors: 0, warnings: 0 } } }

→ update_component                       (wire Home → Settings; one reviewable batch)
  { "path": "Pages/Home", "if_revision": "a4a9260622c4",
    "operations": [
      { "op": "add_node", "node": { "id": "settingsBtn", "type": "net.noodl.controls.button",
          "parent": "layout", "parameters": { "label": "Settings" } } },
      { "op": "add_node", "node": { "id": "navSettings", "type": "RouterNavigate",
          "parameters": { "target": "/Pages/Settings" } } },
      { "op": "add_connection", "connection": { "fromId": "settingsBtn",
          "fromProperty": "onClick", "toId": "navSettings", "toProperty": "navigate" } } ] }
← { updated: "Pages/Home", revision: "…", applied: [ … ], validation: clean }

→ validate_project                       { "strict": true }
← { summary: { errors: 0, … } }
```

A rejected write teaches instead of failing opaquely:

```
→ create_component { "path": "X", "nodes": [ { "id": "g", "type": "Grup" } ] }
← isError: { error: { code: "validation-failed",
     details: { readable: [ "ERROR [unknown-node-type] … did you mean `Group`?" ],
                newErrors: [ { code: "unknown-node-type", suggestion: "Group", … } ] } } }
```

## Architecture

- `src/project/ProjectStore.ts` — v2 directory access, registry maintenance,
  revisions, drift detection, atomic writes.
- `src/graph.ts` — hierarchy reconciliation (`parent`/`children` double
  bookkeeping) and the batched update operations.
- `src/validate.ts` — write gate: schemas → semantic validator → baseline diff.
- `src/catalog.ts` — projections of the enriched node catalog.
- `src/describe.ts` — `explain_component`.
- `src/tools/*.ts` — MCP tool registrations; `src/server.ts`, `src/cli.ts`.

Format logic is **not duplicated**: the io engines, schemas and validator are
imported from `noodl-editor`'s pure modules (`src/editor/src/{io,schemas,validation}`)
and bundled by esbuild — the same single source of truth the editor uses (see
`docs/DESIGN.md` for the full decision record and tool-surface rationale).

## Development

```bash
npm test --workspace @noodl/mcp        # jest (29 tests, incl. end-to-end MCP client)
npm run typecheck --workspace @noodl/mcp
npm run build --workspace @noodl/mcp   # esbuild → dist/noodl-mcp.cjs
```

## Current limitations

- File-based only; no live sync with a running editor (a bridge is future work —
  the editor holds its own in-memory state and can overwrite MCP writes on save).
- No project-level settings/styles/routes writes, asset upload, or model files in v1.
- Read-side supports v2 directories only; migrate legacy projects with the editor first.
- `get_node_type` with several types can exceed an MCP host's tool-result cap
  (~126 KB for 7 types in the SUB-010 demo, and the host's "overflow saved to a
  file" fallback is useless to a filesystem-less agent). Ask for 1–2 types per
  call until a compact/ports-only projection is added (SUB-010 friction report).
