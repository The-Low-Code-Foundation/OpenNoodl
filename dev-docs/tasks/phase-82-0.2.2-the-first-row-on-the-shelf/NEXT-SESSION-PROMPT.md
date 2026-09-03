# Phase 82 — next session

## The board, re-derived from [`TASKS.md`](TASKS.md) at 2026-09-03 14:2x (session 20)

🔴 **Re-derive it again yourself.** This phase has been overtaken twice by a ruling that landed
hours after a handoff was written. **The task files are the board; this section is a convenience.**

| # | row | state |
|---|---|---|
| 6 / 6b | REL-002c + [REL-010](REL-010-AS-GOOD-AS-THE-PAGE-HE-RATED.md) | ⏳ **RICHARD'S LOOK.** All building done (s15). A session cannot close a person |
| 7 | REL-001 — publish the members' area | ⏳ **RICHARD.** Recommendation unchanged: *fix first, publish once* |
| 8 | REL-004 — cut and tag `v0.2.2` | 🔴 **Blocked**: `cline-dev` unpushed (**638 at 13:4x s20 — re-derive at cut time**), CI has run on none of it |
| 9a | REL-011a — the 53 controls | 🟢 CLOSED s17 `d88368c5` |
| 9b | REL-011b — operable on the artefact a person publishes | 🟢 CLOSED s19 |
| 9c | REL-011c — the three surfaces reach PASSABLE | ⏳ his look. **🔴 SEVEN registered findings wait to be ruled against** |
| 10 | REL-009b — the editor sees the write | 🟡 **BUILT AND DRIVEN s20 — AC1/2/4/5 MET, AC3 UNMEASURED.** One cheap arm left, below |

🔴 **There is no fully-buildable row left on this board.** REL-009b's remainder is one drive arm
(~20 min). Everything else is Richard's.

## 🟡 What session 20 did: REL-009b built and driven — the agent's write now reaches the open canvas

Full write-up: **[REL-009 §3.1](REL-009-THE-WRITE-THE-EDITOR-CANNOT-SEE.md)**. Board row in
[`TASKS.md`](TASKS.md).

`reloadComponentFromDisk` had **zero callers** for fourteen months. It has one now: a `fs.watch`
watcher (`services/ProjectFileWatcher/`) maps changed files onto registry component paths, debounces
them, and hands them to the seam. **Photographed**: an MCP write over stdio lands on the open canvas
without reopening the project.

### 🔴 U3 was the expensive part, exactly as §3 predicted — and the first build of it was WRONG

Three separate listeners treat the swap's `removeComponent` as a deletion, **across two event
buses**. Guarding `componentRemoved` caught two of them. The third —
`EditorEventBindings`, on **`NodeLibrary`'s `typeRemoved`** — called `switchToComponent()` with
nothing, and the canvas still went blank.

```
componentRemoved /Pages/Second reloadingFromDisk=true
switchToComponent(UNDEFINED)          ← the third listener, on the OTHER bus
componentAdded   /Pages/Second reloadingFromDisk=true
componentReloadedFromDisk …
```

**That middle line is the whole finding, and no amount of reading produced it** — an instrumented
drive did, in about four minutes.

### The four things worth carrying forward

1. 🔴 **A FLAG ON ONE EVENT REACHES ONLY THE LISTENERS ON THAT EVENT.** One state change
   (`removeComponent`) fanned out onto `ProjectModel`'s bus *and* `NodeLibrary`'s. The `reloadingFromDisk`
   flag was correct, complete and useless on half the listeners. ✅ **When you add a discriminator to
   an event, grep for every OTHER event the same code path raises.**
2. 🔴 **DON'T READ LIVE STATE TO ANSWER A QUESTION ABOUT THE PAST.** The follow-hook asked *"is the
   canvas showing this component?"* at reload time — after several other listeners had run, one of
   which had set it to `undefined`. It now answers at **removal** time and stores it. The specific
   listener is fixed; **reading a value another listener may have moved is the fragility, not the
   listener that moved it.**
3. 🔴 **A GREEN READING AND ITS CONTROL BOTH READ ZERO ⇒ YOU MEASURED NOTHING.** AC3: the model took
   an MCP write and the preview did not — which looks *exactly* like the propagation failure §3 told
   us to go and verify. But an ordinary **editor** edit also never arrived, and the viewer's body was
   empty: the preview had died. **A dead preview and a preview that ignores reloads are the same
   photograph.** One extra reading is all that stood between this and a fabricated finding against
   `ViewerConnection`.
4. 🔴 **TAKE THE STACK BEFORE CLAIMING CREDIT.** The event log made the canvas re-point look like it
   fired *before* the event my hook listens to — i.e. like something pre-existing was doing the work
   and this row had added nothing. A stack trace attributed it to `UseSetupNodeGraph.ts:128` ←
   `reloadComponentFromDisk` ← `EditorPage.tsx:242`. It was a logging artefact: two listeners on one
   event, mine registered first. **The claim I nearly wrote was the wrong one in BOTH directions.**

### 🔴 The design decision a future edit must not undo

`ProjectStructure.reloadComponent` was **split** into `readComponentFromDisk` + `markComponentBaseline`
so the watcher decides **before** the baseline moves. Advance it and then refuse, and REL-009a's
`findExternallyChanged` goes blind to the conflict — **the very next autosave clobbers the file the
reload just declined to apply.** The refusal would have disarmed the guard that makes refusing
worthwhile. Two specs pin it; a mutant that re-merges them reddens exactly those two.

Verified in the running product, not only in specs: reload refused → `Third/nodes.json` byte-identical
(`afa79b59…`) across a real autosave, agent's write intact, human's edit on disk **0 times** and
still in memory. Both people's work survived and both were told.

## ⬜ The one buildable thing left: REL-009b AC3, ~20 minutes

**Do not record a finding against `ViewerConnection` from s20's run — nothing licenses one.**

1. Fresh `npm run dev:debug -- --quiet`, open `NodeGX test projects/REL-009b Watcher Drive`
   (already registered in the launcher as **`REL009B Watcher Drive`** — renamed precisely so its card
   is distinguishable; there were two reading `Deadline Desk`).
2. 🔴 **Prove the control FIRST**: make an ordinary editor edit to `Pages/Home` and watch it appear in
   the preview (`npm run cdp -- eval "…" --target=viewer`). Only once that is known-firing:
