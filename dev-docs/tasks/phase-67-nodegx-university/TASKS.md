# Phase 67 — the tasks (UNI: NodeGX University)

**Created:** 2026-08-14 out of [README.md](README.md). Read the README's two principles and the
rulings queue first — several tasks are blocked on D-rulings, and the two principles (the login
gates nothing; services not features) are acceptance criteria in every task.

> 🔴 **Read [PRIOR-ART-RECONCILIATION.md](PRIOR-ART-RECONCILIATION.md) before starting any task
> here.** The first working session (2026-08-14) did the archaeology §"Two things to check" below
> demands, and found **five** phase-67 premises wrong or incomplete against phases 17, 20 and 51 —
> including that **D12 does not exist** (ruled 2026-08-09) and that **UNI-010's experiment is
> already specced** as LEARN-007…010. Four rulings were made; the Blocked column below reflects them.

**Surfaces:** `platform` = the new repo (D1), `editor` = this repo, `bridge` = the
editor-outbound sync between them. No task opens an inbound connection to the user's machine.

> ✅ **THE RULINGS QUEUE IS EMPTY (2026-08-14, second session).** D2–D9 and D11 are ruled; the
> register is **[RULINGS.md](RULINGS.md)**. **No task in this phase is blocked on a decision any
> more** — the Blocked column below is now a record of what each task must *honour*, not what it is
> waiting for.

| Task | One line | Surface | Tier | Effort | Rulings it must honour |
|---|---|---|---|---|---|
| [UNI-001](UNI-001-ONE-LOGIN-THAT-GATES-NOTHING.md) ⭐ | the NodeGX account: OAuth, editor sign-in, consent — the spine everything hangs off | platform + editor | **1** | M/L | ✅ **unblocked.** D2 → button reads **"Sign in to NodeGX"**; D11 → consent row default off, **absent** for org-minor accounts |
| [UNI-002](UNI-002-POINTS-BADGES-AND-THE-LONG-LIST-OF-CHALLENGES.md) ⭐ | the contribution engine: points, badges, the challenge registry, the event ledger | platform | **1** | M/L | ✅ **unblocked.** D3 → earn-only, ledger append-only + auditable; D4 → **challenges award into a (family, tier), never a `badgeId`** |
| [UNI-003](UNI-003-THE-PROFILE-THAT-FOLLOWS-YOU.md) | the public dev profile: badges, points, published prefabs, offers | platform | **1** | M | ✅ **unblocked.** D8 → open listing behind a profile bar, reactive moderation |
| [UNI-004](UNI-004-RFPS-AND-COACHING-WITHOUT-A-GATE.md) ⭐ | the RFP board + coaching offers/booking/payment, spam-shielded relay | platform | **1** | L | ✅ **unblocked.** D7 → **Paddle**, coaching only; D8 → **double-blind relay** (also the spam shield). Build so payment can be absent — the email-only v0 stands |
| [UNI-005](UNI-005-AN-ORG-IS-A-ROSTER-AND-A-SHELF.md) | org workspaces: contact-us provisioning, GitHub org hookup, roster, shared prefab/template shelf | platform | 2 | L | ✅ **unblocked.** D6 → GitHub org **and** invite list, **one** roster; D10 → pseudonymous handles · builds on **phase 51 / COL-004** |
| [UNI-006](UNI-006-ASSIGN-GRADE-REVIEW.md) | org teaching: push lessons/assignments to members, view graded results, human grading override | platform + bridge | 2 | M/L | ✅ **unblocked.** D10 ✅, D12 struck · no live co-editing (ECO-001 parked) · never branch on membership source |
| [UNI-007](UNI-007-THE-LESSON-BEAMED-INTO-THE-EDITOR.md) ⭐ | intake → personalised path → lesson project pulled into the editor's Learning folder → graded via MCP tooling | all three | 2 | L | 🟡 **SLICES 1–4 BUILT** (08-14, 08-15) — the static check, both grading engines, **both** engine-2 adapters, the Learning folder register, D5's launcher section, and ✅ **"check my work"** — the runner's first caller anywhere. **160 tests** in `test:main`, 21 in `noodl-mcp`. 🔴 Slice 4 found that a Learning-folder lesson **had no lesson layer at all** (fixed, `c38fcb7b`) — the fourth time building a caller exposed a hole, and the first time on a *feature* that a live drive had already passed over. 🟡 **Slice 4 is UNDRIVEN.** No intake (platform work) |
| [UNI-008](UNI-008-ONLINE-IN-ONE-CLICK-OFF-IN-FORTY-FIVE-DAYS.md) | push-to-share hosting: subdomain, 15-day life, manual restarts, 45-day cap, then the self-host off-ramp | platform + editor | 3 | **L+** | 🔴 **D9 ruled *against* the recommendation** — a record-capped backend is in. **Five new obligations**, effort raised, still deliberately last. [RULINGS.md](RULINGS.md) D9 |
| [UNI-009](UNI-009-THE-COMMUNITY-HOME.md) | the site itself: tutorials/tips, meetup replays, Discourse forum SSO | platform | **1 (minimal cut)** | S/M | ✅ **unblocked.** D2 → it **is** NodeGX Community; the tutorials index is one card on it, not the point of it |
| [UNI-010](UNI-010-A-TUTORIAL-YOUR-OWN-CLAUDE-CAN-WRITE.md) | the user's own Claude authors a verified lesson into the Learning folder — an experiment with pre-registered kill/keep criteria | editor + MCP | experiment | M | ✅ **unblocked.** D5 → lands in the same section **with no account**; verifier must cover **F1–F6**, and 🔴 **reject `Array`/`Object` as ambiguous** rather than substitute |

