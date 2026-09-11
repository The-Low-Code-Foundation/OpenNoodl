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

### 🟢 D1 — CLOSED 2026-09-05: **the site builder ships in 0.2.2 and is on the shelf**

> **Richard, 2026-09-05**, shown the two seams he had named built and photographed against a
> one-variable before-arm: *"It's passable, let's include it in the 0.2.2 release, add it to the
> templates menu."*
>
> That is **REL-011c AC3** — the ruling this row was waiting on — and it closes D1. `site-builder`
> is out of `HELD_TEMPLATE_IDS`; `hello-world` stays in it, for the separate and unchanged reason
> that it is the blank project. The create wizard and the Templates tab now draw one embedded row.
>
> 🔴 **What moved his answer was the product, not the photography, and that distinction was nearly
> lost.** The nine SHITTY verdicts of 09-04 were taken on pictures the harness had supplied its own
> blue and gradient rectangles to (§8). The hand-off that followed the seam work pointed at those
> same 09-03 pictures as the comparison to re-show him — which would have credited the two seams
> with the instrument fix. The before-arm was rebuilt so the pair moves the seams and nothing else
> (**REL-011 §12**), and the ruling was taken on that pair.
>
> ⚠️ **Only the site builder was ruled on.** VIB-009 and P77's unbuilt tasks were not put to him and
> are not affected by this.

**The 2026-09-04 answer, superseded and kept:** *back on hold.* README §3's hold list was
**reinstated**, unchanged, with the site-builder template, VIB-009 and P77's five unbuilt tasks in
it.

🔴 **CORRECTION, 2026-09-04, from Richard's own testing pass — "holding costs no action" was FALSE,
and it was false about the EDITOR.** The template sat in `EmbeddedTemplateProvider`'s map and
`list()` returns the whole map, so **every 0.2.2 user would have been offered the held template in
the create wizard.** The reasoning below is right about `templates/` and the community shelf and was
never checked against the shipped app — a two-population claim asserted from one population.
✅ **Fixed by the testing pass**: `HELD_TEMPLATE_IDS`, one line, gated by
`template-needs-backend.test.ts`; phase 77 unholds it by deleting one string. See
[`TESTING-PASS-2026-09-04.md`](TESTING-PASS-2026-09-04.md) §1.2.

⚠️ **The superseded reasoning is kept below rather than deleted**, because it is the shape of the
mistake: *"it is not in `templates/`"* is a fact about the community shelf, and the sentence it was
used to support was about everything that ships.

⚠️ ~~**Holding costs no action**~~ —
it is not in `templates/` and has never been staged for publication, so the risk this addresses is
not an accidental publish but the row being rediscovered at full price. REL-011c AC3 does not close;
it goes with the template.

🔴 **What this does NOT undo.** A1/A2/A4–A7, the outline work and the two residuals are **built and
gated and they stay** — they are operability fixes on a template phase 77 inherits, and the gates
(`rel011cAdminSurfaces.test.ts`, `sb007Template` §12, `sbr010` §7, `ac2-page-editor-drag-drive`) go
with it. The hold is about **shipping in 0.2.2**, not about the code.

#### The original framing, kept



Nine of ten screens fail a bar that was already relaxed for it. The hold lifted on 2026-09-03 was
granted on the expectation that PASSABLE was reachable this cut.

