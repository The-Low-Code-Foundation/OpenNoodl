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
| **Platform** | UNI-001 (AC3), 002, 009 (content cut) | 🟢 **Spine + contribution engine.** `9181f8f`, second commit |
| **Platform** | UNI-003, 004, 005, 006, 008 | 📋 **Five tasks, not started** — UNI-003 is next and is mostly a *view* of what now exists |
| **Platform** | UNI-001 (the rest) | 🔴 **Blocked on Richard**: OAuth callback URLs need `community.nodegx.dev`, still unregistered |
| **Editor / MCP** | UNI-007, UNI-010, UNI-012 | UNI-007 slices 1–5 + tutor overlay; UNI-010 five slices, criterion 3 run, **KEEP**; UNI-012 scoped, not built |
| **Editor + bridge** | UNI-011 | ✅ **Fully unblocked to build AND to ship** — D15 and D16 are ruled |

**The fifteenth session built UNI-002 — the contribution engine.** The platform now has points,
badges, a challenge registry and an auditable ledger, which is what UNI-003, UNI-004 and UNI-006 all
hang off. **Six of the phase's twelve tasks now have somewhere to land.**

## What UNI-002 added, in one paragraph each

**Gates:** `105 specs / 8 files` in `nodegx-community` (baseline was **57 / 5**), `tsc --noEmit`
clean, `next build` succeeds. ⚠️ **`npm run lint` is NOT a gate there** — no ESLint config exists, so
the script drops into an interactive setup prompt. It has never run in that repo.

**The registry is data, and that is the acceptance criterion rather than a preference.** `challenges`
is a table; the engine selects by `event_key` and **never by `slug`**. AC4 is proved by a challenge
**invented at runtime with a random slug** — no source file can hold a case for a string that did not
exist when it was written. The launch set is 47 candidates in
`src/lib/challenge-catalogue.json`, **validated by inserting every row** rather than by reading it.

**🔴 The rules live in a trigger for a reason sharper than D14's.** The spine's argument was two
clients. This one is that one of the three award mechanisms is `bridge_event`, and **the bridge is
the user's own editor** — an award path where the client names the points value is a client that can
award itself ten thousand points. So the price, the mechanism allowed to claim a challenge, its cap
and its rate limit are read from the registry *by the database* at insert time. The split is stated
in the SQL: **the database enforces integrity, the module enforces eligibility, and a caller that
skips the module cannot skip the database.**

**`points_ledger.challenge_id` is NOT NULL** — every point traces to a registry row, so there is no
adjustment back door the price and cap rules cannot see. Balances and badges are **derived, never
stored**; a revocation is an append of the exact inverse carrying `revokes_id`, so AC2's *"and
badge"* half falls out of one row instead of needing a second thing remembered.

### ✅ Nine control runs — and two of them changed the code

| Control | Result |
|---|---|
| advisory lock removed | **exactly 1 fails** — the two-connection race, and nothing else |
| the whole integrity trigger never created | **17 fail**, 88 still pass |
| cap / points / mechanism / revocation-amount / rate-limit each disabled | 6 / 2 / 1 / 1 / 1 |
| webhook signature verification neutered | 2 fail |
| `badgesFor` stops excluding revoked awards | 1 fails — AC2's badge half, independent of its points half |

⚠️ **The controls found two vacuity holes and both are closed**: a leaderboard spec asserting
`board[0]`, therefore coupled to every sibling test's balance; and two catalogue assertions that are
queries **returning nothing when the table is empty**, which now assert a known-firing precondition
first.

### 🔴 Three findings that generalise past this task

1. **A BEFORE ROW trigger runs ahead of NOT NULL *and* foreign-key checks.** Two specs asserted
   `23502` / `23503` and got `P0001`. Both guards refuse the row — but which one *speaks* is the
   difference between a spec describing the system and one describing an assumption.
2. **A type that lies survives because nothing exercises it.** `ledgerId` was `number`; postgres.js
   returns `int8` as a **string**. Every spec passed, because an id is only ever carried and compared,
   never added to. ⚠️ And Drizzle's `bigserial` accepts only `'number' | 'bigint'` — it *cannot say*
   what the driver returns, a third thing that mirror cannot express.
3. **🔴 A default-argument idiom turned a negative test into a positive one.** `signature ??
   signBody(body, SECRET)` handed the spec passing `null` — meaning *"no signature header at all"* —
   a correctly signed body. It asserted the happy path while claiming to assert a refusal. This is
   the phase's own *"a failure indistinguishable from a missing mechanism"* shape arriving through a
   language feature rather than a weak assertion.

---

# What to do next — pick a lane and say which

