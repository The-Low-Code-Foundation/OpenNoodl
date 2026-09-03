# Phase 82 — next session

## The board, re-derived from [`TASKS.md`](TASKS.md) at 2026-09-03 20:51 (session 24)

🔴 **Re-derive it again yourself.** This phase has now been overtaken five times by a ruling or a
row that landed after a handoff was written. **The task files are the board; this section is a
convenience.** ⚠️ s20 said *"there is no fully-buildable row left"*, s22 said *"every row is CLOSED
or waiting on Richard"*, s23 said the same of rows 6/6b — and s21, s22, s23 and now s24 all built
from rows those handoffs called finished. ✅ **Read the FINDINGS a row owns, not only its status**:
s24's whole session came out of one clause inside REL-002c's row that three handoffs had summarised
away as *"Richard's look"*.

| # | row | state |
|---|---|---|
| 6 | REL-002c — every page as good as the homepage | 🟡 **The phone column is READ and `/join` is OPENED (s24). Four judgements named for Richard below.** ⏳ Then his look — a session cannot close it |
| 6b | [REL-010](REL-010-AS-GOOD-AS-THE-PAGE-HE-RATED.md) | ⏳ **RICHARD'S LOOK.** AC1–AC5 met s15, AC6 is a person. ✅ **s24 measured that his pictures are NOT stale** — see below |
| 7 | REL-001 — publish the members' area | ⏳ **RICHARD.** Recommendation unchanged: *fix first, publish once*. 🔴 **s24 hands this row one new finding** — the artefact has no headings |
| 8 | REL-004 — cut and tag `v0.2.2` | 🔴 **Blocked**: `cline-dev` unpushed (**665 at 20:51** — re-derive at cut time), CI has run on none of it |
| 9a / 9b / 10 | REL-011a / REL-011b / REL-009b | 🟢 CLOSED s17 / s19 / s21 |
| 9c | REL-011c — the three surfaces reach PASSABLE | 🟡 **AC1 + AC2 met, all findings and both residuals built.** ⏳ AC3 is Richard's ruling |

## 🟢 What session 24 did

One commit. Write-up: **[REL-002c §7](REL-002c-WHAT-I-WOULD-CHANGE.md)**.

Re-photographed all thirteen members-area pages at HEAD (`vib001-members.look.ts`, **`EXIT=0`, 2/2,
60 shots**), read the phone column, and fixed the instrument that could not say what the old
pictures were of.

### 🔴 1. `artefactMd5` hashed ONE file of ninety-eight

The manifest field named *the artefact* and hashed `nodegx.project.json` — **8K of settings against
648K in 97 `components/**` files, where every drawn thing lives.** Measured through `git archive` of
both commits, same script both sides:

```
              at the run's commit (6383ee30)   at HEAD
project.json  f969ad96…                        f969ad96…   ← IDENTICAL
components/   f6c34e1c…                        d92d1972…   ← 19 files differ
```

The other two provenance fields failed differently at the same moment: `headSha` named a commit the
tree **did not match** (the shots were taken from a working tree holding `0e294dd9`'s fix, committed
seven minutes later), and nothing recorded the components at all.

✅ **Built**: `md5Tree()` in [`judge.ts`](../../../packages/nodegx-backend/tests/helpers/judge.ts),
path-ordered with the path hashed alongside the bytes; **`artefactTreeMd5`** in every manifest; the
during-run mutation check widened from 1 file to 98; and the door test's *"the served bytes are the
shipped bytes"* now asserts `components/` against `TEMPLATE_DIR` instead of one file. `artefactMd5`
kept unchanged beside it — callers assert it, and it was never the wrong file, only never the whole
artefact.

### ✅ 2. …and the inference from that was WRONG, which the re-run is what says

*"The pictures are stale, Richard's look is invalidated"* follows naturally from §1 and **it is
false.** Of 120 PNGs: **113 byte-identical**, 7 moved, and all 7 are one page. The only text change
in the entire run is `/directory`'s seeded join date, `2 September` → `3 September`.

