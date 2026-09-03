# Phase 82 — task board

**Status legend**: ⬜ not started · 🟡 in progress · 🟢 done · 🔴 blocked · ⏸️ held (deliberately out)

🔴 **READ [`RICHARD-RULINGS-2026-09-01.md`](RICHARD-RULINGS-2026-09-01.md) BEFORE BUILDING ROWS
6, 7 OR 8.** Richard ruled fifteen open questions on 2026-09-01. **Two of them amend ACs written on
this board** — REL-002c's scope is now **all thirteen pages**, and REL-001's category is
**`starter`**, not `data-app`. ✅ **All fifteen are settled — nothing in that file awaits him.**

Re-derive this board from the task files and the artefacts at session open. Do not trust a
handoff's copy of it — §1 of the [README](README.md) records three readings that contradicted a
task file on the day this phase opened.

| id | task | status | depends on | note |
|---|---|---|---|---|
| REL-001 | The shelf's first row — publish the association template | ⬜ | REL-002 | P78 **T5**. Richard drives the publish. **No code blocker**: T6's three fixes are in at HEAD (README §1.3), and the publish path was driven end to end locally by P80/DEF-007 s41. Needs no app release (README §1.2) | ✅ **s25 cleared the one finding s24 handed this row**: the artefact now ships a document outline and landmarks (REL-002c §8), so the thing Richard publishes is no longer a pile of `<div>`s
| REL-002a | The ambush defaults the template sits on | 🟢 | — | **CLOSED s4** — [REL-002a](REL-002a-THE-AMBUSH-DEFAULTS.md). 🔴 **The scroll defect is `settings.bodyScroll`, not `sizeMode`/`scrollEnabled`/`clip`** — six rendered arms, one parameter apart, say so. The template went **0/7 and 0/6 reachable controls to 7/7 and 6/6**; `create_project` now writes it; `PageCannotScroll` ships in both gates; V14 fixed in **two** source copies. ⚠️ `render:report` could not see the defect at all until this session fixed its host page |
| REL-002b | Fail closed, and a designed first run | 🟢 | REL-002a | **CLOSED s5** — [REL-002b](REL-002b-FAIL-CLOSED.md). 🔴 **V3's recorded mechanism was WRONG**: the content was never revealed (six `mounted: false` defaults were already there); the defect was that **nothing refused** — all six stayed on the protected URL wearing a `Sign out` band — and five of six said nothing. Built `Denied` (2 producers) + `isSignedIn`; **V4 was `actions`, the one group with no `mounted: false`**. Driven **37/37**, four arms, real enforcing backend. 2 defects registered, owner `NONE` |
| REL-002c | Every page as good as the homepage | 🟡 | REL-002a, REL-002b | 🔴 **REOPENED s11 BY RICHARD** — *"I want all pages looking as good as the homepage."* **s13: all thirteen photographed at last** (12 shots had never existed); `/meetings/{id}`, `/announcements/{id}`, `/post` and `/account` fixed; **both open questions RULED** — §I of the rulings file. 🟢 **s24 — the phone column is READ and `/join` is OPENED**, on a re-run at HEAD (§7 of the task file; `vib-001/2026-09-03/members-area-{door,living}`, `EXIT=0`, 60 shots). **No breakage on any of the thirteen**: `unreachable=0`, nothing clipped or overlapping. 🔴 **The old pictures could not be shown to be of the shipping artefact — `artefactMd5` hashed 1 file of 98** (8K of settings against 648K of components) and read IDENTICAL across a 19-file change, while `headSha` named a commit the tree did not match. `md5Tree()` + `artefactTreeMd5` built, the during-run check widened from 1 file to 98, and the door test's *"served bytes are the shipped bytes"* now asserts `components/` instead of one file. ✅ **And the re-run says his pictures were FINE — 113 of 120 PNGs byte-identical**, the 7 that moved are `/directory` alone and the only text change in the run is its seeded join date, `2 September` → `3 September` (it reseeds daily — know that before reading a future diff). 🔴 **Four judgements for Richard, none a fault**: 44.2% of the first PHONE screen is chrome on 8 pages (y=373 of 844, against 30.6% at desktop — the nav is one row at 1280 and a 2×3 grid at 390); the *"What members can see"* block is on 6 of 13 pages including `/setup`, the owner's first-run task; `/unsubscribe`'s void is D39's ruled consequence and starker on a phone; `/` and `/members` unauthenticated are byte-identical. 🔴 **NEW, registered not built: the template has ZERO semantic tags in 100 files** — 0 of 60 shots carry an `h1`/`h2` against 24 of 24 for the site builder, which ships 26 `as` tags. One seam, `pageHead()`. **Owner: REL-001 — it is a property of the artefact Richard publishes.** ⏳ Then it is RICHARD'S LOOK. A session cannot close this row — PASSABLE never closes, and §A2a reserves six pages for him | 🟢 **s25 — §7.4's registered finding BUILT: the template went from **0 semantic tags in 100 files** to **63**, one `h1` and one `main` on each of the thirteen pages, `header`/`nav`/`footer` on the chrome and the foot. Render-time reading **0 of 60 shots → 60 of 60**; **120 of 120 PNGs byte-identical**, so nothing a person sees moved. Five-spec gate in `tpl001Template.test.ts`, **driven red on three mutants** — [REL-002c §8](REL-002c-WHAT-I-WOULD-CHANGE.md)** | 🟢 **s26 — §8.5's registered item 2 BUILT, and it was bigger than it was written: the `h1` was outside the `main` on **TWELVE of the thirteen pages**, not the nine §8.5 named (the three door pages and `/join` had it too; `/` alone was right, because it had no `ground` to take the shortcut on). `PAGE_GROUND` loses `as: 'main'`; `pageMain` (11 pages) and `joinMain` (the twin of `landingMain`) carry it, wrapping the head band AND the ground — with the chrome deliberately left OUT, which is the arm a cheap fix gets wrong. 13 of 100 files changed, **553 → 565 nodes**, **493 connections both sides**. 🔴 **The gate that shipped the tags one session ago stays entirely GREEN on the defect** — a census counts an `h1` and counts a `main` and cannot see that they are siblings; **§8.7** asserts the relationship and was driven RED on the s25 artefact, on the `main`-on-`pageBody` cheap fix, and on a missing chrome. 🔴 **And a parameter is an intention** — so **§11** of `tpl001-members-drive.test.ts` takes the same claim in a real browser over the 20 loads it already makes: **0 of 17 → 20 of 20**, with the band's `<nav>` as the control that separates *in the document* from *inside the main*, and driven RED on the reverted artefact. **200 of 200 PNGs identical** while `artefactTreeMd5` moved on both arms, so nothing a person sees changed and the shots are of the new artefact — [REL-002c §9](REL-002c-WHAT-I-WOULD-CHANGE.md). ⚠️ **REL-010 AC4 and §8.5 both say "the nine chrome pages"; the artefact says EIGHT** — the gate now asserts it. ⏳ Only Richard's look is left**
| REL-003 | The stale bundles the cut inherits | 🟢 | — | **CLOSED s3.** AC1 amended and met (rebuilt, reproducible, correctly NOT committed — REV-008). AC2 met for **MCP** (s2, live control pair), **DEF-023** (s3, pre-fix control bundle, `stale`→`fresh`) and **DEF-026** (s3, real browser, both halves, answering control). 🔴 **AC2's DEF-021 clause is RETIRED as unmeetable by a drive** — the coalescing branch is unreachable from a graph and pre-fix/HEAD are behaviourally identical (§ below, owner `NONE`). 🔴 `cloudruntime` names a **retired** artefact (WF-007) |
| REL-004 | The cut — `0.2.2` | 🟡 | REL-003, REL-005 | **AC1 met s11** (`5c805978`). Notes + runbook drafted. 🔴 **Blocked: `cline-dev` unpushed — 580 at the start of s13 and peers committed twice during it, so RE-DERIVE the count at cut time. Richard pushes** |
| REL-005 | What rides and what rolls | 🟢 | — | **CLOSED s2.** All four open rows and all five phase-74 carry items are marked, in writing, in P75's own board — plus a triage section at its head. ⚠️ Re-counted: **22 done, 4 open of 26**, not 24/4 |
| REL-006 | The hold list, and two stale files | 🟢 | — | Record the site-builder hold with a named owner; correct P78's handoff (T6 reads open, is done) and P78's `TPL-001` **AC1** (it waits on T5, which is now unblocked) |
| REL-007 | The price that goes stale tomorrow | 🟢 | — | `models.ts:229` reads `$2/$10`. Sonnet 5's introductory pricing ends **2026-08-31** — from 1 September the standard rate is **$3/$15**, and the app's default model is Sonnet 5. One line; cost reporting misreports until it lands |
| REL-008 | **Code export rides 0.2.2** — P18's EXP-012 | 🟢 **RULED 2026-09-01, rides** (*"I think it can ride 0.2.2"*). Editor-path export built: `npm run build` exit 0, 235 kB JS. Release-notes line added | REL-004 | Settings → Project → *Export as React code…* was built and driven by P18 s67 (2026-09-01) on Richard's *"if we make good progress we can include it"*. Four editor files + one webpack alias; editor `tsc` 0, export jest 1248/1248, runtime 2615 passed. Owner **P18**; the facts and the caveat are in [EXP-012](../phase-18-code-export-v2/EXP-012-THE-EDITOR-EXPORT-COMMAND.md). If it rides: a release-notes line. If it holds: nothing to undo |
| REL-009a | Does a quit eat the agent's work? | 🟢 **CLOSED 2026-09-03** | — | **Driven, four arms, three editor sessions, real MCP over stdio, real `app.quit()` in the main process. Write-up: [REL-009 §2.1](REL-009-THE-WRITE-THE-EDITOR-CANNOT-SEE.md).** 🔴 **The clobber-on-quit claim we relayed four times is WRONG:** a quit with nothing pending wrote **nothing at all** (21/21 files byte-identical), and arms A, B and D — the presence controls — all passed. 🔴 **Arm C is real and it is worse than a lost string:** the human editing *any node* in a component an agent also wrote makes the editor write its whole in-memory copy over the file — no conflict, no prompt, no diagnostic. **Arm C2:** when that component is `/App`, a page the agent added is silently dropped from the router while its files and registry entry stay, so nothing on any surface looks wrong. ✅ **AC3/U1 answered by driving with a control** — the MCP server refuses a legacy project (EXIT=2) and serves a v2 one (EXIT=0), so the monolithic full-write path is not reachable this way. ✅ **AC4 BUILT AND DRIVEN** — `findExternallyChanged` re-reads the change set, refuses a component whose file moved, leaves its baseline so the next save retries, and reports it as a toast. Re-driven in the running app: MCP's write **survives**, and the person is told. **Negative control first** — an ordinary save still lands, silently. 🔴 **A pre-existing spec caught a regression in the first draft** (it read our own rolled-back write as an external one and stranded the retry); fixed, and graded by a spec of its own. `test:ci` **2934 specs, 4 failures — all four AIX-006, by name**. 🔴 **Known cost: once refused, that component stays refused until the project is reopened — REL-009b is what removes it.** ✅ **AC5** — the four phase-55 handoff files are corrected in place (REL-009 said five; only four exist) |
| REL-009b | The editor sees the write | 🟢 **CLOSED s21 — ALL FIVE ACs MET** | REL-009a | [REL-009 §3.1](REL-009-THE-WRITE-THE-EDITOR-CANNOT-SEE.md). **The seam has a caller at last** — a `fs.watch` watcher (`services/ProjectFileWatcher/`) maps changed files onto registry component paths, debounces, and hands them to `reloadComponentFromDisk`. 🟢 **AC2 PHOTOGRAPHED**: an MCP write reaches the open canvas without reopening the project — `Second page → Marker → WATCHERPROOF → SECONDPROOF → CANVASPROOF`, tab never left `Second`. 🔴 **U3 is answered and the answer was NO: THREE listeners treat the swap's removal as a deletion, across TWO event buses** — the node graph (navigates to the default), the navigation history (`discardInvalidEntries()` runs BETWEEN the remove and the add, when the name resolves to nothing) and — the one that survived the first build — `EditorEventBindings` on **`NodeLibrary`'s `typeRemoved`**, which called `switchToComponent()` with nothing. **A flag on `componentRemoved` reaches only the listeners on `componentRemoved`**; the instrumented drive logged `switchToComponent(UNDEFINED)` between the remove and the add, and that line is the whole finding. ⚠️ The follow-hook now answers *"were we showing it?"* at REMOVAL time rather than reading `activeComponent` at reload time — reading a value another listener may have moved is the fragility, not the listener that moved it. 🟢 **AC4 MET, both sides intact**: with `Pages/Third` dirty in the editor, the reload is REFUSED, the human keeps their edit in memory, the agent keeps theirs on disk, and a toast says so (photographed). 🔴 **The load-bearing design decision: `reloadComponent` was SPLIT so the decision happens BEFORE the baseline moves** — advancing it and then refusing would leave REL-009a's `findExternallyChanged` blind to the conflict, so the next autosave would clobber the file the reload had just declined to apply; **the refusal would have disarmed the guard that makes refusing worthwhile.** Verified in the running product: `Third/nodes.json` byte-identical (`afa79b59…`) across a real autosave, agent's write intact, human's edit on disk **0 times**. 🟢 **AC1 echo suppression driven**: the editor's own save moved `Fourth/nodes.json` `5f52219a… → 06ee7eda…` and fired **0 reload events** — an absence beside a known-firing signal. ⚠️ **Ordering inside `decideComponentReload` is NOT interchangeable**: unchanged-vs-baseline before dirty, or the editor warns a person about a file it just wrote itself. 🔴 **AC3 (the preview) is UNMEASURED, not failed** — the model took the write and the preview did not, which looks exactly like the finding; **but the positive control (an ordinary editor edit) ALSO never arrived and the viewer's body was empty**, so a dead preview and a preview that ignores reloads are the same photograph. ✅ Next session: fresh stack, prove the control fires FIRST, then write through MCP. **D1 RULED: node `fs.watch`, no new dependency**, reasons + its Linux weakness in the module docstring, `watchFactory` injectable. Gates: watcher **16/16** (real-FS arm; 2 mutants, each reddening exactly its own arms), service **19/19** (5 new, REL-009a's 6 still green; mutant reddens exactly the 2 that pin the baseline property), `typecheck:editor` 0, `typecheck:editor-tests` 0. ⚠️ Registered owner `NONE`: `NavigationHistory.onComponentRemoved` compares a **string** to a `ComponentModel` and can never match — dead code that reads as live · 🟢 **AC3 CLOSED s21 — and the preview was never dead.** [REL-009 §3.2](REL-009-THE-WRITE-THE-EDITOR-CANNOT-SEE.md). 🔴 **s20's *"the preview had died"* was WRONG**: the fixture's router had **no start page** (wreckage of REL-009a arm C2) so it correctly showed nothing, and the toolbar's `⚠ 1` — present in every screenshot of two sessions and read as ambient — said so **in words**. 🔴 **Then a FOURTH listener was found, and it is the only one of the four that destroyed a person's project.** `RouterAdapter.componentRemoved` splices the page out of every Router's `routes` and clears `startPage`; **measured**, `/App` went `routes: ["/Pages/Third"], startPage: "/Pages/Third"` → `routes: []` **fourteen seconds after an agent added one node**, and the next autosave wrote it to disk — **REL-009a arm C2's silent page loss caused by REL-009b's own watcher.** ✅ **s20's lesson was right and its sweep was too small**: it enumerated the OTHER bus and never the rest of ITS OWN — `registeradapters.ts` fans `Model.componentRemoved` to every adapter that asks, and one of them WRITES PARAMETERS. Swept clear: `CloudFunctionAdapter` re-settles on both halves; no other consumer mutates. 🔴 **AC3's real answer was NO, and the seam is named**: `ViewerConnection` sends the swap as `componentRemoved`→`componentAdded`, which in `editormodeleventshandler.ts` are `removeComponentWithName` (tears down the LIVE INSTANCES) and `importComponentFromEditorData` (registers the MODEL only) — nothing re-mounts it, so the Router is left holding an empty page container. **And it does not merely fail to propagate: after the swap an ordinary editor edit no longer reached the preview either.** Fixed by taking the path `rootNodeChanged` already takes — a reload swap sends nothing on the removal and **re-exports** on the add. Driven both arms on the same bundle: before — agent write ⇒ **0 chars**, editor edit after ⇒ **still 0**, `/App` **destroyed**; after — agent write ⇒ **`AC3AFTERFIX` rendered**, editor edit after ⇒ **updates**, `/App` **byte-identical (`md5 3ccbabd0`)**. 🔴 **NEGATIVE CONTROL is what stops the fix being blunt**: an ordinary `componentAdded` (no flag) leaves the page intact with **no re-export** — a re-export on every add would also have passed AC3 and would restart a person's preview whenever they create a component. Gates: new `routerRouteRemoval.test.ts` **7/7** with **both** mutants reddening exactly their own arms (guard removed ⇒ the reload arm; guard widened to `!== false` ⇒ the two deletion arms), `tests-unit/rel-009b/` **23/23**, `typecheck:editor` **0 twice**, `test:ci` **2943 specs, 4 failures, seed 09154, HEAD `ef5e90f5` — all four AIX-006 by name at `:3959 :3963 :3981 :3985`** (the floor; exit 1 is the floor). Photographs `verdicts/rel-009b/2026-09-03/`. ⚠️ The decision lives in a no-import `routerRouteRemoval.ts` because `RouterAdapter` reaches Electron's `getUserDataPath()` at module load — a first draft importing the adapter could not run at all. ⚠️ **The preview takes ~10 s, not ~4**: a reading at 4 s said *"the control does not fire"* and was wrong. ⚠️ The viewer bundle was this session's rebuild (`04bc4829`→`1b5a4512`) carrying peers' DEF-046 (now `fc0ada95`) and SBR-008; both arms ran on the SAME bundle, which is what makes them comparable |
| REL-011a | The site builder's fifty-three controls, and the three that were styled | 🟢 **CLOSED 2026-09-03** | — | **53 of 53, from 1 of 53.** [REL-011 §REL-011a](REL-011-THE-SITE-BUILDER-SHIPS.md). 🔴 **The census spec was written to RED at HEAD and the red is recorded** — and it read **1**, not the 3 this row was opened on: §2 counted *any* `var(--…)`, which admits a lone `marginLeft`. 🔴 **The defect was the 25 text inputs and nothing else**: `options` and `checkbox` already draw a 2px box at their own node defaults, so they joined the palette rather than became visible. Root cause `.ndl-controls-textinput { border-style: none; background-color: transparent }`, confirmed three ways (node default, stylesheet, photograph); the product's port routing was already correct (`styleTag: 'inputWrapper'`), the template just never set anything. 🔴 **Two ports REFUSED as instrument-gaming** — `fontFamily` (P78 D18 already made it `inherit`) and the label ports (legible in the opening photograph); requiring them would have moved the number and no pixel. 🔴 **The first arm was correct and looked unfinished**: fields ~205px in a 700px card, fixed by `sizeMode: 'contentHeight'` **alone** — the `width: 100%` copied from members-area reddened `sbr012` with 26 raw dimensions and was redundant. Gates: `template:site-builder` exit 0, census 12/12, neighbourhood 7 suites 248/248. Pictures: `verdicts/rel-011a/2026-09-03/` + `vib-001/2026-09-03/` |
| REL-011b | Operable on the artefact a person publishes | 🟢 **CLOSED s19 — AC1, AC2 and AC3 all met** | REL-011a | [REL-011](REL-011-THE-SITE-BUILDER-SHIPS.md) §REL-011b. 🟢 **AC1 CLOSED s19 — D54, and the row described the wrong defect.** It read *"the presets are dead on the deploy — 0 of 7 fields changed, 0 requests, works in preview, inert deployed"*. **They were never dead.** Driven on the deployed bundle from an **empty** form: `Studio`, `Press` and `Night` each fill the five boxes with **`night`'s** values — `#d9a441 #14161a #eceae5 "Helvetica Neue"… 10px` — so *"0 of 7 changed"* was the right preset arriving twice on a screen that already held it. 🔴 **Two opposite diagnoses fit that reading; a set starting state is what separates them.** And there is no preview/deploy split: s46's preview drive pressed **Night**, the last chip placed and the only one ever right. **Cause**: three chips wire a `Component Inputs` constant, published at MOUNT, into the SAME `presets.in-name` — last placement wins — and `run` carries no payload, so a press says *now*, never *which*. ⚠️ SBR-009's `runOnChange-in-name: false` fixed the half a screenshot could see (the screen no longer BOOTS wearing Night) and left the value untouched — *a `runOnChange` census asks WHEN a node runs, never WHAT it reads*. **Fix**: `/Admin/PresetChip` publishes `{ name }` — its own — at the press, then fires `Picked`. ⚠️ An **object**, because a Function's `Outputs` proxy publishes only on change: the first draft sent the bare name, was right about which chip, and was swallowed on a **re-press** (Studio, Press, Night, **Studio again → Night**, measured on the deploy). Gates: new `d54ThemePresetIdentity.test.ts` **10/10** in the real runtime with the first-draft MUTANT and the **REVERTED pair** (every press answers night) beside it; `sbr009ThemeEditorDrive` **9/9 from 6, with exactly the three new arms RED on the reverted source**; `template:site-builder` exit 0; full `noodl-mcp` **91 suites, 1196/1196, exit 0**; `typecheck:mcp` 0. After-drive on the deployed bundle: **five presses, five correct palettes**. 🔴 **Why it survived eleven sessions**: the drive that existed only ever pressed `Night`, the one chip that was right, and the structural spec (*"every chip is wired to the picker"*) was true and cannot see that all three wire into ONE port · 🟢 **AC2 CLOSED-BAR-THE-PICTURE s18 — it was the PRODUCT.** Step-by-step probe either side of `service.stop()`: the page held **82 elements / 6 sections / 3 images / 2 buttons** with the backend up, three readings running, and **38 / 0 / 0 / 0 within one round trip** of the stop — so the harness is exonerated and the emptying is immediate, not a timeout. 🔴 **The arm's own control could not have seen this**: *“answered before the press — sent: false, refused: false”* is exactly what a BLANK page reports; a presence control now stands beside it. **Cause**: `dbcollectionnode2.ts`'s `fetch()` published its empty `Collection` on the **error** branch, so a failed query overwrote rows it had already delivered — `isEmpty` went true and every `For Each` below redrew nothing. SBR-011 gives three of this template's queries a realtime subscription and a dropped stream re-runs the query, so **any backend blip emptied every visitor's published page until they reloaded**. 🔴 It was the **odd one out of `fetch()`'s three failure exits** — the other two already leave the collection alone. Fixed with one guard; ⚠️ the **first** failure is deliberately unchanged (`[]` / `isEmpty: true` / `count: 0` as before), and this does **not** close P77 D4 (*a refused query and an empty collection are the same screen*), which is a different fix on a different owner. Gate `rel011b-failed-fetch-keeps-rows.test.ts` 5/5 with **exactly one spec red on the reverted source** and both no-change controls green in both arms; full `noodl-runtime` **150 suites, 2637 passed, exit 0**. 🟢 **The rendered after-arm is IN**: same harness, same seed, viewer rebuilt `8facb5b2… → c8d6228e…` (pinned both ends, guard confirmed in the minified text), and all three post-stop readings now read **82 / 2 / 3 / 6 / 3 — identical to backend-up**, where they read 38 / 0 / 0 / 0 / 0 before. 🔴 **The control: the query STILL FAILS** — both `query-records/query-failed` lines are in the after-run's console, so the fix stopped the failure deleting rows and did nothing else. 🟢 **`sbr005-sections.look.ts` now passes whole, 3/3, exit 0**, after three runs of AC3 failing — its refusal arm is observable for the first time. Shots in `verdicts/rel-011b/2026-09-03/after-the-fix/`; ⚠️ the phase-81 before-arm was copied out and **restored**, since `judge()` keys by `today()`. ⚠️ **Registered, owner `NONE`**: `nodes-deprecated/…/dbcollectionnode.ts:384` carries the identical unguarded branch and both are in the shipped bundle · 🟢 **AC3 CLOSED s19 — 24 shots, exit 0** (`vib001-site.look.ts` living arm, `md5=5e8dfaf9`, `head=3f95a804`), a superset of s17's 16 in the same directory. ⚠️ **The route count was wrong a THIRD time and the answer is TWO, not nine or four**: the look file's **door** arm has photographed `/admin/setup` and `/admin/signin` at four widths since it was written, so only `/admin/page/{pageId}` and `/admin/messages` had never been photographed on any date in any state. ✅ **Count from the verdict directories, not from the row.** Two enquiries seeded through `submitContactForm` as an anonymous visitor, because `ContactMessage.create` is `nobody` for everyone and a POSTed row would be a picture of a state the product cannot reach. **`/admin/messages` reads well.** 🔴 **`/admin/page/{pageId}` is the worst screen in the template** and seven findings are registered against it in [REL-011 §AC3](REL-011-THE-SITE-BUILDER-SHIPS.md) — headline: **A1**, the admin shell has no `smallLayout` anywhere and its `sidebar` is `240px` explicit, so at 390 every admin screen gets ~150px and `/admin/page` reports **2379px unreachable**; **A2**, the page editor overflows horizontally below ~1900 — at **1280** `Preview`, `Save page`, the `Slug` field, `Show in navigation` and `Add section` are all outside the photograph, so a client on a laptop cannot see the button that saves their page; **A3**, `unreachablePx` is a **vertical** measure only, which is why all twelve desktop/wide admin shots read `unreachable=0` while `Save page` sits off the right edge — **owner phase 81, the judge**. A1/A2/A4–A7 are **REL-011c**'s. 🔴 A ruling taken on the pictures that existed would have been a ruling about four screens out of six |
| REL-011c | The three site-builder surfaces reach PASSABLE | 🟡 **AC1 + AC2 MET s22 — the SIX product findings it owned are BUILT; AC3 is Richard's** | REL-011a, REL-011b | [REL-011](REL-011-THE-SITE-BUILDER-SHIPS.md) §REL-011c. Re-photograph the three SHITTY states at four widths on the FIXED artefact — 🔴 the existing pictures show **D40 as well as the design** (the Judge's harness never applied the template's `bodyScroll`; run record in `phase-81/verdicts/sbr-005/2026-09-03/`). **A session cannot close this: Richard rules** · 🟢 **s22 — A1, A2, A4, A5, A6, A7 BUILT, plus A8 and A9 found by looking at the after-arm.** Gate `rel011cAdminSurfaces.test.ts` **28/28 over the SHIPPED `site-builder.content.json`**, written to red and MEASURED red: the same file with HEAD's artefact copied over the fixed one reads **26 failed, 2 passed**, and the two survivors are the two preconditions that exist to survive. 🔴 **A2's mechanism was ONE node's EMPTY parameter bag** — `/Admin/SectionRow`'s `Image preview` stated no size, `Image` defaults to `contentSize`, so it rendered at its SOURCE's intrinsic width (1200px here, a phone photograph is 3×) and `layout.ts:82` left it `flexShrink: 0`. That made the editor's content column 1216px wide at every viewport; `min-width: auto` is `min(own stated width, content minimum)`, so above 1280 the rail came out of the content and at or below it `main` stopped shrinking and **pushed the rail off the right-hand edge**. The fields narrowed and `Save page` did not because they are two different boxes and only one was clamped. 🔴 **A1: the shell had NO breakpoint of any kind**, and `Columns`'s `smallLayout` — the runtime's only one — is the wrong tool because it would turn the fixed 240px rail into a PROPORTION and grow it to ~380px at 1900. `Screen Resolution` + one function moves four ports together below 760. 🔴 **A5's photograph showed a FIXTURE defect that was hiding the opposite PRODUCT defect**: `absorb` never writes `image` on a gallery, so the seeded `{image}` gallery was unreachable through the product — and a REAL gallery showed no picture at all beside a count saying how many. ⚠️ **The render caught a regression the first build shipped**: `flexWrap: 'wrap'`, authored only to make `rowGap` authorable, put Title above Slug and the live preview under the fields at **1900 as well as 390** — `flexWrap` now moves with the direction, and an arm pins it. Gates: `template:site-builder` exit 0; noodl-mcp **92 suites, 1224 passed, exit 0**; `typecheck:mcp` 0; both look harnesses exit 0. 🟢 **All sixteen admin shots now read `unreachable=0` with a named heading**, from `admin-page phone 2379`, `admin-theme phone 362` and `headings: []` on all twelve. Pictures: `phase-81/verdicts/vib-001/2026-09-03/` + `sbr-005/2026-09-03/`; the before-arm is committed at `d4d3400c`. ⏳ **AC3 — his ruling — is untouched, and A3 stays phase 81's** · 🟢 **s23 — the TWO RESIDUALS this row registered are BUILT**, one string and one node: the theme editor's preview no longer says *"follow the fields on the left"* (false at 390 since A9 stacked them above it), and `/Site/ContactForm`'s fixed `h2` is gone — 🔴 **the defect was a heading the AUTHOR CANNOT EDIT, not two headings**: `/Site/ContactSection` already carries one, wired to the record and mounted on `showHeading`, so a person who typed "Get in touch" into the panel read it twice on `/contact-only`. Pinned by a shared `headingsOf` predicate; **two arms redden on the reverted source, measured**. Gates: `typecheck:mcp` 0, `template:site-builder` exit 0, noodl-mcp **92 suites / 1226**, `sb007Template` byte-identical. 🔴 **And FIVE literal gates were RED AT HEAD, four of them not this phase's** — `sb017` acceptance 6 (38 vs 35, s22's), `sb-007` disjoint node ids (401 vs 393, s19's then s22's), `sb-018 (3)` naming `/Site/SectionView body` after SBR-005 deleted it, `sb-018 (1)` missing P77 AC2's `DropAt`/`DropIndex` and three wires (`12cc718a`, 2026-08-30), and `aib-007`'s table missing `noodl.cloud.listusersinrole` (P80/DEF-005 `ab677258`, phase CLOSED). All five fixed, each decomposition measured at its commit; baseline re-measured on the committed artefact first. **`template:site-builder`, the full noodl-mcp suite and both look harnesses are green with all five red — the two runners that see them are the ones a template session does not reach for** |
| — | ~~**The site builder** — held~~ | 🟢 **HOLD LIFTED 2026-09-03** | — | 🔴 **Richard reversed the 2026-08-31 hold** (*"I want to publish the association page template but not the site builder yet"*) and set the bar at **literally `PASSABLE`** — a deliberate relaxation of `phase-81/README.md` §83 (*"PASSABLE is recorded progress, never a close"*), put to him before it was written down. **It applies to REL-011 only; REL-002c and REL-010 keep the WORTHY bar.** ⚠️ **README §3/§4 still describe the hold as live** — they were not edited because `README.md` carries a peer's uncommitted paragraph and a pathspec commit would sweep it. Whoever lands that must strike §3's site-builder rows and add REL-011 to §4 |

---

## Task detail

### REL-001 — The shelf's first row

Publish `templates/members-area` as a **curated** template, and drive the install from a clean
launcher. This is phase 78's **T5**, carried here because 0.2.2 is the release it belongs to.

**Standing facts, measured** (README §1.2, §1.3):

- Curated templates are **served**. A published template reaches everyone already on 0.2.0 with no
  app update, and touches **no editor source** — so this cannot collide with P77 over
  `EmbeddedTemplateProvider.ts` or `ProjectTemplate.ts`.
- `shareAsTemplate` files a **submission** and publishes nothing. Publishing is
  `scripts/publish-project-template.ts`, a database-credential act. **Richard publishes**
  (R-templates, ruled 2026-08-22).
- The path was driven locally over a real socket in P80/DEF-007 s41 — picker row, install, and the
  installed project's `activeComponent`. Nothing was published to the live service.

**ACs**

1. The template is published as **`curated`** (✅ ruled §G4 — the alternative would route NodeGX's
   own flagship template through a submission queue Richard also operates; ⚠️ the picker badges it
   *Community* either way, which is a fact about **which service serves it**, not provenance),
   🔴 **`category: 'starter'`** — **not `data-app`**;
   Richard ruled 2026-09-01, *"data app sounds like it analyses data"*
   ([rulings §G1](RICHARD-RULINGS-2026-09-01.md)). This **amends TPL-001 AC8 too**, and any spec
   carrying the literal `data-app` for this template moves with it (`template-search.test.ts`,
   `template-install-over-http.test.ts`). Title **"Members' area"**, summary *"members only site for
   a club, charity or church"*. Plus an excluded-files list that is **read and checked** — this
   project has a backend and auth, so the check is not a formality.
2. A **clean launcher** picks "Members' area" from the picker and finishes the wizard onto a working
   public landing page — backend created, started, bound, enforcing — with no detour through Backend
   Services and no white void. This is **TPL-001 AC1**, ungradeable until now by construction.
3. The published row's card draws a **person-facing** category, not a machine slug. P75 already
   found the cost of getting this wrong.

🔴 **Do not publish before REL-002 rules.** That is the decision, not a preference.

✅ **But do not wait for the cut either** — Richard, 2026-09-01 (§G5): publish the moment the look
rules. REL-001 and REL-004 are **two moments, not one**; a served template reaches everyone already
on 0.2.0 with no app update.

### REL-002 — The look it ships with (a, b, c)

🔴 **Owned here, by Richard's ruling 2026-08-31**: *"just so we focus on the tasks we need to launch,
over several sessions all in phase 82."* This was phase 81's VIB-005 + VIB-008. **Everything needed
to build and close it is restated below — you do not need to open phase 81.**

✅ **The note back is WRITTEN (REL-006 AC4, 2026-08-31 s1).** Phase 81's board now carries both rows
as **➡️ CARRIED to phase 82 — do not build it here**, with a legend entry and a note that VIB-009's
dependency on VIB-005 now resolves here. Written after the P81 peer session ended and its work was
committed (`4b3e55f4`), with the lane checked clean first.

#### The verdict scale, restated

**SHITTY / PASSABLE / WORTHY. Only WORTHY closes.** PASSABLE is recorded progress, never a close.

🔴 **Legible and operable is the FLOOR, not a grade.** Richard, on the baseline: *"passable in terms
of you can at least see the elements clearly and interact, but they still look like original
Wordpress default templates."* Every default template is legible and operable — that is what it is
for. A verdict awarded for it measures the precondition, not the thing.

⚠️ **These are mostly app-chrome pages** (forms, lists, a directory). They are **exempt from the
marketing tells** — a settings page needs no hero, no gradient ground, no 72px display type, and
demanding one would be wrong. They are **not** exempt from the default-template test, which is the
same for every surface:

> **Does anything on this page show a decision?** A considered density; a real hierarchy of action
> weight; iconography doing work; a treatment for state. Or is it the framework's defaults with this
> app's content poured into them?

Full-width bordered inputs stacked in a card, or ruled rows with outline-secondary pills, are what a
form library emits before anyone has designed anything. They are SHITTY however clearly they read.

#### The close protocol, restated

1. **Render the actual page.** Never a mockup, never the generator's source, never a description.
2. **Both states**: the user's door (no backend bound, nothing seeded, not signed in) **and** the
   living state (provisioned, seeded, signed in). Not WORTHY in one and unjudged in the other.
3. **Three widths**: the editor preview default (**988×313** — that is what a user sees first),
   1280, and ≥1900. 🔴 **Never raise a viewport to make content fit — the fold is a finding.**
4. **LOOK at the PNG** and write the verdict as sentences, naming which tells fired. A verdict
   written without the image in context is void.
5. **Richard's look supersedes.** A session's WORTHY is provisional until he has seen it.
6. **If not WORTHY, the why is mandatory work**, not commentary — name the seam that blocked it.

---

#### REL-002a — The ambush defaults *(was VIB-005)*

🟢 **CLOSED 2026-09-01 (s4). Read [`REL-002a-THE-AMBUSH-DEFAULTS.md`](REL-002a-THE-AMBUSH-DEFAULTS.md)
before acting on anything below** — three of the four bullets were measured on a rendered page and
**the first three name the wrong mechanism.** They are kept here as written, because the correction
is only legible beside them.

🔴 **What is actually true:** the app cannot scroll because `settings.bodyScroll` is unset, and no
node parameter substitutes for it — `scrollEnabled: true` on the page's root Group leaves the last
row exactly as unreachable as leaving it off (measured). The dead gaps are the *same* setting: with
`bodyScroll` false the app wrapper is a definite-height box, which is the only state in which a
child's `height: 100%` has free space to grow into.

The silent runtime defaults that produced the baseline screenshots. Fix these first: they are what
the template *sits on*, and REL-002c inherits every one of them.

- A `Group` with no `sizeMode` is explicit 100%×100%, and in a column becomes `flexGrow:100` —
  "consume the viewport, ignore content height". Hence the ~690px dead gaps.
- Nothing scrolls unless `scrollEnabled` is set — **zero hits in the whole members-area artefact**,
  which is why the Setup form was unreachable below the fold.
- `clip:true` silently amputates overflow.
- **V14** — `text-input.ts:97` defaults `placeholder` to `"Type here..."`. The template sets it
  explicitly **once**, so every field of every shipped form reads *"Type here…"*: a runtime default
  that manufactures the rubric's own placeholder-grade-copy tell, and **nothing fires on it**.

**ACs**: the MCP door **says something at authoring time** for each of the first three; the
placeholder default no longer ships a tell; the naive page re-authored through the door scrolls.
Judged by before/after screenshots.

#### REL-002b — Fail closed, and a designed first run

🔴 **Correctness wearing a look task's clothes.** Do not defer these on the grounds that the phase
is about appearance.

- **V3** — the members chrome gates on `done` only, so it **fails open** when no backend is bound:
  the gate's failure mode is to show the protected surface.
- **V4** — no state for *"the query was never answered"*, so first run renders a bare eyebrow and
  two buttons.

**ACs**: gating **fails closed** — failure navigates away, asserted beside a known-firing signed-in
read so the absence is a refusal and not a wrong query; the no-backend/unclaimed state is
**designed**, not blank; both driven against a real enforcing backend.

##### 🟢 CLOSED s5 — both ACs met. Full account: [REL-002b](REL-002b-FAIL-CLOSED.md)

🔴 **V3's recorded MECHANISM was wrong.** Measured at HEAD: every gated group on all six protected
pages already carried `mounted: false`, so the protected **content** was never revealed. The real
defect was that **nothing refused** — all six pages stayed on their own URL wearing the full band,
`Sign out` included, and **five of the six said nothing at all** about why they were empty.
✅ *A recorded row can be a hypothesis; the artefact is the ruling* — believing this one would have
produced a wrong fix, hunting a `mounted: false` that was already there six times.

🔴 **V4 was one parameter**: `actions` (*"Ways in"*) was the **only** group on the landing page
without `mounted: false`, so it was the one thing that survived a query that never answered — which
is exactly the photograph. Three states collapsed into the one with no words on it.

Built, all through the generator + `npm run template:members` (byte gate green): a **`Denied`**
signal with **two producers** (answered-`visitor`, and *could not be asked* — the half that did not
exist); **`isSignedIn`**, consumed inside the band and forwarded to nobody, gating `topRow` and
`nav`; and a **`waitingCard`**, the one node mounted by DEFAULT, taken down by an answer.

Driven **37/37** — [`rel002b-fail-closed.test.ts`](../../../packages/nodegx-backend/tests/rel002b-fail-closed.test.ts)
— four arms on two real enforcing backends: **member (the control, which caught the first build
ejecting everybody)**, visitor, `myStanding`-not-deployed, and nothing-bound.
⚠️ The observable is `location.pathname`; **`Visit.url` echoes the REQUEST** and would have passed
on every arm.

🧭 **Two defects registered, owner `NONE`, neither blocking:** (1) **`DbCollection2` never fires
`failure` with no backend bound** — a 200 carrying non-JSON makes `ParseWireAdapter` call
`success(undefined)` and throw on `response.results` before the node's own guard; *not* the same
claim as D4, which proved `failure` fires on a real 403. (2) 🔴 **Starting a second
`BackendService` in the same process invalidates the first one's sessions** — presents as *"a
signed-in moderator is ejected"*, cost most of the session; **a two-backend drive must finish with
the first before starting the second.**

#### REL-002c — The members' area, redeemed *(was VIB-008)*

The redesign, on top of a and b, using the kit phase 81 widened (compositions, the stock library,
the `ui-landing-page` example Richard called *"fucking pro"* — that page is the reference).

- **V15** — at 1900 the nav wraps to two rows and the page uses ~37% of the width, the rest dead.
- **V29 is RULED** (Richard, 2026-08-31): *"the structural page divs have a max width and are
  centred… white space to the left and right **equally** — not just on one side, that's weird."*
  🔴 **The mechanism is known: the defect is a `maxWidth` on the TEXT.** A measure belongs to the
  **shell**, which a band centres. `ctaBand` is the worked example — shell carries `maxWidth: 720`
  + `alignItems: center`, the type carries `textAlignX: center` and **no maxWidth at all**.

**AC — the phase's close condition** — 🔴 **AMENDED BY RICHARD 2026-09-01, read
[`RICHARD-RULINGS-2026-09-01.md`](RICHARD-RULINGS-2026-09-01.md) §A first**: the AC below was
written when only four pages had been ruled. It is now **all thirteen pages** in
`components/Pages/` — *"shipping the first template that's only 1/3 usable would be pretty sad."*

~~the **landing page and one members page**~~ **every page** reads **WORTHY** in **both states** at
**all three widths**, ruled by Richard.

⚠️ The build is not 13× the work — most of the look lives in the seven shared `Members/` components
(`Chrome`, `AnnouncementRow`, `InsideTile`, `MeetingRow`, `MemberRow`, `RequestRow`, `Standing`), so
fixing the chrome and the row family lifts most of the thirteen at once. What scales linearly is the
grading: 13 × 2 × 3 = **78 renders**.

✅ **How they get graded — RULED (§A2a)**: **Richard personally rules six** — `/` in **both** states,
`/setup`, `/join`, `/members`, `/directory` (the four he already ruled, plus the two richest row
pages). **The VIB-001 Judge grades the other seven** against the written rubric, and 🔴 **any SHITTY
verdict is escalated to him**. The escalation is the half that makes this different from shipping
seven pages nobody looked at.

✅ **Also ruled:**

- **§C — the measure is `maxWidth: 1200`** on every structural shell, with `--space-6` gutters and
  `alignItems: center`, matching `ui-landing-page`. 🔴 **On the SHELL, never on the text.**
- **§D — photographs on the public pages** (`/` hero ground, `/join`), **icons only** inside the
  gated area. Costs the template **zero bytes**: `STARTER_ASSETS` installs the 44 CC0 photographs
  and 1,998 icons into every project, and the excluded-files list derives from that same constant.
  The template contains **no images at all today**.
- 🔴 **§E — the copy becomes DATA, not text nodes.** *"Ok good idea."* The failure mode Richard named
  — publishing with generic copy on a page you forgot — exists only because copy lives in thirteen
  places. So: **(i)** `/setup` collects the association name, tagline and landing blurb, and the
  pages read them from the record; **(ii)** anything that genuinely cannot be data is written to be
  *obviously* unfinished (*"Your association's name here"*, **never** a plausible fictional club) and
  its node is named with an **`EDIT —`** prefix so the editor's tree lists them; **(iii)** a
  `Start here` note page points at both. ⚠️ **No invented copy** — that was E3.
- **§F — `waitingCard` is designed as a first-class state**, not hidden. It is the **only node in
  the template mounted by default**, so it is the literal first frame of a fresh install, and it is
  ruled with the rest.

🧭 **Registered, not built — owner `NONE`, from §E.** *"A deploy-time gate that refuses to publish
while placeholder strings remain."* It is the strongest answer to the forgotten-copy problem, and it
is **product surface, not template work** — the template package ruled above (data + marked
placeholders + a note page) is what ships in 0.2.2. Worth a row in a later phase; it gates nothing
here. ⚠️ It needs a way to know which strings are placeholders, which the `EDIT —` naming convention
from §E-ii would give it for free — so the convention is worth keeping even before the gate exists.

---

## REL-002c — what session 7 built, and the one place it departed from the ruling

**Session 7, 2026-09-01, at HEAD `5f197e28`.** The row is **NOT closed** — it closes on Richard's
WORTHY ruling over six pages, and three of the six ruled items are only partly built. What follows
is what moved, what was measured, and what the next session picks up.

### The spine — §C, the measure

| | before | after |
|---|---|---|
| `PAGE_GROUND` (all 13 pages) | `maxWidth: 760` | **`maxWidth: 1200`** (the `shell` composition's own) |
| `CHROME_NODES.inner` | `maxWidth: 760` | **`maxWidth: 1200`** |
| the six form pages | 760 | **`FORM_GROUND` — 720, centred** (see the departure below) |

✅ **V15 is CLOSED, and it was closed by the chrome cap rather than by anything about the nav.** At
760 the six `gridAutoFit` items at `minWidth: 132` fitted five across and folded the sixth onto a
second row, on every signed-in page at every viewport. At 1200 they are one row of six.
**Photographed**: `verdicts/vib-001/2026-09-01/members-area-living/members-desktop-full.png`.

### 🔴 The one departure from §C, flagged for Richard

**Six of the thirteen pages do NOT carry `maxWidth: 1200`.** `Pages/{SignIn, Join, Setup, Post,
Account, Unsubscribe}` carry `FORM_GROUND`, which is 720 and centred.

**This was not a preference — the literal reading was rendered first and it was worse than the
baseline it replaced.** At 1200, `/setup` is six stacked 1100px-wide text inputs. The three readings
of the ruling disagree on a form page:

| reading | at 1280 | equal white space? |
|---|---|---|
| shell 1200, form fills it | a 1100px password field | yes, and unusable |
| shell 1200, form capped and left-aligned in it | ~480px of white on the right only | **no — this is the "weird" he named** |
| **ground 720, centred** | a 720px form, 280px either side | **yes** |

His stated criterion is *"white space to the left and right **equally** — not just on one side"*, and
only the third reading satisfies it. ⚠️ **If he wants 1200 literally on all thirteen, the answer is
not this constant** — it is a two-up split that fills 1200 with the form on one side and what the
form is for on the other. That is more work and a better page, and it is the obvious next move on
`/setup` and `/join` if he rules that way.

### §D — imagery: done on `/`, not yet on `/join` or inside the gate

The landing hero is `imageGround` + `noodl_modules/starter-imagery/people-coffee-shop.webp` under
`--gradient-scrim`. **Zero template bytes** — `STARTER_ASSETS` installs it into every project.

⚠️ **`people-meeting` was chosen first and rendered wrong.** Both are catalogued under subject
`people`; the first is a room full of people sitting together, the second is a desk with a bag, a
tablet and two pairs of hands. A members' area is a group of people who belong somewhere. **Graded
by rendering both**, which is the only way this is gradeable.

⚠️ **`justifyContent: center` was an override and it was wrong.** The scrim is a VERTICAL gradient,
darkest at the foot — which is what `imageGround`'s own description says it is for. Copy centred in
the frame sits in the weakest part of it. Reverted to the composition's `flex-end`.

**NOT done**: the `/join` photograph, and icons inside the gated area. Both are still open §D work.

### §F — the waiting card, ruled as a first-class state

`waitingCard` and `setupCard` are now **glass panels standing on the hero photograph**, not grey and
accent boxes in the middle of a white page. `waitingCard` keeps the default `mounted`, so the first
frame of a fresh install is a designed screen. `setupCard` gained a heading it did not have.
**Photographed**: `verdicts/rel-002c/2026-09-01/members-area-door/landing-desktop-full.png`.

### §E — the `EDIT —` convention has its first worked example; the data half is NOT built

The landing page gained a `footerBand` carrying two `EDIT ME —` lines, whose nodes are named
`EDIT — who to contact` and `EDIT — the small print`. **NOT done**: `/setup` collecting a tagline
and landing blurb, the pages reading them from the record, and the `Start here` note page. That is
the larger half of §E and it touches `tpl001Cloud.ts`.

### Also fixed, from the VIB-001 baseline

- **The Join page's two equal primary buttons.** `Sign in` sat in `PRIMARY_LABELS` because it is the
  submit of `Pages/SignIn`, and the footnote under the join form inherited the fill. This file
  already states the rule that fixes it, on `navBtn`: *"emphasis is a property of the PLACE rather
  than of the label."* It is the outline button now.
- **The page had no bottom edge.** A footer band plus a `--muted` page ground, so the door state
  does not end in a strip of bare white below a finished footer.

### The readings, with their exit statuses

| gate | reading |
|---|---|
| `template:members` regeneration | **0**, and **idempotent** — hashed before and after a second run, identical (`bbeb0b6f…`), so every diff after that point is attributable |
| `tpl001Template.test.ts` | **0** — **72/72** |
| `vib001-members.look.ts` | **0** — 44 shots, both states, seeded backend asserted before any picture |
| `rel002c-look.look.ts` (new, door only) | **0** — 16 shots, ~92s, the fast loop while building |


## REL-002c — what session 8 built: §D's icons, §D's second photograph, and the whole of §E

**Session 8, 2026-09-01, at HEAD `1f4d5547`.** The row is still **NOT closed** — it closes on
Richard's WORTHY ruling — but **all six ruled items are now built**. What was open at the end of
session 7 was §D's icons, §D's `/join` photograph, §E's data half and the row family; all four
landed. The one departure flagged for Richard (`FORM_GROUND` at 720) is **unchanged and still
open**, and nothing built this session depends on the answer.

### §D — the icons, and where they went

**A glyph badge on the head of all eight gated pages**, one distinct glyph each: `newspaper`
(Announcements + the announcement detail), `calendar-days` (Meetings + the meeting detail),
`pencil` (Post), `user-plus` (Requests), `users` (Who belongs), `mail` (Your account). A 44px
`--accent` square holding a 22px `--accent-foreground` glyph — the pairing `tpl001Theme.ts` already
measures at **6.45:1**, so the app has one accent idea rather than two.

🔴 **A different glyph per screen is the whole difference between iconography and decoration.** The
corpus states the rule for photographs — *"a page whose every image is the same abstract is
decorated, not designed"* — and it holds identically for glyphs. That is why they are **NOT on the
list rows**: eight announcements each wearing the same newspaper is the decorated case exactly.

🔴 **The badge is a wrapper AROUND the head, never a third child inside it, and the GATE dictated
that.** §5 of the ratchet reads a page's eyebrow as *the head Group's first child*. A glyph inserted
into the head would have moved the eyebrow to index 1 and reported all eight badged pages as
carrying the eyebrow `''` — against a hand-written table, so it would have read as eight pages
losing their eyebrows rather than as one structural change. The wrapper's id ends in `Row`, which is
not what `/Head(-\d+)?$/` matches.

⚠️ **The nav pills were considered and rejected on arithmetic.** Six glyphs on the band's six
buttons is the obvious app-chrome move and it is the tightest place in the template: at the 988px
preview each `gridAutoFit` column is ~145px, `--space-3` sides leave ~121px, and "Announcements"
plus a 16px glyph and its spacing is ~124px. Three pixels over is a wrap on somebody else's font.
Not built, and recorded so the next session does not re-derive it.

⚠️ **Every glyph name is in the CURATED 215, not merely in the font.** `icon-megaphone` and
`icon-handshake` were the first two picks; both have rules in `styles.css` and both draw, because
the manifest `_note` is right that the bundled font carries all 1,998. They are still wrong: the
door validates against the manifest's list, so a name outside it is a refusal waiting for whoever
regenerates next.

### §D — `/join` is bands now, and it has its own photograph

`Pages/Join` was one 720px column on white from the top of the viewport to the bottom of the form.
It is now `BAND_PAGE_GROUND` holding a **300px `people-meeting` band** carrying the page head on the
scrim, then the form band. This is the one transition in the template where two public pages are
seen back to back, and Richard's §D names this page explicitly.

⚠️ **`people-market` was built first and rendered wrong, and the shape of the band is what picked
the picture.** Cropped to 300px it is a pair of hands and a heap of limes — the catalogue's `says`
(*"a market seller weighing limes"*) describes the **full 4:3 tile**, and a third of a tile is a
different photograph. `people-meeting`'s subject runs horizontally across a table, so a 300px band
keeps all of it.

⚠️ **Session 7's own comment argues AGAINST `people-meeting`, for a different page.** It was rejected
as a *hero* because *"a members' area is a group of people who belong somewhere"*. That judgement is
about a 560px band saying what the association IS. This band says what the PAGE is, and the page is
one person asking two others to let them in.

🔴 **The head was at 1200 and the form at 720 and the first render showed it.** The heading began at
x=64 and the form panel at x=304 — two measures on one page, which reads as a head belonging to a
different template. The join hero shell is capped at the form's own 720.

### 🔴 §C's footer fix was one element short, and only a picture found it

`landingGround` was `justifyContent: flex-start` with `minHeight: 100vh`. In the **door** state —
where every band but the hero and the footer is unmounted — that stacked a 560px photograph and a
footer directly under it and left **270px of bare `--muted` below a finished footer**. That is the
exact defect session 7 added the footer band to end, **moved down the page by one element rather
than fixed**, and every gate was green over it. `space-between` pins the last band to the foot
whenever there is slack and is a no-op the moment content exceeds the viewport, which is every
living state.

### §E — the data half, all three parts

**(i) `tagline` is the one new field, end to end.** `claimAssociation` takes it (`preq: false`, like
`blurb`), `/setup` collects it under *"One line about the association (e.g. 'Meeting on the green
since 1894')"*, and `Pages/Landing`'s hero renders it.

🔴 **The hero used to render `blurb` — the association's whole paragraph — under a `--text-5xl`
name.** They are different shapes of writing and the hero has room for one. So the blurb moved to a
new **`about` band**: `composition('band')` on `--background`, an "About us" heading, the paragraph
in a `PROSE` wrapper, gated on `hasAssociation` like everything else the record fills.

**(ii) `EDIT —` is unchanged** — the footer's two lines are still the only strings that genuinely
cannot be data, and that is the honest number.

**(iii) `docs/START-HERE.md`, and it is GENERATED from the artefact rather than typed.**
`writeStartHere` in `tpl001Template.ts` walks the components that were just written and builds the
table of `EDIT —` nodes from their labels. A hand-written list is the failure `USED_COMPOSITIONS`
already had in this repository — it claimed to be enforced, nothing read it, and two of thirteen
entries named things that did not exist. **It refuses on zero rather than warning**: an empty list
has two causes that look identical in the output (the convention was dropped, or the walk stopped
finding it) and both ship a note whose central section is blank.

⚠️ **`docs/`, not a `/start-here` route.** A route would be a public URL on a deployed members' area
telling strangers which parts of the site are unfinished. `docs/` is the editor's folder for prose,
it travels because `readBundleDirectory` walks the whole tree (**checked in the community repo, it
is fully recursive**), and it is never served.

### The row family at 1200 — a CONTENT answer to a LAYOUT complaint

**`AnnouncementRow` gained a one-line excerpt.** At 760 a title and a date filled the row; at 1200
they left ~900px of nothing between "The roof appeal" and its `Read` button. **The fix is not to
move the button back** — `RULED_ROW_SPLIT` already measured what a content-sized right-hand child
costs at 390px (`ada@example.invali / d`). A wide row wants something to be wide ABOUT, and every
announcement already had a body nobody was showing. ✅ **Free at the door**: `For Each` sets every
DECLARED input from the field of the same name, so declaring `body` is the whole mechanism — no
query, no page and no policy rule changed. Truncated in a `JavaScriptFunction` at a word boundary,
because a `Text` in this runtime has no line clamp.

**`MemberRow` is a three-column table row.** `'3 3 2'` above 700px, one stack below it. 🔴 **A
`Columns` is the ONLY node type in the runtime that could do this** — a Group row cannot reflow, and
putting the standing at the far edge of a Group row is the 390px defect above. `'2 2 1'` was
rendered first and wrapped every standing onto a second line: a fifth of 1200 is ~200px and
`Member · since 1 September 2026` measures ~197px.

🔴 **§2 of the ratchet counted the three cells as unpainted notice boxes, and the fix is to the
CENSUS, not to the cells.** A `Columns` child must be a Group that declares `sizeMode` and `width`,
so "a Group wrapping one Text" is now produced by two different intentions and only one is a notice.
Painting them to satisfy §2 would put a fill and a radius behind every name in the directory. The
exclusion reads the cell's **parent type** from the artefact rather than a list of ids. ✅ **The
control is that the pin did not move**: 27 → 24, which is exactly the three new cells and no
pre-existing notice.

### The readings, with their exit statuses

| gate | reading |
|---|---|
| `npm run template:members` | **exit 0**, and **idempotent** — hashed before and after a second run, identical (`27f127e9…`), so every diff is attributable. 91 files, +1 for `docs/START-HERE.md` |
| `tpl001Template.test.ts` | **exit 0** — **72/72**, taken after the last edit |
| full `noodl-mcp` suite | **exit 0** — **83/83 suites, 1085/1085 tests**, clean on the first run |
| `tpl001-members-drive` + `tpl001-empty-states` + `rel002b-fail-closed` | **exit 0** — **110/110**, on real enforcing backends. Not one of the four owed gates; run because the row family changed the shape of two components a drive reads |
| `vib001-members.look.ts` | **exit 0** — 44 shots, both states, seeded backend asserted before any picture |

---

## ⛔ SUPERSEDED 2026-09-01 (s11) — the ruling that closed this row, and the one that reopened it

🔴 **Richard reopened the row the same day:** *"Anthropic just reset my weekly usage limit, so we're
going back round and fixing that fucking template… I want all pages looking as good as the
homepage."*

**The close below was made ON COST — *"we can't waste more time on this"* — and the cost constraint
is gone, so the override goes with it.** The AC is back in force, unchanged: every page WORTHY in
both states at all three widths. **Items 5 and 6 of the change list are UN-DECLINED**, and item 6
widens from `/setup` alone to `/setup`, `/sign-in` and `/unsubscribe`, which s11 measured to be in
the same state.

⚠️ **This section is kept, not deleted** — it is the honest record of what the template looked like
at V1 and how far it was from the bar. Read it as the starting distance, not as a verdict.

---

### The superseded close

**2026-09-01, session 10, after the items 1–4 renders:** *"It looks fine (not worthy) but just push
it as V1 of the template, we can't waste more time on this."*

🔴 **Recorded as what it is: the close condition was NOT met.** REL-002c's AC reads *"every page
reads WORTHY in both states at all three widths, ruled by Richard"*. He ruled **FINE** and elected
to ship regardless. The row is closed because **he decided the remaining distance is not worth its
cost**, not because the template reached the bar this phase set for it.

⚠️ **This matters for the next person, in two directions.** It is not a licence to treat FINE as the
new bar — the bar is written above and the template is below it. And it is not an invitation to
reopen the row: the decision was made with the renders in hand, by the person whose product it is.

**What is knowably still short**, from the change list, so a later phase does not rediscover it at
full price:

- **Item 5 — `/directory` is a table with no headers.** Three columns at roughly x=36 / x=285 /
  x=537 at 1200, so a name and its email are ~250px apart, and `Member · since 1 September 2026`
  runs on with no column to say what it is. Costed: a header row (*Name · Email · Standing*) and
  ~40/35/25 proportions, medium only because the header has to disappear at the 700px fold.
- **Item 6 — `/setup` has no identity.** The owner's first ever screen of the product is a bare form
  on white while `/` and `/join` both open on a photograph. Taste rather than defect; Richard's call
  and he did not take it.
- **Four of the thirteen pages have never been photographed** — `Announcement`, `Meeting`, `Post`,
  `Unsubscribe`. The harness asks for nine. **So "every page" was never actually graded**, which is
  a second reason this row did not meet its AC as written. Owner `NONE`.
- **The `/directory` page still ends in ~200px of white above its footer** at 1280 with four rows.
  Honest for a short page; it is what item 5 would absorb.

**So V1 of this template ships FINE, knowingly.** The list above is the V2 brief.

## REL-002c — what session 10 built: items 1–4 of the change list Richard asked for

_Richard ruled the row **FINE** on 2026-09-01 and asked what I would change. The answer is
[`REL-002c-WHAT-I-WOULD-CHANGE.md`](REL-002c-WHAT-I-WOULD-CHANGE.md); this section is what building
its first four items actually took, which is not what that file estimated._

### Items 1, 2 and 3 — small, and they cost what was estimated

**Item 1 — the door landing had a void, and the band that fills it was closed by a gate.**
`Pages/Landing`'s "What members can see" is ungated now: `mounted: false` gone from the node and the
`hasAssociation` wire gone with it (the mounted-gate census moves 54 → 53). 🔴 **The s8 argument for
gating it was about a page that no longer exists** — *"it would sit above the 'nobody has set this
up yet' card"* was true when it was a section in the old single-column page and stopped being true
when it became a band **below** the hero. And what it promises is the **product**, not this install's
content: three literal sentences pinned by the page census, true of every copy on the day it is
unzipped. What the gate actually did was leave **190px of bare `--muted`** between the photograph
and the footer at 1280, and 330px at 1900.

**Item 2 — `/members` ended in four buttons that were all already in the band.** `What's coming up`,
`Requests to join` and `Who belongs` are gone; `Post something` stays and is the page's one filled
button. 🔴 **This reverses a decision recorded in the generator at s9** (*"The three buttons below
STAY… a nav and a call to action are not the same control"*) — the principle is right and the
reading of these three was wrong: each named a **place** the nav names in the same word, three
inches higher. Three `RouterNavigate` nodes went with them, because each had exactly one driver and
it was the button that was deleted. The `moderatorButtons` `Columns` went too — a `Columns` with one
child hands it the whole container, which is a 1200px filled button — and so did `afterRuledList`,
whose only caller was the button above it.

**Item 3 — one string.** *"Already have an account? Sign in instead."* → *"Already have an
account?"*, above the outline `Sign in` button that is the actual control.

### 🔴 Item 4 — the stated fix would have changed no pixel, and the mechanism was wrong twice

The change list said: `PAGE_GROUND` carries an inert `height: 100%`, so give it `minHeight: 100vh`.
**Both halves of that are wrong, and the second one is worth carrying out of this phase.**

1. **The proposed fix paints nothing.** `ground` has no `backgroundColor` in the artefact — read out
   of `components/Pages/Directory/nodes.json`, not reasoned about — so growing that box leaves
   `/setup` ending in exactly the same white. **A page has a bottom edge when something is AT the
   bottom.** The eleven pages now place `Members/Footer`, the band the landing page has had since
   s7. A **component**, not four nodes copied thirteen times: the two `EDIT ME —` lines an
   association has to replace stay two strings rather than becoming twenty-six.
2. 🔴 **`height: 100%` was never inert.** [`layout.ts:98`](../../../packages/noodl-viewer-react/src/layout.ts#L98)
   turns a percentage height inside a **column** parent into `flexGrow` — *"along the parent's flex
   direction it becomes `flexGrow` (so siblings share the space proportionally)"*. So `PAGE_GROUND`
   has always meant `flex-grow: 100`. It did nothing only because the chain above it ended at a
   content-sized `Router`. **The moment the page got a floor, the slack went INTO the ground** and
   was shared out among its children: 150px between `/sign-in`'s heading and its form, and the form
   panel stretched by as much again. Found by rendering, not by predicting.
3. 🔴 **Every `Group` in this template without a `sizeMode` is `flex-grow: 100`.** `addDimensions`
   defaults `sizeMode` to `explicit` and `height` to `100%`
   ([`node-shared-port-definitions.ts:1102`](../../../packages/noodl-viewer-react/src/node-shared-port-definitions.ts#L1102)).
   That is a property of the runtime and it is the reason the shell is shaped the way it is.

**So the built shape is two bands, not three.** `PAGE_SHELL` (`minHeight: 100vh`,
`justifyContent: space-between`) holds exactly `pageBody` and `pageFooter`; `pageBody`
(`contentHeight`) holds the band, if the page has one, and the ground. ⚠️ **`space-between` over
three children is the wrong answer** — it splits the slack in two and opens a gap **under the
header**, the one place on these pages nothing may move. `PAGE_GROUND` and the chrome band's `bar`
are both pinned to `contentHeight`, which is what stops the slack being redistributed rather than
kept at the foot.

⚠️ **The two public band pages do not take `pageShell`.** `Pages/Landing` and `Pages/Join` are built
on `BAND_PAGE_GROUND`, which already floors at `100vh`; the landing page places the footer component
as its last band and `/join` ends on its form panel with `--muted` beneath it.

**Cost, against the estimate.** The change list called item 4 *"one constant"*. It was a new
component, a new shell, a new body wrapper, two pinned heights and eleven rewritten page roots — and
one component count and one file count in the gate.

### The readings, with their exit statuses

| gate | reading |
|---|---|
| `npm run template:members` | **exit 0**, and **idempotent** — hashed before and after a second run, identical (`8af2aeec…`), so every diff this session is attributable. 30 components, 13 pages, 94 files |
| `tpl001Template.test.ts` | **exit 0** — **72/72**, taken after the last edit |
| full `noodl-mcp` suite | **exit 0** — **83/83 suites, 1085/1085 tests**, clean on the first run |
| `rel002c-look.look.ts` | **exit 0** — the fast door-only harness, run three times across the session; two of the three corrections above were found on it |
| `vib001-members.look.ts` | **exit 0** — **44 shots**, both states, seeded backend asserted before any picture. Door `md5=f969ad96`, living `md5=7164e4f6` |
| `tpl001-members-drive` + `tpl001-empty-states` + `rel002b-fail-closed` | **109/110 on the first run**, and the one red was the deletion doing its job: `§5 AC4`'s control asserted the moderator is offered `Post something` **and `Requests to join`**, and the second of those no longer exists. 🔴 **The pair is what makes AC4 a measurement** — two arms assert a pending person and a plain member are NOT offered them — so the control was re-pointed at `Requests`, the band's moderator-only pill, rather than dropped. Re-run after the correction: **exit 0, 110/110** on real enforcing backends. ⚠️ The background task's notification said *completed (exit code 0)* on the FAILING run too — the exit file written by the command itself read `1` |

---

## REL-002c — what session 13 did: the twelve pictures nobody had seen, and the two rulings they forced

**The forced first job from s12's handoff, taken.** `vib001-members.look.ts` had been *extended* to
thirteen pages but never *run* since; twelve of its living shots had never existed. They exist now,
and they moved this row twice — once into a defect that was a decision nobody carried across, and
once into a question only Richard could answer, which he has.

⚠️ **Every reading below was taken with `scripts/devtools/render-from-disk.js` in its UNCOMMITTED
working-tree state** (`md5=1557f527…`, mtime 09-01 11:38 — REL-002a's own fix, still unswept). That
change makes the harness serve **the product's host stylesheet** rather than a bare reset, which is
what makes `unreachable=0px` a statement about the product instead of about the harness. **If that
file is reverted, every fold reading in this session is void.**

### 1. The grading — each page beside `/` at the same width, which is what Richard's phrasing asks

| page | as photographed | what a stranger would have noticed |
|---|---|---|
| `/post` | **PASSABLE** | Composed: chrome, badged head, two `--surface` panels, one primary action each. 🔴 **Three left edges on one page** — §3 |
| `/announcements/{id}` | **PASSABLE** | Right family, right badge, correctly ruled above its removal zone. 🔴 Body ran the full §C measure — ~210 characters a line at 1900 |
| `/meetings/{id}` | 🔴 **the weakest page in the gate** | Same, **plus** the two facts that are the entire point of the page — when and where — were two unlabelled grey lines |

🔴 **The `/meetings/{id}` finding is the sharp one, and it is a fact about a DECISION THAT HAD
ALREADY BEEN MADE.** `Members/MeetingRow` carries a written ruling on this exact pair — *"one meta
line, not two… a diary is scanned down its dates, so the row keeps the date leading and hangs the
place off it with the `·` the directory row already uses"* — and composes `12 January 2099 · The
hall`. The detail page stacked the same two facts as two separate `T_META` lines: **the shape that
ruling was written against.** A member who pressed `Details` arrived at a *less* composed version of
what they had just read. The row and the page it opens were never compared because the page had
never been rendered, by anything, in either state.

### 2. What was built

**Both detail pages** (`tpl001Components.ts`):

- `/meetings/{id}` — `whenLabel` now joins `place`, using `MeetingRow`'s script **including its
  guard** (the separator appears only with something on both sides, or a meeting with no place
  recorded renders a dangling `·` that reads as a field which failed to load). The orphan `place`
  `Text` is **deleted rather than emptied** — a `Text` wired to nothing still takes its line-height.
- Both — the record sits in a `PROSE` measure (640) inside the §C 1200 shell. `PAGE_GROUND`'s own
  note already calls `PROSE` *"the half of §C that stops 1200 making pages worse"*; the landing
  applies it and the two pages nobody had rendered did not.

✅ **The `PROSE` wrapper holds the date AND the body, and that is not a dodge of a gate.** §2's
notice census counts *a `Group` wrapping exactly one `Text`* and demands a fill and an edge of it, so
a measure around the body alone would have been a notice that forgot to be one. Holding both is also
the better composition — `--space-2` makes the date and the words it stamps one record, rather than
two items `PAGE_GROUND` spaced 20px apart.

⚠️ **The 640 measure is asserted from the ARTEFACT, not from the picture, and the reason is the
seed.** Every `ANNOUNCEMENTS` body in `vib001-members.look.ts` is one short sentence, so **no render
this harness can take will show a paragraph wrapping.** The cap is in
`Pages/Announcement/nodes.json` (`readingBlock.maxWidth = 640px`); the photograph shows the
composition change and cannot show the measure. Lengthening a seeded body would make it visible —
and would also change `/members`, which is Richard's page to rule, so it was not done.

### 3. 🔴 §C's flagged departure had a consequence INSIDE the gate — RULED, and BUILT

`Members/Chrome`'s own note states the rule and states it as satisfied:

> *"The band must agree with `PAGE_GROUND` or the nav and the content it heads are two different
> columns; they are now the same 1200."*

**They were not, on two of the eight signed-in pages.** `Pages/Post` and `Pages/Account` carried
`FORM_GROUND` (720) under a Chrome and a Footer that are both 1200. At 1280 the association's name
sat at x=64, the page's own heading at x=304, the footer back at x=64 — **three left edges**; at
988, the editor preview's default and the first render of every project, 24 / 160 / 24.

⚠️ **This was not a bug to fix quietly — it is the §C departure already flagged for Richard, landing
somewhere the flag did not reach.** That table weighed 720-centred against 1200 on the four DOOR
pages, which carry no band above them and are self-consistent at any measure. `/post` and `/account`
are different in kind.

🔴 **RULED, Richard, 2026-09-01: *"head on 1200, form panels capped at 720."*** Built as
`AT_FORM_MEASURE`, spread onto the form-carrying **children** — `tools` and `notAllowed` on
`/post`, `panel` and the three notices on `/account` — with both grounds moved to `PAGE_GROUND`.

✅ **On the children rather than as a wrapper, and the gate is why.** A wrapper would be a full-width
column `Group` with no fill and more than one child — **a SECTION by §6's own stated shape** — and on
`/post` it would enclose `tools`, which is already one, making `tools` a second section that owes a
hairline it should not have. Capping the children moves no census.

### 4. 🔴 The `/unsubscribe` tension — RULED, and it closes as a CONSEQUENCE, not a defect

s12 left one question: *"every page as good as the homepage"* versus **D39** (2026-08-29 — the page
names no association and offers no way back), which pull against each other on exactly this page.
It carries ~290px of dead white at 1280 and ~470px at 1900, and the obvious fix — a *Sign in to your
account* button — was built by s12 and correctly refused by `tpl001Template.test.ts` §5.

🔴 **RULED, Richard, 2026-09-01: D39 stands, accept the slack.** So `/unsubscribe` ships as it is.
**The remaining space on that page is not open work and is not a defect** — it is the recorded
consequence of a ruling, and the next session that finds it should read this paragraph rather than
re-derive it for a fifth time.

⚠️ The same *shape* — a short record under a floored page — remains on `/announcements/{id}` and
`/meetings/{id}` at 1900. It was **not** built against, deliberately: this row's hazard 3 says to ask
what is *missing* before what is *mis-sized*, and the honest answer is that a short record is short.
Every candidate (related rows, a back link, a next-meeting strip) is new product surface on pages
whose data model holds nothing more.

### 5. Item 5's header row — decided **NO**, and decided from the render

s12 priced this and recommended no; graded here against `/directory` at **1900**, the width the
original complaint was about. The three columns read **`Ada Newcomer` · `ada@example.invalid` ·
`Member · since 1 September 2026`**. A name is a name, an address is an address, and the standing
column already labels itself in words: **a header would restate three things the data says.** Below
700px the `Columns` folds to `smallLayout: '1'` with no runtime rule that can hide it, so it would
stack into three stray words on a phone. The change list's actual symptom — ~250px between a name
and its email at 1200 — **was fixed by s10**'s `layoutString: '3 3 2'`, which is the 40/35/25 item 5
proposed.

### 6. The gate that moved, and the argument that moved with it

`tpl001Template.test.ts` §6 pins *"the second section on a page carries a rule above it"* with
`seconds === 1`. The `PROSE` wrapper made each detail page's record a full-width column `Group` with
no fill and more than one child — **a section by this spec's own stated shape** — above the removal
zone, so the count is now **3**.

✅ **The spec read the structure correctly and its `missing` list stayed empty**, because `removal`
already carried the hairline. Per this row's hazard 7 the **argument** above the number was
rewritten rather than the number incremented: it used to read *"today exactly one page stacks two
sections"*, which is now false, and a silent increment would have hidden the one thing worth
knowing — the shape this rule is about now occurs on three pages.

### 7. ⚠️ Two housekeeping facts about this tree

- Two **orphaned headless Chromes from 2026-08-30** (pids 50059 and 93389, ~230MB and ~10 helper
  processes between them) were reaped before the first render. Both were `PPID=1`, holding
  `nodegx-render-*` temp dirs two days old, with no render in flight — s12 had flagged them as worth
  reaping if a render started timing out.
- 🔴 **The 09-01 11:35–11:50 cluster of modified tracked files that s11 and s12 both recorded as
  *"another session's in-flight work"* contains at least one file that is THIS PHASE'S OWN.**
  `scripts/devtools/render-from-disk.js`'s uncommitted diff documents itself as **REL-002a**. It is
  still uncommitted, it is load-bearing for every fold reading taken since, and *"a peer's"* was a
  relayed conclusion nobody re-derived. It has been left alone here — but it should be **read**,
  not inherited, before the cut.

### The readings, with their exit statuses

Every one gated on an **exit file the command wrote itself**, never on the wrapper's notification —
this row's hazard 9, which has now disagreed with reality in three consecutive sessions.

| gate | reading |
|---|---|
| `npm run template:members` | **exit 0**, and **idempotent** — `Pages/Post/nodes.json` hashed before and after a second run, identical. 30 components, 13 pages, **94 files**, and the door raised the **same 110 diagnostics** before and after the change |
| `tpl001Template.test.ts` | **exit 0 — 72/72**, taken after the last edit. Its §6 pin moved 1 → 3 and the **argument above it was rewritten**, not the number incremented |
| full `noodl-mcp` suite | **exit 0 — 85/85 suites, 1117/1117 tests**, clean on the first run |
| `tpl001-members-drive` + `tpl001-empty-states` + `tpl001-refused-query` | **exit 0 — 3/3 suites, 79/79**, on real enforcing backends. This is what grades the `prop-place → whenLabel` rewire |
| `vib001-members.look.ts` | **exit 0**, three times — 60 shots each (24 door + 36 living), seeded backend asserted before any picture. Living `md5`: `5474db3b` (detail pages) → `ed8a32db` (the ruled `/post` + `/account` fix). Door unchanged at `f969ad96` throughout |

⚠️ **`head=` differs between the door and living manifests of the last run** (`538e3691` vs
`bc012147`, neither of them the `b35f929d` the run started at). **A peer committed twice while the
render was in flight.** The manifests' `headSha` is a **read time**, not the sha the artefact was
built from — the artefact is pinned by its `md5`, which is the field to cite.

---

## REL-002c — what session 14 did: the phone column read, and the seed that was inventing a defect

Session 13 left row 6 with three things on it: **the phone shots of its own run, which nobody had
opened**, `/join`, and then Richard's look. The first two are done. The third still cannot be done
by a session.

### 1. The phone column — all fifteen renders, and it broke nothing

**15 phone renders cover the 13 pages** (`/` and `/members` are photographed in both states), and
**every one has now been opened.** Naming the count matters here: s13's fault was that *"all three
widths"* read as satisfied when 20 images had been viewed and **none of them was `phone`**.

🟢 **Nothing is broken at 390.** The three caps this row added are all no-ops below their
breakpoints and none of them misfires: `AT_FORM_MEASURE`'s 720 on `/post` and `/account`, and the
`PROSE` 640 on `/announcements/{id}`. `MEMBER_ROW`'s `Columns` folds to `smallLayout: '1'` under
700 and `/directory` reads correctly as name → email → `Member · since 1 September 2026`, with
**s8's `ada@example.invali / d` mid-word break gone.** `/members` keeps its `Read` button beside
each row rather than folding it under, which is right.

⚠️ **`/join` was graded at all four widths, and the finding was a NON-finding.** At 1900 its footer
sits on the 1200 measure while its hero and form sit on 720 — two left edges. **This is not the
`/post` defect s13 fixed.** `/sign-in` does exactly the same thing, so it is consistent across the
four door pages, and it is the same shape as the arrangement Richard ruled acceptable on 09-01
(*"head on 1200, form panels capped at 720"*) with the roles swapped. **Priced and left alone** —
recorded here precisely so it is not rediscovered a fifth time.

### 2. 🔴 The `/requests` defect was the HARNESS's, not the product's — a seed can make a page look WORSE than it is

`/requests` rendered the applicant's name as the card heading and then again as their own words:
**“Sam Quiet” over “Sam Quiet would like to join.”**, at every one of the four widths.

`RequestRow` is not at fault, and it is right not to be: it binds those two texts to `name` and
`message`, and the entire point of the queue is that a moderator reads **why** somebody is asking.
The duplication came from this line in `vib001-members.look.ts`:

```ts
message: `${name} would like to join.`
```

**The seed was inventing the applicant's reason out of the applicant's name.** No real install can
produce that screen — a real joiner types a real sentence into `/join`'s *"Why you'd like to join"*
box. `JOINERS` now carries a third column, the reason, with **deliberately differing lengths** so
the card is photographed carrying a real range.

🔴 **This is the known seed trap running the other way.** Hazard 10 in the handoff records that
every `ANNOUNCEMENTS` body is one short sentence, so no render this harness takes can show a
paragraph wrapping — a seed hiding a fix. This one **manufactured a defect on a page that was about
to be graded by a person.** Both are the same mistake: **content invented to fill a field, then
photographed as if it came from somebody.** ✅ **Read the seed beside the picture before filing what
the picture shows.**

### 3. The re-render reproduced 32 of 36 text dumps byte-for-byte

The living arm was re-run and diffed against session 13's shots, which were preserved first.
**Exactly the four `/requests` dumps differ; the other 32 are byte-identical.** That is the control:
it bounds the change to the page that was meant to change, **and** it independently shows the
harness is deterministic and s13's pictures were honest.

### 4. 🔴 REGISTERED, not built: the living arm's `artefactMd5` is NOT a content fingerprint

**This board states in writing that *"the artefact is pinned by its `md5`, which is the field to
cite"*. That is true of the door arm and FALSE of the living one.**

`bindProjectToBackend` writes `endpoint: http://127.0.0.1:${port}` into the copied project file
**before** `judge()` hashes it, and the service is started on `port: 0` — an OS-assigned ephemeral
port. **So the living `artefactMd5` changes on every run whether or not one byte of the template
changed.** This session's re-render moved it `ed8a32db → e6bea8be` while editing **nothing but a
test file**, which is how it was caught.

⚠️ **Session 13's own citation inherits this.** It reads the progression *"`5474db3b` (detail pages)
→ `ed8a32db` (the ruled `/post` + `/account` fix)"* as if the hashes tracked those edits. They would
have differed anyway. The edits were real — the pictures show them — but **the hash was never the
evidence.**

✅ **The door arm is sound and was used as this session's real pin:** its `artefactMd5`
`f969ad96…` matches `templates/members-area/nodegx.project.json` on disk **exactly**, which is what
establishes that the door pictures are of the shipped bytes.

**Owner: REL-002c, before the living arm's md5 is cited again.** The fix is to record a hash taken
**before** binding, or of the shipped template file as the door arm already does. Not built here:
it would need a further re-render to produce a manifest carrying the new field, and it blocks no
acceptance criterion.

### 5. ⚠️ REGISTERED: the announcement list does not clamp its body, so the seed cannot be lengthened freely

Hazard 10's obvious repair — give an announcement a body long enough to photograph the `PROSE` 640
measure — is **not free**, and the reason is a product fact worth having written down.
`AnnouncementRow` has **no `maxLines`, `textOverflow`, `clamp` or `ellipsis`**, and `/members`
renders each body in full as its summary. The detail page shoots `firstAnnouncementId`, which is
**also the top row of that list**, so lengthening it to test the measure would bloat the first row
of the page every member lands on.

**That is a product question — should a list summary clamp? — not a seed question.** Owner: `NONE`.
Until it is answered, hazard 10 stands as written: **say whether a measure is asserted from
`nodes.json` or shown in a picture.**

### The readings, with their exit statuses

Gated on an **exit file the command wrote itself**, per this row's hazard 9.

| gate | reading |
|---|---|
| `vib001-members.look.ts` (living arm) | **`EXIT=0`** — `Test Suites: 1 passed`, `Tests: 1 skipped, 1 passed`. The door arm was deliberately filtered out with `-t`: it seeds nothing, so a seed change cannot reach it. **36 shots, 72 PNGs on disk** — reconciled against the manifest, not assumed |
| seeding assertion | `SEEDED {"Announcement":6,"Meeting":4,"MemberRequest":2,"Member":4}` — two left on the queue, three approved plus the moderator |
| determinism control | **32 of 36 text dumps byte-identical** to session 13's; the 4 that differ are exactly `requests-{preview,desktop,wide,phone}` |
| door arm `artefactMd5` | `f969ad96…`, **equal to `templates/members-area/nodegx.project.json` on disk** |

⚠️ **A peer's jest suite was running when this session started** (phase 77's `sb007`/`sbr009`/
`sbr012`). The re-render was **queued behind it** rather than run alongside — two package suites at
once produce flakes that read as yours. It had finished by the time the wait loop polled.

---

## 🔴 REL-010 — row 6 was graded against a benchmark Richard rejects (opened 2026-09-02)

**Full task: [`REL-010-AS-GOOD-AS-THE-PAGE-HE-RATED.md`](REL-010-AS-GOOD-AS-THE-PAGE-HE-RATED.md).
It GATES 0.2.2 and blocks REL-002c, REL-001 and REL-004.**

Richard, shown all thirteen pages and then `verdicts/vib-006/.../landing-desktop-full.png`:
*"This is the one where I said 'this is fucking pro'... all the other ones ... looked like oldschool
Wordpress templates, passable but nowhere near this."*

🔴 **The root cause is this board's own instruction.** *"Grade each page beside `/` at the same
width"* named the members-area's **own** landing page — which is itself in the *passable* bucket. For
fourteen sessions the comparison could not fail. Phase 81 had both his words on file since
2026-08-31 (VIB-006 *"fucking pro"*, its only WORTHY close; VIB-011 *"passable"*) and nobody carried
them across. **The chrome exemption is a session's sentence, not his ruling**, and it licensed the
rest.

**Measured 2026-09-02, VIB-006 as a known-silent control in the same run: 0 of 13 pages read clean,
13 carry a tell.** Twelve top out at **30px** against the rubric's 48 and VIB-006's **94**; the
template holds **zero `Image` nodes** and uses photography only as a background scrim, against
VIB-006's seven content photographs.

⚠️ **Do not quote `no-imagery` on the five hero pages** — the instrument counts only
`tagName === 'IMG'` and cannot see a CSS background. Registered as R1, owned by **phase 81 VIB-007**,
because it is that task's finding.

**Scope ruled by Richard: all thirteen pages.** §3.1 carries the one question still open — how far
the app chrome goes — with a proposal that must not be inferred either way.

## ✅ REL-010 — what session 15 built: §3.1 ruled, and 0 of 13 became 13 of 13

**Full write-up: [`REL-010`](REL-010-AS-GOOD-AS-THE-PAGE-HE-RATED.md) §6.**

**§3.1 was ruled first**, as §5 requires. Richard, from three options: ✅ *"§3.1 as proposed — density,
not billboards."* The public four take the VIB-006 section vocabulary; the signed-in nine get the
display tier, imagery where a row or card can honestly hold one, and a second and third ground. That
also **discharges R2** — the chrome exemption is now a dated ruling with an author, and
`NEXT-SESSION-PROMPT.md` states it as one.

| | before | after |
|---|---|---|
| pages reading clean | **0 of 13** | 🟢 **13 of 13** |
| door four | 30px · 0 img · 0 ico · 2–3 gnd | **72px** (`/unsubscribe` 48) · **3 img** · **2 ico** · **4–5 gnd** |
| `/` living | 48px · 0 · 0 · 4 | **94px** · **3** · **2** · 4 |
| signed-in eight | 30px · 0 · 2 · 2 | **48px** · 0 · **4** · **3** |
| control (VIB-006) | 94 · 7 · 20 · 6 · silent | **identical, silent** |

### 1. 🔴 The type finding was ONE PARAMETER, and it was an override of the product's own fix

`displayHeadline` already carried `--display-lg`. VIB-002 / register V13 put it there **naming this
page**: *"the members-area hero is 48px, exactly the ceiling, and reads as a paragraph that got
bigger rather than as a hero."* `tpl001Components.ts` then had
`{ ...composition('displayHeadline'), fontSize: 'var(--text-5xl)' }` — the fix, overridden back to
the ceiling it was written to lift. Fourteen sessions graded the result against a page carrying the
same override.

🔴 **A census of the BENCHMARK stopped the obvious over-correction.** VIB-006 reads one
`--display-lg`, one `--display-md`, **four `--text-3xl`**. Its section headings are **30px — the size
this template's already were**. The gap was the *top* of the ramp, not the ramp. Two landing band
headings were wearing `H_PAGE` and would have been promoted by accident; they are pinned at 30.

### 2. The composition work — 30 components became 32

`Members/InsideBand` (the photographed tiles band, lifted out of `Pages/Landing` so the door pages
could place it) and `Members/Prompt` (the closing band — which is `/sign-in`'s and `/join`'s own
loose hint and button given a ground, not new surface). Plus the template's **first real `Image`
node**, a footer **wordmark**, and a page-identity band on `--accent` across the nine app-chrome
pages.

### 3. 🔴 Two cheap wins were REFUSED, and the refusals are the transferable part

- **`PAGE_GROUND` was not painted `--background`.** It would have taken all nine app-chrome pages
  from 2 grounds to 3 and **changed no pixel** — that colour is what the ground already appears to
  be. Hazard 2 run backwards. Now hazard 14 on the board.
- **No stock avatars on `/directory`.** AC3 says imagery *"wherever a row or card can **honestly**
  hold one"*. A `Member` row has no photograph field; a stock face beside a real name and real email
  is a claim about what somebody looks like. **The honest route is a product change (an avatar
  members upload), not a picture the template invents.**

### 4. 🔴 R3 happened LIVE — the baseline had to be re-taken

A peer's webpack rebuilt `noodl.viewer.js` (`8c0ad51b…` → `e35ea918…`) **between the baseline and the
after-run**, twenty minutes after that peer announced the watch was down and the bundle static.
`TPL001_TEMPLATE_DIR` (new, in `helpers/members-drive.ts`) points a run at a `git archive` of the
committed artefact, so the artefact rolls back while the runtime stays current. ✅ **The re-taken
baseline reproduced the original exactly**, all fourteen rows, which is what makes the before/after
admissible. Every run now records the viewer md5 **before and after** itself.

### 5. Acceptance criteria

**AC1 🟢 · AC2 🟢 · AC3 🟡 · AC4 🟡 · AC5 🟢 · AC6 ⏳ Richard's look, which a session cannot close.**

- **AC3** is met on the public four (3 rendered photographs each, from 0) and **declined in writing
  on the nine** — see item 3.
- **AC4** is met as written (public four 4/5/4/4; signed-in nine 3). ⚠️ **`/unsubscribe` reads 2 and
  AC4 names neither group it is in** — registered as **R6**, a hole in the AC rather than a defect
  it found, and D39 may already make 2 the right answer there.

### 6. New register rows

| row | what | owner |
|---|---|---|
| **R5** | A pin read once cannot tell you a rebuild landed inside the measurement window. Record the runtime md5 **at both ends** of every run. | **REL-010**, done |
| **R6** | AC4 names *"the four public pages"* and *"signed-in pages"*; `/unsubscribe` is in neither and reads 2 grounds. | **REL-010** — one word from Richard, with AC6 |
| **R7** | The harness's `shortGround()` collapses every scrim to the string `gradient`, so two bands over *different* photographs print identically. The `distinct` COUNT is unaffected. | **REL-002c** — diagnostic only |

---

### REL-003 — The stale bundles the cut inherits

Phase 80 closed several fixes whose effect a user cannot see, because the committed build output
predates them. The owner it assigned was *"whoever cuts the next 0.2.1 build"* — that is this phase.

| artefact | what is stale |
|---|---|
| `packages/noodl-mcp/dist/noodl-mcp.cjs` | a running MCP server still answers `notFound` for `Page.title`; source, suites and committed catalog are correct |
| `nodegx-backend/dist` | DEF-021 / DEF-023 |
| `noodl-editor/src/external/viewer`, `deploy`, the ssr copies, `nodegx-backend/deploy/artifact` | the old handler — an editor drive today exercises the pre-fix bundle. ~~DEF-035's `Origin` port has no output on the canvas until the cloudruntime bundle is rebuilt~~ 🔴 **the cloudruntime bundle is RETIRED (WF-007) — see below; DEF-035 rides in `nodegx-backend/dist`** |

**ACs**

1. Every artefact above is rebuilt from HEAD and committed, and the rebuild is **reproducible** —
   a second run is byte-identical.
2. Each named defect is **observed fixed through the rebuilt bundle**, not only through its unit
   suite. P77's SBR-015 admin drive is the instrument for the viewer half.
3. 🔴 Gate on the **exit status**, never on an error-line count. An OOM log carries zero
   `error TS` lines and reads as a pass.

---

#### 🔴 AC1 IS UNBUILDABLE AS WRITTEN — measured 2026-08-31 (s2)

**There are no committed bundles.** Every artefact this task names is **gitignored with zero tracked
files**, verified with `git check-ignore -v` and `git ls-files`:

| artefact | ignored by | tracked files |
|---|---|---|
| `packages/noodl-mcp/dist/` | `.gitignore:117` (`dist`) | **0** |
| `packages/nodegx-backend/dist/` | `packages/nodegx-backend/.gitignore:1` | **0** |
| `noodl-editor/src/external/{viewer,deploy,ssr,cloudruntime}` | `.gitignore:200` | **0** |
| `packages/nodegx-backend/deploy/artifact/` | `packages/nodegx-backend/.gitignore:9` | **0** |

🔴 **Committing them would fail a gate that already exists.** `scripts/check-build-artefacts.js`
check 1 (**REV-008**) asserts *"no generated editor build output is tracked in git"* — written after
a months-old committed bundle ran instead of the code beside it and the editor opened a black
window. So **AC1's "and committed" is not merely unnecessary, it is the defect REV-008 exists to
prevent.** ✅ **AC1 is amended**: rebuilt from HEAD, **reproducible**, and *not* committed.

✅ **And the release does not inherit the staleness.** `npm run check:artefacts` exits **0** with
*"2 packaging workflow(s) build the sidecars before electron-builder"* — check 3 exists precisely
because `release.yml`/`nightly.yml` once packaged without them. **A cut of 0.2.2 builds these; it
does not ship the tree's copies.**

🔴 **So what P80 actually found was LOCAL staleness, and it bites a DRIVE, not a user.** That is
still worth fixing — every drive REL-001, REL-002b and REL-003 itself depend on runs against this
checkout's bundles — but it is not a release blocker, and the task's framing had it as one.
✅ **Ask whether a stale artefact reaches a USER or only reaches YOUR INSTRUMENT** — the two have
opposite urgencies and this one is the second.

#### ✅ What was rebuilt, and the reproducibility reading

`npm run build:sidecars` — exit **0**, twice. All six outputs **byte-identical across the two runs**
(`md5` on `nodegx-backend/dist/{cli,index}.js`, `nodegx-observe/dist/nodegx-observe.cjs`,
`noodl-mcp/dist/{noodl-mcp,kit-extract,nodegx-observe}.cjs`), so **AC1's reproducibility clause is
met** for the sidecars.

`noodl-mcp.cjs` moved `033f0675…` (2026-08-20) → `1ad98b5c…` (2026-08-31), against a newest source
commit of `0b7a837c` on **08-31**: eleven days stale.

✅ **The viewer half of the reproducibility clause was measured too, by accident and then on
purpose (s3).** `build:editor:_viewer` was run a second time at 07:35 — a different session, a
different hour, the same HEAD — and produced `noodl.viewer.js` at **1,541,867 bytes, the same size
to the byte** as the 22:43 build, still carrying DEF-026's string. ⚠️ **Size-identical, not
verified byte-identical**: the 22:43 file's `md5` was never taken and the dev stack had already
overwritten it (see the trap below), so the digest cannot be recovered.

#### ✅ AC2, the MCP half — observed THROUGH the bundle, with a live control

The two bundles were asked **the same question, in the same project, through the same tool**, and
the only thing varied was which bundle answered. This session's own MCP server had loaded the old
`dist` at startup, so the stale arm is a **live reading**, not a reconstruction:

| bundle | `get_node_type(["Page"], ports:["title"])` |
|---|---|
| **old** (`033f0675…`, running server) | `"inputs": []`, **`"notFound": ["title"]`** — the defect, live |
| **rebuilt** (`1ad98b5c…`, HEAD) | `title` returned as a full declared input, with type, `displayName`, group and description. **No `notFound`** |

🔴 **This is why "the suite is green" was never the answer.** The source, the specs and the committed
catalog were all correct the whole time; the thing a user's agent talked to was eleven days behind
them. ✅ **A bundle is an artefact with its own mtime — grade the artefact, not its source.**

#### ✅ The suite the rebuild owed

`packages/noodl-mcp` — **83 suites, 1085 tests, all passed, exit 0.** Run after the bundle was
regenerated, because this is the package whose `dist/` moved. The count matches the independent
read a peer took over the same tree earlier the same day.

#### 🔴 The `cloudruntime` row names a DEAD artefact — and exit 0 did not say so

`npm run build:editor:_viewer` exited **0** and rebuilt `viewer`, `deploy` and `ssr`
(all three newest files stamped **2026-08-31 22:43**; `noodl.viewer.js` moved
`0e56e3a3…` → `3bf45a78…`). **`src/external/cloudruntime/sandbox.viewer.bundle.js` did not move** —
still `cd652849…`, still **2026-07-25**.

⚠️ **That looks exactly like a build that exited 0 without building anything** — the failure this
repo has already been bitten by. It is not. The truth is in
[`noodl-viewer-cloud/webpack-configs/webpack.prod.js`](../../../packages/noodl-viewer-cloud/webpack-configs/webpack.prod.js),
which says so in a comment: **WF-007 retired the sandboxed cloud-function-server, and its
cloudruntime bundle with it.** The config now builds only the isolate bundle.

🔴 **Cloud functions run inside `nodegx-backend`, which esbuilds `noodl-viewer-cloud/src` directly**
via the `@cloud-runtime` alias
([`nodegx-backend/scripts/build.js:38`](../../../packages/nodegx-backend/scripts/build.js#L38)).
Corroborated three ways: **nothing** in the repo writes `sandbox.viewer.bundle.js`; **nothing** in
`packages/noodl-editor/src` references `cloudruntime` at all; and `scripts/devtools/cdp.js:451`
**deliberately excludes it** from its freshness check with the same WF-007 note.

✅ **So this row of REL-003's table was wrong, and wrong in the expensive direction.** *"DEF-035's
`Origin` port has no output on the canvas until the cloudruntime bundle is rebuilt"* names a bundle
that **cannot be rebuilt because its producer was deliberately deleted**. The live carrier of both
DEF-023 and DEF-035 is **`nodegx-backend/dist`** — rebuilt this session at 22:40, with 65 markers
from `noodl-viewer-cloud` inside `dist/index.js`. A session following the table would have rebuilt,
seen the artefact unchanged, and concluded **the build is broken**. ✅ **Before calling a stale
artefact a build failure, find its PRODUCER — a dead artefact and a failed build look identical from
the mtime.**

⚠️ `src/external/cloudruntime/` is therefore **retired residue**: gitignored, unreferenced, unread.
Owner **NONE**. Left in place — deleting it is not this phase's call.

#### ⚠️ Registered, not built: eight stale duplicate directories

`noodl-editor/src/external/` holds macOS copy duplicates — `viewer 3`, `deploy 2`, `ssr 3`,
`cloudruntime 3` — all dated **2025-12-06**, up to nine months behind their unsuffixed twins.
✅ **Measured harmless**: nothing in `packages/noodl-editor/src`, `scripts/` or `.github/` references
any of them (quoted `--include` globs with `-a`; an unquoted glob is a zsh no-match that reads as a
clean absence), the editor's web server serves the unsuffixed `src/external/viewer`, and all four are
gitignored so none can ship. **Local clutter, owner NONE.** Recorded so the next session that greps
this directory does not re-derive it at full price.

#### ✅ AC2, the backend half — DEF-023 observed THROUGH a bundle, one variable, with a presence control

**The instrument** (`scratchpad/rel003/`, kept out of the repo): a real `nodegx-backend` spawned
from a `cli.js` handed in on the command line, driven over real HTTP, with a real SMTP socket on
the other end for the mail arm. **The only thing that varies between arms is which bundle is
spawned.**

🔴 **The July deploy artefact is NOT a usable pre-fix control.**
`packages/nodegx-backend/deploy/artifact/backend/cli.js` (2026-07-26) is the obvious free old arm
and it reads *zero* — but for the wrong reason: it predates ERG-001's port rename, so it answers
`Node noodl.cloud.sendemail doesn't have a port named done` and never mails at all. ✅ **A control
that cannot run the graph is not a control** — it was read first, and discarded, rather than
scored.

So the control was **built**: the same esbuild pipeline as `scripts/build.js` (same alias, banner,
target, externals), into a temp directory, over a **copy** of `noodl-viewer-cloud/src` with exactly
two files reverted — `nodes/cloud/sendemail.ts` to `4adab228^` and `noodl-js-api.js` to
`acd053e0^`. A third arm builds the *same* pipeline with **no** revert, so the pair differs in the
two source files and nothing else. ✅ **Nothing was written into the repository**: `dist/` is still
byte-for-byte what HEAD built at 22:40 (`md5 6b31e8d1…`).

| arm | `guarded` invoked 3× | `sharing` (the presence control) |
|---|---|---|
| **PRE-FIX** (2 files reverted) | `fresh` → **`stale`** → **`stale`** | `written-by-the-first-script` |
| HEAD source, same pipeline | `fresh` → `fresh` → `fresh` | `written-by-the-first-script` |
| **`packages/nodegx-backend/dist/cli.js` — the rebuilt artefact** | **`fresh` → `fresh` → `fresh`** | `written-by-the-first-script` |

The graph is D35's guard verbatim (`if (Component.def023 && Component.def023.planned) …`), the same
one `def023-component-scope-lifetime.test.ts` uses — but here it is reached over HTTP, by a service
loaded from a bundle, three requests in a row.

🔴 **The `sharing` row is what makes the other one mean anything.** `fresh, fresh, fresh` is also
what you would see if the fix had simply made `Component` a fresh bag on every script run, which
would break the contract the scope exists for. Two scripts in **one** component instance still see
each other's writes, in every arm — so the reading is *"the scope died with the request"*, not
*"the scope stopped working"*. ✅ **Assert an absence only beside a known-firing signal.**

#### 🔴 AC2, the mail half — DEF-021 is NOT OBSERVABLE through the bundle, and the reason outlives this task

The fan-out arm passes and **proves nothing**. Three addresses asked, **three delivered, to a, b
and c**, through the rebuilt `dist/cli.js` — and **the pre-fix bundle delivers the same three**.

The tell is the control, not the finding. The constant-address arm — erg-001 §4's pinned
behaviour, *"two Dos coalesced into one pass are ONE send"* — delivered **three** messages in
**every arm**. That can only mean the batch never holds more than one token, and `doSend`'s
changed branch is entered only when it does: DEF-021 rewrote how an **already-coalesced** batch is
dispatched and left `scheduleSend`'s coalescing guard untouched. No coalescing, no difference.

Three constructions were tried, all with `To` held constant and `Do` pulsed twice — two pulses from
one script run; two pulses from two scripts fanned out from the same `receive`; and the same wire
duplicated straight from `receive` into `Do`. **All three delivered two messages.** The mechanism
is not mysterious: `flagDirty` → `_performDirtyUpdate` runs synchronously
([`node.ts:760`](../../../packages/noodl-runtime/src/node.ts#L760)), so each pulse completes its own
update — including `scheduleAfterInputsHaveUpdated`'s callback — before the next one arrives.

🔴 **So the pinned behaviour is a property of the unit probe's scheduler, not of a running cloud
function.** `erg-001-cloud-node-outcomes.test.ts` §4 and `def021-send-email-fanout.test.ts` both
drive the node with a hand-built probe whose `scheduleAfterInputsHaveUpdated` pushes into an array
flushed by hand. Server-side, two `Do`s are two sends. ✅ **A spec that supplies the scheduler is
grading its own harness** — and `Send Email` is server-only, so there is no other runtime in which
this branch could be reached.

⚠️ **What this does and does not say.** It does **not** say the DEF-021 fix is wrong: the delivered
addresses are correct in both arms and the new code is strictly more careful. It says **AC2 cannot
be discharged for DEF-021 by a drive**, because the rebuilt bundle and the pre-fix bundle are
behaviourally identical from every door a graph can knock on. The unit suite remains the only
instrument that can see it. **Recorded rather than dressed up as a pass.**

🧭 **Registered, not built — owner `NONE`.** *"Is `Send Email`'s coalescing branch dead code in
every runtime, and if so does D33's blast radius survive re-derivation?"* It does not block a 0.2.2
AC and it is not this phase's work. It belongs to whoever next owns `noodl-viewer-cloud`'s node
ergonomics; there is no open phase holding that today, which is why the owner is `NONE` and the row
lives here rather than in a closed phase's register.

#### ✅ AC2, the viewer half — DEF-026 observed in a REAL BROWSER, both halves, with an answering control

Driven in the editor's preview window (CDP `--target=viewer`), on a **copy** of `fix012-drive`, with
`cloudservices.endpoint` pointed by hand at a **closed port** and then at a **live server that
answers with an error body**. The endpoint is the only thing that varies.

| arm | `Noodl.CloudFunctions.run(…)` rejects with | `CloudFunction2` node |
|---|---|---|
| **refused** — `http://127.0.0.1:59999` | `{"error":"Could not reach the backend at http://127.0.0.1:59999"}` | signals **`failure` → `completed`**; `Error` = the same sentence; `lastCallResult.status = failure`; **no uncaught exception** |
| **answering with an error** (control) | `{"code":141,"error":"the backend answered, and this is its reason"}` — the body, verbatim | signals **`failure` → `completed`**; `Error` = the body's own reason |

🔴 **Both halves of the fix were driven, and they are two different copies of `_makeRequest`** —
`api/cloudfunctions.ts` (the `Noodl.CloudFunctions` API a script calls) and
`nodes/std-library/data/cloudfunction2.ts` (the node). Probing one would have said nothing about
the other.

✅ **The answering arm is the known-firing signal.** *"Could not reach the backend"* on its own is
also what you would see if the handler had simply been made to print that sentence for every
failure — and it is what a **CORS rejection** looks like, since that is `status 0` too. The control
server sends permissive CORS headers and a JSON 500; its reason comes back verbatim, so the two
failures with opposite fixes are still separate. **This is the person-sentence in DEF-026** — *a
graph wired correctly for failure showed nothing when the backend was simply not running* — and it
now fires.

⚠️ **Two boundaries, said rather than buried.**

1. 🔴 **The bundle that answered was the DEV webpack build, not the 22:43 production rebuild** —
   see the trap below. Same HEAD source, real Chromium, real XHR; but it is not a reading of
   `src/external/viewer/noodl.viewer.js` as REL-003 rebuilt it.
2. **No pre-fix arm.** The one free candidate,
   `nodegx-backend/deploy/artifact/app/noodl.deploy.js` (2026-07-26, and it does **not** contain the
   string), was not served and driven. So this arm shows the fix present and discriminating; it
   does not re-measure the defect.

#### 🔴 `npm run dev:debug` OVERWRITES the viewer bundle REL-003 just rebuilt

Measured this session. `build:editor:_viewer` wrote a **production** `noodl.viewer.js` at
**22:43 — 1,541,867 bytes**. Launching the dev stack put webpack in watch mode over the same
output directory, and by **07:27:22** that path held a **dev** build of **14,535,265 bytes**.

✅ **Same source, different artefact.** Nothing was lost — the file is gitignored, the release
pipeline builds its own (check 3, README §1), and the dev build carries the fix (the DEF-026 drive
above ran against it). But a session that rebuilds the production viewer and *then* launches the
editor to check its work **is no longer looking at what it built**, and the mtime will not say so:
both are recent. ✅ **After a drive, rebuild the production viewer before claiming the tree carries
it — and check the SIZE, which is the field that separates the two builds.** Restored at the end of
this session.

### REL-004 — The cut

**ACs**

1. ✅ **MET, session 11 — `5c805978`.** `packages/noodl-editor/package.json` reads `0.2.2`, and the
   bump is its own commit: one file, one line, committed by pathspec so no peer edit rode with it.
   Gated on `npm run ci:build:editor` **exit 0** after the change — the production-only path that
   `test:ci`, `typecheck`, `lint` and `test:main` never load. See
   [the runbook §2](../release-0.2.2/PUBLISH-0.2.2.md) for the two findings behind it: the nine
   `library/prefabs/*/library.json` files that also read `0.2.0` and must **not** move, and why the
   `package-lock.json` copy is **not** a gate despite CI running `npm ci`.
2. Release notes written from the **commits since `v0.2.0`**, not from task files — a task file
   says what was intended, the log says what shipped.
3. Tagged `v0.2.2` and published, following `dev-docs/tasks/release-0.2.0/PUBLISH-0.2.0.md`.
4. The floor is green before the tag, and the reading is **fresh** — delete `test-results.json`
   first and require a new mtime. ⚠️ `typecheck:backend-tests` cannot complete on this box; CI runs
   it. Do not promise a local reading.
5. 🔴 A bad cut is fixed by unpublishing (edit → draft) and shipping 0.2.3 — recorded so nobody
   force-pushes a tag.

### REL-005 — What rides and what rolls

Phase 75 is the 0.2.1 container and its board is nearer done than its reputation. Counted from
`phase-75-…/TASKS.md` tiers 0–4 on 2026-08-31: **22 done, 4 open — 26 rows.** ⚠️ **This originally
read "24 done, 4 open" and the done count was two high**; corrected s2 by counting the board's own
`- ✅`/`- ⬜`/`- 🟡` rows between the Tier 0 heading and the *Found while working* section. The open
count, which is what the triage acts on, was right.

| open row | state |
|---|---|
| **FB-005** — templates, curated first | T1–T5 **built and deployed**; the blocker is **CONTENT**. 🔴 **REL-001 is what closes this gap** — publishing the association template puts the first row on an empty shelf |
| **FB-013** — chat | Overruled and scoped; C1/C2/C3 built |
| **FB-009** — a syllabus entry you can start | 🧭 lessons are Richard's prose |
| **FB-012** — default tutorials + share/export | 🧭 content is Richard's |

Plus the phase-74 carry: FIX-025, FIX-026, FIX-027, the `tsfixme` baseline, and the production
`ANTHROPIC_API_KEY` (open, **no deadline** — see the correction in P75's handoff before repeating
one).

**AC**: each row is marked **rides 0.2.2** / **rolls forward, owner X** / **blocked on Richard**, in
writing, in P75's own board. Two of the four are gated on Richard's content and cannot be
force-marched.

✅ **CLOSED 2026-08-31 (s2).** The AC is met in
[`phase-75-…/TASKS.md`](../phase-75-0.2.1-the-feedback/TASKS.md): a **triage section at the head of
the board**, plus an inline disposition on each of the **four open rows** and each of the **five
phase-74 carry items** — nine in total.

🔴 **The distinction that decided every row: `0.2.2` is an APP cut, and `nodegx-community` is
SERVED.** Served work is either deployed or not and never rides a tag, so a row with both halves is
triaged twice, and "done" on the served side is a **deploy stamp with a date**, not a commit.

**The dispositions**

| row | disposition |
|---|---|
| FB-005 | ✅ **rides (code) · closes on REL-001** — shelf measured `total: 0`, so the gap is content |
| FB-013 | 🟡 **partly rides** (C4's launcher half, `3d01a44d`) · **remainder rolls forward, owner phase 75** |
| FB-009 | 🧭 **blocked on Richard** (prose) · **rolls forward, owner [phase 79](../phase-79-the-syllabus/README.md)** |
| FB-012 | 🧭 **blocked on Richard** (content) · **rolls forward, owner phase 75** |
| FIX-025 | ✅ **rides** what landed · §5's park rolls forward |
| FIX-026 | 🧭 **blocked on Richard** · rolls forward, owner phase 75 |
| FIX-027 | ✅ **rides** §17/§19/§20 (`f6d25d19`, `fada53fd`) · remainder rolls forward |
| `tsfixme` baseline | 🧭 **blocked on Richard** · rolls forward, owner phase 75 |
| prod `ANTHROPIC_API_KEY` | 🧭 **blocked on Richard** · rolls forward · 🔴 **no deadline** |

**Measured today, not relayed** — `/api/v1/community/templates` **200** `total: 0`,
`/api/v1/community/chat` **200**, `/chat` **200**, invented sibling **404** (the control that makes
those 200s mean *the route exists*); nexus-1 stamps `91d8b0c4…` `main` `dirty: false`
2026-08-28T06:48:29Z; `3d01a44d`, `f6d25d19`, `fada53fd`, `27f16f8b` all ancestors of HEAD.

🔴 **Two findings the triage produced, both registered in P75 rather than built here:**

1. **FB-013's own "the chat routes are NOT DEPLOYED — 404 on production" is no longer true.** A
   deploy landed 2026-08-28T06:48Z. The sentence is still a correct account of why session 57 drove
   locally; it is **not a reading of production today**. ✅ **A deployment claim decays — re-read the
   stamp, never inherit it.**
2. ⚠️ **C5 is built, committed and undeployed, and production is exactly one commit behind it**
   (`2bce720` vs `91d8b0c`), with **`NODEGX_MODERATORS` unset** on nexus-1. So **any deploy of
   `main` to nexus-1 carries C5 in** — and unconfigured, its hide route 404s for everybody including
   Richard. **Set the var in the same act, or do not deploy it.** Owner: phase 75. **Not built here**
   — it does not block a 0.2.2 AC.

⚠️ **Also corrected in P75 while triaging its own rows**: the board still carried
🔥 *"the `ANTHROPIC_API_KEY` item has a 2026-08-31 deadline."* That urgency was **retracted in P75's
own handoff** and never reached the board. It is a **price date, not a deadline**, and REL-007 has
now removed its one real consequence.

### REL-006 — The hold list, and two stale files

**ACs**

1. The site-builder hold is recorded with a **named owner and a phase that outlives this one** —
   `NONE` is allowed; a closing phase's name is not.
2. `phase-78-the-templates/NEXT-SESSION-PROMPT.md` is corrected: **T6 is done at HEAD** (README
   §1.3), so *"the only buildable work left"* is now T5, and T5 is unblocked.
3. `TPL-001-THE-MEMBERS-AREA.md` **AC1** is updated from *"not gradeable"* — REL-001 is what grades
   it. AC6 (the designed empty state on a fresh install) is the one criterion with no reading
   against it, and it is **the same screen REL-002c is redesigning** — grade it once, there.
4. 🔴 **Phase 81's board records that VIB-005 and VIB-008 are CARRIED to phase 82**, with this
   phase named as the owner. Without it two phases believe they own the members' area — the trap
   that already cost this project two sessions on P77 D30/D31. ⚠️ **Write it only after the peer
   session that was live on 2026-08-31 has ended**; check the lane first.

### REL-007 — The price that goes stale tomorrow

[`models.ts:229`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/models.ts#L229)
prices `claude-sonnet-5` at `$2 / $10` per MTok, with a `MAINTENANCE:` comment saying the
introductory rate ends **2026-08-31** and reverts to `$3 / $15`.

Verified against current Claude pricing 2026-08-31: **Sonnet 5 is $3 input / $15 output per million
tokens**, with $2/$10 introductory through 2026-08-31. Sonnet 5 **is the app's default model**
(`isDefault: true`), so from 1 September every cost figure the app reports is low by a third.

⚠️ The other `inputPerMTok: 2.0` in the file (line 266) is **GPT-4.1** and is unrelated. Change the
Anthropic entry only, and remove the `MAINTENANCE` comment with it.

**AC**: line 229 reads `{ inputPerMTok: 3.0, outputPerMTok: 15.0 }`, the stale comment is gone, and
any spec asserting the old figure moves with it. A stale price does not break requests — it only
misreports cost — so this is a one-line fix, not a first job.

### REL-009 — The write the editor cannot see (a, b)

**Full task: [`REL-009-THE-WRITE-THE-EDITOR-CANNOT-SEE.md`](REL-009-THE-WRITE-THE-EDITOR-CANNOT-SEE.md).**
Added 2026-09-01 on Richard's *"can we roll the tasks needed to fix this into 0.2.2 phase please?"*,
after asking whether the MCP-writes-while-the-editor-is-open bug had been fixed. It had not, and
nothing had ever been built for it.

🔴 **It RIDES 0.2.2, it does not GATE it.** README §4's close condition names four things and this is
none of them; it is carried on the REL-008 precedent so a launch session can build it without opening
another phase — **and drop it without debate if the cut is ready first.** Flipping it to gating is
Richard's call and a one-line edit here; do not infer it.

⚠️ **This row widens the container, which README §2 tells you to resist.** It is here because Richard
asked for it by name, and the note above is what keeps the widening honest: a row that does not gate
the close condition cannot silently become a blocker.

**The two readings that shape it** (both measured at HEAD 2026-09-01, neither relayed):

- **The invisibility is total and the fix's seam is dead code.** No `chokidar`/`fs.watch`/`watchFile`
  anywhere in `packages/noodl-editor/src` or `packages/noodl-platform*/src` once the pre-built viewer
  bundles are excluded — the nine hits are all a DOM `watch(node)` helper. The only watcher in the
  repo is `noodl-preview`'s, and SUB-009 put driving the *editor's* preview from disk explicitly out
  of scope. Meanwhile `reloadComponentFromDisk` has been complete and uncalled since 2026-07-23.
- 🔴 **The clobber warning we have relayed five times is wrong for v2.** `saveProject` writes only
  components whose in-memory hash differs from the load-time baseline, `updateRegistry` re-reads
  `registry.json` from disk, and MCP-added components are never proposed for deletion. Had REL-009a
  been built to the warning instead of measuring, it would have built conflict machinery the product
  does not need. **Read the presence controls before believing the finding.**

**Not covered, and named so it is not rediscovered**: whether MCP can author into a legacy project at
all (U1 — decides whether the real full-clobber path is even reachable), whether `routes.json` /
`styles.json` clobber (U2 — the likeliest second finding, since registering a page writes routes),
and whether the canvas survives a model swap on the component it is showing (U3 — the likeliest place
for REL-009b to get expensive). `chokidar` vs recursive `fs.watch` is **unruled** (D1); the builder
picks and records why, and **does not extend `IFileSystem`** — it has no watch API, and AIX-009
already paid for finding that out.
