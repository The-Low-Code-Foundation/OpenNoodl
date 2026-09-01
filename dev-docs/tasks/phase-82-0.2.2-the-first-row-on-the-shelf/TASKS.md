# Phase 82 — task board

**Status legend**: ⬜ not started · 🟡 in progress · 🟢 done · 🔴 blocked · ⏸️ held (deliberately out)

🔴 **READ [`RICHARD-RULINGS-2026-09-01.md`](RICHARD-RULINGS-2026-09-01.md) BEFORE BUILDING ROWS
6, 7 OR 8.** Richard ruled fifteen open questions on 2026-09-01. **Two of them amend ACs written on
this board** — REL-002c's scope is now **all thirteen pages**, and REL-001's category is
**`starter`**, not `data-app`. ✅ **All fifteen are settled — nothing in that file awaits him.**

Re-derive this board from the task files and the artefacts at session open. Do not trust a
handoff's copy of it — §1 of the [README](README.md) records three readings that contradicted a
task file on the day this phase opened.

| id | task | status | depends on | note |
|---|---|---|---|---|
| REL-001 | The shelf's first row — publish the association template | ⬜ | REL-002 | P78 **T5**. Richard drives the publish. **No code blocker**: T6's three fixes are in at HEAD (README §1.3), and the publish path was driven end to end locally by P80/DEF-007 s41. Needs no app release (README §1.2) |
| REL-002a | The ambush defaults the template sits on | 🟢 | — | **CLOSED s4** — [REL-002a](REL-002a-THE-AMBUSH-DEFAULTS.md). 🔴 **The scroll defect is `settings.bodyScroll`, not `sizeMode`/`scrollEnabled`/`clip`** — six rendered arms, one parameter apart, say so. The template went **0/7 and 0/6 reachable controls to 7/7 and 6/6**; `create_project` now writes it; `PageCannotScroll` ships in both gates; V14 fixed in **two** source copies. ⚠️ `render:report` could not see the defect at all until this session fixed its host page |
| REL-002b | Fail closed, and a designed first run | 🟢 | REL-002a | **CLOSED s5** — [REL-002b](REL-002b-FAIL-CLOSED.md). 🔴 **V3's recorded mechanism was WRONG**: the content was never revealed (six `mounted: false` defaults were already there); the defect was that **nothing refused** — all six stayed on the protected URL wearing a `Sign out` band — and five of six said nothing. Built `Denied` (2 producers) + `isSignedIn`; **V4 was `actions`, the one group with no `mounted: false`**. Driven **37/37**, four arms, real enforcing backend. 2 defects registered, owner `NONE` |
| REL-002c | Every page as good as the homepage | 🔴 | REL-002a, REL-002b | 🔴 **REOPENED s11 BY RICHARD — the s10 FINE close is REVERSED.** *"we're going back round and fixing that fucking template… I want all pages looking as good as the homepage."* The cost constraint that justified the override is gone. **Items 5 and 6 are UN-DECLINED**; item 6 widens to three pages. See the handoff §"the ruling that reopens row 6" |
| REL-003 | The stale bundles the cut inherits | 🟢 | — | **CLOSED s3.** AC1 amended and met (rebuilt, reproducible, correctly NOT committed — REV-008). AC2 met for **MCP** (s2, live control pair), **DEF-023** (s3, pre-fix control bundle, `stale`→`fresh`) and **DEF-026** (s3, real browser, both halves, answering control). 🔴 **AC2's DEF-021 clause is RETIRED as unmeetable by a drive** — the coalescing branch is unreachable from a graph and pre-fix/HEAD are behaviourally identical (§ below, owner `NONE`). 🔴 `cloudruntime` names a **retired** artefact (WF-007) |
| REL-004 | The cut — `0.2.2` | 🟡 | REL-003, REL-005 | **AC1 met s11** (`5c805978`). Notes + runbook drafted. 🔴 **Blocked: `cline-dev` `0 573` unpushed — Richard pushes** |
| REL-005 | What rides and what rolls | 🟢 | — | **CLOSED s2.** All four open rows and all five phase-74 carry items are marked, in writing, in P75's own board — plus a triage section at its head. ⚠️ Re-counted: **22 done, 4 open of 26**, not 24/4 |
| REL-006 | The hold list, and two stale files | 🟢 | — | Record the site-builder hold with a named owner; correct P78's handoff (T6 reads open, is done) and P78's `TPL-001` **AC1** (it waits on T5, which is now unblocked) |
| REL-007 | The price that goes stale tomorrow | 🟢 | — | `models.ts:229` reads `$2/$10`. Sonnet 5's introductory pricing ends **2026-08-31** — from 1 September the standard rate is **$3/$15**, and the app's default model is Sonnet 5. One line; cost reporting misreports until it lands |
| REL-008 | **Candidate: code export rides 0.2.2** — P18's EXP-012 | ⬜ **RICHARD DECIDES** | REL-004 | Settings → Project → *Export as React code…* was built and driven by P18 s67 (2026-09-01) on Richard's *"if we make good progress we can include it"*. Four editor files + one webpack alias; editor `tsc` 0, export jest 1248/1248, runtime 2615 passed. Owner **P18**; the facts and the caveat are in [EXP-012](../phase-18-code-export-v2/EXP-012-THE-EDITOR-EXPORT-COMMAND.md). If it rides: a release-notes line. If it holds: nothing to undo |
| — | **The site builder** | ⏸️ | — | **Held by Richard's decision.** VIB-009, the three site-builder SHITTY verdicts, and P77's five unbuilt tasks are out of 0.2.2. README §3 |

---

## Task detail

### REL-001 — The shelf's first row

Publish `templates/members-area` as a **curated** template, and drive the install from a clean
launcher. This is phase 78's **T5**, carried here because 0.2.2 is the release it belongs to.

**Standing facts, measured** (README §1.2, §1.3):

- Curated templates are **served**. A published template reaches everyone already on 0.2.0 with no
  app update, and touches **no editor source** — so this cannot collide with P77 over
  `EmbeddedTemplateProvider.ts` or `ProjectTemplate.ts`.
- `shareAsTemplate` files a **submission** and publishes nothing. Publishing is
  `scripts/publish-project-template.ts`, a database-credential act. **Richard publishes**
  (R-templates, ruled 2026-08-22).
- The path was driven locally over a real socket in P80/DEF-007 s41 — picker row, install, and the
  installed project's `activeComponent`. Nothing was published to the live service.

**ACs**

1. The template is published as **`curated`** (✅ ruled §G4 — the alternative would route NodeGX's
   own flagship template through a submission queue Richard also operates; ⚠️ the picker badges it
   *Community* either way, which is a fact about **which service serves it**, not provenance),
   🔴 **`category: 'starter'`** — **not `data-app`**;
   Richard ruled 2026-09-01, *"data app sounds like it analyses data"*
   ([rulings §G1](RICHARD-RULINGS-2026-09-01.md)). This **amends TPL-001 AC8 too**, and any spec
   carrying the literal `data-app` for this template moves with it (`template-search.test.ts`,
   `template-install-over-http.test.ts`). Title **"Members' area"**, summary *"members only site for
   a club, charity or church"*. Plus an excluded-files list that is **read and checked** — this
   project has a backend and auth, so the check is not a formality.
2. A **clean launcher** picks "Members' area" from the picker and finishes the wizard onto a working
   public landing page — backend created, started, bound, enforcing — with no detour through Backend
   Services and no white void. This is **TPL-001 AC1**, ungradeable until now by construction.
3. The published row's card draws a **person-facing** category, not a machine slug. P75 already
   found the cost of getting this wrong.

🔴 **Do not publish before REL-002 rules.** That is the decision, not a preference.

✅ **But do not wait for the cut either** — Richard, 2026-09-01 (§G5): publish the moment the look
rules. REL-001 and REL-004 are **two moments, not one**; a served template reaches everyone already
on 0.2.0 with no app update.

### REL-002 — The look it ships with (a, b, c)

🔴 **Owned here, by Richard's ruling 2026-08-31**: *"just so we focus on the tasks we need to launch,
over several sessions all in phase 82."* This was phase 81's VIB-005 + VIB-008. **Everything needed
to build and close it is restated below — you do not need to open phase 81.**

