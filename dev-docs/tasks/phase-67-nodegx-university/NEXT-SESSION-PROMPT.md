# Phase 67 — next session prompt

Paste the block below into a fresh session.

---

Continue phase 67 (NodeGX Community), `dev-docs/tasks/phase-67-nodegx-university/`.

**Read first, in this order:** `RULINGS.md` — the queue is EMPTY (D15/D16/D17 ruled 2026-08-16),
and ⚠️ **read the postscript at the end of the D15/D16/D17 section**, which is the twentieth
session's finding and is about all three at once. Then §"WHERE THE PHASE ACTUALLY IS" below, then
`TASKS.md`'s table, then your task file. `PRIOR-ART-RECONCILIATION.md` if you have not read it.

🔴 **Two repos.** Editor work is this checkout. Platform work is
`/Users/richardosborne/vscode_projects/nodegx-community` — a **sibling directory, never nested** —
pushing to `The-Low-Code-Foundation/nodegx-community`. None of this checkout's gates, peers or traps
apply there.

---

# WHERE THE PHASE ACTUALLY IS — measured 2026-08-16, not remembered

| Track | Tasks | State |
|---|---|---|
| **Platform** | UNI-001 (AC3), 002, 003, 004, 005, 006, 009 (content cut), **011 slice 1** | 🟢 **SEVEN COMMITS.** `7193f92`, **pushed** |
| **Platform** | UNI-008 | 📋 **One task, not started** — Tier 3, deliberately last, D9 raised its effort |
| **Platform** | UNI-001 (the rest) | 🔴 **Blocked on Richard**: OAuth callback URLs need `community.nodegx.dev`, still unregistered |
| **Editor** | UNI-011 slice 1 | 🟡 **BUILT** — `f7b0b280`. The client and the post-body boundary. **No view** |
| **Editor / MCP** | UNI-007, UNI-010, UNI-012 | UNI-007 slices 1–5 + tutor overlay; UNI-010 five slices, **KEEP**; UNI-012 scoped, not built |

**The twentieth session built UNI-011 slice 1 — and the first thing it found is why the slice is
shaped the way it is.**

## 🔴 D14's API did not exist, and no task owned it

D15 rules that the visibility rule lives *behind the API*. D16 rules that the threshold is
*computed*. D17 rules that the curriculum index is *part of the platform API*. All three name the
API as the place that holds the rule — and **the platform had exactly one route under
`src/app/api`**, the Discourse webhook receiver. Everything else was a Next.js page calling
`src/lib` in-process.

D14's own second consequence had already said it (*"the API is a deliverable, not an implementation
detail"*), and it fell in a gap: UNI-011's surface is *"editor + bridge"*, and the eight platform
tasks each built pages. So `communityVisibility()` and `readThreshold()` shipped as careful,
controlled, well-specced pure functions **whose only callers were their own test files**.

⚠️ **The line worth carrying**: *a ruling that names where a rule must live is a claim about a
place, and the place is not checked by ruling it.* D15 was implemented correctly, tested
thoroughly, and enforced nowhere — and it read as done for a day.

## What slice 1 added

**Platform** (`7193f92`): `/api/v1/me`, `/api/v1/me/assignments`, `/api/v1/community/home`,
`/api/v1/community/threads`, `/api/v1/community/threshold`.
**462 specs / 19 files** (baseline 442/18), `tsc` clean, `next build` **21 routes** (was 16).
**Four controls**, each precisely scoped. **14/14 driven consequences written before the drive.**

**Editor** (`f7b0b280`): `models/community/communityapi.ts` + `models/community/postbody.ts`,
**55 specs**. `test:main` **223 suites / 3458 specs** — 221/3403 without these two files. eslint
clean. `tsc -p tsconfig.tests-main` reports **31 errors, all pre-existing, none in these files**.

### Four things decided, each one line to reverse

1. **A bearer token is accepted as well as the cookie** — same `sessions` row, same `token_hash`,
   same expiry. The editor is not a browser. Nothing here mints anything; UNI-001's missing half is
   still the **issuer**.
2. **D15's absence is a 404 whose body does not explain itself.** A 403 saying *"your school
   disabled the community"* is the greyed-out Post button in JSON.
3. 🔴 **An absent forum is not an empty forum.** `forum_threads` is written only by the webhook
   receiver, so with it unconfigured the table's emptiness is a fact about our deployment. The
   endpoint returns `{forum: 'absent'}`, never `{threads: []}`.
4. 🔴 **`/api/v1/me/assignments` is NOT gated on D15**, and the recipe carries the reason. Gating it
   would switch UNI-006 off for **every org that took D15's default** — which is every org — and it
   would read as caution the whole way. UNI-006 made exactly this mistake with D10 two days earlier.

### 🔴 Findings that generalise past this task

