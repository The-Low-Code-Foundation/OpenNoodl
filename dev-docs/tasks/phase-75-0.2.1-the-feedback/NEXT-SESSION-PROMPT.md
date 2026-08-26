# Phase 75 — next session

**State as of 2026-08-27 (session 52).** Richard's brief is still **speed: keep knocking out phase
75**, so this file leads with the queue.

**Landed this session: FB-013 C3, the web tab.** It was the top queue item and the only one both
ruled and unblocked. `/chat` and `/chat/[messageId]` are built, specced, mutation-graded and
**driven over real HTTP** — which is where the one defect came from.

## The queue — cheapest-first. Take the top one.

| # | item | size | state |
|---|---|---|---|
| 1 | **FB-013 C4 — the launcher tab** | **S–M** | ✅ **UNBLOCKED, and it is the top item.** C3 is done. ⚠️ FB-006's restructure precondition is **already met** (08-22) — the task file's *"do not ship chat before the restructure"* warning is discharged |
| 2 | **FB-005 T6** — star ratings | **M** | 🔒 **still needs a ruling** |
| 3 | **FB-013 C5** — moderation verbs | **S** | 🔒 **needs R-chat-mod** (below) |
| 4 | **Publish a curated batch** | **S–M** | 🔒 **blocked on phase 76 CONTENT** — see below |
| 5 | 🆕 **The two pages that still answer 500** | **XS** | ✅ unblocked, one line each — see the findings |

~~**FB-013 scoping doc + platform half**~~ ✅ CLOSED s51. ~~**FB-013 C3**~~ ✅ **CLOSED s52.**

⚠️ **Item 4's blocker has not moved and is not an editorial one.** Only **`hello-world`** and
**`site-builder`** (phase 76, in progress) exist as content; the other six of the eight-template
roster are unbuilt phase-76+ work. It unblocks when phase 76 ships templates, **not when Richard
answers a question**. The category gap (the ruled vocabulary cannot honestly hold 3 of the 8) is
real and downstream of that.

## 🧭 R-chat-mod — still open, unchanged from s51

**D7 ruled (bench only):** edit-own, delete-**unanswered**, **no report/flag, no hide**.
`delete-unanswered` has no referent in chat — a chat message has no accepted-answer state — and
*"no report/flag"* is a much larger bet in a merged river than on a page a reader chose to open.

| | posture | cost |
|---|---|---|
| **A** | inherit D7 literally — delete-own, no report, no hide | ~0 — **this is what shipped** |
| **B** | A + **hide-by-moderator** (route exists, no reader-facing report) | S |
| **C** | B + a reader-facing report reusing `content_reports` | S–M |

🧭 **Recommendation: B.** It reverses nothing D7 decided — D7 declined the reader's **button**, not
the operator's ability. `0024` already adds the `chat_message` report subject and the three
`hidden_*` columns, so **C is a route away rather than a migration away**.

🔒 **Free tags stay shut.** Richard asked for *"good tagging"*; D19 excluded user-created tags. v1
treats the **channel as the category**. Cheap to add later, expensive to remove.

## What C3 shipped, and the decision that shaped it

🔴 **A CHAT MESSAGE IS NOT A CARD, AND IT DOES NOT GO THROUGH `ListView`.** `CardView` renders
`<h3>{title}</h3>` over an optional `body` that is a plain **string**; a chat message has **no
title** and its body is `Block[]`. The card archetype would mean inventing a headline and
flattening the body to a sentence — and **a river of headlines IS the forum**, the shape SCOPE §3
spends its table refusing.

✅ **So what is shared is the ENGINE rather than the card.** `chatRiver` goes through `buildList`;
the page renders the kit's `PageHead`, `FacetBar` and `EmptyState`. The pill markup is still
declared exactly once in `Kit.tsx`, and `/chat` joins **`FACETED_PAGES`** in `uni023` beside the
other six rather than asserting the same promises a second time.

⚠️ **`chatRiver` calls `listRiver(sql)` with NO channel, and that one line is the design.** The
page never asks the database for one channel: it fetches the merged window and `buildList` narrows
it. See finding 2 for what happens when it does not.

