# Phase 78 — next session

> ### 🟢 2026-09-05 — TPL-003, THE LANDING PAGES: BUILT, GATED, PHOTOGRAPHED, DRIVEN
>
> Richard asked for a third template for 0.2.2 and s4's *"the next template is blocked on the first
> one being published"* was overridden by the person who made it. `templates/landing-pages/`, three
> pages, no backend, a working `mailto:` form. Ruled in the same day and then **EMBEDDED** on his
> ask (`embedded://landing-pages`, beside the site builder — no publish). Full record and an
> eight-row register: [TPL-003](TPL-003-THE-LANDING-PAGES.md). Rides 0.2.2 as P82's **REL-017**.
> **Nothing committed** — pathspecs under REL-017 in P82's `TASKS.md`.
> ⚠️ `templatePins.ts` is the new shared home of the pinning; `tpl001Template.ts` still has its copy
> (register L8) — adopt it the next time the members' area regenerates, with its gate.

## Where it stands

> 🔴 **CORRECTED 2026-08-31 (phase 82, session 1): `T6` IS DONE.** The line below said it was the
> only buildable work left; measured in `templates/members-area/` at HEAD, **all three fixes are in
> the artefact** — they rode in with the TPL-002 / DEF-011 work rather than as a task called T6. See
> the table under item 2. **`T5` (publication) is now the only open item here, and it is unblocked.**
> ✅ *A handoff naming "the only work left" is a claim about an artefact — go read the artefact.*
>
> ⚠️ **T5 is being driven from phase 82** as `REL-001`, sequenced behind the template's look
> (`REL-002a/b/c`). Do not publish from this phase — see
> [`../phase-82-0.2.2-the-first-row-on-the-shelf/TASKS.md`](../phase-82-0.2.2-the-first-row-on-the-shelf/TASKS.md).

**Everything buildable is built except `T6`, three template fixes owed before publication. The
register has no unowned rows left.**

s16 said the phase was finished bar Richard. s17 took that at its word, then re-read the two claims
holding it up. **Both were wrong, in the direction that loses work**: one closed row was owned by a
phase that is closing, and eleven open rows were parked on a sweep that nobody had ever agreed to.

| | after s16 | after s17 |
|---|---|---|
| register rows with a table line | D1–D39 | D1–D39 (unchanged) |
| rows whose owner is `NONE` | *stated* 10, *enumerated* 11 | **0** — 8 to phase 80, 3 to `T6` |
| rows owned by a phase name | 1 (D10 → "phase 78") | **0** |
| rows owned by an unfiled task | 3 (D18, D19, D20) | **0** |
| D10 | 🔴 open | ✅ **FIXED — re-measured** |

⚠️ **No suite was run, and none is implicated: s17 touched no `.ts`, `.tsx` or `.json` — only
markdown in `dev-docs/`.** The last readings stand as recorded: noodl-mcp 959/959, `tpl001Template`
72/72, `typecheck:mcp` clean (s16); the tpl001/tpl002 backend drives 130/130 and 22/22 (s15).

## ✅ What s17 settled

- ✅ **D10 is closed — the generators no longer bypass the design system.** Re-measured on
  `templates/members-area/`, not read off a task file. **0 colour parameters → 555; 2 design tokens
  → 1,197 references across 39 distinct; `metadata.designTokens` absent → present.** The fix has a
  named home, [`tpl001Theme.ts`](../../../packages/noodl-mcp/tests/tpl001Theme.ts), whose header
  quotes D10's own measurement back as the defect it exists to end (`e5922d21` → `e337325c`).
  **D10's own open question is answered too**: it asked whether a preset alone would show, or
  whether nodes must also reference `var(--token)`. It was the sweep, not the one call.
- ✅ **D18, D19 → DEF-017. D20 → DEF-006.** All three were flipped by re-running the test *this
  register itself wrote down* — D20's cell literally said *"grep DEF-006 for `D20` and it is
  absent"*. It is no longer absent. Three greps; they had sat unowned for a day after the work had
  a home.