✅ **The note back is WRITTEN (REL-006 AC4, 2026-08-31 s1).** Phase 81's board now carries both rows
as **➡️ CARRIED to phase 82 — do not build it here**, with a legend entry and a note that VIB-009's
dependency on VIB-005 now resolves here. Written after the P81 peer session ended and its work was
committed (`4b3e55f4`), with the lane checked clean first.

#### The verdict scale, restated

**SHITTY / PASSABLE / WORTHY. Only WORTHY closes.** PASSABLE is recorded progress, never a close.

🔴 **Legible and operable is the FLOOR, not a grade.** Richard, on the baseline: *"passable in terms
of you can at least see the elements clearly and interact, but they still look like original
Wordpress default templates."* Every default template is legible and operable — that is what it is
for. A verdict awarded for it measures the precondition, not the thing.

⚠️ **These are mostly app-chrome pages** (forms, lists, a directory). They are **exempt from the
marketing tells** — a settings page needs no hero, no gradient ground, no 72px display type, and
demanding one would be wrong. They are **not** exempt from the default-template test, which is the
same for every surface:

> **Does anything on this page show a decision?** A considered density; a real hierarchy of action
> weight; iconography doing work; a treatment for state. Or is it the framework's defaults with this
> app's content poured into them?

Full-width bordered inputs stacked in a card, or ruled rows with outline-secondary pills, are what a
form library emits before anyone has designed anything. They are SHITTY however clearly they read.

#### The close protocol, restated

1. **Render the actual page.** Never a mockup, never the generator's source, never a description.
2. **Both states**: the user's door (no backend bound, nothing seeded, not signed in) **and** the
   living state (provisioned, seeded, signed in). Not WORTHY in one and unjudged in the other.
3. **Three widths**: the editor preview default (**988×313** — that is what a user sees first),
   1280, and ≥1900. 🔴 **Never raise a viewport to make content fit — the fold is a finding.**
4. **LOOK at the PNG** and write the verdict as sentences, naming which tells fired. A verdict
   written without the image in context is void.
5. **Richard's look supersedes.** A session's WORTHY is provisional until he has seen it.
6. **If not WORTHY, the why is mandatory work**, not commentary — name the seam that blocked it.

---

#### REL-002a — The ambush defaults *(was VIB-005)*

🟢 **CLOSED 2026-09-01 (s4). Read [`REL-002a-THE-AMBUSH-DEFAULTS.md`](REL-002a-THE-AMBUSH-DEFAULTS.md)
before acting on anything below** — three of the four bullets were measured on a rendered page and
**the first three name the wrong mechanism.** They are kept here as written, because the correction
is only legible beside them.

🔴 **What is actually true:** the app cannot scroll because `settings.bodyScroll` is unset, and no
node parameter substitutes for it — `scrollEnabled: true` on the page's root Group leaves the last
row exactly as unreachable as leaving it off (measured). The dead gaps are the *same* setting: with
`bodyScroll` false the app wrapper is a definite-height box, which is the only state in which a
child's `height: 100%` has free space to grow into.

The silent runtime defaults that produced the baseline screenshots. Fix these first: they are what
the template *sits on*, and REL-002c inherits every one of them.

- A `Group` with no `sizeMode` is explicit 100%×100%, and in a column becomes `flexGrow:100` —
  "consume the viewport, ignore content height". Hence the ~690px dead gaps.
- Nothing scrolls unless `scrollEnabled` is set — **zero hits in the whole members-area artefact**,
  which is why the Setup form was unreachable below the fold.
- `clip:true` silently amputates overflow.
- **V14** — `text-input.ts:97` defaults `placeholder` to `"Type here..."`. The template sets it
  explicitly **once**, so every field of every shipped form reads *"Type here…"*: a runtime default
  that manufactures the rubric's own placeholder-grade-copy tell, and **nothing fires on it**.

**ACs**: the MCP door **says something at authoring time** for each of the first three; the
placeholder default no longer ships a tell; the naive page re-authored through the door scrolls.
Judged by before/after screenshots.

#### REL-002b — Fail closed, and a designed first run

🔴 **Correctness wearing a look task's clothes.** Do not defer these on the grounds that the phase
is about appearance.

- **V3** — the members chrome gates on `done` only, so it **fails open** when no backend is bound:
  the gate's failure mode is to show the protected surface.
- **V4** — no state for *"the query was never answered"*, so first run renders a bare eyebrow and
  two buttons.

**ACs**: gating **fails closed** — failure navigates away, asserted beside a known-firing signed-in
read so the absence is a refusal and not a wrong query; the no-backend/unclaimed state is
**designed**, not blank; both driven against a real enforcing backend.

##### 🟢 CLOSED s5 — both ACs met. Full account: [REL-002b](REL-002b-FAIL-CLOSED.md)

🔴 **V3's recorded MECHANISM was wrong.** Measured at HEAD: every gated group on all six protected
pages already carried `mounted: false`, so the protected **content** was never revealed. The real
defect was that **nothing refused** — all six pages stayed on their own URL wearing the full band,
`Sign out` included, and **five of the six said nothing at all** about why they were empty.
✅ *A recorded row can be a hypothesis; the artefact is the ruling* — believing this one would have
produced a wrong fix, hunting a `mounted: false` that was already there six times.

🔴 **V4 was one parameter**: `actions` (*"Ways in"*) was the **only** group on the landing page
without `mounted: false`, so it was the one thing that survived a query that never answered — which
is exactly the photograph. Three states collapsed into the one with no words on it.

Built, all through the generator + `npm run template:members` (byte gate green): a **`Denied`**
signal with **two producers** (answered-`visitor`, and *could not be asked* — the half that did not
exist); **`isSignedIn`**, consumed inside the band and forwarded to nobody, gating `topRow` and
`nav`; and a **`waitingCard`**, the one node mounted by DEFAULT, taken down by an answer.

Driven **37/37** — [`rel002b-fail-closed.test.ts`](../../../packages/nodegx-backend/tests/rel002b-fail-closed.test.ts)
— four arms on two real enforcing backends: **member (the control, which caught the first build
ejecting everybody)**, visitor, `myStanding`-not-deployed, and nothing-bound.
⚠️ The observable is `location.pathname`; **`Visit.url` echoes the REQUEST** and would have passed
on every arm.

🧭 **Two defects registered, owner `NONE`, neither blocking:** (1) **`DbCollection2` never fires
`failure` with no backend bound** — a 200 carrying non-JSON makes `ParseWireAdapter` call
`success(undefined)` and throw on `response.results` before the node's own guard; *not* the same
claim as D4, which proved `failure` fires on a real 403. (2) 🔴 **Starting a second
`BackendService` in the same process invalidates the first one's sessions** — presents as *"a
signed-in moderator is ejected"*, cost most of the session; **a two-backend drive must finish with
the first before starting the second.**

#### REL-002c — The members' area, redeemed *(was VIB-008)*

The redesign, on top of a and b, using the kit phase 81 widened (compositions, the stock library,
the `ui-landing-page` example Richard called *"fucking pro"* — that page is the reference).

- **V15** — at 1900 the nav wraps to two rows and the page uses ~37% of the width, the rest dead.
- **V29 is RULED** (Richard, 2026-08-31): *"the structural page divs have a max width and are
  centred… white space to the left and right **equally** — not just on one side, that's weird."*
  🔴 **The mechanism is known: the defect is a `maxWidth` on the TEXT.** A measure belongs to the
  **shell**, which a band centres. `ctaBand` is the worked example — shell carries `maxWidth: 720`
  + `alignItems: center`, the type carries `textAlignX: center` and **no maxWidth at all**.

**AC — the phase's close condition** — 🔴 **AMENDED BY RICHARD 2026-09-01, read
[`RICHARD-RULINGS-2026-09-01.md`](RICHARD-RULINGS-2026-09-01.md) §A first**: the AC below was
written when only four pages had been ruled. It is now **all thirteen pages** in
`components/Pages/` — *"shipping the first template that's only 1/3 usable would be pretty sad."*

~~the **landing page and one members page**~~ **every page** reads **WORTHY** in **both states** at
**all three widths**, ruled by Richard.

⚠️ The build is not 13× the work — most of the look lives in the seven shared `Members/` components
(`Chrome`, `AnnouncementRow`, `InsideTile`, `MeetingRow`, `MemberRow`, `RequestRow`, `Standing`), so
fixing the chrome and the row family lifts most of the thirteen at once. What scales linearly is the
grading: 13 × 2 × 3 = **78 renders**.

