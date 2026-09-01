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
| 6 | **REL-002c** the members' area, redeemed | the redesign; **the phase's close condition** | 🟡 **BUILT, ruled FINE not WORTHY by Richard 09-01 (s9).** Six changes costed in [`REL-002c-WHAT-I-WOULD-CHANGE.md`](REL-002c-WHAT-I-WOULD-CHANGE.md) — **that is the next build** |
| 7 | **REL-001** publish + drive the install | shelf's first row; also closes P75's FB-005 | 🟢 **PREPARED s9** — exact command, all four fields, AC8's excluded-files check performed: [`REL-001-SUBMISSION.md`](REL-001-SUBMISSION.md). **Richard runs it** |
| 8 | **REL-004** cut, tag and publish `v0.2.2` | last | 🟡 **PREPARED s9** — [notes](../release-0.2.2/RELEASE-NOTES-0.2.2.md) + [runbook](../release-0.2.2/PUBLISH-0.2.2.md). 🔴 **BLOCKED: `cline-dev` is 569 commits unpushed** |

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

**Richard ruled row 6 FINE on 2026-09-01 (s9) and asked what I would change.** The answer is
[`REL-002c-WHAT-I-WOULD-CHANGE.md`](REL-002c-WHAT-I-WOULD-CHANGE.md) — six items, each costed.
🔴 **Building items 1–4 of that list IS the next job**, unless Richard's own verdict names
different things, in which case his list wins.

Rows 7 and 8 are both **prepared and both belong to Richard**. Neither needs another session first.

### 1. Build the row 6 changes — items 1–4, then re-render

Items 1 (the door landing's void), 2 (`/members`' four duplicate buttons), 3 (`/join`'s doubled
sign-in) and 4 (the eleven pages with no floor) are all small and 1 and 4 **share a render**, so do
them together. Item 5 (the directory table) is medium; item 6 (a photograph on `/setup`) is taste
and Richard should be asked before it is built.

🔴 **Re-run the gate AFTER the last edit, not the one before it** — s7's stale 72/72 reading.
The four gates the row owes are in the table below.

### 2. Row 7 — REL-001, the publish. **Richard runs it.**

Everything is derived and written down in [`REL-001-SUBMISSION.md`](REL-001-SUBMISSION.md): the
exact command, the four ruled fields, and AC8's excluded-files check actually performed against the
artefact rather than asserted.

🔴 **Two findings there change what the previous handoff said.** First, **no code literal has to
move** — the claim that this touches `template-search.test.ts` and `template-install-over-http.test.ts`
is wrong; those `data-app` literals are unrelated fixtures. Second, and more important:
**`readBundleDirectory` has no skip list of any kind**, so **`templates/members-area` must NOT be
opened in the editor before publishing** — opening writes `.mcp.json` (carrying absolute paths from
the publishing machine), `CLAUDE.md` and a `.gitignore` block, and all three would ship. It is clean
right now.

✅ TPL-001's prose was amended this session: its header, AC8 and §7 said `data-app` and now say
`starter`, with the superseded argument kept rather than deleted.

### 3. Row 8 — REL-004, the cut. **Blocked on a push only Richard can make.**

[`PUBLISH-0.2.2.md`](../release-0.2.2/PUBLISH-0.2.2.md) and
[`RELEASE-NOTES-0.2.2.md`](../release-0.2.2/RELEASE-NOTES-0.2.2.md).

🔴 **`git rev-list --left-right --count origin/cline-dev...cline-dev` reads `0 569`.** `origin/cline-dev`
is at **2026-08-21**; the fetch ref is current, so this is real and not a stale remote. Eleven days
of work have never been pushed and **CI has run on none of it**. The release workflow is triggered
by a tag push, so nothing about row 8 can start until the branch goes up. That is Richard's call.

⚠️ **`packages/noodl-editor/package.json` still reads `0.2.0`** and must become `0.2.2` before
tagging — `artifactName` interpolates `${version}` into every asset filename.

### The four gates row 6 owes

