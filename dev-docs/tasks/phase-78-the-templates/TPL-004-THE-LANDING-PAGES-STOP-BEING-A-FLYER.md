# TPL-004 — The landing pages stop being a flyer

**Opened 2026-09-11**, at Richard's request:

> *"Can we take a crack at improving the default landing page template we ship with the editor?
> Now that we've fixed the MCP and have made a successful new business landing page template."*

**Status: OPEN.** Prefix `TPL`. Subject: `embedded://landing-pages` (TPL-003), the one landing-page
row the editor ships.

## 1. The person sentence

**Somebody who picks the landing-pages row gets a page that answers when they touch it** — cards that
lift, questions that open, work they can filter and look at properly, a form that tells them what is
wrong before they press Send — instead of a printed flyer rendered in a browser.

## 2. 🔴 The measurement that opened this

A node census of what ships today (`landing-pages.content.json`, 21 components, 375 nodes):

| what it holds | count |
|---|---|
| `Group` | 150 |
| `Text` | 87 |
| `States` | **0** |
| `CSS Definition` | **0** |
| `Static Data` / `For Each` / `Filter Collection` | **0** |
| popups (`NavigationShowPopup`) | **0** |
| `Expression` | **0** |

Three pages, and **nothing on any of them responds to a pointer**. Every row of three is three
hand-placed instances, so changing the work on the page means editing three nodes rather than one
list. The only interactive thing in the template is the contact form's Send button, and it says
nothing at all until it is pressed.

That is not a criticism of TPL-003, which was built to a brief that said *"a simple pretty landing
page"* and met it. It is the gap between that brief and the one Richard set on 2026-09-11 for the
build in `NodeGX test projects/Landing page test V2`:

> *"The user should be able to interact as much as possible with the page, to make it not like a
> flyer but a real web page."*

**This task moves the shipped template to that second brief.**

## 3. Where the patterns come from, and why they are not guesses

Every interaction below was authored through the MCP door in `Landing page test V2` on 2026-09-11,
validated (`validate_project`: 0 errors) and rendered (`render_report`: clean at 1440×900 and
390×844). Its `BUILD-LOG.md` records the port names, the gating conditions and the four traps that
cost that build a render. **The exact parameter spellings are copied from that project's
`nodes.json`, not recalled** — `popupParam-<x>`, `filterFilterValue-<p>`, `value-<state>-<name>`.

⚠️ **What that build did NOT verify, and neither does this task on its own:** *a single click.* No
preview was running, so every interaction in it is *wired and statically valid and nobody has
pressed it*. §9 is the drive that closes that, and it is an acceptance criterion, not a nicety.

## 4. Two rulings this task is built on

**Richard, 2026-09-11, asked directly:**

1. **"Upgrade all three pages"** — not a fourth page, not a second shelf row, not a replacement.
   Freelancer, Business and Launch all get the interaction layer, and the template keeps its one row.
2. **"Keep placeholders"** — §E-ii stands. No invented business, no fictional client, no made-up
   number. **This survives contact with `Static Data`:** a JSON list of three projects is still a
   list of placeholders, written in the shape of the thing it stands for, and the node carrying it
   is labelled `EDIT —` like every other.

## 5. Acceptance criteria

- ⬜ **AC1 — Hover and press are visible, and a reduced-motion reader is spared them.**
  One `Site/Interactions` component (a single `CSS Definition`) placed by every page; every card,
  pill, nav link and clickable photograph opts in with `cssClassName`; a
  `@media (prefers-reduced-motion: reduce)` block turns every transition off.
  🔴 **The lift must not use `var(--shadow-*)`** — this template sets all five shadow tokens to
  `none` on purpose, so a shadow-based hover is invisible by construction. Measured: every page
  holds exactly one `CSS Definition`, and ≥ 20 nodes across the template carry a `cssClassName`.

- ⬜ **AC2 — The header is a nav, it sticks, and its links scroll.**
  `Site/ScrollTo` — one `JavaScriptFunction` that resolves a class name and scrolls — replaces the
  `scrollToElement.element` port wiring. 🔴 **The reason is a port count, not taste:** a `Group`
  holds exactly ONE `Scroll To Element - Element`, which is why today's header can reach the form
  and nothing else, and why the hero's second button needs a second Group to aim at. A class-name
  target removes the limit, so the header can carry three real nav links per page.
  Measured: 0 `scrollToElement.*` connections remain; the header band sets `position: sticky`; every
  section a link names carries the matching `cssClassName`.

