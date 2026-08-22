# CRUD Screen — configuring it

The most-repeated screen in software: a searchable, paginated list over one cloud
collection, a **New** button, an **Edit** side panel bound to the selected record,
and per-row **Delete** with an inline Yes/No confirm. All four operations go
through the standard record nodes (Query Records, Create Record, Update Record,
Delete Record) against the project's one backend.

## The one input

| Port | What it is |
|---|---|
| `Class` | The cloud collection this screen lists and edits. Set it once on the `CRUD Screen` instance — it fans out to every record node inside (query, record, create, update, delete). |

Every record node also carries `Items` as its saved Class parameter, so the
screen works unchanged if your collection is literally called `Items` and you
leave the input unset.

## The collection it expects

Out of the box the form and the rows use two text fields:

| Field | Type | Where it shows |
|---|---|---|
| `title` | String | Row's first line, panel's **Title** field |
| `notes` | String | Row's second line, panel's **Notes** field |

Create a collection with those two fields (any extra fields are ignored), point
`Class` at it, and the screen is live.

## Renaming the collection

Set `Class` on the instance. That is the whole rename — nothing inside the
component needs editing unless your fields differ from `title`/`notes`.

## Adding or renaming fields

Four places, all named in the graph:

1. **Row display** — `/CRUD Screen/Item Row`: add/retitle a `Text` node, give it a
   Component Input, and map it in the **Rows** repeater's Input Mapping script in
   `/CRUD Screen` (`'MyInput': 'my_field'`).
2. **Form** — add a Text Input in the **Side panel** group.
3. **Create/Update** — wire the new field's **Text** output into `prop-<field>` on
   both the **Create Record** and **Update Record** nodes.
4. **Pre-fill** — wire `prop-<field>` from the **Record (selected)** node into the
   new field's **Start Value**.

## Page size

One place: the `PAGE_SIZE` constant at the top of the **Pager** function node.
It feeds both the query's Limit and Skip.

## Behaviour notes

- **Search** uses the backend's full-text search (`Search` input on Query
  Records) and resets paging to page 1 on every keystroke.
- **Loading state** shows until the first query answers (success or failure);
  the **empty state** only appears after that first answer.
- **Delete** is confirmed inline in the row (Delete → *Delete? Yes/No*) — no
  dialog dependency. A confirmed delete also closes the side panel, so a stale
  edit can never save against the wrong record.
- Saving (create or update) closes the panel and refetches the list; deletes
  refetch too.
- Colours are design tokens (`var(--foreground)`, `var(--border)`,
  `var(--primary)`, `var(--destructive)`, …) and no fonts are bundled, so the
  screen picks up the host project's theme and its default Inter.