**1. A new HTTP surface is outside every guard this phase has built.** UNI-005's AC3 sweep says so
about itself: *"it proves nothing about a route handler that queries the database directly instead
of going through these modules."* Every sweep so far quantifies over **module exports**. So the new
suite is built one level out: **the route list is read off disk**, every route needs a D15 verdict
**with a written reason**, a recipe naming a route that no longer exists also fails, and there are
**two known-firing controls** — a route that forgot the gate, and one that 404s while explaining why.

**2. The boundary's safety rested on a property of its consumer, which is the class of argument the
design was chosen to eliminate.** `postbody.ts` parses markdown to a data model (`Block[]` has no
field that could hold markup) rather than to an HTML string. Its first draft passed
`[x](&#106;avascript:alert(1))` straight through: `&` fails the scheme test, so `safeLessonUrl`
classifies it *relative*. Harmless **only because React sets `href` with `setAttribute`** — put the
same string in an HTML string and the parser decodes `&#106;` to `j` first. ⚠️ **Found by the
corpus entry that looked most theoretical.** Closed by decoding the probe to a fixed point.

**3. The instrument was wrong twice, in opposite directions, in one file.** Its strip regex
contained a **literal NUL byte** — which makes git call a `.ts` file binary and grep skip it — and
it changed no verdict, which is exactly why it would have survived. And its criterion was a
**substring match**, which flagged an escaped href that could not execute: *a gate that rejects the
correct answer is worse than no gate*, walked into while writing the gate. It now decodes **once**,
the way an HTML parser does, which is the property that decides execution.

**4. `renderMarkdown` was measured, and it HOLDS.** The lesson renderer whose output reaches
`dangerouslySetInnerHTML` — the thing UNI-011's option B invites reusing — was run over the same
fifteen-payload corpus by the same instrument and passed every case. 🔴 **Recording it as a defect
would be the over-claim this phase warns about as loudly as the under-claim.** The objection is
structural: it is safe because two passes run in a particular order, and that can be removed by an
edit while every test still passes.

**5. A client that agrees with the API is indistinguishable from one that reads it** — from every
test you would naturally write. So the client's fixtures **contradict themselves**: a threshold
whose `entryPoint` says `in-editor-mirror` while every component is unmet, and a `present` surface
with no capabilities. A client that recomputed produces the sensible answer; this one produces the
one it was given. The control confirms it.

---

# What to do next — pick a lane and say which

**LANE A — UNI-011 slice 2, the surface.** The transport is built and proved; what does not exist is
anything a user can see. 🔴 **D16's ship order is the opposite of its build order** — *build the
mirror first, surface it last* — so read D16 before wiring an entry point, and note the entry point
must open the **browser** until the threshold is met, which today it is not and cannot be (no
forum). ⚠️ The honest v1 surface is therefore the **composition**: replays, articles, standing,
assignments. AC2 (*ask about this node*) and AC3 (*share a capture*) are the editor-only half and
are where the value is; `livePreviewCapture.ts` already exists.

**LANE B — make the login real.** Finish UNI-001: OAuth, sessions, the consent screen, the editor
half. 🔴 **Blocked on Richard, not on work** — callback URLs need `community.nodegx.dev` and the
domain **is not registered**. It now blocks **seven** things: the admin routes UNI-002/003/004 did
not build, UNI-003's account page, every write path in UNI-005 and UNI-006, and now **every
authenticated read of the new API in a deployed build** — `src/lib/viewer.ts` reads a session and
`scripts/seed.mjs` is the only thing that mints one.

**LANE C — UNI-008, hosted publishing.** The last unbuilt platform task. 🔴 D9 made it a
**data-holding** problem, with five obligations including a DPA and a retention policy. Deliberately
Tier 3 and deliberately last.

**LANE D — D17's half, and the editor remainder.** 🆕 **D17 is ruled and nothing serves a curriculum
index** — the ruling's v0 is GitHub Pages on `nodegx-community`, and ⚠️ `has_pages: false` as of
2026-08-16, so attaching it is still free. Plus UNI-012 with a packaged build budgeted;
TUTOR-BOUNDARY §5's six adversarial attacks (needs a live provider); the D5 recents measurement,
still spoiled; and the `LessonEvidence` field-list pin in *this* checkout (its third copy, kept
agreeing with the other two by nothing).

**My recommendation: A.** Slice 1 deliberately built no surface, and a mirror nobody can open is the
one state this task can be left in that helps no one. Its two remaining ACs are also the two
features D14 says are *the reason to transition*.

## ⚠️ For Richard — item 1 is unchanged and now blocks seven things

1. 🔴 **`community.nodegx.dev` is still not registered.** It blocks UNI-001's OAuth callback URLs.
   **This is the one thing a session cannot do for itself.** There is now an API as well as a set of
   pages behind it, and in a deployed build **nobody can be signed in to either**.
2. 🔴 **A Paddle account (D7)** is still what stands between coaching and revenue. `recordPayment`
   still has no caller.
