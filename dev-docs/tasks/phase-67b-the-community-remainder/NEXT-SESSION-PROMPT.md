# Phase 67b — next session

**Written 2026-08-20 (session 48), replacing session 47's.** Platform repo:
`~/vscode_projects/nodegx-community`. Task ledger:
`dev-docs/tasks/phase-67b-the-community-remainder/README.md` — the phase has **no per-task files**;
its work items are the `UNI-0xx` files in `phase-67-nodegx-university/`.

⚠️ **Check for live peers yourself — that is a per-session fact, not this file's to assert.**
Session 48 had two OpenNoodl peers live: one on **phase 73 / TUT-003**, holding the editor stack and
**CDP 9222 for the entire session**, and one on **phase 72 NAT-007**, who **committed and cleared**
partway through. Session 48 touched none of phase 72's files after that.

---

## 1. ✅ UNI-007 AC1's EDITOR HALF IS BUILT — `0912694f`

Session 47 named this the top item for an agent alone: *"the platform end is complete and has no
caller."* It has one now. **49 specs**, `tsc -p packages/noodl-editor` clean, `test:main`
**289 suites / 4710 tests / 0 failures**, and driven over **real HTTP** against `next dev` on its own
database. Full write-up in
**[UNI-007](../phase-67-nodegx-university/UNI-007-THE-LESSON-BEAMED-INTO-THE-EDITOR.md)** — the block
beginning *"AC1's EDITOR HALF IS BUILT"*.

What shipped: four `/api/v1/me` client calls + payload types (`communityapi.ts`), the view model
(`models/community/learnerpathview.ts`), the caller (`hooks/useLearnerPath.ts`), and the section
above the installed-lessons grid on the Learning tab (`LearnerPathSection/` + `views/Learning.tsx`
+ `ProjectsPage.tsx`).

### 🔴 Four things worth not re-deriving

1. **Building the caller found two defects in the shipped client, and they are one defect twice.**
   `Read<T>` had no `unauthenticated` (a 401 read as *"could not reach the community"*), and
   `post()` let `409` fall through to the same place. **Every status the platform deliberately
   chooses needs a home in the mapping table, and a status with no home defaults to the one outcome
   that blames the network.** ⚠️ The sharp part: `Write<T>` has had `unauthenticated` since
   2026-08-16 and its doc comment argues the distinction *at length*. **A distinction argued for one
   half of a client is not thereby made in the other half** — and the comment reads as though it
   were, which is why four days of reading that file never found it. 🔴 **`409` is not only mine:
   API.md §6 gives NAT-009's RFP response cap the same status**, so that write would have inherited
   it.
2. **The first real-HTTP drive reported two consequences green and both were VACUOUS.** With no
   `ANTHROPIC_API_KEY` the individual arm answered `unavailable`, so *"the D10 arms differ"* was
   satisfied by `refused ≠ unavailable` **while nothing had projected at all** — and an
   `|| kind === 'unavailable'` escape hatch **I had written myself** carried the `fresh` assertion.
   Re-run against a **counting fake projector** (temporary patch to `projection/anthropic.ts`,
   reverted; the platform tree is clean). ✅ *A control pair whose arms differ for a reason that is
   not the one you varied has measured nothing.*
3. **UNI-001 AC4's `session-readers.test.ts` fired the moment the hook landed, and it was right to.**
   The cheap answer — *"it is a new surface, so it took nothing away"* — is true and **is not
   enough**: it would license any new surface to be account-only and *"the login gates nothing"*
   would decay into *"gates nothing that existed on 2026-08-14."* The answer that counts is that
   **the part of the surface that can work without an account does** (`GET /me/intake` takes no
   token, so a signed-out editor draws the real questions). Registered with a control pair.
4. **`this jest CAN grade React` paid off again.** `tests-unit/support/renderElements.ts` graded the
   component with 17 assertions and 4 mutations, with no DOM. 🔴 The one that matters: the `truth`
   sentence must be drawn **ABOVE** the steps — moving it below the `<ol>` keeps it present and
   reddens **only** the ordering assertion.

### ✅ AND IT WAS DRIVEN — the stack came free late, and the drive found two more defects

**Both are the shape only a running app shows: a control that appears connected to nothing.**

1. **There was no sign-in door.** Signed out, the section drew the three real questions and no way
   to sign in — `ProjectsPage` never passed `onSignIn`. ⚠️ **The render spec asserts BOTH branches
   of that prop and both passed**, because neither can see which branch production takes. *Covering
   both branches of an optional prop says nothing about whether the host supplies one.*
2. **A failed submit changed the screen in no way whatever** — found *by verifying fix 1*.
   `onSubmit` returned early on any non-`ok` write, so "Rebuild my path" against a rate limit or an
   expired session left the form untouched: no message, no spinner, no state, indistinguishable
   from a broken build. Every spec passed because every one fed the view a successful world.

