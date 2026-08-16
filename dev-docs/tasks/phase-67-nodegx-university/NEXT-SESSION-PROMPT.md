# Phase 67 — next session prompt

Paste the block below into a fresh session.

---

Continue phase 67 (NodeGX Community), `dev-docs/tasks/phase-67-nodegx-university/`.

**Read first, in this order:** `RULINGS.md` — ⚠️ **the queue is EMPTY; D15/D16/D17 were ruled
2026-08-16** and the note at the end of D17 explains what to re-check if a *parent* ruling is ever
amended. Then §"WHERE THE PHASE ACTUALLY IS" below, then `TASKS.md`'s table, then your task file.
`PRIOR-ART-RECONCILIATION.md` if you have not read it before.

🔴 **Two repos.** Editor work is this checkout. Platform work is
`/Users/richardosborne/vscode_projects/nodegx-community` — a **sibling directory, never nested** —
pushing to `The-Low-Code-Foundation/nodegx-community`. None of this checkout's gates, peers or traps
apply there.

---

# WHERE THE PHASE ACTUALLY IS — measured 2026-08-16, not remembered

| Track | Tasks | State |
|---|---|---|
| **Platform** | UNI-001 (AC3), 002, 003, 004, 005, **006**, 009 (content cut) | 🟢 **SIX BUILT.** `178ddff`, sixth commit, **pushed** |
| **Platform** | UNI-008 | 📋 **One task, not started** — Tier 3, deliberately last, and D9 raised its effort |
| **Platform** | UNI-001 (the rest) | 🔴 **Blocked on Richard**: OAuth callback URLs need `community.nodegx.dev`, still unregistered |
| **Editor / MCP** | UNI-007, UNI-010, UNI-012 | UNI-007 slices 1–5 + tutor overlay; UNI-010 five slices, **KEEP**; UNI-012 scoped, not built |
| **Editor + bridge** | UNI-011 | ✅ **Fully unblocked to build AND to ship** — D15 and D16 are ruled |

**The nineteenth session built UNI-006 — assign, grade, review.** Ten of the phase's twelve tasks
now have a surface, and **phase 68's state machine exists**: D13 asked that the grader be a runner
*or* a person from day one, and it is one enum value rather than a second path.

## What UNI-006 added

**Gates:** `442 specs / 18 files` in `nodegx-community` (baseline **363 / 16**), `tsc --noEmit`
clean, `next build` **16 routes** (was 14), **16/16 drive consequences** met over HTTP.
⚠️ **`npm run lint` is STILL not a gate there** — no ESLint config, so the script drops into an
interactive setup prompt. It has never run.

**All four ACs met platform-side.** ⚠️ The one limit worth carrying: AC1 says *"the member's editor
pulls it"*, and **no editor has ever talked to this platform**. What is built is the reader
(`assignmentsForMember`) such an endpoint would serve; the round trip is proven in the suite and
over `curl` with the editor's real `LessonEvidence` shape as input.

### 🔴 Four findings, and three of them generalise well past this task

**1. UNI-005's AC3 sweep advertised a surface and enumerated a hand-list of two modules.** Its
criterion is *"…through **any** org endpoint"*; its call list was genuinely derived, from
`Object.entries(orgsModule)` — which is exactly what made it look like the strong kind of check.
But **the list it derived from was itself a list somebody wrote**, so `assignments.ts` — the module
that stores graded results about minors — was covered by nothing at all while the suite stayed
green. ⚠️ **Everything downstream of a derivation passes whether the thing you derived from is
complete or not**, which is why nothing pointed at it. Now `ORG_MODULES` is checked against every
`src/lib/` file that consults org membership.

**2. `org_is_admin()` returned NULL for a non-member, so `if not org_is_admin(...)` never fired.**
`not NULL` is NULL and `if NULL then` does not run — so every gate in `0006`, all written the
obvious way, let through **precisely the person they existed to stop**. A member with the wrong
role was refused correctly, which is why the first draft of the suite passed. Found by adding a
**third** candidate — a total stranger — to a test that already had two. 🔴 **A guard tested only
against the near-miss case is not proven against the far one, and the far one is usually why the
guard is there.** ⚠️ Harmless in a `where` clause, where NULL and false both drop the row — which
is why it survived UNI-005 undetected.

**3. `lessongrading.ts` restates D10 more widely than D10 says.** Its comment reads *"D10 rules
that org-minor accounts' project content never leaves the machine."* Obligation 3
(PRIOR-ART §F4) is a **network-level claim about minors' work reaching third-party MODEL APIs**.
Taken literally the comment forbids the evidence bundle and with it the whole school offer — the
thing D10 exists to permit. What actually forbids a raw project is the **free-text** argument
UNI-003 made about a bio, and that argument permits a bundle of booleans and integers.
⚠️ **A relayed conclusion that GAINS scope is as wrong as one that loses it, and it is harder to
notice because it reads as caution.**

