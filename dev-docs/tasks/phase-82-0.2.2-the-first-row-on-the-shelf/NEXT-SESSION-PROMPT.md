# Phase 82 — next session

## The board, re-derived from [`TASKS.md`](TASKS.md) at 2026-09-03 18:3x (session 22)

🔴 **Re-derive it again yourself.** This phase has been overtaken three times by a ruling or a row
that landed hours after a handoff was written. **The task files are the board; this section is a
convenience.** ⚠️ And s20's handoff said *"there is no fully-buildable row left on this board"* — it
was wrong when it was written, and s21 and s22 have now both built from rows that handoff called
finished. ✅ **Read the FINDINGS a row owns, not only its status.**

| # | row | state |
|---|---|---|
| 6 / 6b | REL-002c + [REL-010](REL-010-AS-GOOD-AS-THE-PAGE-HE-RATED.md) | ⏳ **RICHARD'S LOOK.** All building done (s15). A session cannot close a person |
| 7 | REL-001 — publish the members' area | ⏳ **RICHARD.** Recommendation unchanged: *fix first, publish once* |
| 8 | REL-004 — cut and tag `v0.2.2` | 🔴 **Blocked**: `cline-dev` unpushed (**654 at 18:37 s22** — re-derive at cut time; peers commit while you work), CI has run on none of it |
| 9a | REL-011a — the 53 controls | 🟢 CLOSED s17 `d88368c5` |
| 9b | REL-011b — operable on the artefact a person publishes | 🟢 CLOSED s19 |
| **9c** | **REL-011c — the three surfaces reach PASSABLE** | 🟡 **AC1 + AC2 MET s22 `86fcbcc6`; the SIX findings it owned are BUILT. ⏳ AC3 is Richard's ruling and a session cannot award it** |
| 10 | REL-009b — the editor sees the write | 🟢 CLOSED s21 |

🔴 **So every row on this board is now either CLOSED or waiting on Richard.** That was also true when
s20 said it, and it was false then. **Check the findings each open row owns before believing it of
this one** — REL-011c's write-up registers two residuals below, and phase 81 owns A3.

## 🟢 What session 22 did: REL-011c's six product findings, and A2's mechanism