- ✅ **All eleven previously-unowned rows now have an owner**, on Richard's instruction (*"We need
  to add the defects to phase 80 please"*). They had been named in **zero** files outside the
  register. **Eight are product-surface → phase 80 as `DEF-018`–`DEF-025`**, carried by reference.
  **Three are template-side → `T6` here**, because phase 80 is scoped to the product surface and
  three template edits would have gone behind a product phase's dependencies.

## 🔴 The finding, in one paragraph

**"Phase 80 owns the register sweep" was never true, and it was built out of a sentence about the
past.** s16's prompt parked eleven rows on it. That sentence exists in exactly one place — s16's
prompt. What phase 80 actually records is *"Phase created from the three-register sweep"*: a
**completed** act on 08-29 that produced DEF-001–DEF-017. A phase created *by* a sweep does not
thereby own the *next* one. The rows that sweep did not pick up were left exactly where they were,
and a phase name written in prose above them read like a plan for a day. 🔴 **This is the same
failure as D10's owner cell reading "phase 78"** — a phase name is not an owner once that phase is
closing; it is `NONE` wearing something that parses like a task id.

## Then, in order

1. ⬜ **T5 / publishing. Richard drives it first.** Unchanged since s4. AC1 of TPL-001 is
   ungradeable until the template is on the shelf. **Still the only thing between phase 78 and
   done.**
2. ✅ **`T6` — DONE. Measured at HEAD 2026-08-31**, not relayed:

   | row | claimed defect | at HEAD |
   |---|---|---|
   | D22 | founder's **email address as their name**, every install | `Pages/Setup` asks **"Your name"**; `moderatorName` required at the door — the email fallback carries a comment saying the door makes it **dead** |
   | D23 | two pages both headed "Members" | `Pages/Directory` heads **"Who belongs"**; `Pages/Members` heads "Announcements" |
   | D24 | Approve and Decline touching | `Members/RequestRow` sets `columnGap: var(--space-3)` |

   🔴 **This row read `open` for two days after the artefact was fixed.** The fixes landed under
   TPL-002 / DEF-011 commit messages, so no commit ever said "T6" and nothing re-derived the row.
3. ⬜ **T3, the category question.** Needs Richard. Its constant lives in `ProjectTemplate.ts` —
   ✅ **checked 08-29: clean in the tree, and P77's last commit there (`2cb89446`, SBR-003) has
   landed.** Confirm P77 is done with it before starting, not just that Richard has ruled.

🔴 **Do not start new template behaviour work to fill the gap.** s4's ruling stands: the next
template is blocked on the first one being published and looked at by the person who will publish it.

## ⚠️ Two things about the phase-80 hand-off

- **Nothing was re-authored there.** `DEF-018`–`DEF-025` are a carry table pointing back at this
  register, the same pattern phase 80 already uses for phase 76 — *a second copy of a task drifts
  from the first*. A session picking one up must read the row here.