🔴 **`/directory` reseeds member join dates from the current date, so its four shots differ from
every other day's run and always will.** The same trap `admin-messages-*` carries on the
site-builder side. Know it before reading a future diff of either.

**So the nineteen-file drift is visually inert, and rows 6 and 6b can be put in front of Richard as
they stand.** A broken pin means you do not know — not that the thing has moved.

### 🔴 3. The phone column: no breakage, four judgements that are his

Thirteen pages, `unreachable=0` on every one, nothing clipped, overlapping or overflowing. `/join`
opens correctly and the living landing holds up at 390 as well as at 1280. **Name these for him
rather than let him find them:**

1. **44.2% of the first phone screen is chrome, on eight of the thirteen pages** — content starts at
   **y=373 of 844**, against **y=275 of 900 (30.6%)** at desktop. Measured off the PNGs, uniform to
   the pixel. The page-head band is 121px at both widths; the difference is entirely the navigation,
   **one row of six pills at 1280 and a 2×3 grid at 390**. On `/requests` the first card begins
   below the halfway line of the phone.
2. **The *"What members can see"* block — three cards, three photographs, ~1100px of phone scroll —
   is on 6 of the 13 pages.** A stranger going `/` → `/join` → `/sign-in` meets it three times.
   **On `/setup` it is the odd one out**: that is the owner's first-run admin task, and below the
   seven-field form it sells them the product they are installing.
3. **`/unsubscribe`'s ~190px void is starker on a phone** — already ruled (D39), named only because
   it is where D39 and *"as good as the homepage"* pull against each other and he is about to look.
4. **`/` and `/members` unauthenticated are byte-identical** — fail-closed working as REL-002b built
   it, with no acknowledgement to a person who followed a deep link.

### 🔴 4. The template ships ZERO semantic tags — registered, NOT built

`Text` carries an `as` port (**Tag**, *Advanced HTML*: `h1`…`h6`, `nav`, `header`, `footer`,
`section`, `p`, `span`). Same recursive command over both shipped artefacts, control firing:

| artefact | files | `as` tags |
|---|---|---|
| `site-builder.content.json` | 1 | **26** — 7 `h1`, 5 `h2`, plus `nav`, `header`, `footer`, `section`, `p`, `span` |
| `templates/members-area/` | 100 | **0** |

Confirmed at render time: **0 of 60 members-area shots carry an `h1`/`h2`**, against **24 of 24**
for the site-builder. So the shelf's first row ships as an undifferentiated pile of `<div>`s — no
document outline for a screen reader, and nothing structural on `/`, `/join` or `/sign-in`, which
are public. The generator sets the tag in exactly one place it does not use: **`pageHead()` in
`tpl001Components.ts`**. No validator covers it (`typographyHierarchy.ts` is the nearest precedent
and is about `fontWeight`).

⚠️ **Not built, deliberately** — it blocks none of REL-002c's ACs, and building it would change the
artefact under the pictures this session just took. **Owner: REL-001**, because it is a property of
the thing Richard is about to publish. **This is the strongest candidate for the next session's
first job**, and it is one seam, not a sweep.

## ⬅️ What is left

1. 🔴 **Build §4 — the semantic tags — then re-run `vib001-members.look.ts`.** One seam
   (`pageHead()`), then `npm run template:members` to regenerate, then `tpl001Template.test.ts`
   (it compares every committed byte against a regeneration). Consider `nav`/`footer`/`section` on
   the chrome while you are in there; the site-builder's `sb006Components.ts` is the worked example.
2. ⏳ **Rows 6, 6b and 7 are Richard's** — and rows 6/6b are now genuinely ready for him: the
   pictures are current, and §3's four judgements are named rather than left to be found.
3. 🔴 **Row 8 needs a push**: 665 commits ahead of `origin/cline-dev`, CI has run on none.
4. ⚠️ **Still not run, carried from s23**:
   `packages/nodegx-backend/tests/ac2-page-editor-drag-drive.test.ts`, a real-backend drive of the
   page editor that reads `site-builder.content.json`. Judged not worth a drive, **not** measured.
   Owner: whoever cuts REL-004.
