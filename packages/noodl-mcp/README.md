# @noodl/mcp — NodeGX MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server that exposes
NodeGX (OpenNoodl) **v2 project directories** to external AI agents: open,
inspect, author and validate projects programmatically — no editor process, no
whole-project context.

The design goal (Phase 13, Gate G1): *an agent can author a correct new page
having read only that page's parent, the relevant slice of the node catalog,
and the validator's feedback — never the entire project.*

## Quick start

```bash
# build once
npm run build --workspace @noodl/mcp

# read-only (default)
node packages/noodl-mcp/dist/noodl-mcp.cjs /path/to/project

# with authoring tools
node packages/noodl-mcp/dist/noodl-mcp.cjs /path/to/project --allow-writes
```

The `dist/noodl-mcp.cjs` bundle is self-contained (format engines and the
enriched node catalog are compiled in) — only Node ≥ 18 is required.

### Client configuration

Claude Code:

```bash
claude mcp add nodegx -- node /path/to/OpenNoodl/packages/noodl-mcp/dist/noodl-mcp.cjs /path/to/project --allow-writes
```

Generic MCP host config:

```json
{
  "mcpServers": {
    "nodegx": {
      "command": "node",
      "args": ["/path/to/dist/noodl-mcp.cjs", "/path/to/project", "--allow-writes"]
    }
  }
}
```

The target must be a **v2 project directory** (`nodegx.project.json` /
`components/_registry.json`). Legacy monolithic `project.json` projects are
detected and refused with a pointer to the editor's migration.

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
| `get_backend_permissions` | Full access-control config: CLPs, creator-owns, function/file rules, whether enforcement is active. |
| `list_backend_roles` / `list_backend_api_keys` | Roles + members; keys (names, scopes, status — never secrets). |
| `check_backend_access` | Server-side dry run: does a hypothetical principal get `find`/`get`/… on a collection, or call a function? Names the deciding rule. Verify a change took effect without a live session. |

### Author + backend permissions — write (only with `--allow-writes`)

| Tool | Purpose |
|------|---------|
| `create_component` | New component from nodes/connections. Validated before writing. |
| `update_component` | One component change: full `set` replacement **or** a batch of `operations` (`add_node`, `update_node`, `remove_node`, `add_connection`, `remove_connection`, `set_visual_roots`, `set_ports`, `set_component_info`). Supports `if_revision`. |
| `delete_component` | Refuses while referenced (lists usages) unless `force`. |
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
