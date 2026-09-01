# Phase 82 — next session

_Opened 2026-08-31 (s1). Last updated **2026-09-01, session 8**, which finished **all six** of row
6's ruled items — the icons, the second photograph, the whole of §E and the row family. The row now
waits on **one thing: Richard looking at it**. The decisions are still
[`RICHARD-RULINGS-2026-09-01.md`](RICHARD-RULINGS-2026-09-01.md)._

## 🔴 Read this first: this is the only board you open

Richard, 2026-08-31: *"can we work through the next session prompt in phase 82, rather than me
ending up driving unnecessary tasks in other phases by accident — just so we focus on the tasks we
need to launch, over several sessions all in phase 82."*

**So: every launch session opens THIS file, takes the next unstruck row from the run sheet below,
and finishes inside phase 82.** The look work that used to live in phase 81 (VIB-005, VIB-008) has
been **carried here** as REL-002a/b/c, with its verdict scale and close protocol **restated in
[`TASKS.md`](TASKS.md)** — you do not need to open phase 81 to build or close it.

🔴 **If a row is not on this board, it does not gate 0.2.2.** Do not open P75, P77, P78 or P81
boards "to check". Anything else you find is a **register row with an owner**, not this session's
job — see [`../../guidelines/PHASE-EXECUTION.md`](../../guidelines/PHASE-EXECUTION.md).

Then read [`README.md`](README.md) §1 and re-derive the board from `TASKS.md` and the artefacts.

## The run sheet — the whole path to launch

Take the topmost row that is not ✅. Strike it here when it closes.

| # | row | why here | needs |
|---|---|---|---|
| ~~1~~ | ~~**REL-007** price line + **REL-006** hold/doc fixes~~ | ✅ **BOTH CLOSED, s1** | — |
| ~~2~~ | ~~**REL-005** triage P75's four open rows~~ | ✅ **CLOSED, s2** — nine dispositions written into P75's board | — |
| ~~3~~ | ~~**REL-003** rebuild the stale bundles~~ | ✅ **CLOSED, s3** — DEF-023 and DEF-026 observed through bundles with control pairs; DEF-021's clause RETIRED as unmeetable | — |
| ~~4~~ | ~~**REL-002a** the ambush defaults~~ | ✅ **CLOSED, s4** — the defect was `settings.bodyScroll`; template 0/7 → 7/7 reachable controls | — |
| ~~5~~ | ~~**REL-002b** fail closed + designed first run~~ | ✅ **CLOSED, s5** — `Denied` + `isSignedIn` + `waitingCard`; **37/37** on a real enforcing backend | — |
| 6 | **REL-002c** the members' area, redeemed | the redesign; **the phase's close condition** | 🟢 **BUILT s8, all six ruled items** — §C, §D (hero + `/join` photograph + icons), §E (tagline, About band, `Start here`), §F, and the row family. **Waits ONLY on Richard's WORTHY ruling** |
| 7 | **REL-001** publish + drive the install | shelf's first row; also closes P75's FB-005 | ✅ **metadata RULED s6** · **Richard drives the publish** |
| 8 | **REL-004** cut, tag and publish `v0.2.2` | last | ✅ **number + notes shape RULED s6** · green floor, fresh readout |

🔴 **CORRECTED s6 — row 6 could never have been ruled at session open, because nothing was
built.** The previous handoff said *"open by asking him for the ruling on 6"*; there was no redesign
and no render to rule on. What Richard actually had to decide was the **direction**, so a session
did not build a guess he would then reject.

✅ **He decided it, 2026-09-01 — fifteen questions, ALL FIFTEEN settled.** Read
[`RICHARD-RULINGS-2026-09-01.md`](RICHARD-RULINGS-2026-09-01.md) **before touching rows 6, 7 or 8**.
Two rulings **amend ACs on the board**: REL-002c is now **all thirteen pages**, and REL-001 publishes
as **`starter`**, not `data-app`. **Nothing in that file awaits him** — §A2, §E and §G4 were open at
first pass and were ruled on the second.

**So the sequence is: build row 6 from the rulings → Richard rules WORTHY on the renders → row 7 →
row 8.**

## 🔴 The next job

**Row 6 is BUILT. The next job is the two things only Richard can do, and then rows 7 and 8.**

