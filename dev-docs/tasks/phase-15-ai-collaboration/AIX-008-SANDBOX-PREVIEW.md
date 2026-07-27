# AIX-008: Sandbox Preview of Authored Work

## Metadata

| Field | Value |
|-------|-------|
| **ID** | AIX-008 |
| **Phase** | Phase 15 — AI Collaboration Experience (Revival Track C) |
| **Priority** | 🔴 Critical |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 1–2 weeks |
| **Prerequisites** | AIX-002 (authoring loop, staging, preview document); AIX-003 (review document); SUB-009's headless-export findings are informative but not required |
| **Branch** | `cline-dev` (per project convention) |
| **Recommended executor** | 🟠 Opus — spans the editor, the WS viewer protocol, and the runtime's network layer; the hard part is judgement about what "isolated" must mean |

## Objective

Show the user what the AI actually **built** — rendered, running, and interactive — before asking them to accept or reject it, using sample data so that a missing backend, an empty table, or a login wall can never hide the result.

## Background

AIX-002 stages an authored component and shows it as a node graph on a read-only canvas
(`AuthoringPreviewDocument`). That is the right *second* thing to show and the wrong first thing.
The graph answers "how does this work"; it does not answer "is this the thing I asked for". A user
who types *"a profile page with an image uploader, name change, email password reset"* and is shown
nineteen nodes and ten wires is being asked to accept a change they cannot see.

The blocker is structural, not cosmetic: the staged candidate is a detached `ComponentModel` that
never enters `ProjectModel` — deliberately, because that is what makes "reject leaves no trace"
the absence of a call rather than a promise. The viewer only ever renders the real project export,
so there is nothing to render the candidate into.

Two things make this cheap to fix correctly:

1. **The viewer protocol is already per-client.** `ViewerConnection.export()` sends a full
   `Exporter.exportToJSON` **per `clientId`** (`_exportToClient`), and viewer clients mint their own
   id and register over the WS relay. A second `<webview>` is therefore a second, independently-fed
   client — it can be handed a *different* export without the live preview or the project noticing.
2. **A project export is a pure function of a `ProjectModel`.** The sandbox export is built from a
   throwaway clone with the candidate added and set as root. The live project is never mutated, so
   the reject contract survives untouched.

The data half is the part with no existing seam. It gets one: the sandbox webview installs a
network shim over `fetch`/`XMLHttpRequest` before the runtime starts, so every backend-shaped
request — Parse-style `CloudStore` (XHR), `UserService` sessions (XHR), BYOB (`fetch`), REST/HTTP
nodes — is answered from an in-memory dataset. One seam instead of edits to a dozen node types.

## Current State

- `AuthoringPreviewDocument` is a full-surface read-only `NodeGraphEditor` and nothing else.
- `PreviewGraphBuilder` streams nodes onto that canvas as the agent writes them (this is good and
  is kept — it is the one thing this product can show that a code generator cannot).
- The rendered preview in the editor is an Electron `<webview>` at `localhost:8574`, driven by
  `ViewerConnection` over the WS relay in `main/src/web-server.js`.
- Sessions live in `localStorage` under `Parse/<appId>/currentUser`; the sandbox and the real
  preview share an origin, so storage isolation is not automatic.
- Nothing in the runtime knows what a sandbox is; there is no sample-data facility anywhere.

## Desired State

When the agent stages a candidate, the authoring surface shows the **rendered component** beside
its graph, running against sample data, with Accept / Reject / Review unchanged in the top bar.

- A split view: rendered app on the left, node graph on the right, draggable splitter.
- The rendered pane is a real runtime — clickable, typing works, navigation works.
- Data is **always sandboxed by default**: a fake signed-in user, fake records, no network egress.
  A toolbar toggle switches the same pane to the real backend when the user wants that.
- Sample data is plausible, not lorem, wherever the authoring model supplied it; inference fills
  every gap so the preview never renders empty.
- A logic-only component (nothing visual to render) says so plainly instead of showing white.
- Mutations inside the sandbox (create/update/delete, sign-in, uploads) succeed against the
  in-memory dataset and are discarded when the preview closes.

## Scope

### In Scope
- [ ] Per-client sandbox export in `ViewerConnection` (sandbox clients excluded from normal export)
- [ ] Sandbox export builder: cloned project + staged candidate as root, cloud services blanked
- [ ] Sandbox client identification (`clientId` prefix), no WS relay protocol change
- [ ] Split preview/graph layout in `AuthoringPreviewDocument` with a persisted splitter position
- [ ] Storage/session isolation for the sandbox webview (Electron `partition`)
- [ ] Runtime sandbox network shim: Parse REST, BYOB REST, cloud functions, files, sessions
- [ ] In-memory dataset with working CRUD for the life of the preview
- [ ] Fake signed-in user, so auth-gated UI renders its signed-in state
- [ ] Editor-side dataset synthesis: which classes and fields does this graph actually read?
- [ ] Value synthesis by field-name heuristics (title, email, price, date, image, …)
- [ ] Optional `sample_data` on `submit_component`, merged over inference
- [ ] "Sample data / Real backend" toggle
- [ ] Specs for the export builder, the dataset synthesiser, and the network shim's routing

