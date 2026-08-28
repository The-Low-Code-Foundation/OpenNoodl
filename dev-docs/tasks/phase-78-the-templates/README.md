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

## 🔴 First task: find or re-make the list

Richard: *"the other ones from the list we made, can't remember where it is"*.

**It is not in this repository.** Searched this session: `phase-70`, `phase-71`, `phase-76`,
`phase-77`, the P75 task files and the adjacent-markets research. The only concrete set referenced
anywhere is **"Richard's eight 0.2.1 templates"** (P75 `TASKS.md`), which is cited but **never
enumerated** — and P75 separately records that **three of those eight have no honest category** in
the ruled vocabulary.

⬜ **T0 — ask Richard where the list lives, or re-make it with him in one sitting.** Everything else
here is blocked on knowing what we are building.

## Scope

- ⬜ **T1** — the list (above).
- ⬜ **T2** — build the first small batch. Each template is a working project plus a couple of
  sentences of description (the shelf will not publish without them).
  - 🟡 **[TPL-001 — the members' area](TPL-001-THE-MEMBERS-AREA.md)**, `data-app`. Richard's
    choice, 2026-08-28: a members-only site for a charity, club or church — restricted content,
    moderators, meetings, behind a simple public landing page. Chosen **without waiting on T1**;
    it fills the largest category gap (of six ruled slugs only `starter` and `site` are spoken
    for) and doubles as the **control on SBR-001/002**, whose wizard attach has only ever been
    exercised by one template.
  - ⬜ **[TPL-002 — the opt-in notifications](TPL-002-THE-OPT-IN-NOTIFICATIONS.md)**. Split from
    TPL-001 because email needs SMTP config a template **cannot ship** — the shelf's first row
    must not wait on that. Email itself already exists (`Mailer.ts` + the Send Email node).
- ⬜ **T3** — the **category question**: either extend the ruled vocabulary, or re-file the three
  templates that do not fit it. ⚠️ P75 already found the surface-level cost of getting this wrong —
  the card drew the machine slug `starter` at a person.
- ⬜ **T4** — the remaining site-builder templates, once P77's site-builder work lands. **Do not
  start these while P77 is live** — a peer is mid-SBR-003 on that template.
- ⬜ **T5** — publish as `curated`, and drive the install from a clean launcher.

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