- **Back on hold** (a session's recommendation): it returns to the state it was in until 09-03 — not
  in `templates/`, never staged, ~~**so holding costs no action**~~ — **false about the editor, see
  the correction above**. Owner after 0.2.2 is already named
  in README §3: **phase 77**. 0.2.2 loses nothing it had on 08-31.
- **Fix it for this cut**: nine screens against §3's five shared seams. The seams are shared, which
  makes it cheaper than nine screens sounds — but it is a look round on a template that has had
  three, and the grade has not moved on the other one.

### ✅ D2 — ANSWERED 2026-09-04: **publish as V1 at PASSABLE**

**Richard's answer: publish as V1.** ✅ **README §4's close condition 2 is AMENDED IN WRITING**, not
quietly ignored: the clause now reads *PASSABLE on every page, with the one SHITTY page fixed
first*. **WORTHY becomes the V2 brief.**

🔴 **So `/unsubscribe` is now on the launch path, not beside it.** Judgement 3's work is the
condition attached to this answer — nothing ships below the bar — which makes §5 row 3 the **first
job**, before the publish command runs.

#### The original framing, kept



- **Publish as V1** — which is what he said at s10 before reopening. Close condition 2 would be
  **amended, in writing, to PASSABLE**, not quietly ignored.
- **Another round** — then it needs §4.1, because three rounds have not moved this grade.

### ✅ §4.1 THE SEAM, NAMED BY HIM 2026-09-04 — and it is the V2 brief

Asked what single thing keeps the living landing page off worthy, having declined all three of the
session's candidate readings:

> **"It still looks like a standard Wordpress bootstrap template, there's nothing modern CSS about
> it."**

🔴 **This is the same sentence he opened the phase-81 baseline with** — *"they still look like
original Wordpress default templates"* — arriving unchanged after three rounds of work. **That is
the finding.** The rounds moved presence readings (display type, ground variety, photography,
landmarks, alignment) and did not touch it, because none of them was about the seam.

⚠️ **It is a seam, not yet a task, and it must not be turned into one by guessing.** *"Nothing
modern CSS about it"* names a class of technique, and this runtime draws through `Group`/`Text`
nodes onto flexbox — so the **first** piece of V2 work is measuring **which modern CSS the runtime
can actually reach and author**, not picking effects off a list. Candidates worth measuring rather
than assuming: fluid type with `clamp()`, `aspect-ratio`, container queries, `subgrid`,
`backdrop-filter`, `mask-image`, blend modes, scroll-driven animation, `text-wrap: balance`.
🔴 **A candidate the runtime cannot express is not a V2 item; it is a runtime task.**

⚠️ **He explicitly declined three readings a session offered** — generic stock photography, one
typeface doing every job, and the narrow left column. **Do not build them.** They were the
session's, they were wrong, and recording that they were put and refused is what stops the fourth
round rediscovering them.

### 🔴 §4.2 What a fourth round would need that the first three did not

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

---

# §6 🔴 JUDGEMENT 3 IS BUILT — and it did NOT close the void it was asked to close

Built the same day, because D2 attached it to the publish as a condition.

## §6.1 What is in

| | |
|---|---|
| `Pages/Unsubscribe` | a `back` row inside `ground`, holding one **outline** button *"Sign in to your account"*, wired to a `RouterNavigate` at `/Pages/SignIn` |
| vocabulary | `UNSUBSCRIBE_BACK_LABEL`, with D39's reversal recorded on the constant |
| `tpl001Template.test.ts` §5 | **rewritten to the new ruling, not deleted** — see §2.1 |
| `tpl002-account-drive.test.ts` §6b | **new** — the press, in a real browser |

⚠️ **Deliberately the OUTLINE button.** Both notices already end by telling the reader to use their
account, so this is the route they were just sent on rather than the point of the page. `btn()` keys
the variant on the label, so the label staying out of `PRIMARY_LABELS` is what makes that true.

## §6.2 The readings, with their exit statuses

| gate | reading |
|---|---|
| `tpl001Template.test.ts` | **79/79, EXIT=0** (78 before) |
| the same file, on the **reverted artefact** | **EXIT=1** — §5 reads `Received length: 0` where it wants 2, and the AC7 byte-identity spec reds too, as it should |
| `noodl-mcp` full jest | **93 suites / 1257 tests, EXIT=0** |
| `tsc --noEmit -p packages/noodl-mcp` | **0, EXIT=0** |
| `tpl002-account-drive.test.ts` (real backend, real browser) | **23/23, EXIT=0** (22 before) |
| `vib001-members.look.ts` | **EXIT=0, 2/2, 60 shots** |
| `noodl-editor` `test:main` | **412 suites / 6847 tests, EXIT=0** |
| `noodl-editor` `test:ci` | **2943 specs, 4 failures, seed 79804, HEAD `871becf3`** — the AIX-006 floor, all four **by name**. Fresh `tests/test-results.json`, `gitHead` matching, `elapsedSeconds` 70 |

🔴 **The reverted arm was measured, not asserted.** The fixed artefact was snapshotted with `cp`,
the committed one restored with `git archive`, the spec run, and the snapshot restored — `git
checkout --` and `git stash` are both forbidden on this checkout.

## §6.3 🔴 TWO traps this session walked into, both already in the register

1. **`LEADS_AWAY` holds the CONTROL as well as the NAVIGATE.** D39 declined both halves of a way
   out, so a spec expecting one node read `Received length: 2` and was **right to**. Fixed by
   counting the pair as a pair.
2. 🔴 **The door renamed `toSignIn` to `toSignIn-3`** — project-wide id uniqueness, the same
   mechanism that pinned s28's D42 to a `#pick` a preset chip had taken. **Both ends of the wire are
   derived from the graph; neither is typed.**
4. ⚠️ **A `cd` that outlived its command made a present file read as MISSING.** The readout was
   checked from inside the phase directory, reported `No such file or directory`, and was briefly
   written up as *"the runner says it wrote the file and it is gone"* — a hazard about a peer that
   did not exist. ✅ **The log's own `Readout:` line names an ABSOLUTE path; read it from there.**

3. 🔴 **The first draft of §6b put a throwing `clickButton` inside `beforeAll` — and all 23 specs
   went red on a missing import.** *A `beforeAll` that throws runs no arm* (s28). The press is now
   wrapped, the message carried, and **§6b is the one spec that reads it** — so a button that
   vanishes reddens one spec and leaves the other twenty-two meaning what they say.

## §6.4 🔴 THE VOID IS STILL THERE, AND THAT IS THE HONEST READING

`unsubscribe-desktop`, door arm, at HEAD: **content=900px, scroll=NO, unreachable=0**. The button
sits under the notice and the footer begins about **220px** below it. §7.3 named *"~190px of void
above its footer"* and the option he chose was worded *"the void closes"*.

**It did not close.** A 60px control was added to a 190px gap.

## ✅ §6.5 SECOND LOOK, 2026-09-04 — **PASSABLE**

Given on the ruling sheet's step 00, against the four shots in
`verdicts/rel-002c-unsubscribe/2026-09-04/`:

> **"Unsubscribe is passable now."**

🔴 **So D2's condition is MET and the publish is unblocked.** The members' area now reads **15
PASSABLE, 0 SHITTY, 0 WORTHY** — no page below the amended bar, which is exactly what close
condition 2 was amended to require.

⚠️ **He ruled it PASSABLE with the void still measuring ~220px**, having been told so in the same
breath. So the remaining slack is **not** an open defect on this row: it is a second consequence of
a ruling, like the void itself was. **Do not "fix" it without asking him** — that is the mistake s12
made with the link, one ruling earlier.

✅ **What DID happen is the thing he actually asked for**: the page offers a way back, which is D39
reversed and is the only remedy any verdict on this page arrived with. Whether that is enough to
lift `/unsubscribe` off SHITTY is **his call and nobody else's** — and it is the condition D2
attaches to the publish, so **it must be re-ruled before the publish command runs**.

⚠️ **Registered while looking, owner `NONE`, NOT built:** the page has **three left edges** — the
band's eyebrow and the content column at x≈305 (`FORM_GROUND`'s 720 centred), the footer at x≈65.
That is the same defect REL-002c §"three different left edges" fixed on `Pages/Post` and
`Pages/Account`, surviving on a door page nobody re-measured after the band went on.

