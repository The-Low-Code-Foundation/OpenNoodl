# Backends

NodeGX talks to **six kinds of backend** through one set of data nodes:

| Backend | What it is |
|---|---|
| **Built-in** | The NodeGX backend, running on your machine in the editor and beside your app when deployed |
| **Parse Server** | A stock Parse Server you host |
| **Directus** | A Directus instance you host |
| **Supabase** | Supabase's PostgREST data API |
| **PocketBase** | A PocketBase instance you host |
| **Custom REST API** | Anything else, with the capabilities you declare yourself |

You keep ownership of your data and infrastructure. NodeGX reads your database
structure into the editor so the nodes offer real collections, fields, enums and
relations instead of free-text configuration.

## The rule this page exists to state

**Anything your chosen backend cannot do is visible in the editor, with a
sentence saying why, before you discover it at runtime.**

The six backends do not do the same things. PocketBase cannot total or average
records on the server; Directus has no magic-link login; Parse Server will not
let an app aggregate without a master key. NodeGX ships a **capability
descriptor** — one table of what each backend can do, with a written reason for
every gap — and the editor reads it:

- a **port** the backend cannot serve is dimmed, with the reason underneath it;
- a **node** the backend cannot run is marked in the node picker and on the
  canvas, with the reason on hover, and stays visible rather than disappearing;
- a capability that is **degraded** rather than absent keeps working and carries
  its caveat — Directus increments a number by reading it and writing it back,
  for instance, which is not atomic and says so.

Nothing is hidden. A node you cannot use on this backend still appears, because
"why can't I do this on Directus?" is a question the editor should answer in
place rather than by omission.

### Capabilities that depend on your instance

Some capabilities are neither present nor absent — they depend on how *your*
server is configured. Directus WebSockets are off by default; Supabase aggregate
functions have to be switched on. These are marked **conditional**, and NodeGX
settles them by asking your server when it connects.

Two rules govern that:

- **Until the answer arrives, the capability is treated as unavailable.** An
  editor that assumed the best would be promising something it has not checked.
- **A negative is remembered; a positive expires.** If WebSockets are switched
  off after we checked, a remembered "yes" would be a claim we can no longer
  back — so positive answers are re-checked, and everything known about a
  backend is discarded when it reconnects.

## Connecting a backend

Open the **Backend Services** panel in the sidebar and add a backend. A backend
has two credentials with very different lifetimes:

- **Admin token** — used only inside the editor, for reading your collections
  and fields. It is never published with your app.
- **Public token** — shipped with the deployed app and used by the nodes at
  runtime. It **will be visible** to end users, so grant it access only to data
  that should be reachable from the client (for example, a Directus role scoped
  to the collections your app uses).

Each card carries a security disclosure saying exactly what that backend
publishes. After connecting, **Sync Schema** reads the database structure:
collections, fields, primary keys, enums, required/hidden flags and relations.
That schema drives every dropdown and generated port — re-sync after changing
your database.

A project has **one active backend**. Individual nodes may override it with
their **Backend** dropdown, which appears once a project has more than one.

## The record nodes

| Node | What it does |
|---|---|
| **Query Records** | Fetches a set of records, with a visual filter and sort |
| **Record** | Reads one record's properties |
| **Create Record** | Writes a new record from its property inputs |
| **Update Record** | Writes property values to an existing record |
| **Delete Record** | Removes a record |
| **Filter Records** | Filters an array of records in the app |
| **Add / Remove Record Relation** | Links and unlinks related records |
| **Aggregate Records** | Totals, averages and counts, computed on the server |

Every one of them takes its Class dropdown and its property ports from the
synced schema of whichever backend it is pointed at, whatever kind that backend
is.

### Filtering

One visual filter builder serves every backend. It builds nested and/or
condition groups, offers the operators appropriate to each field's type, and
**greys out the operators the chosen backend cannot express** — the same
descriptor the rest of the editor gates on. An operator that works but behaves
differently keeps its row and carries the difference as a note: Directus's
search, for example, is an unranked substring match across every field rather
than a ranked text search.

Any condition value can be switched from a literal to a **connected value**,
which adds an input port to the node so the value can come from the graph.

### Live updates

**Query Records** has a `Subscribe To Changes` input. While it is on and
`subscribed` is true, records created, updated or deleted by anyone else refresh
the query and fire `created`/`updated`/`deleted` and the generic `changed`.

The transport depends on the backend and the node does not expose the
difference:

| Backend | Transport | Notes |
|---|---|---|
| Built-in | Server-Sent Events | Server-side filtering and per-record permission checks — see [REALTIME.md](./REALTIME.md) |
| PocketBase | Server-Sent Events | |
| Directus | WebSocket | Requires `WEBSOCKETS_ENABLED` on your instance — **conditional**, checked on connect |
| Parse Server | — | Needs a LiveQuery server, which most Parse deployments do not run — **conditional**, checked on connect |
| Supabase | — | Not supported. Supabase Realtime speaks Phoenix channels and NodeGX has no transport for it yet |

The connection authenticates with the public token, answers server heartbeats,
and reconnects with exponential backoff (1s → 30s) after a drop. An invalid
token is fatal — it does not retry until a parameter changes. A backend with no
realtime reports the reason rather than sitting in `connecting` forever.

Notes:

- Delete events carry only primary keys: `changedRecord` is null,
  `changedRecords` holds key strings, and `changedRecordId` is populated for all
  three event types.
- Subscriptions are inert under server-side rendering and activate in the
  browser after hydration — see [RENDERING-MODES.md](./RENDERING-MODES.md).

## Current limits

- **The `noodl.byob.*` nodes (Query Data, Create/Update/Delete Record) still
  exist** and are being retired into the record nodes above. The one thing they
  can still do that the record nodes cannot is reach a Directus *system*
  collection (`directus_users`) through their **API path** port.
- Relation traversal is one hop, and many-to-one/one-to-one only.
- Access Control Rules are a Parse-family concept. Directus, Supabase and
  PocketBase control access with roles, Row Level Security and API rules
  respectively, configured in that backend's own admin — so the rules ports are
  disabled there, with that sentence on them.
- Supabase authentication is declared but not implemented; the auth nodes are
  gated on Supabase rather than pointed at GoTrue.
- Schema parsing is verified against live Directus, PostgREST, PocketBase, Parse
  Server and NodeGX servers.