**Effort is per-v1-slice, not per-dream** — every task file carries an explicit "not in v1" list.

## Suggested order, and why

**First sitting: rulings, not code.** ✅ **Held 2026-08-14** — D1 and D10 ruled, R6 clarified, the
UNI-010 verifier question ruled, D12 struck.

**Second sitting: the rest of the rulings.** ✅ **Held 2026-08-14** — **D2, D3, D4, D5, D6, D7, D8,
D9 and D11 all ruled**, and the three curriculum blockers fact-checked against source and git.
**The queue is empty and nothing is waiting on a decision.** The next sitting is code.

🔴 **One action falls out of D2 and is time-critical:** rename the platform repo
`nodegx-university` → **`nodegx-community`**. It is private, empty, and has no Pages site, so the
rename is free today and breaks links after the first deploy — **GitHub Pages does not follow a repo
rename.**

**UNI-001 + UNI-009 (minimal cut) land together.** A login with nothing behind it is a broken
promise — the account must open onto *something* on day one: replays, tutorials index, the
forum. Discourse-with-SSO is bought, not built.

**Then the Tier-1 focus pair: UNI-002 → UNI-003.** The contribution engine before the profile,
because the profile is mostly a *view* of the engine (badges, points, published things). The
challenge list should launch long (R2) even if most challenges award manually at first —
Richard granting "attended the meetup" points by hand for a month is a fine v1 ledger writer.

**UNI-004 rides once profiles exist.** RFPs and coaching offers hang off profiles; payments
(D7) can trail the board itself — a booking form that ends in an email is an acceptable v0
while the merchant-of-record account is set up.

**Tier 2 as one arc: UNI-005 → UNI-006 → UNI-007.** Orgs before org-teaching before the full
learning bridge — but note UNI-007's grading runner (editor-side, reusing MCP validate/render)
is independently buildable early, and UNI-006 consumes it. If a school pilot materialises,
D10 goes first.

**UNI-010 as soon as UNI-007's format round-trips (its criterion 4).** The experiment needs no
platform at all, so it can run *before* the platform's lesson generator exists — and its verifier
is shared with UNI-007's runner, so building it early hardens the format for both producers.
Cheapest possible test of the whole lesson concept.

**UNI-008 last, deliberately.** The hosting wow is real but it is the only task with a
standing ops/abuse burden, and the 15/45-day lifecycle (R7) needs the account system mature.
Nothing else depends on it.

## What follows this phase