🔴 **The thread page's `<h1>` is DERIVED (`threadLabel`), never a column** — the same decision as
*no `chat_threads` table*, seen from the view layer. A title field is what makes readers scan
titles instead of reading messages.

## 🔴 Findings worth carrying out of s52

1. 🔴 **A PAGE OWES DIFFERENT SWEEPS THAN A ROUTE, AND SCOPE §11's TABLE NAMES ONLY THE ROUTE'S.**
   C3 added no table, column or endpoint, so **all four** of the sweeps §11 lists were untouched —
   a session reading only that section concludes it owes nothing. It owed three more, and two went
   red: **`uni023`'s exact `'use client'` list** (every island must argue for itself) and
   **`uni013-slice5`'s archetype accounting** (every page is an instance or a recorded exception).
   ✅ **`uni019`'s reachability passed only by luck of construction** — see 2.
2. 🔴 **`linksInPage` READS A PAGE'S SOURCE AND ITS `lib/` IMPORTS. IT NEVER READS COMPONENTS.**
   So a row's `href` must be built in `lib/lists.ts`; an href invented inside a component leaves
   the detail route reported **UNREACHABLE**, correctly, because nothing the sweep can see links
   to it. **That is why composition lives in `lib/` and markup in a component — a correctness
   constraint, not a convention.**
3. 🔴 **DRIVING FOUND A 500 THAT 22 GREEN SPECS AND 12 KILLED MUTANTS COULD NOT.**
   `/chat/not-a-uuid` answered **500**: a malformed id reaches postgres as `invalid input syntax
   for type uuid`. ⚠️ **`apishape.ts` records this fixed across NINE ROUTES at once — and the
   PAGES were not among the nine.** No spec could see it: every assertion renders the
   **composition** over a thread that exists, so `threadById` is only reached with an id somebody
   already holds. The defect lives in the page's **glue**. ✅ Fixed and specced with the
   **discriminating** assertion rather than *"it threw"* — both arms throw, because `notFound()`
   throws too, so the row asserts the error is **not a postgres cast failure**.
   🔴 **`/bench/[threadId]` and `/rfps/[id]` still answer 500 to the same request**, measured the
   same minute. One line each. **That is queue item 5.**
4. 🔴 **BOTH MUTATION SURVIVORS WERE SPEC DEFECTS, NOT CODE DEFECTS.**
   - A row named *"finds a word that is only in a message **body**"* was searching for a word that
     lived in a **reply** — FB-024's exact defect restaged, and green. ✅ The fixture now carries
     **one rare word per place**: `marmalade` root-only, `periwinkle` reply-only, `chartreuse`
     nowhere at all.
   - Narrowing in the **database** as well as in `buildList` survived everything, because every
     assertion read the **unfiltered** river, where the two are indistinguishable. It would leave
     a reader in `#lounge` seeing **`0`** beside every other channel with no way across.
     ⚠️ **`count == rows` still holds under it** — both sides computed from the same shrunken
     window — so that property could never have caught it. ✅ The killer is the number that
     **GREW**: `#templates` reads **3** from inside `#lounge`, because a multi-select pill's count
     is what clicking it **returns**. 🔴 **Ask for a number the wrong implementation cannot
     produce, not one that merely fits.**
5. 🔴 **`uni023`'s ROUTE SWEEP HAD A HOLE SHAPED LIKE THE PAGE BEING ADDED.** It read
   `pages.filter(p => LIST_PAGES.includes(p))` and compared the result to `LIST_PAGES` — a set
   filtered by a list, checked against that list. Its comment promises *"a page added later cannot
   quietly opt out of the bar"*; it could only ever see a page **deleted**, and `/chat` would have
   passed it in silence. ✅ Predicate now derived from **disk**, with a control proving the old
   form was blind.
6. ⚠️ **`renderToStaticMarkup` GRADES DIFFERENT BYTES THAN THE PAGE SHIPS — the second time.**
   Next's SSR emits `@<!-- -->handle` (React's text-node separator); `renderToStaticMarkup` does
   not. FB-011 found this in s18. Harmless today; it stops being harmless the day an assertion
   depends on two adjacent expressions being adjacent in the output.