| gate | reading (s8, HEAD `1f4d5547`) |
|---|---|
| `npm run template:members` | **exit 0**, **idempotent** — hash before editing and confirm a no-op, which is what makes your diff attributable. `27f127e9…`, 91 files |
| `tpl001Template.test.ts` | **exit 0**, 72/72 |
| full `noodl-mcp` suite | **exit 0** — 83/83 suites, 1085/1085 tests. ⚠️ **a lone red here is a FLAKE until re-run** |
| `vib001-members.look.ts` | **exit 0**, both states, 44 shots, seeded backend asserted before any picture |

✅ Also owed if the row family changes again: `tpl001-members-drive` + `tpl001-empty-states` +
`rel002b-fail-closed`, 110/110 on real enforcing backends.

✅ **`ci:build:editor` is green at `60fe7e16`** — run this session, exit 0, both webpack passes
compiled successfully. It is the only gate that loads the production path.

### What is still WRONG, and is nobody's AC

⚠️ **Four of the thirteen pages have never been photographed** — `Announcement`, `Meeting`, `Post`,
`Unsubscribe`. The harness asks for nine, so this is a fact about the request and **not** about how
those pages look. If REL-002c means all thirteen, they need adding to `vib001-members.look.ts`
before the row can honestly close. Registered, owner `NONE`.

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

## What session 9 did — the ruling, and rows 7 and 8 prepared