---

# §7 🔴 JUDGEMENT 1 IS BUILT — 174px back on every chrome page

Built after `/unsubscribe` was re-ruled PASSABLE and the publish was cleared.

## §7.1 The mechanism, and the two things it is deliberately not

`Members/Chrome` gains a `Screen Resolution`, a `States` (`Closed,Open` → `navOpen`), a `Menu`
button and one `JavaScriptFunction`, `bandShape`.

🔴 **`navWrap.mounted` still has exactly ONE producer.** REL-002b's fail-closed gate used to reach
that port straight from `standing.isSignedIn`, and `nav`'s own note already warned that a second
`mounted` on this branch *"would be a twin of that gate"*. So the signed-in fact, the width and the
open state all arrive at `bandShape` and leave as one value. A signed-out reader gets no nav at any
width, because `signedIn` gates the whole expression — unchanged and unduplicated.

🔴 **The top row still has TWO children.** `BAND_NAV`'s note records why: *"a third child in the top
row would be [a new layout mechanism], and D32 is what happens when one is added without looking."*
The `Menu` control therefore joins `Sign out` inside a new `actions` group.

🔴 **An unknown width is WIDE here, and that is the OPPOSITE of `sb005`'s `fold`, on purpose.**
`Screen Resolution` is client-only, so a server render measures nothing. `fold` returns early
because *its* authored shape is the wide one. `navWrap` is authored `mounted: false`, so an early
return here would have left the nav off on every server render — the band losing its six ways on for
anybody whose first paint is the server's.

