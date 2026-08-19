# UNI-006 — assign, grade, review

> ## ✅ BUILT — the platform half, 2026-08-16 (nineteenth session)
>
> `nodegx-community`: **442 specs / 18 files** (baseline 363 / 16), `tsc --noEmit` clean,
> `next build` **16 routes** (was 14), **16/16 drive consequences** met over HTTP against a
> seeded database. All four acceptance criteria are met platform-side; the editor half of AC1's
> round trip is UNI-007's and UNI-011's, and what that means is stated under AC1 below.
>
> | Shipped | Where |
> |---|---|
> | The schema — 5 tables, 5 enums, 7 triggers, the audience rule and the evidence allow-list | [`src/db/sql/0006_uni006_assignments.sql`](../../../../nodegx-community/src/db/sql/0006_uni006_assignments.sql) |
> | The module — 16 endpoints: assign, pull, submit, grade, override, notify, escalate | `src/lib/assignments.ts` |
> | Two routes — the org's assignment list, and one assignment (results table / your work) | `src/app/orgs/[slug]/assignments/` |
> | AC1–AC3 + D6 + D13, 27 specs | `tests/uni006-assignments.test.ts` |
> | AC4, 25 specs, with a control run | `tests/uni006-evidence-bundle.test.ts` |
> | UNI-005's AC3 sweep, widened to cover this module — see finding 1 | `tests/uni005-inspection-boundary.test.ts` |
> | UNI-005's AC4 census, plus a sixth classification — see finding 3 | `tests/uni005-data-inventory.test.ts` |
>
> ### 🔴 Four findings, in the order they cost something
>
> **1. UNI-005's AC3 sweep advertised a surface and enumerated a hand-list of two modules.**
> Its criterion is *"an admin cannot read a member's non-org data through **any** org
> endpoint"*, and its own header said *"every function the **two** org modules export"*. The
> call list was genuinely derived — from `Object.entries(orgsModule)` and `shelfModule` — so it
> looked like the strongest kind of check. But **the list it derived from was itself a list
> somebody wrote**, and `assignments.ts` — the module that stores graded results about minors —
> was covered by nothing at all while the suite stayed green. Now `ORG_MODULES` is checked
> against every file in `src/lib/` that consults org membership, so a fourth module fails the
> suite the day it is written. All 16 UNI-006 endpoints now go through the sweep: no leaks.
>
> ⚠️ The general shape is worth more than the fix: **everything downstream of a derivation
> passes whether the thing you derived from is complete or not**, which is exactly why nothing
> pointed at it.
>
> **2. `org_is_admin()` returned NULL for a non-member, so `if not org_is_admin(...)` never
> fired.** `not NULL` is NULL, and `if NULL then` does not run — so every gate in `0006`, all
> written the obvious way, let through **precisely the person they existed to stop**: the
> outsider. A member holding the wrong role was refused correctly, which is why the first draft
> of the test suite passed. It was found by adding a third candidate — a total stranger — to a
> test that already had two.
>
> 🔴 **A guard tested only against the near-miss case is not proven against the far one, and
> the far one is usually why the guard is there.** Fixed at the predicate (`coalesce(… , false)`)
> rather than at the four call sites, and the predicate itself is now asserted directly.
> ⚠️ Harmless in a `where` clause, where NULL and false both drop the row — which is why it
> survived UNI-005 undetected. `org_is_member` never had it; it is `… is not null`.
>
> **3. `lessongrading.ts` restates D10 more widely than D10 says, and the wider reading would
> have made this task unbuildable.** Its comment reads *"D10 rules that org-minor accounts'
> project content never leaves the machine."* D10's obligation 3
> ([PRIOR-ART §F4](PRIOR-ART-RECONCILIATION.md)) is a **network-level claim about minors' work
> reaching third-party MODEL APIs** — it is about AI projection, not about graded results, which
> are the thing D10 exists to permit. Taken literally the comment forbids the evidence bundle,
> and with it the whole school offer.
>
> What actually forbids a raw project from a pupil is the **free-text argument** UNI-003 made
> about a bio and UNI-005 made about a shelf payload — and that argument permits a bundle of
> booleans and integers. Getting the reason right is what made AC4 provable rather than
> aspirational. ⚠️ **A relayed conclusion that GAINS scope is as wrong as one that loses it, and
> it is harder to notice because it reads as caution.**
>
> **4. AC4's own headline assertion passed with the mechanism entirely disabled.** The control
> run replaced `submission_evidence_violation()` with `return null` — the whole allow-list off —
> and 15 of 71 specs failed. **The census was not among them.** It walks every string stored in
> every bundle and asserts only provenances come back; but its only writer was `submitWork`,
> which narrows the bundle in TypeScript before the database sees it. It was measuring
> `pickEvidence` and reporting the result as a property of the schema.
>
> 🔴 **A spec whose only writer already enforces the rule cannot detect the rule's removal** —
> and it will look like the most thorough spec in the file. The census now also writes through
> the raw path with the error swallowed; the control then fails **16 of 71**.
>
> ### The shape of the answer
>
> **The evidence bundle carries no string at all except `provenance`, which is a closed set of
> four.** Everything else is a boolean or a non-negative integer, and the database refuses
> anything else — keys allow-listed, every leaf's type pinned, nested objects too. That is what
> lets `submissions.evidence` — **the first column in this whole schema an org-minor account can
> write to** — be classified in AC4's census without a `minor-free-text` class, which UNI-005's
> suite says would falsify its criterion outright.
>
> 🔴 **The platform's allow-list is deliberately NARROWER than the editor's bundle.**
> `LessonEvidence` also carries `lessonTitle` and `gradedAt`; neither is stored. `lessonTitle`
> is the bundle's one free-text field and it is read off the submitting machine — a pupil who
> opens `lesson.json` and types their name into the title has found a route into our database.
> `gradedAt` is a clock on a learner's laptop, and the platform stamps its own.
> ⚠️ **The third copy of the list is in the other repo and no test in either can see both.**
> Named rather than papered over.
>
> **D13 is discharged by one enum, not by a second path.** `assignments.grading` is `runner` or
> `human`. A runner-graded submission produces its machine grade inside the submit transaction;
> a human-graded one produces nothing and waits in `submitted` for a person. Phase 68 sets one
> value — there is no second table, no second state column and no `if (isCoaching)`.
>
> **AC2's "notifies the member" cannot be an email**, and that is a fact about the population
> this task exists for rather than a shortcut: an org-minor account has no address, by a
> constraint 0001 already enforces, so an email-based notification would work for every user
> except the ones D10 was ruled for. The notice is a row the member reads.
>
> **D6 is proven behaviourally, not by a grep.** An invited member, an email-domain member and a
> GitHub-synced member are put through the identical round trip and the three transcripts are
> asserted equal. (There is a grep as well; the two catch different things — the grep catches a
> branch that has not been given behaviour yet.)
>
> ## ✅ THE BRIDGE IS BUILT — 2026-08-19 (session 42). AC1 is a round trip over HTTP.
>
> `nodegx-community@08d8e1c` + `OpenNoodl@7a21e5e0`, `79117c45`. The two paragraphs below
> headed *"Two things this does not do"* were true for three days and are now **struck** — they
> are kept because what they said is exactly what was built.
>
> | Shipped | Where |
> |---|---|
> | Six routes under `/api/v1/me` — one assignment, its lesson, start, submit, gradings, seen | `src/app/api/v1/me/…` |
> | The refusal translator, one producer, total over what `submission_gate()` raises | `src/lib/assignments-http.ts` |
> | 20 specs, every one through a **route handler with a bearer token** | `tests/uni006-bridge.test.ts` |
> | The editor's client methods, and 429 stops reading as an outage | `models/community/communityapi.ts` |
> | **The caller** — "check my work" hands the work in | `models/lessoncheck.ts` + `views/lessonlayer2.ts` |
> | The assignment link on a Learning-folder entry, and `recordSubmission` | `models/learningfolder.ts` |
> | 26 editor specs | `tests-unit/uni-006/` |
>
> ### 🔴 Four things worth not re-deriving
>
> **1. THE GRADE IS RECORDED BEFORE THE NETWORK IS TOUCHED, and it is asserted structurally
> rather than promised.** A learner who presses "check my work" on a train has been graded —
> that is a local fact about a local project, computed by two local engines — and losing it
> because a POST failed would make the offline case worse than having no bridge at all. A spec
> in `session-readers.test.ts` compares the two source offsets: swap them and an offline
> learner silently loses a grade they earned.
>
> **2. A CLOSED ASSIGNMENT IS 403, NOT THE TIDIER 409.** `CommunityApiClient.post()` maps
> 400/403 to `refused` — the branch that shows the learner the platform's own words — and
> *everything else* to `unreachable`, which renders as "could not reach the community". A 409
> would tell a pupil whose homework is late that their network was down. ⚠️ **The status codes a
> server may choose are constrained by what its client already renders**, and nothing in either
> repo says so except the route that had to obey it.
>
> **3. `submittedAt` IS WRITTEN ONLY ON ACCEPTANCE.** It is the field somebody would later read
> to decide whether a pupil was late, so an unsent submission must be indistinguishable from one
> that was never attempted. The specs assert the *absence* of the write on every failing outcome,
> not just the presence of it on the good one.
>
> **4. 🔴 THE THIRD COPY OF THE EVIDENCE LIST IS NOW MANAGED, AND THE LIMIT IS STATED.** `0006`
> named the gap and said no test in either repo can see both sides. That was harmless while
> nothing submitted; it stopped being harmless the hour the caller existed, because the platform
> **drops** an unknown key by design — so a field added to `LessonEvidence` would submit
> successfully, grade successfully, and be nowhere. `submittedEvidence()` narrows to a named list
> **beside the producer**, and the spec builds a `Required<LessonEvidence>` so **adding a field
> fails to compile** until somebody classifies it. ✅ Verified by control: an unclassified field
> takes the file to *0 tests run*. ⚠️ It still cannot read the platform's schema — what it catches
> is the direction the gap actually leaks.
>
> ### 🔴 WHAT THE ROUND TRIP CANNOT DO, AND IT IS NOT A BUILD PROBLEM
>
> **The platform hosts no curated lesson bundles at all.** `curriculum.ts`'s own header:
> *"There is no download, no install and no bundle"* — and all **fifteen** lessons in
> `curriculum.json` are `state: 'in-writing'`. So `lessonSource: 'curated'`, which is the
> ordinary assignment, has nothing to pull. UNI-007 §11 has owed *curriculum hosting* since
> 2026-07-25 and this is the task that runs into it.
>
> ✅ **`org_shelf` DOES work end to end** — a school's own lesson travels as the shelf item's
> `payload`, which `shelf.ts` already calls *"what the editor pulls"*, gated by
> `shelf_item_visible_to`. That is the school case UNI-006 exists for, and it is driven.
>
> 🔴 **So `/lesson` answers `200 {available: false, reason}` and NOT 404.** A 404 would be
> indistinguishable from *"this assignment is not yours"* — one is a refusal and the other is our
> own unfinished work, and no client can say the right sentence about either unless the API tells
> them apart. ⚠️ **This is the generalisable half: "we have not built it yet" is a state, and an
> API that encodes it as absence hands every client a lie to render.**
>
> ### ⚠️ AN OPEN RULING THIS TOUCHES, NOT ROUTED AROUND
>
> These writes take **the same session scope as the browser**, which is a *default* rather than a
> ruling. Phase 72's **D5** — *what authorises a write from the editor?* — is open, and its stated
> blast radius is NAT-007's reply path and the Tier-3 **community** writes, not this school
> surface, which UNI-006 scoped as pull-and-submit long before D5 was raised. But the mechanism
> question applies here too: **if D5 rules for a narrower post-only scope or a first-write consent
> step, `start`, `submit` and `seen` are the routes to re-scope.** Listed in `docs/API.md` §5b so
> nobody has to go looking.
>
> ### ⚠️ Two things this does not do, said out loud — ~~STRUCK 2026-08-19, both are now built~~
>
> - ~~**No bridge endpoint.** The "pull" is `assignmentsForMember()`, a reader.~~ ✅ **Six routes,
>   2026-08-19.** The reader is still the reader; it now has a URL.
> - ~~**Every write is reachable only from a test.**~~ ✅ **Reachable from an editor**, and driven
>   from one end to the other — though see the curated-bundle limit above, which is the half that
>   is not this task's to fix.
>
> ### 🔴 A drive trap this repo will hit again
>
> **A `curl | grep` for a literal string that spans two adjacent JSX expressions never matches** —
> server-rendered React puts `<!-- -->` between them. Two consequences read as FAILED until the
> HTML was looked at; both were fine. It fails in the dangerous direction: a false negative that
> invites you to "fix" working code. Strip `<!-- -->` before grepping.
>

