# EXP-009 — the backend client, hand-written target output

**Written before the emitter** (2026-08-28, session 33), the way every EXP-002 slice was: these
files were typed by hand into the prepared harness (the s31 `app/` with `@nodegx/core` linked),
`tsc -b` graded them at exit 0, and a sabotage line proved the checker was looking. The emitter's
job is to produce these bytes; the goldens in `tests/backend-client.test.ts` pin them.

The protocol is **read from the runtime, not invented** — every path, header and body shape below
has a named source in `packages/noodl-runtime/src/api/backends/`:

| emitted call | runtime source |
|---|---|
| `POST /classes/<C>` with `{_method:'GET', where, order, limit, skip}` | `ParseWireAdapter.query` (the POST-tunnelled GET; a real GET truncates large filters at the URL limit) |
| `POST /classes/<C>` (create), `PUT /classes/<C>/<id>` (update), `DELETE …/<id>` | `ParseWireAdapter.create/save/delete` |
| `POST /login` with `{username, password, _method:'GET'}` | `ParseAuthAdapter.logIn` |
| `POST /logout` `{}` | `ParseAuthAdapter.logOut` |
| `POST /users` + merge the identity the caller supplied | `ParseAuthAdapter.signUp` — the missing merge was a live defect there; do not re-introduce it |
| session under `localStorage['Parse/<appId>/currentUser']`, read per request | `SessionStore.parseSessionKey` — "unchanged and unchangeable"; a different key is a silent mass logout |
| wire identity `objectId` ↔ interface `id` | `recordIdentity.ts` — the exported interfaces say `id`, so the client renames at its boundary, both directions |
| headers: `X-Parse-Application-Id` + `Content-Type: application/json` + session token when stored | `ParseWireAdapter._makeRequest` |

## Rulings

1. **The endpoint and appId are `import.meta.env` variables with the project's values as
   defaults** (task §4). The scaffold's tsconfig already carries `types: ['vite/client']`, so
   `import.meta.env` typechecks. Both values are single-quote-escaped string literals — they are
   user text from `nodegx.project.json`.
2. **No privileged credential is ever emitted.** The parser copies exactly four fields off
   `metadata.cloudservices` (`endpoint`, `appId`, `instanceId`, `type`) and drops everything else
   on the floor — so a `masterKey` someone pastes into project metadata cannot reach the IR, let
   alone the bundle. AC5's grep has a test behind it.
