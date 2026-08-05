# FH-018 — The Config node is inert, and the endpoint behind it is public and unfiltered

**From:** Richard, 2026-08-05: *"the 'Config' node is still in the front end node picker… it was a
way to grab secrets from the Noodl Cloud Service… does that work with our backend? Not sure it was
even a safe thing to have."*
**Status:** open, unowned. Two defects in one node; the second is a security defect.

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
([HttpServer.ts:419](../../../packages/nodegx-backend/src/server/HttpServer.ts#L419)).

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

## The decision this needs first

Richard's instinct — *"not sure it was even a safe thing to have"* — is the right starting point.
Three honest options:

- **(a) Delete the Config node.** Front-end config that holds secrets is a bad idea by construction:
  anything the browser can read, the user can read. Secrets belong in cloud functions, reached
  through a function call. Removes a node, a metadata key, an endpoint and a security question.
- **(b) Keep it, split it honestly.** `/config` serves only non-secret params publicly (a real
  server-side `masterKeyOnly` filter), secrets are readable **only from inside a cloud function**
  (which already runs as admin over the loopback). Needs a writer and a UI — a Config section in
  the Backend panel — plus the schema plumbing that has been dead since WF-007.
- **(c) Cloud-only.** Drop it from the browser picker entirely; it stays a cloud-function node for
  server-side settings. Cheapest honest fix.

My lean: **(c) now, (a) as the likely end state.** The front-end use case ("pull an API key into
the browser for an authenticated user") should not be revived — it was never safe.

## Slices, once the decision is made

1. Whichever option: the **server-side filter on `/config`** lands regardless, because the endpoint
   should never be able to serve a value the caller isn't entitled to.
2. Remove or repair the dead `configSchema` path — a declared-and-never-assigned field that silently
   disables a shipped node is its own defect, whatever happens to Config.
3. If (b): the writer (admin route + editor UI), the schema round-trip, and a test that a
   `masterKeyOnly` param is absent from an unauthenticated `GET /config`.
4. Delete the node from the browser index (option (c)/(a)) — remember the **cloud picker is a
   committed snapshot**, so `npm run cloud-library:generate` must run and `cloud-library:check` is a
   gate.

## Done when

- `curl http://<backend>/config` with no credentials cannot return a value marked secret — proved
  by driving it, not by reading the filter.
- The Config node either offers real keys or is gone; it is never present-and-inert.