⚠️ **Choosing a destination closes the menu** — six wires from each nav item's own click to
`to-Closed`. Without them the panel stands over the page it just opened, which is the same screen
judgement 1 exists to give back, arriving one tap later.

## §7.2 What it bought, measured

Phone (390) full-page heights, before → after, from the harness's own `SHOT` lines:

| page | before | after | |
|---|---|---|---|
| `/members` | 1555 | **1381** | −174 |
| `/post` | 1474 | **1300** | −174 |
| `/requests` | 1060 | **886** | −174 |
| `/directory` | 1229 | **1055** | −174 |
| `/meetings` | 1005 | **844** | −161, and it **stops scrolling entirely** |
| `/account`, `/announcements/{id}`, `/meetings/{id}` | 844 | 844 | already inside one screen; the number cannot move |
| the six door pages, and `/` | — | — | carry no chrome band. Correctly unchanged |

🔴 **The number moves on five of nine chrome pages, and the fold applied to all nine.** A census over
the text dumps is what separates those two: **`Menu` on 8 of 8 chrome pages, and 0 nav items on any
phone page**. (`/` shows no `Menu` — it has a hero, not the band, which is the control.) Reading
*"five pages changed"* as *"the fix reached five pages"* would have been wrong in the safe direction.

Derived, not measured directly: §7.3's *"content starts at y=373, 44.2% of the first screen"* becomes
**y≈199, about 23.6%** — 373 minus the measured 174.

## §7.3 The readings, with their exit statuses

| gate | reading |
|---|---|
| `tpl001Template.test.ts` | **79/79, EXIT=0** |
| the same, before the tally was moved | **EXIT=1** — `D7/D16 … gated with visible` read **54, expected 53**. The literal count gate caught the new node, which is what it is for; the tally moved to 54 **with its reason** |
| `tpl001-members-drive.test.ts` (real backend, real browser) | **64/64, EXIT=0** (63 before) |
| `noodl-mcp` full jest | **93 suites / 1257, EXIT=0** |
| `tsc --noEmit -p packages/noodl-mcp` | **0, EXIT=0** |
| `vib001-members.look.ts` | **EXIT=0, 2/2, 60 shots** |
| `noodl-editor` `test:main` | **412 suites / 6847, EXIT=0** |
| `noodl-editor` `test:ci` | **2943 specs, 4 failures, seed 15995, HEAD `d9b9e628`** — the AIX-006 floor, all four by name, fresh readout |

