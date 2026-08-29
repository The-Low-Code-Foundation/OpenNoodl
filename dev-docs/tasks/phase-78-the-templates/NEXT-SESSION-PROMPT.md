# Phase 78 — next session

## Where it stands

**Every buildable thing in phase 78 is built. What is left is Richard's, and it is not much.**

s16 took the one item s15 left — D39, *"cheap to ask"* — asked it, and closed it. Along the way it
found that the register's own house rule had been broken by the session that wrote it.

| | after s15 | after s16 |
|---|---|---|
| noodl-mcp | 958/958 | **959/959** |
| `tpl001Template.test.ts` | 71/71 | **72/72** |
| `typecheck:mcp` | clean | **clean** |
| register rows with a table line | D1–D35 | **D1–D39** |

⚠️ `test:ci` **not run** — no editor source touched, deliberately, as every session this phase.
The tpl001/tpl002 backend suites and the drives were **not re-run**: nothing this session touched
the artefact or any cloud graph, and the one artefact edit made was a sabotage restored to an
md5-identical file. Their last reading is s15's 130/130 and 22/22.

## ✅ What s16 settled

- ✅ **D39 — RULED. The unsubscribe page stays one sentence.** No change to the artefact. It names
  no association, offers no way back, and that is now a decision.
- 🔴 **But a ruling to change nothing still cost a spec, and this is the reusable part.** Before
  today the page's silence was a property of *what nobody had added yet*. Nothing failed if a later
  session looked at the same screen, reached D39's conclusion independently, and "fixed" it. **A
  ruling names a place; checking that place is a second act.** `tpl001Template.test.ts` §5 *"the
  unsubscribe page fetches nothing and leads nowhere"* now reads it.
- 🔴 **The pair was not one price, and that changed the question.** D39 put the name and the way
  back to Richard as one item at *"the price of one public query"*. Only the **name** costs that —
  a link back is a static `RouterNavigate`, no data, free. Both were declined once priced
  separately, but a pair priced as one is a pair where the cheap half gets decided on the expensive
  half's reasoning.
- 🔴 **D36–D39 had no table line at all.** They were filed as sections the day after the house rule
  that says *"a new row is not finished until this table has a line for it"* — by the session that
  wrote the rule. Now added. See the trap below: this is worse than an unowned row and reads as
  milder.

## Then, in order — and all three need Richard

1. ⬜ **T5 / publishing. Richard drives it first.** Unchanged since s4. AC1 of TPL-001 is
   ungradeable until the template is on the shelf. **This is the only thing standing between phase
   78 and done.**
2. ⬜ **T3, the category question.** Needs Richard, *and* still parked behind phase 77 — T3's
   constant lives in `ProjectTemplate.ts`, which P77 is editing. Check P77 has released it before
   starting, not just that Richard has ruled.
3. ⬜ **D22–D24, D28, D30, D32–D37 are `NONE`.** Ten unowned rows (not twelve — D38 was a harness
   fix and D39 is ruled). **Phase 80 owns the register sweep**, not this phase.

🔴 **Do not start new template behaviour work to fill the gap.** s4's ruling stands: the next
template is not blocked on more features, it is blocked on the first one being published and
looked at by the person who will publish it.

## 🔴 Traps this session paid for

- 🔴 **A row filed as a section but not as a table row is invisible to the sweep that reads the
  table — and it reads as the milder failure of the two.** An unowned row at least appears in the
  count; four rows here appeared in no count derived from the table. s15's *"twelve unowned rows"*
  was derived from the **sections**. Anyone deriving it from the table would have got eight and
  been wrong in the safe direction, which is how this stayed invisible for a day.
- 🔴 **A ruling that changes nothing is the one most likely to be silently reversed**, because it
  leaves no artefact behind — the code after it is byte-identical to the code before, so the next
  reader sees only the thing that prompted the question in the first place.
- 🔴 **Two things bundled into one question get decided at the higher price.** Check what each half
  actually costs before putting a pair to anyone; here one half cost a round trip and the other
  cost nothing at all, and the write-up quoted one figure for both.
- 🔴 **An absence spec needs a known-firing control in the same test, and the control has to be a
  place the same detector fires.** `Pages/Landing` is the one used — the other page a signed-out
  stranger opens, and it does all three of the things `Pages/Unsubscribe` declines. Without it,
  `FETCHES.has('DbColection2')` reads exactly like a page that fetches nothing.
- 🔴 **Node-type absence does not cover a page.** Two of the four sabotages slipped past both type
  filters: a **second** `CloudFunction2` is an already-allowed type, and typing the association's
  name as a `Text` node touches no type at all — and "add the name" is likeliest to arrive as
  words. Pin the call **by name** and pin the strings.
- ✅ **Sabotage the artefact the spec actually reads, not the source that generates it** — then
  restore and check the md5. Four sabotages, four rows reddening alone, one restore verified.

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
unchanged.

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
  owner**, never as notes. 🔴 *And a finding is not filed until it has a line in the table.*
- **Privacy**: `requestAccess` keeps the non-answer. **Publishing**: not yet. He drives it first.