3. **`useSession` becomes a real hook**: `useSyncExternalStore` over the stored session, snapshot
   = the raw stored **string** (stable, so no render loop), parsed in a `useMemo` keyed on it.
   Same-tab changes arrive through a module listener set that `logIn`/`logOut`/`signUp` notify;
   other tabs arrive through the `storage` event. The server snapshot answers `undefined` —
   "a server render always sees a logged-out user" is the runtime's own declaration. The emit
   side was already shaped for this: `effectDeps` treats session fields as reactive reads
   (component.ts's session-get case says "it is the shape a real session hook needs").
4. **Errors throw the backend's own message** (`json.error`), which is exactly what every
   generated Failure path already handles. A non-JSON error body degrades to
   `Request failed (<status>)`.
5. **An update answers with the changed fields only** (`updatedAt`), so the returned record is
   `{...data, ...fields, id}` — the caller's own data is the record the graph continues with.
6. **AC7 — a project with no `metadata.cloudservices` emits exactly what it emits today**: stub
   bodies, no client, no `.env.example`, no README, plus one report note naming the reason. The
   corpus's no-backend projects are byte-identical before and after this slice.
7. **No collection module can collide with `client.ts` (or `session.ts`).** First drafted as a
   fallback gate, then measured: `moduleBase` is the *pluralized* class name and every
   `pluralize()` result ends in `s`/`es`/`ies`, while neither "client" nor "session" does — a
   collection named `Client` lands on `clients.ts`. The gate was removed rather than kept,
   because its test could not fail (the s29 rule: a guard covered by a test that cannot fail is
   recorded in code, not tested). A test pins the plural fact itself so a future naming change
   fails there first.
8. **Emitted only when something calls it.** The client appears when the project has a backend
   AND at least one api module (queries, mutations or session calls). A backend with no data
   nodes emits nothing new.
9. **Out of scope, named in the report where relevant**: realtime subscriptions, file upload,
   BYOB backends (task §6), and the `Cloud Function` node — which is not yet *translated* (it is
   part of EXP-011's picker gap; the client gains `/functions/<name>` when the node does).

## The files, byte-for-byte

### `src/api/client.ts` (for `Puppy test 3`; two interpolations, marked ⟨…⟩)

The literal content is what session 33's harness compiled; the emitter interpolates
⟨endpoint⟩ = `http://localhost:8581` and ⟨appId⟩ = `backend_msjck0y2ukxwv` into the two
`const` defaults. Everything else is fixed text. See `emitApp.ts` `clientModule()` — the
test `backend-client.test.ts` pins the whole file for the fixture, so it is not duplicated
here line-for-line.

Shape: header comment → `ENDPOINT`/`APP_ID` consts → `SESSION_KEY` → `WireSession` →
storage read/write/clear + listener set + `subscribeSession` → `request()` (headers, throw
on `!ok` with the backend's message) → `fromWire` (objectId→id) → `QueryParams` +
`query`/`create`/`update`/`remove` → `logInRequest`/`logOutRequest`/`signUpRequest`.

### `src/api/puppies.ts` (connected form)

```ts
// @nodegx:generated (api module — provenance markers complete in EXP-007)
import { create, query, update } from './client';

export interface Puppy { id: string; name?: string; … }

/**
 * Source: "Query available puppies" (DbCollection2 `puppyQuery` on /Pages/Landing)
 * Fetches the `Puppy` collection from the project's NodeGX backend
 * (src/api/client.ts); the export report lists every call site.
 */
export async function fetchPuppies(): Promise<Puppy[]> {
  return query<Puppy>('Puppy');
}
// createPuppy → create<Puppy>('Puppy', data); updatePuppy → update<Puppy>('Puppy', id, data);
// deletePuppy → remove('Puppy', id). Doc comments keep the call-site lines; the "TODO(export)"
// prefix becomes "Source:" — a connected call is provenance, not a TODO.
```

The import list is computed from the verbs present, sorted (`create, query, remove, update`).

### `src/api/session.ts` (connected form)

React import first (only when the `read` verb exists), then the client import. `toSessionUser`
sits after the interface (emitted when any of login/signup/read exist); `readNoSession` directly
after `useSession`. Function order stays byFn first-use order, as today.

### `.env.example`

```
# The exported app's backend — defaults are the project's own (src/api/client.ts).
VITE_NODEGX_ENDPOINT=http://localhost:8581
VITE_NODEGX_APP_ID=backend_msjck0y2ukxwv
```

### `README.md`

Project name, `npm install && npm run dev`, and the two variables with their defaults —
task §4's "say in the README what the two variables are". Emitted only alongside the client.

## What the tests must separate

- Golden: puppy-test-3's three api files + `.env.example` + README, byte-for-byte.
- AC7 control: strip `cloudservices` from the fixture in-memory → byte-identical to the
  pre-EXP-009 stubs, no client/env/README, the named note present.
- AC5: no emitted file for any fixture contains `Master-Key` or `masterKey`, **including** a
  fixture whose `cloudservices` carries a `masterKey` field (the parser must drop it).
- Escaping: an endpoint containing `'` lands escaped in the string literal.
- The no-collision fact: a collection named `Client` lands on `clients.ts` (module bases are
  plurals), pinned so a naming change fails there first.
- Mutation checks run (all killed, restores md5-proved): the client-without-backend gate
  **cannot even compile** — TypeScript narrowing makes `envExample(backend)` a type error when
  the gate widens, the s22 required-field lesson; the `Source:`/`TODO(export):` marker flip died
  to 4 tests; the parser passing every `cloudservices` field through died to exactly the
  credential test. Everything inside `clientModule` is pinned by the byte-golden.
