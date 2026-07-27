# DEP-001: Runtime Backend Config — Un-freeze the Endpoint

## Metadata

| Field | Value |
|-------|-------|
| **ID** | DEP-001 |
| **Phase** | Phase 26 — Deployment (Track K) |
| **Tier** | 1 — the constraint |
| **Priority** | 🔴 Critical (everything else in the phase is shaped by this) |
| **Difficulty** | 🟢 Low — the change is small; the care is in not breaking four existing consumers |
| **Estimated Time** | 2–3 days |
| **Prerequisites** | none |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟠 **Opus 4.8** — small surface, but it sits under every data node in the runtime and the failure mode is silent |

## Objective

Let a deployed NodeGX app read its backend endpoint from a file served alongside it, instead of only
from a value frozen into the bundle at export time — so one build can be deployed to more than one
host, and a deployed app can be re-pointed without the editor.

## Background

`external/deploy/index.js` is a two-line file:

```js
window.projectData = {{#export#}};
```

The export's `metadata.cloudservices` — `{ endpoint, appId, type }` — is inlined there at build time
by the deployer, and `index.html` hands the whole object straight to the runtime:

```html
window.Noodl._viewerReact.renderDeployed(root, __noodl_modules, window.projectData);
```

From there `NoodlRuntime.setData()` → `graphModel.importEditorData()` populates the metadata map, and
every consumer reads it lazily:

| Consumer | File |
|---|---|
| Parse-wire record nodes | [`api/cloudstore.js:36`](../../../packages/noodl-runtime/src/api/cloudstore.js#L36) |
| Cloud Function node | [`data/cloudfunction2.ts:53,199`](../../../packages/noodl-viewer-react/src/nodes/std-library/data/cloudfunction2.ts#L53) |
| Deprecated cloud function node | [`data/cloudfunction.ts:261`](../../../packages/noodl-viewer-react/src/nodes/std-library/data/cloudfunction.ts#L261) |
| User/auth service | [`user/userservice.ts:173`](../../../packages/noodl-viewer-react/src/nodes/std-library/user/userservice.ts#L173) |
| Config service | [`api/configservice.ts:58`](../../../packages/noodl-runtime/src/api/configservice.ts#L58) |
| DB collection nodes (react to changes) | [`dbcollectionnode2.ts:883`](../../../packages/noodl-runtime/src/nodes/std-library/data/dbcollectionnode2.ts#L883) — `metadataChanged.cloudservices` |

That last row matters: the runtime **already** has an event for this value changing, because the
editor pushes metadata updates over the editor connection during development
(`onMetaDataUpdateReceived`). The nodes are built to tolerate the endpoint changing under them. This
task reuses that seam rather than inventing one.

### Why the frozen value is a real problem, not a theoretical one

- **Two environments need two builds.** BAK-007 shipped dev→prod promotion at the data layer, tested
  round-trip. The app half cannot follow, because the artifact has one host baked in.
- **Provisioning has to precede export.** For DEP-006 the user's server does not exist yet when they
  press Deploy, so its address cannot be in the bundle. Either provisioning blocks the build, or the
  build is portable. Portable is better.
- **WF-003's build id is a content digest.** Two deploys of the same app to two hosts currently
  produce two different digests for what is logically one artifact, which makes `rollback <id>`
  ambiguous across environments.

## Current State

| File | What it does |
|---|---|
| `external/deploy/index.js` | Inlines `window.projectData` including `metadata.cloudservices` |
| `external/deploy/index.html` | Calls `renderDeployed(root, modules, window.projectData)` on `DOMContentLoaded` |
| `external/deploy/index.json` | The file manifest `loadDeployIndex()` reads ([`deployer.ts:79`](../../../packages/noodl-editor/src/editor/src/utils/compilation/build/deployer.ts#L79)) |
| `external/ssr/` | The SSR/SSG layout — server at root, browser app in `public/` |
| `utils/compilation/build/deployer.ts` | `environment` → the baked `cloudservices` metadata |
| `noodl-runtime/noodl-runtime.js:305` | `setData()` — the load path |
| `noodl-runtime/src/models/graphmodel.js:244` | `setMetaData()` — emits `metadataChanged.<key>`, and **no-ops on an unchanged value** |

There are also stale duplicate directories in the tree — `external/deploy 2/`, `external/ssr 3/` —
left by an earlier tooling accident (noted as an open item in RUN-002). They are not this task's
problem but **must not be edited by mistake**; changing `deploy 2/index.html` will appear to do
nothing forever.

## Desired State

### 1. A config file, fetched before the app boots

The deployed folder gains `nodegx-config.json` at its root:

```json
{
  "cloudservices": {
    "endpoint": "https://apps.example.com",
    "appId": "…",
    "type": "nodegx"
  }
}
```

`index.html` fetches it before calling `renderDeployed`, and merges it over
`window.projectData.metadata`:

- Fetched from a **relative** path (`nodegx-config.json`, honouring `%baseUrl%`) so it works under a
  sub-path deployment.
- `cache: 'no-store'`, so re-pointing a deployment does not require a cache bust.
- **404 is success**, not failure — it means "use the baked value", which is exactly what today's
  behaviour is. An app deployed by an older editor, or to a host that does not serve the file, must
  boot unchanged.
- A malformed or non-JSON body is a **console warning and the baked value**, never a blank page. A
  misconfigured web server that answers `index.html` for every path is the common case here, and it
  must degrade to today's behaviour rather than breaking the app.
- The fetch must not meaningfully delay first paint. It is one small same-origin request before
  boot; measure it and record the number.

### 2. The default file points where the export already pointed

The deployer writes `nodegx-config.json` containing exactly the environment it would have baked, and
**still bakes it too**. Belt and braces: the file is an override, not a replacement, so a deployment
that loses the file behaves as it does today.

### 3. Overriding is a documented, supported operation

`docs/runtime/SELF-HOSTING.md` gains a short section: to point a deployed app at a different backend,
edit `nodegx-config.json` and reload. No rebuild. This is also the mechanism DEP-005 uses to deploy
one artifact to two targets.

### 4. SSR/SSG gets the equivalent

The SSR layout runs a Node server, so its override source is the environment:
`NODEGX_CLOUDSERVICES_ENDPOINT` / `_APP_ID` (falling back to the same JSON file next to the server).
The server must apply the override to the project data it renders with **and** serve the resulting
`nodegx-config.json` to the client, so hydration does not disagree with the server render. A
hydration mismatch on the endpoint would surface as data loading twice from two different hosts —
name this in the task notes; it is the sharpest edge in the task.

### 5. BYOB backends are in scope too

The same file may carry a `backendServices` key overriding BYOB endpoints (Directus/Supabase/
Pocketbase), which are baked by the same mechanism. Structure the merge generically over metadata
keys with an **allow-list** — `cloudservices` and `backendServices` only. A config file that can
override arbitrary project metadata is a config file that can rewrite the app.

## Implementation Steps

1. **Confirm the load path before changing it.** Add a temporary log in `setData()`, deploy a folder,
   and verify `metadata.cloudservices` arrives from `window.projectData` and nowhere else. The
   editor-connection path (`onMetaDataUpdateReceived`) must be confirmed inert in a deployed build.
2. **Write the merge helper** in the viewer package with the allow-list, the 404-is-fine rule, and
   the malformed-body rule. Unit-test it against: missing file, empty body, HTML body, valid config,
   config with an unknown key, config with only `appId`.
3. **Wire `index.html`** to `await` the fetch before `renderDeployed`, and add the file to
   `external/deploy/index.json` so the deployer copies it.
4. **Write the file in the deployer** from the same `environment` it bakes.
5. **SSR/SSG equivalent**, including the served-to-client half and a hydration test.
6. **Docs** in `docs/runtime/SELF-HOSTING.md` and the deploy folder README.
7. **Verify for real**: deploy a project with record nodes against a local backend, change
   `nodegx-config.json` to a second backend on a different port with different data, reload, and
   confirm the app renders the *second* backend's records. Screenshot both.

## Success Criteria

- [ ] A deployed app with no `nodegx-config.json` behaves byte-for-byte as it does today.
- [ ] Editing `nodegx-config.json` and reloading re-points the app, proven with two backends holding
      different records — not by inspecting a variable.
- [ ] A malformed config file logs a warning and the app still loads against the baked endpoint.
- [ ] A config file containing a key outside the allow-list is ignored, and a test asserts it.
- [ ] The SSR server applies the override and serves a client config that agrees with its own render;
      a hydration test covers the disagreement case.
- [ ] Added boot latency measured and recorded.
- [ ] `docs/runtime/SELF-HOSTING.md` documents the override.

## Out of Scope

- Any UI for editing the config in the editor. DEP-004 owns per-target endpoints.
- Signing or authenticating the config file. It is served from the same origin as the app; anyone who
  can rewrite it can rewrite `index.html`.
- Removing the baked value. It stays as the fallback.

## Traps

- **`setMetaData` no-ops on an unchanged value** (`graphmodel.js:246`, a `JSON.stringify` compare).
  If the override happens to equal the baked value, no `metadataChanged` event fires. That is correct
  but will confuse anyone debugging by watching for the event.
- **`external/deploy 2/` and `external/ssr 3/` are stale duplicates.** Edit `deploy/` and `ssr/`.
- **`%baseUrl%` substitution** is how the existing script tags resolve; the fetch must use the same
  mechanism or sub-path deployments will 404 in a way that silently falls back and looks like the
  feature is broken.
- **The dev/preview path must not regress.** In the editor preview the endpoint arrives over the
  editor connection, and the local backend's port is dynamic. The override must not fire, or must
  lose to, the live editor connection — otherwise a stale config file in a project folder poisons
  development.
