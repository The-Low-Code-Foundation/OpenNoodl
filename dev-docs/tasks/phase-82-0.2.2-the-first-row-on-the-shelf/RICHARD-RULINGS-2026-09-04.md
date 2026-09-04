# Richard's rulings — 2026-09-04

_Given on the [0.2.2 Ruling Sheet](https://claude.ai/code/artifact/aa22ce64-e6da-4c2a-94d7-60bbabeef904),
which carried all 25 screens at four widths. **Shots of record**: the committed
`phase-81/verdicts/vib-001/2026-09-03/{members-area,site-builder}-{door,living}/`._

✅ **The members' area was re-rendered at HEAD `ba1bd3a6` before he was asked to look, because one
commit — `55ce4b5d`, a `pageMain` wrapper inserted into 12 of the 13 pages — had landed after the
09-03 manifests' `headSha`.** `vib001-members.look.ts`, **EXIT=0, 2/2, 60 shots**: **113 of 120 PNGs
byte-identical**, and the seven that moved are all `/directory`, differing only in
`since 3 September` → `since 4 September` — the seed creates its members today. The door arm's
`artefactTreeMd5` is unchanged at `b7b30627`. ⚠️ **That 43 MB run is deliberately NOT committed** —
it is a control, not new evidence, and the shots he ruled on are the committed 09-03 set.
Reproduce with:

```
npx jest --config packages/nodegx-backend/jest.config.js \
  --testMatch '**/tests/**/*.look.ts' --runTestsByPath \
  packages/nodegx-backend/tests/vib001-members.look.ts
```

🔴 **Twenty-four of twenty-five verdicts are below their bar.** Neither REL-002c/REL-010 nor
REL-011c closes on these rulings. This file records what he said; §4 records the two decisions his
rulings force and which are **his, not a session's**.

---

## §1 The verdicts, verbatim

### REL-002c + REL-010 AC6 — the members' area · bar **WORTHY**

| page | state | verdict |
|---|---|---|
| `/` | door | PASSABLE |
| `/sign-in` | door | PASSABLE |
| `/join` | door | PASSABLE |
| `/setup` | door | PASSABLE |
| `/members` | door | PASSABLE |
| **`/unsubscribe`** | door | 🔴 **SHITTY** |
| `/` | living | PASSABLE |
| `/members` | living | PASSABLE |
| `/meetings` | living | PASSABLE |
| `/directory` | living | PASSABLE |
| `/requests` | living | PASSABLE |
| `/account` | living | PASSABLE |
| `/post` | living | PASSABLE |
| `/announcements/{id}` | living | PASSABLE |
| `/meetings/{id}` | living | PASSABLE |

**14 PASSABLE, 1 SHITTY, 0 WORTHY.** Only WORTHY closes, so **REL-002c and REL-010 AC6 both stay
open**, and README §4's close condition 2 — *"landing and one members page WORTHY"* — is **not met**.

⚠️ **This is the third time this template has been read and the second time it has come back at
this grade.** s10, with the after-renders in hand: *"It looks fine (not worthy) but just push it as
V1 of the template, we can't waste more time on this."* s11 reopened it — *"I want all pages looking
as good as the homepage"* — and s12 through s26 built everything that reading named. The grade did
not move. **That is the finding, and it is bigger than any one page.**

### REL-011c AC3 — the site builder · bar **literally PASSABLE**

| screen | state | verdict |
|---|---|---|
| `/` | door | 🔴 SHITTY |
| `/admin/setup` | door | 🔴 SHITTY |
| `/admin/signin` | door | 🔴 SHITTY |
| `/admin/pages` | door | 🔴 SHITTY |
| `/` | living | 🔴 SHITTY |
| `/about` | living | 🔴 SHITTY |
| `/admin/pages` | living | 🔴 SHITTY |
| **`/admin/theme`** | living | **PASSABLE** |
| `/admin/page/{id}` | living | 🔴 SHITTY |
| `/admin/messages` | living | 🔴 SHITTY |

**9 SHITTY, 1 PASSABLE.** The bar was set at PASSABLE on 2026-09-03 — a deliberate relaxation of
`phase-81/README.md` §83, granted so this template could ship in 0.2.2. It fails that relaxed bar on
nine screens of ten. **REL-011c AC3 cannot close, and the site builder cannot ship in 0.2.2 on
these rulings.**

---

## §2 The four judgements (REL-002c §7.3) — all four answered

| # | the judgement | his answer | disposition |
|---|---|---|---|
| 1 | 44.2% of the first phone screen is chrome, on 8 of 13 pages | **Collapse the nav to a menu below 700** | 🟢 **BUILDABLE** |
| 2 | The *"What members can see"* block on 6 of 13 pages | **Leave it on all six** | ✅ **No work.** Declined, on merit |
| 3 | `/unsubscribe`'s ~190px of void above its footer | **Allow a way back after all** | 🔴 **BUILDABLE — and it REVERSES D39** |
| 4 | `/` and `/members` unauthenticated byte-identical | **Send them to `/sign-in` instead** | 🟢 **BUILDABLE** |

### 🔴 §2.1 Judgement 3 reverses D39, and a gate exists precisely to catch that

**D39, 2026-08-29:** *the unsubscribe page stays one sentence; it names no association and offers no
way back, and that is a decision rather than an omission.*

`tpl001Template.test.ts` **§5** (`the unsubscribe page fetches nothing and leads nowhere — Richard's
D39 ruling`) pins it in four ways, with `/Pages/Landing` as a **known-firing control**:

1. no node in `FETCHES` — the half that would name the association;
2. no node in `LEADS_AWAY` — **the half that is now authorised**;
3. exactly one `CloudFunction2`, pinned by name;
4. the page's four `Text` strings, exact.

The spec's own comment predicts this session: *"a link back is free… the cheap half is the one
somebody adds without thinking about the ruling at all."* It is now not somebody not thinking — it
is Richard reversing it. ✅ **So §5 is REWRITTEN to the new ruling, never deleted, and the
known-firing control stays.** Rows 1, 3 and 4 are untouched by his answer.

⚠️ **Only the LINK half was put to him.** The option read *"Allow a way back after all — reverses
D39 for this page; the void closes."* The **name-the-association** half is a round trip from a mail
client and was **not** asked. Default: build the link, leave row 1 asserting no fetch, and say so.

### §2.2 Judgement 3 and the one SHITTY are the same page

`/unsubscribe` door is the only sub-PASSABLE members-area screen, and judgement 3 is the fix for it
in his own words. **That page has a stated why and a stated remedy; the other fourteen have
neither** — see §4.

---

## §3 What the pictures show, read at the same three screens he ruled on

🔴 **This is a session's reading of WHY the site builder came back 9/10 SHITTY, not his stated
reason.** It is a hypothesis to be confirmed or corrected, and it is written down so the correction
has something to bite on. Read from `public-home-desktop-full`, `admin-pages-desktop-full` and
`admin-theme-desktop-full`, living arm.

**The one PASSABLE screen is the one with composition.** `/admin/theme` groups its fields into three
labelled cards (`SITE` / `COLOUR` / `TYPE & SHAPE`), runs a second column with a live preview, and
**fills the viewport**. Nothing else on the site builder does any of the three.

Five things the nine share and the one does not:

1. 🔴 **The framework's default blue on every button, link and pill** — `#1f6feb`, the browser's own
   link colour, on the public site *and* the admin. It is the one colour a form library emits before
   anyone has chosen anything. On `/admin/theme` the same blue reads as intentional because the
   colour **is the subject** of that screen.
2. 🔴 **Ruled rows with outline-secondary pills** on `/admin/pages` — *the literal example the
   rubric names as SHITTY however clearly it reads.*
3. 🔴 **The shell does not fill the screen.** `/admin/pages` living draws ~260px of content and then
   stops, sidebar rule and ground ending mid-air above ~650px of white. Every instrument reads
   `unreachable=0` and is right: the void is **below** the content, not clipped by it.
4. 🔴 **Gradient rectangles where photographs belong.** The public home's hero and both gallery
   tiles are CSS gradients. The members' area draws on **44 real `.webp` files** under
   `noodl_modules/starter-imagery/`; the site builder draws on none.
5. 🔴 **One column, one rhythm.** Every block on the public page is the same width with the same gap
   above it. No density decision anywhere — which is the rubric's question asked and answered.

⚠️ **A1/A2/A4–A7 were all built and all real, and none of them is on this list.** They were
*operability* findings — a shell that folds, a `Save page` inside the picture, one vocabulary for a
section kind. Fixing them moved the template from unusable to usable, which is the floor, **not a
grade**. That distinction is the whole of §1's rubric and this row spent six findings learning it.

---

## §4 🔴 The two decisions these rulings force — HIS, and open

Neither is a session's to take, and **nothing about the look should be built until they are
answered**, because they decide whether the work exists at all.

### D1 — Does the site builder come off 0.2.2?

Nine of ten screens fail a bar that was already relaxed for it. The hold lifted on 2026-09-03 was
granted on the expectation that PASSABLE was reachable this cut.

- **Back on hold** (a session's recommendation): it returns to the state it was in until 09-03 — not
  in `templates/`, never staged, **so holding costs no action**. Owner after 0.2.2 is already named
  in README §3: **phase 77**. 0.2.2 loses nothing it had on 08-31.
- **Fix it for this cut**: nine screens against §3's five shared seams. The seams are shared, which
  makes it cheaper than nine screens sounds — but it is a look round on a template that has had
  three, and the grade has not moved on the other one.

### D2 — Does the members' area publish at PASSABLE?

- **Publish as V1** — which is what he said at s10 before reopening. Close condition 2 would be
  **amended, in writing, to PASSABLE**, not quietly ignored.
- **Another round** — then it needs §4.1, because three rounds have not moved this grade.

### 🔴 §4.1 What a fourth round would need that the first three did not

**A named seam, from him, before anything is built.** Close protocol rule 6 already says this: *"If
not WORTHY, the why is mandatory work, not commentary — name the seam that blocked it."* Fourteen
PASSABLE verdicts arrived with **no why**, and a session cannot supply one without inventing his
taste. s12–s26 built every seam the *sessions* could name; the grade did not move. **That is
evidence the remaining seam is one only he can name.**

⚠️ Asking him for fourteen reasons is the wrong ask. **One** would do it: the page he would hold up
as *nearly* worthy and the single thing keeping it there.

---

## §5 What is buildable today, whatever D1 and D2 say

Three of the four judgements are answered, are members-area work, and **none of them waits on D1 or
D2**:

| # | work | note |
|---|---|---|
| 1 | Collapse the nav to a menu below 700 | 8 of 13 pages, ~200px back on every phone screen |
| 3 | A way back on `/unsubscribe` | **`tpl001Template.test.ts` §5 must be rewritten to the new ruling** — §2.1 |
| 4 | `/members` unauthenticated navigates to `/sign-in` | Currently byte-identical to `/`; REL-002b's fail-closed stays, the destination changes |

⚠️ **Judgement 3's work also lifts the one SHITTY.** It does not make the page WORTHY and nobody
should claim it does.