3. MCP-write a node into `Pages/Home` and read the same way. `scripts` for this are in s20's
   scratchpad shape: spawn `packages/noodl-mcp/dist/noodl-mcp.cjs` with `ELECTRON_RUN_AS_NODE=1`,
   `get_component {path}` → `update_component {path, set:{nodes, connections}}`.
4. ⚠️ The preview died mid-session-20 with a `⚠ 1` in the toolbar and did not come back on refresh.
   If it dies again, **that** is the finding to chase, and it is not this row's.

## Working rules for this tree — unchanged, and all of them earned

1. 🔴 **The canvas is a `<canvas>`.** Node labels are painted, not DOM, so `querySelector` cannot see
   them and **a screenshot is the only instrument** for anything about the graph. `elementFromPoint`
   before clicking anything — s20's launcher card sat at **y=7572** in a 76-project list and reported
   `hitTest: null` until scrolled (`behavior:'instant'`; smooth scrolling leaves `scrollTop` at 0).
2. 🔴 **You can reach the editor's modules from CDP** — nothing is on `window`, but
   `webpackChunknoodl_editor.push([[id],{},(r)=>{req=r}])` hands you the require function and
   `req.c['./src/editor/src/models/projectmodel.ts'].exports` the rest. That is how s20 instrumented
   `switchToComponent` and read the save baselines live.
3. ⚠️ **Editing source while a `dev:debug` stack is up triggers HMR and can bounce the editor back to
   the launcher mid-drive.** Finish the edits, let it settle, `cdp reload`, then drive in one pass.
4. 🔴 **`judge()` KEYS ITS OUTPUT BY `today()`** — two sessions running a look harness on the same day
   overwrite each other silently. ✅ Commit a look run before starting another.
5. 🔴 **COMMIT BY PATHSPEC, NEVER `git add`** — except untracked paths, which a pathspec commit
   **skips silently** (`git status --porcelain | grep '^??'`; check whether a `??` is a directory).
   ⚠️ **And a pathspec commit takes the WHOLE file, including a sibling's half-written paragraph** —
   `git diff --stat` it first; if the diff dwarfs your edit, the rest is somebody else's.
   ⚠️ **`README.md` in this directory carries a peer's uncommitted edit.** s20 left it alone.
6. 🔴 **`scripts/devtools/render-from-disk.js` IS UNCOMMITTED AND LOAD-BEARING** (`render-report.js`
   too, plus an untracked `reap-render-orphans.js`). ✅ **Re-derive its md5 rather than quoting a board's.**
7. 🔴 **NEVER OPEN `templates/members-area` OR the site-builder template IN THE EDITOR** —
   `readBundleDirectory` has no skip list. Work through `npm run template:members` / `template:site-builder`.
8. ⚠️ **`timeout` does not exist on this Mac**, and the Bash tool backgrounds a foreground command at
   120s. Gate on an exit file you write yourself.
9. ⚠️ **The box is shared and busy.** One heavy job at a time. ✅ **Announce a `dev:debug` launch AND
   its teardown to every peer** — s20 did, and one peer was holding ~12 files of viewer-runtime edits
   specifically waiting for that teardown.

---

_Everything below predates session 20. Rows 6/6b/7/8 have not moved, but **re-derive from
[`TASKS.md`](TASKS.md) before believing any of it.**_
 Rows 6/6b/7/8 have not moved, but **re-derive from
[`TASKS.md`](TASKS.md) before believing any of it.**_

## The board, re-derived from [`TASKS.md`](TASKS.md) at 2026-09-03 13:0x (session 18)

🔴 **Re-derive it again yourself.** This phase has now been overtaken twice by a ruling that
landed hours after a handoff was written — s16's *"the whole run sheet is Richard's"* was true at
07:56 and false by 10:42. **The task files are the board; this section is a convenience.**

| # | row | state |
|---|---|---|
| 6 / 6b | REL-002c + [REL-010](REL-010-AS-GOOD-AS-THE-PAGE-HE-RATED.md) | ⏳ **RICHARD'S LOOK.** All building done (s15). A session cannot close a person |
| 7 | REL-001 — publish the members' area | ⏳ **RICHARD.** Recommendation unchanged: *fix first, publish once* |
| 8 | REL-004 — cut and tag `v0.2.2` | 🔴 **Blocked**: `cline-dev` unpushed, CI has run on none of it. **Re-derive the count at cut time** — it moves while you work |
| 9a | REL-011a — the 53 controls | 🟢 CLOSED s17 `d88368c5` |
| **9b** | **REL-011b — operable on the artefact a person publishes** | 🟡 **AC2 CLOSED s18** (`f9a3d301`, `10592e03`). **AC1 (D54) and AC3 are the next buildable work** |
| 9c | REL-011c — the three surfaces reach PASSABLE | ⏳ his look; a session cannot award it |
| 10 | REL-009b — the editor sees the write | ⬜ buildable; D1 unruled, U3 expensive |

## 🟢 What session 18 did: REL-011b AC2 — settled, fixed, and driven both ways

Full write-up in [REL-011 §AC2](REL-011-THE-SITE-BUILDER-SHIPS.md). The row said *"settle
harness-vs-product before fixing anything"*, and the settling is the part worth reading.

**It was the product.** A step-by-step probe either side of `service.stop()`:

| moment | elements | buttons | fields | sections | imgs |
|---|---|---|---|---|---|
| backend **up** (three readings running) | 82 | 2 | 3 | 6 | 3 |
| **before the fix**, backend down +0/2/8s | **38** | **0** | **0** | **0** | **0** |
| **after the fix**, backend down +0/2/8s | **82** | **2** | **3** | **6** | **3** |

**Cause**: `dbcollectionnode2.ts`'s `fetch()` mints an empty `Collection` at the top and fills it
only in `success`; the **error** branch published that empty collection. So a query that merely
failed to answer overwrote the rows it had already delivered — `isEmpty` went true and every
`For Each` below redrew nothing. SBR-011 gives three of this template's queries a realtime
subscription and a dropped stream re-runs the query, so **any backend restart or blip emptied every
visitor's published page until they reloaded it.** Fixed with one guard, aligning the error branch
with `fetch()`'s two other failure exits, which already leave the collection alone.

**Gates**: `rel011b-failed-fetch-keeps-rows.test.ts` **5/5** with **exactly one spec red on the
reverted source**; full `noodl-runtime` **150 suites, 2637 passed, exit 0**;
`sbr005-sections.look.ts` **3/3, exit 0** — it had failed three runs in a row.