⚠️ **§11's press is wrapped and its failure carried**, the same shape §6b ended up in: `clickButton`
throws, it runs in `beforeAll`, and **a `beforeAll` that throws runs no arm**. A broken fold reddens
one spec, not sixty-four.

## §7.4 ⚠️ What is NOT built

1. ~~**Judgement 4**~~ — ✅ **BUILT 2026-09-05, session 40. See §9.**
2. **The pictures have not been re-ruled at PASSABLE.** The fold changes eight phone screens he
   graded. Nothing here claims his verdicts carry over; they were given on the pre-fold shots, and
   the amended close condition is met on those.

---

# §8 🔴 TWO MORE RULINGS, SAME DAY, ON REL-015's PEOPLE DIRECTORY

Asked at the top of session 33, because REL-015 shipped both questions as **open consequences** and
the first of them decided whether the editor button being built that session would work for him on
the day it shipped. Both were put with the cost of each option stated. His answers, verbatim as
chosen:

| # | question | ruling |
|---|---|---|
| **D3** | `listDirectory` ANDs the approval **with** `profile_meets_bar()`, so approval is *necessary and not sufficient* — he and Dishant could be approved and still not appear, for want of a `building`/`learning` award | 🔴 **DROP THE BAR FROM `listDirectory`.** Approval alone lists you |
| **D4** | `/u/<handle>` (`publicProfile`) gates on visibility alone — it never honoured the bar and did not honour approval either, so an unapproved member is reachable at a guessable URL | 🔴 **GATE IT ON APPROVAL TOO.** *Nothing is VISIBLE until I allow it*, not merely *nothing is LISTED* |

## §8.1 D3 — what it reverses, and what it deliberately does not

REL-015 built the conservative reading of its own AC2 (*"AND-ed with, never replacing"*) and said
so in five places, each naming this as the one-line change if he ruled the other way. He did.

✅ **`profile_meets_bar()` IS NOT DROPPED, NOT REDEFINED, NOT NARROWED — AC3 HOLDS UNCHANGED.** One
predicate left one query. The function still governs its four other callers, none of which moved:
`listOffers`/`isOfferListed`, the coach queue (UNI-017 AC4 — gated by it *"and by nothing else"*),
the `rfp_response_gate` trigger, and `profileBar`. **Who may answer an RFP is exactly what it was.**

⚠️ **What it costs, said plainly:** nothing automatic keeps a thin profile off `/people` any more.
The reviewer running `approve-listing.ts show <handle>` is the only thing between a one-line bio and
the directory — the script still **prints** the four bar conditions, it just no longer enforces them,
and its header now says so.

## §8.2 D4 — the cost he was told about, and the one he was not

The leak D4 closes is real: a member could tick *"list me"*, sit in the queue, and be readable at
`/u/<handle>` the whole time.

🔴 **The cost that goes with it is larger than the question implied, and it is recorded here rather
than buried.** `listing_status` defaults to `unlisted`, so **a member who sets their profile public
and never asks to be listed now has no page at all — including for themselves**, since `/u/<handle>`
has no viewer. UNI-003 AC1's *"the page is the owner's toggle and nothing else"* is no longer true:
there are two toggles and the second one is his.

✅ **The product says so on the one screen where somebody would go looking.** `AccountForm`'s copy
was rewritten in all four listing states — it previously told a waiting member *"your page at
/u/<handle> is already live — this is only about the directory"*, which D4 turned into a lie.

## §8.3 Where the reversals are written down

Both rulings reverse recorded decisions, so both are recorded **beside the code**, on the D39/D8
precedent — never quietly deleted:

* `listDirectory` — the removed predicate's whole argument is kept and answered in place.
* `publicProfile` + `hasPublicProfile` — the "deliberate non-gate" note is rewritten, not removed.
* `0025_rel015_listing_approval.sql` — safe to amend, it had **never been applied**.
* `people/page.tsx`, `coaching.ts`, `apisurfaces.ts`, `lists.ts`, `schema.ts` ×2, `seed.mjs`,
  `approve-listing.ts`, `settings/page.tsx` — nine sentences that the rulings made false.
