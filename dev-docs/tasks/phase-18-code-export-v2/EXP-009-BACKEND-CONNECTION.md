# EXP-009 — The exported app talks to its deployed backend

**Status:** 🟢 Built and driven, session 33 (2026-08-28) — AC1/2/3/5/6/7 verified, AC4 open.
See [EXP-009-CLIENT-TARGET-OUTPUT.md](./EXP-009-CLIENT-TARGET-OUTPUT.md) for the design and
§8 below for what the drive measured and what remains.
**Depends on:** EXP-002 (the call sites already exist and are already typed)
**Supersedes:** phase-18 README's inherited out-of-scope line
*"Database/cloud node full export — generated as typed API-service stubs, not working backends."*

---

## §1 What is wrong today

Export a project with a database and you get this:

```ts
// src/api/puppies.ts — emitted today
export async function fetchPuppies(): Promise<Puppy[]> {
  return [];
}
export async function createPuppy(data: Partial<Puppy>): Promise<Puppy> {
  throw new Error('createPuppy is not connected to a backend yet');
}
```

```ts
// src/api/session.ts — emitted today
export function useSession(): { authenticated: boolean; user: SessionUser | null } {
  return { authenticated: false, user: null };
}
```

Every doc comment says *"Connect this to your own data source"*. The exported app therefore
renders an empty list, refuses every login, and silently fails every write — while the project it
came from works perfectly, against a NodeGX backend the project **already knows the address of**.

This was a deliberate 2025 scoping decision, inherited from `dev-docs/future-projects/
CODE-EXPORT-STUDY.md` and phase 7. It made sense when "export" meant *leaving Noodl*. It is wrong
for NodeGX, where export means *taking your app, and your backend comes with it*.

## §2 The export already has everything it needs

Nothing here requires new information from the user. It is all on disk:

| what | where |
|---|---|
| endpoint, appId, instance id, backend type | `nodegx.project.json` → `metadata.cloudservices` |
| collection schemas (names, columns, types) | `metadata.dbCollections` → already becomes the `Puppy` interface |
| every call site, typed, with its verb | `ProjectPlan.queries` / `.mutations` / `.sessionCalls` |

A real `Puppy test 3` carries:

```json
"cloudservices": {
  "instanceId": "backend_msjck0y2ukxwv",
  "endpoint": "http://localhost:8581",
  "appId": "backend_msjck0y2ukxwv",
  "type": "nodegx"
}
```

## §3 The wire format, read from the runtime — not invented

`packages/noodl-runtime/src/api/backends/ParseWireAdapter.ts` is what the running app uses. The
export must speak the same protocol or the backend will not answer it:

- **Base:** `endpoint` + a Parse-shaped path — `/classes/<Collection>`, `/classes/<Collection>/<id>`,
  `/users`, `/login`, `/functions/<name>`.
- **Headers:** `X-Parse-Application-Id: <appId>` and `Content-Type: application/json`.
- 🔴 **`X-Parse-Master-Key` is NEVER exported.** It is a server credential. `ParseWireAdapter:280`
  carries a hard-won comment about it: when the key was `undefined`, `new Headers()` sent the
  literal string `"undefined"` on every request and `nodegx-backend` locked the caller out for 300
  seconds as a failed credential attempt. An exported frontend is a browser bundle — a master key
  in it is a breach, not a bug.
- **Session:** the auth adapter (`ParseAuthAdapter.ts`, `SessionStore.ts`) holds a session token;
  the exported client needs the same token lifecycle for `useSession` to mean anything.
- **Query encoding:** `restSerialize.ts` (173 lines) is the `where`/`order`/`limit` serialiser.
  Port it, do not re-derive it — the filter shapes in `QueryPlan` were built against it.

**Port the protocol, not the adapter.** `ParseWireAdapter` is 735 lines because it also carries
XHR, an event bus, subscriptions and file refs. The exported client needs `fetch`, the header pair,
the path shapes and the token — a few hundred lines.

## §4 What gets emitted

Replace the stub bodies. Everything around them — the interfaces, the call sites, the typed
signatures, the `Failure` paths the graph already handles — stays exactly as it is today. That is
why this is tractable: **EXP-002 already built the shape; only the body is a lie.**

```ts
// src/api/client.ts — new, one per app
const ENDPOINT = import.meta.env.VITE_NODEGX_ENDPOINT ?? 'http://localhost:8581';
const APP_ID   = import.meta.env.VITE_NODEGX_APP_ID   ?? 'backend_msjck0y2ukxwv';
```

```ts
// src/api/puppies.ts — emitted after EXP-009
export async function fetchPuppies(): Promise<Puppy[]> {
  return query<Puppy>('Puppy', { /* the QueryPlan's where/order/limit */ });
}
```