**Surface:** platform + bridge · **Tier 2 (R6)** · **Effort:** M/L · **Blocked on:** ~~D10~~ ✅ **ruled
2026-08-14** (org-owned pseudonymous accounts), ~~D12~~ 🔴 **struck — already ruled 2026-08-09**;
consumes UNI-007's lesson format and grading runner

> **Three corrections from [PRIOR-ART-RECONCILIATION.md](PRIOR-ART-RECONCILIATION.md) (2026-08-14):**
> - **D12 does not exist.** LEARN-002's D1–D9 were answered 2026-08-09
>   ([CURRICULUM-DESIGN §10](../phase-17-noodl-learn/CURRICULUM-DESIGN.md)). What actually gates the
>   curriculum is §11's three authoring blockers, two of which wait on phases 60 and 61.
> - **No live co-editing.** R6's "old scoping" resolves to [phase 51](../phase-51-collaboration/README.md)
>   (async git-merge); [ECO-001](../phase-20-ecosystem/ECO-001-COLLABORATIVE-EDITING.md) is parked.
>   🔴 ECO-001's headline education pitch — *"a teacher watching twenty-five student graphs update
>   live"* — is **not available to this task** and must not appear in its scope. The results view is
>   a submission dashboard, not a live window.
> - **D10's obligations** (pseudonymity must be real; LEARN-005 gets amended; tier-1 AI projection
>   off by default for org-minor accounts) are listed in
>   [UNI-005](UNI-005-AN-ORG-IS-A-ROSTER-AND-A-SHELF.md) and apply here too — this is the task that
>   actually stores graded results about minors.

