# Next session — phase 75

_Written 2026-08-28 at the end of session 59. Session 58 handed over a phase where everything was
blocked on Richard. **Richard cleared all four blockers at the top of this session**, so this file
is mostly about what that unlocked and what is still standing._

## What happened

**Two commits on `cline-dev`** (`ad642433`, `bcd59bed`), **one on `nodegx-community` `main`**
(`2bce720`), and **chat is deployed to production**.

## Start here

⬜ **THE ONE THING THAT IS READY AND UNFINISHED: deploy C5 and drive it.** The hide route is built,
specced and committed, and **`NODEGX_MODERATORS` is unset on nexus-1** — so today the route 404s
for *everybody*, Richard included. It needs his handle in `~/nodegx-community-deploy.env`, a
deploy, and then the hide driven against production. **The verb has never run outside a spec.**

🧭 **Two of Richard's four are still his**, and neither is code:
- **Content for FB-005 / FB-009 / FB-012** — templates, syllabus lessons, the tutorial batch. He
  selected these, which reads as intent to supply them rather than as work to invent.
- **`--theme-color-border-default`** — selected, **not started this session**. FB-005 T4 measured
  it at **1.07:1 dark / 1.15:1 light** against the panel, which makes an *unselected* card or pill
  boundary invisible. It reaches every surface in the editor, so it wants a session of its own.

🔒 **Free tags are still unruled.** §8 asked it in the same breath as R-chat-mod and **B did not
answer it**. v1 keeps the channel as the category by *default*, not by decision.

## ✅ R-chat-mod is ruled B, and C5 is built

**B = A + hide-by-moderator, no reader-facing report.** B's delete-own half was already shipped in
C2, so what was missing was the sanction verb and a way to authorise it.

🔴 **`accounts` has no role column, and C5 does not add one.** Ruled with Richard: the moderator set
is an **env allowlist** (`NODEGX_MODERATORS`). A column puts *who may sanction* into the table
anybody can create a row in, and needs a second mechanism to set it anyway.

🔴 **Read per call, never at module scope.** A `const` would freeze the set at import, so the first
spec file to run would decide the moderator set for the whole run — and the arms that happened to
pass would look deliberate.

🔴 **Unset or empty means NOBODY, and it has its own row.** `''.split(',')` is `['']`, so without
the length filter `includes('')` is true and an empty handle moderates the site — on every fresh
checkout, where the var is unset.

**21 specs, 4 mutants, all killed by name**: delete the route's `isModerator` line, delete the
empty-handle filter, delete the mandatory-reason refusal, delete `listRiver`'s `hidden_at` filter.

## 🔴 The findings worth more than the code

**1. The spec file had a hole shaped like the defect, and I nearly shipped it.** Every predicate row
and every verb row still passes on a build whose `PATCH` never calls `isModerator` at all — the
predicate is right in isolation, the verb hides correctly when called, and the sweep only checks
that the route *names* the verb. **The one property C5 has to have is that a stranger cannot hide
somebody else's message.** The route block is that assertion, and it asserts the message is **still
visible** after the 404, because a refusal that 404s and hides anyway passes a status-only check.

**2. An absence check reported the opposite result before it stripped comments.** Posture C is
guarded by *"nothing in the product calls `reportContent`"*. `chat.ts` and `bench.ts` both **discuss**
`upholdReport` in prose, and my first grep read those sentences as callers — I wrote a paragraph
declaring the moderation library unreachable before the caller list corrected me. **Strip comments,
exclude the defining file, and list the callers rather than counting them.**

**3. `origin/main..main` is the wrong population for "is it deployed".** s31 measured `acd4a9a..main`
empty and concluded nothing was waiting to ship — an ancestry check against **local** `main`, silent
about both `origin/main` and the box. Measured properly: **`origin/main` is 18 commits behind** while
the host was only **2** behind, and the two never had to agree because **`ops/deploy.sh` rsyncs the
working tree, not a commit**. The conclusion survived by luck.
🔴 **The push gap is real and unowned**: ~15,600 lines that are **live on production** exist only on
this laptop. ⬜ **Push `nodegx-community` `main`.**

