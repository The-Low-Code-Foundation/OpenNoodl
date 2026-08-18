# Phase 67 — next session prompt

Paste the block below into a fresh session.

---

Continue phase 67 (NodeGX Community), `dev-docs/tasks/phase-67-nodegx-university/`.

**Read first, in this order:** **[D19](RULINGS.md)**, then §"WHERE THE PHASE IS" below, then
`TASKS.md`'s table, then your task file.

🔴 **Two repos.** Editor work is this checkout. Platform work is
`/Users/richardosborne/vscode_projects/nodegx-community` — a **sibling directory, never nested** —
pushing to `The-Low-Code-Foundation/nodegx-community`. None of this checkout's gates, peers or
traps apply there.

---

# ✅ THE BENCH IS BUILT. D19's tranche is now three-quarters landed.

**Platform `cdc7b17`. Editor `eeb64051` (code) + `bf7dcbba` (this handover).**

**UNI-015 — all five ACs met.** **UNI-016 — platform half built, AC1–AC4 met.**

🔴 **The one thing left in UNI-016 is the editor's POST, and it is the whole reason the tranche
exists.** The platform can receive artifact posts and **nothing sends them**:
`AskAboutNodeDialog` still hands off to the browser with a prefilled composer. **That is the
next task.**

---

# WHERE THE PHASE IS — 2026-08-18 (session 27)

| Track | Tasks | State |
|---|---|---|
| **Platform** | UNI-001 (AC3), 002–006, 009 cut, 011 s1, 013 s1–s3, **014** | 🟢 pushed |
| **Platform** | **UNI-015 — the Bench** | ✅ **BUILT. 5/5 ACs.** `cdc7b17` |
| **Platform** | **UNI-016 — artifact posts** | 🟡 **PLATFORM HALF BUILT (AC1–AC4).** 🔴 **Editor POST NOT built — START HERE** |
| **Platform** | UNI-017 — the queue and the signal | 🟡 **Partly pre-built by UNI-015**: `unansweredQueue()` exists and `/bench` renders it with the clock. *Same here* is untouched |
| **Editor** | UNI-018 — pull a graph | 🔴 NOT BUILT. 🔴 **Read its §"THE HAZARD" before scoping** |
| **Platform** | UNI-007 intake / personalised path | 🟡 Still the one platform piece nobody has looked at |
| **Platform** | **deployment** | 🔴 **Owned by NO TASK. Still the top ask.** |
| **Editor / MCP** | UNI-012 | ✅ Ruled, scoped, **NOT built. Buildable now** |
| **Platform** | UNI-013 slice 4 (12 badge SVGs) | 🔴 Richard's. Degrades rather than blocks |

## What session 27 did

**Platform `cdc7b17`** — `0008_uni015_bench.sql`, `0009_uni016_attachments.sql`,
`src/lib/{bench,postbody,attachments,bench-http}.ts`, four `/api/v1/bench` routes, `/bench` and
`/bench/[threadId]`, `PostBody.tsx` + `Attachment.tsx`, the Bench and node-figure CSS, and the
**Discourse decommission** (three files deleted, `forum_threads` dropped, `{forum:'absent'}`
removed, the challenge registry re-pointed).

**Editor `eeb64051`** — the shared golden corpus and the spec that pins its hash. Nothing else in
the editor changed. ⚠️ **This checkout's HEAD has moved on since**: a peer committed `7947d193`
(FIX-021 slice B) afterwards, which is normal here and touches nothing of this phase's.

---

# 🔴 FIVE THINGS MEASURED THAT THE TASK FILES HAD WRONG — read before touching any of it

### 1. `recordEvent` could not be called inside a transaction, and the symptom was a lost QUESTION

`tryAward` catches a refusal and reports it as an outcome, which is correct **standalone**. Inside
a caller's transaction a `raise exception` has **already aborted Postgres**, and catching it in
TypeScript does not un-abort it. `bench.thread.created` has two listeners — `first-thread` (capped
at 1) and `thread-started` (repeatable) — so **the second question anybody asked failed outright**
with `[cap-reached]`.