## Premise

The teaching layer on top of orgs (R6): an org admin (teacher, team lead) **pushes lessons and
assignments** to members, **views graded results**, and can **grade manually instead of the AI**
— the human override is a first-class path, not an escape hatch. This is the surface schools
actually buy consulting around, and the twin of the "corporate onboarding" offer.

> **D13 (2026-08-14):** phase 68's coaching assignments (a coach must validate a coachee's reply
> before anything marks complete) **reuse this task's state machine with a human grader** —
> assignment → submission → validation → feedback is the same machine. Design the model so the
> grader can be a runner *or* a person from day one; phase 68 must not fork it.

## Scope (v1)

- **Assignment model**: an org admin assigns a lesson (from the curated catalogue or the org's
  own, in UNI-007's lesson format) to members or the whole roster, with an optional due date.
- **Delivery over the bridge, pull-only**: the member's signed-in editor sees the assignment and
  pulls the lesson project into the Learning folder (UNI-007's mechanics — nothing new here, an
  assignment is a lesson with an audience and a deadline).
- **Results view**: per-member, per-assignment: state (not started / in progress / submitted),
  the machine-grading report (from the editor-side runner: validate + render evidence), score,
  feedback.
- **Manual grading**: the admin opens a submission's evidence (graph summary, render report,
  the runner's findings), sets/overrides the score, writes feedback. AI-graded results are
  labelled as such and always overridable. The audit trail keeps both gradings.
- **The submission artifact**: what "submit" uploads is the runner's evidence bundle, not the
  raw project by default — D10-friendly (minimal data), bandwidth-friendly, and enough for a
  human to grade. A "request full project" escalation exists for when evidence isn't enough,
  visible to the student.

## Acceptance criteria

1. Assign → member's editor pulls it (outbound) → member completes → submit → machine grade
   lands in the admin's results view — one full round trip on a test org.
   ✅ **MET OVER HTTP, 2026-08-19** — assign → list → read → pull the bundle → start → submit →
   machine grade in the response → the admin's results view, every step through a route handler
   with a bearer token (`tests/uni006-bridge.test.ts`), plus the editor-side caller and its 26
   specs. ⚠️ **The pull works for `org_shelf` and has nothing to serve for `curated`**, because
   the platform hosts no curriculum bundles — stated above, and owed by UNI-007 §11 rather than
   by this task.
   ⚠️ **The original platform-side reading, kept because it is what was true until then:** the round trip runs
   end to end in `tests/uni006-assignments.test.ts` and over HTTP in the drive, with the
   editor's *real* `LessonEvidence` shape as the input. What is NOT exercised is the editor
   pulling over a bridge — there is no bridge and no session issuer. **"The member's editor
   pulls it" is UNI-007's mechanics and UNI-011's transport**; the reader they will both call
   is `assignmentsForMember()` and it is built, specced and driven.
2. Manual override changes the score, preserves the machine grade in the trail, and notifies
   the member with the feedback text. ✅ **MET.** The trail is append-only by trigger, and
   ⚠️ the notice is a row rather than an email — see the note above on why it could not be one.
3. A member outside the org (or removed mid-assignment) cannot pull the assignment or submit.
   ✅ **MET**, through one predicate (`assignment_audience_includes`) that evaluates membership
   live — so the removed member's target row is never visited and nothing has to run.
4. The evidence bundle contains no more than the documented field list (spec-pinned, the
   export-allow-list discipline applied to submissions). ✅ **MET**, and the list is enforced in
   the database rather than documented beside it. Verified by a control run — see finding 4.

## Not in v1

Live proctoring/observation of a student editor (explicitly never — the bridge is pull-only),
plagiarism detection, gradebook export/LMS integration (SCORM/LTI — a school will ask; noted,
deferred), peer review.
