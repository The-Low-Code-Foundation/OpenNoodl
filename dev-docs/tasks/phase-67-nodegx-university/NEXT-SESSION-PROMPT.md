# Phase 67 — next session prompt

Paste the block below into a fresh session.

---

Continue phase 67 (NodeGX Community), `dev-docs/tasks/phase-67-nodegx-university/`.

**Read first, in this order:** `RULINGS.md` — ⚠️ **the queue is EMPTY; D15/D16/D17 were ruled
2026-08-16** and the note at the end of D17 explains what to re-check if a *parent* ruling is ever
amended. Then §"WHERE THE PHASE ACTUALLY IS" below, then `TASKS.md`'s table, then your task file.
`PRIOR-ART-RECONCILIATION.md` if you have not read it before.

🔴 **Two repos now.** Editor work is this checkout. Platform work is
`/Users/richardosborne/vscode_projects/nodegx-community` — a **sibling directory, never nested** —
pushing to `The-Low-Code-Foundation/nodegx-community`. None of this checkout's gates, peers or traps
apply there.

---

# WHERE THE PHASE ACTUALLY IS — measured 2026-08-16, not remembered

| Track | Tasks | State |
|---|---|---|
| **Editor / MCP** | UNI-007, UNI-010, UNI-012 | **Nearly done.** UNI-007 slices 1–5 + tutor overlay; UNI-010 all five slices, criterion 3 run, **KEEP**; UNI-012 scoped, not built |
| **Platform** | UNI-001, 009 | 🟡 **Spine built** — `bb3ff8d7`, first commit ever in that repo |
| **Platform** | UNI-002, 003, 004, 005, 006, 008 | 📋 **Six tasks, not started** — but they now land on a schema and a test harness that exist |
| **Editor + bridge** | UNI-011 | ✅ **Fully unblocked to build AND to ship** — D15 and D16 are ruled |

**The fourteenth session's job was the bottleneck: the platform repo had `size: 0`, no branches, and
`/commits` returning 409.** It now has a schema, 57 specs and four served pages. The phase is no
longer one-third buildable.

## What is in `nodegx-community` after one sitting

D1's stack — Next.js App Router, Postgres, Drizzle, Docker on port **55432**.

🔴 **The schema is the deliverable, and the rulings are database constraints rather than
conventions.** The reason is D14: the API has two clients, and a rule enforced *in a client* is a
rule the other client can disagree with, one release later, silently.

| Ruling | How it is enforced |
|---|---|
| **D3** | `points_ledger_append_only()` trigger |
| **D4** | the **absence** of a `badge_id` column — asserted by a spec, because an absence has no other witness |
| **D6** | `org_members.source`, one roster |
| **D10** | `account_org_ownership` + `org_minor_holds_no_pii` CHECK constraints |
| **D11** | `consents_d11_org_minor` trigger |
| **D15** | `src/lib/community-visibility.ts` |
| **D16** | `src/lib/community-threshold.ts` |

### 🔴 D3 versus UNI-001's AC3 was a real contradiction, and it is resolved rather than papered over

D3 wants a ledger you can always recount. AC3 wants account deletion to cascade to ledger rows. Both
cannot be literally true. The resolution: **UPDATE is refused outright — including inside a declared
erasure, because a licence to delete is not a licence to rewrite** — and DELETE is refused unless
the transaction has set `app.gdpr_erasure`. So the ledger cannot be tidied, cannot be rewritten, and
cannot be emptied by a stray cascade, while erasure stays something the system can actually do and
has to *say* it is doing. There is a spec proving the permission does not leak onto the pooled
connection afterwards.

### ✅ Every mechanism has a control run — the suite was not trusted because it was green

| Control | Result |
|---|---|
| D15 write leak | **2 fail** — and it caught that the *anonymous* viewer shares that code path, so a leak reaches signed-out users too |
| D15 capability added to the list | **16 → 18 tests, no spec edited** — coverage extends the day a capability is added |
| D15 capability list emptied | suite collapses **16 → 4** and the mirror spec fails on *"expected 0 to be greater than 0"* |
| D3 trigger removed | **4 fail**, the 3 erasure-*success* specs still pass |
| D10 constraint neutered | exactly the **2** PII specs |
| D11 trigger removed | exactly the **1** spec |

`grep -c CONTROL` returns **0** in both touched files.

### 🔴 A footgun found while committing, and removed rather than documented

`package.json` had `db:push` / `db:generate`. **`drizzle-kit push` generates DDL from
`src/db/schema.ts`, which has no representation for a CHECK constraint or a trigger** — so it would
have built a database with **D3, D10 and D11 silently switched off**, and the column-level drift
check would still have passed, because every *column* would be right. drizzle-kit is no longer a
dependency. **This is the phase's own recurring shape: the check that passes on the broken artifact.**

## 🔴 What is NOT built, stated plainly

Because *"we did not build it"* and *"we built it and it works"* must never read the same way:

- **No OAuth, no sessions issued, no consent screen UI.** The sign-in button renders D2's string and
  is **inert**. UNI-001's AC1, AC2 and AC4 are editor-side and untouched; **AC3 is met and proven.**
- **No Discourse, no SSO, no webhook receiver.** UNI-009's AC1 and AC3 are untouched — the forum is
  a purchase nobody has made.
- **No editor bridge.**
- `forum_threads` has no producer. D16's threshold reads it; nothing fills it.

---

# What to do next — pick a lane and say which

**LANE A — keep the platform moving. Recommended.** The order `TASKS.md` already rules:
**UNI-002 → UNI-003**, the contribution engine before the profile, because the profile is mostly a
*view* of the engine. Both land on a ledger that exists and a suite that runs. ⚠️ D4's binding
constraint is already structural — **a challenge awards into a `(family, tier)`, never a
`badgeId`** — so the challenge registry can launch long (R2) without a drawing per challenge.

**LANE B — make the login real.** Finish UNI-001: OAuth, sessions, the consent screen, the editor
half. 🔴 **Blocked on Richard, not on work** — callback URLs need `community.nodegx.dev` and the
domain **is not registered**. Everything else in UNI-001 can be built against a stub provider, but
shipping it cannot.

**LANE C — UNI-011, now fully unblocked.** D15 and D16 are ruled, so it can be built *and* shipped.
🔴 The renderer is `nodeIntegration: true` **and so is the launcher** (same `BrowserWindow`): **no
post body may render as HTML in it.** Pick the `<webview>` island or raw-markdown-plus-sanitiser and
**prove the boundary with a known-BAD corpus, not a clean one.** ⚠️ D15 says the visibility rule
lives **behind the API** — do not reimplement it in the editor client.

**LANE D — the editor remainder.** UNI-012 with a packaged build budgeted; TUTOR-BOUNDARY §5's six
adversarial attacks (needs a live provider, and §6's AIX-004 tuning is the same sitting); the D5
recents measurement, still spoiled.

**My recommendation: A.** The platform now has somewhere to put things, and UNI-002 is the task the
most others hang off.

## ⚠️ For Richard, and only one of them is urgent

1. 🔴 **`community.nodegx.dev` is still not registered.** It blocked nothing while the repo was
   empty. It now blocks UNI-001's OAuth callback URLs, which is the next real step on the platform.
   **This is the one thing a session cannot do for itself.**
2. ✅ **The D2 description was fixed 2026-08-16** — it had named University as the platform for two
   days after D2 ruled Community is. Both halves of D2 are now done.
3. ⚠️ **GitHub Pages is still unattached** (`has_pages: false`, re-verified today), so D17's v0
   remains free to set up. It stops being free after the first deploy.

## Gates (2026-08-16, fourteenth session)

- **`nodegx-community`: 57 specs / 5 files, all pass. `tsc --noEmit` clean.** Run with
  `npm run db:up && npm test` from the sibling checkout.
- **UNI-009 verified by SERVING it**: `/`, `/replays`, `/tutorials`, `/university` all **200 with no
  cookie**; replays newest-first (08-12, 08-05, 07-29); all three articles; D2's string on all four.
- **This checkout: nothing touched but `dev-docs/`.** No editor gate was run and none was needed —
  ⚠️ so do **not** quote a `test:ci` or `test:main` figure from this handover. There isn't one.
- ⚠️ A peer (s38/P66) launched and tore down the editor during this session. Unrelated; no collision.

## Standing constraints

- Editor work on `cline-dev`. 🔴 **Never `git stash`**; `cd` to the repo root in every git call.
  ✅ **`git commit <pathspecs>`, never stage.** ⚠️ Untracked files are the one case needing
  `git add` — put add and commit in **one chain** with the message **already in a file**.
- 🔴 **`cd` does not persist between tool calls here, and a `cd` inside one does not leak out.** Put
  the `cd` in the same command as the run.
- 🔴 **Port 55432 for the platform's Postgres, never 5432** — this machine already runs one on 5432,
  and both `db:seed` and the test suite **drop and rebuild `public`**.
- 🔴 **This checkout is SHARED.** Peer messages are for **blocking or hazardous** things only.
  Findings go in the task file.

## Things the next person will otherwise re-derive

- 🔴 **Never generate DDL from `src/db/schema.ts`.** It is a query mirror; the rulings live in
  `src/db/sql/0001_init.sql`.
- 🔴 **The drift spec checks tables and columns ONLY** — and says so, because an unstated limit
  reads as coverage. Constraints and triggers are covered by their own suites.
- 🔴 **`ports`, not `dynamicports`, is how a `Component Inputs` node declares its interface.**
- 🔴 **`forEachNode` STOPS on a truthy return.** Use a block body.
- 🔴 **`/usr/bin/grep -a`, always.** Plain `grep` here is ugrep and silently skips `.ts` as binary.
- 🔴 **The `lesson` MCP group is DEFERRED** — `find_tools({group:"lesson"})` first.
- `suggestedNodes` is still **dead** — no callers.
