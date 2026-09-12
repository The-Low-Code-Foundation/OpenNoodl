# Phase 78 — the templates

**Opened 2026-08-28**, at Richard's request: *"Let's make a few templates in a new phase please"* and
*"work on other ones later in a new phase (the other ones from the list we made)"*.

## Why this phase exists

The template machinery is **finished, deployed and driven end to end** (P75 FB-005, T1–T5). A builder
can start a new project from a template, through a picker, from the launcher. What does not exist is
**a single published template** — so every person who installs NodeGX and clicks Community finds an
empty shelf.

By Richard's own ruling (R-templates, 2026-08-22) **he publishes**; a share button files a
submission. So the blocker was never code.

## ✅ First task: the list — FOUND 2026-09-11, and it was here all along

~~**It is not in this repository.**~~ **It is, and it always was.** Two prior searches (this README's
original text, and [RICHARD-RULINGS-2026-08-28 §9](../phase-75-0.2.1-the-feedback/RICHARD-RULINGS-2026-08-28.md))
each concluded the list did not exist. **Both missed it in the same two places**, found 2026-09-11
while scoping TPL-005:

- **The order**, ruled by Richard 2026-08-26 — [`phase-76/README.md:13-15`](../phase-76-the-site-builder/README.md#L13-L15),
  written as a *parenthetical inside a sentence about why the site builder goes first*, which is why
  grepping for "list" and "roster" never reached it.
- **All eight, with their descriptions** — [`template-search.test.ts:121-190`](../../../packages/noodl-editor/tests-unit/fb-005/template-search.test.ts#L121-L190),
  the FB-005 T4 search corpus, *"built from Richard's own roster"*.

🔴 **A test fixture was the only enumeration of the product roster that existed** — the roster
survived as search-relevance data because no document owned it. **It is now written down in
[TPL-005 §0](TPL-005-THE-PIXEL-GAME.md), in full, with each template's status.**

⚠️ **"Which were most exciting" has no answer in the record, and the build order is not one.** The
site builder went first *because it was hardest*. The only signal of the kind Richard remembers is
P75's finding that **`pixel-game`, `interactive-fiction` and `shared-canvas` are none of the six
ruled categories** — they broke the vocabulary because they are the three that are neither a website
nor a CRUD app. **That preference was legible only as a defect report.**

## Scope

- ✅ **T1** — the list (above). **FOUND 2026-09-11**; enumerated in [TPL-005 §0](TPL-005-THE-PIXEL-GAME.md).
- ⬜ **T2** — build the first small batch. Each template is a working project plus a couple of
  sentences of description (the shelf will not publish without them).
  - 🟢 **[TPL-001 — the members' area](TPL-001-THE-MEMBERS-AREA.md)**, `data-app`. **Built,
    gated and DRIVEN** (§12, s3 2026-08-28): AC2–AC5 measured against a real enforcing backend in
    a real browser, 45 specs. **AC1 waits on T5** — until it is published there is no picker row
    to pick — and AC6's empty states are the one criterion with no reading against them. Richard's
    choice, 2026-08-28: a members-only site for a charity, club or church — restricted content,
    moderators, meetings, behind a simple public landing page. Chosen **without waiting on T1**;
    it fills the largest category gap (of six ruled slugs only `starter` and `site` are spoken
    for) and doubles as the **control on SBR-001/002**, whose wizard attach has only ever been
    exercised by one template.
  - ⬜ **[TPL-002 — the opt-in notifications](TPL-002-THE-OPT-IN-NOTIFICATIONS.md)**. Split from
    TPL-001 because email needs SMTP config a template **cannot ship** — the shelf's first row
    must not wait on that. Email itself already exists (`Mailer.ts` + the Send Email node).
  - 🟢 **[TPL-003 — the landing pages](TPL-003-THE-LANDING-PAGES.md)**, `site` (category needs
    Richard's ruling). Richard's ask, 2026-09-05: *"a simple pretty landing page … no backend just
    front end small business or freelancer landing page, presentation and a contact form … a few
    different pages within the same template for different typical 'top 3' landing page types."*
    **Built, gated (39/39), photographed (12 shots, 0 console errors) and driven (the form composes
    a real `mailto:`, the header scrolls to it) in one session.** Three pages — freelancer at `/`,
    local business, product launch — sharing a header, a footer, a contact band and a switcher strip
    a person deletes. Left: his look, and the publish (command in the task file).
  - 🟡 **[TPL-004 — the landing pages stop being a flyer](TPL-004-THE-LANDING-PAGES-STOP-BEING-A-FLYER.md)**.
    Richard's ask, 2026-09-11: *"Can we take a crack at improving the default landing page template
    we ship with the editor?"*, after the interaction-first business landing page built through the
    MCP door in `NodeGX test projects/Landing page test V2`. He ruled **upgrade all three pages**
    (not a fourth page, not a second shelf row) and **keep the §E-ii placeholders**.
    **AC1–AC7 BUILT AND GATED in one session** (s1, 2026-09-11): a stylesheet on `App`, a nav that
    sticks and scrolls by class name, a form that refuses Send until it can, the freelancer's work as
    a filterable list with a case study behind each card, disclosures on the services / the offer /
    the questions, a stepping quote carousel on two pages and a monthly-yearly price toggle.
    21 → 28 components, 375 → 494 nodes, gate 40 → 50 tests, 0 validator errors.
    ⬜ **AC8 — the click-drive — is the only one left, and it is the one a render cannot meet.**
  - 🟢 **[TPL-005 — the pixel game](TPL-005-THE-PIXEL-GAME.md)**, roster #3, **for 0.2.3**. **BUILT, GATED (50/50) AND DRIVEN in one session** — 9 components, 5 rooms, played end to end with real key events; AC7 (demo page) and AC8 (his look) are what is left. It found **four** defects: D40 no ticker, D41 kit registration is co-tenancy dependent, D42 the harness emitted 0 design tokens (**fixed**), D43 a wired `currentState` does nothing — 🔴 **D43 is DISPROVED and replaced by D49 (TPL-006, 09-12)**: the state does change, and what froze this board is a `States` node with `useTransitions` true — the DEFAULT — never publishing a colour. Committed 2026-09-12 as `84ca286e7`, having been left untracked.
    Richard's ask, 2026-09-11: *"something cooler that will show off NodeGX's node graph and power"*,
    explicitly **not a site template** — delivery is **a zip he shares plus a demo page on the
    nodegx.io homepage**. Scoped with him as a **turn-based dungeon crawl**: a tile grid, arrow-key
    movement, coins that raise a score, an exit, and enemies that step only when the person steps.
    🔴 **Turn-based because there is no ticker node in the product** — `Timer` is a one-shot
    `Delay`, and nothing in the std library or the runtime repeats, so a real-time loop would be an
    unmeasured unknown at the bottom of a template. That absence is a **node-library finding for the
    defects register, not something a template fixes**. The keyboard is the
    `keyboard-shortcuts` library module and **must be vendored into the project** or the zip is
    unresponsive on a clean machine. ⚠️ **Every AC here is one a render cannot meet** — a
    screenshot cannot press a key. **Category stays blocked on T3** (`pixel-game` is none of the six
    ruled slugs), which blocks *the shelf*, not this delivery.
  - 🟢 **[TPL-006 — the story engine](TPL-006-THE-STORY-ENGINE.md)**, roster #7 (`interactive-fiction`). Richard's ask, 2026-09-11: *"another cool template … you can build anything with Claude Code today, fine, but **can you go in and edit it afterwards?**"* — picked from four pitches on his stated criterion, **how much new product a person gets per line of JSON edited**. **BUILT, GATED (62/62) AND DRIVEN 2026-09-12**, committed as `a2b53f9c0`: `templates/story-engine/`, 9 components, 88 nodes, **zero `noodl_modules`**, no backend, 0 validator errors, 0 console errors in a browser. Four verbs and no fifth (`goto`, `gives`, `requires`, and an absent `choices` array is an ending), and a `/remix` page whose box **opens holding the story that is playing** — Richard's ruling, *"it's the point"*. 🔴 **AC6 is proved by doing it**: rebuilt with a completely different story, every component graph diffed, **one parameter of one node differs**. It found **three** defects — **D49** (a `States` node with `useTransitions` true, the DEFAULT, never publishes a colour; this **disproves and replaces D43**), **D50** (`uncollapsible-multi-column` warns about content-sized pills and its suggested fix is wrong), **D51** (`typecheck:mcp` red for a day; fixed). **AC7 blocked on the inherited D44/D48 pair; AC8 is his look; the shelf is still blocked on T3.**
- ⬜ **T3** — the **category question**: either extend the ruled vocabulary, or re-file the three
  templates that do not fit it. ⚠️ P75 already found the surface-level cost of getting this wrong —
  the card drew the machine slug `starter` at a person.
- ⬜ **T4** — the remaining site-builder templates, once P77's site-builder work lands. **Do not
  start these while P77 is live** — a peer is mid-SBR-003 on that template.
- ⬜ **T5** — publish as `curated`, and drive the install from a clean launcher.
- ⬜ **T6 — three template fixes owed before publication.** Added 2026-08-29 (s17), when the eleven
  unowned register rows were split: eight are product-surface and went to phase 80 as
  **DEF-018–DEF-025**; these three are **template-side**, so phase 80's own scope rule excludes them
  (*"graded on the product surface… never on a template being fixed downstream of it"*). They are
  small, they are in the template Richard is about to publish, and one of them is on the first
  screen a new moderator opens.
  - 🔴 **[D22] The directory shows the founding moderator's email address as their name, twice.**
    `claimAssociation` never asks a person's name, so it writes the address into `Member.name`.
    **Every install.** The setup form should ask.
  - ⚠️ **[D23] Two different pages are both headed "Members"** — `/members` (the noticeboard) and
    `/directory` (who belongs). The better heading is **already written**: the directory's own
    button says *"Who belongs"*.
  - ⚠️ **[D24] Approve and Decline are touching.** The request row's button pair sets no gap;
    `Pages/Landing`'s pair sets `columnGap: var(--space-3)` and reads correctly. **A pair with no
    gap reads as one object**, and here the two objects are *approve* and *decline*.

  🔴 **If this phase closes with T6 undone, these three must be CARRIED, not dropped silently.**
  An owner naming a closing phase is `NONE` in disguise; T6 escapes that only by running *before*
  publication, which is the whole point of its placement.

  ⚠️ **This is not "new template behaviour work"** — s4's ruling parked the *next* template behind
  publication, not defects in the built one. Richard's standing rule is that appearance is graded
  before behaviour, by looking.

## Delivery: curated, not embedded (settled 2026-08-28)

`shareAsTemplate` files a **submission** and publishes nothing; Richard publishes. That is the
path this phase uses, for two reasons: the curated shelf is **served**, so a published template
reaches everyone already on 0.2.0 with no app update — and a curated template touches **no editor
source**, so phase 78 cannot collide with P77 over `EmbeddedTemplateProvider.ts` or
`ProjectTemplate.ts`. Build the project headlessly through the MCP door (the
`scripts/generate-site-template.ts` pattern); the editor seat is needed **once**, for the share.

## Standing facts

- ✅ The platform half is **deployed**; `ops/deploy.sh` works from a pristine clone.
- ⚠️ Templates are **served**, so each one published appears for everyone already on 0.2.0 — no app
  update. Same leverage as tutorials.
- 🔴 **P77 owns the site-builder template.** This phase takes the *others*, later.
