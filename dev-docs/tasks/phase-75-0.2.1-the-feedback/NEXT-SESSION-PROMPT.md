# Phase 75 — next session

**State as of 2026-08-26 (session 51).** Richard's brief is still **speed: keep knocking out phase
75**, so this file leads with the queue.

**Landed this session:** **FB-013 is scoped and half built.** Queue item 2 was the only item that
was both ruled and unblocked, so it was taken. `FB-013-SCOPE.md` discharges all three obligations
R-chat attached to the build, and **C1 (schema + lib) and C2 (routes) are done, specced and
mutation-graded**.

## 🔴 Read this before touching queue item 1 — its blocker is not what the queue said

s50 recorded item 1 as *"needs Richard: which templates, and the 3-of-8 category gap"*. Both halves
are true and **neither is the binding constraint**. Checked on disk this session:

| | |
|---|---|
| templates that exist as content | **`hello-world`** and **`site-builder`** (phase 76, in progress) |
| the other six on the roster | **not built** — they are phase 76+ work (storefront, membership hub, data dashboard, interactive fiction, shared pixel canvas, personal landing page) |

🔴 **So item 1 is blocked on CONTENT THAT DOES NOT EXIST YET, not on an editorial choice.** The
category gap is real and downstream of that. ⚠️ **The queue line was not wrong so much as
compressed** — *"which templates"* reads as though eight are sitting there waiting to be picked,
and a session taking the item at face value would go looking for them. **Item 1 unblocks when
phase 76 ships templates, not when Richard answers a question.**

## The queue — cheapest-first. Take the top one.

| # | item | size | state |
|---|---|---|---|
| 1 | **FB-013 C3 — the web tab** | **M** | ✅ **UNBLOCKED, and it is the top item.** C1/C2 are done; C3 is the river + facet bar + thread view + composer. Needs no ruling |
| 2 | **FB-013 C4 — the launcher tab** | **S–M** | ✅ unblocked after C3. ⚠️ FB-006's restructure precondition is **already met** (done 08-22) — the task file's *"do not ship chat before the restructure"* warning is discharged |
| 3 | **FB-005 T6** — star ratings | **M** | 🔒 **still needs a ruling** |
| 4 | **FB-013 C5** — moderation verbs | **S** | 🔒 **needs R-chat-mod** (below) |
| 5 | **Publish a curated batch** | **S–M** | 🔒 **blocked on phase 76 content**, per the section above |

~~**Deploy the platform half**~~ ✅ CLOSED s50. ~~**FB-013 scoping doc + platform half**~~ ✅ **CLOSED s51.**

## 🧭 R-chat-mod — the one decision this session opened, and R-chat required it be asked

R-chat's own words: *"D7 declined report/flag on the same day — chat is where that absence bites
hardest, so the scoping doc must raise the posture question rather than assume the bench's answer
transfers."* Raised, in `FB-013-SCOPE.md` §8:

**D7 ruled (bench only):** edit-own, delete-**unanswered**, **no report/flag, no hide**.

1. 🔴 **`delete-unanswered` has no referent in chat.** "Unanswered" is a property of a question with
   an accepted-answer state; a chat message has none — that is the *point* of chat in Richard's
   report (*"not committing to anything"*). A rule had to be **chosen**, not inherited.
2. 🔴 **"No report/flag" is a much larger bet here.** On the bench a bad post sits under a title, on
   a page a reader chose to open. In the merged river it sits at the top of the **default view of
   the whole feature**.

| | posture | cost |
|---|---|---|
| **A** | inherit D7 literally — delete-own, no report, no hide | ~0 — **this is what shipped** |
| **B** | A + **hide-by-moderator** (route exists, no reader-facing report) | S |
| **C** | B + a reader-facing report reusing `content_reports` | S–M |

🧭 **Recommendation: B.** Smallest posture that leaves the platform able to *act*, and it reverses
nothing D7 decided — D7 declined the reader's **button**, not the operator's ability. `0024` already
adds the `chat_message` report subject and the three `hidden_*` columns, so **C is a route away
rather than a migration away**.

🔒 **Same breath — free tags.** Richard asked for *"good tagging"*; D19 excluded user-created tags.
v1 treats the **channel as the category** and adds no tag table. Cheap to add later, expensive to
remove.

## What FB-013 shipped, and the one measurement that shaped it

### 🔴 The risk UNI-011 predicted is no longer a prediction

Measured off production this session, not relayed — `GET /api/v1/community/threads` and
`/community/home`:

| the live community | value |
|---|---|
| bench threads, all time | **2** |
| distinct authors | **1** (`richardosborne14` — both are ours, identical titles, test posts) |
| replies | **1** |
| D16 threshold | **2/30 threads · 0/3 consecutive weeks with a call · median first reply undefined, n=0** |

**The platform's own gate says the community has not started**, and the *weeks-with-a-call*
component — the one UNI-011 named as carrying the social half — is at zero.

⚠️ **This is stated, not argued.** Richard overruled a prediction and that was his to take; a
measurement arriving afterwards does not reopen it. What it does is **fix what the design has to
survive**, which is exactly what R-chat asked the scoping doc for.

### ✅ The answer is structural, not copy

🔴 **The default view is ONE MERGED RIVER across every channel. A channel is a FILTER, not a door.**
There is no per-channel screen to walk into and find empty — so **no screen in the feature has an
accidentally-reachable empty state**, and AC4 is restated as a property rather than a sentence. The
narrowing is `buildList`/`facets.ts`, the machinery the bench and shelf already use, so a quiet
channel is a `0` beside a pill. No presence, no typing indicators, no unread badge that counts to
zero — those are what make quiet feel dead.

### The build

- **`0024_fb013_chat.sql`** — `chat_channel` enum, `chat_messages`, two triggers, one new
  `report_subject_kind`, one new `notification_kind`.
- 🔴 **No `chat_threads` table.** The bench has one because a thread there carries a title and an
  accepted answer; a Slack thread carries neither, so parenthood is a nullable self-FK and a table
  would be a join with no column in it.
- 🔴 **One reply level and channel-inheritance are TRIGGERS**, which is what makes *"not forum level
  complexity"* a property of the data rather than a sentence in a doc.
- 🔴 **Four channels chosen for NON-OVERLAP with `bench_section`** (`lounge`, `templates`,
  `tutorials`, `collab`) — a chat `#showcase` beside a bench `showcase` is the second-vocabulary
  failure `0008`'s header exists to prevent. A spec checks it against the bench's **own exported
  list**, so widening `BENCH_SECTIONS` fails here too.
- 🔴 **`points_ledger` deliberately NOT reused** — awarding points for chatter is how a quiet room
  becomes a farmed one. Recorded in `0024`'s header so a later reader does not repair the
  "omission".
- **`src/lib/chat.ts`**, **`chat-http.ts`**, five routes, `postChat` capability, `FB013_CONSTRAINTS`.

## 🔴 Findings worth carrying out of s51

1. 🔴 **A NEW DYNAMIC ROUTE OWES FOUR SWEEPS, NOT THE THREE FB-005 RECORDED.**
   `nat006-api-contract` is the fourth, and **it found itself the right way round** — it went red
   with *"`/api/v1/community/chat/[messageId]` is dynamic and this file has no seeded id for it — a
   made-up id 404s, which would let a broken endpoint pass every assertion below."* ✅ **That is a
   sweep refusing to run rather than passing vacuously.** Write the next one this way: when a sweep
   cannot exercise something, the honest failure is *"I could not measure this"*, never silence.
2. 🔴 **`moderation.ts` typed its subject-id `coalesce` out BY HAND, TWICE — and a missing subject
   fails SILENTLY.** `coalesce` returns null, `openContentReports` reports a `subjectId` of null,
   and `upholdReport` runs `update chat_messages … where id is null`, which **updates nothing and
   throws nothing**. A moderator would see a report marked upheld beside a message still on screen
   — the exact outcome `upholdReport`'s own doc comment says its transaction exists to prevent. ✅
   Now derived from `SUBJECT_COLUMN`, one owner.
3. 🔴 **`db-schema-drift`'s table-count floor had LAPSED at 36 since UNI-014 while the mirror grew
   to 55.** Its own comment says a stale floor is the one failure the assertion exists to catch —
   and by this session the mirror could have lost **twenty tables wholesale** and it would still
   have passed. Raised to 56. ⚠️ **The convention is only a convention while somebody keeps it**;
   this is the low-side twin of the `test:ci` lesson already on file (*a stale-HIGH floor hides
   regressions*).
4. 🔴 **The house's own document refused the paging I first wrote.** `listRiver` originally paged in
   the database with a second `count(*)`; `apishape.ts` says in as many words *"the fix is keyset
   pagination in the query modules, shared by both callers — not a `count(*)` bolted on here"*,
   because `facets.ts` computes a pill's count from the same rows the pill returns. ✅ It would have
   been worse here than anywhere: SCOPE §2 makes the channel facet **the whole design**, so its
   count and its rows cannot come from two queries. **Read the module you are extending, not just
   the one you are copying.**