**4. AC4's own headline assertion passed with the mechanism entirely disabled.** The control
replaced `submission_evidence_violation()` with `return null` and 15 of 71 specs failed — **the
census was not among them.** It walks every string stored in every bundle; but its only writer was
`submitWork`, which narrows the bundle in TypeScript before the database sees it. It was measuring
`pickEvidence` and reporting the result as a property of the schema. 🔴 **A spec whose only writer
already enforces the rule cannot detect the rule's removal — and it will look like the most
thorough spec in the file.** Repaired; the control now fails **16 of 71**.

### The shape worth reusing

🔴 **The evidence bundle holds no string at all except `provenance`, a closed set of four.** Every
other leaf is a boolean or a non-negative integer and the database refuses anything else — keys
allow-listed, each leaf's type pinned, nested objects too. That is what lets `submissions.evidence`
— **the first column in the whole schema an org-minor account can write to** — be classified in
UNI-005's AC4 census without a `minor-free-text` class, which that suite says would falsify its
criterion outright. A sixth classification, `machine-derived`, was added and is probed.

🔴 **The platform's allow-list is deliberately NARROWER than the editor's bundle.** `lessonTitle`
and `gradedAt` are not stored: `lessonTitle` is the bundle's one free-text field and it is read off
the *submitting* machine, so a pupil who edits `lesson.json` has a route into our database.
⚠️ **The third copy of that list is in this checkout** (`LessonEvidence` in
`packages/noodl-editor/src/editor/src/models/lessongrading.ts`) **and no test in either repo can
see both.** Named rather than papered over — see Lane D.

**AC2's "notifies the member" could not be an email.** An org-minor account has no address, by a
constraint 0001 already enforces, so an email notification would work for every user except the
ones D10 was ruled for. The notice is a row the member reads.

### 🔴 A drive trap this repo will hit again

**A `curl | grep` for a literal string spanning two adjacent JSX expressions never matches** —
server-rendered React inserts `<!-- -->` between them. Two consequences read as FAILED until the
HTML was actually looked at; both were fine. It fails in the **dangerous direction**: a false
negative that invites you to "fix" working code. Strip `<!-- -->` before grepping.

---

# What to do next — pick a lane and say which

**LANE A — UNI-011, the editor mirror. Recommended.** D15 and D16 are ruled, so it can be built
*and* shipped, and it is now the task that unlocks the most: **UNI-006's reader is waiting for a
client**, and D14 makes the editor a mirror of exactly the surfaces UNI-002…006 built.
🔴 The renderer is `nodeIntegration: true` **and so is the launcher** (same `BrowserWindow`): **no
post body may render as HTML in it.** ⚠️ The stranger-authored corpus is wider again — UNI-006 adds
assignment titles, instructions and grader feedback to UNI-005's shelf payloads, UNI-004's RFP text
and UNI-003's bios. Prove the boundary with a known-**BAD** corpus, not a clean one. D15 says the
visibility rule lives **behind the API** — do not reimplement it in the editor client.

**LANE B — make the login real.** Finish UNI-001: OAuth, sessions, the consent screen, the editor
half. 🔴 **Blocked on Richard, not on work** — callback URLs need `community.nodegx.dev` and the
domain **is not registered**. ⚠️ It now blocks **six** things: the admin routes UNI-002/003/004 did
not build, UNI-003's account page, every write path in UNI-005, and **every write path in UNI-006**
— setting an assignment, submitting and grading are all specced, driven, and reachable only from a
test. 🆕 `src/lib/viewer.ts` is a working session reader; what is missing is the **issuer**.

**LANE C — UNI-008, hosted publishing.** The last unbuilt platform task. 🔴 D9 made it a
**data-holding** problem rather than a file-serving one, and recorded five obligations including a
DPA and a retention policy. Deliberately Tier 3 and deliberately last; do not pull it forward
because the wow is tempting.

**LANE D — the editor remainder, and one small cross-repo debt.** UNI-012 with a packaged build
budgeted; TUTOR-BOUNDARY §5's six adversarial attacks (needs a live provider); the D5 recents
measurement, still spoiled. 🆕 **And one cheap, genuinely useful thing:** pin `LessonEvidence`'s
field list in a spec in *this* checkout, so a field added to the editor's bundle fails a gate here
rather than being silently narrowed by the platform. It is the third copy of a list whose other two
copies are kept agreeing by a test.

**My recommendation: A.** UNI-006 built a reader with no client, and UNI-011 is the client — with
both of its blocking rulings already made.

## ⚠️ For Richard — item 1 is unchanged and now blocks six things

1. 🔴 **`community.nodegx.dev` is still not registered.** It blocks UNI-001's OAuth callback URLs.
   **This is the one thing a session cannot do for itself.** Six built-but-unroutable things now
   sit behind it — two marketplaces nobody can post to, an org workspace nobody can be invited to,
   and now a teaching surface where **no teacher can set an assignment in a browser**.
2. 🔴 **A Paddle account (D7) is still the thing standing between coaching and revenue.**
   `recordPayment` still has no caller. Not urgent in the way item 1 is.
3. **The twelve badge artworks still need drawing.** D4 ruled ~12 flat SVGs in the editor's idiom.
4. ⚠️ **GitHub Pages is still unattached** (`has_pages: false` as of 2026-08-16), so D17's v0
   remains free to set up. It stops being free after the first deploy.