Both fixed and verified live — `4cea617b`. E1–E4, E6, E7 all ✅ in the running launcher (`truth` at
`y=120`, first step at `y=183`; 13 steps; the platform's own option labels with no token).

### 🔴 ONE THING FOR THE PLATFORM LANE — a `next dev` 500, trigger NOT identified

`POST /api/v1/me/intake` began answering **500** from `recordIntake`'s `sql.json`
(`ERR_INVALID_ARG_TYPE`). ✅ **Measured, not assumed:** it reproduces with plain **`curl`** (so it
is not the editor), it does **not** happen on a cold server (three cold boots, `200` each — one of
them loading `/me/path` first), and the route demonstrably works (the earlier real-HTTP drive
submitted two intakes and read back 11- and 13-step paths). 🔴 **I did not find the trigger**, and
it cost the one consequence I could not reach — the omissions block in the running editor.
**Worth an hour before anyone builds a second writer against that route.**

## 2. Gate readings — 2026-08-20, session 48

| Gate | Reading |
|---|---|
| `npx tsc -p packages/noodl-editor --noEmit` | ✅ **0 errors**, no pipe. (Session 47's 2 errors were the phase-72 peer's; they fixed both) |
| `npm run test:main` | ✅ **289 suites / 4714 tests / 0 failures** (re-run after the drive fixes) |
| `npx tsc -p packages/noodl-core-ui --noEmit` | ⚠️ **44 errors, ALL pre-existing `TS2307`** path-alias failures — it needs `npm run build:types` first (`pretypecheck`). **None name my files**; I ran `tsc` directly and skipped the prebuild |
| Real-HTTP drive | ✅ 12 consequences, own database — see UNI-007 |
| **Editor drive** | ✅ **RUN** — found 2 defects, both fixed (`4cea617b`). E5 unreached, see the 500 above |
| `test:ci` | ❌ **NOT RUN.** A peer's editor stack was live the whole session |
| `nodegx-community` | ⚠️ **Read-only this session; tree left clean.** Session 43's readings stand |

⚠️ **`test:ci` was not run and nothing here substitutes for it.** My 49 specs are jest (`test:main`).
The floor to compare against is session 46's relayed **2849 / 10 @ seed 39393** — 🔴 **re-measure, do
not quote it.**

## 3. What to do next

### An agent alone

1. **The `next dev` 500 above** — the one open thread on AC1, and it blocks nothing until a second
   writer targets that route. ⚠️ Also still unreached: the **omissions block in the running
   editor** (E5), which is what the 500 cost.
2. **UNI-007 §11 — curriculum hosting.** 🔴 **The wall is now VISIBLE IN THE EDITOR**: the section
   draws a real, personalised, ordered path (11 steps for a visual learner, 13 for a code one) to
   **nothing installable**, because all fifteen lessons are `in-writing`. The surface is honest
   about it by construction — but honest about a product that cannot yet be used. This is the real
   blocker on *"a stranger learns NodeGX"* and it is §11's, still open since 2026-07-25.
3. **`test:ci`.** Not run for two sessions now. Run it **alone**, check `vm.swapusage`, and prove
   completion from the summary line and the log mtime — never from `$?`.

### Needs Richard

4. **The fifteen unwritten lessons.** D17 ruled hosting on 2026-08-16; the lessons are the wall, and
   item 2 above is now the editor showing that wall to a learner. Not an agent's to scope alone.
5. **UNI-008** — scope and build are ours; the **domain, the DPA and the go-live are not**.
   Unchanged from sessions 45, 46 and 47.
6. **Phase 70's scoping** — still unscoped, and **11/12 of its files are still untracked** (only
   `EL-009…md` was ever committed). Unchanged from session 47.

### 🔴 The deploy warning is UNCHANGED and still applies

nexus-1 is at **`0cbd716`**. Everything since — NAT-014's mail drain, E7, NAT-006's read API,
UNI-006's bridge, UNI-007's AC1 **and now its editor caller** — is undeployed. **The next deploy
installs phase 72's mail timer, and the first drain will refuse because the outbox backlog is older
than `MAIL_DRAIN_MAX_AGE_DAYS` (7). That refusal is the guard working — do not route around it.**
Releasing weeks-old mail is Richard's decision. ✅ **Deploy from a pristine clone of a named
commit**: `git clone` to `/tmp`, `git checkout main` (the **branch**, not the bare sha, or the stamp
records `branch: HEAD`), run `ops/deploy.sh` there. ⚠️ A deploy now also needs `ANTHROPIC_API_KEY`,
or tier-1 projection answers `unavailable` on every request — **measured directly this session**,
not inferred.

⚠️ Isolated databases `nodegx_community_s42`, `s43`, `s45`, `s46` and now **`s48`** exist on the
55432 container. `s48` is deliberately kept for item 1's drive; the rest are tidy-up.

⚠️ Two **headless Chrome** processes orphaned since 2026-08-19 (PPID 1, `23135` and `46145`) — still
there, still nobody's. Session 48 also saw a stray `render-from-disk.js` on **port 8901** (PPID 1,
from session `17a9d5f0`'s scratchpad). None are the render harness's; it cleans up after itself.

### ⚠️ Housekeeping for whoever ends the next session

**`MEMORY.md` is over its own budget: 17,838 UTF-16 units against 17,510.** Session 48 did not cause
it — my net footprint was **−23** (I tightened two of my own lines; my new entries went into
`judgement-trap-pointers.md`, which costs the index nothing). It grew from **17,501 → 17,861** while
I worked, i.e. concurrent peer edits. 🔴 **I did not cut a peer's line**, because the standing rule
is *tighten your own first, cut a peer's only when it stopped being TRUE*, and I cannot establish
that for another phase's live status lines from here. The P72 line in particular looks stale now
that NAT-007's flagship closed (`3880752f`) — **that is phase 72's to re-measure, not mine to
guess.** ⚠️ Measure with `len(s.encode('utf-16-le'))//2`, never `wc -c` (overstates ~15%).

### Not this phase's

Gap A (the mail drainer) is **P72 NAT-014**, built and committed, **not deployed**. UNI-018 is
**NAT-015**; UNI-011's rail icon is **NAT-012 AC7**. Settled 2026-08-19, do not re-litigate.
