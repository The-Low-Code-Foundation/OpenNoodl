# noodl-mcp — Tool Surface Design (SUB-008)

This document is the design artifact required by SUB-008 step 1: the tool surface,
the reasoning behind its granularity, and a hand-written transcript of a realistic
agent session that the surface was revised against.

## Design constraints

1. **The essential property** (from the task spec): an agent must be able to author
   a correct child page having read only that page's parent, the catalog, and the
   validator's feedback — never the entire project.
2. **Component-level granularity.** The v2 format stores one component per
   directory; the editor thinks in components; Phase 15's review UI will display
   component-level changes. Tools therefore read and write whole components.
   Within a single `update_component` call, a *batch of graph operations* is
   allowed — this is still one reviewable component-level change, but saves the
   agent from re-uploading a 200-node graph to add one button (the "hundred
   round-trips" failure mode).
3. **Errors are the API.** Every mutating tool validates before writing and
   returns SUB-006 diagnostics (with `suggestion`/`alternatives`) on rejection.
   Nothing is ever half-written.
4. **Token economy.** The enriched catalog is 1.45 MB. No tool ever returns it
   whole: `list_node_types` returns compact rows; `get_node_type` returns full
   entries for named types only.

## Identity model

| Form | Example | Where used |
|------|---------|------------|
| `path` (canonical tool identifier) | `Pages/Settings` | every tool argument, registry keys, directory names |
| `legacyName` | `/Pages/Settings` (root: `/#App`) | `component.json`'s `path` field; **the `type` of a component-instance node** |

Tools accept either form as input (a leading `/`/`#` is normalised away), and
every component-shaped response carries both. Responses that show component
instances point out that the node `type` is the legacy name.

### Node ids are allocated, not accepted (AAQ-011/F12)

A node id you send is a *request*. If the project already uses it in another
component, the write reallocates it (`title` → `title-2`) and rewrites every
reference inside that component — `parent`, `children[]`, `visualRoots[]`,
`connections[].fromId/toId` — before validating or writing anything. The
response then carries `remappedNodeIds` and `remapNote`; **use those ids in
follow-up calls**, or re-read with `get_component`.

Why the write does this rather than refusing: the `duplicate-node-id` rule
(SUB-012) is project-wide, and the write gate is component-scoped, so the rule
could only ever fire *after* a clean-looking write. Making a collision
unreachable is cheaper than making a component-scoped gate express a
project-wide rule, and it asks nothing of the caller — an agent cannot know
which ids are free without reading every component first. It is also what the
editor already does: `NodeGraphModel.rekeyAllIds()` on every copy/import path.

Two things this does **not** do. Ids the component already had on disk are never
touched, whatever they collide with — a pre-existing collision is not this
write's doing, and the gate's policy is "don't make it worse". And two nodes
sharing an id *within one payload* stay a hard refusal: that component's own
connections would be genuinely ambiguous, and nothing can guess which node a
wire meant.

## Tool surface (v1)

### Read (always registered)

| Tool | Purpose |
|------|---------|
| `get_project_info` | Project metadata, settings, root component, routes, style names, stats, server mode. The orientation call — always cheap. |
| `list_components` | Registry listing: `path`, `legacyName`, `type`, node/connection counts. Filter by `type` / `pathPrefix`. |
| `get_component` | One component's full graph: meta, ports, nodes, connections, visualRoots + a `revision` token. Option `include_usages` lists components that instantiate it. |
| `search_project` | Find node instances across components by `nodeType`, `text` (labels/string parameters), `pathPrefix`. Returns locations, not graphs. |
| `list_node_types` | Compact catalog rows (typeName, displayName, category, one-line summary, visual?) filtered by `category`/`query`. ~135 rows max, a few KB. |
| `get_node_type` | Full enriched entries for up to 5 named types: ports with types + semantics, whenToUse, runtimeBehavior, related nodes, example ids, typecast rules for its port types. |
| `list_examples` | Browse the 40 validated graph examples: id, title, demonstrates. Filter by `nodeType`/`query`. |
| `get_example` | One example's full v2 fragment (nodes + connections) — known-good wiring to imitate. |
| `explain_component` | Structured description of a component: visual tree, logic nodes, data flow, ports, component refs. For summarisation without raw JSON. |
| `validate_component` / `validate_project` | SUB-006 diagnostics on demand (`strict` option). |

### Author (registered only with `--allow-writes`)

| Tool | Purpose |
|------|---------|
| `create_component` | Create `path` with nodes/connections/visualRoots (+ optional ports metadata). Validates structurally + semantically; rejects with diagnostics; updates `_registry.json`. |
| `update_component` | Either `set` (full replacement of nodes/connections/visualRoots) or `operations` (batched deltas: `add_node`, `update_node`, `remove_node`, `add_connection`, `remove_connection`, `set_visual_roots`, `set_ports`). Optional `if_revision` for optimistic concurrency. |
| `delete_component` | Refuses when other components instantiate it (lists them) unless `force`. |

**Write-validation policy:** structural Ajv check first, then the semantic
validator with `unknown-node-type` **promoted to error** (agents authoring fresh
graphs are exactly the population for whom a typo'd type must hard-fail; the
diagnostic carries a `suggestion`). Per-call escape hatch `allow_unknown_types`
for module-provided node types the catalog cannot enumerate. Semantic errors
reject the write; warnings/infos are written and reported.

### Not included, deliberately

- `set_parameter`-style single-value tools (too fine — covered by `update_node` op).
- `modify_project` / multi-component transactions (too coarse; unreviewable).
- Project-level settings writes, asset upload, model files (v1 scope; the read
  side exposes settings so agents can see them).

## Concurrency safety

- Every `get_component` response carries `revision` — a content hash of the three
  component files. Mutating calls accept `if_revision` and refuse on mismatch
  with a `conflict` error telling the agent to re-read.
- Independently of revisions, the server re-stats target files immediately before
  writing and refuses if they changed since the server last read them (an open
  editor autosaving, git checkout, another agent).
- All writes are temp-file + atomic rename; the registry is updated after
  component files; a failed validation writes nothing.
- Deleting a component removes only its three files (and the directory if empty)
  — child component directories nested beneath it are untouched.
- This is conflict *detection*, not locking: the editor keeps its own in-memory
  state and can still save over an MCP write. The README instructs users to keep
  projects under git and avoid simultaneous editor + agent writes to the same
  component.

## Code sharing (spec step 2 decision)

`noodl-mcp` imports the pure engines **from `noodl-editor` sources by relative
path** — exactly the pattern the repo's existing CLIs use (`scripts/validate-project.ts`).
The standalone artifact is produced by esbuild, which bundles those sources (and
the enriched catalog JSON) into one self-contained CJS file, so nothing is
duplicated and there is a single source of truth. Extracting `io/ + schemas/ +
validation/ + versioning/` into a shared `@noodl/project-format` package remains
the right eventual refactor (tracked as future work) but is mechanical and
orthogonal to this task; bundling gives the same no-duplication guarantee today
without churning the editor's webpack build.

## Hand-written transcript: "add a Settings page to this app"

The surface was designed by writing this session first and adjusting until it
read sensibly. Agent goal: *"Add a Settings page with a back button to my app."*

```text
1. get_project_info
   → { name: "demo-app", rootComponent: { path: "App", legacyName: "/#App" },
       components: 4, mode: "read-write", routes: [...],
       styles: { colors: ["Primary", ...], textStyles: ["Title", ...] } }

2. list_components { type: "page" }
   → [ { path: "Pages/Home", legacyName: "/Pages/Home", type: "page",
         nodeCount: 12, connectionCount: 6 } ]

3. get_component { path: "Pages/Home" }
   → full graph + revision "a1b2c3…". Agent sees the page pattern:
     a "Page" root node, a "Page Inputs" node, Group layout, a Button whose
     click drives a "Navigate" node (parameters.target = "/Pages/…").

4. get_node_type { typeNames: ["Page", "Navigate", "Button", "Text"] }
   → ports with semantics ("Navigate.target: the page component to navigate
     to"), whenToUse, example ids.

5. get_example { id: "navigation-basic" }        (optional deepening)
   → known-good Page/Router/Navigate wiring fragment.

6. create_component
   { path: "Pages/Settings",
     nodes: [ { id: "page", type: "Page", parameters: { title: "Settings" } },
              { id: "layout", type: "Group", parent: "page", … },
              { id: "title", type: "Text", parent: "layout",
                parameters: { text: "Settings" } },
              { id: "back", type: "Buton", parent: "layout",
                parameters: { label: "Back" } },
              { id: "nav", type: "RouterNavigate",
                parameters: { target: "/Pages/Home" } } ],
     connections: [ { fromId: "back", fromProperty: "onClick",
                      toId: "navv", toProperty: "navigate" } ] }
   → REJECTED, nothing written:
     ERROR [unknown-node-type] node back: unknown type "Buton"
       → did you mean `net.noodl.controls.button`?
     ERROR [dangling-connection] connection to "navv": no such node
   (The diagnostics alone are enough to fix the call — no re-read needed.
    Port-name checks additionally fire for static-port nodes; nodes that
    create ports at runtime are skipped, per SUB-006's false-positive-zero
    design.)

7. create_component { …same, type: "net.noodl.controls.button", toId: "nav"… }
   → { created: "Pages/Settings", revision: "d4e5f6…",
       validation: { errors: 0, warnings: 0 } , registry: updated }

8. update_component                       (wire Home → Settings)
   { path: "Pages/Home", if_revision: "a1b2c3…",
     operations: [
       { op: "add_node", node: { id: "settingsBtn", type: "Button",
           parent: "topBar", parameters: { label: "Settings" } } },
       { op: "add_node", node: { id: "navSettings", type: "Navigate",
           parameters: { target: "/Pages/Settings" } } },
       { op: "add_connection", connection: { fromId: "settingsBtn",
           fromProperty: "Click", toId: "navSettings",
           toProperty: "navigate" } } ] }
   → { updated: "Pages/Home", revision: "0718aa…", validation: clean }

9. validate_project {}
   → 0 errors. Done. Whole session read one page, one catalog slice, one
     example — never the project.
```

Observations that shaped the surface (revisions made while writing this):

- Step 3 must return a `revision` or step 8 cannot be safe → revisions ride on
  `get_component`, not a separate `stat` tool.
- Step 6's rejection is only useful if port diagnostics carry `alternatives` —
  already SUB-006 behavior; the server must not swallow them.
- Step 8 must not require re-uploading Home's whole graph → `operations` batch.
- Steps 4–5: an agent asking "how do I navigate?" needs semantics + a validated
  example, not 1.45 MB of catalog → named-type fetch + example ids.
- `Navigate.target` takes the **legacy name** — responses expose `legacyName`
  everywhere so the agent never has to guess the `/`-prefix rule.