3. **The twelve badge artworks still need drawing.** D4 ruled ~12 flat SVGs in the editor's idiom.
4. ⚠️ **GitHub Pages is still unattached** (`has_pages: false`, 2026-08-16), so D17's v0 remains
   free to set up. It stops being free after the first deploy.
5. ⚠️ **The F4 packaged-install scope call** (UNI-012) is still yours and still open.
6. 🆕 **One judgement call in UNI-011 slice 1, reversible, one line:** the assignments endpoint is
   **not** subject to D15, so a pupil whose school switched the community off still pulls the
   lessons that school set them. The alternative reading switches UNI-006 off for every school.
7. ⚠️ **Carried and still open:** UNI-006's three calls (an org-minor may submit an evidence bundle;
   a full project cannot be requested from an org-minor seat; a whole-roster assignment includes
   staff), UNI-005's two, UNI-004's *"responding to an RFP requires clearing D8's bar"*, and
   UNI-003's change to UNI-002's catalogue.

## Gates (2026-08-16, twentieth session)

- **`nodegx-community`: 462 specs / 19 files, all pass. `tsc --noEmit` clean. `next build` 21
  routes.** Run with `npm run db:up && npm test` from the sibling checkout.
  ⚠️ **`npm run lint` is STILL not a gate there** — no ESLint config, so the script drops into an
  interactive setup prompt. It has never run.
- **This checkout: `test:main` 223 suites / 3458 specs, all pass** — measured this session, on a
  tree that includes other sessions' work. 🔴 **Do not quote the handover's previous 209/3248; it
  had already moved before this session started.** eslint clean on the four new files.
  ⚠️ **No `test:ci` was run.** Do not quote one from this handover — there isn't one.
- **The drive** ran against `next dev` on localhost with a seeded database, 14 consequences written
  first. `npm run db:seed` now also seeds a **second school on D15's default** (`blackthorn`) with a
  pupil and a **sixth dev session token**, because St Swithin's is `read_only` and the whole
  `absent` branch was otherwise unreachable outside the suite — plus one assignment at that school,
  since a 200 with an empty list is also what a broken route returns.

## Standing constraints

- Editor work on `cline-dev`. 🔴 **Never `git stash`**; `cd` to the repo root in every git call.
  ✅ **`git commit <pathspecs>`, never stage.** ⚠️ Untracked files are the one case needing
  `git add` — put add and commit in **one chain** with the message **already in a file**.
- 🔴 **`cd` does not persist between tool calls here, and a `cd` inside one does not leak out.**
- 🔴 **Port 55432 for the platform's Postgres, never 5432** — this machine already runs one on 5432,
  and both `db:seed` and the test suite **drop and rebuild `public`**.
- 🔴 **This checkout is SHARED.** Peer messages are for **blocking or hazardous** things only.

## Things the next person will otherwise re-derive

- 🆕 🔴 **A route handler is outside every sweep this phase has built.** They all quantify over
  module exports; `tests/uni011-mirror-api.test.ts` is the one that quantifies over routes, and it
  reads them **off disk**. Add a route, and it fails until you give it a verdict.
- 🆕 🔴 **A literal NUL byte in a `.ts` file makes git call it binary and makes grep skip it**, and
  it can be typed into a regex character class without any tool complaining.
- 🆕 ⚠️ **`expect(value, message)` is vitest, not jest.** The platform suite takes the second
  argument; this checkout's `test:main` does not, and it fails at compile rather than at runtime.
- 🔴 **Never generate DDL from `src/db/schema.ts`.** It is a query mirror; the rulings live in
  `src/db/sql/`.
- 🔴 **The drift spec checks tables and columns ONLY — including NOT enum names.** Its non-vacuity
  floor is **32**; the free-text census's is **80**; the AC3 sweep's export floor is **40**; the new
  route sweep's floor is **6 routes**.
- 🔴 **`created_at` is not an ordering key** — `submission_gradings.seq` is a `bigserial` for
  exactly this.
- 🔴 **PostgreSQL does not guarantee short-circuit `or`, and reading `OLD` during an INSERT is a
  runtime error rather than a null.**
- 🔴 **A backtick inside a SQL comment nested in a tagged template literal opens a new template.**
- 🔴 **postgres.js has no nested `begin`.** 🔴 **`gen_random_bytes` needs pgcrypto;
  `gen_random_uuid` does not.**
- 🔴 **A shared SQL fragment must not have a hole a value gets pushed into.**
- 🔴 **`ports`, not `dynamicports`, is how a `Component Inputs` node declares its interface.**
- 🔴 **`forEachNode` STOPS on a truthy return.** Use a block body.
- 🔴 **`/usr/bin/grep -a`, always.** Plain `grep` here is ugrep and silently skips `.ts` as binary.
- 🔴 **The `lesson` MCP group is DEFERRED** — `find_tools({group:"lesson"})` first.
- `suggestedNodes` is still **dead** — no callers.