5. ⚠️ **A backtick inside a SQL comment inside a JS template literal terminates the literal.** Two
   `TS1005` errors 250 lines from the cause. Trivial, and it cost a cycle.
6. 🔴 **`bodyOptional`, not `maxBytes: 0`, is how a DELETE takes no body.** Zero bytes passes the
   size check and then `JSON.parse('')` throws, so every well-formed DELETE would have answered
   400 *"expected a JSON body"*. FB-001 added the flag for exactly this verb.
7. ⚠️ **I contaminated my own measurement and nearly read it as a result.** A standalone
   `nat006` run started while my full suite was still going produced
   `duplicate key value violates unique constraint "pg_type_typname_nsp_index"` and *"type
   badge_family does not exist"* — the known two-suites-on-one-database signature, not a finding.
   ✅ Killed my own tree **by PID**, never `pkill -f vitest`, and re-ran alone.

## Carried forward, unchanged

- ⚠️ **AC5's last mile is still unverified and still deliberately so.** The routes answer 200, but
  **nothing has been POSTed through the live path** — doing so files a real row on Richard's
  production queue with no withdraw route. 🔴 **The GET probe cannot stand in for it**: authorised
  and anonymous `GET /templates/submissions` both return `200 {"items":[]}`, so the empty set fits
  *"correctly scoped"* and *"wide open"* equally.
- ⚠️ 🔴 **THE BACKUP PASSPHRASE IS THE ONLY THING THAT CAN DECRYPT THE OFF-SITE DUMPS.** It is in
  `~/nodegx-community-deploy.env` (backed up to `…env.bak-20260826`) and on the host. **It belongs
  in a password manager.**
- ⚠️ **`ops/deploy.sh` runs entirely over SSH**, which auto mode's classifier hard-blocks. A narrow
  allow rule lives in OpenNoodl's `.claude/settings.local.json` (gitignored) and pins the script to
  `~/nodegx-community-deploy-clone/ops/deploy.sh` — **so deploy from that path**, re-cloned fresh.
- ⚠️ **`nodegx-community`'s `origin/main` is far behind local `main`.** Production tracks the
  *working tree*, so *deployed* and *pushed* remain independent facts. **s51's work is committed
  locally and NOT deployed** — chat is inert on nexus-1 until `0024` is applied.
- The five defects the s46 drive found — the `Select`-in-a-`Modal` dismissal (**`BaseDialog`'s and
  still UNOWNED**), the document-global radio `name`, nested `.DS_Store`, the 44%-of-real-projects
  refusal, and the `absent` sentence that blamed an account for a deployment gap.
- The three `0021` findings, the licence-at-promotion defect, the contrast items
  (`--theme-color-border-default` at 1.07:1; FB-002's selected pill at 1.16:1), and the share
  dialog's **693 px of content in a 525 px viewport**.
- ⚠️ **`MEMORY.md` is over its 17,510-unit budget** and growing across sessions. s51 added no index
  line and filed into existing memories instead. **A collective sweep is owed.**

## Gates — session 51

| gate | result |
|---|---|
| `nodegx-community` `tsc --noEmit` | ✅ clean |
| `tests/fb013-chat.test.ts` | ✅ **23 passed**, run alone |
| mutation grading, 7 mutants | ✅ **all 7 KILLED** — depth guard, channel-equality guard, search-ignores-the-root, search-stops-ORing, replyCount-ignores-hidden, delete-stops-checking-ownership, `refusing`-removed-from-`replyInThread` |
| `nodegx-community` full suite | ✅ **63 files, 1564 tests, 0 failures**, `VITEST_EXIT=0` — unpiped and **run alone**, so the exit code is the suite's own |
| committed | ✅ `c5be57b` on `nodegx-community` `main`. ⚠️ **NOT deployed** — chat is inert on nexus-1 until `0024` is applied |
| `npm run test:ci` (OpenNoodl) | ❌ **not run** — no OpenNoodl source changed this session (docs only); only meaningful **run alone on the machine**. Inherited from s47–s50 rather than paid here |

🔴 **Every reading here came from the SUMMARY LINE, never from `$?`** — `test:ci`'s exit code has
lied nine times on this project, and a suite piped to `tail` reports `tail`'s exit.
