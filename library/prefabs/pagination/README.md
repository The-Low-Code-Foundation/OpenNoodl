# Pagination — wiring it up

One control for paging any list: page-number buttons (with `…` overflow when
there are too many to show), prev/next arrows, an optional **Rows per page**
selector and an optional **Showing X–Y of Z** summary. This entry replaces the
former separate *Pages And Rows* prefab — both mechanics now live here.

## Ports

**Inputs** (on the `Pagination` component)

| Port | What it is |
|---|---|
| `Total Items` | Total number of records in the collection (e.g. Query Records' **Count** with *Fetch total count* on, or a Count node) |
| `Items Per Page` | Starting page size (default 10). The rows-per-page selector overrides it at runtime |
| `Current Page` | Zero-based page to start on (optional; default 0) |
| `Rows Per Page Options` | Array of page-size choices for the selector (default `[5, 10, 15, 20, 30, 40, 50]`) |
| `Show Rows Per Page` | Boolean — mount the rows-per-page selector (default true when unconnected) |
| `Show Summary` | Boolean — mount the "Showing X–Y of Z" text (default true when unconnected) |

**Outputs**

| Port | Plug it into |
|---|---|
| `Current Page` | Anything that needs the zero-based page index |
| `Offset` | Query Records → **Skip** (`Current Page × Items Per Page`) |
| `Items Per Page` | Query Records → **Limit** |
| `Changed` | Query Records → **Do** — refetches whenever the user pages or changes page size |

## Using it with Query Records

1. On the Query Records node enable **Use limit** (this reveals its **Limit**
   and **Skip** inputs).
2. Connect `Items Per Page → Limit`, `Offset → Skip`, `Changed → Do`.
3. Feed `Total Items` from the total record count (not the per-page **Count**,
   which Limit caps — enable *Fetch total count* or use a separate count).

## Styling

Colours are design tokens (`var(--primary)`, `var(--foreground)`,
`var(--muted)`, `var(--muted-foreground)`, `var(--primary-foreground)`), so the
control picks up the host project's theme with no configuration.
