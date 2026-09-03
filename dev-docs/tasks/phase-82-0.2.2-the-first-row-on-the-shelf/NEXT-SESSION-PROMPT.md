# Phase 82 — next session

## The board, re-derived from [`TASKS.md`](TASKS.md) at 2026-09-03 20:19 (session 23)

🔴 **Re-derive it again yourself.** This phase has been overtaken four times by a ruling or a row
that landed hours after a handoff was written. **The task files are the board; this section is a
convenience.** ⚠️ s20's handoff said *"there is no fully-buildable row left on this board"* and s22's
said *"every row is CLOSED or waiting on Richard"* — s21, s22 and now s23 all built from rows those
handoffs called finished. ✅ **Read the FINDINGS a row owns, not only its status**, and **run the two
runners a template session never reaches for** (below).

| # | row | state |
|---|---|---|
| 6 / 6b | REL-002c + [REL-010](REL-010-AS-GOOD-AS-THE-PAGE-HE-RATED.md) | ⏳ **RICHARD'S LOOK.** All building done (s15). A session cannot close a person |
| 7 | REL-001 — publish the members' area | ⏳ **RICHARD.** Recommendation unchanged: *fix first, publish once* |
| 8 | REL-004 — cut and tag `v0.2.2` | 🔴 **Blocked**: `cline-dev` unpushed (**660 at 20:19 s23** — re-derive at cut time), CI has run on none of it |
| 9a | REL-011a — the 53 controls | 🟢 CLOSED s17 `d88368c5` |
| 9b | REL-011b — operable on the artefact a person publishes | 🟢 CLOSED s19 |
| **9c** | **REL-011c — the three surfaces reach PASSABLE** | 🟡 **AC1 + AC2 MET s22; the six findings BUILT s22 and the two RESIDUALS BUILT s23. ⏳ AC3 is Richard's ruling and a session cannot award it. The pictures are now OF THE ARTEFACT THAT SHIPS** |
| 10 | REL-009b — the editor sees the write | 🟢 CLOSED s21 |

## 🟢 What session 23 did

Three commits: **`b8d06191`**, **`1784396c`**, **`b88014ee`**. Write-up in
**[REL-011 §REL-011c](REL-011-THE-SITE-BUILDER-SHIPS.md)**.

1. **The count gate P18 s83 registered** — SB-017 acceptance 6, `Expected 38 to be 35`. The three
   movers are REL-011c's breakpoint functions (`/Admin/Shell`, `/Pages/PageEditor`,
   `/Pages/ThemeEditor`), attributed by counting the artefact either side of `86fcbcc6`.
2. **REL-011c's two residuals, built.** The theme editor's preview no longer says *"follow the
   fields on the left"*; `/Site/ContactForm`'s fixed `h2` is gone.
3. **AC3's pictures re-taken** on the fixed artefact, both harnesses exit 0.

### 🔴 1. FIVE literal gates were RED AT HEAD, and four were not this phase's

The one P18 registered was not alone. Found by running the editor's two runners while landing (2):

| gate | read | since |
|---|---|---|
| `tests/cloud/sb017-…acceptance 6` | 38 vs **35** | REL-011c s22 (`86fcbcc6`) |
| `tests-unit/sb-007` disjoint node ids | 401 vs **393** | REL-011b s19 (`3f95a804`), then s22 |
| `tests-unit/sb-018 (3)` the named standing `text`s | `/Site/SectionView body` **undefined** | SBR-005, when `SectionView` became a switch that draws nothing |
| `tests-unit/sb-018 (1)` row ports + repeater-wire census | `DropAt`/`DropIndex` + 3 wires unlisted | **P77 AC2's drag, `12cc718a`, 2026-08-30** |
| `tests-unit/aib-007` the backend-requirement table | `noodl.cloud.listusersinrole` unclassified | **P80/DEF-005 `ab677258`, 2026-08-31 — that phase is CLOSED** |

🔴 **The generalisation, which SB-017's own header records four times without making it:**
`template:site-builder`, the full `noodl-mcp` suite and both look harnesses were **all green with
every one of these red**. None of them can see a literal that lives in `test:main` or `test:ci`, and
those two are exactly the runners a template session does not reach for. ✅ **If you touch
`site-builder.content.json`, you owe `npm run test:main` in `packages/noodl-editor` (≈4 min, plain
Node, safe beside a live stack) and the editor `test:ci`.**

⚠️ **The baseline was re-measured before any of it was believed** — the committed artefact copied
back over the working one read the *same five*, so none was caused by this session's change.

### 🔴 2. The residual was not "two headings", it was a heading the AUTHOR CANNOT EDIT

`/Site/ContactSection` already carries a heading slot wired to the record and mounted on
`showHeading` (`heading !== ''`). `/Site/ContactForm` then drew a **fixed** `h2` reading *"Get in
touch"* one line below it — so a person who typed those three words into the panel, the natural
thing, read them twice. ✅ **Ask of a duplicated string: which half can the author change?** The
other half is the defect.

### ✅ 3. The picture diff is the control, and it was narrow

Of sbr-005's 36 living shots only `kind-contact-*` and `all-five-*-full` moved; every other kind is
**byte-identical**, and `all-five-desktop.txt` differs by exactly one line. On vib-001, `admin-theme-*`
moved by exactly the one sentence and the **door arm's PNGs did not move at all**.
⚠️ **`admin-messages-*` moved and it is NOT a regression** — the seeded enquiries carry a real clock
(`18:27` → `20:15`). Know that before reading a future diff of that page.

