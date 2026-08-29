# Phase 78 — next session

## Where it stands

**Everything buildable in phase 78 is still built. What is left is Richard's — plus eleven rows that
turned out to belong to nobody at all.**

s16 said the phase was finished bar Richard. s17 took that at its word, then re-read the two claims
holding it up. **Both were wrong, in the direction that loses work**: one closed row was owned by a
phase that is closing, and eleven open rows were parked on a sweep that nobody had ever agreed to.

| | after s16 | after s17 |
|---|---|---|
| register rows with a table line | D1–D39 | D1–D39 (unchanged) |
| rows whose owner is `NONE` | *stated* 10, *enumerated* 11 | **11, derived by command** |
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
- 🔴 **Eleven rows are unowned and NOTHING is scheduled to take them.** D22, D23, D24, D28, D30,
  D32–D37. Measured: each is named in **zero** files outside this register — phases 77 and 80
  mention not one of them.

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
2. 🔴 **The eleven unowned rows need a decision, and it is a small one.** They are not phase 80's
   and never were. Either phase 78 closes naming them as **dropped, with a reason** (the house rule
   for closing a phase), or one of them is given a home. **Do not re-park them on another phase's
   name** — that is what this session was created by. ⚠️ Filing into phase 80's directory means
   writing in a live phase's files; a peer held it through s11.
3. ⬜ **T3, the category question.** Needs Richard. Its constant lives in `ProjectTemplate.ts` —
   ✅ **checked 08-29: clean in the tree, and P77's last commit there (`2cb89446`, SBR-003) has
   landed.** Confirm P77 is done with it before starting, not just that Richard has ruled.

🔴 **Do not start new template behaviour work to fill the gap.** s4's ruling stands: the next
template is blocked on the first one being published and looked at by the person who will publish it.

## 🔴 Traps this session paid for

- 🔴 **A phase name in an owner cell is `NONE` in disguise, and it survives every check the word
  `NONE` would fail.** Both errors this session were this shape. A sweep grepping for unowned rows
  finds "phase 78" and moves on.
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