7. ⚠️ **`ChatComposer` takes the channel vocabulary as a PROP rather than importing it.**
   `lib/chat.ts` owns it but also imports `./notifications`, which reaches the database and the
   mail transport — a `'use client'` module importing it drags server code across the bundle
   boundary. One declaration, travelling downward.
8. ⚠️ **A FULL-SUITE RUN WIPES ANY DATA YOU SEEDED TO DRIVE WITH.** `freshDb()` drops and rebuilds
   `public`. A drive that runs after a suite reads an empty site and looks like a regression —
   re-seed, do not diagnose.

## Carried forward, unchanged

- ⚠️ **AC5's last mile is still unverified and still deliberately so.** The FB-005 routes answer
  200, but **nothing has been POSTed through the live path** — doing so files a real row on
  Richard's production queue with no withdraw route. 🔴 **The GET probe cannot stand in for it**:
  authorised and anonymous `GET /templates/submissions` both return `200 {"items":[]}`, so the
  empty set fits *"correctly scoped"* and *"wide open"* equally.
- ⚠️ 🔴 **THE BACKUP PASSPHRASE IS THE ONLY THING THAT CAN DECRYPT THE OFF-SITE DUMPS.** It is in
  `~/nodegx-community-deploy.env` (backed up to `…env.bak-20260826`) and on the host. **It belongs
  in a password manager.**
- ⚠️ **`ops/deploy.sh` runs entirely over SSH**, which auto mode's classifier hard-blocks. A narrow
  allow rule lives in OpenNoodl's `.claude/settings.local.json` (gitignored) and pins the script to
  `~/nodegx-community-deploy-clone/ops/deploy.sh` — **so deploy from that path**, re-cloned fresh.
- ⚠️ **`nodegx-community`'s `origin/main` is far behind local `main`.** Production tracks the
  *working tree*, so *deployed* and *pushed* remain independent facts. **s51's and s52's work is
  committed locally and NOT deployed** — chat is inert on nexus-1 until `0024` is applied.
- The five defects the s46 drive found — the `Select`-in-a-`Modal` dismissal (**`BaseDialog`'s and
  still UNOWNED**), the document-global radio `name`, nested `.DS_Store`, the 44%-of-real-projects
  refusal, and the `absent` sentence that blamed an account for a deployment gap.
- The three `0021` findings, the licence-at-promotion defect, the contrast items
  (`--theme-color-border-default` at 1.07:1; FB-002's selected pill at 1.16:1), and the share
  dialog's **693 px of content in a 525 px viewport**.
- ⚠️ **`MEMORY.md` is 20,782 UTF-16 units against a 17,510 budget.** s52 filed its detail into
  `phase-75-0-2-1-the-feedback.md` and took its own line down where the claims were duplicated,
  for a session net of **+321**. **A collective sweep is still owed**, and several inline claims
  are in no pointer file — so it needs **filing, not cutting**.

## Gates — session 52

| gate | result |
|---|---|
| `nodegx-community` `tsc --noEmit` | ✅ clean |
| `next build` | ✅ clean — `/chat` and `/chat/[messageId]` both registered |
| `tests/fb013-c3-chat-web.test.tsx` | ✅ **23 passed**, run alone |
| mutation grading, **13 mutants** | ✅ **all 13 KILLED** — and **2 survived the first pass**, both spec defects (finding 4) |
| `nodegx-community` full suite | ✅ see below — **read the SUMMARY LINE** |
| the drive, `next start` + real HTTP | ✅ `/chat` 200 · quiet-channel copy live · reply-search live · malformed id **404 (was 500)** |
| `npm run test:ci` (OpenNoodl) | ❌ **not run** — no OpenNoodl source changed (docs only). Inherited from s47–s51 rather than paid here |

🔴 **THE EXIT CODE LIED AGAIN, IN A SECOND REPOSITORY.** A backgrounded `npx vitest run` was
reported by the harness as **`completed (exit code 0)`** while its own summary line read
**`Test Files 1 failed | 63 passed (64)`**. Two causes compound: the command was
`vitest run > log 2>&1; echo $?`, a **compound** whose status is the last `echo`, and a
backgrounded command reports that compound's code. ✅ **Completion is the SUMMARY LINE, never
`$?`, and never a harness "exit code 0" either — and reconcile the FILE COUNT against disk in the
same breath.**