**The endpoint is an environment variable with the project's value as the default.** A developer
who inherits the repo points it at staging by setting `VITE_NODEGX_ENDPOINT`, and it runs against
the project's own backend out of the box. Hard-coding it makes the repo un-deployable; omitting the
default makes the export not-working-on-arrival, which is the thing we are fixing.

Also emit `.env.example` and say in the README what the two variables are.

## §5 Acceptance criteria

1. **A user sees their own data.** Export `Puppy test 3` against a running `nodegx-backend`,
   `npm install && npm run dev`, and the Landing page lists the puppies that are in the database.
   Not a fixture — the same rows the editor's preview shows.
2. **Auth round-trips.** Log in on the exported Admin Login page with a real user; the Admin page
   stops redirecting; log out returns it. `useSession()` reflects a real session token.
3. **Writes land.** Create a puppy in the exported app; it appears in the editor's data browser.
4. **Cloud functions are callable.** A `Cloud Function` node's call reaches `/functions/<name>`
   and returns its result. (This also moves `Cloud Function` out of the picker gap — EXP-011.)
5. **No master key, no admin credential, no service token in the bundle.** Grep the built output.
   This is a security acceptance criterion, and it fails the task if it fails.
6. **The endpoint is configurable** without editing generated code.
7. **A project with no backend still exports and builds** — it emits no client and no `.env`, and
   says so in the report. Do not make the happy path mandatory.

## §6 Deliberately out of scope for this task

- **Realtime / `Subscribe To Changes`.** The runtime's subscription layer
  (`api/backends/realtime/`) is a websocket protocol of its own. Separate slice; defers named.
- **File upload / `Cloud File` / `Sign File URL`.** They need the file-ref encoding
  (`fileRef.ts`) and a storage round-trip. Separate slice.
- **BYOB (bring-your-own-backend) targets** — Directus and the REST adapters in
  `api/backends/RestDataAdapter.ts`. NodeGX's own backend first; the seam should not preclude
  them, and `metadata.cloudservices.type` is the discriminator to leave room for.
- **Schema migration.** The export reads the schema; it never writes one.

## §7 Why this is first

An exported app that cannot reach its database is not a smaller version of a working export — it
is a different artefact. Every other item on the phase list makes an app *more complete*; this one
decides whether the thing that comes out is an app at all.

It is also the item most likely to reveal that a "translated" node is only translated on paper:
the record verbs, the user family and `DbCollection2` have all been graded by whether they emit
plausible calls, never by whether the calls return anything.

## §8 What session 33 built, measured, and left open

Built exactly to §4's shape: `metadata.cloudservices` parsed into the IR (four fields copied,
anything privileged dropped by construction), `src/api/client.ts` emitted when the project has a
backend and at least one api module, stub bodies replaced with client calls, `useSession` made a
real `useSyncExternalStore` hook over `Parse/<appId>/currentUser`, `.env.example` + README
emitted. The no-backend export is byte-identical to before (AC7), with the reason as a report
note. Goldens: `tests/goldens/exp009/`; design: EXP-009-CLIENT-TARGET-OUTPUT.md.

**The drive (real `Puppy test 3`, real `nodegx-backend` from `~/.noodl/backends/…msjck…`, port
8581):**

- **AC1 ✓ in the DOM.** `vite build`, served, headless Chrome: the Landing page lists Biscuit,
  Pepper, Mochi, Waffles, Juniper and Alfie — the six rows in the database. Negative control:
  backend stopped, same page renders, **zero** puppies — the rows were wire-fed, not baked.
- **AC2 ✓ / AC3 ✓ at the wire**, using byte-for-byte the request shapes the pinned client makes:
  sign-up (`POST /users` answers objectId+createdAt+sessionToken only — confirming the identity
  merge the client carries), login tunnel (`_method:'GET'`), `/users/me` with the token, logout;
  a create with the session token attached appeared in the next query and was deleted after.
  ⚠️ **The DOM-level login/admin form drive was not run** — the handlers are the same pinned
  code paths, but nobody has clicked the exported forms yet. Do it when driving AC4.
- **AC5 ✓ on the built bundle**: no `master-key`/`masterKey` in `dist/`; the only credential
  string is `X-Parse-Application-Id`. Also pinned as tests, including a parser test that a
  masterKey pasted into project metadata never reaches the IR.
- **AC6 ✓** (`VITE_NODEGX_ENDPOINT` / `VITE_NODEGX_APP_ID`, defaults = the project's own).
- **AC4 open.** The `Cloud Function` node is not *translated* yet — it is EXP-011 picker-gap
  work; the client gains `/functions/<name>` (POST, session token, `{result}` envelope) when the
  node does. Nothing in the seam precludes it.

Residue: the drive created user `exp009-drive` in the local backend's `_User` collection
(its test puppy and session were cleaned up; the user row is inert).
