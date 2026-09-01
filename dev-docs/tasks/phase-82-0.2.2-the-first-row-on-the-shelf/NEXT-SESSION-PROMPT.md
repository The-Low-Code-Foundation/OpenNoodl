# Phase 82 — next session

_Opened 2026-08-31 (s1). Last updated **2026-09-01, session 7**, which BUILT the spine of row 6 —
the measure, the hero photograph and the three designed states — and left three of the six ruled
items open. The decisions are still [`RICHARD-RULINGS-2026-09-01.md`](RICHARD-RULINGS-2026-09-01.md)._

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
| 6 | **REL-002c** the members' area, redeemed | the redesign; **the phase's close condition** | 🟡 **PART-BUILT s7** — §C, §D-hero and §F done and rendered; **§D-icons, §E-data and the row family OPEN**. Then his WORTHY ruling |
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

**Row 6 continues: REL-002c.** Session 7 built the spine and rendered it in both states. **Three of
the six ruled items are still open, and one needs Richard before it is safe to build further.**

🔴 **Read [`TASKS.md`](TASKS.md) §"REL-002c — what session 7 built" FIRST.** It carries the readings,
the photographs and the reasoning. This is the ordered list of what is left.

### 🔴 0. ASK RICHARD ONE QUESTION BEFORE BUILDING — and it is not a blocker for the rest

**Six of the thirteen pages do not carry `maxWidth: 1200`.** `Pages/{SignIn, Join, Setup, Post,
Account, Unsubscribe}` carry a new `FORM_GROUND` — **720px, centred**.

⚠️ **This is a real departure from §C as written, and it was made deliberately after rendering the
literal reading and finding it worse than the baseline.** At 1200 `/setup` is six stacked
**1100px-wide text inputs**. His stated criterion is *"white space to the left and right **equally**
— not just on one side"*, and a 1200 shell holding a capped left-aligned form gives ~480px of white
on the right only, which is the *"weird"* he named. A 720 centred ground gives 280px either side.

**The question**: is a centred 720 form ground the right reading of §C, or does he want the literal
1200 — in which case the answer is **a two-up split** filling the shell (form on one side, what the
form is for on the other), which is more work and a better page?

✅ **Do not wait on it for anything else.** The three items below are independent of the answer.

### 1. §D — the `/join` photograph and the icons inside the gate

The landing hero is done. Still open: a photograph on `/join` (the other public page), and
**iconography inside the gated area** — *"no imagery and no iconography anywhere"* is one of the
fired tells on the baseline verdict, and the gated pages are still entirely typographic.

⚠️ **`STARTER_ASSETS` installs 1,998 lucide icons into every project**, so this costs zero template
bytes exactly as the photograph did. The `featureItem` composition is the kit's shape for a glyph
beside a title and a line.

🔴 **Probe the DOM, do not infer it from the component that writes it.** P81 s9 recorded that
`IconGlyph`'s font branch renders `span.lucide.icon-sprout` with **no `ndl-icon-glyph` class**, so a
selector taken from the module's own constant counts 0 on a page with 10 glyphs.

### 2. §E — the data half, which is the larger half

Built: the `EDIT —` naming convention, with the landing footer as its worked example (two
`EDIT ME —` lines, nodes named `EDIT — who to contact` and `EDIT — the small print`).

**Not built**: `/setup` collecting a **tagline** and a **landing blurb**, the pages reading them from
the record, and the **`Start here` note page**. ⚠️ `blurb` already exists on `Association` and
`claimAssociation` already takes it — **tagline is the only new field**, so this is a smaller change
than it reads. It touches [`tpl001Cloud.ts`](../../../packages/noodl-mcp/tests/tpl001Cloud.ts).

### 3. The row family — the seven shared `Members/` components

`Chrome` is done (its shell went to 1200, which is what closed V15). `AnnouncementRow`,
`MeetingRow`, `MemberRow`, `RequestRow`, `InsideTile` and `Standing` have **not** been looked at
since the measure changed. At 1200 the ruled rows put a `Read` button a long way from its title —
see `verdicts/vib-001/2026-09-01/members-area-living/members-desktop-full.png`. That is the page
Richard rules, so it is worth the pass.

### 4. Then the grading

**78 renders**, graded by the split Richard ruled (§A2a): he rules `/` in both states, `/setup`,
`/join`, `/members`, `/directory`; the Judge grades the other seven and 🔴 **any SHITTY escalates to
him**.

✅ **The instrument exists and both halves were run this session.**

- `vib001-members.look.ts` — both states, 44 shots, ~5 min. **This is the close protocol's instrument.**
- 🆕 `rel002c-look.look.ts` — **door only, 16 shots, ~92s.** Written this session as the fast loop
  while building. It is a working instrument, not a gate; it asserts only what would make the
  pictures lie.

### The four gates this row owes

| gate | last reading (s7, HEAD `5f197e28`) |
|---|---|
| `npm run template:members` | **0**, and **idempotent** — hash it before you edit and confirm a no-op, which is what makes your diff attributable |
| `tpl001Template.test.ts` | **0**, 72/72 |
| full `noodl-mcp` suite | **0** — **83/83 suites, 1085/1085 tests**, on the second run. ⚠️ The FIRST run read `1` on `projectOwnsBackend.test.ts`; it passes **12/12 alone**, imports nothing this row touches, and passed in the second full run. That is the flake s9 of P81 already measured as *"the failing set MOVES between runs"* — 🔴 **so a lone red here is a FLAKE until re-run**, and re-running is what turned a 2-failure reading into a clean one |
| `vib001-members.look.ts` | **0**, both states, seeded backend asserted before any picture |

### Then rows 7 and 8

**Row 7 (REL-001)** is unblocked the moment Richard rules WORTHY: publish as **`curated`**,
**`category: 'starter'`** (🔴 **not `data-app`** — this amends TPL-001 AC8 and moves the literal in
`template-search.test.ts` and `template-install-over-http.test.ts`), title **"Members' area"**,
summary *"members only site for a club, charity or church"*. **Richard publishes** — it is a
DB-credential act from the `nodegx-community` repo. ✅ **Do not wait for the cut**; they are two
moments, not one.

**Row 8 (REL-004)**: `0.2.2`, and the notes carry the line that **0.2.1 was an internal cut held
back as too buggy**. Notes split two ways — the
[NodeGX 0.2.2 artefact](https://claude.ai/code/artifact/70d4e79e-78ce-44c8-b9f5-e06c6b0b6d11)
becomes the **full log**, the GitHub release body carries **highlights + a link to it**.
🔴 **The artefact's stat band is stale — it reads 559 commits; `git log v0.2.0..HEAD` counts 567.**
Its ship-gate section also still lists TPL-001 as unpublished. Re-read both against reality at tag
time. ⚠️ Viewers are currently pinned to an earlier version, not the live one.

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

## What did not get done

**Row 6 is not closed**, and three of the six ruled items are open: §D's icons and the `/join`
photograph, §E's data half (`/setup` tagline + blurb, the `Start here` page), and a pass over the
row family now the measure has changed. **One question is with Richard** — the `FORM_GROUND`
departure, §0 of the next job — and it blocks none of the three.

⚠️ **The tree carries s1–s7's uncommitted work.** 🔴 **`git commit <pathspecs>`, never `git add`** —
a sibling's commit sweeps staged files — and `git add` untracked paths first, because a pathspec
commit **skips them silently** (`git status --porcelain | grep '^??'`, and check whether a `??` is a
**directory**).
