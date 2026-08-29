# Phase 78 — next session

## Where it stands

**Track B is finished.** B3 was its last open item and it landed this session: three of the four
repeater lists are now `ruled` rows — a hairline, no fill — and the one that should stay a box does.
Track A, B1, B2 and B4 landed in s8–s11.

| | before s12 | after |
|---|---|---|
| repeater rows wearing `card` | **4 of 4** | **1 of 4** — the request, on purpose |
| eight announcements, page height at 1280 | **1,879px** | **1,199px** |
| six meetings | 1,497px | **1,000px** — the diary fits one screen |
| `tpl001Template` | 64/64 | **67/67** (3 new, 5 sabotages) |
| the three tpl001 drives (real backend, real browser) | 75/75 | **75/75** |

✅ `typecheck:mcp` and `typecheck` (backend) clean · **noodl-mcp 950/950, 69 suites, no reds** ·
generation reproducible (**63 + 6** diagnostics). ⚠️ `test:ci` **not run** — no editor source
touched, deliberately: that isolation is what has kept this phase collision-free all week.

## 🔴 Read this first

- ✅ **[`tpl001-rows.look.ts`](../../../packages/nodegx-backend/tests/tpl001-rows.look.ts) is new,
  and it is the only way to SEE this template with content in it.** Every list draws its empty state
  on a fresh install (AC6, correct), so `render-report` and all three drives read the empty half —
  which is why *"the rows have not been looked at with rows in them"* sat open in §13 for four
  sessions across two rounds of styling them. **No suite runs it**; the `.look.ts` suffix keeps it
  out of `testMatch`. Run it whenever you touch a row:

      npx jest --config packages/nodegx-backend/jest.config.js \
        --testMatch '**/tests/**/*.look.ts' --runTestsByPath \
        packages/nodegx-backend/tests/tpl001-rows.look.ts

  It writes a PNG, the page text and the **row geometry** per page at 1280 and 390. The geometry is
  what caught both layout defects below; a screenshot says something is wrong, the geometry says
  what.
- 🔴 **[D32](DEFECTS-THE-TEMPLATES-FOUND.md) is new and UNOWNED (`NONE`).** Two children of a row
  both grow — which is the *default*, every `width` port starts at 100% — and
  `justifyContent: 'space-between'` then distributes nothing. Generation clean, door silent, an 84px
  button rendered **361px** wide. The door already refuses the neighbouring case (`inert-dimension`,
  a dimension that will never be read) and says nothing about a dimension that will be read by more
  children than the row can satisfy.
- 🔴 **[D26](DEFECTS-THE-TEMPLATES-FOUND.md) is now closed on both halves**, and `raised` — C1's
  other composition — still has **no reader**, with a recorded reason: it only reads on a
  `--surface` ground and every list here sits on `--background`. Grounding one means filling a
  repeater's container, which **§3 of the ratchet forbids** on a measurement. A list rebuilt as a
  true `ui-data-table` (`card` container, `raised` head, `ruled` rows) is reachable and would need §3
  revisited. Not taken — it is a second design, not a completion of this one.

## Then, in order

1. ⬜ **T5 / publishing.** AC1 is ungradeable until it is on the shelf, and **Richard drives it
   first**. Everything else in TPL-001 is measured. This is the only thing between this template and
   a person having it.
2. ⬜ **[D29](DEFECTS-THE-TEMPLATES-FOUND.md), when you are next running the drive anyway.** s11
   built **half**: `Members/Chrome` publishes `isModerator` and the two detail pages consume it.
   What is left is the other five pages dropping their own `Members/Standing` for the band's answer
   — which touches every wire AC2/AC3/AC4 rest on, so it belongs beside a drive, never alone.
3. ⬜ **TPL-002** (the opt-in notifications), and **T3**, the category question. Both untouched.

## 🔴 Traps this session paid for

- 🔴 **A spec can measure the wrong property and still redden on your sabotage.** §7's third spec was
  wrong twice. Draft 1 required a `sizeMode`; deleting it reddened the spec and **the page rendered
  identically** — a `Group` defaults to `explicit`, which assigns the width anyway. Draft 2 named
  `contentSize`, the mode that really drops the width; **the door refuses that outright**, so it was
  a gate for something already rejected. 🔴 **And neither draft could have caught the defect it was
  written for**: the broken row's first child *did* grow — both children did, which was the bug. ✅
  Ask what the number would be **if the defect were present**; if it is the same, you have measured
  nothing.
- 🔴 **Read the generator's exit code, every time.** The `contentSize` sabotage made the door refuse,
  generation exited **1**, the previous artefact stayed on disk, and the render taken straight
  afterwards was of the *healthy* template. It showed no defect and meant nothing. (s11 paid for
  this once already with `>/dev/null`; this time it was an unread exit status.)
- ⚠️ **A gate that regenerates cannot see a design change.** The whole 86-spec suite stayed green
  across all of B3, byte-identity included, because the artefact and the source move together.
  Nothing compared either against a *statement* until §7 was written as literals.
- ⚠️ **Removing a margin can take something else's air with it.** `ROW_CARD`'s `marginBottom` was
  also paying for the gap under the whole list; dropping it left `Pages/Members`' button floating 17px
  under one rule and 24px above another. Hence `afterRuledList()`.
- ⚠️ **Never `git checkout --` to undo a sabotage here** — uncommitted source goes with it. `cp` to
  the scratchpad, `cp` back, verify with `md5 -q`. Five sabotages this session, all restored that way.

## Richard's rulings, still standing

- **Appearance is an acceptance criterion, graded BEFORE the behaviour work, by looking at it.**
  ✅ Honoured: all four lists were rendered with rows and read at 1280 and 390, before and after.
- **Seeding, 2026-08-29: close the delete gap, seed nothing.** AC6's designed empty state is the
  first impression.
- **Scope: A + B + all of C, with C done by phase 80** — not by this phase, because phase 78's
  isolation from editor source is what has kept it from colliding.
- **Templates exist to surface product defects** — findings go in the register **as work with an
  owner**, never as notes.
- **Privacy**: `requestAccess` keeps the non-answer. **Publishing**: not yet. He drives it first.
