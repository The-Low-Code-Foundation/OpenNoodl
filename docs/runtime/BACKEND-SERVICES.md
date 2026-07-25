# External backends — bring your own backend (BYOB)

NodeGX can talk to a self-hosted backend — Directus, Supabase, Pocketbase, or
any REST API — through the **Backend Services** panel and the five
`noodl.byob.*` data nodes. You keep full ownership of your data and
infrastructure; NodeGX syncs your database structure into the editor so the
nodes offer real collections, fields, enums and relations instead of free-text
configuration.

## Connecting a backend

Open the **Backend Services** panel in the sidebar and add a backend from a
preset (*Directus*, *Supabase*, *Pocketbase*, *Custom REST API*). A backend has
two tokens with very different lifetimes:

- **Admin token** — used only inside the editor, for schema introspection
  (reading your collections and fields). It is never published with your app.
- **Public token** — shipped with the deployed app and used by the nodes at
  runtime. It **will be visible** to end users, so grant it access only to data
  that should be reachable from the client (e.g. a Directus role scoped to the
  collections your app uses).

After connecting, **Sync Schema** pulls the database structure: collections,
fields, primary keys, enums, required/hidden flags, and many-to-one relations.
The synced schema is what drives every dropdown and generated port in the node
family — re-sync after changing your database structure.

## The node family

All five nodes live in the **Data** category and share the same Backend +
Collection dropdowns (backed by the synced schema). "Active Backend" follows
the backend marked active in the panel, so a project can switch environments
in one place.

### Query Data

Fetches records on demand: fire `fetch`, get `records` (array), `firstRecord`,
`count` (this page) and `totalCount` (all matches server-side — drive
pagination from this). Results are a snapshot; re-trigger `fetch` after writes,
or pair with Subscribe To Changes for live refresh.

The **filter editor** builds nested and/or condition groups with drag-and-drop,
field-appropriate operators, and value editors that follow the schema (enum
fields get a dropdown, booleans a toggle). Any condition value can be switched
from a static value to a **connected value**, which materialises a "Filter
Values" input port on the node so the value can come from the graph. Sorting
supports multiple directions and, like filtering, can reach across a
many-to-one relation with a dotted path (`author.name`).

**Related data:** each many-to-one/one-to-one relation on the collection gets
an `Include <relation>` boolean port (group "Related Data"). Enabled, the
related record arrives embedded as a nested object on each result record, and
its fields become available to filter and sort paths (one hop deep).

### Create Record / Update Record / Delete Record

Writes. Field inputs are generated from the schema (enums as dropdowns, hidden
fields omitted); Update and Delete take a record id, Create returns the new
`record` and `recordId`. All three expose `loading` plus `success`/`failure`
signals — the idiomatic pattern is `success` → a Query Data `fetch` to refresh
any list showing the collection.

### Subscribe To Changes

A live change feed over the backend's WebSocket interface (Directus — the
server must run with `WEBSOCKETS_ENABLED`). While `subscribed` is true, remote
creates/updates/deletes fire `created`/`updated`/`deleted` plus the generic
`changed`, with the affected record(s) on the Event outputs. The connection
authenticates with the public token, answers server heartbeats, and reconnects
with exponential backoff (1s → 30s) after a drop; an invalid token is treated
as fatal (no retry until a parameter changes).

Notes:

- Delete events carry only primary keys — `changedRecord` is null,
  `changedRecords` holds key strings, and `changedRecordId` stays populated
  across all three event types.
- The node is client-only under server-side rendering: a server render leaves
  it inert and it activates in the browser after hydration (see
  [RENDERING-MODES.md](./RENDERING-MODES.md)).
- The common wiring is `changed` → Query Data `fetch`: a list that stays
  current without polling.

## Current limits

- Relation traversal is one hop and many-to-one/one-to-one only;
  one-to-many/many-to-many relations are not yet expanded.
- Realtime subscriptions are Directus-specific today.
- Directus and Supabase (PostgREST) schema parsing are verified against live
  servers; the Pocketbase parser follows Pocketbase's documented schema format
  but has had less real-world exercise.