**Phase 68 — LearnBook** ([../phase-68-learnbook/](../phase-68-learnbook/README.md), scoped
2026-08-14, ruling D13): the coaching *delivery* layer — programs, modules, threaded exchange,
media, assignments the coach validates — for the sessions UNI-004 sells. It consumes UNI-001
(accounts), UNI-003 (profiles), UNI-004 (the offer/booking it delivers on), UNI-005 (the roster)
and UNI-006's assignment state machine, so it starts only once those exist. Three phase-67 tasks
carry a D13 note so they are built reusable rather than forked later: UNI-004 (bookings
referenceable), UNI-005 (one roster), UNI-006 (grader can be a runner *or* a person).

## Two things to check before starting any task here

1. ✅ **The old collab scoping (R6) — DONE 2026-08-14.** Located, and it is *two* documents that
   disagree: [phase 51](../phase-51-collaboration/README.md) is async git-merge collaboration and
   rules real-time **out of scope**; [ECO-001](../phase-20-ecosystem/ECO-001-COLLABORATIVE-EDITING.md)
   is the real-time one and is gated at 4–6 months. **Ruled: UNI-005/006 build on phase 51, COL-004
   (advisory component claiming, 3 days) first.** Full write-up:
   [PRIOR-ART-RECONCILIATION.md](PRIOR-ART-RECONCILIATION.md) F2. The archaeology also turned up
   four further collisions — read the whole document, not just F2.
2. ⚠️ **The bridge direction is a constraint, not a preference.** Editor-outbound only
   (README, surface 3 — the OBS-004 lesson). Any design sketch that has the platform "pushing"
   to an editor must be rewritten as the editor pulling on its own schedule.
3. ✅ **The three curriculum blockers — FACT-CHECKED 2026-08-14** against source and git, not
   against task tables. Full write-up in [RULINGS.md](RULINGS.md).
   - **Two of three now CLEAR.** Phase 60 is **7/7 closed** and its signal wording shipped
     (`portCopy.ts`), so **L2 is unblocked** — the curriculum glossary line has been corrected in
     place. Phase 61 is **8 of 9 built on `cline-dev`** with FUN-001 §2's notation **signed**, so
     **L11 is unblocked** — ⚠️ except that FUN-005's ports rail does not exist, so no step may
     reference it.
   - ✅ **The two-vocabulary rule — the surviving blocker — is now CLOSED by a shipped check.**
     `verifyLessonManifest()` in
     [`models/lessonverify.ts`](../../../packages/noodl-editor/src/editor/src/models/lessonverify.ts)
     rejects a condition written in the prose vocabulary and names the type name to use.
     🔴 **Re-derived from the catalog 2026-08-14 and it is much larger than "nine, two ambiguous":
     103 plain divergences, 4 ambiguous, and a third class of 6 nobody had recorded** — *shadowed*
     names (`Variable`, `Button`, `Text Input`, `Checkbox`, `Radio Button`, `Cloud Function`) where
     the string IS a real type name, so an existence check passes, but it names the deprecated node.
     `Variable` is the curriculum's own L6 node. [RULINGS.md](RULINGS.md) "Blocker 1 — the
     amendment".
   - 🔴 **Two task tables were the stale artifact, not the memory.** Phase 61's table marked four
     merged tasks `open`; the curriculum glossary warned "do not author until phase 60 publishes"
     three days after it published. Both corrected in place. **Grep git and read source before
     believing a status column — including these.**
   - 🔴 **AMENDED AGAIN 2026-08-15 — the shipped check had a hole and the format had a sink.**
     A path written `%Group` (component name omitted) contained *nothing the vocabulary check
     looked at* and passed in silence, while never matching at runtime — the same silent failure by
     a different route. And a lesson body naming `javascript:` compiled into a live anchor inside a
     node-integrated renderer. Both closed (`unmatchable-node-path`, `unsafe-url`). **Both were
     found by building the check's caller, not by reading the check.** [RULINGS.md](RULINGS.md)
     "The second amendment".
   - ⚠️ **Two owed items phase 67 never carried**, both from CURRICULUM-DESIGN §11: **curriculum
     hosting** (§9.3, now partly a D2/D9 question) and the **tutor lesson-context overlay** (§9.1,
     *"required before L2 testing"*) — UNI-007 runs straight into the second and does not mention it.
