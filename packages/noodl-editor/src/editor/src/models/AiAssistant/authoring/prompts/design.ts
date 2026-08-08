/**
 * Phase 54 — the design doctrine, as one text both clients speak.
 *
 * ## Why this file exists
 *
 * Richard's verdict on every AI-authored page up to 2026-08-08 was that it
 * looked like *"basic bitch shit from a W3 Schools beginner tutorial"*, and the
 * diagnosis has two halves that must not be confused.
 *
 * The first half was mechanical and is now fixed: five separate seams discarded
 * the styling the model DID emit (`fontWeight` had no port at all, a `var()`
 * token on a dimension port became `NaNpx` and deleted the property, `sizeMode`
 * voided width/height/objectFit, there was no `box-sizing`, `alignItems` had no
 * `stretch`). A prompt cannot fix a discarded parameter, and until 0.1.4 no
 * amount of design guidance would have changed a pixel.
 *
 * The second half is this file. With the seams closed, the remaining gap was
 * that **there was no design knowledge anywhere in the stack**. Measured at
 * phase open: `authoring.ts` contained zero occurrences of composition,
 * hierarchy, rhythm, whitespace, grid or imagery; of 51 validated catalog
 * examples exactly one was about visual composition; and `get_style_vocabulary`
 * described tokens and per-element variants — atoms, never an arrangement of
 * them. The model was handed a paint set, nineteen visual node types, and no
 * worked example of what a page looks like. It then did the only thing anyone
 * could: stacked Groups and Texts in a column.
 *
 * ## Where the content came from
 *
 * Not from taste asserted in the abstract. Every rule below was either applied
 * or discovered while building `ecommerce-example` (Kiln & Co.) end to end and
 * MEASURING the result in `scripts/devtools/render-from-disk.js`. The mechanical
 * rules in §8 are each a defect that was found in a rendered DOM and could not
 * have been found by reading the graph — the cards that were all 1152px wide,
 * the thirteen empty text boxes, the page that computed to Times.
 *
 * §0 and §7 were added after Richard reviewed the reference build and found the
 * two things this file had missed. §0 because the page he was shown was 66
 * nodes of inlined sections — the decomposition doctrine broken three commits
 * after this one shipped beside it, which is now also a validator warning
 * (`repeated-sibling-subtree`). §7 because the page did not survive a narrow
 * viewport, and the reason is structural: `Columns` is the ONLY node in the
 * runtime with any breakpoint concept, so every multi-column arrangement built
 * from Groups is frozen at the width it was authored at.
 *
 * ## Why a shared module rather than two prompt strings
 *
 * AAQ-005's rule: one authoring substrate, two clients. This module imports
 * NOTHING, which is what lets `noodl-mcp/src/editor-deps.ts` re-export it under
 * the same containment rule as `decomposition.ts` — whose shape this file
 * deliberately copies rather than inventing a second one.
 *
 * ## Why the rules are countable
 *
 * Same reason as `decomposition.ts`: "make it look designed" produces either no
 * change or pastiche. Every rule that can carry a number carries one, so a model
 * applying these cold reaches the same answer twice, and so the design gate can
 * check the same thing the prompt asked for.
 *
 * @module AiAssistant/authoring/prompts/design
 */

/**
 * The design doctrine, as project-facing markdown. Handed to external agents
 * through `get_project_info.designDoctrine` and to the in-editor loop through
 * the authoring system prompt.
 */
