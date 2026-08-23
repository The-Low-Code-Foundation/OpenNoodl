# Phase 75 — next session

**State as of 2026-08-23 (session 10).** Session 10 did **one** thing and it took the whole
session: it **drove FB-001 on both surfaces**. The verbs work. The drive also found a platform
defect that blocked it for most of the session and that is now **FB-023** — read that first,
because it is bigger than FB-001.

## What session 10 found

- ✅ **FB-001 — DRIVEN, BOTH SURFACES. The task is done.** Full tables in the task file.
  Web: the controls appear for the author and for nobody else (signed-out, non-author and
  somebody-else's-thread all draw **no `.post-controls` node at all**); Edit fetches the real
  **source**, saves, and the page comes back with the new body and an "edited" marker;
  Delete cancels cleanly, refuses an **answered** thread **in the server's own sentence**, and
  really removes an unanswered one (database: gone, **0 orphan posts**).
  Editor: the same three arms disagree the same way, and **the first editor bench WRITE ever
  driven** — composer pre-filled from source, saved, `updated_at` stamped; then Delete, thread
  gone, pane back to the list by itself. ⚠️ **NAT-012 AC4's other half is closed by this too.**
- 🔴 **FB-023 — THE PLATFORM STOPS BEING ABLE TO READ A DATE, AND SAYS IT IS YOUR POST'S FAULT.**
  New task file, **open, not fixed**. Once the panel has called `/api/v1/community/home`, the
  shared `apiSql()` pool reads `timestamptz` as a **string**. Thread reads **500 (13 of 20
  measured)**; and the write path does not crash — a perfectly good edit comes back
  **`400 "that could not be posted"`**. A 500 announces itself; this one **blames the user**,
  who would rewrite their text forever.
  - 🔴 **Why nothing caught it: the two immune populations are the two we always measure.** The
    web uses a fresh `createSql()` per request; the suite uses `freshDb()` + `resetApiSql()`.
    **Only the editor** mixes `/community/home` and `/bench/threads/:id` on one long-lived pool.
  - ✅ **The control that cracked it**: driving the **web page and the API route against the
    SAME thread**. Page 200, route 500, same row — which ruled out the data and named the pool.
  - ⚠️ **The mechanism is UNDER-CLAIMED in the file on purpose.** An early "connections born
    under drizzle" model was **disproved** by a `max=1` run. What is solid: drizzle on the shared
    pool is what does it, and giving drizzle its own pool clears **both** symptoms (measured,
    then reverted — the repo is clean).
- 🔴 **A DRIVE ARM READ CORRECT AND WAS VACUOUS, AND ONLY A LOAD SIGNAL CAUGHT IT.** The first
  pass read *"somebody else's thread → no Edit, no Delete — correct"*. The pane was actually on
  its **error arm**: no verbs because there was **no thread**. A failed read and a correctly
  verb-less post are **identical** in `hasEdit: false`. ✅ Every row of the editor table now
  carries a `loaded` column, and the rows mean nothing without it. Same family as session 8's
  `[data-panel-id]` lesson, one layer up: **ask what ELSE produces this reading.**
- ⚠️ **Found by driving, owned by nobody: the editor DELETES WITHOUT ASKING.** The web calls
  `window.confirm` first; `useCommunityThread.ts:373` fires the DELETE on click. D7 declined a
  soft delete, so the row really goes and takes its posts. Verb parity (D15) holds; **the
  safeguard is not mirrored**, and no spec could catch it — `editFor` grades which verbs are
  *offered*, never what happens between the click and the request. 🧭 **Richard's call.**
- ⚠️ **I nearly filed a harness artifact as a product bug.** The first 500 came right after I
  re-seeded *underneath a running server* — the documented stale-pool trap. Restarting "fixed"
  it, which **fitted** and would have closed the investigation; the next thread failed anyway.
  🔴 **A reading that FITS is not one that EXCLUDES** — the restart only ever tested thread A.

### FB-001's first move next session

**None — it is done.** What is left from this drive is **FB-023**, and the confirm-step ruling.

## First moves, in order

1. 🔴 **FB-023** — the defect above. It is live on every editor that opens the Community panel.
   Pick a fix (the file lists four; #1 and #2 are the real candidates) and note **AC3's trap**:
   a `freshDb()` spec **cannot reproduce this**, which is exactly why it survived. ⚠️ And AC2's
   arm — "not 500" would pass on the **400** that makes this worth fixing.
2. 🧭 **The confirm-step ruling** — does the editor's Delete grow a confirmation, or is the
   asymmetry with the web recorded as chosen?
3. **FB-019 implementation** — the sweep already revised AC1/AC2: keep the merge, fix only the
   no-stored-unit case, on **all three** registration paths. 🔴 **Drive an image-cropper pan
   first** — the six broken connections are predicted from source and nobody has watched one fail.
4. **Quick wins with no rulings**: FB-007, FB-010, FB-003 — the build-the-caller family.
5. **Still needing Richard**: FIX-026 (a)/(b), FIX-027 14/15/16 + 22, tsfixme baseline, prod
   `ANTHROPIC_API_KEY` (⚠️ intro pricing ends **2026-08-31** — eight days), the 15 lessons' prose,
   Discord's row in the `?` menu, `/rfps` search.

## How to drive the community platform (session 10's harness — reuse it)

- **Its own database**, so a suite run cannot wipe it and it cannot wipe a suite:
  `DATABASE_URL=postgres://nodegx:nodegx@localhost:55432/nodegx_community_fb001drive`.
  🔴 **Re-seed BEFORE starting the server, never underneath a running one** — dropping the schema
  under a live pool is the stale-OID trap and it reads as a product 500.
- `npm run build` then `npx next start -p 3200`.
- **The editor against it**: patch `window.fetch` in the renderer to rewrite
  `https://community.nodegx.io` → `http://localhost:3200` **and swap the bearer**. 🔴 Swapping the
  header is what makes it unnecessary to touch
  `~/Library/Application Support/NodeGX/nodegx.community.session.json`, which holds **Richard's
  real live credential** for the real site. Back it up anyway. ⚠️ The patch survives the
  launcher→editor transition, and clients capture `fetch` at construction, so **patch before the
  panel mounts**.
- Sessions are minted by inserting a `sessions` row with `hashSessionToken(token)`.
- ⚠️ `window.confirm` **blocks** the evaluate that clicked it — fire the click without awaiting
  and answer `Page.javascriptDialogOpening`.

**State as of 2026-08-23 (session 9).** Session 9 committed session 8's uncommitted AC7 work
(`9902bf61`) and then built **FB-001** end to end — both surfaces, on Richard's ruling. Nothing
is driven. Read *"What session 9 found"*, then session 8's notes, which still stand.

## What session 9 found

- ✅ **FB-001 — BUILT, BOTH SURFACES, UNDRIVEN.** Platform **`080a4f1`** in `nodegx-community`,
  editor **`e3c52fbe`** here. Full detail is in the task file; the findings worth carrying:
- 🔴 **A BAN DID NOT REACH THE NEW EDIT VERB, AND NOTHING ABOVE THE DATABASE WOULD HAVE.**
  `bench_posts_author_eligible` is **`BEFORE INSERT`** — complete for as long as a post could
  only be created. `communityGate` refuses D15's `absent` (a school switch, not a ban), and
  `serveCommunityWrite`'s capability check reads `communityVisibility`, whose viewer kinds are
  anonymous / individual / org_minor — **a banned account is an `individual` holding every write
  capability**. Shipping the edit verb without migration `0018` would have turned a ban from
  *"you may not post"* into *"you may not post anything NEW"*.
  - 🔴 **And the obvious fix inverted the rule.** A plain `BEFORE UPDATE` gate refuses
    `upholdReport`'s hide, making a banned account's posts **the only ones a moderator cannot
    hide**. `when (new.body is distinct from old.body)` is the whole guard. ✅ The spec row that
    catches a "simplification" is *"a moderator can still hide a banned account's post"*.
  - ✅ **The general shape: WHEN YOU ADD THE FIRST WRITE OF A NEW KIND TO A TABLE, ASK WHICH
    TRIGGERS FIRE ON IT.** Every rule that table has was written when only one verb existed.
- 🔴 **`api-malformed-id.test.ts` HAD A HOLE SHAPED LIKE THE TASK.** It discovered routes by their
  `[…Id]` segments and drove only **`GET` and `POST`** — so a `PATCH`-only route was discovered,
  driven **zero** times, and passed. The non-vacuity floor (`driven >= 9`) is met by the GETs
  alone, so the count could not catch it. ✅ Widened to four verbs **and given a row asserting the
  ARM** — at least one route of each mutating verb in scope — because narrowing `VERBS` back
  would otherwise go quiet rather than red. Mutation-verified both ways.
- ⚠️ **`/api/v1/me` NESTS THE HANDLE UNDER `viewer`, AND READING IT FLAT FAILS SILENTLY.** The
  first web control read `body.handle`; `undefined === handle` is false, so the buttons simply
  never appeared and nothing threw. ✅ Caught by reading the ROUTE, not the component — and pinned
  by a spec asserting **both** halves (`viewer.handle` is it, **and there is no top-level one**).
- ✅ **Richard ruled scope 3: the editor gets the SAME verbs**, not a browser hand-off. The
  argument that decided it: the editor already asks, answers and accepts, so the complaint
  reproduced inside it exactly.
- ⚠️ **`expect(v, msg)` is vitest-only** — it cost a jest suite that failed *to run* rather than
  failing. Same trap the memory index carries; it bites in `tests-unit`, not in the community repo.

- ⚠️ **`uni023`'s "no client island" claim was an EXACT LIST OF ONE, and FB-001 made it two.**
  ✅ Kept exact and given **a reason per entry** rather than relaxed to `toContain` — widening
  it would have retired the rule instead of restating it. ✅ **And the arm that replaces the
  count**: `PostControls` renders **nothing** in a static render, so the read path is
  byte-for-byte unchanged. Mutation-verified (`useState(true)` ⇒ that row alone goes red).
  The real rule is *reading never asks for anything*; an exact count was a cheap proxy for it.

### FB-001's first move next session

🔴 **DRIVE IT — neither surface has been.** 34 platform rows and 18 editor rows are green and
this phase's standing lesson is that a spec asserting a mechanism passes on dead code.
⚠️ **The editor drive and NAT-012 AC4's other half are ONE drive**, not two: both need a
signed-in editor against the live platform. Undriven specifically: the web `PostControls`
(`/me` fetch → source fetch → save → `confirm` + delete + redirect), and the editor pane placing
the verbs at all.

**State as of 2026-08-23 (session 8).** Session 8 built and drove **NAT-012 AC7** — the rail icon
for a D15-refused viewer. The predicted hole was real, and the drive found a **second** one nobody
had predicted. Read *"What session 8 found"*, then session 7's notes, which still stand.

## What session 8 found

- ✅ **NAT-012 AC7 — BUILT AND DRIVEN, both viewer states, they disagree on every row.**
  Registration in `router.setup.ts` stays synchronous and unconditional; a gate
  (`utils/community/communityRailGate.ts`) resolves `/api/v1/me` and **unregisters afterwards**.
  That choice came straight out of the task's own trap: making one of eleven registrations late is
  a change to everybody's boot, and this way nothing waits on the network.
  - `mirrorview.ts` gained **`refusesCommunitySurface(me)`** and `composeMirror` now calls it —
    one reading of D15 for two consumers (the panel's contents, the panel's existence).
  - ⚠️ **Signed out is never refused**: `/api/v1/me` answers 401 → `unauthenticated` with no
    token, never `absent`. That is what makes a gate safe to install at all.
  - 🔴 **No re-register, deliberately.** Inside a mounted editor the session can only go
    signed-out → signed-in — `signOutOfCommunity`'s only caller is on the **launcher**, which AC3
    established closes the project. If an in-editor sign-out is ever added, this fails quietly;
    the note is in the module.
- 🔴 **THE REMOVAL LEAKED IN THREE PLACES AND ONLY TWO WERE PREDICTED.** The 08-22 table was
  right that a naive `items.splice` leaves the panel drawing. It was not the end of it:

  | # | where | kept | found by |
  |---|---|---|---|
  | 1 | `SidebarModel.items` | the rail icon | predicted |
  | 2 | `SidebarModel.panels[id]` + `activeId` | the constructed, active panel | predicted |
  | 3 | 🔴 **`SidePanel`'s own React state** | the **mounted** panel | **DRIVING** |

  `SidePanel` renders every panel it has ever opened and hides the rest with `display: none`, and
  had **no removal path at all** — nothing could be unregistered before, so nothing ever needed
  one. `views/SidePanel/prunePanels.ts` is the fix.
- 🔴 **And the third leak looked CORRECT, which is why it is the one worth remembering.** With
  the model unregistered the mounted panel rendered *empty* — but only because `CommunityPanel`
  asks D15 itself and returns `null`. The surface's absence was resting on the **second** reading
  of the refusal; change that self-mask and a refused viewer gets the whole surface back with no
  icon, every rail-shaped test still green. Meanwhile the mounted panel kept `useCommunityMirror`
  polling three endpoints **once a minute** for a viewer told the community does not exist.
  ⚠️ **The measurement that nearly missed it read innerText.** An empty panel and an absent one
  are identical in text and opposite in meaning — **read `[data-panel-id]`**.
- ✅ **The naive fix was re-run LIVE as a control**, against the same drawing panel: rail icon
  **absent**, `getPanelComponent` **true**, `activeId` still **`community`**, panel still
  **drawing**. So the 08-22 table reproduces, and the instrument can tell the two fixes apart
  rather than passing on either.
- ⚠️ **`uni-001`'s session-reader gate caught the new reader and made it answer for itself.**
  That gate works — it went red on a module it had never seen, and the row was only added after
  the question ("what does this read withhold?") was answered. Answer: nothing; it is the clearest
  case in that table of an account making the editor do **less**.
- ⚠️ **Not driven**: the *install-time* refusal from a cold boot (persisting a fetch patch across
  a reload). `resolveCommunityRail()` — the exact function bootstrap calls — was driven in both
  states; the cold-boot refusal is covered by spec only.

**State as of 2026-08-22 (session 7).** Session 7 did **one** thing: it drove NAT-012's AC3, and
the drive deleted half the mechanism AC3 shipped with (`f50efe73`). Read *"What session 7 found"*
below before touching NAT-012, then the session-6 notes, which still stand.

## What session 7 found

- ✅ **NAT-012 AC3 — DRIVEN, and it passes.** Fixture `nat012-drive` (a copy of `fix012-drive`,
  two components `/App` + `/Probe`, registered in the launcher). Door label reads *"Community home
  — closes your project"*; `ProjectModel.instance` goes **`undefined`**; the launcher lands on
  **Community**; reopening puts the canvas back on `/Probe`. The narrowing is confirmed live too —
  the panel draws Discussions + Tutorials + the two buttons, and People/Guides/Replays/health are
  on the launcher page.
- 🔴 **But the restore was never ours, and the code written for it was DEAD.** The control that
  broke it: the *ordinary* exit ("Back to projects") also came back on `/Probe`. Three arms —
  steal the stash (`/Probe` anyway), clear `selectedComponentName` instead (`/App`), and an
  instrumented `switchToComponent` — showed **two calls on every open**: `restoreEditorPlace` →
  the stashed name, then **`useSwitchToDefaultComponent` (`UseSetupNodeGraph.ts:26`) → the
  default, unconditionally, later**. The second always won.
  - The restore AC3 promises is **`EditorDocument.tsx:401/432`**, which predates the task: same
    `ProjectModel.id` key, same `getComponentWithName`, same `replaceHistory: true`, and
    **persisted to `editorSettings.json`** — so it survives a restart and covers *every* exit
    route, not just this door.
  - `rememberEditorPlace` / `takeEditorPlace` / `restoreEditorPlace` are **deleted**; the landing
    half stays and is load-bearing. Re-driven after the deletion: unchanged.
  - ⚠️ **Its spec asserted the source text `restoreEditorPlace(currentInstance);` was present.**
    It was, and it meant nothing. Replaced with an absence row + an `EditorDocument` pin, both
    mutation-checked, beside a **new known-firing arm** (the old one only covered the panel file).
- 🔴 **AC7 has a hole shaped like the defect, measured before anything was built.**
  `SidebarModel` already has a removal path (the experimental toggle): splice `items`, notify.
  Run against a live *active* Community panel it leaves `activeId === 'community'`,
  `panels['community']` registered, and **the panel still drawing** — icon gone, surface present,
  the inverse of D15. The fix is three things (splice, `delete panels[id]`, switch away to
  `components`), and **the drive must read the PANEL, not the rail**. Full table in NAT-012 AC7.
- ⚠️ **Two things noticed, owned by nobody.** The launcher's recents file has a **duplicate project
  id** (`692d3658…` shared by `tut001-drive` and `Puppy test 3`), which React warns about on every
  launcher render. And the first `dev:debug` of the session died on *"Noodl is already running"*
  with no editor process on the machine — a transient single-instance race; the relaunch was clean.

**State as of 2026-08-22 (session 6).** The D6 tranche is **shipped**: FB-006's launcher
restructure (`5d31a567`), NAT-012's AC4 (`39404361`), and now **NAT-012's AC2 audit, AC3 and the
editor narrowing** (`e17ee460`). Both of session 5's open rulings came back. Read `TASKS.md`
first; it carries the measurements you must not re-derive.

## What changed this session

- ✅ **Bench vs Discussions — RULED, and the question was better than the answer expected.**
  Richard asked whether a rename was quietly merging the bench with the **chat** he commissioned
  (FB-013). It was not, and the check is on disk: *"Discussions"* was only ever a heading over
  `view.threads`; those threads are `bench_threads` from `/api/v1/bench/threads`, opened at
  `community.nodegx.io/bench/<id>`; UNI-011 coined the word for exactly that list; the web has
  **no `/discussions` route**. 🔴 **Chat is the argument FOR "Bench"** — FB-013 arrives as its own
  tab in the same table, and a chat feed is more literally a *discussion* than an answered-state
  Q&A is, so keeping "Bench" leaves the word free for the surface that will want it. Reasoning
  lives in `communityTabs.ts`'s module note; the label is still one table row.
- ✅ **NAT-012 AC3 — RULED: accept the close, label it honestly.** Richard took option (2), so the
  dispose branch in `router.tsx` is untouched. The door reads **"Community home — closes your
  project"**, and reopening restores the component you were on.
  - `utils/launcher/launcherHandoff.ts` — the two facts (landing page, place-per-project),
    **module state, consumed on read**. 🔴 Not `localStorage`: a landing read off disk at startup
    is FIX-025's defect rebuilt, and opening a project already writes three files without a fourth.
  - `utils/launcher/leaveForLauncher.ts` — the gesture. 🔴 **Both reads happen BEFORE
    `exitProject`**, which notifies `'exitEditor'` synchronously and disposes everything; that
    order is asserted as order.
  - ⚠️ **The place is keyed by NAME**, because the reopened project is a different `ProjectModel`
    with different `ComponentModel` objects — `componentInstanceId`'s WeakMap cannot answer this.
    A rename while you are away therefore **misses, and draws nothing**, which is correct: a guess
    that looked like a restore would be worse.
- ✅ **The editor narrowing.** `CommunityPanel` drew seven things; it now draws what passes *"is
  this about the project on the canvas?"* — Discussions, the thread pane, the profile pane, and
  TUT-004's installable tutorials. People / Guides / Replays / the health readout went to the
  launcher, which already draws all four. `openCommunity` **lost its `path` parameter** with the
  rows that jumped to Chrome silently.
- 🔴 **Two live task files revised, named in the diff**: NAT-008 AC1's **rail half is withdrawn**
  (AC2's profile pane stays — you reach it from an author line that is still drawn); NAT-005's
  **panel** loses two sections while its components and vocabulary are untouched.
- 🔴 **uni-001's AC4 rows were REPOINTED, not shortened.** Two anchors vanished and `isGated`
  **threw** rather than passing blind — which is the only reason it was caught. The claim follows
  the sections to the launcher page, **with a mutation arm**: that file has no viewer conditional
  at all, so three bare `false`s would have proved nothing.

## First moves, in order

1. ~~Drive NAT-012's AC3~~ — ✅ session 7. ~~NAT-012 AC7~~ — ✅ **session 8**.
   ⚠️ **AC4's other half is still open**: posting a real question to the live Bench from a
   signed-in editor. Richard's call.
2. ~~**FB-001** build~~ — ✅ session 9. ~~**the drive**~~ — ✅ **session 10, both surfaces**, and
   it closed NAT-012 AC4's other half with it.
3. **FB-019 implementation** — the sweep already revised AC1/AC2: keep the merge, fix only the
   no-stored-unit case, on **all three** registration paths. 🔴 **Drive an image-cropper pan
   first** — the six broken connections are predicted from source and nobody has watched one fail.
4. **Quick wins with no rulings**: FB-007, FB-010, FB-003 — the build-the-caller family.
5. **Still needing Richard**: FIX-026 (a)/(b), FIX-027 14/15/16 + 22, tsfixme baseline, prod
   `ANTHROPIC_API_KEY` (⚠️ intro pricing ends **2026-08-31** — eight days), the 15 lessons' prose,
   Discord's row in the `?` menu, `/rfps` search.

## Standing traps for this phase

- 🔴 **THE FILED DIAGNOSIS HAS NOW BEEN WRONG FIVE TIMES RUNNING** — FB-020, `uni022` AC4, FB-019,
  NAT-012 AC3, and now **NAT-012 AC3's own implementation**, which is the new shape: the task file
  was right that AC3 needed a restore, the ruling was right, and the code built for it was
  **dead on arrival** because nobody checked whether the editor already did it. 🔴 **Before
  building a mechanism, grep for the one that already exists** — `selectedComponentName` was one
  `grep -rn` away from the task file the whole time. **Read the code a task file points at before believing what it says about it.**
  🆕 **And the same applies to a task file's own AC wording**: NAT-012 AC3 asked for a persistence
  the router does not offer, so it was *rewritten to the ruling* rather than left as a bar nothing
  would ever clear.
- 🔴 **AN EMPTY SURFACE AND AN ABSENT ONE ARE IDENTICAL IN TEXT AND OPPOSITE IN MEANING.**
  Session 8's near-miss: a refused viewer's Community panel was read as gone because its text was
  empty, when in fact it was **mounted and polling** — it drew nothing only because the component
  self-masks. ✅ **Read the structural marker (`[data-panel-id]`), never innerText**, and when a
  thing is supposed to be gone, ask *gone from what* — the model, the rail, the DOM, or the React
  tree are four different populations and this defect lived in the fourth.
- 🔴 **A SECOND READING OF A REFUSAL IS A FIX WAITING TO LAND ON ONE OF THEM.** `mirrorview.ts`
  warned about this in its own header and it is what made AC7's third leak dangerous rather than
  merely untidy. When two layers must obey one policy, **export the predicate** and let both call
  it — AC7 did, with `refusesCommunitySurface`.
- 🔴 **A narrowing shrinks a checker's population silently.** When an anchor disappears, the fix is
  to **follow the subject**, not delete the row — a claim whose population quietly shrank is how a
  gate goes quiet without going red. ⚠️ And when you repoint it to a new file, **prove the checker
  can fire there**: `Community.tsx` has no viewer conditional, so every absence read `false`
  vacuously until a mutation arm was added.
- 🔴 **A shared component's spec is a hostage** (FB-006's `TabStrip`). Before reaching for a
  stateful component in a graded tree, check whether `tests-unit`'s walker can evaluate it.
- 🔴 **A SPEC THAT ASSERTS A CALL EXISTS PASSES ON DEAD CODE.** `expect(src).toContain('foo(x);')`
  is a mechanism check, and NAT-012 AC3 is the case where the mechanism was present, correct, and
  overwritten by a later effect on every single run. The drive is the only thing that could tell
  the difference. When the subject is *"does this produce an outcome"*, the arm is: **starve every
  other candidate and see whether the outcome survives.**
- 🔴 **Revert the fix and count the reds** (still the rule). NAT-012: reverting the panel turns
  **11 of 20** rows red; mutating **only** the door's label turns exactly **1** — worth knowing
  separately, because a silent door is the failure that would otherwise look like a feature.
- ⚠️ **Borders are stored per side** — `borderTopColor`, never the shorthand.
- ⚠️ **`scroll-behavior: smooth` makes a same-eval `scrollTop` read lie**, and toward the bug.
- ⚠️ **The launcher's recents file is a real user file the running editor owns** — write it only
  while the editor is idle on the launcher, then reload.
- ✅ **Community suite, 2026-08-23 (session 9 tree, after `npm run build`): 54 files / 1313
  specs, 0 failures.** ⚠️ The real-HTTP `uni015-bench-http` file **ran** (8 tests) rather than
  self-skipping, which is what the build buys. Editor `tests-unit`: **292 / 4759 / 0** — +1
  suite / +18 specs on session 8's 291 / 4741, both `fb-001/editverbs.test.ts`.
- ✅ **`test:ci` 2026-08-23 (session 8 tree): 2849 specs, **4** failures — all `AIX-006 style
  vocabulary`.** Ran alone, completed (2849 spec-starts, the full count); ⚠️ **exit was 1, which
  is what the clean floor does too** — the reading is the failure *names*. Compared by name against
  08-19's 10-failure floor: this is a strict **subset** of it (the 4 AIX-006 rows). The other six —
  2× AI model registry, 1× AIX-011, 3× SUB-011 expression params — **passed this run**, which is
  the order-dependence the seed note warns about, not a fix. **Nothing new, and nothing in the
  sidebar / panel / community area.** ⚠️ The log carries ~6,700 `10000 listeners` warnings from the
  legacy `shared/model.js`; pre-existing and unrelated.
- **Editor `tests-unit`, 2026-08-23 (session 8 tree): 291 suites / 4741 specs, 0 failures.**
  Reconciles exactly against session 7's 290 / 4720: **+1 suite / +21 specs**, both
  `nat-012/community-rail-gate.test.ts`. ⚠️ **That is `tests-unit` ALONE.** `npx jest -c
  jest.config.js` with no path also runs `tests-main` and reports **310 / 5005** — the difference
  is a stable **19 suites / 264 specs**, which is the number to reconcile against, not the older
  `308 / 4987` (that was taken when `tests-unit` was 289 / 4723). `typecheck:editor` and
  `typecheck:editor-tests` both 0; `typecheck:core-ui` reports **44 pre-existing `TS2307`**,
  unchanged and not yours. Compare **by name**, and re-measure rather than quoting this.
- ⚠️ **Two community commits are still unshipped**: `9ecec25` (tokens + gates) and `fd695ae`
  (FB-002's web half). nexus-1 is still `8d40b63`. Deploying changes the live site's dark inks and
  the Bench's default list — **Richard's call, ask before deploying.**
- Platform: `npm run build` first; Postgres 55432; four derived-from-disk gates plus the `/v1`
  envelope contract fire on any new route or column.
- ⚠️ **A peer was blitzing phase 65 in this checkout on 2026-08-22** (library/**, scripts/library,
  noodl-mcp, import-engine) and had `library/modules/*` deletions staged. `NAT-011` still carries
  an uncommitted AC7 beside older uncommitted edits, and phase-65/70/71 are untracked — somebody
  else's work; check before sweeping any of it into a commit.
- Shared checkout: **commit by pathspec, never stage**; `git log -5 -- <path>` before overwriting
  a shared file; never `git stash`.

## Drive fixtures on disk

`fb020-drive` and `fb020b-drive` (A bare, B author checked-state, C Enable Icon off, D bare radio
group, E author fill colour — B, C and E are the regression arms). Both are in the launcher's
recent list. **FB-019 will want a new one**: a Group with a never-set Width fed a bare number, plus
a sibling whose Width *is* set — the population-A control that must not change.
✅ **`nat012-drive`** now exists (a copy of `fix012-drive`; `/App` + `/Probe`, fresh project id,
registered in the launcher) — that is the two-component fixture AC3 needed, and AC7's drive can
reuse it.

⚠️ **Driving this editor from CDP: there is no editor global, but webpack's require is reachable.**
`window.webpackChunknoodl_editor.push([[Math.random()],{},(r)=>{req=r}])` hands back
`__webpack_require__`, and `req('./src/editor/src/models/projectmodel.ts')` &c. give the app's own
module instances. 🔴 **Check `req.c[id]` first** — a module that is not already instantiated gets a
*fresh* copy, and you would be reading state the app does not share. Patching a prototype method
(`NodeGraphEditor.prototype.switchToComponent`) to record call stacks is what named the overwriter
in AC3, and is the cheapest way to answer "who actually did this".

## End every session

Update this file and memory (`phase-75-0-2-1-the-feedback.md` + its MEMORY.md pointer).