✅ Fixed with a **savepoint per award** in `contribution.ts` (`isolated()`). **Per challenge**,
because a savepoint around the whole of `recordEvent` would forfeit the sibling awards and
`thread-started` would never pay out again after a person's first thread — a quieter version of
the same bug. 🔴 **UNI-002's 38 specs pass with those files byte-unchanged in git**, which is
exactly the proof UNI-015 AC2 asks for that this is a new caller and not a new mechanism.

⚠️ **`savepoint` exists only on a `TransactionSql`, never on a pool** — that is what makes the
branch a reliable discriminator rather than a guess.

### 2. `alter type … add value` is unusable in a migration here

Measured on **PG 16.14**: adding an enum value and naming it in a CHECK constraint in the same
migration is refused (*"unsafe use of new value"*), and `applySchema` runs each migration as one
implicit transaction. 🔴 **The `subject_kind::text = 'x'` workaround parses fine and is worse than
the problem** — a mistyped literal is not an error, it is a clause that silently never matches,
which is the *check that cannot fail* this phase has now found five times. **Recreate the enum**
(drop the constraint, rename, create, alter the columns, drop the old type, re-add the constraint).

### 3. AC4's `grep -ril discourse` instrument is TOO STRONG and was not implemented literally

Taken at its word it forbids a comment **saying what was removed**: `0001` still creates
`forum_threads` because a migration is history, and `0008` must name `discourse.post.created` to
migrate away from it. ✅ What is asserted instead is sharper — **no live CODE anywhere in `src/`,
comments stripped first** (with a control proving the stripper does not strip code), plus the
named files are gone and the **live database** has no `forum_threads` and no `discourse.*` event
key. **Prose keeps the record; code keeps nothing.**

### 4. Two shipping palette tokens fail WCAG AA in the LIGHT theme — fifth instance

`--theme-color-danger` scores **4.26** and `--theme-color-success` **3.55** on `bg-0` in light —
and they are exactly the tokens the queue clock and the accepted-answer mark would reach for. The
pitch artifact hand-mixed its own colours (`#a33228`, `#1f6d52`) for those two roles, which is
what a designer does when the system token looks wrong — **and it looked wrong because it IS
wrong** at that size on that ground. ✅ `--site-fg-alert` and `--site-fg-good` are **split by
theme**; `--site-fg-warn` needed no split (10.51 / 4.79). All three are now rows in
`tests/uni013-contrast.test.ts`. 🔴 **A role with no pair in that table is a colour nobody
measured.**

### 5. The SQL re-point of the challenge registry matches ZERO ROWS

`challenges` is empty in a fresh schema — the registry loads from `challenge-catalogue.json` via
`syncCatalogue()` — and **nothing is deployed anywhere**, so no database holds a `discourse.*` row.
The JSON is the half that binds. Written into `0008`'s comment out loud so the block is never read
as evidence that anything was migrated.

---

# 🔴 TWO HARNESS TRAPS THAT COST TWO DEBUGGING PASSES

Both are in `tests/uni015-bench-http.test.ts`, both will bite anyone who spawns a server in a spec.

1. **`next start` SURVIVES `child.kill()`.** We spawn `npx`; the real listener is a **grandchild**
   (`next-server`). A survivor holds a pool against the database every other suite drops, and the
   symptom is **51 failures in five unrelated files** reading `type "badge_family" does not exist`.
   ⚠️ **`pkill -f "next start"` matches NOTHING.** Kill by port.
2. 🔴 **`lsof -ti :3987` MATCHES CLIENTS TOO** — including the vitest worker that just ran the
   fetches. Killing that PID **SIGKILLs the process running the tests**: the file vanishes from the
   report with an *"unhandled error"* from tinypool, the summary reads **`23 passed (24)`**, and
   **nothing names the file that did not run.** ✅ **`lsof -ti tcp:<port> -sTCP:LISTEN`.**
   **A suite that was killed looks almost exactly like a suite that passed — always reconcile the
   file count.**

---

# THE PLAN

## 🟢 LANE A — finish UNI-016: the editor's composer POSTs. **Start here.**

Everything it needs exists. `POST /api/v1/bench/threads` accepts `{section, title, body}` and
returns `{threadId, postId, pointsAwarded}`; `POST /api/v1/bench/threads/:id/posts` answers.
Attach with `attachToPost` — the payload shapes are `NodeExcerptPayload` and `CapturePayload` in
`src/lib/attachments.ts`. The bearer token `AskAboutNodeDialog` already holds is the credential
(`apiviewer.ts` resolves it against the same `sessions` rows as the cookie).