**4. A stale index line cost nothing this time only because I checked.** P75's FIX-027 line read
`17 ⬜ · 19/20 ⬜` for three days after `f6d25d19` and `fada53fd` landed. **Third under-claiming line
in this phase** (FB-002 and FB-010 were the others). Corrected from the source, not the task file.

## The deploy, as measured

`ops/deploy.sh 49.12.102.195` — host stamped **`91d8b0c4ed4e`**, migration `0024_fb013_chat.sql`
applied over `already applied: 23`, all three neighbours **200 → 200**.

⚠️ **`0024` is not additive** — it rewrites enum columns on `content_reports`, `notifications` and
`notification_suppressions`. Before migrating, all three were read on the host and were **empty**,
beside a control that drew **5 accounts and 14 enum labels**: an empty result and a broken query are
the same bytes. `src/db/migrate.ts` wraps each migration in a transaction, so a bad cast would have
rolled back rather than half-applied.

✅ **Verified as a consequence, not from the deploy's own report**: `/api/v1/community/chat` answers
**200** with a real envelope and honours `?channel=lounge`; `/threads` still **200**; an invented
path still **404**, which is what makes the 200 a measurement.

## Also closed: the people directory's filter bar (`ad642433`)

The Bench and Chat both wrapped their pills in `role="group"` with an `aria-label` from the day they
were written; **People never did**, so a screen reader met two loose toggles announcing *"Available
for work, pressed"* with nothing saying what was being narrowed. ⚠️ **It announces less here than on
either sibling**, because these two pills AND together.

Every row in `filter-pill-state` could already see the pills render, the marker draw and the contrast
clear 3:1, and **none of them could see this**. Three rows added; both mutants — deleting the
attributes, and collapsing the three labels — produce **one named red with the other 21 rows still
running**, which is the `Tests: 0 total` trap session 58 recorded and this file is now clear of.

## Gates, as measured this session

- `tsc -p packages/noodl-editor`: **exit 0**, and **proven to reach the changed line by a planted
  error** (exit 2, naming `CommunityDirectoryView.tsx:122`). ⚠️ My first reading of this was wrong:
  `${PIPESTATUS[0]}` is bash, so `cmd | tail; echo $?` read **`tail`'s** status. Re-run to a file.
- `noodl-core-ui`: **28 / 527 / 0**, unchanged.
- Editor `test:main`: **358 suites / 5907 / 0** on tree `e78f35fb`. **This change is +3 tests, +0
  suites**, measured against the file at HEAD. ⚠️ I did **not** try to reconcile the rest of the
  movement from session 58's `358 / 5898` — that reading was taken on a different tree with a peer
  mid-edit. **Quote the tree.**
- `nodegx-community` `tsc --noEmit`: **exit 0**. Full suite: **64 files / 1603 passed / 8 skipped /
  0 failures**. ⚠️ **The "1277 specs" figure in TASKS.md is stale** — that was 08-22.
- `test:ci` **not run by this lane.** The only match for the community components under
  `packages/noodl-editor/tests/` is `index.bundle.js`, a **build artefact** — so no Electron spec
  names them and this change cannot appear in a peer's reds. That is why no peer was warned.

## Standing facts for this area

- 🔴 **Docker is not running, so `npm run db:up` fails.** The community suite was run against a
  **scratch database on the local 5432**: `createdb nodegx_c5_s59`, then
  `DATABASE_URL="postgres://richardosborne@localhost:5432/nodegx_c5_s59" npx vitest run`. **It is
  still there** and can be reused. The repo's own default is port **55432**, which is Docker's.
- ⚠️ **Four peer sessions were live.** No editor and no peer suite ran during this session's gates.
- ⚠️ **P76 asks that the local backend "sb015 site backend" (port 8588) be left alone.** Not touched.
- ⚠️ **Not mine and still uncommitted, leave them**: `packages/nodegx-export/*` (P18),
  `tests/cloud/sb017-*`, `tests-unit/sb-017/`, `registeradapters.ts` (P76), and
  `AskAboutNodeDialog.module.scss`, uncommitted since **08-20** and belonging to nobody in this lane.