**No row closed. Row 6 was ruled FINE, which is the answer that keeps it open.** Richard was put
both open questions together with an artefact to rule on — a
[proof sheet](https://claude.ai/code/artifact/137133e4-aa38-4f02-9251-bbc94124bef7) of all 44 shots,
his six page-states marked and the Judge's five behind them — and answered all three asks.

**What he ruled.**

1. **Row 6 — FINE, not WORTHY**, with *"tell me what you'd change"*. The answer is
   [`REL-002c-WHAT-I-WOULD-CHANGE.md`](REL-002c-WHAT-I-WOULD-CHANGE.md): six items, each costed,
   derived from looking at the renders rather than from the task file.
2. **`FORM_GROUND` — keep 720 centred.** ✅ **CLOSED**, open since s7. Nothing to build.
3. **Rows 7 and 8 — prepare them, he executes.**

**Then both rows were prepared**, and preparing them turned up two things that were not on the
board and one relayed claim that was wrong.

## 🔴 What to carry out of session 9

1. 🔴🔴 **`cline-dev` IS 569 COMMITS UNPUSHED, AND NOTHING ON THE BOARD SAID SO.**
   `git rev-list --left-right --count origin/cline-dev...cline-dev` reads `0 569`;
   `origin/cline-dev` is at **2026-08-21**. The fetch ref was current, so it is not a stale remote.
   **CI has run on eleven days of work exactly zero times**, and the release workflow triggers on a
   tag push. Row 8 was described as needing "green floor, fresh readout"; what it actually needs
   first is a push. ✅ **A release row owes a `rev-list` against its own remote before it owes
   anything else** — the 0.2.0 runbook's first check is `0 0` and nobody had re-run it.
2. 🔴 **A HANDOFF NAMED TWO TEST FILES THAT DO NOT CONTAIN THE LITERAL.** The board said the
   `starter` ruling "moves the literal in `template-search.test.ts` and
   `template-install-over-http.test.ts`". Both files' `data-app` values belong to unrelated
   fixtures — `Starter CRM`, `Storefront`, `Membership Hub`, a `uni-007` intake answer. The members'
   area has **no category literal anywhere in this repo**; the category is an argument typed at
   publish time. ✅ **Editing them would have changed what those tests measure and published
   nothing.** Grep for the SUBJECT, not for the literal.
3. 🔴 **`readBundleDirectory` HAS NO SKIP LIST OF ANY KIND** — read in full, 72 lines. It walks
   every file and every directory unconditionally, sorting only UTF-8-clean from binary. That is
   why `docs/START-HERE.md` travels. It is also why **opening `templates/members-area` in the editor
   before publishing would ship `.mcp.json` with absolute paths from the publishing machine**, plus
   `CLAUDE.md` and a `.gitignore` block. ✅ **Verified absent right now**; publish before anyone
   opens it. ⚠️ It would break AC7 too — byte-identical to a fresh generate, and three new files
   are not.
4. 🔴 **AC8's "read and checked" WAS PERFORMED, and the answer is "the list is empty TODAY".** No
   `.env`, no key, no credential; every `secret`-shaped hit is a `noodl.cloud.secret` **node type**
   that reads a backend secret at run time, a constant-time compare, or prose. ✅ **That is a fact
   about this artefact on this day, not a property of the bundler** — see item 3 for what the list
   exists to catch.
5. 🔴 **A BACKGROUND TASK'S "completed (exit code 0)" IS THE WRAPPER, NOT THE COMMAND.** The
   notification for `ci:build:editor` arrived within seconds saying exit 0 while the build was still
   at the webpack alias stage with a 2.3KB log and no exit file. ✅ **Gate on the exit file you
   wrote yourself**, and check the log's mtime and size — the real result came ten minutes later.
   (It was genuinely **exit 0**, both webpack passes *compiled successfully*; the one `FAIL`-shaped
   grep hit is a filename, `FailedStep.module.scss`.)
6. 🔴 **A FIX THAT MOVES A HOLE IS NOT A FIX — THIRD TIME IN THIS ROW.** S7 added a footer so the
   door landing would have a bottom edge; s8 found bare ground *below* the footer and fixed it with
   `space-between`; s9 found the same void, now *above* the footer, 230px at 1280 and 330px at 1900.
   ✅ **The page does not fill because it has nothing to fill it with** — the answer is content (the
   already-built tiles band, which needs no backend), not another layout parameter. A layout
   complaint with a content answer, exactly as s8 recorded.
7. ⚠️ **A RENDER MANIFEST'S `headSha` IS THE LAST COMMIT AT RENDER TIME, NOT WHAT WAS RENDERED.**
   The 09-01 manifests read `1f4d5547` because the renders ran at 17:02–17:06 and s8's work was
   committed at 17:10. ✅ **Attribution came from the artefact's own content hash** — clean vs HEAD,
   nothing newer than the shots, `27f127e9`, 91 files. Same class as s8's `artefactMd5` note.
8. ✅ **A CONTACT SHEET IS THE RIGHT SHAPE FOR A LOOK RULING.** 44 shots as file paths is a request
   to open two dozen files; as one scrollable sheet with the six that are his marked, it is a
   decision. It also carried the two open questions and the four-unphotographed-pages caveat, so
   everything he needed to rule was in one place.

## What did not get done

**Row 6 is not CLOSED** — Richard ruled it **FINE**, so it stays open and now has a costed list of
what would make it worthy. **Nothing from that list was built**, because he asked for the list
rather than a guess at a fix; building items 1–4 is the next session's first job.

**Rows 7 and 8 were prepared, not executed** — both are Richard's by nature. Row 7 is a
database-credential act; row 8 is blocked on a 569-commit push only he can make.

**Item 6 of the change list was deliberately not proposed as work** — a photograph on `/setup` is
taste rather than defect, and it is his call.

**The four unphotographed pages were not added to the harness.** `Announcement`, `Meeting`, `Post`
and `Unsubscribe` are named in the register above with owner `NONE`; adding them is a change to
`vib001-members.look.ts`'s two shot lists and a longer render.

✅ **s9's work is COMMITTED** — see the commit below.

⚠️ **The three tracked files modified from s4/s5 were AGAIN not swept**, for the same reason: their
mtimes are still 08-31, their content was not read this session, and a pathspec commit would take an
edit nobody attributed — `packages/noodl-mcp/tests/renderReportModule.test.ts`,
`packages/noodl-mcp/tests/stagingDiagnostics.test.ts`, `packages/noodl-mcp/tests/sb007Template.test.ts`
(the last is P80's known orphan, Richard confirmed it is not his). **Read them before committing.**

✅ **`TPL-001-THE-MEMBERS-AREA.md`'s s1 edit WAS swept**, deliberately and after reading it: it is
phase 82 session 1's own work (dated 08-31 in its own text, +12 lines recording that REL-001 gives
AC1 a grader), it had been uncommitted since, and this session edited the same file for the category
amendment.

🔴 **`git commit <pathspecs>`, never `git add`** — a sibling's commit sweeps staged files — and
`git add` untracked paths first, because a pathspec commit **skips them silently**
(`git status --porcelain | grep '^??'`, and check whether a `??` is a **directory**).