### 🔴 Four things from this session that will bite the next one

1. 🔴 **A CONTROL THAT PASSES ON A BLANK PAGE IS NOT A CONTROL.** The AC3 arm's own guard reads
   *"answered before the press — sent: false, refused: false"*, which is **exactly what an empty
   document reports**. It was written against a form that submits on typing and it had been green
   for weeks over a page that may already have been empty. **Every reading this file ever took of
   the zero-buttons failure was equally consistent with the opposite diagnosis.** ✅ A presence
   control now stands beside it. **Ask what your control reads on the failure you are not testing
   for.**
2. 🔴 **THE CONTROL THAT MADE THE AFTER-ARM MEAN SOMETHING IS THAT THE QUERY STILL FAILS.** Both
   `query-records/query-failed` lines are in the after-run's console, unchanged. Without that, a
   green after-arm is equally explained by *"the fix suppressed the failure"* or *"the backend
   didn't really stop"*. ✅ **Name what must STAY red for your fix to be the explanation.**
3. 🔴 **A PIN IS A CLAIM ABOUT A FILE, AND `ps` CANNOT SEE ONE.** Before rebuilding
   `noodl.viewer.js` I waited out a peer's render run, waited out a peer's jest suite and watched
   load fall from 40 to 7 — and a peer **had** pinned that exact md5. Nothing was lost, and the
   reason is the lesson: **that run carried a three-bundle stability control**, so its numbers were
   demonstrably bundle-independent. ✅ **Announce the INTENT to rebuild a shared artefact, not just
   the fact.** ⚠️ And when a peer says *"X pinned it"*, **ask X** — the first answer back was
   *"never mine"*, from a session whose `/clear` had put its own history out of context. It then
   corrected itself. **A cleared session's "I never did X" is not a measurement.**
   ⚠️ Bundle pinned this session: `8facb5b25e80339a28ebf539a4894b23` → `c8d6228e2e61017979e38870ee67e56e`.
4. 🔴 **`grep -c` ON A MINIFIED BUNDLE RETURNS 1 WHATEVER IS IN IT** — it is one line. A peer nearly
   filed a fix as half-lost on that reading. ✅ Verify a fix in a bundle by **substring search over
   the text**. That is how the guard was confirmed present — and how the **unguarded twin** in
   `nodes-deprecated/` was found beside it.

### ⚠️ Two things registered rather than built

- **`nodes-deprecated/std-library/data/dbcollectionnode.ts:384`** carries the **identical**
  unguarded branch and is in the shipped bundle. The site-builder uses `DbCollection2`, so no AC
  here is affected; a project carrying the deprecated node still empties on a failed re-fetch.
  🔴 **Owner `NONE` — give it one.**
- **A release-notes line is owed** for this fix (it is a platform behaviour change riding 0.2.2).
  Not written, because `dev-docs/tasks/release-0.2.2/RELEASE-NOTES-0.2.2.md` **carries a peer's
  uncommitted edit** and a pathspec commit would sweep it. **Owner: REL-004.**

## The next buildable work: REL-011b AC1 and AC3

