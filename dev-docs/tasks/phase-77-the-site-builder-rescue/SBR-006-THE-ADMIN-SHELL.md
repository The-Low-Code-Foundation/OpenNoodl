# SBR-006 — The admin shell

**Fixes finding 4 for the client-facing half.** Screen 2. Today the pages list is a heading,
two unlabelled inputs and rows of four buttons. It becomes a shell the other admin screens live
inside: sidebar, content table, dialog-based create.

## 1. The person sentence

**A client signing in sees their pages as a table with names, slugs and status — and can make a
new page from a dialog — without reading a manual.**

## 2. Scope

- **Sidebar** — brand, then Pages · Theme & settings · Messages, plus "View site". Today the
  theme editor is reachable only by a button at the bottom of the list. Build it as a reusable
  admin-shell component the other screens (SBR-007/009/010) instantiate.
- **Pages list as a content table** — name + slug per row, status as a pill (Published/Draft),
  Edit, and one overflow menu holding publish/unpublish/duplicate (four buttons per row is the
  current design).
- **Create in a dialog** — "New page" opens a form (title, slug); the two bare inputs above
  the list go away.
- Row count sentence ("Four pages, three published") — derived, cheap, and it proves the query.
- Everything styled from tokens.

## 3. Acceptance criteria

1. **(person)** The list screen reads: sidebar, page rows with pills, one primary action —
   driven with a real backend and ≥2 pages, screenshot plus DOM assertions.
2. **(person)** Creating a page through the dialog puts the new row in the list without a
   reload (the `itemOutputSignal-Changed` / `create.done` machinery from s19 keeps working —
   re-run its spec, don't trust it).
3. Publish/unpublish/duplicate work from the overflow menu; the row's pill updates.
4. "View site" opens the public site.
5. The admin-shell component is instantiated by ≥2 screens (no copy-paste shells) — and its
   `Component Inputs` interface actually parameterises the active item (the ghost of "renders
   identically however many times placed" from the MCP guidance).

## 4. Traps

- 🔴 The list-refresh wire is name-derived from the item component's ports
  (`itemOutputSignal-<name>`) — renaming a row output silently orphans it again. The s19 spec
  (`the-list-refreshes-when-a-row-changes.test.ts`) is the guard; keep it green through the
  restyle.
- Dialog/menu UI in the *viewer app* is NodeGX components — don't import editor-UI habits;
  check what the node library dialogs/popovers actually offer before inventing one.