export const DESIGN_DOCTRINE_MD = `## What a designed page is made of

A page that looks designed is not a styled version of a page that does not. It has a different
STRUCTURE. Build the structure first and the styling has somewhere to land.

### 0. A page is an assembly of components, not a graph of nodes

Everything below describes named, repeatable objects — a band, a section head, a card, a stat tile.
**Each of those is a COMPONENT**, authored once and instantiated, not a subtree typed out again.
This is the decomposition doctrine applied to layout, and it is the rule most often lost the moment
a page starts looking good: the page ends up correct, handsome, and 66 nodes long.

- A finished page component should read as a short list of instances — header, hero, feature strip,
  listing, footer — and is usually **under ~15 nodes**. If a page graph is past ~25, it wanted to
  be several components.
- **Three structurally identical siblings is a validation warning**
  (\`repeated-sibling-subtree\`), not a style preference. Three feature items, three pricing tiers,
  three category cards: make one component and instantiate it three times, or drive a Repeater from
  a data source when the copies differ only in their values.
- A section that varies only by its words — an eyebrow, a heading, a sub-line — is one component
  with Component Inputs, not three hand-written copies.

Build the leaf components first, then the sections, then assemble the page from them. Doing it the
other way round produces one long column that nobody can reuse a piece of.

### 1. Every page is bands and a shell

The spine of every page is the same three levels:

- **Band** — full width, owns a background. Sections alternate between \`var(--background)\` and
  \`var(--surface)\` (or one accent band) so the page reads as parts rather than a scroll.
- **Shell** — inside each band, ONE centred container: \`width: 100%\`, \`maxWidth\` 1100–1280px,
  \`paddingLeft\`/\`paddingRight\` of \`var(--space-6)\`. Centre it with \`alignItems: "center"\` on the band.
- **Content** — inside the shell.

Content that touches the viewport edge is the single loudest signal that nobody designed this.

### 2. Sections are announced

A section opens with an **eyebrow** (\`--text-xs\`, semibold, \`--tracking-widest\`, uppercase, in the
accent colour), a **heading** (\`--text-3xl\`, semibold, \`--tracking-tight\`), and optionally one
**sub-line** (\`--text-lg\`, \`--muted-foreground\`, \`maxWidth\` ~560px so it wraps at a readable measure).
Then \`var(--space-10)\` of air before the content. Vertical padding on a section band is
\`var(--space-20)\`. Three sizes of gap in one page is rhythm; nine is noise.

### 3. Typography: the whole scale, at least three weights

- Exactly ONE display headline per page: \`--text-5xl\`/\`--text-6xl\`, \`--font-bold\`,
  \`--leading-tight\`, \`--tracking-tighter\`. Tight tracking is what makes a large heading look set
  rather than typed.
- Section headings \`--text-3xl\`/\`--font-semibold\`; card titles \`--text-xl\`/\`--font-semibold\`;
  body \`--text-base\`/\`--font-normal\`; secondary \`--text-sm\` in \`--muted-foreground\`.
- **A page rendering at one font weight is not designed.** Aim for three or more distinct weights.
  Set \`fontWeight\` explicitly — it is a real port and nothing infers it.
- Never set \`fontFamily\` on ordinary text. The project's \`body\` already carries
  \`var(--font-sans)\`; setting it per node only creates drift.

### 4. Colour: one accent, spent carefully

Six roles carry a whole page: \`--background\`, \`--surface\`, \`--foreground\`, \`--muted-foreground\`,
\`--border\`, and ONE \`--primary\`. The accent appears on at most three kinds of thing (say: primary
button, eyebrow, price) — an accent on everything is an accent on nothing. Emit
\`var(--token)\` always; a raw hex in a parameter is a bug, not a shortcut.

**Contrast is two rules, not one.** Text needs 4.5:1 against what is behind it. A **control's**
border — an input, an outline button — is the only thing telling the user where that control is, so
it needs 3:1; a decorative card hairline is exempt and should stay subtle. One border token cannot
be both: keep \`--border\` for hairlines and a distinct \`--border-control\` at 3:1 for controls.
Trying to make one token do both is how a real project ended up with 143 controls at 1.00:1.

### 5. Images are not decoration

A visual page with no \`Image\` and no \`Icon\` cannot look designed, and no amount of spacing will
rescue it. Every listing gets a photo, every feature row gets an icon.

- Give the image a real box: \`sizeMode: "explicit"\`, a \`width\`, a \`height\`, \`objectFit: "cover"\`.
- Put it in a \`clip: true\` parent so the card's radius actually cuts the photo.
- **Look at the image before shipping it.** A URL that 404s, or a photo of the wrong thing, undoes
  every other decision on the page. An unverified image URL is an unchecked claim.

### 6. Reuse recipes, do not re-decide

Before authoring, fix a handful of named parameter sets and reuse them verbatim: a \`card\`, a
\`shell\`, a \`sectionHead\`, one \`primaryButton\`, one \`outlineButton\`, and a type ramp. A page whose
cards disagree about their own radius reads as careless even when each card is defensible. Where a
variant exists in the style vocabulary, copy its concrete parameters — \`variant\` and \`size\` are
connection-only ports and setting them as parameters is discarded AND rejected.

### 7. Responsive: \`Columns\` is the only thing that reflows

**A \`Group\` never responds to width. There are no media queries and no breakpoints anywhere in the
runtime except on one node.** A row of Groups is frozen at whatever proportions you authored, so a
two-column hero stays two columns at 390px and a 32%-wide card becomes 120px wide. Everything on a
page that is arranged in more than one column must therefore be a \`net.noodl.visual.columns\` node.

- **Grid of unknown length** (products, posts, tiles): \`sizing: "autoFit"\` with a \`minWidth\` of
  260–320px. No breakpoints to maintain — it fits as many columns as will hold that width and
  reflows on its own. This is the right default for anything fed by a Repeater.
- **A fixed arrangement** (a 2-up hero, a 3-up feature strip, a 4-up footer): \`layoutString\`
  (\`"1 1"\`, \`"1 1 1"\`, \`"2 1"\` for an uneven split), plus \`mediumBreakpoint\`/\`mediumLayout\` and
  \`smallBreakpoint\`/\`smallLayout\` to collapse it — typically \`"1"\` under about 700px.
- Breakpoints are measured against the **container**, not the viewport, so the same component
  behaves correctly inside a sidebar, a modal or a repeater cell.
- A \`Columns\` node handles a Repeater child correctly: the Repeater itself is not a layout
  participant, and its items each get a column box.
- Use \`marginX\` for the gutter between columns; a percentage gap on a wrapped Group is a
  desktop-only trick and stops being one the moment the layout must collapse.

**Type does not scale.** \`fontSize\` has no responsive form, so a \`--text-6xl\` display headline is
60px on a phone too. Pick the display size that still works at 390px — usually \`--text-4xl\` or
\`--text-5xl\` — rather than the one that looks best at 1440px.

Check the narrow width before saying it is done: nothing should exceed the viewport
(\`el.getBoundingClientRect().width > window.innerWidth\`), and a multi-column band should have
become one column.

### 8. The mechanics that silently undo layout

Each of these was found by measuring a rendered DOM, and none is visible in a graph:

- **A wrapped flex row does not shrink its children; an unwrapped one does.** This is why a row of
  Groups appears to work and a wrapped grid of them does not: without wrapping, children shrink to
  share the width; with it, each item keeps whatever width it was given. If you must use a wrapped
  Group at all, every item needs an explicit percentage track width AND a percentage gap
  (\`width: 32%\` with \`columnGap: 2%\`). **Prefer \`Columns\` — see §7 — because a wrapped Group
  cannot collapse at any width.**
- **\`sizeMode\` gates other ports.** On \`Image\`, \`net.noodl.controls.button\` and \`textinput\`,
  \`width\`/\`height\`/\`objectFit\` are INERT unless \`sizeMode: "explicit"\`. A \`width: 100%\` input that
  renders 170px wide is this, every time.
- **A dimension is \`{ value, unit }\`.** \`width\`, \`height\`, \`maxWidth\`, \`minWidth\` default to \`%\`,
  so a bare \`width: 228\` renders at 228%. Units-typed numbers (padding, gap, radius, fontSize)
  accept \`{value, unit}\` or a \`var(--token)\` string.
- **Falsiness is free conditional rendering.** Wire a record field straight into a Group's
  \`visible\` port: an empty \`badge\` string and a \`compareAtPrice\` of \`0\` then hide their own chrome
  with no logic node. Without it, every row carries an empty pill.
- **\`Text\` is not a box.** It has no background, padding, border or \`textDecoration\`. Wrap it in a
  \`Group\` for the box; use \`styleCss\` for the rare CSS property no port covers (strikethrough).
- Use the gap ports (\`rowGap\`, \`columnGap\`) for spacing between siblings, never margins on the
  children — margins do not collapse the way a designer expects and leave the last item uneven.

### 9. Design the empty and the loading state

A list with no rows should say what it is and what to do, not render nothing. An empty state is a
small designed object: icon, one line of explanation, one action.

### 10. Words are part of the visual design

Placeholder copy makes a competent layout look like a template. Write the real thing: specific,
concrete, and in the product's own voice — "Between 20 and 60 of a thing, then we move on" rather
than "High quality products". Numbers, materials and constraints read as designed; adjectives do
not. Never ship "Lorem ipsum", "Welcome to our store", or "Card title".

### 11. You have not finished until you have looked at it

A graph is a claim; a render is evidence. Render the project, screenshot it, and measure the DOM
before saying it is done. Three checks catch most of what goes wrong:

1. \`document.documentElement.scrollWidth > clientWidth\` — something is overflowing.
2. The set of \`getComputedStyle(el).fontWeight\` across text nodes — if it is \`{"400"}\`, there is no
   hierarchy on the page.
3. The \`offsetWidth\` of the items in a grid — if they all equal the container, the grid is a column.`;