**LANE A — keep the platform moving: UNI-003, the profile. Recommended.** `TASKS.md` already rules
the order UNI-002 → UNI-003, *"because the profile is mostly a view of the engine"* — and the engine
now exists, with badges, balances and a ledger to render. D8 governs it: open listing behind a
**profile bar**, reactive moderation. ⚠️ **It will be the first thing to notice that the twelve badge
SVGs do not exist** — `badges.artwork` holds paths and no artwork has been drawn. That is D4's one
unbuilt half and it is design work, not code.

**LANE B — make the login real.** Finish UNI-001: OAuth, sessions, the consent screen, the editor
half. 🔴 **Blocked on Richard, not on work** — callback URLs need `community.nodegx.dev` and the
domain **is not registered**. Everything else can be built against a stub provider; shipping it
cannot. ⚠️ **It also unblocks the admin grant route** UNI-002 deliberately did not build: an admin
endpoint before sessions exist is a grant-points-to-anyone endpoint.

**LANE C — UNI-011, the editor mirror.** D15 and D16 are ruled, so it can be built *and* shipped.
🔴 The renderer is `nodeIntegration: true` **and so is the launcher** (same `BrowserWindow`): **no
post body may render as HTML in it.** Pick the `<webview>` island or raw-markdown-plus-sanitiser and
**prove the boundary with a known-BAD corpus, not a clean one.** ⚠️ D15 says the visibility rule
lives **behind the API** — do not reimplement it in the editor client.

**LANE D — the editor remainder.** UNI-012 with a packaged build budgeted; TUTOR-BOUNDARY §5's six
adversarial attacks (needs a live provider, and §6's AIX-004 tuning is the same sitting); the D5
recents measurement, still spoiled.

**My recommendation: A.** UNI-003 is the shortest task in the phase that produces something a person
can look at, and everything it needs was built today.

## ⚠️ For Richard — two now, and the first is unchanged and still the only blocker

1. 🔴 **`community.nodegx.dev` is still not registered.** It blocks UNI-001's OAuth callback URLs,
   which is the next real step on the platform. **This is the one thing a session cannot do for
   itself.**
2. 🆕 **The twelve badge artworks need drawing.** D4 ruled ~12 flat SVGs in the editor's icon idiom.
   The schema, the taxonomy and the earning all work; `badges.artwork` holds paths to files that do
   not exist. UNI-003 renders them.
3. ⚠️ **GitHub Pages is still unattached** (`has_pages: false` as of 2026-08-16), so D17's v0 remains
   free to set up. It stops being free after the first deploy.
4. ⚠️ **The F4 packaged-install scope call** (UNI-012) is still yours and still open.

## Gates (2026-08-16, fifteenth session)

- **`nodegx-community`: 105 specs / 8 files, all pass. `tsc --noEmit` clean. `next build` succeeds.**
  Run with `npm run db:up && npm test` from the sibling checkout.
- **The webhook route was driven with `curl`, not only specced**: signed body → **200** with 45
  points on the ledger, forged signature → **401**, missing header → **401**, no
  `DISCOURSE_WEBHOOK_SECRET` → **503** — and the balance after all four is exactly one delivery's
  worth, so the refusals awarded nothing.
- **This checkout: nothing touched but `dev-docs/`.** No editor gate was run and none was needed —
  ⚠️ so do **not** quote a `test:ci` or `test:main` figure from this handover. There isn't one.
  ⚠️ A peer (s38/P66) reported `test:ci` **2843 / 6 @ seed 39393** during this session, six failures
  unchanged by name. That is **their** measurement on **their** tree, relayed — re-measure before
  quoting it as a floor.

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
  `src/db/sql/`. **And it now has three things it cannot express** — CHECK constraints, triggers, and
  the string type postgres.js actually returns for a `bigserial`.
- 🔴 **`MIGRATIONS` is asserted equal to the sorted contents of `src/db/sql/`.** `scripts/seed.mjs`
  named `0001_init.sql` directly and would have seeded a database with UNI-002's whole engine
  missing, with nothing failing. Three descriptions of one list; the test is what keeps them agreeing.
- 🔴 **The drift spec checks tables and columns ONLY** — and says so, because an unstated limit reads
  as coverage. Constraints and triggers are covered by their own suites.
- 🔴 **`ports`, not `dynamicports`, is how a `Component Inputs` node declares its interface.**
- 🔴 **`forEachNode` STOPS on a truthy return.** Use a block body.
- 🔴 **`/usr/bin/grep -a`, always.** Plain `grep` here is ugrep and silently skips `.ts` as binary.
- 🔴 **The `lesson` MCP group is DEFERRED** — `find_tools({group:"lesson"})` first.
- `suggestedNodes` is still **dead** — no callers.