🔴 **The browser hand-off STAYS as the signed-out route — do not delete it.** UNI-016 AC5 says so,
and right now AC5 is only *trivially* true because nothing in the editor changed.

⚠️ **`withheldPorts` publishes DIRECTION and a count, never a name** — the excerpt already buckets
the name to `<port>`; the count is what makes the redaction visible. `ports_withheld` is a
GENERATED column, so the editor cannot understate it and neither can anyone else.

## 🟡 LANE B — UNI-017, which is now half-built

`unansweredQueue()` exists in `src/lib/bench.ts` and `/bench` renders it with the three-state
clock. What remains is ***same here***, bound to (node type, version) — and the facet columns it
needs are already on `post_attachments`. 🔴 **Read D8's bar through `profile_meets_bar()` — be the
FIFTH caller, not a fourth copy.**

## 🔴 LANE C — deployment: scope it, do not build it

Needs Richard's nexus-1 decision first, so **write the task file and stop.**

---

# ⚠️ FOR RICHARD — the asks, one of them sharper than last session

1. 🔴 **Does the platform go on nexus-1?** Deployment is owned by no task and **a forum now
   exists to be somewhere**. ⚠️ `NOTIFICATION_LINK_SECRET` has a dev default; a deployment that
   does not set it has forgeable unsubscribe links.
2. 🆕 **Where do capture images live?** — **sharper now, and cheap to defer.** A `capture`
   attachment stores its **dimensions and its consent record and no image**, which is exactly
   what the editor publishes today (`{width, height, bytes}`), so **nothing has to be migrated**
   when you decide: an `image_url` column and a writer are the whole change. Options: a blob
   column, object storage, or the deployment box's disk. **It intersects ask 1.**
3. **A transactional sending account** (Postmark / SES / Resend) + sending domain. Still the only
   thing between us and real email; `log` covers everything until it exists.
4. **The twelve badge artworks** (UNI-013 slice 4). Degrades rather than blocks.
5. **A Paddle account (D7)**, still between coaching and revenue.

**Carried and open:** GitHub Pages still unattached (`has_pages: false` as of 08-17); the F4
packaged-install scope call (UNI-012); UNI-006's three calls, UNI-005's two, UNI-004's *"responding
to an RFP requires clearing D8's bar"*, UNI-003's change to UNI-002's catalogue.

---

# Gates

**`nodegx-community`:** HEAD **`cdc7b17`**, clean, `main` == `origin/main`. **Measured on that
tree, this session:** vitest **692 / 692 across 24 files, zero failures, zero skips**; `tsc` clean;
`next build` clean at **24 routes**; `check:css` clean over **971 declarations / 19 components**.
🔴 **Re-measure; never quote a handover's number.** The floor this replaced was 579 / 22.

**This checkout:** phase-67's work is `eeb64051` + `bf7dcbba` on `cline-dev`. 🔴 **Do NOT read
those as HEAD** — this checkout is shared and peers commit to it constantly (`7947d193` landed
within the hour). `tests-unit/uni-015` **39/39**. ⚠️ **No `test:main`, no `test:ci`, no `tsc` run
this session** — the editor change is one JSON file and one new spec directory, and nothing else in
the editor was touched, so the suites were not re-measured and **this session's evidence says
nothing about the editor's overall state**. 🔴 **Do not quote session 23's numbers as current
either.**

⚠️ **`npm run lint` is still not a gate on the platform** — the script exists, there is no ESLint
config, and running it starts Next's interactive setup.

---

# Standing constraints

- Editor work on `cline-dev`. 🔴 **Never `git stash`** — ⚠️ **there is a stash that is not yours**
  (`stash@{0}`, WIP on `ff74bcc9`). Leave it alone. ✅ **`git commit <pathspecs>`, never stage
  broadly.** ⚠️ Untracked files need `git add` — put add and commit in **one chain**.
  ⚠️ **Peers had uncommitted work in phase-50, phase-65, phase-66, phase-68 and
  `scripts/library/check.ts` all session; it was left untouched.**
