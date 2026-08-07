# Conventions

## Structure

- Every page component (Chat, Tools, State, Live) opens with a `Page` node, then a `/Nav` instance, then a single column `Group` (24/20px padding) holding the page's content. This shape repeats across all four pages and is worth keeping for new pages.
- Within a page, each "topic" (e.g. a feature being demonstrated) is introduced by a heading `Text` (18px, marginTop 18px) followed by a grey (`#8A8A8A`, 13px) explanatory paragraph, then the interactive controls, then a block of label/value status rows. This label-left/value-right row (a `Group` in row direction, grey label `Text` + value `Text` reading `—` until populated) is the standard way this project surfaces a node's live output ports to the user — it recurs on State, Live and Tools pages. New diagnostic output should follow this pattern rather than inventing a new display shape.
- `/Nav` is the single shared component and is instanced identically on every page; it is presumably the only piece meant to be reused.
- `/Message Row` is a template component for a Repeater and is not meant to be used standalone.

> TODO: confirm whether pages live under a `/#__page__/` naming convention because Noodl requires it for router pages, or because this project chose it — worth knowing before adding a fifth page.

## Naming

- Page components are named `/#__page__/<Title>`, matching their `Page` node's title/urlPath exactly (Chat/chat, Tools/tools, State/state, Live/live).
- Non-page shared components live at the top level with a plain `/Name` (`/Nav`, `/Message Row`) — no folder nesting was observed.
- Status/value `Text` nodes are left with placeholder text `—` and no distinguishing label of their own; the meaning comes entirely from the grey label `Text` beside them. Don't rename these — keep the label+value pairing intact.

## Styling

- No design tokens or shared style/variant objects were found; every color and spacing value is set as a literal on the node (hex colors, px objects like `{"value":"18","unit":"px"}`). This project does not use a style vocabulary — do not introduce token references that don't exist here.
- A small literal palette recurs by convention rather than by token: primary action blue `#1F6FEB`, grey secondary text `#8A8A8A`, dark neutral button `#24292F` (nav), light panel background `#FAFBFC`/`#F2F4F7`. Reuse these exact hex values for new buttons/labels rather than picking new ones.
- Buttons are consistently `borderRadius: 6px`, `paddingLeft/Right: 14px`, `paddingTop/Bottom: 8px`, white label text on the blue background. Follow this shape for new buttons.
- Body/label text is consistently 13px; section headings are 18px with `marginTop: 18px`.

## Data

- Shared state lives in a single named Global Store (`chat`), read via `Subscribe to Store` and written via `Set Global Store` (or `Optimistic Update` where a round trip is involved). Pages do not appear to hold local component state for anything that other pages also need — cross-page data goes through this store.
- `Function` nodes here are commented in prose explaining *why*, not just what, including implementation caveats (e.g. value-before-signal ordering, plain-array requirement for snapshot restore). New Function nodes should keep this practice of a comment explaining the non-obvious reasoning, not just the mechanics.
- Store writes that represent "the conversation" always write the whole `messages` array back with `Set Global Store`, rather than a partial/keyed update — the store's array is treated as an opaque, deep-copyable blob (this is called out explicitly in a Function comment on the Chat page, for the sake of State's snapshot/undo feature).

> TODO: confirm whether `chat` is meant to be the only Global Store in this app long-term, or whether other features are expected to add their own stores.

## What not to do

- Don't fetch or stream data in a Function node's body; streaming endpoints are wired through the dedicated Data nodes (`Server-Sent Events`, `WebSocket`, `Text Accumulator`, `JSON Stream Parser`, `Stream Buffer`) with `Function` used only to shape the request or reshape a result before/after them.
- Don't invent a new store; write to the existing `chat` Global Store unless a human directs otherwise (see TODO above).