✅ **How they get graded — RULED (§A2a)**: **Richard personally rules six** — `/` in **both** states,
`/setup`, `/join`, `/members`, `/directory` (the four he already ruled, plus the two richest row
pages). **The VIB-001 Judge grades the other seven** against the written rubric, and 🔴 **any SHITTY
verdict is escalated to him**. The escalation is the half that makes this different from shipping
seven pages nobody looked at.

✅ **Also ruled:**

- **§C — the measure is `maxWidth: 1200`** on every structural shell, with `--space-6` gutters and
  `alignItems: center`, matching `ui-landing-page`. 🔴 **On the SHELL, never on the text.**
- **§D — photographs on the public pages** (`/` hero ground, `/join`), **icons only** inside the
  gated area. Costs the template **zero bytes**: `STARTER_ASSETS` installs the 44 CC0 photographs
  and 1,998 icons into every project, and the excluded-files list derives from that same constant.
  The template contains **no images at all today**.
- 🔴 **§E — the copy becomes DATA, not text nodes.** *"Ok good idea."* The failure mode Richard named
  — publishing with generic copy on a page you forgot — exists only because copy lives in thirteen
  places. So: **(i)** `/setup` collects the association name, tagline and landing blurb, and the
  pages read them from the record; **(ii)** anything that genuinely cannot be data is written to be
  *obviously* unfinished (*"Your association's name here"*, **never** a plausible fictional club) and
  its node is named with an **`EDIT —`** prefix so the editor's tree lists them; **(iii)** a
  `Start here` note page points at both. ⚠️ **No invented copy** — that was E3.
- **§F — `waitingCard` is designed as a first-class state**, not hidden. It is the **only node in
  the template mounted by default**, so it is the literal first frame of a fresh install, and it is
  ruled with the rest.

🧭 **Registered, not built — owner `NONE`, from §E.** *"A deploy-time gate that refuses to publish
while placeholder strings remain."* It is the strongest answer to the forgotten-copy problem, and it
is **product surface, not template work** — the template package ruled above (data + marked
placeholders + a note page) is what ships in 0.2.2. Worth a row in a later phase; it gates nothing
here. ⚠️ It needs a way to know which strings are placeholders, which the `EDIT —` naming convention
from §E-ii would give it for free — so the convention is worth keeping even before the gate exists.

---

## REL-002c — what session 7 built, and the one place it departed from the ruling

**Session 7, 2026-09-01, at HEAD `5f197e28`.** The row is **NOT closed** — it closes on Richard's
WORTHY ruling over six pages, and three of the six ruled items are only partly built. What follows
is what moved, what was measured, and what the next session picks up.

### The spine — §C, the measure