- **DEF-018/DEF-020 and DEF-022/DEF-023 look like two pairs sharing a cause** (the layout system
  failing silently; a cloud function's model of its own world). Left **unmerged on purpose**:
  nobody has read either pair against each other at the source, and a wrong merge costs more to
  unpick than a right one costs to make later.

## 🔴 Traps this session paid for

- 🔴 **A phase name in an owner cell is `NONE` in disguise, and it survives every check the word
  `NONE` would fail.** Both errors this session were this shape. A sweep grepping for unowned rows
  finds "phase 78" and moves on.
- 🔴 **A scan of the form "from this heading until pattern P" attributes the NEXT row's P to any row
  that simply lacks it.** Reading the eleven rows' `Side:` lines this way reported D22–D24 as
  `product` — they have no such line at all, and the scan ran on into a later section. It had been
  about to send three template fixes into a product-only phase. ✅ **The table was right and the
  clever reading was wrong**; and the failure direction is *looking complete*.
- 🔴 **A relayed conclusion decays into an assignment.** "Phase 80 was created by a register sweep"
  → "phase 80 owns the register sweep" → eleven rows parked. Nothing reddens, because the owner is
  asserted in one file and would have to be honoured in another.
- 🔴 **Derive counts with a command and paste the output.** Three counting errors in this table's
  short life: s15's *"twelve"* (from the sections), the *"eight"* the table would have given, s16's
  *"ten"* beside a list of eleven. The command is now in the register, and it runs.
- 🔴 **A checker that reads a field's history as its value overcounts exactly the rows just fixed.**
  The first run returned **14**, matching the *"(was `NONE`, s17)"* annotations the flips had just
  added. Match the owner cell's **first token**.
- 🔴 **Looking for one delivery path's evidence in the other's artefact finds nothing, and the
  nothing looks like the bug.** s17 read `site-builder.content.json`'s missing `metadata.designTokens`
  as D10 surviving in the second template. It is **correct**: the site builder is **embedded**, so
  `site-builder.template.ts:105` puts the tokens on the `ProjectTemplate` record and
  `EmbeddedTemplateProvider.install` writes them at install. The members' area is **curated**, so
  its palette must be *in* the directory. ✅ **Name the mechanism for each half before reading
  either one's absence as a finding.**
- ⚠️ **Measuring parameters is not grading appearance.** D10 is closed on 555 colour parameters and
  1,197 token references — evidence the generator goes *through* the design system, which is all
  the row alleged. It is **not** evidence the result looks good. That judgement is Richard's and
  the instrument is a screenshot.

## The two harnesses, and when to run them

**The drive** — a gate, runs in the suite:

    npx jest --config packages/nodegx-backend/jest.config.js \
      --runTestsByPath packages/nodegx-backend/tests/tpl002-account-drive.test.ts

**The look** — asserts almost nothing, writes pictures. `.look.ts` so no suite runs it. Run it
whenever you touch the account page, the unsubscribe page or `BAND_NAV`:

    npx jest --config packages/nodegx-backend/jest.config.js \
      --testMatch '**/tests/**/*.look.ts' --runTestsByPath \
      packages/nodegx-backend/tests/tpl002-account.look.ts

`TPL002_OUT=` chooses the directory (default `/tmp/tpl002-look`). It writes a PNG, the page text and
`<label>-<w>.band.txt` — every nav button's rect grouped by its top edge, which is what says how many
rows there are and whether anything is clipped. ✅ **The band was looked at in s15 and is right**: at
1280 five across with "Your account" alone on row two, nothing clipped; 2×3 at 390.

`tpl001-rows.look.ts` is still the only way to see the **lists** with content in them, and is
unchanged. 🔴 **It is also the instrument D10's closure does not have** — see the last trap above.

⚠️ **A member's band has THREE items, not six.** Three of the six are `moderatorOnly` and ship
`mounted: false`. A look taken only as a member measures the wrong screen.

## Richard's rulings, still standing

- **Appearance is an acceptance criterion, graded BEFORE the behaviour work, by looking at it.**
- **D39, 2026-08-29: the unsubscribe page stays one sentence.** Named nothing, links nowhere.
  ✅ Pinned in `tpl001Template.test.ts` §5, so a later session cannot undo it by agreeing with it.
- **Seeding, 2026-08-29: close the delete gap, seed nothing.** AC6's designed empty state stands.
- **Opt-in, never opt-out** — UK and EU charities and congregations.
- **Scope: A + B + all of C, with C done by phase 80.**
- **Templates exist to surface product defects** — findings go in the register **as work with an
  owner**, never as notes. 🔴 *A finding is not filed until it has a line in the table* — and
  🔴 *an owner that names a phase rather than a task is not an owner.*
- **Privacy**: `requestAccess` keeps the non-answer. **Publishing**: not yet. He drives it first.