## ⬅️ What is left

1. ⏳ **REL-011c AC3 — Richard's ruling**, on `vib-001/2026-09-03/site-builder-{door,living}/` and
   `sbr-005/2026-09-03/site-builder-living/all-five-*`.
   🔴 **Name this for him rather than let him find it: the nav wraps to two lines EVEN AT 1900** —
   seven short items capped to the ~700px reading measure, in `all-five-wide-viewport.png` and
   `kind-*-wide-viewport.png`. It is **deliberately not fixed** ("judged not fixed" on the row) and
   it reads as broken rather than plain.
2. ⏳ **Rows 6, 6b and 7 are Richard's** and have not moved since s15.
3. 🔴 **Row 8 needs a push**: 660 commits ahead of `origin/cline-dev` at 20:19, CI has run on none.
4. ⚠️ **One gate touched by s23's artefact change was NOT run**:
   `packages/nodegx-backend/tests/ac2-page-editor-drag-drive.test.ts` reads
   `site-builder.content.json` and is a real-backend drive of the page editor. s23's change is a
   `Text` removed from `/Site/ContactForm` and one string in the theme editor — nothing on the drag
   path — so it was judged not worth a backend drive, **not** measured. Owner: whoever cuts REL-004.
5. ⚠️ **Registered, owner `NONE`**: `/Site/ContactForm`'s comment block still says *"`/Pages/Site`'s
   page-level contact form stays"* (`sb006Components.ts` ~1242) while a note 750 lines below records
   SBR-005 removing it. The grep says there is exactly **one** placement. Stale prose, not a defect.

## Working rules for this tree — carried forward, plus what s23 earned

1. 🔴 **A LITERAL COUNT GATE ONLY WORKS IF SOMEBODY RUNS IT — and now it is five, in four phases.**
   ✅ Touch the template artefact ⇒ run `test:main` AND `test:ci`, not only `template:site-builder`
   and the mcp suite.
2. 🔴 **RE-MEASURE THE BASELINE ON THE COMMITTED ARTEFACT before believing a red is yours.** Copy
   `git show HEAD:<path>` over the working file, run, read, copy back. s23's five all reproduced.
3. 🔴 **A NAMED ROW IS RE-POINTED, NEVER DELETED.** `sb-018 (3)` named a node SBR-005 had deleted;
   the rule-level arm beside it stayed green through the whole drift, which is precisely why the
   named list exists — a row that is deleted instead of re-pointed says nothing next time.
4. 🔴 **A MUTANT SHOULD GRADE THE PREDICATE, NOT THE ARTEFACT.** s23's first draft asserted a literal
   and reddened on the reverted source *alongside* the claim — reporting one fact twice. Restated as
   *one more than the card really has*, it stays green whatever the artefact does and still proves
   `toEqual([])` is not what a matcher matching nothing returns.
5. 🔴 **A GATE THAT IS GREEN ON THE ARITHMETIC CAN BE GREEN ON A BROKEN SCREEN** (s22). ✅ A layout
   fix is not verified until the picture is looked at; `unreachablePx` is a VERTICAL measure.
6. 🔴 **A PORT CAN BE UNAUTHORABLE UNLESS ANOTHER PORT IS AUTHORED A CERTAIN WAY** — `rowGap` needs
   `flexDirection = column OR flexWrap = wrap`. ✅ When you author a value only to unlock a port,
   WIRE that value too.
7. 🔴 **AN "UNDIAGNOSED" ROW'S OBSERVATIONS ARE USUALLY RIGHT AND ITS INFERENCE WRONG** (s22, A2).
8. 🔴 **A SEED THAT REACHES A STATE THE PRODUCT CANNOT PRODUCE manufactures one defect and hides
   another** (s22, A5). ✅ Ask: which product path writes this shape?
9. 🔴 **COMMIT BY PATHSPEC, NEVER `git add`** — except untracked paths, which a pathspec commit
   **skips silently** (`git status --porcelain | grep '^??'`). ⚠️ `phase-82/README.md`,
   `phase-81/TASKS.md`, `packages/noodl-mcp/tests/sbr011LivePreview.test.ts`,
   `scripts/devtools/render-*.js` and `packages/noodl-types/src/node-catalog*.json` all carry a
   peer's uncommitted work right now; s23 left every one of them alone.
10. 🔴 **`judge()` KEYS ITS OUTPUT BY `today()`** — a re-run overwrites a committed before-arm.
    ✅ Commit first; s23 did, and s22's run is preserved at `86fcbcc6`.
11. 🔴 **NEVER OPEN `templates/members-area` OR the site-builder template IN THE EDITOR.** Work
    through `npm run template:members` / `template:site-builder`, and **regenerate after every source
    edit** — `sb007Template.test.ts` asserts the committed JSON is byte-identical to what the door
    writes.
12. ⚠️ **The Bash tool reaps a `&`-backgrounded pipeline when the call returns.** Use the tool's own
    background mode and gate on an exit file you write yourself — **`timeout` does not exist on this
    Mac**.
13. ⚠️ **The box is shared. Announce a SUITE the same way you announce a launch**, say where its log
    is, and **announce the teardown to everyone you announced the launch to**. s23 traded the box
    with two peers five times on that basis.
14. ⚠️ **`tests-unit/rel-009b/projectFileWatcher.test.ts` has a real-FS timing arm that flakes** —
    it failed once in s23's second full `test:main` and was green on re-run and in the first. A lone
    red there is a flake until re-run.