Full write-up: **[REL-011 §REL-011c](REL-011-THE-SITE-BUILDER-SHIPS.md)** (the section headed *"The
six product findings this row owns are BUILT"*). Board row in [`TASKS.md`](TASKS.md). Pictures in
[`phase-81/verdicts/vib-001/2026-09-03/`](../phase-81-the-look-is-the-product/verdicts/vib-001/2026-09-03/)
and `sbr-005/2026-09-03/`; the before-arm is committed at **`d4d3400c`**.

**A1, A2, A4, A5, A6, A7 built**, plus **A8 and A9 found by looking at this row's own after-arm**.
A3 is untouched and stays phase 81's. Gates: `rel011cAdminSurfaces.test.ts` **28/28**, noodl-mcp
**92 suites / 1224 passed exit 0**, `typecheck:mcp` **0**, `template:site-builder` exit 0, both look
harnesses exit 0. **All sixteen admin shots now read `unreachable=0` with a named heading**, from
`admin-page phone 2379`, `admin-theme phone 362` and `headings: []` on all twelve.

### 🔴 1. A2's mechanism was ONE node's EMPTY parameter bag, and every observation on the row was right

The row recorded A2 as *undiagnosed*: *"the fields DO narrow (~763 → ~573px), so it is not a fixed
width, and no node on `/Pages/PageEditor` carries a `width`, `minWidth` or `maxWidth` at all."*
**All three of those were true.** The conclusion they invited — *something has a fixed width* — was
not.

`/Admin/SectionRow`'s `Image preview` was authored as `{ id, type, label, parent }` — **no
parameters at all**. `Image` defaults to `contentSize`, so it rendered at its **source's** intrinsic
width, and `layout.ts:82` leaves everything `flexShrink: 0` unless a percentage size opts it back in.

🔴 **And the arithmetic that ties it to the symptom is worth carrying:** `min-width: auto` on a flex
item is `min(its own stated width, its content minimum)`. `Admin content` carries `width: 100%` and
its content minimum was **1280** (64px padding + the card's 1216). Above 1280 the rail's 240px comes
out of the content column; at or below it, `main` stops shrinking and **the rail is pushed off the
right-hand edge instead**. The fields narrowed and `Save page` did not because **they are two
different boxes and only one was clamped.**

✅ **How it was measured, cheaply**: a throw-away probe in the look harness's own `prepare` hook that
walks the widest-right path from `<body>` and prints every box with its flex arithmetic
(`w / min / grow / shrink / basis / dir / wrap`). Four widths, one run, and the whole chain read off
one log. 🔴 **Deliberately NOT a measure added to `judge()`** — that is A3, and it belongs to phase 81.

### 🔴 2. The render caught a regression the fix shipped, and no number said so

`flexWrap: 'wrap'` was authored on two Groups for one reason: `rowGap` is a **dynamic port gated on
`flexDirection = column OR flexWrap = wrap`** (`group.ts:478`), so on a Group authored as a row the
gap is otherwise unauthorable. The gate was green, every manifest read `unreachable=0`, and the
photographs came back with **Title above Slug at 1280 and 1900** and the theme editor's **live
preview under the fields at 1900**: two children with a 100% flex-basis each take their own line in
a wrap container, at **every** width. The fix had removed the two-up everywhere instead of restoring
it below the fold.

⚠️ The only hint in the numbers was `contentBottom` growing 66px on pages whose text was
byte-identical — and that turned out to be **REL-011a's**, not this. ✅ **Rule 4 of the close
protocol — LOOK at the PNG — earned its keep twice in one session.**

### 🔴 3. A5's photograph showed a FIXTURE defect that was hiding the opposite PRODUCT defect

A5 read *"the gallery card shows a rendered picture **and** 'No pictures yet' at the same moment"*.
Both halves of that screen were real and **neither was the defect**. `/Admin/SectionRow`'s `absorb`
pushes an upload onto `data.images` for a gallery and writes `data.image` for every other kind — so
a gallery built through the product **never has an `image`**, and the seeded `{ image: … }` gallery
was a state the product cannot reach. Underneath it, a **real** gallery showed **no picture at all**
beside a count saying how many there were.

✅ The seed is fixed too, so the picture is not a one-variable comparison — **the one-variable
evidence is the spec**, which runs both data shapes through the same shipped script with the
reverted derivation beside it. It also un-blanked ~150px of the **public** home page, one of the
three states this row re-photographs.

### ⚠️ 4. The sbr-005 before-arm on disk predated REL-011a

The committed `sbr-005/2026-09-03` run was taken at **`2696c850` (10:14)** — *before* the 53 controls
took the palette (`d88368c5`). So the pictures that were on disk showed the site builder with its 25
text inputs **still invisible**, and s22's run is the first photograph of REL-011a on the public
surface. ✅ **Read a verdict directory's `headSha`, not its date.**

## ⬅️ What is left, and none of it is a build

1. ⏳ **REL-011c AC3 — Richard's ruling.** He needs the three SHITTY states at four widths on the
   fixed artefact; they are in `vib-001/2026-09-03/site-builder-{door,living}/` (the door `/`, and
   `/admin/pages` signed in) and `sbr-005/2026-09-03/site-builder-living/all-five-*` (the published
   home page with every section kind).
   🔴 **AC2's job is to name §3 finding 3 for him so he is not asked to notice it unaided: the nav
   wraps to two lines EVEN AT 1900** — seven short items capped to the ~700px reading measure. It is
   in `sbr-005/.../all-five-wide-viewport.png` and `kind-*-wide-viewport.png`, and it is
   **deliberately not fixed** ("judged not fixed" on the row). It reads as broken rather than plain.
2. ⚠️ **Two residuals registered against REL-011c, not built** — both are one string each and both
   are in the write-up: the theme editor's preview says *"follow the fields on the left"*, which A9
   makes false at 390 where they now sit above it; and `/contact-only` draws *"Get in touch"* twice,
   one line above the other.
3. ⏳ **Rows 6, 6b and 7 are Richard's** and have not moved since s15.
4. 🔴 **Row 8 needs a push**: 654 commits ahead of `origin/cline-dev` at 18:37, CI has run on none.

## Working rules for this tree — carried forward, and four earned by session 22

1. 🔴 **A GATE THAT IS GREEN ON THE ARITHMETIC CAN BE GREEN ON A BROKEN SCREEN.** Every
   `flexDirection` arm passed while `flexWrap` silently unstacked the two-up at every width. ✅ **A
   layout fix is not verified until the picture is looked at**, and `unreachablePx` is a VERTICAL
   measure — it reads 0 on a page whose right-hand column is off the screen.
2. 🔴 **A PORT CAN BE UNAUTHORABLE UNLESS ANOTHER PORT IS AUTHORED A CERTAIN WAY**, and the gate is
   at the DOOR, on the authored value, not at runtime. `rowGap` needs `flexDirection = column OR
   flexWrap = wrap`; authoring `wrap` to unlock it is what caused (1). ✅ **When you author a value
   only to unlock a port, WIRE that value too** — the authored one is now a lie about the run state.
3. 🔴 **AN "UNDIAGNOSED" ROW'S OBSERVATIONS ARE USUALLY RIGHT AND ITS INFERENCE WRONG.** A2's three
   recorded facts all held; *"so it is not a fixed width"* pointed away from a node that stated no
   width because it had no parameters at all. ✅ **Re-measure the SYMPTOM before believing the row's
   candidate list** — the widest-right walk found it in one run.
4. 🔴 **A SEED THAT REACHES A STATE THE PRODUCT CANNOT PRODUCE MANUFACTURES ONE DEFECT AND HIDES
   ANOTHER.** ✅ Ask of every fixture row: *which product path writes this shape?* If none does, the
   picture is about the fixture.
5. 🔴 **COMMIT BY PATHSPEC, NEVER `git add`** — except untracked paths, which a pathspec commit
   **skips silently** (`git status --porcelain | grep '^??'`). ⚠️ `phase-81/TASKS.md`,
   `phase-82/README.md` and `packages/noodl-mcp/tests/sbr011LivePreview.test.ts` all carry a peer's
   uncommitted work right now; s22 left all three alone. ⚠️ **An untracked peer spec runs in your
   suite** — s22's "92 suites / 1224" includes one that is not on `HEAD`.
6. 🔴 **`judge()` KEYS ITS OUTPUT BY `today()`** — two look runs on the same day overwrite each other
   silently, and a re-run overwrites a committed before-arm. ✅ Commit before running; for a
   diagnostic run pass `date: DATE + '-something'` and delete the directory afterwards.
7. 🔴 **NEVER OPEN `templates/members-area` OR the site-builder template IN THE EDITOR** —
   `readBundleDirectory` has no skip list. Work through `npm run template:members` /
   `template:site-builder`, and **regenerate after every source edit**: `sb007Template.test.ts`
   asserts the committed JSON is byte-identical to what the door writes.
8. ⚠️ **The Bash tool reaps a `&`-backgrounded pipeline when the call returns.** s22's first look run
   died after ts-jest's warning with no exit file. ✅ Use the tool's own background mode, and gate on
   an exit file you write yourself — **`timeout` does not exist on this Mac**.
9. ⚠️ **The box is shared. Announce a SUITE the same way you announce a launch**, and say where its
   log is. s22 and a peer traded the box four times on that basis and neither lost a run.