| | before | after |
|---|---|---|
| `PAGE_GROUND` (all 13 pages) | `maxWidth: 760` | **`maxWidth: 1200`** (the `shell` composition's own) |
| `CHROME_NODES.inner` | `maxWidth: 760` | **`maxWidth: 1200`** |
| the six form pages | 760 | **`FORM_GROUND` — 720, centred** (see the departure below) |

✅ **V15 is CLOSED, and it was closed by the chrome cap rather than by anything about the nav.** At
760 the six `gridAutoFit` items at `minWidth: 132` fitted five across and folded the sixth onto a
second row, on every signed-in page at every viewport. At 1200 they are one row of six.
**Photographed**: `verdicts/vib-001/2026-09-01/members-area-living/members-desktop-full.png`.

### 🔴 The one departure from §C, flagged for Richard

**Six of the thirteen pages do NOT carry `maxWidth: 1200`.** `Pages/{SignIn, Join, Setup, Post,
Account, Unsubscribe}` carry `FORM_GROUND`, which is 720 and centred.

**This was not a preference — the literal reading was rendered first and it was worse than the
baseline it replaced.** At 1200, `/setup` is six stacked 1100px-wide text inputs. The three readings
of the ruling disagree on a form page:

| reading | at 1280 | equal white space? |
|---|---|---|
| shell 1200, form fills it | a 1100px password field | yes, and unusable |
| shell 1200, form capped and left-aligned in it | ~480px of white on the right only | **no — this is the "weird" he named** |
| **ground 720, centred** | a 720px form, 280px either side | **yes** |

His stated criterion is *"white space to the left and right **equally** — not just on one side"*, and
only the third reading satisfies it. ⚠️ **If he wants 1200 literally on all thirteen, the answer is
not this constant** — it is a two-up split that fills 1200 with the form on one side and what the
form is for on the other. That is more work and a better page, and it is the obvious next move on
`/setup` and `/join` if he rules that way.

### §D — imagery: done on `/`, not yet on `/join` or inside the gate

The landing hero is `imageGround` + `noodl_modules/starter-imagery/people-coffee-shop.webp` under
`--gradient-scrim`. **Zero template bytes** — `STARTER_ASSETS` installs it into every project.

⚠️ **`people-meeting` was chosen first and rendered wrong.** Both are catalogued under subject
`people`; the first is a room full of people sitting together, the second is a desk with a bag, a
tablet and two pairs of hands. A members' area is a group of people who belong somewhere. **Graded
by rendering both**, which is the only way this is gradeable.

⚠️ **`justifyContent: center` was an override and it was wrong.** The scrim is a VERTICAL gradient,
darkest at the foot — which is what `imageGround`'s own description says it is for. Copy centred in
the frame sits in the weakest part of it. Reverted to the composition's `flex-end`.

**NOT done**: the `/join` photograph, and icons inside the gated area. Both are still open §D work.

### §F — the waiting card, ruled as a first-class state

`waitingCard` and `setupCard` are now **glass panels standing on the hero photograph**, not grey and
accent boxes in the middle of a white page. `waitingCard` keeps the default `mounted`, so the first
frame of a fresh install is a designed screen. `setupCard` gained a heading it did not have.
**Photographed**: `verdicts/rel-002c/2026-09-01/members-area-door/landing-desktop-full.png`.

### §E — the `EDIT —` convention has its first worked example; the data half is NOT built

The landing page gained a `footerBand` carrying two `EDIT ME —` lines, whose nodes are named
`EDIT — who to contact` and `EDIT — the small print`. **NOT done**: `/setup` collecting a tagline
and landing blurb, the pages reading them from the record, and the `Start here` note page. That is
the larger half of §E and it touches `tpl001Cloud.ts`.

### Also fixed, from the VIB-001 baseline

- **The Join page's two equal primary buttons.** `Sign in` sat in `PRIMARY_LABELS` because it is the
  submit of `Pages/SignIn`, and the footnote under the join form inherited the fill. This file
  already states the rule that fixes it, on `navBtn`: *"emphasis is a property of the PLACE rather
  than of the label."* It is the outline button now.
- **The page had no bottom edge.** A footer band plus a `--muted` page ground, so the door state
  does not end in a strip of bare white below a finished footer.

### The readings, with their exit statuses

| gate | reading |
|---|---|
| `template:members` regeneration | **0**, and **idempotent** — hashed before and after a second run, identical (`bbeb0b6f…`), so every diff after that point is attributable |
| `tpl001Template.test.ts` | **0** — **72/72** |
| `vib001-members.look.ts` | **0** — 44 shots, both states, seeded backend asserted before any picture |
| `rel002c-look.look.ts` (new, door only) | **0** — 16 shots, ~92s, the fast loop while building |


## REL-002c — what session 8 built: §D's icons, §D's second photograph, and the whole of §E

**Session 8, 2026-09-01, at HEAD `1f4d5547`.** The row is still **NOT closed** — it closes on
Richard's WORTHY ruling — but **all six ruled items are now built**. What was open at the end of
session 7 was §D's icons, §D's `/join` photograph, §E's data half and the row family; all four
landed. The one departure flagged for Richard (`FORM_GROUND` at 720) is **unchanged and still
open**, and nothing built this session depends on the answer.

### §D — the icons, and where they went

**A glyph badge on the head of all eight gated pages**, one distinct glyph each: `newspaper`
(Announcements + the announcement detail), `calendar-days` (Meetings + the meeting detail),
`pencil` (Post), `user-plus` (Requests), `users` (Who belongs), `mail` (Your account). A 44px
`--accent` square holding a 22px `--accent-foreground` glyph — the pairing `tpl001Theme.ts` already
measures at **6.45:1**, so the app has one accent idea rather than two.

🔴 **A different glyph per screen is the whole difference between iconography and decoration.** The
corpus states the rule for photographs — *"a page whose every image is the same abstract is
decorated, not designed"* — and it holds identically for glyphs. That is why they are **NOT on the
list rows**: eight announcements each wearing the same newspaper is the decorated case exactly.

🔴 **The badge is a wrapper AROUND the head, never a third child inside it, and the GATE dictated
that.** §5 of the ratchet reads a page's eyebrow as *the head Group's first child*. A glyph inserted
into the head would have moved the eyebrow to index 1 and reported all eight badged pages as
carrying the eyebrow `''` — against a hand-written table, so it would have read as eight pages
losing their eyebrows rather than as one structural change. The wrapper's id ends in `Row`, which is
not what `/Head(-\d+)?$/` matches.

⚠️ **The nav pills were considered and rejected on arithmetic.** Six glyphs on the band's six
buttons is the obvious app-chrome move and it is the tightest place in the template: at the 988px
preview each `gridAutoFit` column is ~145px, `--space-3` sides leave ~121px, and "Announcements"
plus a 16px glyph and its spacing is ~124px. Three pixels over is a wrap on somebody else's font.
Not built, and recorded so the next session does not re-derive it.

⚠️ **Every glyph name is in the CURATED 215, not merely in the font.** `icon-megaphone` and
`icon-handshake` were the first two picks; both have rules in `styles.css` and both draw, because
the manifest `_note` is right that the bundled font carries all 1,998. They are still wrong: the
door validates against the manifest's list, so a name outside it is a refusal waiting for whoever
regenerates next.

### §D — `/join` is bands now, and it has its own photograph

`Pages/Join` was one 720px column on white from the top of the viewport to the bottom of the form.
It is now `BAND_PAGE_GROUND` holding a **300px `people-meeting` band** carrying the page head on the
scrim, then the form band. This is the one transition in the template where two public pages are
seen back to back, and Richard's §D names this page explicitly.

⚠️ **`people-market` was built first and rendered wrong, and the shape of the band is what picked
the picture.** Cropped to 300px it is a pair of hands and a heap of limes — the catalogue's `says`
(*"a market seller weighing limes"*) describes the **full 4:3 tile**, and a third of a tile is a
different photograph. `people-meeting`'s subject runs horizontally across a table, so a 300px band
keeps all of it.

⚠️ **Session 7's own comment argues AGAINST `people-meeting`, for a different page.** It was rejected
as a *hero* because *"a members' area is a group of people who belong somewhere"*. That judgement is
about a 560px band saying what the association IS. This band says what the PAGE is, and the page is
one person asking two others to let them in.

🔴 **The head was at 1200 and the form at 720 and the first render showed it.** The heading began at
x=64 and the form panel at x=304 — two measures on one page, which reads as a head belonging to a
different template. The join hero shell is capped at the form's own 720.

### 🔴 §C's footer fix was one element short, and only a picture found it

`landingGround` was `justifyContent: flex-start` with `minHeight: 100vh`. In the **door** state —
where every band but the hero and the footer is unmounted — that stacked a 560px photograph and a
footer directly under it and left **270px of bare `--muted` below a finished footer**. That is the
exact defect session 7 added the footer band to end, **moved down the page by one element rather
than fixed**, and every gate was green over it. `space-between` pins the last band to the foot
whenever there is slack and is a no-op the moment content exceeds the viewport, which is every
living state.

### §E — the data half, all three parts

**(i) `tagline` is the one new field, end to end.** `claimAssociation` takes it (`preq: false`, like
`blurb`), `/setup` collects it under *"One line about the association (e.g. 'Meeting on the green
since 1894')"*, and `Pages/Landing`'s hero renders it.

🔴 **The hero used to render `blurb` — the association's whole paragraph — under a `--text-5xl`
name.** They are different shapes of writing and the hero has room for one. So the blurb moved to a
new **`about` band**: `composition('band')` on `--background`, an "About us" heading, the paragraph
in a `PROSE` wrapper, gated on `hasAssociation` like everything else the record fills.

**(ii) `EDIT —` is unchanged** — the footer's two lines are still the only strings that genuinely
cannot be data, and that is the honest number.

**(iii) `docs/START-HERE.md`, and it is GENERATED from the artefact rather than typed.**
`writeStartHere` in `tpl001Template.ts` walks the components that were just written and builds the
table of `EDIT —` nodes from their labels. A hand-written list is the failure `USED_COMPOSITIONS`
already had in this repository — it claimed to be enforced, nothing read it, and two of thirteen
entries named things that did not exist. **It refuses on zero rather than warning**: an empty list
has two causes that look identical in the output (the convention was dropped, or the walk stopped
finding it) and both ship a note whose central section is blank.

⚠️ **`docs/`, not a `/start-here` route.** A route would be a public URL on a deployed members' area
telling strangers which parts of the site are unfinished. `docs/` is the editor's folder for prose,
it travels because `readBundleDirectory` walks the whole tree (**checked in the community repo, it
is fully recursive**), and it is never served.

### The row family at 1200 — a CONTENT answer to a LAYOUT complaint

**`AnnouncementRow` gained a one-line excerpt.** At 760 a title and a date filled the row; at 1200
they left ~900px of nothing between "The roof appeal" and its `Read` button. **The fix is not to
move the button back** — `RULED_ROW_SPLIT` already measured what a content-sized right-hand child
costs at 390px (`ada@example.invali / d`). A wide row wants something to be wide ABOUT, and every
announcement already had a body nobody was showing. ✅ **Free at the door**: `For Each` sets every
DECLARED input from the field of the same name, so declaring `body` is the whole mechanism — no
query, no page and no policy rule changed. Truncated in a `JavaScriptFunction` at a word boundary,
because a `Text` in this runtime has no line clamp.

**`MemberRow` is a three-column table row.** `'3 3 2'` above 700px, one stack below it. 🔴 **A
`Columns` is the ONLY node type in the runtime that could do this** — a Group row cannot reflow, and
putting the standing at the far edge of a Group row is the 390px defect above. `'2 2 1'` was
rendered first and wrapped every standing onto a second line: a fifth of 1200 is ~200px and
`Member · since 1 September 2026` measures ~197px.

🔴 **§2 of the ratchet counted the three cells as unpainted notice boxes, and the fix is to the
CENSUS, not to the cells.** A `Columns` child must be a Group that declares `sizeMode` and `width`,
so "a Group wrapping one Text" is now produced by two different intentions and only one is a notice.
Painting them to satisfy §2 would put a fill and a radius behind every name in the directory. The
exclusion reads the cell's **parent type** from the artefact rather than a list of ids. ✅ **The
control is that the pin did not move**: 27 → 24, which is exactly the three new cells and no
pre-existing notice.

### The readings, with their exit statuses

| gate | reading |
|---|---|
| `npm run template:members` | **exit 0**, and **idempotent** — hashed before and after a second run, identical (`27f127e9…`), so every diff is attributable. 91 files, +1 for `docs/START-HERE.md` |
| `tpl001Template.test.ts` | **exit 0** — **72/72**, taken after the last edit |
| full `noodl-mcp` suite | **exit 0** — **83/83 suites, 1085/1085 tests**, clean on the first run |
| `tpl001-members-drive` + `tpl001-empty-states` + `rel002b-fail-closed` | **exit 0** — **110/110**, on real enforcing backends. Not one of the four owed gates; run because the row family changed the shape of two components a drive reads |
| `vib001-members.look.ts` | **exit 0** — 44 shots, both states, seeded backend asserted before any picture |

---

## ⛔ SUPERSEDED 2026-09-01 (s11) — the ruling that closed this row, and the one that reopened it

🔴 **Richard reopened the row the same day:** *"Anthropic just reset my weekly usage limit, so we're
going back round and fixing that fucking template… I want all pages looking as good as the
homepage."*

**The close below was made ON COST — *"we can't waste more time on this"* — and the cost constraint
is gone, so the override goes with it.** The AC is back in force, unchanged: every page WORTHY in
both states at all three widths. **Items 5 and 6 of the change list are UN-DECLINED**, and item 6
widens from `/setup` alone to `/setup`, `/sign-in` and `/unsubscribe`, which s11 measured to be in
the same state.

⚠️ **This section is kept, not deleted** — it is the honest record of what the template looked like
at V1 and how far it was from the bar. Read it as the starting distance, not as a verdict.

---

### The superseded close

**2026-09-01, session 10, after the items 1–4 renders:** *"It looks fine (not worthy) but just push
it as V1 of the template, we can't waste more time on this."*

🔴 **Recorded as what it is: the close condition was NOT met.** REL-002c's AC reads *"every page
reads WORTHY in both states at all three widths, ruled by Richard"*. He ruled **FINE** and elected
to ship regardless. The row is closed because **he decided the remaining distance is not worth its
cost**, not because the template reached the bar this phase set for it.

⚠️ **This matters for the next person, in two directions.** It is not a licence to treat FINE as the
new bar — the bar is written above and the template is below it. And it is not an invitation to
reopen the row: the decision was made with the renders in hand, by the person whose product it is.

**What is knowably still short**, from the change list, so a later phase does not rediscover it at
full price:

- **Item 5 — `/directory` is a table with no headers.** Three columns at roughly x=36 / x=285 /
  x=537 at 1200, so a name and its email are ~250px apart, and `Member · since 1 September 2026`
  runs on with no column to say what it is. Costed: a header row (*Name · Email · Standing*) and
  ~40/35/25 proportions, medium only because the header has to disappear at the 700px fold.
- **Item 6 — `/setup` has no identity.** The owner's first ever screen of the product is a bare form
  on white while `/` and `/join` both open on a photograph. Taste rather than defect; Richard's call
  and he did not take it.
- **Four of the thirteen pages have never been photographed** — `Announcement`, `Meeting`, `Post`,
  `Unsubscribe`. The harness asks for nine. **So "every page" was never actually graded**, which is
  a second reason this row did not meet its AC as written. Owner `NONE`.
- **The `/directory` page still ends in ~200px of white above its footer** at 1280 with four rows.
  Honest for a short page; it is what item 5 would absorb.

**So V1 of this template ships FINE, knowingly.** The list above is the V2 brief.

## REL-002c — what session 10 built: items 1–4 of the change list Richard asked for

_Richard ruled the row **FINE** on 2026-09-01 and asked what I would change. The answer is
[`REL-002c-WHAT-I-WOULD-CHANGE.md`](REL-002c-WHAT-I-WOULD-CHANGE.md); this section is what building
its first four items actually took, which is not what that file estimated._

### Items 1, 2 and 3 — small, and they cost what was estimated

**Item 1 — the door landing had a void, and the band that fills it was closed by a gate.**
`Pages/Landing`'s "What members can see" is ungated now: `mounted: false` gone from the node and the
`hasAssociation` wire gone with it (the mounted-gate census moves 54 → 53). 🔴 **The s8 argument for
gating it was about a page that no longer exists** — *"it would sit above the 'nobody has set this
up yet' card"* was true when it was a section in the old single-column page and stopped being true
when it became a band **below** the hero. And what it promises is the **product**, not this install's
content: three literal sentences pinned by the page census, true of every copy on the day it is
unzipped. What the gate actually did was leave **190px of bare `--muted`** between the photograph
and the footer at 1280, and 330px at 1900.

**Item 2 — `/members` ended in four buttons that were all already in the band.** `What's coming up`,
`Requests to join` and `Who belongs` are gone; `Post something` stays and is the page's one filled
button. 🔴 **This reverses a decision recorded in the generator at s9** (*"The three buttons below
STAY… a nav and a call to action are not the same control"*) — the principle is right and the
reading of these three was wrong: each named a **place** the nav names in the same word, three
inches higher. Three `RouterNavigate` nodes went with them, because each had exactly one driver and
it was the button that was deleted. The `moderatorButtons` `Columns` went too — a `Columns` with one
child hands it the whole container, which is a 1200px filled button — and so did `afterRuledList`,
whose only caller was the button above it.

**Item 3 — one string.** *"Already have an account? Sign in instead."* → *"Already have an
account?"*, above the outline `Sign in` button that is the actual control.

### 🔴 Item 4 — the stated fix would have changed no pixel, and the mechanism was wrong twice

The change list said: `PAGE_GROUND` carries an inert `height: 100%`, so give it `minHeight: 100vh`.
**Both halves of that are wrong, and the second one is worth carrying out of this phase.**

1. **The proposed fix paints nothing.** `ground` has no `backgroundColor` in the artefact — read out
   of `components/Pages/Directory/nodes.json`, not reasoned about — so growing that box leaves
   `/setup` ending in exactly the same white. **A page has a bottom edge when something is AT the
   bottom.** The eleven pages now place `Members/Footer`, the band the landing page has had since
   s7. A **component**, not four nodes copied thirteen times: the two `EDIT ME —` lines an
   association has to replace stay two strings rather than becoming twenty-six.
2. 🔴 **`height: 100%` was never inert.** [`layout.ts:98`](../../../packages/noodl-viewer-react/src/layout.ts#L98)
   turns a percentage height inside a **column** parent into `flexGrow` — *"along the parent's flex
   direction it becomes `flexGrow` (so siblings share the space proportionally)"*. So `PAGE_GROUND`
   has always meant `flex-grow: 100`. It did nothing only because the chain above it ended at a
   content-sized `Router`. **The moment the page got a floor, the slack went INTO the ground** and
   was shared out among its children: 150px between `/sign-in`'s heading and its form, and the form
   panel stretched by as much again. Found by rendering, not by predicting.
3. 🔴 **Every `Group` in this template without a `sizeMode` is `flex-grow: 100`.** `addDimensions`
   defaults `sizeMode` to `explicit` and `height` to `100%`
   ([`node-shared-port-definitions.ts:1102`](../../../packages/noodl-viewer-react/src/node-shared-port-definitions.ts#L1102)).
   That is a property of the runtime and it is the reason the shell is shaped the way it is.

**So the built shape is two bands, not three.** `PAGE_SHELL` (`minHeight: 100vh`,
`justifyContent: space-between`) holds exactly `pageBody` and `pageFooter`; `pageBody`
(`contentHeight`) holds the band, if the page has one, and the ground. ⚠️ **`space-between` over
three children is the wrong answer** — it splits the slack in two and opens a gap **under the
header**, the one place on these pages nothing may move. `PAGE_GROUND` and the chrome band's `bar`
are both pinned to `contentHeight`, which is what stops the slack being redistributed rather than
kept at the foot.

⚠️ **The two public band pages do not take `pageShell`.** `Pages/Landing` and `Pages/Join` are built
on `BAND_PAGE_GROUND`, which already floors at `100vh`; the landing page places the footer component
as its last band and `/join` ends on its form panel with `--muted` beneath it.

**Cost, against the estimate.** The change list called item 4 *"one constant"*. It was a new
component, a new shell, a new body wrapper, two pinned heights and eleven rewritten page roots — and
one component count and one file count in the gate.

### The readings, with their exit statuses

| gate | reading |
|---|---|
| `npm run template:members` | **exit 0**, and **idempotent** — hashed before and after a second run, identical (`8af2aeec…`), so every diff this session is attributable. 30 components, 13 pages, 94 files |
| `tpl001Template.test.ts` | **exit 0** — **72/72**, taken after the last edit |
| full `noodl-mcp` suite | **exit 0** — **83/83 suites, 1085/1085 tests**, clean on the first run |
| `rel002c-look.look.ts` | **exit 0** — the fast door-only harness, run three times across the session; two of the three corrections above were found on it |
| `vib001-members.look.ts` | **exit 0** — **44 shots**, both states, seeded backend asserted before any picture. Door `md5=f969ad96`, living `md5=7164e4f6` |
| `tpl001-members-drive` + `tpl001-empty-states` + `rel002b-fail-closed` | **109/110 on the first run**, and the one red was the deletion doing its job: `§5 AC4`'s control asserted the moderator is offered `Post something` **and `Requests to join`**, and the second of those no longer exists. 🔴 **The pair is what makes AC4 a measurement** — two arms assert a pending person and a plain member are NOT offered them — so the control was re-pointed at `Requests`, the band's moderator-only pill, rather than dropped. Re-run after the correction: **exit 0, 110/110** on real enforcing backends. ⚠️ The background task's notification said *completed (exit code 0)* on the FAILING run too — the exit file written by the command itself read `1` |

---

### REL-003 — The stale bundles the cut inherits

Phase 80 closed several fixes whose effect a user cannot see, because the committed build output
predates them. The owner it assigned was *"whoever cuts the next 0.2.1 build"* — that is this phase.

| artefact | what is stale |
|---|---|
| `packages/noodl-mcp/dist/noodl-mcp.cjs` | a running MCP server still answers `notFound` for `Page.title`; source, suites and committed catalog are correct |
| `nodegx-backend/dist` | DEF-021 / DEF-023 |
| `noodl-editor/src/external/viewer`, `deploy`, the ssr copies, `nodegx-backend/deploy/artifact` | the old handler — an editor drive today exercises the pre-fix bundle. ~~DEF-035's `Origin` port has no output on the canvas until the cloudruntime bundle is rebuilt~~ 🔴 **the cloudruntime bundle is RETIRED (WF-007) — see below; DEF-035 rides in `nodegx-backend/dist`** |

**ACs**

1. Every artefact above is rebuilt from HEAD and committed, and the rebuild is **reproducible** —
   a second run is byte-identical.
2. Each named defect is **observed fixed through the rebuilt bundle**, not only through its unit
   suite. P77's SBR-015 admin drive is the instrument for the viewer half.
3. 🔴 Gate on the **exit status**, never on an error-line count. An OOM log carries zero
   `error TS` lines and reads as a pass.

---

#### 🔴 AC1 IS UNBUILDABLE AS WRITTEN — measured 2026-08-31 (s2)

**There are no committed bundles.** Every artefact this task names is **gitignored with zero tracked
files**, verified with `git check-ignore -v` and `git ls-files`:

| artefact | ignored by | tracked files |
|---|---|---|
| `packages/noodl-mcp/dist/` | `.gitignore:117` (`dist`) | **0** |
| `packages/nodegx-backend/dist/` | `packages/nodegx-backend/.gitignore:1` | **0** |
| `noodl-editor/src/external/{viewer,deploy,ssr,cloudruntime}` | `.gitignore:200` | **0** |
| `packages/nodegx-backend/deploy/artifact/` | `packages/nodegx-backend/.gitignore:9` | **0** |

🔴 **Committing them would fail a gate that already exists.** `scripts/check-build-artefacts.js`
check 1 (**REV-008**) asserts *"no generated editor build output is tracked in git"* — written after
a months-old committed bundle ran instead of the code beside it and the editor opened a black
window. So **AC1's "and committed" is not merely unnecessary, it is the defect REV-008 exists to
prevent.** ✅ **AC1 is amended**: rebuilt from HEAD, **reproducible**, and *not* committed.

✅ **And the release does not inherit the staleness.** `npm run check:artefacts` exits **0** with
*"2 packaging workflow(s) build the sidecars before electron-builder"* — check 3 exists precisely
because `release.yml`/`nightly.yml` once packaged without them. **A cut of 0.2.2 builds these; it
does not ship the tree's copies.**

🔴 **So what P80 actually found was LOCAL staleness, and it bites a DRIVE, not a user.** That is
still worth fixing — every drive REL-001, REL-002b and REL-003 itself depend on runs against this
checkout's bundles — but it is not a release blocker, and the task's framing had it as one.
✅ **Ask whether a stale artefact reaches a USER or only reaches YOUR INSTRUMENT** — the two have
opposite urgencies and this one is the second.

#### ✅ What was rebuilt, and the reproducibility reading

`npm run build:sidecars` — exit **0**, twice. All six outputs **byte-identical across the two runs**
(`md5` on `nodegx-backend/dist/{cli,index}.js`, `nodegx-observe/dist/nodegx-observe.cjs`,
`noodl-mcp/dist/{noodl-mcp,kit-extract,nodegx-observe}.cjs`), so **AC1's reproducibility clause is
met** for the sidecars.

`noodl-mcp.cjs` moved `033f0675…` (2026-08-20) → `1ad98b5c…` (2026-08-31), against a newest source
commit of `0b7a837c` on **08-31**: eleven days stale.

✅ **The viewer half of the reproducibility clause was measured too, by accident and then on
purpose (s3).** `build:editor:_viewer` was run a second time at 07:35 — a different session, a
different hour, the same HEAD — and produced `noodl.viewer.js` at **1,541,867 bytes, the same size
to the byte** as the 22:43 build, still carrying DEF-026's string. ⚠️ **Size-identical, not
verified byte-identical**: the 22:43 file's `md5` was never taken and the dev stack had already
overwritten it (see the trap below), so the digest cannot be recovered.

#### ✅ AC2, the MCP half — observed THROUGH the bundle, with a live control

The two bundles were asked **the same question, in the same project, through the same tool**, and
the only thing varied was which bundle answered. This session's own MCP server had loaded the old
`dist` at startup, so the stale arm is a **live reading**, not a reconstruction:

| bundle | `get_node_type(["Page"], ports:["title"])` |
|---|---|
| **old** (`033f0675…`, running server) | `"inputs": []`, **`"notFound": ["title"]`** — the defect, live |
| **rebuilt** (`1ad98b5c…`, HEAD) | `title` returned as a full declared input, with type, `displayName`, group and description. **No `notFound`** |

🔴 **This is why "the suite is green" was never the answer.** The source, the specs and the committed
catalog were all correct the whole time; the thing a user's agent talked to was eleven days behind
them. ✅ **A bundle is an artefact with its own mtime — grade the artefact, not its source.**

#### ✅ The suite the rebuild owed

`packages/noodl-mcp` — **83 suites, 1085 tests, all passed, exit 0.** Run after the bundle was
regenerated, because this is the package whose `dist/` moved. The count matches the independent
read a peer took over the same tree earlier the same day.

#### 🔴 The `cloudruntime` row names a DEAD artefact — and exit 0 did not say so

`npm run build:editor:_viewer` exited **0** and rebuilt `viewer`, `deploy` and `ssr`
(all three newest files stamped **2026-08-31 22:43**; `noodl.viewer.js` moved
`0e56e3a3…` → `3bf45a78…`). **`src/external/cloudruntime/sandbox.viewer.bundle.js` did not move** —
still `cd652849…`, still **2026-07-25**.

⚠️ **That looks exactly like a build that exited 0 without building anything** — the failure this
repo has already been bitten by. It is not. The truth is in
[`noodl-viewer-cloud/webpack-configs/webpack.prod.js`](../../../packages/noodl-viewer-cloud/webpack-configs/webpack.prod.js),
which says so in a comment: **WF-007 retired the sandboxed cloud-function-server, and its
cloudruntime bundle with it.** The config now builds only the isolate bundle.

🔴 **Cloud functions run inside `nodegx-backend`, which esbuilds `noodl-viewer-cloud/src` directly**
via the `@cloud-runtime` alias
([`nodegx-backend/scripts/build.js:38`](../../../packages/nodegx-backend/scripts/build.js#L38)).
Corroborated three ways: **nothing** in the repo writes `sandbox.viewer.bundle.js`; **nothing** in
`packages/noodl-editor/src` references `cloudruntime` at all; and `scripts/devtools/cdp.js:451`
**deliberately excludes it** from its freshness check with the same WF-007 note.

✅ **So this row of REL-003's table was wrong, and wrong in the expensive direction.** *"DEF-035's
`Origin` port has no output on the canvas until the cloudruntime bundle is rebuilt"* names a bundle
that **cannot be rebuilt because its producer was deliberately deleted**. The live carrier of both
DEF-023 and DEF-035 is **`nodegx-backend/dist`** — rebuilt this session at 22:40, with 65 markers
from `noodl-viewer-cloud` inside `dist/index.js`. A session following the table would have rebuilt,
seen the artefact unchanged, and concluded **the build is broken**. ✅ **Before calling a stale
artefact a build failure, find its PRODUCER — a dead artefact and a failed build look identical from
the mtime.**

⚠️ `src/external/cloudruntime/` is therefore **retired residue**: gitignored, unreferenced, unread.
Owner **NONE**. Left in place — deleting it is not this phase's call.

#### ⚠️ Registered, not built: eight stale duplicate directories

`noodl-editor/src/external/` holds macOS copy duplicates — `viewer 3`, `deploy 2`, `ssr 3`,
`cloudruntime 3` — all dated **2025-12-06**, up to nine months behind their unsuffixed twins.
✅ **Measured harmless**: nothing in `packages/noodl-editor/src`, `scripts/` or `.github/` references
any of them (quoted `--include` globs with `-a`; an unquoted glob is a zsh no-match that reads as a
clean absence), the editor's web server serves the unsuffixed `src/external/viewer`, and all four are
gitignored so none can ship. **Local clutter, owner NONE.** Recorded so the next session that greps
this directory does not re-derive it at full price.

#### ✅ AC2, the backend half — DEF-023 observed THROUGH a bundle, one variable, with a presence control

**The instrument** (`scratchpad/rel003/`, kept out of the repo): a real `nodegx-backend` spawned
from a `cli.js` handed in on the command line, driven over real HTTP, with a real SMTP socket on
the other end for the mail arm. **The only thing that varies between arms is which bundle is
spawned.**

🔴 **The July deploy artefact is NOT a usable pre-fix control.**
`packages/nodegx-backend/deploy/artifact/backend/cli.js` (2026-07-26) is the obvious free old arm
and it reads *zero* — but for the wrong reason: it predates ERG-001's port rename, so it answers
`Node noodl.cloud.sendemail doesn't have a port named done` and never mails at all. ✅ **A control
that cannot run the graph is not a control** — it was read first, and discarded, rather than
scored.

So the control was **built**: the same esbuild pipeline as `scripts/build.js` (same alias, banner,
target, externals), into a temp directory, over a **copy** of `noodl-viewer-cloud/src` with exactly
two files reverted — `nodes/cloud/sendemail.ts` to `4adab228^` and `noodl-js-api.js` to
`acd053e0^`. A third arm builds the *same* pipeline with **no** revert, so the pair differs in the
two source files and nothing else. ✅ **Nothing was written into the repository**: `dist/` is still
byte-for-byte what HEAD built at 22:40 (`md5 6b31e8d1…`).

| arm | `guarded` invoked 3× | `sharing` (the presence control) |
|---|---|---|
| **PRE-FIX** (2 files reverted) | `fresh` → **`stale`** → **`stale`** | `written-by-the-first-script` |
| HEAD source, same pipeline | `fresh` → `fresh` → `fresh` | `written-by-the-first-script` |
| **`packages/nodegx-backend/dist/cli.js` — the rebuilt artefact** | **`fresh` → `fresh` → `fresh`** | `written-by-the-first-script` |

The graph is D35's guard verbatim (`if (Component.def023 && Component.def023.planned) …`), the same
one `def023-component-scope-lifetime.test.ts` uses — but here it is reached over HTTP, by a service
loaded from a bundle, three requests in a row.

🔴 **The `sharing` row is what makes the other one mean anything.** `fresh, fresh, fresh` is also
what you would see if the fix had simply made `Component` a fresh bag on every script run, which
would break the contract the scope exists for. Two scripts in **one** component instance still see
each other's writes, in every arm — so the reading is *"the scope died with the request"*, not
*"the scope stopped working"*. ✅ **Assert an absence only beside a known-firing signal.**

#### 🔴 AC2, the mail half — DEF-021 is NOT OBSERVABLE through the bundle, and the reason outlives this task

The fan-out arm passes and **proves nothing**. Three addresses asked, **three delivered, to a, b
and c**, through the rebuilt `dist/cli.js` — and **the pre-fix bundle delivers the same three**.

The tell is the control, not the finding. The constant-address arm — erg-001 §4's pinned
behaviour, *"two Dos coalesced into one pass are ONE send"* — delivered **three** messages in
**every arm**. That can only mean the batch never holds more than one token, and `doSend`'s
changed branch is entered only when it does: DEF-021 rewrote how an **already-coalesced** batch is
dispatched and left `scheduleSend`'s coalescing guard untouched. No coalescing, no difference.

Three constructions were tried, all with `To` held constant and `Do` pulsed twice — two pulses from
one script run; two pulses from two scripts fanned out from the same `receive`; and the same wire
duplicated straight from `receive` into `Do`. **All three delivered two messages.** The mechanism
is not mysterious: `flagDirty` → `_performDirtyUpdate` runs synchronously
([`node.ts:760`](../../../packages/noodl-runtime/src/node.ts#L760)), so each pulse completes its own
update — including `scheduleAfterInputsHaveUpdated`'s callback — before the next one arrives.

🔴 **So the pinned behaviour is a property of the unit probe's scheduler, not of a running cloud
function.** `erg-001-cloud-node-outcomes.test.ts` §4 and `def021-send-email-fanout.test.ts` both
drive the node with a hand-built probe whose `scheduleAfterInputsHaveUpdated` pushes into an array
flushed by hand. Server-side, two `Do`s are two sends. ✅ **A spec that supplies the scheduler is
grading its own harness** — and `Send Email` is server-only, so there is no other runtime in which
this branch could be reached.

⚠️ **What this does and does not say.** It does **not** say the DEF-021 fix is wrong: the delivered
addresses are correct in both arms and the new code is strictly more careful. It says **AC2 cannot
be discharged for DEF-021 by a drive**, because the rebuilt bundle and the pre-fix bundle are
behaviourally identical from every door a graph can knock on. The unit suite remains the only
instrument that can see it. **Recorded rather than dressed up as a pass.**

🧭 **Registered, not built — owner `NONE`.** *"Is `Send Email`'s coalescing branch dead code in
every runtime, and if so does D33's blast radius survive re-derivation?"* It does not block a 0.2.2
AC and it is not this phase's work. It belongs to whoever next owns `noodl-viewer-cloud`'s node
ergonomics; there is no open phase holding that today, which is why the owner is `NONE` and the row
lives here rather than in a closed phase's register.

#### ✅ AC2, the viewer half — DEF-026 observed in a REAL BROWSER, both halves, with an answering control

Driven in the editor's preview window (CDP `--target=viewer`), on a **copy** of `fix012-drive`, with
`cloudservices.endpoint` pointed by hand at a **closed port** and then at a **live server that
answers with an error body**. The endpoint is the only thing that varies.

| arm | `Noodl.CloudFunctions.run(…)` rejects with | `CloudFunction2` node |
|---|---|---|
| **refused** — `http://127.0.0.1:59999` | `{"error":"Could not reach the backend at http://127.0.0.1:59999"}` | signals **`failure` → `completed`**; `Error` = the same sentence; `lastCallResult.status = failure`; **no uncaught exception** |
| **answering with an error** (control) | `{"code":141,"error":"the backend answered, and this is its reason"}` — the body, verbatim | signals **`failure` → `completed`**; `Error` = the body's own reason |

🔴 **Both halves of the fix were driven, and they are two different copies of `_makeRequest`** —
`api/cloudfunctions.ts` (the `Noodl.CloudFunctions` API a script calls) and
`nodes/std-library/data/cloudfunction2.ts` (the node). Probing one would have said nothing about
the other.

✅ **The answering arm is the known-firing signal.** *"Could not reach the backend"* on its own is
also what you would see if the handler had simply been made to print that sentence for every
failure — and it is what a **CORS rejection** looks like, since that is `status 0` too. The control
server sends permissive CORS headers and a JSON 500; its reason comes back verbatim, so the two
failures with opposite fixes are still separate. **This is the person-sentence in DEF-026** — *a
graph wired correctly for failure showed nothing when the backend was simply not running* — and it
now fires.

⚠️ **Two boundaries, said rather than buried.**

1. 🔴 **The bundle that answered was the DEV webpack build, not the 22:43 production rebuild** —
   see the trap below. Same HEAD source, real Chromium, real XHR; but it is not a reading of
   `src/external/viewer/noodl.viewer.js` as REL-003 rebuilt it.
2. **No pre-fix arm.** The one free candidate,
   `nodegx-backend/deploy/artifact/app/noodl.deploy.js` (2026-07-26, and it does **not** contain the
   string), was not served and driven. So this arm shows the fix present and discriminating; it
   does not re-measure the defect.

#### 🔴 `npm run dev:debug` OVERWRITES the viewer bundle REL-003 just rebuilt

Measured this session. `build:editor:_viewer` wrote a **production** `noodl.viewer.js` at
**22:43 — 1,541,867 bytes**. Launching the dev stack put webpack in watch mode over the same
output directory, and by **07:27:22** that path held a **dev** build of **14,535,265 bytes**.

✅ **Same source, different artefact.** Nothing was lost — the file is gitignored, the release
pipeline builds its own (check 3, README §1), and the dev build carries the fix (the DEF-026 drive
above ran against it). But a session that rebuilds the production viewer and *then* launches the
editor to check its work **is no longer looking at what it built**, and the mtime will not say so:
both are recent. ✅ **After a drive, rebuild the production viewer before claiming the tree carries
it — and check the SIZE, which is the field that separates the two builds.** Restored at the end of
this session.

### REL-004 — The cut

**ACs**

1. ✅ **MET, session 11 — `5c805978`.** `packages/noodl-editor/package.json` reads `0.2.2`, and the
   bump is its own commit: one file, one line, committed by pathspec so no peer edit rode with it.
   Gated on `npm run ci:build:editor` **exit 0** after the change — the production-only path that
   `test:ci`, `typecheck`, `lint` and `test:main` never load. See
   [the runbook §2](../release-0.2.2/PUBLISH-0.2.2.md) for the two findings behind it: the nine
   `library/prefabs/*/library.json` files that also read `0.2.0` and must **not** move, and why the
   `package-lock.json` copy is **not** a gate despite CI running `npm ci`.
2. Release notes written from the **commits since `v0.2.0`**, not from task files — a task file
   says what was intended, the log says what shipped.
3. Tagged `v0.2.2` and published, following `dev-docs/tasks/release-0.2.0/PUBLISH-0.2.0.md`.
4. The floor is green before the tag, and the reading is **fresh** — delete `test-results.json`
   first and require a new mtime. ⚠️ `typecheck:backend-tests` cannot complete on this box; CI runs
   it. Do not promise a local reading.
5. 🔴 A bad cut is fixed by unpublishing (edit → draft) and shipping 0.2.3 — recorded so nobody
   force-pushes a tag.

### REL-005 — What rides and what rolls

Phase 75 is the 0.2.1 container and its board is nearer done than its reputation. Counted from
`phase-75-…/TASKS.md` tiers 0–4 on 2026-08-31: **22 done, 4 open — 26 rows.** ⚠️ **This originally
read "24 done, 4 open" and the done count was two high**; corrected s2 by counting the board's own
`- ✅`/`- ⬜`/`- 🟡` rows between the Tier 0 heading and the *Found while working* section. The open
count, which is what the triage acts on, was right.

| open row | state |
|---|---|
| **FB-005** — templates, curated first | T1–T5 **built and deployed**; the blocker is **CONTENT**. 🔴 **REL-001 is what closes this gap** — publishing the association template puts the first row on an empty shelf |
| **FB-013** — chat | Overruled and scoped; C1/C2/C3 built |
| **FB-009** — a syllabus entry you can start | 🧭 lessons are Richard's prose |
| **FB-012** — default tutorials + share/export | 🧭 content is Richard's |

Plus the phase-74 carry: FIX-025, FIX-026, FIX-027, the `tsfixme` baseline, and the production
`ANTHROPIC_API_KEY` (open, **no deadline** — see the correction in P75's handoff before repeating
one).

**AC**: each row is marked **rides 0.2.2** / **rolls forward, owner X** / **blocked on Richard**, in
writing, in P75's own board. Two of the four are gated on Richard's content and cannot be
force-marched.

✅ **CLOSED 2026-08-31 (s2).** The AC is met in
[`phase-75-…/TASKS.md`](../phase-75-0.2.1-the-feedback/TASKS.md): a **triage section at the head of
the board**, plus an inline disposition on each of the **four open rows** and each of the **five
phase-74 carry items** — nine in total.

🔴 **The distinction that decided every row: `0.2.2` is an APP cut, and `nodegx-community` is
SERVED.** Served work is either deployed or not and never rides a tag, so a row with both halves is
triaged twice, and "done" on the served side is a **deploy stamp with a date**, not a commit.

**The dispositions**

| row | disposition |
|---|---|
| FB-005 | ✅ **rides (code) · closes on REL-001** — shelf measured `total: 0`, so the gap is content |
| FB-013 | 🟡 **partly rides** (C4's launcher half, `3d01a44d`) · **remainder rolls forward, owner phase 75** |
| FB-009 | 🧭 **blocked on Richard** (prose) · **rolls forward, owner [phase 79](../phase-79-the-syllabus/README.md)** |
| FB-012 | 🧭 **blocked on Richard** (content) · **rolls forward, owner phase 75** |
| FIX-025 | ✅ **rides** what landed · §5's park rolls forward |
| FIX-026 | 🧭 **blocked on Richard** · rolls forward, owner phase 75 |
| FIX-027 | ✅ **rides** §17/§19/§20 (`f6d25d19`, `fada53fd`) · remainder rolls forward |
| `tsfixme` baseline | 🧭 **blocked on Richard** · rolls forward, owner phase 75 |
| prod `ANTHROPIC_API_KEY` | 🧭 **blocked on Richard** · rolls forward · 🔴 **no deadline** |

**Measured today, not relayed** — `/api/v1/community/templates` **200** `total: 0`,
`/api/v1/community/chat` **200**, `/chat` **200**, invented sibling **404** (the control that makes
those 200s mean *the route exists*); nexus-1 stamps `91d8b0c4…` `main` `dirty: false`
2026-08-28T06:48:29Z; `3d01a44d`, `f6d25d19`, `fada53fd`, `27f16f8b` all ancestors of HEAD.

🔴 **Two findings the triage produced, both registered in P75 rather than built here:**

1. **FB-013's own "the chat routes are NOT DEPLOYED — 404 on production" is no longer true.** A
   deploy landed 2026-08-28T06:48Z. The sentence is still a correct account of why session 57 drove
   locally; it is **not a reading of production today**. ✅ **A deployment claim decays — re-read the
   stamp, never inherit it.**
2. ⚠️ **C5 is built, committed and undeployed, and production is exactly one commit behind it**
   (`2bce720` vs `91d8b0c`), with **`NODEGX_MODERATORS` unset** on nexus-1. So **any deploy of
   `main` to nexus-1 carries C5 in** — and unconfigured, its hide route 404s for everybody including
   Richard. **Set the var in the same act, or do not deploy it.** Owner: phase 75. **Not built here**
   — it does not block a 0.2.2 AC.

⚠️ **Also corrected in P75 while triaging its own rows**: the board still carried
🔥 *"the `ANTHROPIC_API_KEY` item has a 2026-08-31 deadline."* That urgency was **retracted in P75's
own handoff** and never reached the board. It is a **price date, not a deadline**, and REL-007 has
now removed its one real consequence.

### REL-006 — The hold list, and two stale files

**ACs**

1. The site-builder hold is recorded with a **named owner and a phase that outlives this one** —
   `NONE` is allowed; a closing phase's name is not.
2. `phase-78-the-templates/NEXT-SESSION-PROMPT.md` is corrected: **T6 is done at HEAD** (README
   §1.3), so *"the only buildable work left"* is now T5, and T5 is unblocked.
3. `TPL-001-THE-MEMBERS-AREA.md` **AC1** is updated from *"not gradeable"* — REL-001 is what grades
   it. AC6 (the designed empty state on a fresh install) is the one criterion with no reading
   against it, and it is **the same screen REL-002c is redesigning** — grade it once, there.
4. 🔴 **Phase 81's board records that VIB-005 and VIB-008 are CARRIED to phase 82**, with this
   phase named as the owner. Without it two phases believe they own the members' area — the trap
   that already cost this project two sessions on P77 D30/D31. ⚠️ **Write it only after the peer
   session that was live on 2026-08-31 has ended**; check the lane first.

### REL-007 — The price that goes stale tomorrow

[`models.ts:229`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/models.ts#L229)
prices `claude-sonnet-5` at `$2 / $10` per MTok, with a `MAINTENANCE:` comment saying the
introductory rate ends **2026-08-31** and reverts to `$3 / $15`.

Verified against current Claude pricing 2026-08-31: **Sonnet 5 is $3 input / $15 output per million
tokens**, with $2/$10 introductory through 2026-08-31. Sonnet 5 **is the app's default model**
(`isDefault: true`), so from 1 September every cost figure the app reports is low by a third.

⚠️ The other `inputPerMTok: 2.0` in the file (line 266) is **GPT-4.1** and is unrelated. Change the
Anthropic entry only, and remove the `MAINTENANCE` comment with it.

**AC**: line 229 reads `{ inputPerMTok: 3.0, outputPerMTok: 15.0 }`, the stale comment is gone, and
any spec asserting the old figure moves with it. A stale price does not break requests — it only
misreports cost — so this is a one-line fix, not a first job.