5. ⚠️ **The F4 packaged-install scope call** (UNI-012) is still yours and still open.
6. 🆕 **Three judgement calls in UNI-006, all reversible, all one line:**
   - **An org-minor account CAN submit** — the evidence bundle only, and it cannot carry a string.
     This is the answer to the question UNI-005 flagged and could not settle. ⚠️ It does **not**
     reopen shelf publishing: a shelf item is free text and an evidence bundle is not.
   - **A full project cannot be requested from an org-minor seat**, and the refusal is at the
     *request* rather than at the upload — a teacher who can ask and a pupil who cannot answer is a
     dead end that reads as a bug.
   - **A whole-roster assignment includes staff**, so a teacher can pull and try the lesson they
     set. The cost is that they appear in their own results table; the page groups them separately
     rather than the audience rule knowing about teaching.
7. ⚠️ **Carried and still open:** UNI-005's two calls (a minor reads but does not publish to the
   shelf; a minor belongs to exactly one org), UNI-004's *"responding to an RFP requires clearing
   D8's bar"*, and UNI-003's change to UNI-002's catalogue.

## Gates (2026-08-16, nineteenth session)

- **`nodegx-community`: 442 specs / 18 files, all pass. `tsc --noEmit` clean. `next build` succeeds**
  (16 routes). Run with `npm run db:up && npm test` from the sibling checkout.
- **The two new routes were driven with `curl` against a seeded database**, four personas, 16
  consequences written before the drive. `npm run db:seed` now also seeds two assignments (one
  runner-graded, one human-graded — D13's two modes from one schema), a submission graded twice so
  AC2's trail is visible in a browser, and a **fifth dev session token** for the teacher, because
  the results view is admin-only and would otherwise have exactly one reachable branch.
- **This checkout: nothing touched but `dev-docs/`.** No editor gate was run and none was needed —
  ⚠️ so do **not** quote a `test:ci` or `test:main` figure from this handover. There isn't one.
  ⚠️ A peer (s38/P66) reported `test:ci` **2843 / 6 @ seed 39393** on **their** tree during the
  fifteenth session. Relayed, not measured here — re-measure before quoting it as a floor.

## Standing constraints

- Editor work on `cline-dev`. 🔴 **Never `git stash`**; `cd` to the repo root in every git call.
  ✅ **`git commit <pathspecs>`, never stage.** ⚠️ Untracked files are the one case needing
  `git add` — put add and commit in **one chain** with the message **already in a file**.
- 🔴 **`cd` does not persist between tool calls here, and a `cd` inside one does not leak out.**
- 🔴 **Port 55432 for the platform's Postgres, never 5432** — this machine already runs one on 5432,
  and both `db:seed` and the test suite **drop and rebuild `public`**.
- 🔴 **This checkout is SHARED.** Peer messages are for **blocking or hazardous** things only.

## Things the next person will otherwise re-derive

- 🔴 **Never generate DDL from `src/db/schema.ts`.** It is a query mirror; the rulings live in
  `src/db/sql/`. It cannot express CHECK constraints, triggers, or the string type postgres.js
  actually returns for a `bigserial`.
- 🔴 **The drift spec checks tables and columns ONLY — including NOT enum names.** Its non-vacuity
  floor is now **32**; the free-text census's is **80**; the AC3 sweep's export floor is **40**.
- 🆕 🔴 **`created_at` is not an ordering key.** Two rows written in one transaction share `now()`
  to the microsecond, so "the latest grading" was decided by whichever the planner reached first.
  `submission_gradings.seq` is a `bigserial` for exactly this, and a five-write spec is the control.
- 🆕 🔴 **PostgreSQL does not guarantee short-circuit `or`, and reading `OLD` during an INSERT is a
  runtime error rather than a null.** `if a and (tg_op = 'INSERT' or old.x is null)` fails on the
  ordinary path. Nested branches, not one clever condition.
- 🔴 **A backtick inside a SQL comment nested in a tagged template literal opens a new template.**
  Long notes go **above** the query, never inside it. (Not an issue in a `.sql` file, which is read
  from disk.)
- 🔴 **postgres.js has no nested `begin`.**
- 🔴 **`gen_random_bytes` needs pgcrypto; `gen_random_uuid` does not.**
- 🔴 **A shared SQL fragment must not have a hole a value gets pushed into.** The first draft of
  `assignmentsForMember` did `FRAGMENT.replace('$VIEWER$', id)` inside `sql.unsafe` — an injection
  site, even though the value came from a session lookup. The viewer now arrives as `v.id` from a
  CTE both callers declare with a bound parameter.
- 🔴 **`ports`, not `dynamicports`, is how a `Component Inputs` node declares its interface.**
- 🔴 **`forEachNode` STOPS on a truthy return.** Use a block body.
- 🔴 **`/usr/bin/grep -a`, always.** Plain `grep` here is ugrep and silently skips `.ts` as binary.
- 🔴 **The `lesson` MCP group is DEFERRED** — `find_tools({group:"lesson"})` first.
- `suggestedNodes` is still **dead** — no callers.