5. ⚠️ **Registered, owner `NONE`**: `/Site/ContactForm`'s comment block still says *"`/Pages/Site`'s
   page-level contact form stays"* (`sb006Components.ts` ~1242) against a note 750 lines below.
   Stale prose, not a defect.

## Working rules for this tree — carried forward, plus what s24 earned

1. 🔴 **A PROVENANCE FIELD PINS WHAT IT HASHES, NOT WHAT IT IS NAMED AFTER — count the
   denominator.** One file of ninety-eight, and it read as a working instrument the whole way:
   present, a real md5, changing when you expected it to. ✅ `du -sh` the two sides.
2. 🔴 **AN INFERENCE FROM A BROKEN INSTRUMENT IS NOT A FINDING.** *"The pictures must be stale"* was
   wrong and only a re-run could say so. A broken pin means **you do not know**.
3. 🔴 **CHECK WHOSE VERDICT DIRECTORY YOU ARE ABOUT TO WRITE INTO.** `judge()` keys output by
   `today()`, so a control run on one harness overwrote s23's committed AC3 evidence from another.
   All sixteen files were restored from `HEAD`. Commit first, and look before running.
4. 🔴 **A CHANGE THAT ADDS A THROW NEEDS THE OTHER CALLERS RUN.** `md5Tree` throws where nothing
   threw; every importer being a `.look.ts` outside `testMatch` is an argument, not a reading. The
   heaviest caller was re-run: `EXIT=0`, 2/2.
5. 🔴 **A LITERAL COUNT GATE ONLY WORKS IF SOMEBODY RUNS IT** (s23, five gates in four phases).
   ✅ Touch the template artefact ⇒ `npm run test:main` in `packages/noodl-editor` **and** the editor
   `test:ci`, not only `template:site-builder` and the mcp suite.
6. 🔴 **RE-MEASURE THE BASELINE ON THE COMMITTED ARTEFACT before believing a red is yours.**
7. 🔴 **A NAMED ROW IS RE-POINTED, NEVER DELETED** (s23).
8. 🔴 **A MUTANT SHOULD GRADE THE PREDICATE, NOT THE ARTEFACT** (s23).
9. 🔴 **A GATE GREEN ON THE ARITHMETIC CAN BE GREEN ON A BROKEN SCREEN** (s22) — and s24's numbers
   are the sharpest case yet: **every numeric in the phone column read identical on all thirteen
   pages across a nineteen-file artefact change.** Only the picture bytes could see it.
10. 🔴 **A PORT CAN BE UNAUTHORABLE UNLESS ANOTHER PORT IS AUTHORED A CERTAIN WAY** (s22) — `rowGap`
    needs `flexDirection: column` or `flexWrap: wrap`. Wire the value you author to unlock it.
11. 🔴 **COMMIT BY PATHSPEC, NEVER `git add`** — except untracked paths, which a pathspec commit
    **skips silently** (`git status --porcelain | grep '^??'`). ⚠️ `phase-82/README.md`,
    `phase-81/TASKS.md`, `packages/nodegx-backend/tests/sbr011-live-preview-drive.test.ts` and the
    phase-70 files all carry a peer's uncommitted work right now; s24 left every one alone.
12. 🔴 **NEVER OPEN `templates/members-area` OR the site-builder template IN THE EDITOR.** Work
    through `npm run template:members` / `template:site-builder`, regenerating after every source
    edit.
13. ⚠️ **The Bash tool reaps an `&`-backgrounded pipeline when the call returns.** Use the tool's own
    background mode and gate on an exit file you write yourself — **`timeout` does not exist here**.
14. ⚠️ **The box is shared. Announce a SUITE the way you announce a launch**, say where its log is,
    and announce the teardown to everyone you announced the launch to. s24 traded the box with
    `opennoodl-5d` three times on that basis. ⚠️ **`typecheck:backend-tests` cannot complete on this
    16GB box** — CI runs it; never promise a local reading.
15. ⚠️ **`tests-unit/rel-009b/projectFileWatcher.test.ts` has a real-FS timing arm that flakes** — a
    lone red there is a flake until re-run.