### Out of Scope
- Previewing arbitrary existing components on demand (this is about *staged* work; the general
  "preview any component in isolation" feature is a natural follow-up, and this task should leave
  it one small step away)
- Persisting sample data into the project
- Sample data for third-party APIs beyond a generic synthesized 200
- Multi-page navigation *between* staged components (only one is ever staged)
- Replacing the existing full-project preview panel

## Technical Approach

### Sandbox export

`sandboxExport.ts` (editor) builds, per staged candidate:

```
Exporter.exportToJSON(project, { useBundles: false })   // the project's own export
  + exportComponent(reconstructLegacyComponent(files))  // the same path accept uses
  → components = [...without the same name, candidate] // covers update mode
  → rootComponent / rootNode = the candidate's visual root
  → routerIndex re-derived from the component set actually running
  → metadata.sandbox = { classes, user }                // what the shim serves
```

Splicing the project's export rather than cloning a `ProjectModel` keeps this cheap enough to redo on
every refine round, and keeps `ProjectModel` entirely out of it.

Backend configuration is deliberately **left intact** rather than blanked. Blanking it would make the
loud-failure paths RUN-004 added fire ("no backend configured") and change how the graph behaves;
leaving it means nodes take exactly the code path they take in the real app, and the shim answers.
Nothing escapes, because the shim is installed before the runtime exists and answers *every*
unrecognised endpoint too.

### Client identification

A viewer client mints its own `clientId`. In sandbox mode it uses `sandbox-<sessionId>` instead of
a guid, so the editor recognises it from the `nodelibrary` message with no change to the relay in
`web-server.js` and no new message types. `ViewerConnection` keeps a `sandboxProviders` map;
`export()` skips any client with a provider, and `_exportToClient` sends the provider's JSON.

### Network shim

Installed in the sandbox webview *before* the runtime is constructed, over `window.fetch` and
`window.XMLHttpRequest`. Routing:

| Request shape | Answer |
|---|---|
| `…/classes/<Class>` (GET/POST/PUT/DELETE) | dataset query / in-memory CRUD |
| `…/aggregate/<Class>` | count/aggregate over the dataset |
| `…/login`, `…/users/me`, `…/users` | the fake session user |
| `…/functions/<name>` | `{ result: {} }` plus a console note |
| `…/files/<name>` | a placeholder URL |
| BYOB `/items/<Class>`, `/api/<Class>` | dataset query / in-memory CRUD |
| same-origin static assets | passed through untouched |
| anything else | synthesized 200 with an empty object |

### Dataset synthesis

Editor-side, because the editor has the graph, the catalog and the styles; the runtime only serves.

1. **Which classes** — `collection`/`table` parameters on data nodes in the candidate and its
   dependency closure.
2. **Which fields** — `prop-<field>` connection endpoints, `{{field}}` in text parameters, explicit
   field lists on BYOB nodes.
3. **Values** — the agent's `sample_data` when present, else heuristics by field name.

### Prompt / tool change

`submit_component` gains an optional `sample_data` object: class name → up to five records. It is
optional, capped, and described in one line, because AIX-007 measured what schema growth costs.

## Success Criteria

- [ ] Staging a component shows it rendered, without the user doing anything
- [ ] A project with no backend configured still renders populated lists and cards
- [ ] An auth-gated component renders its signed-in state
- [ ] Rejecting leaves no trace in the project, the file system, or the live preview
- [ ] The live preview panel and the sandbox never contaminate each other (session, storage, data)
- [ ] A logic-only candidate says so instead of rendering blank
- [ ] The toggle reaches the real backend and back without a reload loop
- [ ] Suite green; new specs cover export building, dataset synthesis, and shim routing

## Risks

| Risk | Mitigation |
|---|---|
| Sandbox writes into the shared `localStorage` session and signs the real preview in or out | Electron `partition` on the sandbox webview — separate storage entirely |
| A second preview surface silently steals `PreviewTokenInjector`'s single webview reference, and the live preview stops tracking token changes | The injector now holds a *set* of surfaces; `clearWebview(webview)` removes one |
| Incremental model-change messages broadcast to *all* viewer clients reach the sandbox | Harmless (same ids, same components) and the sandbox re-exports on candidate change; documented, not defended |
| Sample data flatters — the component "works" in preview and fails on real data | The toggle is one click, and the sandbox labels itself in the toolbar at all times |
| `sample_data` inflates every authoring call | Optional, capped at five records per class, one-line description; measure against AIX-007's baseline |