* `uni003`, `uni023`, `nat006` and `rel015` — four **specs inverted rather than deleted**, each
  keeping the old sentence so the reversal is readable where somebody would look for it.

⚠️ **`0003_uni003_profiles.sql` is STILL not amended**, for REL-015's reason: it is applied in
production and `migrate.ts` checksums migration bytes, so a comment-only edit stops the next deploy.

---

# §9 ✅ JUDGEMENT 4 IS BUILT — the last of the four, and the only one that gates nothing

Built 2026-09-05, session 40, off §5's third buildable row and §7.4's *"answered by him, unbuilt"*.

## §9.1 What he was shown, and what he answered

REL-002c §7.3 item 4, verbatim: ***"`/` and `/members` unauthenticated are byte-identical** — fail-closed
working as REL-002b built it. A person who followed a deep link to `/members` is shown the landing
page with no acknowledgement they were moved."*

His answer: **"Send them to `/sign-in` instead."**

## §9.2 What is in

| | |
|---|---|
| `tpl001Components.ts` | the six protected pages' refusal navigator: `target` `/Pages/Landing` → `/Pages/SignIn`, and a label that says so |
| `templates/members-area/` | regenerated — **6 files, 12 lines, and nothing else** |
| `tpl001Template.test.ts` §5b | **new** — three rows pinning the destination, with two controls |
| `rel002b-fail-closed.test.ts` | every `landed` assertion moved, **+1 new**: the door is *painted*, not merely addressed |
| `tpl001-refused-query.test.ts` | its observable is now **derived from the artefact** instead of typed |

🔴 **REL-002b IS UNTOUCHED, and that is the whole shape of this change.** Same `Denied` signal, same
two producers (`decide` on a `visitor` answer, `failed` when the server could not be asked), same six
pages, same fail-closed. **Only the destination moved.** §5's row predicted exactly this — *"REL-002b's
fail-closed stays, the destination changes"* — and the diff is the evidence: `connections.json` is
byte-identical on all six pages; only `nodes.json` moved.

⚠️ **`Members/Chrome`'s own navigator is deliberately NOT changed.** It is where `Sign out` lands, and
signing out is not a refusal — a person who chose to leave has not been moved anywhere they did not
ask to go. It still goes to `/Pages/Landing`, and §5b's second control is what says so.

## §9.3 🔴 The node id stays `toLanding`, and that is a measurement rather than a preference

The obvious tidy-up — rename the six to `toSignIn` — was **measured and rejected**:

1. **Ids are unique PROJECT-wide.** The artefact already carries `toSignIn`, `-2`, `-3`, `-4`, and
   `toLanding` through `-7`. Renaming six would renumber every existing `toSignIn-N` **by component
   authoring order** — the same class as s28's `#pick` and §6.3's `toSignIn-3`.
2. 🔴 **`tpl001-refused-query.test.ts` addresses this exact node by literal id** when it pushes its
   twin's wire. A rename would aim that wire at a node that does not exist; the arm would navigate
   nowhere, and *"the refused arm did not move"* reads as **"a refusal is SILENT to the graph"** —
   the exact inverse of D4's recorded answer, arrived at without one line of the platform changing.
3. The id is **not user-facing**. The label is, and the label was changed.

✅ **The spec is now immune to the whole class**: `refusalDestination()` reads the navigator's
`target` off disk and follows it to that page's `urlPath`, so the expected URL is derived in two hops
from the artefact. A future retarget moves the spec with it instead of silently inverting its verdict.

## §9.4 🔴 The byte gate could not have caught this, which is why §5b exists

