# Phase 67 — next session prompt

Paste the block below into a fresh session.

---

Continue phase 67 (NodeGX Community), `dev-docs/tasks/phase-67-nodegx-university/`.

**Read first, in this order:** **[D19](RULINGS.md)** — it reverses a prior ruling and shapes the
whole back half. Then §"WHERE THE PHASE IS", then `TASKS.md`'s table, then your task file.

🔴 **Two repos.** Editor work is this checkout. Platform work is
`/Users/richardosborne/vscode_projects/nodegx-community` — a **sibling directory, never nested** —
pushing to `The-Low-Code-Foundation/nodegx-community`. None of this checkout's gates, peers or
traps apply there.

---

# ✅ D19's CONDITION IS DISCHARGED — UNI-014 is built and pushed

**`70d8acc`.** D19 was conditional on email landing first; it has landed. **UNI-015 is now
unblocked, and it is the next task.**

🔴 **The ruling is still not "build a forum"** — it is: **the unit of content is not a post, it is
a graph with a question attached.** The pitch artifact
**["Questions Made of Nodes"](https://claude.ai/code/artifact/7ac9fdff-757c-4cd0-8a94-879ba5fa1509)**
is the design. **Read it before writing markup** — UNI-013 lost a session building from prose when
the design was an artifact.

---

# WHERE THE PHASE IS — 2026-08-18 (session 26)

| Track | Tasks | State |
|---|---|---|
| **Platform** | UNI-001 (AC3), 002–006, 009 content cut, 011 slice 1, 013 s1–s3 | 🟢 pushed |
| **Platform** | **UNI-014 — the mail room** | ✅ **BUILT + PUSHED `70d8acc`. 5/5 ACs.** |
| **Platform** | **UNI-015 — the Bench** | 🔴 **NOT BUILT. Unblocked. START HERE.** ⚠️ **Must not ship alone** |
| **Platform + editor** | **UNI-016 — artifact posts** | 🔴 **NOT BUILT. The task D19 exists for.** Do it back-to-back with 015 |
| **Platform** | UNI-017 — the queue and the signal | 🔴 NOT BUILT. Needs a backlog first |
| **Editor** | UNI-018 — pull a graph | 🔴 NOT BUILT. 🔴 **Read its §"THE HAZARD" before scoping** |
| **Platform** | UNI-007 intake / personalised path | 🟡 Still the one platform piece nobody has looked at |
| **Platform** | **deployment** | 🔴 **Owned by NO TASK. The top ask.** |
| **Editor / MCP** | UNI-012 | ✅ Ruled, scoped, **NOT built. Buildable now** |
| **Platform** | UNI-013 slice 4 (12 badge SVGs) | 🔴 Richard's. Degrades rather than blocks |

## What session 26 did — UNI-014, built

**Platform `70d8acc`:** `0007_uni014_notifications.sql` (four tables + the delivery guard),
`src/lib/notifications.ts`, `src/lib/mail/transport.ts`, `/unsubscribe/[token]`, wiring into five
event modules, and `tests/uni014-notifications.test.ts`.

🔴 **Two things measured that the task file had wrong — both written up in
[UNI-014's file](UNI-014-THE-MAIL-ROOM.md), read it before touching notifications:**

1. **`outbound_emails` could NOT become the notification channel.** Its guard is an
   **unconditional per-row trigger that IS UNI-004 AC1's proof**, and it hard-requires a relay
   thread. Widening it converts a total guarantee into a skippable branch. The unification lives
   **one level up: one transport interface, two queues.**
2. **The assumption about which events needed email was backwards.** Every pre-existing
   notification-worthy event is relay-backed and **already mailed**; those write the row with
   `via: 'relay'` and queue nothing. **The events with no email path today are exactly the ones
   reaching org-minor accounts** — assignments, grading, project requests, badges.

✅ **Two live gaps found and fixed en route:** `declineBooking`/`cancelBooking` told **nobody**
anything; and the **runner's** grading is a second `submission_gradings` insert that
`gradeManually` readers miss.

---

# THE PLAN

## 🟢 LANE A — UNI-015 then UNI-016, back to back. **Start here.**

⚠️ **Do not ship UNI-015 alone.** Plain-text Q&A on our own stack is strictly worse than what we
chose not to buy. **UNI-016 is the reason to build.**

**The literal first move:** bring the sibling up (`npm run db:up && npm run db:seed`,
**port 55432**), **re-measure the floor before touching anything** — it is **579 specs / 22 files**
as of `70d8acc`; do not copy that number forward, re-run it.

🔴 **UNI-015 carries the Discourse decommission — 11 files inventoried by path in its file.**
`forum_threads` is a six-column stub that existed only so D16 had something to read: **drop it, do
not migrate it.** And **`{forum: 'absent'}` loses its referent — remove the branch, do not leave it
unreachable.**

🔴 **The three-copy trap is the sharpest reuse question in the tranche** — `parsePostBody` →
`Block[]` lives in the **editor** checkout. Ruled: platform-side canonical, plus a shared golden
corpus whose hash is asserted in *both* repos. This has bitten twice (`LessonEvidence`,
`renderMarkdown`).

✅ **Notifications are available now.** `notify()` takes a transaction and composes; add the forum
kinds to `notification_kind` **and** to `NOTIFICATION_RECIPES` — the census fails on either alone,
in both directions. New `src/lib/` exports need a verdict in `EVENT_VERDICTS`, and a `notifies`
verdict is **checked against the source**.

## 🟡 LANE B — UNI-012, UNI-007's intake

Both still buildable, both unaffected by D19. UNI-007's intake still wants its ten-minute question:
**does it need an issuer?**

## 🔴 LANE C — deployment: scope it, do not build it

Needs Richard's nexus-1 decision first, so **write the task file and stop.**

---

# ⚠️ FOR RICHARD — three asks, unchanged

1. 🔴 **Does the platform go on nexus-1?** Deployment is owned by no task. **A forum has to be
   somewhere.** ⚠️ **UNI-014 sharpened this**: `NOTIFICATION_LINK_SECRET` has a dev default, and a
   deployment that does not set it has forgeable unsubscribe links.
2. **The twelve badge artworks** (UNI-013 slice 4). Degrades rather than blocks.
3. **A Paddle account (D7)**, still between coaching and revenue.

**Small, none blocking a build:**

- **A transactional sending account** (Postmark / SES / Resend) + sending domain. ✅ **Now the only
  thing between us and real email** — `log` covers everything until it exists, and the real
  transport is one file implementing a three-line interface.
- **Where do capture images live?** UNI-016 turns `saveCaptureNextTo` into an upload —
  **it intersects ask 1**.
- ⚠️ **GitHub Pages still unattached** (`has_pages: false` as of 08-17). D17's v0.
- ⚠️ **The F4 packaged-install scope call** (UNI-012).
- **Carried and open:** UNI-006's three calls, UNI-005's two, UNI-004's *"responding to an RFP
  requires clearing D8's bar"*, UNI-003's change to UNI-002's catalogue.

---

# Gates

**`nodegx-community`:** HEAD **`70d8acc`**, clean, `main` == `origin/main`. Measured on that tree:
vitest **579 / 22 files**, `tsc` clean, `next build` clean at **21 → 22 routes**, `check:css` clean
over **775 declarations / 15 components**. 🔴 **Re-measure; never quote a handover's number.**

**This checkout:** ⚠️ nothing run in sessions 24, 25 or 26. Last measured is session 23's:
`tsc --noEmit -p tsconfig.tests-main` **31 errors** (pre-existing); no `test:main`; **no `test:ci`**.
🔴 **Do not quote these as current.**

⚠️ **`npm run lint` is still not a gate on the platform** — the script exists, there is no ESLint
config, and running it starts Next's interactive setup. **State which artefact you looked at.**

---

# Standing constraints

- Editor work on `cline-dev`. 🔴 **Never `git stash`** — ⚠️ **there is a stash that is not yours**
  (`stash@{0}`, WIP on `ff74bcc9`). Leave it alone. ✅ **`git commit <pathspecs>`, never stage.**
  ⚠️ Untracked files need `git add` — put add and commit in **one chain**, message in a file.
- 🔴 **`cd` does not persist between tool calls**, and a `cd` inside one does not leak out.
  ✅ **`npm --prefix packages/noodl-editor run test:main -- <path>`** — jest from the repo root
  silently picks the wrong config.
- 🔴 **Port 55432 for the platform's Postgres, never 5432.**
- 🔴 **This checkout is SHARED.** Peer messages for **blocking or hazardous** things only. Announce
  **source edits**, not just runs. ⚠️ Use explicit pathspecs, always.
- ✅ **Before launching the editor: `npm run dev:stop -- --list`**, and check nobody is mid-`test:ci`
  (`ps -Ao pid,ppid,args | grep -a run-electron-tests`). ⚠️ A peer was mid-run at session 26's start.

---

# Things the next person will otherwise re-derive

**The platform repo:**

- 🔴 **Never generate DDL from `src/db/schema.ts`.** It is a query mirror; rulings live in
  `src/db/sql/`.
- 🔴 **The schema drift spec checks tables and columns ONLY — including NOT enum names.**
  Non-vacuity floors: drift **36**, free-text census **92**, AC3 sweep exports 40, route sweep
  6 routes, token drift 390/36/84, built-CSS sweep 200.
- 🔴 **A route handler is outside every sweep this phase built** — they quantify over module
  exports. `tests/uni011-mirror-api.test.ts` reads routes **off disk**. 🆕 **So drive routes over
  real HTTP** — `npx next start -p <port>`, and **kill by port**: `pkill -f "next start"` matches
  nothing.
- 🆕 🔴 **`points_ledger.id` is a `bigserial` — the one non-uuid key in the schema.** A `uuid` FK
  to it is accepted by every reader and refused by Postgres at migration time.
- 🆕 ⚠️ **Nulls are DISTINCT in a Postgres unique constraint.** `unique (account_id, kind)` with a
  nullable `kind` lets rows accumulate and `on conflict` never fires — use **two partial unique
  indexes**.
- 🔴 **`created_at` is not an ordering key** — `submission_gradings.seq` is a `bigserial`.
- 🔴 **PostgreSQL does not guarantee short-circuit `or`**; reading `OLD` during an INSERT is a
  runtime error rather than a null.
- 🔴 **A backtick inside a SQL comment nested in a tagged template literal opens a new template**,
  and **a `*/` inside a JSDoc comment closes it early** — the syntax error surfaces forty lines
  later on an innocent template literal.
- 🔴 **postgres.js has no nested `begin`** — a function that opens its own transaction cannot be
  composed. Two entry points, `relayMessageIn`'s precedent. 🔴 **`gen_random_bytes` needs pgcrypto.**
- ⚠️ **`expect(value, message)` is vitest, not jest.**
- ⚠️ **`npx tsx --eval` cannot use top-level `await`**, and **a scratchpad `.mjs` cannot resolve the
  repo's `node_modules`** — put the file in the repo root.
- ✅ **Headless screenshots of both themes:** `--headless=new --blink-settings=preferredColorScheme=0|1`
  (`0` dark, `1` light). ⚠️ **Two identical output sizes means the flag did nothing OR the page is
  unstyled — `cmp` them and look at one before concluding.**

**Driving the editor** (all still true, all cost a session each):

- 🔴 **`BaseDialog`'s two copies sit at IDENTICAL coordinates.** Filter properly —
  `roots[i].closest('[class*=MeasuringContainer]')` must be **falsy**.
- 🔴 **When a control does not respond, drive something else on the same surface with a DIFFERENT
  mechanism first.** A failure shared by both is your instrument's.
- 🔴 **A CDP click into an `overflow: auto` list can hit a different row.** Verify with
  `document.elementFromPoint(...)` and `row.contains(hit)` **before** clicking.
- ⚠️ **A poll-driven React list replaces its DOM every tick.** Tag and click **in one shell chain**.
- 🔴 **`LocalProjectsModel.openProjectFromFolder()` does not route**, and a **reload returns you to
  the launcher**. Working path: open → reload → click the card → `switchToComponent`.
- 🔴 **`require('./src/...')` does not work in the renderer.** Push a fake chunk:
  `window.webpackChunknoodl_editor.push([['probe'],{},r=>{window.__wr=r}])`. Lost on every reload.
- 🔴 **`forEachNode` STOPS on a truthy return.** Use a **block body**.

**Both:**

- 🔴 **`/usr/bin/grep -a`, always.** Plain `grep` here is ugrep and silently skips `.ts` as binary.
  ⚠️ Quote your globs. 🆕 ⚠️ **BSD `sed` has no `\b`.**
- 🔴 **A literal NUL byte (or a stray U+FFFC) in a `.ts` makes git call it binary and grep skip it.**
- 🔴 **`ports`, not `dynamicports`, is how a `Component Inputs` node declares its interface.**
- 🔴 **The `lesson` MCP group is DEFERRED** — `find_tools({group:"lesson"})` first.
- 🔴 **A ruling names a PLACE; ruling it does not CHECK the place.** Derive from **disk**.
- `suggestedNodes` is still **dead** — no callers.