**AC1 is [D54](../phase-77-the-site-builder-rescue/DEFECTS-THE-SITE-BUILDER-FOUND.md#d54)** — the
theme presets are inert on the deploy and live in the editor's preview: 0 of 7 fields, 0 requests,
on enabled buttons with `onclick`, while `Save theme` on the same screen fires its `PUT`.
**Undiagnosed**, and `droppedByHealthFilter` was 0 with the `--sabotage` control proving that filter
alive, so the export filter is excluded and nothing else is. ✅ **Diagnose before fixing** — that
instruction is what made AC2 cheap, and AC2's cause was not on anybody's candidate list.

**AC3 is a discovery AC, and its arithmetic was wrong.** ⚠️ **Re-derived from the artefact: the
template declares SIX admin routes and FOUR are unphotographed**, not nine —
`/admin/setup`, `/admin/signin`, `/admin/pages`, `/admin/page/{pageId}`, `/admin/theme`,
`/admin/messages` (`ADMIN_PATH_PREFIX` is the literal `admin`; all six are `Page` components in
`sb005Components.ts`). s17 took `/admin/pages` and `/admin/theme`. The *"eleven admin pages"* on
the row counts something other than routes.

**REL-009b remains buildable too** — `reloadComponentFromDisk` still has zero callers and there is
still no filesystem watcher anywhere in the editor. Read [REL-009 §3 and §4 U3](REL-009-THE-WRITE-THE-EDITOR-CANNOT-SEE.md)
first; **U3 — whether the canvas survives a model swap underneath it — is where it gets expensive**,
and D1 (`fs.watch` vs `chokidar`) is unruled.

## Working rules for this tree — unchanged, and all of them earned

1. 🔴 **`judge()` KEYS ITS OUTPUT BY `today()`.** Two sessions running a look harness on the same day
   **overwrite each other's verdicts in place, silently.** This session did it to phase-81's
   `sbr-005/2026-09-03/` — the very arm REL-011a names. ✅ **Copy the after-arm out first, then
   `git checkout --` the directory back**, and `md5` both. It only worked because the before-arm was
   **committed**.
2. 🔴 **COMMIT BY PATHSPEC, NEVER `git add`** — except untracked paths, which a pathspec commit
   **skips silently**. ⚠️ **`sbr005-sections.look.ts` had NEVER been tracked** despite defining
   REL-011b AC2 and being cited by REL-011a. It is committed now. `git status --porcelain | grep '^??'`
   before every commit, and check whether a `??` is a **directory**.
3. 🔴 **`scripts/devtools/render-from-disk.js` IS UNCOMMITTED AND LOAD-BEARING**, and its md5 has
   **moved** since the board recorded it: `1557f527…` → **`665987c0…`** (mtime 09-02 16:47), and
   `render-report.js` is modified too. The product-host-stylesheet behaviour REL-002a needs is still
   in it (checked). ✅ **Re-derive that md5 rather than quoting the board's.**
4. 🔴 **NEVER OPEN `templates/members-area` OR the site-builder template IN THE EDITOR** —
   `readBundleDirectory` has no skip list and would ship `.mcp.json`, `CLAUDE.md` and a `.gitignore`
   block. Work through `npm run template:members` / `template:site-builder`.
5. ⚠️ **`timeout` does not exist on this Mac** — `command not found` piped into `echo "EXIT=$?"`
   reads as **`EXIT=0`**. Gate on an exit file you write yourself.
6. ⚠️ **The box is shared and busy.** Load sat between 7 and 42 all session with peers running an
   editor dev stack, a render harness and two jest suites. One heavy job at a time; wait for a
   peer's suite; and see hazard 3 above before touching a shared build artefact.

---

_Everything below predates session 18. It is kept because rows 6/6b/7/8 have not moved, but
**re-derive from [`TASKS.md`](TASKS.md) before believing any of it.**_

## 🔴 READ THIS FIRST — the board grew after s16 wrote its handoff, and rows 6–8 are no longer all there is

_Session 17, 2026-09-03._ **s16 concluded *"the whole run sheet is now Richard's"*. That was true
when it was written at 07:56 and stopped being true at 10:42**, when a P77 session landed
[REL-011](REL-011-THE-SITE-BUILDER-SHIPS.md) on this board: **Richard reversed the site-builder hold
and set its bar at literally `PASSABLE`.** Three new rows, and s17 took the first one.

🔴 **So do not read the run sheet below and conclude there is nothing to build.** Everything from
*"SESSION 16"* down was written before REL-011 existed. ✅ **The instruction that saves you is the
one this phase already carries: re-derive the board from [`TASKS.md`](TASKS.md) and the task files,
not from a handoff's copy of it.** This is the second time in three sessions that a handoff's
*"a session cannot advance any row"* was overtaken by a ruling arriving hours later.

### 🟢 What session 17 built: REL-011a — CLOSED, `d88368c5`

**53 of 53 controls carry the palette, from 1 of 53.** Full write-up in
[REL-011 §REL-011a](REL-011-THE-SITE-BUILDER-SHIPS.md); board row in [`TASKS.md`](TASKS.md).
Gates: `npm run template:site-builder` **exit 0**; the new
`sbr014ControlStyleCensus.test.ts` **12/12 having been 1 failed / 11 passed**; full `noodl-mcp`
**90 suites, 1182/1182, exit 0**.

- 🔴 **The census read 1 at HEAD, not the 3 REL-011 §2 recorded.** §2 counted *"any `var(--…)`
  parameter"*, which admits a lone `marginLeft` as styling and misses that the one dressed button
  had no `fontSize`. Neither count is wrong — **they are different questions**, and a number that
  cannot be reproduced from its own definition gets re-derived differently by the next session.
- 🔴 **Only the 25 text inputs were ever invisible.** `options` and `checkbox` draw a 2px box at
  their own node defaults. They took the treatment to **join the palette**, not to become visible,
  and the write-up refuses to cite them as evidence of the fix. ⚠️ Measured on the **live** nodes in
  `nodes/controls/`, not the `nodes-deprecated/` twin that carries the same display names and
  different defaults — the first reading of this session came from the wrong file.
- 🔴 **Two ports were REFUSED and that is the load-bearing part.** `fontFamily` is already
  `inherit` in `assets/style.css` (P78 D18), so requiring it would have moved this census's number
  on 53 nodes and **changed no pixel** — REL-010 §6.5's refused move in new clothes. Label ports
  likewise: the labels were legible in the very photograph the row was opened on.
- 🔴 **The fix's first arm was correct and looked unfinished**, and only the render said so: fields
  ~205px in a 700px card, which they had always been, invisibly. `sizeMode: 'contentHeight'` alone
  fixed it; the `width: 100%` copied from `members-area` reddened `sbr012` with 26 raw dimensions
  and was **redundant**. The gate was right, and a second render is what proved it.

### 🔴 The next buildable row is REL-011b, and its first job is a diagnosis, not a fix

[REL-011 §REL-011b](REL-011-THE-SITE-BUILDER-SHIPS.md). Two of its three ACs are **undiagnosed**, and
the row says so — *"settle which before fixing anything."*

- **AC2 reproduced a third time in s17's run**: `no button labelled "Send". Buttons on the page: []`
  after `service.stop()`. 🔴 **And it is a sharper measurement than it was**: the same template's
  buttons are now unmistakably present and painted when the backend is up, so *"the harness cannot
  find a button"* and *"the page has no buttons"* are further apart than before. **Settle
  harness-vs-product first.**
- **AC1 is D54** — theme presets inert on the deploy, live in preview, `droppedByHealthFilter` 0.
- **AC3 is a discovery AC.** ✅ **s17 has already photographed two of the eleven** — `/admin/pages`
  and `/admin/theme`, four widths each, in `verdicts/vib-001/2026-09-03/site-builder-living/`. The
  rest are still unphotographed, and D40 hid them for the life of the template.

⚠️ **REL-011c is Richard's look and a session cannot close it**, exactly like rows 6 and 6b.
**REL-009b remains buildable too** — see the s16 section below, which is still accurate about it.

### 🔴 A hazard s17 met, which will bite the next session that runs a look harness

**`judge()` keys its output directory by `today()`.** Two sessions running the same harness on the
same day **overwrite each other's verdicts in place, silently**. s17's first run replaced P77 s48's
`sbr-005/2026-09-03/site-builder-living` — the exact before-arm REL-011a AC2 names. ✅ Recovered from
`9bd1488f` and restored, both arms `md5`-checked against `git show`. ✅ **Commit a look run before
starting another, and copy an after-arm out before re-running.**

---

_Opened 2026-08-31 (s1). Last updated **2026-09-03, session 16** — ⚠️ **everything below this line
predates REL-011; read the section above first.** 🔴 **ROW 6 IS REOPENED — see the section below before reading anything else.** Row 6 has **no building left on
it**: every one of the thirteen pages has been photographed and graded at **all four widths**, both
of s13's queued questions are answered and built, and s14 found that the one apparent defect left in
the pictures belonged to the **test harness**, not the product. What remains is **Richard's own
look**. The decisions are
[`RICHARD-RULINGS-2026-09-01.md`](RICHARD-RULINGS-2026-09-01.md) — **§I is new, read it** — and the
change list is [`REL-002c-WHAT-I-WOULD-CHANGE.md`](REL-002c-WHAT-I-WOULD-CHANGE.md)._

## 🔴 Read this first: this is the only board you open

Richard, 2026-08-31: *"can we work through the next session prompt in phase 82, rather than me
ending up driving unnecessary tasks in other phases by accident — just so we focus on the tasks we
need to launch, over several sessions all in phase 82."*

**So: every launch session opens THIS file, takes the next unstruck row from the run sheet below,
and finishes inside phase 82.** The verdict scale and close protocol are restated in
[`TASKS.md`](TASKS.md) — you do not need to open phase 81.

🔴 **If a row is not on this board, it does not gate 0.2.2.** Anything else you find is a **register
row with an owner**, not this session's job — see
[`../../guidelines/PHASE-EXECUTION.md`](../../guidelines/PHASE-EXECUTION.md).

## The bar for row 6 — 🔴 REWRITTEN 2026-09-02 (s15). The old one was circular.

**The benchmark is `docs/node-catalog/examples/ui-landing-page.json` (VIB-006)** — the page Richard
called *"fucking pro"* — **not the members-area's own `/`**, which he puts in the *passable,
old-school WordPress template* bucket. The previous instruction on this board said to grade each page
beside `/`, and twelve pages were certified *"as good as the homepage"* against a homepage he does
not rate. **The comparison could not fail, and for fourteen sessions it did not.**

✅ **The chrome exemption is now RULED and its author is named — this was register row R2.** It used
to read as the bar and was a *session's sentence*. Richard ruled it as **§3.1 of
[REL-010](REL-010-AS-GOOD-AS-THE-PAGE-HE-RATED.md) on 2026-09-02**, choosing *"§3.1 as proposed —
density, not billboards"* from three options:

> All thirteen clear AC2/AC4/AC5. The **public four** (`/`, `/join`, `/sign-in`, `/setup`)
> additionally take the VIB-006 section vocabulary. The **signed-in nine** get the display tier,
> imagery where a row or card can honestly hold one, and a second and third ground —
> **density and decision, not billboards.**

⚠️ **What that does NOT license.** It is a ruling about how much *marketing* an app-chrome page
carries. It is not an exemption from being designed: the nine still owe a display tier, three
grounds and a page-identity zone, and s15 measured all three onto them. A page that "shows decision"
is now a **measured** claim (`vib001-members.poverty.look.ts`), not a verdict somebody types.

## ✅ SESSION 13 — the run was taken, and it changed the row twice

**Full write-up: [`TASKS.md`](TASKS.md) §"what session 13 did".** Gates: `template:members` **exit 0
and idempotent** (30 components, 94 files, same 110 door diagnostics); `tpl001Template.test.ts`
**72/72**; full `noodl-mcp` **85/85 suites, 1117/1117**; `tpl001-members-drive` + `empty-states` +
`refused-query` **3/3 suites, 79/79**; `vib001-members.look.ts` **exit 0 ×3**, 60 shots each.

### What the twelve unseen pictures showed

| page | before | after |
|---|---|---|
| `/meetings/{id}` | **the weakest page in the gate** — when and where as two unlabelled grey lines | `12 January 2099 · The hall`, one composed line, as `MeetingRow` already ruled |
| `/announcements/{id}` | body across the full §C 1200 — ~210 characters a line at 1900 | date + body in a `PROSE` 640 measure, as one record |
| `/post` | 🔴 **three left edges** — band 64, heading 304, footer 64 | one left edge; forms capped at 720 |
| `/account` | same three left edges | same fix |

🔴 **The `/meetings/{id}` defect is the one to learn from: it was a DECISION THAT HAD ALREADY BEEN
MADE.** `MeetingRow` carries the ruling in writing — *"one meta line, not two"* — and the detail page
was the exact shape that ruling was written against. **A member who pressed `Details` got a LESS
composed version of what they had just read.** Nothing had ever rendered that page, so the row and
the page it opens had never been seen together.

### The two rulings Richard gave (now `RICHARD-RULINGS-2026-09-01.md` §I)

1. **`/unsubscribe` vs D39 — *"D39 stands, accept the slack."*** 🔴 **The ~290px/~470px of space on
   that page is a RECORDED CONSEQUENCE, not open work.** It has been rediscovered and re-argued four
   times. Do not fix it, do not re-derive it.
2. **`/post` + `/account` — *"head on 1200, form panels capped at 720."*** Built as
   `AT_FORM_MEASURE`. ⚠️ **This does NOT reopen §C's departure on the four DOOR pages** —
   `/sign-in`, `/join`, `/setup`, `/unsubscribe` keep `FORM_GROUND` at 720 centred.

### Item 5's header row — **decided NO**, from the render

`/directory` at 1900 reads `Ada Newcomer` · `ada@example.invalid` · `Member · since 1 September
2026`. **A header would restate three things the data already says**, and below 700px the `Columns`
folds to `smallLayout: '1'` with no runtime rule that can hide it. The original symptom — ~250px
between a name and its email — **was fixed by s10**. Priced, not skipped.

## ✅ SESSION 14 — the phone column is read, and one "defect" turned out to be the harness

**Full write-up: [`TASKS.md`](TASKS.md) §"what session 14 did".**

1. ✅ **All fifteen phone renders opened** — 15 covers the 13 pages, since `/` and `/members` are
   photographed in both states. 🟢 **Nothing is broken at 390.** The three caps this row added are
   correct no-ops below their breakpoints; `/directory` folds to one column and **s8's
   `ada@example.invali / d` break is gone**.
2. ✅ **`/join` graded at all four widths — and its finding was a NON-finding.** Its footer sits on
   1200 while its hero and form sit on 720, but `/sign-in` does the same, so it is consistent across
   the four door pages and is the shape Richard already ruled acceptable. **Priced. Do not
   rediscover it.**
3. 🔴 **`/requests` was showing the applicant's name twice — and it was the SEED, not the product.**
   The harness was posting `message: `${name} would like to join.``, inventing the applicant's
   reason out of their name. `JOINERS` now carries real reasons. **The page a moderator sees was
   never wrong; the photograph was.**
4. ✅ **Re-render control: 32 of 36 text dumps byte-identical** to s13's, the 4 that differ being
   exactly the `/requests` ones. The harness is deterministic and s13's pictures were honest.

## 🔴 ROW 6 IS REOPENED — read this before believing anything above it

**2026-09-02. Richard, shown the artifact of all thirteen pages, pointed at a DIFFERENT page:**

> *"This is the one where I said 'this is fucking pro'... all the other ones that you're showing me
> in the artifact were the ones I said looked like oldschool Wordpress templates, passable but
> nowhere near this."* — `verdicts/vib-006/2026-08-31/landing-door/landing-desktop-full.png`

🔴 **The benchmark this board gave every session was circular.** *"Grade each page beside `/` at the
same width"* pointed at the members-area's **own** landing page — which he puts in the *passable*
bucket. Twelve pages were certified *"as good as the homepage"* against a homepage he does not rate.
**The comparison could not fail, and it did not.**

🔴 **The "chrome exemption" below is a SESSION'S SENTENCE, not his ruling.** It is what licensed the
gap. Do not quote it as the bar until §3.1 of [REL-010](REL-010-AS-GOOD-AS-THE-PAGE-HE-RATED.md) is
ruled.

**Measured, not argued** — [`vib001-members.poverty.look.ts`](../../../packages/nodegx-backend/tests/vib001-members.poverty.look.ts),
VIB-006 as a known-silent control in the same run. ✅ **s15 BUILT the fix; both columns are on one
runtime** (the baseline was re-taken after a peer's webpack rebuilt `noodl.viewer.js` mid-session,
and it reproduced exactly):

| arm | headline | `<img>` | icons | grounds | tells |
|---|---|---|---|---|---|
| **CONTROL — VIB-006** | **94px** | **7** | **20** | **6** | **none** |
| members, door ×4 | 30 → **72** (`/unsubscribe` **48**) | 0 → **3** (`/unsubscribe` 0) | 0 → **2** | 2–3 → **4–5** (`/unsubscribe` 2) | **none** |
| `/` living | 48 → **94** | 0 → **3** | 0 → **2** | **4** | **none** |
| members, signed-in ×8 | 30 → **48** | 0 | 2 → **4** | 2 → **3** | **none** |

🟢 **13 of 13 read clean, from 0 of 13.**

🔴 **The root cause of the type gap was ONE PARAMETER and it was an override of the product's own
fix.** `displayHeadline` already carried `--display-lg`; VIB-002 put it there *because* the
members-area hero was stuck at 48px. `tpl001Components.ts` then overrode it back to `--text-5xl`.

⚠️ `no-imagery` is blind to CSS backgrounds — **never quote it on the hero pages**. The real fact was
**zero `Image` nodes in thirty components**; there are now real ones, and the four public pages carry
three rendered photographs each.

⚠️ **Two cheap wins were REFUSED as instrument-gaming and the refusals are the useful part** — see
REL-010 §6.5. Painting `PAGE_GROUND` would have moved the ground count and changed no pixel; stock
avatars on `/directory` would be a claim about what real members look like.

**Everything below about row 6 being nearly done was written before this and is superseded.** Rows 7
and 8 stay behind **AC6, which is Richard's look and nothing else**.

### 🔴 Two things landed AFTER the build, late in s15 — read them before quoting §6

1. **§6.9's typeface claim was CORRECTED, by a peer, and the correction is the useful part.** The
   starter-assets fix is sound and its evidence is the **photographs** (three observed
   `image/load-failed` lines). The first draft also claimed every earlier drive rendered *"with no
   typeface"* — **false**: this template sets `--font-sans` as a **custom token**
   (`"Source Sans Pro", "Segoe UI", …`), so Inter is never requested, installed or absent. ✅ **The
   committed renders are therefore FAITHFUL to a real install**, which is what AC6 is read from.
   🔴 The error shape, because this row keeps meeting it: **a finding with two halves, evidence for
   one.** The photographs half was observed; the typeface half was inferred from the same file list
   and rode on its credibility. **Write the claim at the width of the evidence.**
2. 🔴 **R8 is a PRODUCT defect and it is why (1) happened.** `templates/members-area` ships
   `--font-sans` whose **description** says *"Inter, falling back to…"* while its **value** contains
   no Inter — and that string is the **only** occurrence of `Inter` in the artefact, so a grep
   returns one hit and the hit is untrue. Authored by
   [`StyleTokensModel.ts:161`](../../../packages/noodl-editor/src/editor/src/models/StyleTokensModel/StyleTokensModel.ts#L161),
   which inherits the DEFAULT's description when a preset overrides the VALUE. **11 of 45 described
   tokens state a value; `--font-sans` is overridden by 4 of the 5 shipped presets**, so most new
   projects carry it. ⚠️ **Do not "fix" it by dropping the description on override** — that discards
   the 34 role descriptions, which are the ones worth keeping. **Owner: phase 81. Not this row's, and
   it blocks no AC here.**

## 🔴 SESSION 16 — the whole run sheet is now RICHARD'S, and a session took the one row it could

**Read this before taking a row.** Session 16 re-derived the board from the task files and found
that **rows 6, 6b, 7 and 8 all wait on Richard and a session cannot advance any of them**:

| row | what it is waiting for |
|---|---|
| **6 / 6b** | **AC6 — his look**, against `verdicts/vib-006/…/landing-desktop-full.png`. AC1–AC5 are met and re-measured; a session cannot close a person |
| **6b, R6** | one word from him on `/unsubscribe`'s 2 grounds, which **AC4 names neither group of** |
| **7** | his call on **when to publish** — the recommendation is unchanged, *fix first, publish once* |
| **8** | `cline-dev` is far ahead of `origin/cline-dev` — **613 at the start of s16, 618 by the end of it** (580 at s13). Peers commit *during* sessions, so 🔴 **re-derive at cut time, never quote a number from this board.** CI has run on none of it |

🔴 **So do not open row 6 again looking for building to do — there is none, and s15 already said so.**

**What session 16 built instead: [REL-009a](REL-009-THE-WRITE-THE-EDITOR-CANNOT-SEE.md), which is on
this board (TASKS.md row REL-009a) and which [the README §2](README.md) says a launch session may
build without asking.** It is 🟢 **CLOSED** — measured, then fixed, then driven again. Commit
`40a80bf5`.

- 🔴 **The clobber-on-quit warning in four phase-55 handoffs was WRONG and is now corrected in
  place.** A quit with nothing pending wrote **nothing at all**. Arms A, B, D all passed.
- 🔴 **Arm C is real: two writers on the SAME component is silent last-writer-wins.** And on `/App`
  it costs a whole page — dropped from the router, files and registry entry left behind, so
  **nothing on any surface looks wrong**.
- ✅ **Fixed and verified in the running app**, negative control first.
- 🔴 **A PRE-EXISTING spec caught a regression in the fix's first draft.** The guard could not tell
  *"an agent wrote this"* from *"we wrote this and rewound our own bookkeeping"*. **A new check does
  not have to be wrong to be dangerous — it has to be unable to tell two situations apart.**

### The next buildable row is REL-009b, and it is the real fix

`reloadComponentFromDisk` still has **zero callers** and there is still **no filesystem watcher
anywhere in the editor** (re-derived at HEAD, 09-03). REL-009a's guard makes the loss visible;
**REL-009b makes it not happen**, because the watcher advances the baseline as the write lands.
🔴 **Its known cost is on the board: once a component is refused it stays refused until the project is
reopened.** Do not close REL-009b believing REL-009a already solved it. Read
[REL-009 §3 and §4 U3](REL-009-THE-WRITE-THE-EDITOR-CANNOT-SEE.md) first — **U3, whether the canvas
survives a model swap underneath it, is where that task gets expensive**, and D1 (`fs.watch` vs
`chokidar`) is **unruled**.

## The run sheet

Take the topmost row that is not ✅.

| # | row | why here | needs |
|---|---|---|---|
| ~~1–5~~ | ~~REL-007/006, REL-005, REL-003, REL-002a, REL-002b~~ | ✅ **CLOSED s1–s5** | — |
| **6** | **REL-002c — every page as good as the homepage** ⏳ **RICHARD** | 🔴 **REOPENED 09-02** — graded for 14 sessions against the members-area's OWN `/`, a page Richard puts in the *passable* bucket | ⏳ **REL-010's building is DONE; both wait on the same look** |
| **6b** | 🟢 **[REL-010](REL-010-AS-GOOD-AS-THE-PAGE-HE-RATED.md) — as good as the page he actually rated** | §3.1 RULED and BUILT s15. **13 of 13 pages now read clean**, from 0 of 13. AC1–AC5 met (AC3 declined on the nine, in writing; AC4 has a hole at `/unsubscribe`) | ⏳ **AC6 — RICHARD'S LOOK. A session cannot close it** |
| 7 | **REL-001** publish + drive the install ⏳ **RICHARD** | shelf's first row; also closes P75's FB-005 | ⏸️ **HOLD** — see below |
| 8 | **REL-004** cut, tag and publish `v0.2.2` ⏳ **RICHARD** | last | 🟡 **AC1 done s11** (`5c805978`). 🔴 Blocked: `cline-dev` unpushed |
| **9a** | 🟢 **REL-011a — the 53 controls** | **CLOSED s17 `d88368c5`** — 53 of 53, from 1 of 53 | — |
| **9b** | **REL-011b — operable on the artefact a person publishes** ⬅️ **THE NEXT BUILDABLE ROW** | D54, the zero-buttons arm, and nine unphotographed `/admin/*` routes | 🔴 **Two ACs are UNDIAGNOSED — settle harness-vs-product before fixing** |
| 9c | **REL-011c — the three surfaces reach PASSABLE** ⏳ **RICHARD** | needs 9b | ⏳ his look; a session cannot award it |
| 10 | **REL-009b — the editor sees the write** | the real fix behind REL-009a | ⬜ buildable; D1 unruled, U3 expensive |

### ⏸️ Why row 7 still waits

Row 7 publishes `templates/members-area` to the shelf, and **row 6 has changed that artefact three
times today**. ✅ **Re-publishing is supported and safe** — `publish-project-template.ts` re-run
against an existing row leaves visibility where it was — so this is genuinely Richard's call, and
the recommendation is unchanged: **fix first, publish once.** Ask when his look is booked, not now.

## 🔴 Hazards that bit this row before, carried forward

1. 🔴🔴 **EVERY `Group` WITHOUT A `sizeMode` IS `flex-grow: 100`.** `addDimensions` defaults
   `sizeMode` to `explicit` and `height` to `100%`, and
   [`layout.ts:98`](../../../packages/noodl-viewer-react/src/layout.ts#L98) turns a percentage height
   inside a **column** parent into `flexGrow`. ⚠️ **s13 relied on the other half of this and checked
   it**: `AT_FORM_MEASURE` sets a `width` and no `sizeMode`, which is safe *only* because
   `PAGE_GROUND` is `contentHeight` and has no slack to share out. ✅ **Pin anything that must stay
   content-height before giving an ancestor a floor.**
2. 🔴 **A FIX'S STATED MECHANISM CAN PAINT NOTHING.** Item 4's `minHeight: 100vh` on `PAGE_GROUND`
   would have changed no pixel — that Group carries **no `backgroundColor`**. ✅ **Check the artefact
   for the property the fix needs.**
3. 🔴 **FOUR TIMES IN THIS ROW, A LAYOUT COMPLAINT HAD A CONTENT ANSWER** — and 🔴 **s13 is the
   counter-example that stops this becoming a reflex.** The remaining space on `/unsubscribe`,
   `/announcements/{id}` and `/meetings/{id}` has **no** content answer: a short record is short, and
   every candidate is new product surface on a page whose data model holds nothing more. ✅ Ask what
   is missing before what is mis-sized — **and accept "nothing" as an answer.**
4. 🔴 **A DECISION RECORDED IN A COMMENT IS STILL A CLAIM — this landed for the THIRD time in this
   row, and s13's instance is the sharpest.** `Members/Chrome` said *"they are now the same 1200"*;
   it was true of six of the eight signed-in pages and **nobody had rendered the other two**. ✅
   **Re-derive a recorded decision against the picture before inheriting it.**
5. ⚠️ **DELETING A CONTROL DELETES MORE THAN THE CONTROL.** ✅ **Grep for the id after removing a
   node.** ⚠️ **And check for an id COLLISION before adding one**: s13's first draft named a new
   `Group` `record` on both detail pages, where `record` was already the `DbModel2` every connection
   fires from.
6. 🔴 **A DELETED AFFORDANCE REDDENS THE SPEC THAT USES IT AS A CONTROL — RE-POINT IT, DON'T DROP
   IT.** `tpl001-members-drive` §5 AC4 uses the moderator's offered buttons as the **positive
   control** for two negative arms.
7. ⚠️ **A GATE CAN BE A HARD COUNT IN SEVERAL PLACES, AND THE ARGUMENT ABOVE IT IS THE PART THAT
   MATTERS.** s13 moved `tpl001Template.test.ts` §6 from `1` to `3` and **rewrote the paragraph**:
   it had read *"today exactly one page stacks two sections"*, which the change made false. A silent
   increment would have hidden the finding.
8. 🔴 **NEVER OPEN `templates/members-area` IN THE EDITOR.** `readBundleDirectory` has **no skip
   list of any kind** — opening writes `.mcp.json` (with absolute paths from this machine),
   `CLAUDE.md` and a `.gitignore` block, and **all three would ship**. ✅ Work through
   `npm run template:members`.
9. 🔴 **GATE ON AN EXIT FILE YOU WRITE YOURSELF.** ⚠️ **`timeout` does not exist on this Mac** —
   `command not found` piped into `echo "EXIT=$?"` reads as **`EXIT=0`**.
10. ⚠️ **A SEED CAN MAKE A FIX UNPHOTOGRAPHABLE.** Every `ANNOUNCEMENTS` body in
    `vib001-members.look.ts` is one short sentence, so **no render this harness can take will show a
    paragraph wrapping** — the `PROSE` 640 cap is asserted from `nodes.json`, not from a picture.
    Say which of the two you have when you claim a measure is right.

11. 🔴 **AND A SEED CAN MANUFACTURE A DEFECT THAT IS NOT THERE — the inverse of 10, found in s14.**
    `/requests` showed the applicant's name as the heading and again as their own words, at all four
    widths, because the harness posted `message: `${name} would like to join.``. **The product was
    correct; the photograph was not.** ✅ **Read the seed beside the picture before filing what the
    picture shows** — this row was one session away from Richard filing a defect against a page that
    does not have one.
12. 🔴 **THE LIVING ARM'S `artefactMd5` IS NOT A CONTENT FINGERPRINT, AND THIS BOARD SAYS IT IS.**
    `bindProjectToBackend` writes an **OS-assigned ephemeral port** into the copied project file
    before `judge()` hashes it, so **the living md5 changes every run even when nothing changed** —
    s14 moved it `ed8a32db → e6bea8be` while editing only a test file. **The door arm is sound**
    (`f969ad96…` equals the template on disk, which is the pin to cite). ⚠️ **s13's citation of a
    living-md5 progression as evidence of its edits is void** — the edits were real, the hash was
    never the evidence. Registered in [`TASKS.md`](TASKS.md) §4; owner REL-002c.

13. 🔴🔴 **A PEER'S WEBPACK REBUILT `noodl.viewer.js` BETWEEN A BASELINE AND ITS AFTER-RUN — R3, live
    rather than historical.** s15 measured the baseline on md5 `8c0ad51b…` at 22:25; the bundle became
    `e35ea918…` at 22:42, mid-session, and a peer had announced twenty minutes earlier that the watch
    was torn down and the bundle static. **It was not.** ✅ **Record the md5 BEFORE AND AFTER every
    run** — a pin read once cannot tell you a rebuild landed inside the window. ✅ **And a baseline is
    re-takeable**: `TPL001_TEMPLATE_DIR` points a run at a `git archive` of the committed artefact, so
    the artefact can be rolled back while the runtime stays current. s15's re-take reproduced the
    original baseline exactly, which is what made the before/after admissible.
14. 🔴 **THE CHEAPEST WAY TO MOVE A MEASUREMENT IS USUALLY AN EDIT TO THE INSTRUMENT'S VIEW, NOT TO
    THE PAGE.** Two were available and refused in s15, in writing, in
    [REL-010](REL-010-AS-GOOD-AS-THE-PAGE-HE-RATED.md) §6.5: painting `PAGE_GROUND` with
    `--background` would have taken all nine app-chrome pages from 2 distinct grounds to 3 **and
    changed no pixel**, because that is the colour the ground already appears to be. ✅ **Ask what a
    person would SEE differently.** If the answer is nothing, the number moved and the page did not.
15. ⚠️ **A COMPOSITION CAN ALREADY CARRY THE FIX AND THE TEMPLATE CAN BE OVERRIDING IT.** The whole of
    the `no-display-type` finding on twelve pages was `{ ...composition('displayHeadline'), fontSize:
    'var(--text-5xl)' }` — the composition shipped `--display-lg`, VIB-002 having put it there *for
    this exact page*. ✅ **Before designing a fix, diff what the composition gives against what the
    template kept.** ✅ **And census the BENCHMARK before promoting a ramp**: VIB-006's section
    headings are 30px, the same as this template's, so promoting those too would have re-flattened
    the ramp one tier higher and moved the number the wrong way for the right-looking reason.

## Row 8 — done and blocked parts

✅ **AC1 met s11 (`5c805978`):** `packages/noodl-editor/package.json` reads `0.2.2`, gated on
`npm run ci:build:editor` **exit 0**. Two findings are in
[the runbook §2](../release-0.2.2/PUBLISH-0.2.2.md): the nine `library/prefabs/*/library.json` files
that also read `0.2.0` and must **not** move, and why the `package-lock.json` copy is **not** a gate.

🔴 **Still blocked on Richard:** `cline-dev` is a long way ahead of `origin/cline-dev` (**618 at 2026-09-03 08:0x; 613 four hours earlier, 580 at s13 — it moves while you work**), `origin/cline-dev` is at
2026-08-21, CI has run on none of it. **Derive the count again at cut time.** ✅ **Tag at `5c805978`
or later** — anything earlier carries `0.2.0` in `artifactName`.

## Working rules for this tree

🔴 **The tree carries a large amount of other work in flight, and peers are committing.** The
`headSha` recorded in s13's last two render manifests **differ from each other** — two peer commits
landed during a single 14-minute run. ✅ **Commit by pathspec, never `git add`** — except untracked
paths, which a pathspec commit **skips silently** (`git status --porcelain | grep '^??'`, and check
whether a `??` is a **directory**).

🔴 **`scripts/devtools/render-from-disk.js` is UNCOMMITTED and LOAD-BEARING.** Its working-tree diff
(`md5=1557f527…`, mtime 09-01 11:38) makes the harness serve **the product's own host stylesheet**
instead of a bare reset — which is what makes every `unreachable=0px` a statement about the product
rather than about the instrument. **If it is reverted, every fold reading since 09-01 is void.**

⚠️ **And it is not a peer's.** Its own docstring says **REL-002a** — this phase's row 4. s11 and s12
both recorded the whole 11:35–11:50 mtime cluster as *"another session's in-flight work"*, and at
least this one file is **ours**. ✅ **Read that cluster before the cut rather than inheriting the
label** — *"a peer's"* is a relayed conclusion nobody has re-derived.