🔴 **Read [`TASKS.md`](TASKS.md) §"REL-002c — what session 8 built" FIRST**, and session 7's section
above it. Between them they carry every reading and every reason.

### 🔴 1. THE SESSION'S OPENING MOVE IS TO PUT TWO THINGS TO RICHARD, TOGETHER

There is now an artefact to rule on — which is exactly what session 6's handoff got wrong when it
asked for a ruling on a page nobody had built. **Both of these are for him and neither blocks the
other.**

**(a) The WORTHY ruling — the phase's close condition.** He rules six pages, in **both** states, at
**three widths**: `/` (both states), `/setup`, `/join`, `/members`, `/directory`. The photographs
are in `verdicts/vib-001/2026-09-01/members-area-living/` and `…/members-area-door/`, freshly
rendered at HEAD. The other seven are the Judge's, and 🔴 **any SHITTY escalates to him** — that
escalation is the half that makes §A2a different from shipping seven pages nobody looked at.

**(b) The `FORM_GROUND` question, unchanged since s7 and still open.** Six of the thirteen pages
carry a **720px centred** ground rather than §C's literal 1200: `Pages/{SignIn, Join, Setup, Post,
Account, Unsubscribe}`. This was a deliberate departure made **after rendering the literal reading
and finding it worse than the baseline** — at 1200 `/setup` is six stacked 1100px-wide text inputs,
and a capped left-aligned form inside a 1200 shell puts ~480px of white on the right only, which is
the *"weird"* he named. A 720 centred ground gives 280px either side. **The question**: is a centred
720 form ground the right reading of §C, or does he want the literal 1200 — in which case the answer
is a **two-up split** filling the shell, which is more work and a better page.

⚠️ `/join` is already built as bands, so if he rules 1200 that page's structure is what a two-up
would sit on and only the form half moves. The single line to change is `JOIN_GROUND`'s shell cap.

### 2. Then row 7 — REL-001, the publish

Unblocked the moment he rules WORTHY. Publish as **`curated`**, **`category: 'starter'`** (🔴 **not
`data-app`** — this amends TPL-001 AC8 and moves the literal in `template-search.test.ts` and
`template-install-over-http.test.ts`), title **"Members' area"**, summary *"members only site for a
club, charity or church"*. **Richard publishes** — it is a DB-credential act from the
`nodegx-community` repo. ✅ **Do not wait for the cut**; G5a settled that they are two moments.

⚠️ **New since s8: the artefact carries `docs/START-HERE.md`.** Checked in the community repo —
`readBundleDirectory` walks the tree fully recursively, so it travels and installs. If the publish
does anything surprising, that file is the one thing in the bundle that is new in shape.

### 3. Then row 8 — REL-004, the cut

`0.2.2`, and the notes carry the line that **0.2.1 was an internal cut held back as too buggy**.
Notes split two ways — the
[NodeGX 0.2.2 artefact](https://claude.ai/code/artifact/70d4e79e-78ce-44c8-b9f5-e06c6b0b6d11)
becomes the **full log**, the GitHub release body carries **highlights + a link to it**.
🔴 **The artefact's stat band is stale — it reads 559 commits; `git log v0.2.0..HEAD` counted 567 on
09-01.** Its ship-gate section also still lists TPL-001 as unpublished. Re-read both against reality
at tag time. ⚠️ Viewers are currently pinned to an earlier version, not the live one.

### The four gates row 6 owes, and their readings at the end of s8

| gate | reading (s8, HEAD `1f4d5547`) |
|---|---|
| `npm run template:members` | **exit 0**, **idempotent** — hash it before you edit and confirm a no-op, which is what makes your diff attributable. `27f127e9…`, 91 files |
| `tpl001Template.test.ts` | **exit 0**, 72/72 |
| full `noodl-mcp` suite | **exit 0** — **83/83 suites, 1085/1085 tests**, clean on the FIRST run. ⚠️ s7 saw a lone red on `projectOwnsBackend.test.ts` that passed on re-run — 🔴 **a lone red here is a FLAKE until re-run** |
| `vib001-members.look.ts` | **exit 0**, both states, 44 shots, seeded backend asserted before any picture |

✅ Also run, and not owed: `tpl001-members-drive` + `tpl001-empty-states` + `rel002b-fail-closed`,
**110/110 on real enforcing backends** — because the row family changed the shape of two components
a drive reads.

### What is still WRONG, and is nobody's AC

⚠️ **The gated pages have no bottom edge.** `PAGE_GROUND` carries an inert `height: 100%` (session 7
item 3) and no floor, so `/directory` at 1900×1200 is four rows and then 600px of white. The landing
and `/join` are fixed — they use `BAND_PAGE_GROUND`'s `minHeight: 100vh` + `space-between`. The
other eleven are not. It is a one-constant change and it was **not** made this session because it
touches every page and there was no render budget left to grade it. If Richard's verdict names it,
that is the fix.

## What session 5 did — row 5, REL-002b

Closed it, both ACs. Full account in [`REL-002b-FAIL-CLOSED.md`](REL-002b-FAIL-CLOSED.md).

**The headline: the row's stated mechanism was wrong, and the truth was worse.** V3 said the gate
"fails open… showing the protected surface". Measured at HEAD, it did not: all six protected pages
already carried `mounted: false` on every gated group, so the content was never revealed. What
actually happened with no backend bound was that **all six stayed on their own protected URL**,
wearing the full members' band — `Sign out`, the association slot, three nav buttons — and **five of
the six said nothing at all** about why they were empty. Nothing had refused; six parameter defaults
had merely hidden things.

Built: **`Denied`** (two producers — answered-`visitor`, and *could not be asked*, the half that did
not exist), **`isSignedIn`** gating the band's `topRow` and `nav`, and **`waitingCard`** on the
landing page. **V4 turned out to be one parameter**: `actions` was the only group on that page
without `mounted: false`, so it was the one thing that survived a query that never answered.

Driven **37/37** across four arms on two real enforcing backends.

## 🔴 What to carry out of session 5

1. 🔴🔴 **STARTING A SECOND `BackendService` IN THE SAME PROCESS INVALIDATES THE FIRST ONE'S
   SESSIONS.** This cost most of the session and **it presents as a template defect** — a signed-in
   moderator ejected by the gate, which is exactly what the new spec exists to detect. Measured one
   variable at a time: with the second `start()` before backend A's browser work, the browser signs
   in perfectly (localStorage holds `roles: ["admin"]` and a well-formed `r:` token) and the server
   then calls that token a **`visitor`** and answers a member-only function **500**; a session
   minted over HTTP seconds earlier reads `moderator` in both orderings. ✅ **A two-backend drive
   must FINISH with the first before starting the second.** Registered, owner `NONE`.
2. 🔴 **`DbCollection2` never fires `failure` when no backend is bound** — so any "we could not
   reach the backend" state hung off `failure` is **dead in the only case it exists for**, and would
   pass review. A 200 whose body is not JSON makes
   [`ParseWireAdapter._makeRequest`](../../../packages/noodl-runtime/src/api/backends/ParseWireAdapter.ts#L216)
   call `success(undefined)`, and `query`'s handler throws on `response.results` **before** the
   node's own `if (results !== undefined)` guard. ⚠️ **NOT the same claim as D4**, which proved
   `failure` *does* fire on a real 403 — a refusal is legible, a missing backend is not. Registered,
   owner `NONE`. ✅ The template's waiting state is a **default-mounted** card taken down by an
   answer, which needs no failure signal at all.
3. 🔴 **`Visit.url` is the URL that was REQUESTED, not where the page ended up.** Any assertion
   about a redirect written on it passes on every arm, including broken ones. ✅ Read
   `location.pathname` out of the live page, after a beat — a signal-driven navigation can land
   after `readVisit` has settled on the text of the page it is leaving.
4. 🔴 **The control is the arm that catches you.** The first build of the fix ejected **everybody**,
   the signed-in moderator included, and every visitor/failure assertion in the file was green. Only
   *"a signed-in member is NOT ejected"* went red. Three arms that all end on `/` are equally
   consistent with a gate that refuses unconditionally.
5. ⚠️ **Replaying the browser's session token from Node is not the request the browser makes** — the
   browser carries an `installationId` the replay does not, so a replay can read as a refusal while
   the page is perfectly signed in. Use it as a supporting reading; the load-bearing control is what
   the **page** shows.
6. ⚠️ **`.look.ts` files are NOT run by jest** — `testMatch` is `**/tests/**/*.test.ts`.
   `vib001-members.look.ts` and `tpl001-rows.look.ts` read this template and were exercised by
   nothing this session. If REL-002c changes the look, they are the files that should have graded it
   and will not unless run deliberately.
7. ✅ **`mounted` defaults to `true`** ([`react-component-node.ts:1900`](../../../packages/noodl-viewer-react/src/react-component-node.ts#L1900)),
   so every `mounted: false` in this template is a decision somebody made — and a group *without*
   one is the thing that survives a query that never answers. That is the whole of V4.

## What session 6 did

**No row closed — s6 was the decision session, and that was the correct use of it.** Fifteen
questions were derived from rows 6, 7 and 8, put to Richard, and all fifteen were ruled. They are in
[`RICHARD-RULINGS-2026-09-01.md`](RICHARD-RULINGS-2026-09-01.md), which is now the build brief for
every remaining row.

🔴 **Two rulings AMEND ACs the board had already written**, so the board was corrected in place
rather than left contradicting itself: REL-002c's scope (two pages → **thirteen**) and REL-001's
category (`data-app` → **`starter`**, which also amends TPL-001 AC8).

## 🔴 What to carry out of session 6

1. 🔴 **THE PHASE-82 DIRECTORY WAS UNTRACKED FOR FIVE SESSIONS.** `git status --porcelain | wc -l`
   read 82 and every handoff said *"nothing has been committed this session"* — which read as a
   choice, and was not: **git had never seen the board, the handoff, or either task file.** A
   directory shows as a single `?? path/` line, so a file-count check cannot see it. ✅ **`git status
   --porcelain | grep '^??'` before believing a count**, and check whether a `??` is a **directory**.
   Committed in full at `0c9ecad8`.
2. ✅ **`sb007Template.test.ts` is resolved, and the previous handoff's description of it was wrong.**
   It is **tracked and modified**, not untracked — `+23/−1`, **documentation only**: a comment block
   recording that the DEF-007 AC3 gate reads one shipped artefact of two (TPL-001 disagrees in 57
   places), plus a `describe` rename to *"the shipped SITE-BUILDER template"*. Richard confirmed it
   is not his. It is an orphan from closed P80 work, its content is correct, and it belongs to P80's
   Row 10 (`UNOWNED-ROWS-TO-MEASURE.md`, owner `NONE`). **Safe to commit.**
3. 🔴 **An AC written before the evidence was in can be WRONG, not merely incomplete.** REL-002c's
   *"the landing page and one members page"* was not a scoping decision — it was an artefact of only
   four pages having been rendered when it was written. Asking Richard produced a **13-page** answer.
   ✅ **When an AC's number matches how much had been measured at the time, re-derive it before
   building to it.**
4. ⚠️ **A handoff can instruct you to ask for a ruling that cannot exist.** The s5 handoff said to
   open by asking Richard to rule row 6; nothing was built and there was no render to rule on. ✅ **A
   WORTHY ruling needs an artefact — check one exists before making the ask the session's opening
   move.**

## What session 7 did — row 6, the spine of REL-002c

**No row closed; the row is part-built and rendered.** Full account in
[`TASKS.md`](TASKS.md) §"REL-002c — what session 7 built".

Built and photographed in both states: **§C** the measure (`PAGE_GROUND` and the chrome shell 760 →
**1200**), **§D** the hero photograph under a scrim on `/`, **§F** `waitingCard` and `setupCard` as
glass panels standing on that photograph, a **footer band** so the page has a bottom edge in every
state, the three landing tiles **3-up** in a `gridAutoFit`, and the Join page's second filled button
demoted to the outline.

✅ **V15 is CLOSED and the cause was not the nav.** At 760 the six `gridAutoFit` items at
`minWidth: 132` fitted five across and folded the sixth, on every signed-in page at every viewport.
The chrome cap was the whole mechanism; at 1200 they are one row of six.

## 🔴 What to carry out of session 7

1. 🔴 **A DEFAULT-CLOSED GROUP WITHOUT A WIRE IS NOT A GATE, IT IS A DELETION.** `hero` was given
   `mounted: false` so it could not paint an eyebrow over two empty `Text` nodes — and the wire that
   turns it back on was a separate edit that did not happen. The living landing page rendered a
   photograph and two buttons and **no association name at all**, and every gate in the repository
   was green over it. ✅ **The two edits are ONE edit.** Found by looking at the picture, which is
   the only instrument that could have found it.
2. 🔴 **A COMPONENT INSTANCE CARRIES NO LAYOUT PORTS AT ALL** — *"it has only the ports its
   Component Inputs node declares"*, and the door **refuses the write** rather than discarding the
   values. So a component instance can never satisfy the "every `Columns` child carries `sizeMode`
   and `width`" sweep; it needs a **wrapper Group that owns the box**. ✅ The door's refusal is the
   good outcome here — a silent discard would have shipped three tiles that ignore their columns.
3. 🔴 **`height: 100%` IS INERT ON EVERY PAGE IN THIS TEMPLATE, AND ALWAYS HAS BEEN.** A percentage
   height resolves against the parent, and the parent chain ends at a `Router`, which sizes itself
   to its content — `APP_NODES`' own comment says so. `PAGE_GROUND` has carried `height: 100%` on
   all thirteen pages and it has never done anything; it was invisible only because nothing painted
   a background to show where the box ended. ✅ **`minHeight` is the one dimension port that takes
   `vh`** (`units: ['%', 'px', 'vw', 'vh']`), so it floors a page at the viewport without asking
   anybody.
4. 🔴 **TWO COMMENTS IN THE GENERATOR WERE FACTUALLY WRONG AND BETWEEN THEM COST A LAYOUT.**
   *"`Columns` … a node type this template does not use anywhere"* — it has used one since s8 — and
   *"a Group row cannot collapse … there is no `flexWrap` on a Group"* — `flexWrap` is a real port
   ([`group.ts:311`](../../../packages/noodl-viewer-react/src/nodes/visual/group.ts#L311)) and
   `ui-landing-page` uses it. On the strength of those two the three landing tiles were stacked
   full-width. ✅ **A confident comment in a file this well-documented is still a claim; check it.**
5. 🔴 **RE-RUN THE GATE AFTER THE LAST EDIT, NOT AFTER THE ONE BEFORE IT.** `tpl001Template.test.ts`
   was run green at 72/72, then the hero wire was added, then it was not re-run — so it showed up
   red in the full-suite run and read for a moment like a suite-vs-alone discrepancy. It was neither:
   it was a **stale reading**. ✅ The gate that matters is the one taken after the final edit.
6. ⚠️ **RENDER THE LITERAL READING OF A RULING BEFORE ASSUMING IT IS RIGHT.** §C's *"maxWidth 1200 on
   every structural shell"* produces a 1100px-wide password field on `/setup`. The ruling's own
   stated criterion — equal white space either side — is what resolves it, and the two only disagree
   on the form pages. ✅ **A ruling's CRITERION outranks its worked example when they part.** Flagged
   for Richard rather than decided quietly; see §0 of the next job.
7. ✅ **A 92-second door-only harness paid for itself many times over.** `rel002c-look.look.ts`
   renders 4 pages × 4 viewports with no backend. The full both-states instrument is ~5 minutes and
   needs a seeded backend; the fast one is what makes "change it and look" a loop rather than an
   event.

## What session 8 did — row 6, the rest of REL-002c

**No row closed; row 6 is BUILT and waits on Richard.** Full account in [`TASKS.md`](TASKS.md)
§"REL-002c — what session 8 built".

All four open items landed: **§D's icons** (a distinct glyph badge on all eight gated page heads),
**§D's `/join` photograph** (the page is bands now, with its own picture and its head on the scrim),
**§E's data half** (a new `tagline` field end to end, the blurb moved to its own "About us" band, and
a `docs/START-HERE.md` generated from the artefact), and **the row family at 1200** (an excerpt on
the announcement row, and the directory row as a three-column table that folds to one under 700px).

## 🔴 What to carry out of session 8

1. 🔴 **A FIX CAN BE ONE ELEMENT SHORT AND EVERY GATE STAYS GREEN.** Session 7 added the landing
   footer *"so the page has a bottom edge in every state"* and it did not: with `flex-start` and
   `minHeight: 100vh` the door state still ended in **270px of bare `--muted` below a finished
   footer**. The defect had moved down the page by one element, which is the shape a fix takes when
   it is graded by the presence of the thing added rather than by the symptom it was for. ✅ **Look
   at the picture for the SYMPTOM, not for the FIX.**
2. 🔴 **A GATE'S SHAPE HEURISTIC CAN BE RIGHT UNTIL A SECOND INTENTION PRODUCES THE SAME SHAPE.** §2
   counts *a Group wrapping exactly one Text* as a notice box. A `Columns` child must be a Group that
   declares `sizeMode` and `width` — so the directory's three cells are that shape and are not
   notices. ✅ **Correct the CENSUS, not the artefact**: painting them to go green would have put a
   fill and a radius behind every name in the directory. ✅ **The control is that the pin did not
   move** — 27 → 24, exactly the three new cells and no pre-existing notice.
3. 🔴 **A SPEC THAT READS "THE FIRST CHILD" CONSTRAINS WHERE YOU MAY ADD ONE.** §5 reads a page's
   eyebrow as the head Group's `children[0]`, against a hand-written table. A glyph inserted into the
   head would have reported all eight badged pages as having lost their eyebrow. ✅ **Wrap, do not
   insert** — and read the gate before choosing the tree, not after.
4. 🔴 **THE MANIFEST'S LIST AND THE FONT'S CONTENTS ARE TWO DIFFERENT ANSWERS.** Lucide's `_note`
   says the bundled font carries all 1,998 glyphs and `styles.css` has a rule for every one — true,
   and `icon-megaphone` draws. But the **door validates against the manifest's curated 215**, so a
   name outside it is a refusal waiting for whoever regenerates next. ✅ **Check the name against
   `manifest.json`, not against whether it renders.**
5. 🔴 **A LAYOUT COMPLAINT CAN HAVE A CONTENT ANSWER, AND IT IS USUALLY THE BETTER ONE.** *"The
   `Read` button is a long way from its title"* reads as a layout bug and every rearrangement of the
   row was a recorded 390px regression. The row was not too wide; it was too empty. `For Each`
   delivers any DECLARED input from the field of the same name, so an excerpt cost one port and one
   function — no query, no page, no policy.
6. 🔴 **A PHOTOGRAPH'S CATALOGUE ENTRY DESCRIBES THE FULL TILE, AND A BAND IS A CROP OF IT.**
   `people-market` *"a market seller weighing limes"* is hands and limes at 300px tall. ✅ **Grade
   the picture in the BOX it will be in**, and note that a judgement made about a 560px hero does not
   transfer to a 300px band — session 7 rejected `people-meeting` for the hero and it is the right
   picture for `/join`.
7. ⚠️ **`artefactMd5` IN A RENDER MANIFEST IS THE MD5 OF `nodegx.project.json`, NOT OF THE GRAPH.**
   It did not move once this session across a redesign of two pages and four components. A manifest
   line reading *"the artefact"* is not a content hash of what was photographed. ✅ **To attribute a
   render, use the artefact hash you take yourself** (`find … | xargs md5 -q | md5 -q`).
8. ✅ **The 92-second door-only harness kept paying.** `rel002c-look.look.ts` is 4 pages × 4
   viewports with no backend, against ~4½ minutes for the both-states instrument. Three of this
   session's four visual corrections were found on it.

## What did not get done

**Row 6 is not CLOSED** — it closes on Richard's ruling, which needs him and not a session.

**Two things were considered and deliberately not built**, both recorded above with their reasons:
glyphs on the six nav pills (three pixels of overflow at the 988px preview), and a floor on the
eleven pages that still carry `PAGE_GROUND`'s inert `height: 100%` (a one-constant change that
touches every page, with no render budget left to grade it).

**One question is with Richard** — the `FORM_GROUND` departure — and it blocks neither the WORTHY
ruling nor rows 7 and 8.

⚠️ **The tree carries s1–s8's work.** 🔴 **`git commit <pathspecs>`, never `git add`** — a sibling's
commit sweeps staged files — and `git add` untracked paths first, because a pathspec commit **skips
them silently** (`git status --porcelain | grep '^??'`, and check whether a `??` is a **directory**).