`tpl001Template.test.ts` §1 asserts the committed artefact is byte-for-byte what the generator
writes. **That is green for any destination**: revert the generator, regenerate, and §1 passes. A
ruling held only by a comment is held by nothing, so §5b grades the destination itself — and derives
the six pages from the graph (every `Denied` wire that reaches a `RouterNavigate`) rather than
listing them, so a seventh protected page with a wrong ejection reddens instead of passing.

**Proved by a reverted arm, not asserted.** The generator's six targets were put back to
`/Pages/Landing` — *the behaviour mutated, the surface kept* — and regenerated, so the byte gate
stayed green and only the ruling could speak:

| arm | reading |
|---|---|
| built | **82 passed, 82 total, EXIT=0** |
| **reverted** | **EXIT=1 — 1 failed, 81 passed, 82 total**, and the failure is `and every one of them goes to the sign-in page` |
| restored | **82/82, EXIT=0**, generator `md5 9b109f9d…` identical, artefact `diff -rq` clean |

🔴 **All 82 ran in the reverted arm.** A revert that will not compile grades nothing (§D3 of the
previous hand-off); 81 + 1 = 82 is the reconciliation that says this one did.

⚠️ **The six-page control passed in BOTH arms**, correctly reporting that the wiring was never
touched — the same shape as SB-007 last session, and the reason the two rows are separate.

## §9.5 🔴 REGISTERED, owner `NONE` — what judgement 4 costs the unbound first run

**Measured, not predicted:** `rel002b-fail-closed.test.ts`'s `unbound` arm now lands on `/sign-in`
on all six pages, and it passes there.

With **no backend bound**, a deep link to `/members` used to land on `/`, which is the page carrying
REL-002b's waiting card — *"This members' area is not connected yet"*. It now lands on a real,
painted sign-in door **whose form cannot work, because there is nothing to answer it**. The card is
still there and still correct; it is simply no longer on the page an ejection reaches.

⚠️ **This was NOT put to him and has NOT been built around.** The remedy would be to split the
destination by producer — `decide` → the door, `failed` → the card — and that reverses REL-002b's
*"the refusal is unconditional"* on a reading **nobody asked for**. His judgement was about a
visitor handed the landing page with no acknowledgement, and that is what was built. Recorded here,
in the spec beside the assertion, and left for him.

## §9.6 ✅ It cannot loop, and that was checked rather than assumed

A refused reader sent to a gated door would bounce for ever. `Pages/SignIn` places **no
`Members/Chrome`, no `Members/Standing` and has no `Denied` wire** — read off the artefact — and
§5b's six-page control names the gated pages exhaustively, so `/sign-in` joining them later reddens.

## §9.7 The readings, with their exit statuses

| gate | reading |
|---|---|
| `tpl001Template.test.ts` | **82/82, EXIT=0** (79 before) |
| the same file, **reverted arm** | **EXIT=1**, 1 of 82 red, by name |
| `noodl-mcp` full jest | **93 suites / 1260 tests, EXIT=0** (1257 before) |
| `rel002b-fail-closed.test.ts` — real backend, real browser | **38/38, EXIT=0** (37 before) |
| `tpl001-refused-query.test.ts` — real backend, real browser | **6/6, EXIT=0**, D4 still `LEGIBLE` |
| `tsc --noEmit -p packages/noodl-mcp` | **0 errors, EXIT=0** |
| `npm run template:members` | **clean no-op before the edit**, so the diff is attributable |
| artefact diff | **6 files · 6 targets · 6 labels · nothing else** |

🔴 **`tsc -p packages/nodegx-backend/tsconfig.tests.json` CANNOT be read on this box** — `EXIT=134`,
OOM, and **its log carried 0 `error TS` lines**, which is exactly the reading that has been mistaken
for a pass before. Narrowing it to the two edited files alone still OOMs at 6GB. CI owns this one;
nothing here claims a local typecheck of the backend tests. ⚠️ ts-jest runs them with
`isolatedModules: true`, so **the drives do not typecheck them either** — which is why the one piece
of new logic was additionally run against the real artefact and asserted to resolve to `/sign-in`.
