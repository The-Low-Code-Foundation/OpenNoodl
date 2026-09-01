# Phase 82 — next session

_Opened 2026-08-31 (s1). Last updated **2026-09-01, session 6**, which closed no row and ruled all
fifteen open decisions on rows 6, 7 and 8 — see [`RICHARD-RULINGS-2026-09-01.md`](RICHARD-RULINGS-2026-09-01.md)._

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
| 6 | **REL-002c** the members' area, redeemed | the redesign; **the phase's close condition** | ✅ **DIRECTION RULED s6** — build it, then his WORTHY ruling |
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

**Row 6: REL-002c — the members' area, redeemed.** The redesign, on top of a and b, using the kit
phase 81 widened (compositions, the stock library, the `ui-landing-page` example Richard called
*"fucking pro"* — that page is the reference).

🔴 **The direction is RULED. Build from
[`RICHARD-RULINGS-2026-09-01.md`](RICHARD-RULINGS-2026-09-01.md), not from your own taste.** It
answers scope, the measure, imagery, copy, the third state and how the result gets graded. Do not
re-open any of it.

### What was ruled, in one place

| | ruling |
|---|---|
| **scope** | 🔴 **ALL THIRTEEN pages** in `components/Pages/`, not the two the old AC named — *"shipping the first template that's only 1/3 usable would be pretty sad"* |
| **the measure** | `maxWidth: 1200` + `--space-6` gutters + `alignItems: center` on every structural shell. 🔴 **On the SHELL, never on the text** |
| **imagery** | Photographs on `/` and `/join`; **icons only** inside the gated area. **Zero template bytes** — `STARTER_ASSETS` already installs 44 CC0 photographs and 1,998 icons into every project |
| **copy** | 🔴 **Make it DATA.** `/setup` collects name + tagline + landing blurb; pages read them from the record. What cannot be data is written *obviously* unfinished and its node named `EDIT — …`. Plus a `Start here` note page. **No invented copy** |
| **the third state** | `waitingCard` gets a designed first-class treatment — it is the only node **mounted by default**, so it is the first frame of a fresh install |
| **grading** | Richard rules **six** — `/` in both states, `/setup`, `/join`, `/members`, `/directory`. The **Judge grades the other seven**, and 🔴 **any SHITTY verdict escalates to him** |

**AC — the phase's close condition**: all thirteen pages read **WORTHY** in **both states** at **all
three widths**, graded by the split above.

⚠️ **The build is not 13× the work.** Most of the look lives in the seven shared `Members/`
components — `Chrome`, `AnnouncementRow`, `InsideTile`, `MeetingRow`, `MemberRow`, `RequestRow`,
`Standing`. Fix the chrome and the row family and most of the thirteen move at once. **Start there**,
not page by page.

⚠️ **`.look.ts` files are NOT run by jest** (`testMatch` = `**/tests/**/*.test.ts`).
`vib001-members.look.ts` and `tpl001-rows.look.ts` read this template and are exactly the files that
should grade a look change. **This row is the one that changes the look** — run them deliberately.

⚠️ **Build it in the GENERATOR, never in `templates/members-area/` directly.** The artefact is
regenerated from [`tpl001Components.ts`](../../../packages/noodl-mcp/tests/tpl001Components.ts) by
`npm run template:members`, and `tpl001Template.test.ts`'s byte gate reddens if they disagree.
✅ **Run the regeneration BEFORE you edit and confirm it is a no-op** — that is what makes the diff
afterwards attributable to you.

🔴 **A TOKEN / COMPOSITION / TOOL-DESCRIPTION edit owes the `noodl-mcp` suite.** This redesign
touches all three.

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

## What did not get done

Rows 6, 7 and 8 — but they are no longer blocked on a decision. **Row 6 is now buildable**, and its
direction is fully ruled.

⚠️ **81 files remain uncommitted**: s1–s5's source changes from the scroll fix (s4) and the
fail-closed work (s5), plus other phases' docs. Richard has authorised committing them. 🔴 **`git
commit <pathspecs>`, never `git add`** — a sibling's commit sweeps staged files — and `git add`
untracked paths first, because a pathspec commit **skips them silently**.