/**
 * The planning-side text. Short on purpose: the planner is deciding what
 * components exist, not how they look, and the one thing it must not do is plan
 * a page as a single operation with no shared parts.
 */
export const DESIGN_PLANNING = `DESIGN
A page is bands (full-width, alternating background) each holding one centred max-width shell. Plan
the shared visual parts as their own components — a site header, a footer, and one card component
per repeated row — because a page that inlines them cannot keep them consistent with the next page.
Decide the project's identity ONCE, before the pages: set the design tokens (one accent, a neutral
surface ramp) with set_project_tokens, and every later operation references var(--token) only.
Anything repeated from a data source is one component plus a Repeater, never duplicated subtrees.`;

/**
 * The authoring-side preamble. Points at the doctrine and names the two things
 * a single-component author most often gets wrong when it cannot see the page.
 */
export const DESIGN_AUTHORING = `DESIGN
Follow the design doctrine: bands and a centred shell, an announced section head, three or more font
weights, one accent colour, images with sizeMode "explicit", and gap ports rather than margins.
Two failures are specific to authoring one component at a time: a grid item needs its own percentage
width (a wrapped flex row does not shrink its children), and any parameter that varies per record
should be a connection, including into the "visible" port — wiring an empty string or a 0 there is
how optional chrome hides itself without a logic node.`;