- ⬜ **AC3 — The contact form answers while you type.**
  `Site/IsValidEmail` (a utility component, so the rule is in one place); `Expression` checks on the
  name and the message; an `And` gate driving Send's `enabled` **and** its `opacity` (a NodeGX button
  renders as a `div`, so `:disabled` never matches and the dim has to come from a port); the message
  field's helper counts down to the minimum. The `mailto:` compose path is untouched.
  Measured: with every field empty, Send is disabled; with a malformed address, it stays disabled and
  the field says why.

- ⬜ **AC4 — The freelancer's work is a list, it filters, and a piece of it opens.**
  `Static Data` → `Filter Collection` (`filterFilterValue-category` wired from a `workFilter`
  variable) → `For Each` → `Site/WorkCard`; a `Site/FilterPill` row writing that variable; a
  *showing n of m* line and an empty state. Each card owns its own `NavigationShowPopup` into
  `Site/CaseStudy`, wired from the card's own `Component Inputs` — 🔴 **not from repeater outputs**,
  because a signal is not a promise that the values beside it have arrived.
  Measured: the page holds 0 hand-placed work cards; the empty state mounts when the filter matches
  nothing.

- ⬜ **AC5 — What a business sells expands, and the kind words step.**
  `Site/ServiceCard` — a `States` accordion (`closed,open`), detail on `mounted` not `visible`
  (`visible` keeps the space), chevron on a tweened rotation — used by both Freelancer's services and
  Business's offer. The quote pairs on both pages become one stepping carousel:
  `Static Data` → `Counter` → `Filter Collection` (`filterEnableLimit` + `filterSkip`) → `For Each`,
  with prev/next disabled at the ends and an *n of m* readout.
  Measured: the detail group is absent from the DOM when closed; the carousel's prev is disabled at
  index 0.

- ⬜ **AC6 — The launch page's questions open and its plans switch.**
  `Site/FaqRow` becomes an accordion; a monthly/annual `States` toggle above the two plans rewrites
  both prices and both period labels from one node.
  Measured: 6 answers, all absent when closed; the toggle changes both plans at once.

- ⬜ **AC7 — Nobody has to be told any of this.**
  `docs/START-HERE.md` regenerates and names the new editable surfaces — the work list, the quote
  list, the nav labels, the address — and says which nodes are demonstration furniture.

- ⬜ **AC8 — It is driven, not only rendered.** §9.

## 6. The gate widening this needs, stated before it is done

`tpl003Template.test.ts` asserts *"every marked node is a Text, a String, an Image or an instance —
something with words in it"*. A `Static Data` node holding the work list **is** something with words
in it and must carry `EDIT —`, so `allowed` gains `Static Data`. That is a deliberate widening with a
reason, recorded here so it is not read later as a gate quietly relaxed to fit.

`USED_COMPOSITIONS` is asserted to be exactly what the template asked the vocabulary for, so any new
composition must be added there in the same commit.

## 7. Out of scope, said plainly

- **The other two templates.** The site builder and the members' area are not touched.
- **A fourth page, or a second shelf row.** Ruled out in §4.
- **The 14 frictions `BUILD-LOG.md` records against the MCP door** (`set_style_preset` is a
  destructive no-op; nothing warns about an empty token set; `popupParam-` is undocumented). They are
  real and they are a different phase's work. **A defect found here is registered, not chased**,
  unless it blocks an AC above.

## 8. Regenerating

    npm run template:landing          # writes templates/landing-pages/ AND the embedded pair
    cd packages/noodl-mcp && npx jest tests/tpl003Template.test.ts

⚠️ **The committed artefact was already key-order-stale before this task touched it.** A regeneration
at HEAD (2026-09-11, before any change) moves `sizeMode` within 15 files — 130 insertions, 96
deletions, **every one of them a reordering and not a value**. That drift rides along in this task's
regeneration and is not part of its change.

## 9. The drive — the criterion that cannot be met by reading

Open the generated `templates/landing-pages/` **as a copy** in the editor, start the preview, and on
each of the three pages press: a nav link, a service card, a filter pill, a work card, the popup's
close, the carousel's prev and next at both ends, the FAQ rows, the plan toggle, and the form's Send
with the fields empty and then filled. **Record what did nothing.**

🔴 A clean `render_report` is not this. The V2 build shipped a popup whose nine parameters all
arrived under the wrong names, rendered clean, and was caught only because it happened to shout in
the console.
