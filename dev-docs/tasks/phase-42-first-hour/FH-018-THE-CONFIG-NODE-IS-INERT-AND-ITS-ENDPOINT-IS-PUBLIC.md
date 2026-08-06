# FH-018 — The Config node is inert, and the endpoint behind it is public and unfiltered

**From:** Richard, 2026-08-05: *"the 'Config' node is still in the front end node picker… it was a
way to grab secrets from the Noodl Cloud Service… does that work with our backend? Not sure it was
even a safe thing to have."*
**Status:** **CLOSED 2026-08-06.** Two defects in one node; the second is a security defect.
Both fixed — the node is deleted and `GET /config` now filters by caller.

## Defect 1 — the node can never offer a key (inert)

The Config node builds its key dropdown from the project's `dbConfigSchema` metadata
([dbconfig.ts:113-125](../../../packages/noodl-runtime/src/nodes/std-library/data/dbconfig.ts#L113-L125)).
That metadata is written by `SchemaHandler._store()` from `this.configSchema`
([schemahandler.ts:109](../../../packages/noodl-editor/src/editor/src/utils/schemahandler.ts#L109)).

**`configSchema` is declared and never assigned.** It is `public configSchema: TSFixme;` at
[schemahandler.ts:61](../../../packages/noodl-editor/src/editor/src/utils/schemahandler.ts#L61) and
the only other mention in the whole editor is the line that stores it. `fetchBuiltInSchema()`
returns `schema.tables` — collections only, no config. The Parse Dashboard page that used to supply
it was deleted with the rest of the framework (WF-007).

So `dbConfigSchema` is always `undefined`, the key dropdown is always empty, and the node cannot be
configured. It ships in **both** pickers (browser and cloud — it is `DbConfig`, category *Cloud
Services*, in the 57).

> **Correction (2026-08-06, while building):** "inert" is true of *authoring*, not of *running*.
> `setup()` — the whole dropdown mechanism — is behind `editorConnection.isRunningLocally()`, so a
> deployed graph never runs it. A node with a `configKey` already stored in `project.json` resolves
> that key against whatever `/config` returns, in the browser and in a cloud function. Four shipped
> prefabs are in exactly that state (`library/prefabs/{send-grid,email-verification,mail-gun,stripe}`,
> 9 nodes between them, all reading API keys). So the node could not be *newly configured*, but it
> was not dead code — which makes the security defect below live, not theoretical.

## Defect 2 — `GET /config` is public and returns everything

The backend does serve the endpoint. It reads `<dataDir>/config-params.json` and returns the whole
file:

```ts
config(res) { sendJSON(res, 200, { params: this.getConfigParams() }); }
```
([parse-wire.ts:285-287](../../../packages/nodegx-backend/src/server/parse-wire.ts#L285-L287),
source at [service.ts:633-642](../../../packages/nodegx-backend/src/service.ts#L633-L642))

and it is registered as
`{ method: 'GET', pattern: 'config', access: { kind: 'public' }, … }`
([HttpServer.ts:425](../../../packages/nodegx-backend/src/server/HttpServer.ts#L425) — the doc
originally said 419; the other five citations in this file all checked out).

The handler takes only `res` — it has no principal, so it **cannot** filter by caller even in
principle. ⚠️ **Parse excluded `masterKeyOnly` params from the public `/config` response. We do
not.** Our `masterKeyOnly` survives in two cosmetic places only: it hides keys from the editor's
port list ([dbconfig.ts:125](../../../packages/noodl-runtime/src/nodes/std-library/data/dbconfig.ts#L125))
and the deployer strips them from the *exported schema*
([deployer.ts:86-88](../../../packages/noodl-editor/src/editor/src/utils/compilation/build/deployer.ts#L86-L88)).
Both hide keys from a UI. Neither hides a value from the network.

**Today this is harmless because nothing writes the file** — no admin route, no editor UI; the only
other code that knows the filename is `BackupManager`'s `CONFIG_FILES`
([BackupManager.ts:59](../../../packages/nodegx-backend/src/backup/BackupManager.ts#L59)). It stops
being harmless the moment anyone hand-writes an API key into it, which is exactly what the node
invites and what the old workflow trained people to do.

## The decision — **(a), delete the node outright**

**Richard, 2026-08-06:** delete the Config node. Front-end config that holds secrets is unsafe by
construction — anything the browser can read, the user can read. Secrets belong in cloud functions.
(The two options not taken were: *(b)* keep it and split public/secret params behind a writer and a
Backend-panel UI; *(c)* drop it from the browser picker and keep it as a cloud-only node.)

## What shipped

1. **The server-side filter on `/config` — landed regardless of the node's fate.** The handler now
   takes the whole `RequestContext` rather than just `res`, so it has a principal.
   `config-params.json` entries may declare their own visibility:

   ```jsonc
   { "welcome": "hi",                                          // public
     "stripeKey": { "value": "sk_live_…", "masterKeyOnly": true } }  // admin / master key only
   ```

   A secret entry is **omitted, not blanked**, so an unprivileged caller does not learn the key
   exists. `secret: true` is accepted as a synonym. Only an object that *explicitly carries the
   flag* is treated as a wrapper — `{"theme":{"value":"dark"}}` is left alone. There is no dev-open
   escape hatch: `devOpenActive` relaxes the route gate, never this.
   (`server/parse-wire.ts` `visibleConfigParams`, `server/HttpServer.ts` route line.)
2. **The dead `configSchema` path is gone**, not repaired: the field, the
   `setMetaData('dbConfigSchema', …)` writes on both branches of `_store()`, the `dbConfigSchema`
   key on `ProjectMetaData`, and the deployer's `masterKeyOnly` strip (which only ever hid *key
   names* from an exported bundle, never a value).
3. **The node is deleted** — `dbconfig.ts`, its `require` in `noodl-runtime.ts` (which removes it
   from the browser index **and** the cloud picker, since that list reaches every runtime), its
   entry in `nodelibraryexport.ts`'s *Cloud Data* group, its enrichment file, its
   `derive-encoding` note, and the `DbConfig` node in the `cloud-create-record-with-upload`
   catalog example. All three committed snapshots regenerated.
4. **`ConfigService` is deleted too**, along with the `await ConfigService.instance.getConfig()`
   warm-up at the top of every cloud-function request (`noodl-viewer-cloud/src/nodes/cloud/request.ts`).
   It existed only to prime the Config node's synchronous getter; its remaining effect was one HTTP
   round-trip per request that could fail the whole function.

## The endpoint: **kept, registered, public, filtered**

The test was "nothing in the repo can call it **and** we owe no one a compatibility contract". The
first half is now true; the second is not:

- `GET /config` is one of the five Parse-wire routes WF-004 enumerated as the service's contract
  (`HttpServer.ts` module doc, `WF-004-BACKEND-SERVICE.md`), and BAK-003's route table classifies it
  deliberately: *"Public. It is client-boot config; cloud functions await it on every run."*
- Already-deployed artifacts call it. The shipped bundle in
  `packages/nodegx-backend/deploy/artifact/backend/cli.js` awaits `getConfig()` inside
  `sendRequest` — deleting the route 404s that call and fails **every request** to an
  already-deployed cloud function. Deleting a node cannot do that; deleting a route can.
- `config-params.json` is an operator-owned file already inside the backup contract
  (`BackupManager`'s `CONFIG_FILES`), independent of any node.

It keeps `access: { kind: 'public' }` and is marked SELF-ENFORCING, the same posture as `/metrics`
and `/realtime`: *reachable without credentials* and *returns everything* were always two separate
decisions, and only the first was ever made. Requiring admin instead would make a client-boot
endpoint useless to the only caller it exists for, while the property this task demands is
delivered by the filter, not by the access class.

## Existing projects that contain a Config node

They load. Neither half is fatal, and this was verified in the source, not assumed:

- **Editor:** `NodeGraphNode.type` falls back to `NodeLibrary.getUnknownNodeType(typename)`, and
  `evaluateHealth` raises the `node-missing-type` warning at `level: 'error'`. The canvas paints a
  red dashed placeholder with a warning icon, the node keeps its position, label, parameters and
  saved ports so its wires still draw, and `toJSON()` writes `this.typename` — an open/save
  round-trip is lossless, and the node *heals* if the type ever comes back.
- **Runtime:** `NodeScope.createNodeFromModel` catches the register miss, `console.error`s, sends a
  `nodelibrary-unknown-node` warning and returns — the node is skipped and the import continues.
  Connections to it fail the same soft way.
- This is what `dev-docs/reference/COMPATIBILITY-POLICY.md` (2026-07-30) already permits: *"a loud
  load failure is acceptable"*, reversing PLAT-003's "deprecate, never delete".

⚠️ **Four shipped prefabs are now in that state** — `send-grid` (1 node), `email-verification` (3),
`mail-gun` (2), `stripe` (3), each inside a `…/Settings` cloud-function component feeding an API key
to a Component Output. Left loud rather than rewired to a `String` node, which would ship an empty
API key that looks like it works. Recorded in `library/prefabs/AUDIT.md` §6; the replacement is
CWF-009's `Secret` node and these should be rewired in the pass that lands it.

## Done when

- ✅ `curl http://<backend>/config` with no credentials cannot return a value marked secret — five
  driven cases in `packages/nodegx-backend/tests/config-visibility.test.ts` (anonymous, bad
  credential, session token, master key, bearer token), asserting on the raw response **text** so
  the secret is provably not in the bytes.
- ✅ The Config node is gone; it is never present-and-inert.

## Loose end

`DELIBERATELY_UNBOUND` in `packages/nodegx-backend-contract/src/nodeCapabilities.ts` still carries a
`DbConfig` row. Nothing checks it against the catalog, so it is stale prose rather than a defect —
left because a concurrent session had uncommitted work in that exact file.