- 🔴 **`cd` does not persist between tool calls** — except it DOES persist in this harness's Bash
  tool. ⚠️ A failed `cd` in a chain leaves you where the last successful one put you.
- ✅ **`npm --prefix packages/noodl-editor run test:main -- <path>`** — jest from the repo root
  silently picks the wrong config.
- 🔴 **Port 55432 for the platform's Postgres, never 5432.**
- 🔴 **BSD `xargs` has no `-r`** — `lsof -ti :p | xargs -r kill` errors out and the rest of the
  chain silently does not run. Cost one lost suite run.

---

# Things the next person will otherwise re-derive

**The platform repo:**

- 🔴 **Never generate DDL from `src/db/schema.ts`.** It is a query mirror; rulings live in
  `src/db/sql/`. ⚠️ **But the drift spec compares COLUMNS**, so a generated column must still be
  declared in the mirror — with a comment saying it must never be written.
- 🔴 **A GENERATED column is the strongest form of "derived, not typed"**: `insert` and `update`
  are both refused, and **their error messages DIFFER** (*"cannot insert a non-DEFAULT value"* vs
  *"can only be updated to DEFAULT"*). Match them separately; one loose alternation matches far
  too much.
- 🔴 **`board_actor_is_eligible()` is where D15 and D8's ban live**, in the database. The bench
  calls it from a trigger on both tables. ⚠️ **Both tables** — a probe that only exercises the
  parent proves nothing about the child, and UNI-005's census caught exactly that.
- 🔴 **UNI-005's census classes are not interchangeable.** `machine-derived` means *a minor CAN
  write here*; `minor-refused` means they cannot. Claiming the former where the latter holds
  claims a **weaker** guarantee, and the census catches it by demanding a probe the class cannot
  supply.
- 🔴 **A route handler is outside every module sweep.** `tests/uni011-mirror-api.test.ts` reads
  routes **off disk**, and now handles **dynamic segments**: a recipe declares its `params`, and a
  real thread is seeded so the "gate opens" half of the assertion can be true. ⚠️ **A dynamic
  route imported via `pathToFileURL` fails** — it percent-encodes `[` and `]`. Decode those two.
- 🔴 **Drive routes over real HTTP** for anything a criterion says is driven — `npx next start -p
  <port>`, and read the two traps above about killing it.
- 🔴 **`points_ledger.id` is a `bigserial`** — the one non-uuid key in the schema.
- ⚠️ **Nulls are DISTINCT in a Postgres unique constraint** — use two partial unique indexes.
- 🔴 **`created_at` is not an ordering key**; `bench_threads.seq` / `bench_posts.seq` are.
- 🔴 **postgres.js has no nested `begin`** — a function that opens its own transaction cannot be
  composed. ✅ **It DOES have `tx.savepoint()`**, which is how `contribution.ts` was fixed.
- ⚠️ **`expect(value, message)` is vitest, not jest.**
- ✅ **Node 22 strips types natively** — `node --experimental-strip-types script.ts` imports a
  `.ts` directly, which is how the corpus is generated. ⚠️ Extensionless imports still fail; a
  scratchpad file still cannot resolve the repo's `node_modules` (put it in the repo root).

**Both:**

- 🔴 **`/usr/bin/grep -a`, always.** Plain `grep` here is ugrep and silently skips `.ts` as binary.
- 🔴 **The corpus contract:** `postbody-corpus.json` is **byte-identical** in both checkouts and
  **both** specs pin the same sha256 (`d59d6095…`). To change it: regenerate with
  `scripts/gen-postbody-corpus.mjs` in the platform repo, copy it here, and update **both**
  constants in the same commit. ⚠️ It catches **divergence**, not a bug in both parsers — the
  safety property is asserted separately in each repo.
- 🔴 **A corpus of only hostile payloads witnesses only the refusals.** Two parsers can agree
  perfectly about what to REJECT and disagree about everything they accept, which is all a reader
  sees. 15 hostile + 20 grammar.
- 🔴 **`forEachNode` STOPS on a truthy return.** Use a block body.
- 🔴 **The `lesson` MCP group is DEFERRED** — `find_tools({group:"lesson"})` first.
- `suggestedNodes` is still **dead** — no callers.
