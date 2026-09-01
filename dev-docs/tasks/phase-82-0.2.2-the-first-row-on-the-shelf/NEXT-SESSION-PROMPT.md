# Phase 82 — next session

_Opened 2026-08-31 (s1). Last updated **2026-09-01, session 5**, which closed run-sheet row 5 (REL-002b)._

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

✅ **He decided it, 2026-09-01 — fifteen questions, twelve settled.** Read
[`RICHARD-RULINGS-2026-09-01.md`](RICHARD-RULINGS-2026-09-01.md) **before touching rows 6, 7 or 8**.
Two rulings **amend ACs on the board**: REL-002c is now **all thirteen pages**, and REL-001 publishes
as **`starter`**, not `data-app`. Three items are **still open and must not be guessed** — §A2 (how
78 renders get graded), §E (the mechanism that makes editable copy unmissable), §G4 (curated).

**So the sequence is: build row 6 from the rulings → Richard rules WORTHY on the renders → row 7 →
row 8.**

## 🔴 The next job

**Row 6: REL-002c — the members' area, redeemed.** The redesign, on top of a and b, using the kit
phase 81 widened (compositions, the stock library, the `ui-landing-page` example Richard called
*"fucking pro"* — that page is the reference).

- **V15** — at 1900 the nav wraps to two rows and the page uses ~37% of the width, the rest dead.
- **V29 is RULED** (Richard, 2026-08-31): *"the structural page divs have a max width and are
  centred… white space to the left and right **equally** — not just on one side, that's weird."*
  🔴 **The mechanism is known: the defect is a `maxWidth` on the TEXT.** A measure belongs to the
  **shell**, which a band centres. `ctaBand` is the worked example — shell carries `maxWidth: 720`
  + `alignItems: center`, the type carries `textAlignX: center` and **no maxWidth at all**.

**AC — the phase's close condition**: the **landing page and one members page** read **WORTHY** in
**both states** at **all three widths**, ruled by Richard.

⚠️ **The landing page now has a third state to design, not two.** REL-002b added `waitingCard` (the
not-connected state). If REL-002c restyles that page, the card is part of what it restyles — and it
is the one node in the template that is **mounted by default**.

⚠️ **Build it in the GENERATOR, never in `templates/members-area/` directly.** The artefact is
regenerated from [`tpl001Components.ts`](../../../packages/noodl-mcp/tests/tpl001Components.ts) by
`npm run template:members`, and `tpl001Template.test.ts`'s byte gate reddens if they disagree.
✅ **Run the regeneration BEFORE you edit and confirm it is a no-op** — that is what makes the diff
afterwards attributable to you.

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

## What did not get done

Rows 6–8 of the run sheet. All three need Richard.

⚠️ **`sb007Template.test.ts` is still uncommitted** and its author still unidentified — unchanged
since 22:07 on 08-31, five sessions later. If it is still dirty next session, find the owner before
anything sweeps it.

⚠️ **Nothing has been committed this session.** The working tree carries s1–s5's doc edits plus the
source changes from s4 and s5. `git commit <pathspecs>`, never `git add` — a sibling's commit sweeps
staged files.
