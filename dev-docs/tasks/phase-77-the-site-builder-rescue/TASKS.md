# Phase 77 — task board

Task table lives in [README.md](README.md) §5 with the dependency order. This file carries
per-task status and the session log.

## Status

| id | status | note |
|---|---|---|
| SBR-001 | ✅ closed s2 | driven end-to-end; ACs 1–5,7 verified live, AC6 by spec + shelf listing |
| SBR-002 | ✅ closed s4 | AC4 driven — all three states, each with its negative control; the drive **found and fixed a real defect** (the watchdog could never bark — see s4 log) |
| SBR-003 | 🟡 s4: built, swept, driven | AC1–4 verified live (floor stamps, overlay beats it, delete falls back); AC5 spec half green. **Owed: the `var(--token)` dimension-port probe — carried into SBR-004.** Person-sentences complete with SBR-004/006/009 |
| SBR-004 | 🟢 s8b: AC1/2/4 driven PASS; root-URL fix DRIVEN with a control pair | **AC1 ✅** nav 219→**68px, three links on one row at y=24**; header **98**, footer **74** (were 218/219) — the lever is `sizeMode` on seven Groups + the nav link, collected as `STACKED_IN_A_COLUMN`. 🔴 `flex-grow` is NOT the lever. **AC2 ✅** `--primary`/600 on the current link, muted/400 on siblings, on a fresh `/home` load **and** after in-app nav to `/about`, nothing poked. 🔴 **The AC2 cause was NOT in the template**: the NDA-017 migration writes `runOnChange-*: false` on load for every node whose control signal is wired — **37 nodes in a fresh project, zero `true`s**; an explicit `true` survives, absent does not (§9.2). **AC4 ✅** re-confirmed at 360px with control; a 51-char title is clipped, not scrolled. ⚠️ **`maxWidth` is inert on `Text`** — authored, driven (`computed: none`), removed (§9.3). 🔴 **Next and bigger than either AC: the root URL `/` renders NO page** — `The slug to show` is the one migrated node whose `run` (`didMount`) genuinely races its `in-homeSlug` (§9.2). 🔴 49 specs were green while both ACs failed; three new checks + mutants close it (§9.5). AC3 remains SBR-012's. **s8b**: 🔴 **the root URL is DRIVEN** — but the first reading was a PASS and 12 reloads all passed, because the race wins on a warm local backend; forcing it to lose (`Fetch.requestPaused` delaying only `*8594*` by 1500ms) gave a real control pair, same project, only the two parameters varied. 🔴 **§9.2's characterisation was WRONG**: it is not the empty-slug path — with a slow fetch `/`, `/home` and `/about` ALL render no page, because the guard gates every slug. ✅ §10.2's probe answered: the nav click **remounts** (`window` marker survived, element stamps died), so `in-slug: true` is defensive, not a second fix. **s8**: the root URL's cause is fixed (`runOnChange-in-slug`/`-in-homeSlug: true` on `The slug to show`) and gated artefact-wide in `sb007Template.test.ts`, but 🔴 **the drive is OWED** — Richard hand-drove the only editor stack all session. §10.3's census replaced §9.2's armchair clearance of the other 32 silenced nodes: 27 nodes / 48 parameters, and the property that separates a harmless silencing from a blank page is whether the input's producer is ordered before the control signal — `PageInputs` is the template's only such producer (`router.tsx:586`) |
| SBR-005 | ⬜ open | |
| SBR-006 | 🟢 **s33: CLOSED — ALL FIVE ACs MET.** `Unpublish` clicked, AC3 done | 🟢 **s33 (2026-08-30) CLOSED AC3, and with it the task** — `sbr006-unpublish-drive.test.ts`, **14/14 green in 68 s**, the whole template authored through the real MCP server, deployed with enforcement ON, signed into through its own form and driven in headless Chrome. 🔴 **The ORDER of the acts is the measurement**: the row starts `published: false`, so clicking `Unpublish` on a fresh draft and reading `false` would pass **on a button wired to nothing**. So `Publish` is clicked first *through the same menu* — `false`/404/`Draft` → `true`/**200**/`Published` → **`false`/404/`Draft`** across stored row, ANONYMOUS read and the pill. 🔴 **A same-endpoint sibling still had to be clicked**: `in-publish: false` is a **constant on the node, not a value on a wire**, so a `CloudFunction2` that never carried it would call the same endpoint, answer **200**, record `success` and **publish the page again** — indistinguishable from a working unpublish to everything already driven. `sb004-publication-invariant` covers the ENDPOINT's unpublish; nothing covered the BUTTON. **MUTANT** (`removed:1`, named by BOTH ends — `(onClick, call)` names THREE wires here): drop `unpublishButton.onClick → unpublish.call` and the same click leaves the row published while **the menu still offers the button**. 🔴 **The first run went 13/14 and the red was the SEED, not the product** — the seeded page answered **200 to an anonymous reader before anything was published**, which fits `canAccessRecord` reading an ABSENT ACL as public (`model.ts:701-718`) exactly, and is not that: `/Pages/Admin`'s `create` node writes `ADMIN_ONLY_RULES`, so a page a PERSON creates is born admin-only. ✅ **A seed that bypasses the product's own creation path is a second product**; reading the create node is what excluded it, not the other 13 greens. ⚠️ `execution_steps` now records **SIX** steps per publish where §5.13 read five — the extra is a second `SetDbModelProperties`; **cause not established and not claimed**, but it is evidence for **SBR-015 AC4's owed re-read** and deliberately not a closure of it. ✅ **No product source changed** — the behaviour was already right; the click and the reading were what was missing. 🟢 **s19 (2026-08-29) CLOSED AC2 (§5.11).** Driven on `SBR-017 Sign In Drive`, chosen because its `Page` class is a photograph of the defect — `published/showInNav/navOrder` (arrive as **parameters**) have columns, `title/slug` (arrive as **wires**) do not — so SBR-008 §6.3's self-healing **cannot** be the explanation: with no column, the schema path has nothing to mint from. Four-cell control on one node in one call: `prop-title`/`prop-slug` **TRUE** (the fix), the three parameter fields TRUE, and **two** negatives — `prop-neverWiredNoColumn` false and ✅ **`prop-seoDescription` false, which is the better one**: a *real* field of this template's `Page` model, wired on `/Pages/PageEditor`, and this node still says no. So the port set is per-node and wire-derived, not "every `prop-` name in the project". Export kept **336/336** with `evaluateHealth()` forced — ⚠️ a number that alone is equally what an *inert* filter gives; the two `false` cells are what make it mean anything. One dialog, one Create: `Page` went **7 → 9 columns**, `_Schema.Page` 10:28:24 → **14:03:07** (the second of the create), while `SiteSettings`/`Theme`/`_User` in the same DB at the same moment did **not** move; the marker set before the click survived it, so **no reload**. The two rows now sit in one list — `7cb644bb` (s14's build) blank where its name and slug belong, `086848fa` named (`notes/sbr006-ac2-named-row.png`). 🔴 **AC3's other two actions cannot be driven and it is not this task's fault (§5.12, filed as D14)**: Publish and Duplicate both refuse — fast and *visibly*, which is SBR-015's fix working — because both cloud functions throw at their **first** node, `Outputs.ready is not a function`, with `claimSite` succeeding on the same backend as the control. Only nameable because DEF-004(a) writes steps; before it this was an opaque 400 with zero steps, which is what s9 and SBR-015 both recorded. 🔴 It **refutes SBR-015 s10's** *"undeclared signal ports — the artefact declares all six"*: the shipped artefact has **18** Function nodes calling a signal output and **0** declaring it in `scriptOutputs`. ⚠️ **Two variables between a 09:26Z success and this failure, neither eliminated** — the cloud runtime (`d229bf4b`) and the project (the NDA-017 migration rewrote both copies after that success, so the byte-identical diff I took **proved nothing**: it measured that they were mutated *alike*). **s9 (2026-08-28):** Two new components (`/Admin/Shell`, `/Admin/NewPageDialog`), three rebuilt. **AC5 is a control pair**: same shell placed twice, `Pages` reads `--primary`/600 on `/admin/pages` and `--foreground`/400 on `/admin/theme` while `Theme & settings` does the opposite — nothing poked. **AC1** the rail items STACK (y=65/96/127) and heading+`New page` share one row. 🔴 **The finding: the admin set had never been walked by the layout gate** — `findGrowingNodes` over the shipped artefact reported **11 growing nodes** in admin against 2 on the public site; `/Admin/PageRow` alone had four, so rows divided the page instead of stacking. 🔴 **And the gate nearly shipped with a hole**: a walk that stops at a component instance never reaches the bodies behind `Component Children` — it graded **41 nodes not 61** and `/Admin/PageRow` VANISHED, which read as an improvement. The report got QUIETER. 🔴 **AC2 half-blocked by SBR-008**: the dialog changes where title/slug come from and does not change the outcome — one `Page` table now holds a dialog-written row (`title None, slug None`) beside a cloud-written one (`Copy of Untitled`, `page-copy-np3ui4`), the cleanest SBR-008 evidence yet. 🔴 **AC3 blocked by a defect with no owner**: `publishPage` and `duplicatePage` BOTH time out at 30s with no response while `claimSite` succeeds in 29ms on the same backend — and they disagree, duplicate did its work, publish did nothing. ❌ **AC4 defect found**: View site landed on the literal `/%7Bslug%7D`; `pm-slug: ''` authored and gated but **NOT driven**. 🔴 §5.8: a refused query and an empty collection are the SAME SCREEN — no rows, no sentence, no explanation. 🟡 **s22 (§5.13): AC3 unblocked** — on a project minted after s20's D14 fix, **Publish** (`success` 25 ms) and **Duplicate** (`success` 23 ms) both work from the menu, five `execution_steps` all `success`, and the node that threw `Outputs.ready is not a function` returns `done` in 2 ms. ⚠️ **Not ✅**: AC3 names three actions and `Unpublish` was not clicked |
| SBR-007 | 🟢 **s32: AC2 IS MET ON THE SHIPPED ARTEFACT — D30 and D31 both FIXED, DRIVEN and flipped into a regression net.** s31 drove the real `/Pages/PageEditor` and found two defects that made the shipped screen undraggable: no `visualSort` on the editor's section query (**D30**), and a `merge` node re-running on the value it writes (**D31** — 115,755 write errors in eleven seconds on a screen nobody was touching). s32 fixed both in `sb005Components.ts`, and **the arms inverted**: the gesture now runs on the SHIPPED project and the mutants RESTORE the defects. 🔴 **`SECTION_SORT` had to MOVE rather than be imported** — `sb006` already imports `ROUTER` from `sb005` and uses it at module-eval time, so importing back would have made a TDZ cycle; it now lives in `sb005` and `sb006` re-exports it, one copy either way. ✅ **`unpack` was the open question and the answer is NO** — no `run` connected, so the value change is its only trigger and silencing it would blank the textarea. 🔴 **`setParams` grew a mirror precondition**: an arm restoring a defect asserts the keys were present AND `false` first, or a template that quietly lost them would leave the mutant 'restoring' what was never absent. ⚠️ **Two of the four section queries stay unsorted and that is correct** — they are cloud functions, and `reorderSection` sorts in its own script because it cannot trust query row order. **AC3 is unchanged and still blocked by D15 alone** · s30: AC2 MET ON BOTH HALVES — the gesture is built (§33), driven with a synthesised pointer, and the `For Each`-renders-into-its-parent trap that would have made every drop two too high is gated and sabotage-checked. New: D28, `NONE`. ⬜ The real page editor has still not been dragged end to end.** · s26: D20 CLOSED — decided by measurement, fixed, driven, and the gate that graded it corrected.** The handoff's suspicion that D20 might be a product row was right about ONE of its two options and wrong about the other: **wrap is template work and was reachable all along** (a percentage width flips `layout.ts:82`'s `flexShrink: 1` AND `Text.tsx:60`'s `whiteSpace: pre-wrap` at once), while **ellipsize is product work with no port at all** — `textOverflow` measures **0** against controls of 2 and 11, filed as **D22**, `NONE`. Two arms differing by exactly two parameters on one node, on a COPY of the fixture's backend data: the control reproduced §22's `965 px at every viewport` and `272..1237` exactly and read the mechanism off the screen (`whiteSpace: pre`, `flexShrink: 0`); the fixed arm tracks the window **1296 → 193 px**, clips nothing at any width, and keeps `Save page` at `SELF` throughout, so **D18 did not regress**. 🔴 **The short-title control found the thing nobody expected: the control clips a 21-CHARACTER title too** (272..681 at a 600px viewport), so there is no width at which the fix is worse. 🔴 **`layout.ts` assigns `flexGrow` and `flexShrink` in the SAME branch** — shrinking cannot be had without growing, so the actions now sit right of the header; that half is an appearance judgement and is **Richard's**, revertible in two parameters. 🔴 **The D18 gate stayed GREEN while its own sentence went false** — it classified shrinkability from `sizeMode` alone and called a `contentHeight` node that measures `flexShrink: 1` non-shrinking; the rule now models `layout.ts`. ⚠️ **And its mutant had stopped testing anything**: dropping `flexWrap` alone no longer reddens the grader, because a shrinkable heading reflows without wrapping — it now drops both levers, with a second mutant proving they are independent. ⚠️ **Both mutants first mutated the WRONG NODE** — `find(id === 'heading')` matched another component because **the door rewrites ids** (`heading` ships as `heading-2`); they resolve through the row's own `children` now. ⚠️ **A bare `'60%'` string was accepted in SILENCE and rendered at content width** — dimension ports take `{value, unit}` (D8/F15's family), and the first fixed arm looked like a refuted fix because of it** · s25: **AC1 is MET AND DRIVEN IN BOTH HALVES — the deployed half landed on a real `deployToFolder` folder (retitle → save → a browser that never signed in reads the new 36 px heading), and serving that folder found D21: cross-origin, the panel answered a CORRECT password with *'That email and password did not match.'* The backend never got the request — `X-Parse-Installation-Id`, which the runtime's AUTH seam alone sends, was absent from `nodegx-backend`'s CORS allow-list, so a deployed app had working DATA and no AUTH. Fixed, specced with a refused-header control, mutant-checked, re-driven. 🔴 The headless export's health filter is INERT unless the project is `registerModule`d — `evaluateHealth()` bails on that guard silently for every component, so a sabotaged wire DEPLOYED; with it registered the sabotage is dropped and all 241 real wires survive** · s24: D18 DRIVEN — and its severity was raised, not confirmed: `Save page` was unreachable at 1440 px once the page title was 56 characters, so the recorded `897` was a fact about the fixture's short title. Drove it WITHOUT the editor (`render-from-disk` + `withRenderedPage`, same viewer bundle) after the control arm reproduced all seven of §14's readings. New: D20, the title the fix cannot reach, `NONE`** · s23: **D18 FIXED in the template (built, then UNDRIVEN) + D19 — the editor suite was red at HEAD** · s22: DRIVEN — AC1 (preview) ✅, AC4 ✅, AC5 ✅; AC1's deployed half ⬜ unblocked, AC2 ⬜, AC3 split three ways | [The page editor](SBR-007-THE-PAGE-EDITOR.md) §5–§11. 🔴 **The screen did not wear the admin shell** — `/Pages/PageEditor` was the ONE admin page that never placed `/Admin/Shell`, so the rail, the theme link and `Sign out` vanished on the screen a client lives in (**D17**), and `sb005AdminPanel`'s AC5 case **pinned that placement list and stayed green** — the gate asserted the defect. Now placed `active:'pages'`, with a header row (`Editing · <title>`, publish pill, unsaved marker, Preview, Save), a card with Title+Slug two-up and Nav order+Show-in-nav together, a sections panel, and section rows rebuilt as cards. 🔴 **AC5 is a COMPARISON, not a `States` node**: `startValue.set → setText → onTextChanged` fires the `textChanged` SIGNAL (`text-input.ts:272`), so the record merely LOADING marks the form dirty, and the repair would be sequencing on drain order — this task's own third trap. Comparing loaded vs current is order-independent and is *more correct* (type a char, type it back, still clean). `save.done → record.fetch` clears it and makes AC4 true by construction. 🔴 **§2's *"five stacked unlabelled inputs"* was STALE** — they were labelled all along, just ungrouped. 🔴 **AC3 is three things with three verdicts**: the thumbnail half **already shipped** (picker→Upload→Image preview has been there all along, so s20's *"untouched"* was wrong), the **drop gesture is NOT BUILDABLE** — the runtime has **0** drop-target API against a **39**-hit `onClick` control (**D15**, `NONE`) — and multi-image galleries are **SBR-005's**. **AC2** needs sibling renumbering and there is no loop node, so it wants a cloud function and a decision. ⚠️ **Appearance: 0 bare pages, allowance tightened to `[]`** — but **D16**: §4 walks the reachability closure, so it would have passed on the shell placement alone; the real evidence is the page's OWN tree, **0 → 9** structure params. 🟢 **s22 DROVE IT** on `SBR-007 Page Editor Drive` (`backend_mterfnli74qwv`, 8601, `owner@sbr007.test`/`drive-pass-007`): **AC1** is a control pair on one page with one variable — the public `<h1>` at y=153/36px/700 reads `Original Title` before the save and `Retitled By The Drive` after it, and the strongest arm is **signed out**, where a visitor with no session gets the new title. ⚠️ SBR-016 §8.4's trap was live: `body.innerText.includes()` would have passed *before anything was driven*, because the site's own nav lists the page by title — the oracle is the heading element. **AC4** is no longer 'by construction': the save is `PUT /classes/Page/<id>` **then** `GET` the same id, and the header — fed from the record — kept saying `Editing · Original Title` while the input already read the new one, flipping only after the GET. **AC5** in three states: absent on load, present on one keystroke, **absent again when that keystroke is typed back out** — the reading a `States` counter cannot produce. **D17 driven**: `Pages` lit at `rgb(30,77,140)`/600 against siblings at `rgb(27,26,23)`/400. **Preview** lands on the real slug. 🔴 **D18, new, owner SBR-007**: the header row is pinned at **1001 px at every viewport** while `#root` tracks it exactly — `Save page` is clipped at 988 and **unreachable below 897**, with `scrollWidth === innerWidth` so no scroll reaches it; `/admin/pages` rows (1336→884→496) and `/admin/theme` are the controls that put it on this row alone. 🔴 **The session's own error, kept**: four negative readings were taken with `querySelectorAll('div,span')` after a control that used `('div,span,h1,…')` — the page title is an `<h1>`, so *the instrument* was the variable, and 'the heading vanishes after Preview' was almost filed as a defect |
| SBR-008 | 🟢 **s45: AC1 RE-DRIVEN ON A FRESH SITE — the fix could not reach the case it was built for, and now does** | 🔴 **s45 (2026-09-02): s44's hand-off named this row as the blocker and quoted §6.5's *"nothing yet fixes it"* — that is s17's text, superseded by §8 three sections later, and this board has read ALL FIVE ✅ since 08-29.** The symptom was real; the named cause was not. 🔴 **"The export drops the wire as unhealthy" was EXCLUDED at its source before anything was changed**: the real runtime modules, run over the failing project on disk, announce `prop-title` and `prop-slug` in BOTH schema states — with `prop-neverWiredNoColumn` and `prop-seoDescription` **absent** and a wires-stripped mutant leaving only the three parameter ports, so the yeses discriminate. The template, the dialog's `results: "title,slug"`, the wires and the bundle's currency were each excluded too. 🔴 **The editor and the runtime disagreed, and the editor is what the exporter asks.** With `flushEvaluateHealth()` forced: `closeResult-title → prop-title` **healthy: false, "Target port doesn't exist"**, and the create node's editor-side ports are **exactly its three saved parameters** — the two missing are exactly the two that exist only as wire endpoints. Census **43 `prop-` wires, 19 unhealthy** — the 19 this task's header has always named. ⚠️ **The 19 explain BOTH of s44's symptoms, including the one this task's story never covered**: `/Pages/PageEditor` loses `onTextChanged → prop-title` AND `prop-title → startValue`, so the form cannot fill from the record and the save writes **nothing at all** (`updatedAt` unmoved) — which "a field is silently lost" does not describe. 🔴 **The loop**: `recordWiredFieldPorts` reads its wires off the component the RUNTIME holds, and that component came through `exportComponent`, which already dropped them. `editor health → exported wires → runtime ports → editor health`, closed, permanent. `NodeGraphModel`'s own docblock calls this verdict *"correct and temporary"* — temporary in every case but the one where the pushing-back can never happen. 🔴 **Why §8 read green, re-read off its OWN numbers**: §8.1 records the schema as `Page:[navOrder,published,showInNav,slug,title]` — the SCHEMA half had minted the two ports, so the wires were healthy, the component exported intact, and the runtime saw every wire including the `seoDescription` one. **§8 graded the fix on a fixture that had already healed itself (§6.3), so the one case the fix exists for was never exercised** — this phase's own budget-on-a-fixture lesson, biting §8. 🟢 **FIX: one break in the loop, at the VERDICT** — the other two places were already ruled out by this task (§4: not the exporter's filter; §2: not a second port writer in the editor). The node family declares `wireDeclaredPortPrefix: 'prop-'`, carried through `defineNode` → `nodelibraryexport` → the editor, and `isWireDeclaredPort` stops `con-no-target-port`/`con-no-source-port` being raised for such a port. **The runtime stays the only thing that mints a port.** ⚠️ Stated cost, the ruling's own: a mistyped `prop-titel` no longer reddens. 🟢 **DRIVEN on the wizard-fresh fixture**, with sign-in through the same `cdp type` as a **known-firing control** for the input path (without it, "the value never arrived" and "the harness never typed" are one reading — and s44's two methods shared one failure mode): ports **3 → 5**, unhealthy **19 → 0**, the page saves `title`/`slug`, `Page` **7 → 9 columns created by that write**, the page editor's save moves `updatedAt` and `seoDescription` (**no column**) is **saved, its column created by the save** (9 → 10). ✅ **s44's two rows sit in the same table still `null`** — a before/after control that needed no constructing; ✅ `SiteSettings`/`Theme`/`Section`/`_User` did **not** move, so `Page` growing is the write. ✅ **Graded at the runtime → editor hop**, which swallowed this field **twice** while it was being built (two separate whitelists, silently): `nodelibraryexport.wire-declared-ports.test.ts`, 3 specs, **3 mutants all killed** and each naming the right half. 🔴 **Two controls read WRONG before they read right**: fabricated wires answer **healthy** (`getConnectionHealth` reads a WarningsModel keyed by REAL connections — a control reading zero for its own reasons, and it would have read as "the fix suppresses everything"); and the **live mutant killed nothing, which is not a failure** — by then the runtime had minted the ports, so the wires are healthy on their own merits. **The flag is load-bearing only during bootstrap, and a healed fixture cannot grade it.** ⚠️ Still the **preview** caller, not a deploy-to-folder; §5.3 carries it to the deploy and that remains an inference. `noodl-runtime` **149 suites / 2632 tests exit 0**, `tsc` clean on runtime + editor (gated on exit status), and `tests-unit/sb-018`'s **3 reds are pre-existing — verified identical with these six files reverted to HEAD**. | ruling taken: §11.4 option 1 (derive in runtime). 🔴 **s16 re-measured s15's "the symptom did not reproduce" and it closes nothing** — the two fixtures are the SAME PROJECT on every static axis (wires, dialog graph, security.json, metadata keys, provisioned `Page` columns) and no commit touched the `prop-` path between the mints, so the difference was session state, not the project. 🔴 **Two premises in §2 are wrong**: it is **one filter with three callers** — the viewer's bundles (`editorapi.js:88`), incremental preview (`ViewerConnection.ts:993`) and the deploy (`deployer.ts:108`) — so **preview is behind it too** and "works in preview, breaks on deploy" is not the shape; and `getConnectionHealth` **reads no ports**, it reads a `WarningsModel` populated on a ~2 s debounce and returns `healthy` when nothing has been evaluated yet, with **no caller forcing a settle before an export**. So a named row and a nameless one are both what the mechanism produces — s9/s12/s14 and s15 do not disagree. **AC5's control pair is now wrong as written** (varying only the deploy varies nothing on that path). New row **D13**; the fix in §2 is untouched and still right. 🟢 **s17 DROVE IT (§6).** The flip was **watched happening**: same project, no edit, **2.3 s apart**, `exportComponent(/Pages/Admin)` **13 → 11** connections and the census **32 healthy → 13**, with `targetPortExists` **false in both** — so **D13 is a confirmed cause**, not a candidate. Through the product: one `sendRefresh()` took the **running** preview **221 → 202** connections. 🔴 **A third state nobody had**: `SchemaHandler` fetches the backend schema on `window-focused`, writes `dbCollections`, and `recordFieldPorts` mints a port per column — so the defect **heals itself** once a class has been written to (census **19 unhealthy → 4**, unattended). 🔴 **Therefore the drive this row asked for was confounded** — s15's own write had grown the fixture's `Page` class the two columns in question; both arms came back named and neither is evidence. ✅ **AC1 now has a standing repro with a control on the same screen**: `Title` (column exists) saves, `Search description` (no column) is **silently discarded**, one form, one save, one build. ⚠️ **AC2 is unsafe as written** — the census read 32/0, then 13/19, then 28/4 in one session with nothing edited. 🟢 **s18 BUILT THE FIX (§7).** `recordWiredFieldPorts` in `record-ports.ts` mints `prop-<field>` from the node's own `prop-*` parameters and the `prop-*` ends of wires touching it, wired into both callers and re-pushed on wire changes. **AC2 ✅ 19 → 0** in a harness that states its schema (no backend, no columns) — which is where §6.5 says it is safe to pin; **AC4 ✅** the runtime copy and `cloudDynamicPorts.ts`'s are now graded against each other over the shipped template, with mutants in both directions. **AC3 ✅ un-widened** and the AC's constant name was wrong (see the trap list). 🔴 **§2 named a dead field**: `NodeModel.inputs`/`.outputs` are initialised `[]` and **nothing ever writes them** — the claim came from the field's own docblock, not from a read; the live accessor is `node.component.getConnectionsTo/From`, which numbered inputs have used all along. 🔴 **The two halves spell a wire differently** (`fromId` vs `sourceId`) — a runtime module given the editor's spelling derives **nothing, silently**; a mutant for it now reddens 5 cases. 🟢 **s18 DROVE AC1 (§8).** On `SBR-016 Arrive Drive`, viewer bundle confirmed to carry the fix *before* driving: a four-cell control on ONE node — `prop-seoDescription` (wired, **no column**) ✅ exists, `prop-title` (wired, column) ✅, `prop-published` (column, unwired) ✅, `prop-neverWiredNoColumn` 🔴 **false**, which is what makes the other three mean anything. With `evaluateHealth()` **forced** (D13 held constant, which is what AC5 needed): **0 unhealthy `prop-` wires** and the export keeps **26/26, 13/13, 19/19** — `/Pages/Admin` was **13 → 11** in §6.1 and is now **13 → 13**. ✅ **The person sentence**: one form, one Save, `Title` **and** `Search description` both saved — `seoDescription = SEO-CANARY-18-FIXED`, and `PRAGMA table_info(Page)` plus `_Schema.Page` show the **column created by that save at 13:20:56**, while `Section` in the same DB is unchanged at 11:07:03 (the second control). ⚠️ **Scope**: this is the **preview** caller of the one shared filter, not a deploy-to-folder; AC1's literal wording says deploy, and that half is inferred from §5.3. **ALL FIVE ACs now ✅** |
| SBR-009 | 🟢 **s37: BUILT — AC2 DRIVEN, AC4 met; AC1 half, AC3 blocked** | The theme editor is 54 nodes (was 22): three cards, a presets row generated from `SITE_THEME_PRESETS`, a live preview scoped by `cssClassName` + `CSS Definition`. 🔴 **The drive found a defect the graph could not**: three chips publish `name` at MOUNT, so the picker ran three times before anybody clicked and the screen booted wearing **Night** — `runOnChange-in-name: false` is the fix, and it is s36's shape a fourth time. 🔴 **SBR-012's gate looked like a blocker and was not** — its own §2 already named `preset-data` as the one allowed home for literals; the exemption is one row and `presetHexesInArtefact()` asserts the 24 hexes ARE `SITE_THEME_PRESETS`. Fixed on the way: Save was blanking 8 record fields; SBR-016's defect one wire from returning (`storageFetch` ⇒ authored `runOnChange-collectionName: true`); `/Pages/ThemeEditor` was the last bare page in `templateAppearance` and its floor is now `[]` (the positive CONTROL had to be re-pointed — it named the page that was fixed). **AC1 live half + AC3 need a backend, and go with SBR-014's pass.** |
| SBR-010 | 🟢 **s38: BUILT — ALL FOUR ACs DRIVEN** | `/Pages/Messages` + `/Admin/MessageRow`, and the one wire the rail item never had. The whole loop driven on a real enforcing backend: three anonymous visitors filled the template's own public form, the owner signed in, clicked **Messages** in the rail and read all three — sender, address, body, `Sent from the hello page`, three timestamps. 🔴 **The drive found two defects the graph could not**: [D42](DEFECTS-THE-SITE-BUILDER-FOUND.md#d42) — the template's ONE public endpoint stored **every enquiry twice** and had since SB-004 (three clicks, three runs, six rows; `fallback → pick → save` ran twice per run), invisible because nothing had ever read a `ContactMessage` back; and [D43](DEFECTS-THE-SITE-BUILDER-FOUND.md#d43) — a **refused** query rendered *"No messages yet"* beside its own refusal. Both fixed for this screen; D43's twin on `/Pages/Admin` is registered and deliberately untouched |
| SBR-011 | ⬜ open | ruled BUILD, not strike |
| SBR-012 | ⬜ open | |
| SBR-013 | ✅ closed s41 | **All three ACs.** Six doctrine strings reach a model; **exactly one** (`DESIGN_PLANNING`, in-editor) already stated the order — the five an EXTERNAL agent reads did not. AC1: the change is a MOVE not an addition, **8,274/6 free → 8,273/7 free**, briefing six characters shorter. AC2: two-arm cold drive; 🔴 **AC2 as written was green in BOTH arms** — the discriminator is `metadata.designTokens` **absent (control) vs 34 tokens (shipped)**. AC3: `TASK-TEMPLATE.md` requires a person sentence; SBR-003 and SBR-012 were the two files missing one. 22 specs, both mutant-graded against HEAD. Filed [D48](DEFECTS-THE-SITE-BUILDER-FOUND.md#d48) — 7 tokens of surface headroom left |
| SBR-015 | 🟢 **s34: CLOSED — ALL FOUR ACs.** AC4 driven, two arms, one variable: a failing publish records `withFlag:JavaScriptFunction:error — Outputs.built is not a function` **by name and with its reason**, `tasks`/`page-8`/`res` **absent**, while the control records all seven; `sbr015-execution-steps-drive.test.ts`, 10 specs, ~3 s. 🔴 **The AC moved because the MECHANISM did, not because anything here changed** — phase 80's DEF-004 put the recorder on `beginOutcome`, so the *"zero `Log` nodes"* explanation is now history, and four handoffs re-asserted 🟡 on it. Three natural failures were tried first and **all three succeeded** (a `pageId` naming nothing → **200 `published:true`**, nothing written = **D34**; an ACL-locked Section → published, a cloud function is not ACL-bound; a non-admin → **403 at the gate**, graph never ran, **no record at all**), which is why the failure arm is a mutant of the deployed bundle. Settled a phase-80 unowned row on the way past (**§4d**): a refused publish leaves the page `published:false` with **no `*` ACL rule** — the *"refusal after making it public"* reading is **disproved at HEAD**, bounded to the one write edge. s13: **AC1 ✅ DRIVEN, AC3 ✅, AC2 ✅ gate green** | **s13 (2026-08-29) paid the drive `379f4dec` owed.** A project minted *after* the fix (a project is a COPY of the template at mint time — re-driving the old fixture would have re-measured the old defect), fresh wizard backend 8598, `Section` table absent entirely. **Both arms, same button, same page, one variable** (`Section.pageId` present or absent, created against a *different* page so the page under test had zero sections either way): refusal renders `This page could not be published.` at **29 ms** with the menu closed, `rgb(220,38,38)`=`--destructive`, 210×33 px; success arm **31 ms** (menu closed *and refusal cleared* — `done → to-Quiet` observed, not just asserted) and **48 ms** (`Published`). Backend `error 11ms · success 12ms · error 11ms`. 🔴 **A measurement error worth keeping: the first refusal reading was 5,827 ms and was the CLI, not the app** — the clock started in one `npm run cdp` process and the click arrived from another; anchoring `t0` in a capture-phase listener inside the page gave 29 ms. **AC4 🟡 re-confirmed**: `execution_steps` 0 rows across all four executions, exactly as AC4 predicted. Independently reproduced on the fresh backend: **DEF-014** (500 `no such column: "pageId"`), **DEF-015** (three workers warned undeployed while the card read "pushed just now"), **SBR-008** (`Page` row has no `title`/`slug`). ⚠️ Fixture `SBR-015 AC1 Drive` left in the refusal arm — `Section.pageId` renamed to `pageId_hidden`. **s12:** **drive done 2026-08-29.** The 30s hang is gone: zero-section publish answers **`HTTP 400 This page could not be published.` in 12–19 ms**, which is `deny`'s own message — SBR-015's wiring is what made it speak. 🔴 **The node is `sections-3`, measured not inferred**: `GET /classes/Section?where={"pageId":…}` → **500 `no such column: "pageId"`**; the auto-created `Section` class holds only `objectId/createdAt/updatedAt/ACL`. **Control pair, one variable** — add the column (via a Section row on a *different* page, so the page under test still has zero) and the identical publish returns **200 in 24 ms**. So RunTasks on an empty list fires `done` not `unchanged`, the guards pass, and **a zero-section page is legitimately publishable**. 🔴 **AC1 still fails**: `/Admin/PageRow`'s three `CloudFunction2` nodes wire `done` and **no `failure`**, so the admin sees **nothing for 47 s observed** — while the success arm through the same button closes the menu at **211 ms**. The fix landed on the cloud half only. Two rows carried out: SBR-016 and phase 80 **s10 (build):** **found by SBR-006 s9, built s10.** Neither `publishPage` nor `duplicatePage` wires a single `failure` edge — every node's only exit is the happy path, so any error is a 30s 504 with no status and no node named. `claimSite` (same file, same author, 5 failure wires → 7 send edges) answers in **29ms** and is the control. 🔴 **The two do NOT disagree**: both stall at the same kind of point and differ only in where their write sits relative to it — duplicate creates its copy *before* the barrier, publish writes *after* it. Three tempting causes were each REFUTED (undeclared signal ports — the artefact declares all six; RunTasks on an empty list — NDA-012 §B3 ends it `done`; an empty query not publishing `items` — `setCollection` flags it unconditionally). Which node broke is deliberately still OPEN: wiring the failures is what makes the backend able to say. 🔴 `execution_steps` is EMPTY for all three executions — the table exists and nothing writes to it |
| SBR-014 | 🟡 **s46: RUN 2 — reached step 6 of 8** | s44 reached step 3 and named SBR-008 AC1; s45 fixed that. Step 3 was **still** blocked by a second closed loop one layer up — `SectionRow`'s script returned before `Outputs.built()` whenever the section had no `data`, which is every section the panel creates. Five sections, five `Save` presses, **0 requests**; the same button fired a `PUT` the moment a `data` object existed. Fixed in the generator as **[D52](DEFECTS-THE-SITE-BUILDER-FOUND.md#d52)**, template gate 62/62. Then **steps 3, 4, 5 and 6 driven**: five kinds authored and read back from the stored rows, drag-reorder persisted, published, public site rendered anonymously, Night themed (preview repaints before save, public site after), contact form submitted by a stranger and read by the owner in Messages. 🔴 **Steps 7 (deploy) and 8 (negative arcs) ⬜ unreached.** AC1 not met, **AC2 met**, **AC3 partly met** — first pictures for steps 4 and 5. Also settled **D40**'s harness-vs-product arm (it is the product) and ran **D38**'s named test (confirmed, **1.42:1**). New: **D53**. |
| SBR-016 | 🟢 **s15: FIXED + DRIVEN — all four ACs met** (this row read `⬜ open` until s32; the task file has carried the 🟢 banner since s15 and the status column was never updated) | **found by SBR-015's drive s12.** [The list that never asks](SBR-016-THE-LIST-THAT-NEVER-ASKS.md) — arriving at `/admin/pages` renders no rows and no count sentence while `GET /classes/Page` on the same session returns two. 🔴 **Not a refused query: 0 requests to `:8597` after load**, control 5 to `:8574`. `pages-2` fetches only on `create.done` or a row's `Changed`, so any drive that creates a page first cannot see it. Adds a **third** state to SBR-006 §5.8's pair |
| SBR-017 | 🟢 **s14: BUILT + DRIVEN — AC2/AC3/AC4 ✅, AC1 🟡 half (SBR-016 owns the other half)** | **found by SBR-015's drive s12.** [There is no way back in](SBR-017-THERE-IS-NO-WAY-BACK-IN.md) — the template's only auth node in 21 components is `SignUp` on `/Pages/Setup`; there is no `LogIn` anywhere. An owner whose session ends cannot re-enter their own admin. Measured: a second signup on a claimed site is **201 with a session token**, and `claimSite` then correctly **400**s — a right refusal and a locked door. **s14 (2026-08-29) built it and drove it.** `/Pages/SignIn` at `admin/signin` (email, password, `net.noodl.user.LogIn`, a constant refusal on a resetting `States`, `RouterNavigate` on `done` — `failure` never `completed`, which would raise the refusal on the successful sign-in too); `/Admin/Shell` gains `Sign out` and, for the signed-out visitor, **the words** through a `User` node's `authenticated` and an `Inverter`; `/Pages/Setup` gains one link forward. 🔴 **The scope call: Setup CANNOT refuse before signing anyone up** — refusing early means asking "is this site claimed yet?", the oracle SB-004 F7 removed on purpose; the link is the half that helps the person. **The gate is not "contains a LogIn"**: it walks the Router's `routes`, closes over what those pages PLACE, and the mutant that drops the one route reds it; a `LogOut` may only ship where a reachable `LogIn` does. **Driven on a project minted from the regenerated artefact** (`SBR-017 Sign In Drive`, backend `backend_mte82r1qhnr87` port 8599, `drive-token-017`, `owner@sbr017.test`/`drive-pass-017`): claim → create a page → **sign out 53 ms** → signed-out `/admin/pages` says *"You are not signed in. Sign in to manage this site."* → **wrong password 114 ms refusal, path unchanged** → **right password 82 ms into `/admin/pages`**. Control pair: `Sign out` present ⇔ signed in, the sentence present ⇔ signed out, each in exactly one arm. 🔴 **AC1's rows are missing and that is SBR-016**: the panel's own session reads the row `200 / 1 row / 2 ms` at the moment the panel shows nothing. Re-observed: **SBR-008** (no `title`, no `slug`), **DEF-015** (third sighting). 🔴 **Harness: the editor's preview webview is `96 × 0`**, so every CDP click is trusted, lands, and hit-tests to `<html>`; `Emulation.setDeviceMetricsOverride` on the same connection is the fix |

## Standing gates and traps (carried from phase 76 — still live)
- **s21 (2026-08-29)** — **SBR-007 BUILT, and the session's most useful hour was spent NOT building.**
  Three of this task's scope bullets were re-measured against the artefact before any edit, and two
  of them were wrong: the five inputs were already labelled, and AC3's thumbnail half was already
  shipped. The third — AC3's **drop** gesture — is **not buildable at all**: the runtime carries
  **zero** `onDrop`/`dataTransfer`/`dragover` API against a **39**-hit `onClick` control in the same
  two packages (**D15**, `NONE`, product).
  🔴 **The control earned its keep on the first try.** The initial run of that pair passed the two
  search paths as an unquoted shell variable; zsh does not word-split, and **both numbers came back
  0** — an absence indistinguishable from the finding. A zero beside a zero measures nothing.
  🔴 **A green gate asserted a defect for two sessions.** `sb005AdminPanel`'s AC5 case pinned the
  shell's placements at exactly `['Pages/Admin','Pages/ThemeEditor']` — and the missing third was
  the defect (**D17**). ⚠️ Its second assertion also had the **wrong shape**, not just a stale
  number: `Set(active).size === placements.length` reads "every placement is unique", which was
  accidentally equivalent at two placements and is wrong at three (the page editor sharing `pages`
  with the page list is correct). The surviving invariant is "more than one rendering exists".
  ⚠️ **An appearance floor went stale GENEROUS.** Three of the four names in `BARE_PAGES_TODAY`
  had been paid by other tasks and never removed, so §4 could not have caught any of the three
  regressing. Tightened to `[]`. But **D16**: `barePages()` walks the *reachability closure*, so a
  page that merely places `/Admin/Shell` passes with an entirely unstyled body — sabotage confirms
  it reads "styled" with **all nine** of its own structure params stripped. The stricter own-tree
  rule was measured and is **not green** (`/Pages/ThemeEditor` goes bare), and promoting it would
  re-grade two other templates — so it is a row, not a patch.
  ✅ **Four pinned censuses grown as ARITHMETIC, never replaced by new constants.** The one that
  matters: `record.prop-*` wires **19 → 27** and `unresolvedWires()` **still `[]`** — SBR-008's fix
  covers the eight this screen added, so it did not re-open that defect on a new screen.
  Gates: **`test:ci` 2894 specs, 4 failures, all four `AIX-006 style vocabulary` by name**, seed
  65644, fresh readout. ⚠️ The first run read **5** — `sb017-deploy-connection-parity`'s browser
  Function literal (20 → 23). That spec's own header says a stale count *"sat red for a whole
  session because s9 never ran `test:ci`"*; this time the session that moved it ran it.
  `noodl-mcp` **958/958**, `typecheck:mcp` clean, `tests-unit/sb-017`+`sb-018` **32/32**.
  ⚠️ A peer's `test:ci` was **already running** when this session went to run one — checked with
  `ps` first, waited, then ran alone. Two peer commits (`77a82ddc`, `2f65f4ee`) landed mid-session
  and swept nothing; `gitHead` in the readout is theirs, not this work's.


- **Floor: `test:ci` — 2863 specs, 4 failures**, all four `AIX-006 style vocabulary` **by
  name**. A build failure has no summary line: *not measured*, not red.
- 🔴 The template artefact and the component sets are **two populations** — edit a set ⇒
  regenerate (`npm run template:site-builder`) or `sb007Template.test.ts` reddens.
  `site-builder.security.json` is hand-edited, NOT generated. Node count moves
  `sb-007/site-template.test.ts` id count (194) and the backend helper's connection total (101).
- 🔴 The door remaps node ids (`save` ships as `save-3`) — assert template wires by node
  **label**, never id.
- 🔴 `setDynamicPorts` REPLACES a node's dynamic port list — two writers erase each other.
- 🔴 A parameter is not a connection — the export filters wires, copies parameters verbatim.
- 🔴 `sb017-deploy-connection-parity.test.ts` asserts its shortfall equals a named exemption
  list — an exemption, not a relaxation. ⚠️ **s18: the name in this line and in SBR-008 AC3 was
  wrong.** The constant is `REMOVED_SINCE_THE_BUNDLE`; `REMOVED_BY_SB018` occurs in the repo
  exactly once, in a comment in `noodl-mcp/tests/sb006Components.ts` describing the *pattern* —
  a mention that had been read as a name and carried into an AC. ✅ **s18 ran it**: the list is
  unchanged and un-widened (7 cases, green in `test:ci`); its rows are cloud-side wires the
  template deliberately removed, and SBR-008's fix is browser-side.
- 🔴 A poisoned jest transform cache = red specs with EMPTY failure messages; prefer artefact
  and test mutants over source mutants; `npx jest --clearCache`.
- Driving: modal renders twice (stamp the non-Measuring copy, click twice), `elementFromPoint`
  before every click, IIFE around every `cdp eval`, launcher watchdog can reap the stack —
  `npm run cdp -- health` before trusting it.
- Shared checkout: commit by pathspec (untracked ⇒ add+commit one chain), never stage-then-commit;
  announce editor launches AND teardowns; `test:ci` alone.

## Session log

- **s22 (2026-08-29)** — **The drive. SBR-007's AC1/AC4/AC5 and D14 all paid by one sitting at the
  app, and the session's most useful ten minutes were spent disbelieving my own instrument.**
  Fresh mint (`SBR-007 Page Editor Drive`, `backend_mterfnli74qwv`, 8601) because a project is a
  copy of the template *at mint time*; verified on disk that its `PageEditor` places `/Admin/Shell`
  before driving anything.
  🟢 **D14 is driven** — `publishPage` **success 25 ms**, `duplicatePage` **success 23 ms**, five
  `execution_steps` all `success`, and **step 0** — the very node that threw
  `Outputs.ready is not a function` — returns `done` in 2 ms. s20's fix was a red-then-green spec
  pair; it is now a thing that happens in the app.
  🟢 **AC1, AC4, AC5, D17 all met and observed** — see SBR-007 §12–§13. The strongest AC1 arm is the
  **signed-out** one, which is what the person sentence actually claims.
  🔴 **D18, new, owner SBR-007** — the header row this task built is pinned at 1001 px at every
  viewport; `Save page` is clipped at 988 and **unreachable below 897**, with no horizontal scroll.
  Three controls (`#root` tracking the viewport in the same call, `/admin/pages` rows reflowing,
  `/admin/theme` fine at every width) are what make that a defect rather than an unprocessed resize.
  🔴 **The lesson worth more than any of it: the instrument is a variable in the control pair.**
  Four consecutive "the page heading has disappeared" readings were taken with
  `querySelectorAll('div,span')` after a control that used `('div,span,h1,h2,h3,a')`. The heading is
  an `<h1>`. A defect note with a plausible mechanism (`RouterNavigate`'s `pm-slug` versus a slug in
  the URL path — SBR-004 §10.3's family) was already drafted. What killed it was a probe naming **no
  selectors at all**: `querySelectorAll('*')` filtered on computed `font-size`.
  ⚠️ **Also**: a peer's edits to `utils/exporter/cloudFunctions.ts` full-reloaded the editor and
  closed the project **three times** mid-drive (HMR "not accepted"). The fixture survives it — every
  reading lives in the backend — but the reopen is two calls and the stamps do not survive.
  ✅ The draft page in the public nav is **ACL, not a query filter**: the nav asks only
  `showInNav`, and only the signed-out arm shows the draft absent. Recorded in §12.5 because the
  guarantee is not where a reader would look for it.
  ⚠️ **No suites run — this session changed documentation only**, so the `test:ci` floor is exactly
  where s21 left it (2894 specs, 4 failures, all four `AIX-006 style vocabulary` by name). A peer
  held `test:ci` for most of the session and the stack was handed back to them at the end.

- **s20 (2026-08-29)** — **D14 CLOSED, and both of the things s19 recorded about it were wrong.**
  The deployed bundle carries `ports: []` on all 11 cloud Function nodes; the one where publish
  succeeded carries **50** across the same 11. With no `out-ready` port of type `signal`,
  `_isSignalType` is false, the callable stub is never written, and `Outputs.ready()` throws — four
  lines of source from the empty array to the recorded step.
  🔴 **Neither candidate s19 named was the cause.** The **project on disk had the ports all along**
  — the template persists all 13 statically on the nodes, and the failing project's own
  `nodes.json` holds `out-ready:output:signal`. And **`claimSite` was not a control**: it ran at
  12:27, against a bundle replaced at 15:48 by the one with no ports.
  ✅ Fix: `withScriptPorts` in `exporter/cloudFunctions.ts` derives a cloud Function's ports from
  its own `functionScript` at export, so a build is a function of the project. Gated by a suite
  that is **red without it** — and 🔴 **the first version of that suite was not**: it withheld the
  adapters, which turned out never to have been the variable, and passed with the fix sabotaged.
  Only the second one — no node library, so `exportDynamicPorts` is falsy on an `UnknownNodeType`
  — reproduces `ports: []`. **`test:ci` 2894 specs: 6 failures sabotaged, 4 restored, all four
  `AIX-006` by name.**
  ⚠️ **Unowned and untouched:** the same exposure on the **browser** deploy path
  (`build/deployer.ts` shares `exportPorts`), and what put the live editor in that state at 15:48.

- **s19 (2026-08-29)** — **SBR-006 AC2 CLOSED; AC3's remaining two actions are D14, not this task.**
  AC2 had been blocked since s9 on rows arriving `title: None, slug: None`. Driven on
  `SBR-017 Sign In Drive` — chosen, not convenient: its `Page` class held the three
  **parameter**-sourced columns and neither **wire**-sourced one, which is the only state in which
  SBR-008 §6.3's self-healing cannot explain a pass. `Page` **7 → 9 columns** on one Create, with
  `SiteSettings`/`Theme`/`_User` unmoved in the same DB at the same second, and the pre-click
  marker alive after it.
  🔴 **The instrument needed a negative control and the best one was already in the template**:
  `prop-seoDescription` is a real field of this `Page` model, wired on `/Pages/PageEditor`, and the
  create node still reports it **false**. A fabricated `prop-neverWiredNoColumn` says the same
  thing but a real name says it better — the port set is per-node and wire-derived.
  ⚠️ **336/336 kept project-wide is not evidence on its own** — it is exactly what an inert filter
  produces. Recorded as such.
  🔴 **Three of my own readings were wrong before they were right, and each cost less than the
  claim would have.** (i) `forEachNode` stops on a truthy return, so `out.push()` ended the walk —
  and a *thrown* callback came back as a clean `[]`, an absence with no control. (ii) I claimed
  `_updatePorts` had no script-text derivation from a **grep of line numbers**; it calls
  `_parseScriptForErrorsAndPorts`. (iii) I diffed two projects' `publishPage`, found them
  byte-identical bar node ids, and called the project constant — **both had been rewritten by the
  NDA-017 migration after the reading I was comparing to.** A diff between two equally mutated
  copies measures that they were mutated alike, which is the one thing it cannot fail to find.
  🔴 **D14**: `publishPage` and `duplicatePage` both throw `Outputs.ready is not a function` at
  their **first** node (`claimSite` succeeds on the same backend). Visible only because DEF-004(a)
  writes execution steps — s9 and SBR-015 both saw this as an opaque 400 with zero steps. It
  refutes SBR-015 s10's *"the artefact declares all six"*: **18 call a signal output, 0 declare it**.
  ⚠️ Two variables sit between a 09:26Z success and this failure and **neither is eliminated**;
  the separating experiment is written down in D14 rather than guessed at here.
  Gates: **`test:ci` 2889 specs, 4 failures, all four `AIX-006 style vocabulary` by name**, seed
  07472, fresh `test-results.json` — the floor exactly. Ran alone, after teardown. No source
  changed this session; docs and one screenshot only.

- **s10 (2026-08-28)** — **SBR-015 written, built and gated; the drive is owed.**
  The unowned 30s-timeout defect §5.7 handed on is **one cause, not two**: neither
  `publishPage` nor `duplicatePage` wired a single `failure` edge, so every node in both graphs
  had exactly one way out and any error became a silent 504 naming nothing. `claimSite` (same
  file, 5 failure edges, 29ms) is the control that made it diagnosable. The two "disagree" only
  because duplicate creates its copy **before** the point it stalls at and publish writes
  **after** one.
  🔴 **Four candidate causes each FITTED and each was refuted** — undeclared signal ports (the
  artefact declares all six), RunTasks on an empty list (NDA-012 §B3 ends it `done`), an empty
  query not publishing `items` (`setCollection` flags unconditionally), `.map` on a Collection
  (it extends Array). **Which node broke is still open on purpose**: wiring the failures is what
  lets the backend say, and a fifth guess would waste the measurement.
  🔴 **A second defect fell out of proving the first**: both Run Tasks were wired by
  `completed`, which *"fires after every invocation, whatever the outcome"* — publish marked a
  page published after a run that set **no** section's access rules, duplicate answered with a
  page id after a failed section copy. Both now `done`. Two more silent exits the new gate then
  found: `submitContactForm`'s `stored` (a throw hung the template's one **public** endpoint)
  and `claimSite`'s own `gate`, whose two hand-written signals only *look* exhaustive.
  🔴 **The gate's own first version had a hole shaped like the defect** — it asked "does this
  node reach a Response?", which every node on a happy path does, so it would have passed the
  unfixed `publishPage`. It grades the failure **edge** now; the mutant is what caught it.
  🔴 **A pin had been red since SBR-006 landed and nobody saw it** — browser Function nodes
  18 → 20 (`/Admin/Shell`, `/Pages/ThemeEditor`), red from `dc931e01` because s9 never ran
  `test:ci`. The first `test:ci` of this session showed **7**; three were real.
  Gates: **`test:ci` 2889 specs, 4 failures, all four `AIX-006` by name — the floor exactly** ·
  mcp sb00* **155/155** · editor sb-007/015/017/018 + sbr-001/002/003 + fb-005 **377/377** ·
  backend sb0* **141/141** · `typecheck:editor` 0 · `typecheck:mcp` 0. Template regenerated;
  connection total 101 → **118**, node ids 232 → **234**, both with named movers.

- **s9 (2026-08-28)** — **SBR-006 built and driven.** `/Admin/Shell` (sidebar, brand,
  Pages · Theme & settings · Messages, View site, screen body via `Component Children`) and
  `/Admin/NewPageDialog` (Show Popup / Close Popup); `/Admin/PageRow` becomes a table row with a
  derived status pill and the three write actions behind one overflow menu; `/Pages/ThemeEditor`
  places the same shell with `active: 'theme'`.
  ✅ **The popup mechanism was measured before anything was authored** (§4 says not to invent one):
  the viewer installs the popup layer unconditionally (`viewer.jsx:174`), and close results are
  flagged dirty BEFORE the close action fires (`showpopup.ts:204-210`) — the ordering that keeps
  this from being a second SB-017 §11.1.
  🔴 **The finding that outlives the task: the admin screens had never been walked by
  `sb006PublicSite.test.ts`'s growing-node rule.** Eleven growing nodes to the public site's two.
  🔴 **The new gate's own hole**: no `Component Children` hop ⇒ 41 graded instead of 61 and the
  worst offender disappeared from the report. The green arm now asserts node NAMES, because a count
  is the thing the hole moved the wrong way.
  🔴 **`sb005AdminPanel.test.ts` was grading a population the panel never ships into** — the admin
  set authored into an empty project; the first outward reference refused the component and took all
  twenty other assertions with it. It now writes the public site first, as the generator does.
  Two door refusals kept: a bare `width: 240` means **240%**, and `Text` has no padding or
  border-radius ports at all.
  Gates: template regenerated (21 components, 5 pages) · `typecheck:editor` 0 · `typecheck:mcp` 0 ·
  mcp sb00* **148/148** · editor sb-007/015/017/018 + sbr-001/002/003 + fb-005 **377/377** ·
  backend sb0* **141/141** · `test:main` **6253/6254** (the single red, `BLD-004`, is a
  timing-sensitive stall test unrelated to this work and green in isolation).
  ⚠️ **`test:ci` still NOT run** — owed since s8.

- **s8 (2026-08-28)** — **the root URL's cause is fixed and gated; the drive is owed.**
  `resolveSlug` now carries `runOnChange-in-slug`/`-in-homeSlug: true` in `sb006Components.ts`,
  regenerated into the artefact. The ordering consequence the handoff asked to check first was
  checked and is benign: `out-slug` is `pageQuery`'s only trigger, but a run before `homeSlug`
  publishes nothing, so the first run that reaches the body is the first fetch.
  🔴 **§9.2's clearance of the other 32 silenced nodes was an armchair claim and is now a
  census**: 27 nodes / 48 parameters, and the discriminating property is whether the silenced
  input's producer is ordered before the control signal. The template has exactly one control
  signal that fires on a clock its values do not share (`Page.didMount`) and exactly one
  producer with that ordering guarantee (`PageInputs`, `router.tsx:586`). Two mount-triggered
  nodes; one was the defect, one is measurably safe. New gate in `sb007Template.test.ts` —
  known-firing signal, a grader that asserts its **reason column**, and a mutant that calls the
  grader and reds on `in-homeSlug` **alone** while clearing `in-slug`.
  Gates: `template:site-builder` regenerated · `typecheck:editor` 0 · `typecheck:mcp` 0 ·
  mcp sb004/005/006/007 **122/122** · editor sb-007/015/017/018 + sbr-001/002/003 + fb-005
  **377/377**. `test:ci` NOT run — see below.
  🔴 **No editor seat all session**: Richard was hand-driving the only stack (pid 6774, TPL-001,
  owned by session 65956), and two editors cannot coexist. The AC-grade drive of `/` is s9's
  first job; the probe table is SBR-004 §10.4.

- **s4b (2026-08-28, hold cleared mid-session)** — **the owed sweep ran clean and both drives
  landed.** Gates: template regenerated · `typecheck:editor` 0 · `typecheck:mcp` 0 · **`test:ci`
  2863/4, all four `AIX-006 style vocabulary` by name** (floor exactly) · `test:main` 6253/6254
  — the single red was SBR-003's own third install write hitting sb-007's *exhaustive*
  written-files pin, updated deliberately · mcp sb004/005/006/007 91/91 · backend 35/35 + 20/20.
  🔴 **SBR-002 AC4's drive found a real defect the specs could not**: the no-backend deadline
  **never spoke**. A signal into a VALUE port writes true-then-false, and the input queue holds
  **one entry per input name**, so the two writes coalesce and the decider runs ONCE with
  `false` — its `Inputs.watchdog === true` guard was a watchdog that could never bark. Guard is
  now `!== undefined` (the deadline is the port's only writer, so "defined at all" IS "the
  deadline passed"); the spec's abstain row and its mutant were inverted to match, artefact
  regenerated, sb006 33/33. Re-driven on a wizard-fresh project: **no backend → the sentence,
  visible and hit-tested; unclaimed → "not set up"; claimed + bogus slug → "not found", with the
  answered home page as the negative control (panel `visibility: hidden`)**. SBR-003: floor
  reaches `:root` live (`--primary #1e4d8c`, `--site-measure 44rem`), the real deployed
  `claimSite` seeds exactly the twelve contract keys, a Night write overlays them (companions
  land as live `color-mix`, not frozen), and deleting the row falls every token back to Studio.
  Method notes: the editor preview is 988×313 until you pick a device size — probe reachability
  at a **real** viewport, and `elementFromPoint` returning `null` means below the fold, not
  hidden; the honest hidden signal here is `visibility`. `SITE_SETUP_TOKEN` was provisioned
  through the product's own Secrets panel (writing the backend's `secrets.json` by hand is
  blocked, and the panel is the flow a person uses anyway).

- **s5 (2026-08-28)** — **SBR-004 built and driven; one AC pair still owed.** The public
  site has a shape: nav bar with a rule, a reading measure on `--site-measure`, spacing from the
  scale, a footer, and the empty-screen panels as centred `--surface` cards. Every colour,
  radius, gap, face and size in the five SB-006 components is a `var(--token)`; four dimensions
  are named in `RAW_DIMENSION_EXEMPTIONS` with a reason each. 🔴 **The finding that mattered:
  `TokenResolver.generateCss` stamps `:root {…}` and `body { font-family }` and NOTHING else
  (`TokenResolver.ts:137`), so `--background`/`--foreground` were declared on every deploy and
  read by no element — a Theme record could pick Night and the page stayed black-on-white. The
  new `frame` node is what makes any of this visible.** AC2 is derived, not authored: a
  `For Each` sets only the model's own fields (`foreach.tsx:586-597`), so the current slug — one
  value, constant across links — travels as an app-wide variable (`Noodl.Variables` is a proxied
  `Model`, so a write notifies), read twice over so neither creation order is missed; the
  distinction is colour AND weight, with a mutant holding the second channel.
  🔴 **AC2's parenthetical asks for `aria-current` and the platform cannot author it** — no
  visual node declares an aria or attribute port, and the only ARIA in the viewer is a hard-coded
  `aria-hidden` on `IconGlyph`'s svg. A platform gap, bigger than this task, recorded not fixed.
  🔴 **The drive's own find: `visible: false` is `visibility: hidden` and HOLDS ITS SPACE** (the
  port says so). At 360px the hidden contact wrapper was **365px** of empty page, and a
  `richText` section reserved a 320px image band it never draws, once per row. Six surfaces moved
  to `mounted`; re-driven on a second fresh project, the element is gone from the DOM. A spec now
  refuses `visible` anywhere on the public site (parameters AND wires) and its first run caught
  one I had missed by hand. ✅ **SBR-003's carried probe answered**: `max-width:
  var(--site-measure)` computes `704px` and renders 704px, against an unknown-token control that
  computes `none` and renders 940px — same element, same viewport, one variable. ✅ **AC4's
  measured half**: `scrollLeft` reaches 0, beside a planted-2000px control that reaches 1640, so
  the absence has a known-firing signal. ✅ **Also fixed the 2-suite `test:main` failure s4 left
  owed — never a flake**: four `tests-unit/sb-01{7,8}` specs declare `const siteBuilder` with no
  top-level import/export, so TS treats them as global SCRIPTS and ts-jest typechecks all of
  `tests-unit` in one program; whichever pair shared a worker failed TS2451 and the SUITE failed
  to RUN (2 failed suites, **0 failed tests**, 6244 not 6254). `export {}` scopes them.
  🔴 **OWED, and it is AC1 and AC2 themselves: both drives were of an UNCLAIMED site.** The nav
  renders zero links there, so AC2 has never been observed in a browser, and AC1's person
  sentence has only been seen on a "not set up yet" page. Claiming needs `SITE_SETUP_TOKEN`
  through the Secrets panel. ⚠️ Unexplained and undiagnosed: on the unclaimed page the `nav`
  measured 151px and `header` 150px against ~33/~36px of content; `flex-grow: 0` on the children
  changed neither — measure on a CLAIMED page before calling it a defect. Counts moved with the
  graph: node ids 195 → 203, browser Function nodes 17 → 18, sb006 specs 34 → 49.
  Gates: `typecheck:editor` 0, `typecheck:mcp` 0, mcp sb006+sb007 71/71, `test:main` 375/6254,
  `test:ci` **2875 specs / 4 failures, all `AIX-006 style vocabulary` by name** (seed 79133, tree
  78a04e69 — a peer's TPL-001 added 12 specs mid-session; one F44 red on an earlier run did not
  reproduce). Drive artefacts: projects "SBR-004 Theme Drive" (old graph) and "SBR-004 Mounted
  Drive" (carries the fix) in NodeGX test projects, backends `backend_mtd5sw9h8dz5g` and one more.
- **s4 (2026-08-28)** — **SBR-003 built end-to-end under the CPU hold; NOTHING EXECUTED**
  (code + specs saved for the sweep, per Richard's freeze). The contract is single-sourced in
  `models/template/templates/siteTheme.ts`: `THEME_TOKEN_FIELDS` (12 fields — the final list,
  AC deliverable), `SITE_THEME_PRESETS` (Studio/Press/Night verbatim from the screens
  artifact), `buildSiteDesignTokens()` (Studio floor + 7 companions), `buildThemeDoc()`
  (generated `docs/THEME.md`). Channels: `ProjectTemplate.designTokens`/`docs` →
  `install()` writes `metadata.designTokens` + validated `docs/*.md`
  (`assertTemplateDocPath` throws on escapes); overlay = `applyTheme` extended to the 12
  keys + `color-mix` companion derivations; writers = `buildTokens` (12 keys, font field →
  `fontDisplay`), `seedTheme` (12 empty). Pins updated in `sb004Authoring` (seed bound to the
  contract), `sb004-publication-invariant` + `sb008` drive (12-key literals). New
  `tests-unit/sbr-003/token-contract.test.ts` (vocabulary/presets/floor/install/doc/stamp,
  every absence beside a firing positive, refusal table for the doc-path validator, and a
  post-regeneration artefact gate). 🔴 **The artefact was NOT regenerated** (ts-node boots
  the door's validation tree — held): `sb007Template.test.ts` byte gate + the sbr-003
  artefact spec are red until `npm run template:site-builder` runs, which is therefore STEP 1
  of the sweep. Learned en route: `TokenResolver.generateCss` resolves a pure `var(--x)`
  token value inline at stamp time (freezes the link — floor companions are static hexes,
  runtime derivations use `color-mix`, which passes through verbatim); POL-006's
  `body{font-family:var(--font-sans)}` floor makes the token the effective font channel on
  stamped surfaces.

- **s3 (2026-08-28)** — **SBR-002 built; editor half closed and driven; AC4 + gates deferred
  under Richard's CPU hold** (*"avoid CPU/RAM intensive testing until I explicitly say to
  start again"* — mid-session, stands until he clears it).
  **Editor half (AC1–3 all driven live):** `ProjectTemplate.initialOpenComponent` (hand-set
  like `securityPolicy`; site-builder declares `/Pages/Setup`) → `install()` writes it into
  project metadata (`INITIAL_OPEN_COMPONENT_METADATA_KEY`) → `getDefaultComponent` resolves it
  FIRST via `resolveFirstOpenComponent` (`models/template/firstOpenComponent.ts` — pure,
  import-free module, because `projectmodel.utils`'s import chain cannot load in plain-Node
  jest; the hook's unconditional switch now IS the hinted switch, no layering). Driven:
  wizard-created "SBR Setup Drive" opened on `Pages/Setup` (`aria-current`), metadata verified
  on disk through the v2 re-save, SBR-001 binding intact (`backend_mtcvrppkyv22t`:8590);
  reopen landed on the saved place (App) — `selectedComponentName` still wins; hint-less
  "SBR Hello Control" opened on App as always. Unit: `tests-unit/sbr-002/` 8/8.
  **Template half (built, spec-graded, artefact regenerated — NOT yet driven):** the fourth
  state. 🔴 Measured first: with no backend the preview's SPA fallback answers
  `undefined/classes/…` with **200 + HTML**, `ParseWireAdapter.query`'s success handler throws
  on `response.results` (undefined), so the query publishes **neither `fetched` nor `error`**
  — the white void is a silently dead chain, and no failure-output wiring can ever see it. So
  the signal is a deadline: `Timer` ("The answer deadline", `NO_BACKEND_DEADLINE_MS` = 4000)
  armed by `page.didMount`, into a new watchdog arm in `diagnoseNotFound` that speaks ONLY
  when nothing has answered (`watchdog === true && claimed === undefined && missing ===
  undefined`; the value-port true-then-false double-write is handled — false pass abstains,
  outputs stay latched; any later real answer overwrites). New visitor-facing string
  `NO_BACKEND_TEXT` (deliberately names Backend Services — author-only state, noted in file).
  `sb006PublicSite.test.ts`: +3 specs incl. the ignores-an-answer mutant, census +`timers: 1`;
  33/33. Regenerated (`npm run template:site-builder`): **id count 194 → 195**
  (`sb-007/site-template.test.ts` updated). ⚠️ **The sb017 helper total stays 101** — its
  population is the seven `/#__cloud__/` components ONLY (comment added there); the standing
  "node count moves the backend helper's total" note is true only for cloud-component edits.
  **Gates run before the hold:** `typecheck:editor` **0 errors** (the WFA-002 5-error baseline
  is GONE), `typecheck:mcp` clean, sb007Template byte-gate 22/22, sb-007/sb-015/sbr-001/
  sbr-002/sb017-lossless/sb015-project-policy all green.
  **Owed by this lane (deferred, do NOT run until Richard clears the hold):** (1) AC4 drive —
  three states, three answers, negative controls, on a fresh wizard project (old projects
  carry the pre-deadline graph); (2) `test:ci` floor for SBR-002 (P75's 11:47 run predates
  this work); (3) one `test:main` had 2 failed suites (truncated log, only
  "'siteBuilder' was also declared here." survived — suspects import
  `site-builder.content.json` via `require`; ran beside webpack builds, so possibly the
  two-suites flake) — identify and re-run clean. Drive artefacts: "SBR Setup Drive" (new
  backend `backend_mtcvrppkyv22t`:8590, binding restored after the strip test) and scratch
  "SBR No Backend" in NodeGX test projects. ⚠️ dev:debug launcher exited unexpectedly twice
  mid-session (stack reaped cleanly both times); cause not identified.
- **s2 (2026-08-28)** — **SBR-001 closed, driven.** The wizard now attaches the backend:
  `TemplateItem`/`TemplateChoice` widened with a **derived** `needsBackend`
  (`templateNeedsBackend` = shipped `securityPolicy` OR `/#__cloud__/` components; community
  rows stay `undefined` = no), and `ensureTemplateBackend` (`models/templatebackend.ts`,
  mirrors `ensureLessonBackend`) runs in `handleCreateProjectConfirm` before the route:
  create owned (`backend:create` **with `{projectId}`**) + bind via `setCloudServices`.
  🔴 **Deliberately NO start and NO deploy from the launcher** — `CloudFunctionDeployer`
  exports `ProjectModel.instance` (wrong project on the launcher), and a backend started
  pre-route gets **adopted** by `ProjectBackendLifecycle`, whose adopted path never deploys
  functions. Create+bind hands start (with `--project-dir` ⇒ policy) and function deploy to
  the lifecycle at open, which its own SB-015 comment says it exists for. Verified by driving
  the real wizard: "SBR Drive Site" landed bound to a fresh owned backend, running,
  `security.json` byte-identical to the template's (`devOpen: false`), ACL probes discriminate
  (Page find 200 / ContactMessage find 403 / Page create 403), functions answer
  (`submitContactForm` 200 `received:true`, `publishPage` anon 403); hello-world control
  created with **no** backend, count unchanged. ⚠️ The template's cloud fns are **4 top-level**
  (claimSite, publishPage, duplicatePage, submitContactForm) — the three `site/*` components
  are nested helpers, and SBR-001's task file's `resolveSlug` does not exist; probe
  `submitContactForm`. Unit: `tests-unit/sbr-001/` 15/15 (jest/`test:main`). Floor:
  **2863 specs, 4 failures, all `AIX-006 style vocabulary` by name** (seed 65452). Drive
  artefacts left in place: projects "SBR Drive Site" + "SBR Hello Control" in NodeGX test
  projects, backend `backend_mtctpzoolycw4`. ⚠️ `typecheck:editor` has a pre-existing 5-error
  baseline (`@noodl-viewer-cloud/execution-history` unresolved in `src/main/execution-history`,
  since WFA-002) — not this session's.
- **s1 (2026-08-28)** — **Phase scoped.** Both artifacts read and challenged; the challenge
  found the platform already ships the token system the proposal wanted to invent (182 defaults,
  project overrides deployed as `:root` in index.html, `RawColorLiteral` warning) — recorded in
  README §3. Richard ruled: Studio default, Messages in scope, deploy fix = derive-in-runtime,
  **live preview BUILT not struck**, no short paths ("blow people's minds"). Wizard seam mapped
  (Explore): insertion points, the `useSwitchToDefaultComponent` trap (a previous restore
  attempt was deleted after driving — the default switcher runs unconditionally and wins; its
  spec passed on source text), `ensureLessonBackend` as the attach recipe, `TemplateItem` as the
  five-string bottleneck. Fourteen task docs written.

## s23 (2026-08-29) — D18 fixed, and a runner nobody watches

🟢 **D18 fixed in the template, 🔴 not driven** ([SBR-007](SBR-007-THE-PAGE-EDITOR.md) §17–§18).
The lever is **`flexWrap: 'wrap'`** (+`rowGap`) on `/Pages/PageEditor`'s `headerRow`, and the reason
is `layout.ts:82`: **every node starts `flexShrink: 0`** and only a percentage size along the
parent's direction opts back in — every child of that row is `IN_A_ROW` (`contentSize`), which
assigns a percentage on neither axis, so nothing could shrink and `nowrap` clipped it. 🔴 That also
explains why `flex-grow` was never the lever, here or in SBR-004 §8.2. 🔴 **D18's own row was wrong
twice** — it cited SBR-004 **§9.1** (the precedent is §8.2/§10) and called it *the same family* when
SBR-004's was a **height** problem cured by `contentSize` and this is a **width** problem *caused*
by it. ⚠️ **The fixture was minted from the old template, so nobody has seen the fix on a screen**;
the drive that closes it is §14's probe re-run at 1440/988/800/600.

🔴 **D19 — `tests-unit/sb-007/site-template.test.ts` was failing AT HEAD** and had been for three
commits (21/14/236 asserted against an actual 22/15/274). ✅ Measured read-only at HEAD *and* in the
working tree — **identical**, so D18's fix could not have caused them. They live in **`test:main`**
while the phase's standing note quotes **`test:ci`**: a green for one runner was being read as a
green for the other. Repaired **with attribution, not bumped** (236 → 257 SBR-017's `/Pages/SignIn`,
→ 259 SBR-016, → 274 SBR-007 s21). ✅ `tests-unit` now **363 suites / 6105 tests / exit 0**;
`noodl-mcp` **69 suites / 961 tests / exit 0**. 🔴 **Making `test:main` watched is still `NONE`.**

## s24 (2026-08-29) — D18 driven without an editor, and the defect was bigger than its own row

🟢 **D18 is DRIVEN** ([SBR-007](SBR-007-THE-PAGE-EDITOR.md) §20–§23). A peer held 9222 and `:8574`
for a third consecutive session, so the drive went through `scripts/devtools/render-from-disk.js` +
`withRenderedPage` — the **same `noodl.viewer.js` bundle the editor's viewer runs** — in headless
Chrome on a free port. Two arms, both copies of the fixture, differing by exactly the three lines of
`10b26d57`'s artefact diff, with the fixed arm's parameter block **read out of the HEAD artefact
rather than typed**.

✅ **The control arm had to earn the second one.** It reproduced §14 in full — 104/104 `SELF` at 1440
and 1024, 91/104 at 988, `none` at 800 and 600, right edge pinned at 1001, `scrollWidth ===
innerWidth` throughout. Seven readings, seven agreements, through a different host. The fixed arm:
`flex-wrap: wrap`, `row-gap: 12px`, row 35 → 73 px below 1024, `Save page` **`SELF` and 104/104 at
every width from 1440 down to 600**.

🔴 **D18's recorded threshold was a property of the fixture, not of the defect.** The row's heading
said *"below 897 px"*. The row's width is `sidebar + title + pill + two buttons`, and the title is
the only term a user controls. Re-driven with a 56-character title: `Save page` hit-tests **`none` at
1440, 1200, 1024 and 800** before the fix, and `SELF` at all of them after. **On an ordinary laptop
screen with an ordinary page title, the button did not exist.** Screenshot pairs in `notes/`.

🔴 **[D20](DEFECTS-THE-SITE-BUILDER-FOUND.md), new, `NONE`** — the `Editing · <title>` heading
measures 409 px (short title) and 965 px (long) **identically at every viewport in both arms**: it
never shrinks, never wraps, and `scrollWidth === innerWidth`, so the overflow is clipped with no
gesture that reaches it. D18's fix cannot address it — `flexWrap` moves children, not the text
inside one. Needs a decision (ellipsize, wrap, or accept), and the shrink option may be a **product**
change in `layout.ts` rather than a template one.

🔴 **The session's own near-miss, kept.** The first probe measured `saveButton.parentElement` and
reported a 1136 px "button" hit-testing `SELF` at 600 px — which reads as *"the defect does not
reproduce."* It was caught **by the control disagreeing with §14**, not by inspection. §16 was paid
for one session earlier and the same trap was still live: the button is the leaf itself,
`BUTTON.ndl-controls-button`, 104 px. **A control arm that has to match a recorded reading is the
thing that catches a broken instrument; a fix-only arm would have shipped the wrong conclusion.**

⚠️ **Gates**: `test:ci` was **not** run — a peer held the editor all session (again). See the
handover for what is and is not known about the floor.

- **s25 (2026-08-29)** — **AC1's deployed half, owed since s18 and skipped at s22, s23 and s24, is
  met — and serving the deploy found a defect in the backend, not in this screen.**

  🟢 **AC1 deployed** ([SBR-007](SBR-007-THE-PAGE-EDITOR.md) §25). A real `deployToFolder` folder,
  served and driven: signed-out public heading → sign in → retitle → save → the header (fed from the
  **record**) flips → the stored row over REST → and a **second Chrome with a fresh profile, which
  never signed in**, reads the new 36 px heading. Zero console errors. §12.1's oracle, because the
  nav lists the page by title and `body.innerText` would pass before anything was driven.

  🔴 **[D21](DEFECTS-THE-SITE-BUILDER-FOUND.md), new, FIXED and DRIVEN in the same session.** The
  first arm could not sign in at all: cross-origin from its backend — the normal deployed shape — a
  correct password produced *"That email and password did not match."* while the backend received
  **nothing**. Chrome: `HeaderDisallowedByPreflightResponse`, `x-parse-installation-id`. The
  runtime's auth seam sets that header on every auth call, the data seam deliberately does not, and
  `nodegx-backend`'s allow-list had the other three — so a deployed app had **working data and no
  authentication**. One header, `ops/headers.ts`. Specced with a refused-header control in the same
  call (else a wildcard passes too), mutant-checked both ways, `dist/` rebuilt, drive re-run to
  completion.

  🔴 **A headless export's health filter is inert, and it fails OPEN.** `getConnectionHealth` answers
  `healthy: true` when nothing has been evaluated, and `evaluateHealth()` bails silently on
  `isModuleRegistered(project)` — which only the editor satisfies. Before registering, a wire to a
  port that does not exist was **written into the deployed bundle**; after, it is dropped and all 241
  non-cloud connections survive. **Counting calls is not counting evaluations**: the tool reported
  "22 components evaluated" while the true number was 0.

  🔴 **Two wrong readings, both kept in D21's row.** A `POST /login → 200` captured beside the node's
  failure was **the probe's own control `fetch`**, matched by the same URL filter — a capture
  filtered by URL attributes nothing to a producer. The `credentials: 'include'` theory that replaced
  it *reproduced the symptom exactly* and was still wrong; `corsErrorStatus` named the real cause and
  had been in the payload all along.

  ✅ **New instruments**: `scripts/devtools/deploy-from-disk.entry.ts` (+ `build-deploy-from-disk.mjs`)
  runs the editor's real deploy path in Node; `scripts/devtools/drive-deployed.js` serves a deploy
  folder and drives it over CDP, with an optional same-origin backend proxy.

## s30 (2026-08-30) — AC2's gesture, built, and the sentence that was holding it up

🟢 **SBR-007 AC2 is met on both halves** ([SBR-007](SBR-007-THE-PAGE-EDITOR.md) §33). The outcome
half has been driven since s27; the gesture stood at ⬜ for three sessions behind
[D23](DEFECTS-THE-SITE-BUILDER-FOUND.md#d23), which s29 disproved. This session did the authoring
s29 scoped.

🔴 **The clause s29 did NOT disprove was the real difficulty, and it stopped mattering rather than
being worked around.** D23's comment had three clauses; s29 killed the middle one. The last —
*"these rows are anything but uniform, so `Drag Y / rowHeight` has no `rowHeight`"* — is **still
true**. Reading s29's result as "so the gesture is easy" would have been D23's error with the sign
flipped: a measurement of *some* property standing in for the one that decides. What makes it
irrelevant is that `parentElement.children` gives every sibling's box at once, so the drop index is
a **count of centres** and no pitch appears anywhere.

✅ **A fourth instrument arm: a synthesised pointer.** `ac2DragGestureDrive.test.ts` — 9 specs,
~28s — authors through the real MCP door, renders in headless Chrome, and drags with
`Input.dispatchMouseEvent` on the same CDP connection. **Three drags, three different answers** on
rows of three different heights; a drive that called `onStop` itself would have proved the
arithmetic and said nothing about whether `react-draggable` sees a pointer inside a `For Each` item.
🔴 `buttons: 1` on every move is load-bearing — without it the press and release both land, the
element never moves, and the failure reads exactly like *"the runtime cannot drag"*.

🔴 **The fourth arm is what licensed the template change at all**: a **button inside the draggable
card is still clickable**. `/Admin/SectionRow` is nothing but controls and `Drag` has no `handle`
port, so had the press been swallowed the honest outcome would have been a product row, not a build.

🔴 **The trap that would have shipped a silently wrong index.** A `For Each` renders its items into
its **visual parent's** element, so with the repeater still under `sectionsPanel` the rows were DOM
siblings of the header and the refusal line — two elements counted as rows above every section, an
index two too high on every drop, obeyed by the endpoint. **Nothing else in the suite can see it**:
the wires are right, the ratchet is satisfied, the census counts are right, and it renders. Fixed
with `sectionRows`, gated, and **the gate was sabotaged** — one extra sibling reddens it and the
other 33 specs stay green.

🔴 **[D28](DEFECTS-THE-SITE-BUILDER-FOUND.md#d28), new, `NONE`** — a `Drag`'s direct child loses its
`cssClassName`; `react-draggable` clones it away. **Three controls at other depths**, taking their
class by the same mechanism from the same node, keep theirs — which is what makes it about `Drag`
and not about `cssClassName`, and is the discrimination D23 lacked. Silent: accepted, stored,
deployed, absent at runtime.

🔴 **A connected number cannot say `px`.** The first drive authored `h → card.height` and got
`height: 60%; flex-grow: 60`. `SIDEBAR_WIDTH` records this for *parameters*, where `{value, unit}`
escapes it; **a connection has no such form**, so a dimension driven by a wire is always a
percentage.

⚠️ **`Drag` leaves the element translated where it was dropped** and nothing puts it back. Two arms
of the first drive read `idx=0` and `NaN` — the page answering honestly about a state the arms had
not accounted for. The template owes `Snap To Position Y → 0` on **every** release, which is what
`out-snap` does.

⬜ **What is NOT done, stated rather than ticked**: the real `/Pages/PageEditor` has not been loaded
against a backend with sections and dragged. What was driven is the mechanism plus every static
property the template's use of it depends on. That is the next session's first job.

**Gates**: `noodl-mcp` **986 / 74 suites**, `nodegx-backend` **1406 / 119 suites**, editor `test:ci`
**2905 specs, 4 failures — the recorded AIX-006 floor, all four by name**, seed 42125, `gitHead`
`12cc718a`, fresh readout. `noodl-runtime` not re-run: no source in it changed.

## s32 (2026-08-30) — D30 and D31 fixed, driven, and turned into the net that defends them

s31 drove the real `/Pages/PageEditor` and ended with a sentence it refused to round up: *"AC2's
gesture works on the real page editor, and the artefact a person receives cannot show it."* **That
is no longer true.** Two edits in `sb005Components.ts`, then `npm run template:site-builder`:

- **[D31](DEFECTS-THE-SITE-BUILDER-FOUND.md#d31)** — `runOnChange-in-{data,body,image}: false` on
  `merge`, **first in the bag** (`NodeScope.setNodeParameters` drains queued values in key order).
  The drive reads **0 / 0 / 0** where it read **115,755 / 142 / 69**, and no write lands.
- **[D30](DEFECTS-THE-SITE-BUILDER-FOUND.md#d30)** — `visualSort: SECTION_SORT` on the editor's
  `sections` query. **Drawn order == stored order** at boot and after the drop, and `Move up` on the
  card a client sees at the bottom now moves the row they pointed at.

🔴 **The handoff's own instruction would have broken the build.** It said to import `SECTION_SORT`
from `sb006Components.ts` — but `sb006` already imports `ROUTER` **from `sb005`** *and uses it at
module-eval time*, so importing back makes a cycle in which `ROUTER` is still in its **TDZ** when
`sb006`'s body runs. The constant **moved to `sb005`** and `sb006` re-exports it exactly as it
already re-exports `ROUTER`: one copy, no cycle, no consumer moved.

🔴 **The mutant arms INVERTED, and that is the transferable part.** s31's mutants *repaired* the
project to name a cause; after the fix such a mutant repairs nothing and `setParams`' own
precondition (*keys ABSENT beforehand*) goes red. The arms now **restore** the defect, and
`setParams` grew a **mirror precondition** — the keys must be present **and `false`** before being
forced to `true`. ✅ Without it, a template that quietly stopped stating them would leave the arm
"restoring" a defect that was never absent: the shipped arm reddens and the mutant still looks like
it did its job. 🔴 **And s31's exclusion of the obvious suspect was RE-BASED, not deleted** — a
control does not become obsolete when the bug is fixed, it becomes a control about the **mutant**
(**20,507** row writes with the refetch wire gone).

✅ **`unpack` was s31's open question and the answer is NO.** One inbound wire, **no `run`
connected**, so the value change is its only trigger — silencing it would blank the body textarea
and the image preview permanently. NDA-017 skips it for the same reason.

⚠️ **A flipped spec reddened a DIFFERENT spec.** `sb007Template` went 52/53 — a **mutant** whose
offender string enumerates the query's stored parameters, which now includes `visualSort`. 🔴 The
real gate never moved (`offenders: []`, same nine graded reasons), so `visualSort` added a stored
**parameter**, not a **trigger**.

⚠️ **Two of the four `"This page's sections"` queries stay unsorted and that is correct** — they are
`/#__cloud__/publishPage` and `/#__cloud__/reorderSection`, **cloud functions with no screen**, and
`reorderSection` sorts in its own script because it cannot trust query row order at all.

⚠️ **A peer fixed [D28](DEFECTS-THE-SITE-BUILDER-FOUND.md#d28) as phase 80's `DEF-027` mid-session**
(`NoodlReactComponent.render`'s spread was discarding the author's `cssClassName`). Attributed by
**mtime**, not `git status`, and **excluded from this session's commit**.

🔴 **A wait-loop that greps `ps` for a runner name can never exit here** — a peer has a watcher
running for over a day whose *command line* contains `jest|vitest`. Wait on a **PID**, never a name.

**AC2 is met on all three halves and on the shipped artefact. AC3 is unchanged and still blocked by
[D15](DEFECTS-THE-SITE-BUILDER-FOUND.md#d15) alone** — s32 dragged with a real pointer and needed
none of the drop-target API D15 is about, so **AC2's success must not be read as narrowing D15**.

**Gates, s32 — stated in full rather than rounded up.**

| suite | reading |
|---|---|
| `nodegx-backend` | **120 suites / 120 passed**, 1429 passed + 10 skipped, one process, summary line present. 🔴 **The count reconciles against disk** — `ls tests/*.test.ts` is **120**, which is the check s31's cut-off run failed |
| `noodl-mcp` | **76 suites / 994 tests.** ⚠️ `ac2DragGestureDrive` failed 9/9 *inside* the full run (headless Chrome under 76-suite contention, `r[k]` undefined — the page had not rendered) and passed **9/9 alone**. **A lone red is a flake until re-run**; it imports nothing s32 touched |
| `noodl-editor` `test:ci` | **2905 specs, 4 failures, seed 74344, `gitHead` 2842866a** — **the recorded floor, and all four are AIX-006 BY NAME** (verified from `failures[]`, not from an empty list). Readout **fresh**: `test-results.json` deleted before the run, written 14:29:23 |
| `noodl-runtime` | not re-run — **s32 changed no product source** (one template module, one test file, docs) |
| `sb007Template` | **53/53**, byte-identity with a fresh generation |

🔴 **The "all four are AIX-006" check was WRONG on its first pass and is worth keeping.** The first
extractor walked the JSON for `status: 'failed'`, found **nothing** (wrong schema), and
`all(...)` over an empty list returned **True** — an absence asserted with no known-firing signal
beside it. The real readout keys are `failedCount` / `failures[]`; the reading only means something
because the list has **4** entries and each contains the name.

✅ **`sb017-deploy-connection-parity` — the census literal memory flags as going stale — DID run.**
Verified through the barrel chain rather than assumed: `tests/index.ts:239` `export * from './cloud'`
→ `tests/cloud/index.ts:3` imports it. **A spec not in `index.ts` never runs.**

## s33 (2026-08-30) — SBR-006 CLOSED. The ratchet asked for a task, and a task went green.

s32's handoff opened with the standing rule Richard set the same day: *a defect becomes the next
session's first job **only if it blocks an acceptance criterion**; otherwise the next session builds
the next task.* It named the cheapest ✅ on the board — **SBR-006 AC3's `Unpublish`, never clicked**
— and that is what this session did. **`packages/nodegx-backend/tests/sbr006-unpublish-drive.test.ts`,
14 specs, all green, 67.9 s.** No product source changed: the behaviour was already right, and what
was missing was the click and the reading.

Full account: **[SBR-006 §5.14](SBR-006-THE-ADMIN-SHELL.md)**. Three things are worth carrying out
of it.

- 🔴 **The ORDER of the acts was the measurement, not ceremony.** The stored row starts
  `published: false`. A drive that clicked `Unpublish` on a fresh draft and read `false` would have
  passed **on a button wired to nothing** — the reading it wants is the state the row was already
  in. Publishing first, *through the same menu*, is what puts a known-firing `true` there. The
  sequence, on stored row / anonymous read / pill: `false`/404/`Draft` → `true`/**200**/`Published`
  → **`false`/404/`Draft`**.
- 🔴 **A same-endpoint sibling still had to be clicked, and the gap had a shape.**
  `sb004-publication-invariant` has driven `publishPage`'s unpublish direction over HTTP for many
  sessions, which made "s22 covered it by proxy" tempting. But **`in-publish: false` is a constant
  on the node, not a value on a wire** — a `CloudFunction2` that never carried it would call the
  same endpoint, answer **200**, record `success`, and **publish the page again**, with the pill
  then saying the opposite of what was asked. The endpoint half was covered; the **button** half was
  not, and AC3's wording is about the menu. ✅ **Ask what the failure would LOOK like before deciding
  an existing spec already covers a sibling.**
- 🔴 **The first run went 13/14 and the red was the SEED, not the product.** The seeded page
  answered **200 to an anonymous reader before anything was published** — which fits a serious
  defect exactly, because `canAccessRecord` really does read an **absent** ACL as public
  (`model.ts:701-718`). It is not that: `/Pages/Admin`'s `create` node writes `ADMIN_ONLY_RULES`, so
  a page a **person** creates is born admin-only. The drive's seed had reached past the template's
  own door with a raw `POST`. ✅ **A seed that bypasses the product's own creation path is a second
  product** — and what excluded the defect reading was going and reading the create node, not the
  other thirteen greens.

⚠️ **One reading handed on rather than acted on.** `execution_steps` records **six** steps per
publish (`JavaScriptFunction · JavaScriptFunction · RunTasks · SetDbModelProperties ·
SetDbModelProperties · noodl.cloud.response`) where §5.13 read **five** at s22. `publishPage` does
have two `SetDbModelProperties` nodes, so the likely reading is that the `Run Tasks` worker's step
is now recorded — **but that cause is not established and is not claimed here.** It is evidence for
**SBR-015 AC4's owed re-read** (board item 2), and deliberately not a closure of it.

⚠️ **A peer was in the shared checkout throughout**, fixing **D32** in
`packages/noodl-mcp/tests/sb007Template.test.ts` (a deep-clone fix plus a reach-counting assertion).
Their files were **excluded from this session's commit** — attributed by **mtime**, not by
`git status` — and `sb007Template` was **not run**, because running it would have measured their
in-flight work rather than anything of this session's.

## s34 (2026-08-30) — SBR-015 CLOSED. An AC that had been 🟡 through four handoffs was met by a mechanism nobody in this phase had touched.

s33's handoff named **SBR-015 AC4's re-read** as the cheapest ✅ left, and warned: *"take the
reading inside SBR-015's own instrument rather than citing s33's — a criterion closed on another
task's incidental sighting is the pattern this phase keeps paying for."* That warning was worth
its place. The sighting was real, but it was of a **success** run, and AC4's own second sentence
asks about two runs, not one:

> *"it could not separate 'never called' from 'called and failed'."*

**`packages/nodegx-backend/tests/sbr015-execution-steps-drive.test.ts` — 10 specs, ~3 s**, two
deployed backends, identical seeds, one variable. Full account: **[SBR-015 §4c](SBR-015-A-FAILURE-WITH-NOWHERE-TO-GO.md)**.

| arm | variable | HTTP | `execution_steps` |
|---|---|---|---|
| **A — control** | `withFlag` declares `out-built` | 200 | **7**, all `success`, incl. the Run Tasks **worker's** two rows |
| **M — mutant** | that declaration removed | **400** `This page could not be published.` | **3** — `prep:success`, **`withFlag:error — The script threw: Outputs.built is not a function`**, `deny:success` |

`tasks`, `page-8` and `res` are absent in M and present in A. **SBR-015 is CLOSED, all four ACs.**
**No product source changed** — one new spec, one now-false comment corrected in the template
source, and the regenerated artefact is **byte-identical** (`sb007Template` 59/59).

### 🔴 What this session paid for, and would pay again

- 🔴 **RE-READ AN AC'S MECHANISM BEFORE RE-ASSERTING ITS VERDICT.** AC4 was 🟡 on a written,
  correct, *three-times-corrected* explanation: `execution_steps` mints a step per author `Log`
  line and the template ships zero `Log` nodes. **Phase 80's DEF-004 replaced that recorder** with
  one opened by `beginOutcome` and `raiseRuntimeError`. Nobody in this phase touched the AC and the
  AC changed anyway. ✅ **An AC parked on "why it cannot" is parked on a claim about the product,
  and claims expire.**
- 🔴 **THE FAILURE ARM WAS THE HARD PART, AND THREE NATURAL FAILURES DO NOT FAIL.** A `pageId`
  naming no record → **200 `published: true`**, five `success` rows, nothing written (**[D34](DEFECTS-THE-SITE-BUILDER-FOUND.md#d34)**).
  An ACL-locked Section → publishes fine; a cloud function is not ACL-bound. A non-admin → **403
  at the function gate**, so the graph never runs and **no record is written at all**. Only then is
  a mutant the honest instrument — and the one chosen is the failure `sb004Components.ts` already
  names in its own comment on these very wires. ✅ **When an input cannot cause the failure you
  need to observe, say so and mutate; do not weaken the assertion until something passes.**
- 🔴 **AN ABSENCE IS ONLY READABLE BESIDE A KNOWN-FIRING SIGNAL — AND THE POPULATION MATTERS.**
  *"`tasks` has no row"* is equally good evidence for *"it never ran"* and for *"the recorder does
  not cover it"*, and those have opposite fixes. The absences are asserted against **arm A's own
  recorded set**, never against the authored node list — because a step exists only for **action**
  invocations, so nodes this table can never see would have made the absence check vacuously true.
  ⚠️ That limit is written into the spec's header rather than left for the next reader.
- 🔴 **THE READER READ THE WRONG RUN, AND ONLY AN ARM THAT WROTE NO RECORD EXPOSED IT.** The first
  draft took *"the latest `publishPage` record"*. The non-admin arm is refused at the gate and
  writes **no** record — so it read back the previous arm's row and would have been reported as its
  own. ✅ **`readRun` is now keyed on the previous run id: a reader that cannot tell "no record"
  from "someone else's record" has the exact defect this task is about.**
- ✅ **The mutant returns its own edit count, asserted `=== 1`.** A mutation that matched nothing
  leaves the arm identical to the control, and the pair then reads *"the failure was not recorded"*
  when no failure was ever caused.
- ✅ **A phase-80 row settled for the cost of two lines** (§4d). `UNOWNED-ROWS-TO-MEASURE.md` §1 —
  *"`publishPage` issues its refusal after making the page public"* — asks for a forced failure and
  a read-back of the stored page. Arm M already was one: **`published: false`, no `*` ACL rule**,
  with the control showing `true` + `"*": {read: true}`. 🟢 **Disproved at HEAD**, bounded in
  writing to the single `tasks.done → page.store` edge, and recorded in that peer's file.

⚠️ **One row filed, not chased. [D34](DEFECTS-THE-SITE-BUILDER-FOUND.md#d34)**, owner `NONE`:
publishing a page that no longer exists answers **200 `published: true`** and writes nothing.
Attributed **exactly one hop** — `PUT /classes/Page/<no-such-id>` answers **404**, so the refusal
exists and is lost between that route and the node — and **no further**, because which hop drops it
is not established. It does **not** block an AC: AC1's sentence is about a page that *cannot* be
published being refused, and that path works on both arms. Wiring cannot reach a node that reports
`done`.

**Gates taken:** `sbr015-execution-steps-drive` **10/10** (three times, the last on the committed
bytes); `def004-publish-page-steps` **5/5** beside it; **`sb007Template` 59/59** — the gate s33
deliberately left unread at this HEAD, now read, and byte-identity holds after the comment fix.

---

## s35 — 2026-08-30. **SBR-012 BUILT, all four ACs. SBR-004 AC3 closes with it.**

**Two tasks in two sessions became three in three, and one row filed — which is also fixed.**

s34's handoff named SBR-012 as the build: top of s33's ordering, 45 lines, fully scoped, and it
**owns SBR-004's AC3**. It is built.

**`packages/noodl-mcp/tests/sbr012RawColourGate.test.ts` — 25 specs, ~0.7 s**, plus
**`siteBuilderStyleScan.ts`**, the instrument, extracted so this gate and `sb006PublicSite.test.ts`
scan from **one** definition of "colour" rather than two that drift.

| arm | artefact (289 KB) | component sets (4 files) |
|---|---|---|
| raw colour | **0** | **0**, comments stripped |
| unresolved `var(--x)` | **0** of 33 distinct, 284 uses | **0** of 33 distinct |
| non-token dimensions | **12** → **9**, all named with reasons | — |

### What this session paid for, and would pay again

- 🔴 **THE TASK FILE'S CITED MECHANISM HAD MOVED, AND CARRIED A SECOND HOLE IT DID NOT NAME.**
  `RawColorLiteral` is at `parameterValues.ts:1001`, not `:976`. Reading it rather than trusting the
  citation turned up a hole the task file missed: `RAW_COLOR` is **anchored** `^\s*`, so
  `'1px solid #cdc5b6'` walks past the product's own check. There is now a spec that runs both
  patterns over one smuggled string. ✅ **s34's lesson generalises past ACs — a citation is a claim
  about the product, and claims expire.**
- 🔴 **ZERO EVERYWHERE IS THE READING A BROKEN CHECKER ALSO PRODUCES.** All three arms read zero on
  HEAD. So the instrument's **reach** is asserted as a floor in the same run — 24 components, ≥500
  parameter rows, ≥30 script bodies including `applyTheme` **by name**, every source shrinking under
  comment-stripping — and **every arm is paired with a planted defect that must red.** Calibration
  came before the first assertion, as the task's own trap demanded.
- 🔴 **THE GATE'S FIRST FINDING WAS REAL, AND THE OBVIOUS DIAGNOSIS WAS WRONG.**
  [D35](DEFECTS-THE-SITE-BUILDER-FOUND.md#d35): `/Pages/Setup`'s `Form` set `padding{Top,Left,Right}: 24`.
  The tempting reading — *the door refuses a bare number because these ports are percentages* — is
  `sb005Components.ts`'s own documented sentence about `SIDEBAR_WIDTH`, and it is about **`width`**.
  `node-catalog.json` says `paddingTop` is `px`-only, so it rendered 24px and `UnitlessDimension`
  was **right** to stay silent. ✅ **Read the port's own shape; a sibling port one line away had the
  opposite rule.**
- 🔴 **AND IT WAS A SURVIVOR — the same trio was fixed in `/Pages/PageEditor` during SBR-007.** It
  lived because **nothing scanned it**: SB-006's gate reads SB-006's five components, and Setup is
  SB-005's. ✅ **A gate whose population is narrower than the artefact reports a template clean that
  it never looked at** — which is the entire case for SBR-012's second population.
- ✅ **Fixed, not exempted, and the doctrine decided that** — the exemption list says spacing,
  colour, radius, face and font size gain no entries. Three lines; the regenerated artefact diffs by
  exactly those three.
- 🔴 **A LABEL-ONLY EXEMPTION KEY WOULD HAVE SILENTLY WIDENED.** SB-006's four live where `label` is
  unique; the template has **several** nodes labelled `Heading` and exactly one sets a raw width.
  `TEMPLATE_DIMENSION_EXEMPTIONS` is keyed `component | label | port`, and the ambiguity is asserted
  as a spec rather than trusted to a comment. Equality is checked **both directions**: an exemption
  matching nothing reads exactly like a raw value that was never introduced.
- ⚠️ **A REASON NAMED IN A COMMENT AND NEVER WRITTEN IS AN UNENFORCED REASON.**
  `sb005Components.ts` pointed the reader at **`ADMIN_RAW_DIMENSIONS`** for the admin rail's
  justification. That constant **never existed**. The comment now names the list SBR-012 built.
- 🔴 **AC4 NAMED A GATE THIS FILE IS NOT IN, AND ASSERTING IT WOULD HAVE PASSED.** The AC says
  `test:ci` "(registered in the spec barrel)" — the **editor's** convention. This package has no
  barrel and `test:ci` does not execute it at all. AC4 is checked where it lives: `jest.config.js`'s
  glob, `test:packages` scoping `@noodl/mcp`, `pr.yml` running `test:packages` — read from disk, and
  confirmed independently with `jest --listTests`. ✅ **A spec written against the wrong runner is
  green and measures nothing.**

**Gates taken:** `sbr012RawColourGate` **25/25**; the **full `@noodl/mcp` suite — 79 suites, 1040
tests, exit 0**, with the file count reconciled against `jest --listTests` (79) so no suite silently
failed to run; `sb007Template` **byte-identity holds**; `sb006PublicSite`/`sb005AdminPanel`/
`sb004Authoring` **106/106** after the regex extraction; `tsc --noEmit` on `@noodl/mcp` **exit 0**
(jest runs with `diagnostics: false`, so a type error would otherwise never surface).

---

## s36 (2026-09-01) — 🟢 **SBR-005 BUILT. All five ACs met, and four defects the drive found**

**The largest unbuilt piece, and the one that owned SBR-004's AC3 gallery model.** Four tasks in four
sessions now (s33 SBR-006, s34 SBR-015, s35 SBR-012, s36 SBR-005). **Four tasks left unbuilt.**

Full account in [SBR-005 §5](SBR-005-SECTIONS-WORTH-HAVING.md); the AC verdicts are §5.5 and every
one of them is a browser reading, not a graph assertion.

### What it is

`Site/SectionView` was **one `Image` + one `Text`** and a script whose whole vocabulary was
`showImage` / `showBody` / `weight` / `size` / `family`. It is now **a switch and five wrappers** over
six new components — `Site/HeroSection`, `Site/GallerySection`, `Site/GalleryTile`,
`Site/CtaSection`, `Site/RichTextSection`, `Site/ContactSection`. The template regenerates at
**30 components**, from 24.

`Section.data` gains `heading`, `images[]`, `linkLabel`, `linkTarget`, and `Admin/SectionRow` authors
all four — with the gallery riding the **existing** upload path, same picker, same `Upload File`,
same record, which is what makes AC5's *"the ACL treatment must match the existing image path"* a
fact about the graph rather than a claim.

🔴 **This is phase 81's register row V16** — *the four section kinds are ONE layout; `cta` emits no
button* — fixed from the other side. Owner there is **VIB-009**, which has never been written.
Cross-linked, not duplicated: P81 keeps the row, P77 owns the template.

### 🔴 What s36 paid for, and would pay again

- 🔴 **A "CANNOT" IN THIS FILE WAS REFUTED ELEVEN NODES ABOVE IT.** `Site/SectionView` said the
  contact form could not live in a section because *"`submitContactForm` takes a `pageSlug`, and a
  repeater item cannot be given a value that is constant across items"* — true, measured, and
  **already solved for `Site/NavLink` by SBR-004**, which reads the same class of value out of
  `Noodl.Variables`. A `Variable2` node is the whole of it.
  ✅ [[an-ac-parked-on-why-it-cannot-expires]], with the fix in the same file as the excuse.
- 🔴 **MY OWN REGISTER ROW WAS WRONG ABOUT ITS OWN PREMISE, WITHIN THE HOUR — [D37](DEFECTS-THE-SITE-BUILDER-FOUND.md#d37).**
  Filed as *"two switches; an author who turns on both gets two contact forms"* — a hazard with a
  workaround, owner SBR-007. **There is no second switch.** `/Pages/Site` mounted its form from
  `rows.some(r => r.kind === 'contact')`, the **identical predicate** the section dispatches on, so
  **every** contact section drew two forms, always. The row was written from the **graph**; the
  answer was in the **browser** (7 `<section>` elements on a five-section page).
- 🔴 **AND THE CENSUS HAD BEEN REPORTING IT SINCE BEFORE I TOUCHED IT.**
  `sb006PublicSite.test.ts`'s cross-component walk listed `Site/ContactForm`'s four nodes **twice**,
  and this session updated the expected list and wrote a paragraph explaining why that was fine.
  ✅ **An expected-value update is a CLAIM. A session updating a census it did not cause is the
  moment to ask what changed.**
- 🔴 **THREE UNSTATED `runOnChange-*` DEFECTS IN ONE SESSION, AND THE PATTERN IS NOW STATEABLE.**
  [D36](DEFECTS-THE-SITE-BUILDER-FOUND.md#d36) (mine — three new `merge` inputs, D31's cycle three
  new ways in), [D39](DEFECTS-THE-SITE-BUILDER-FOUND.md#d39) (both contact answers shown on load, to
  every visitor, for five sessions), [D41](DEFECTS-THE-SITE-BUILDER-FOUND.md#d41) (the form **sent
  itself** when the last field stopped being empty, and again on every keystroke).
  ✅ **An unstated `runOnChange-*` on a node whose script ends in an EFFECT is a defect, whatever the
  effect is.** Nothing in the repository checks that shape.
- 🔴 **A NODE CAN SIT IN A HAZARD CENSUS, BE RIGHTLY CLEARED OF THAT HAZARD, AND CARRY ANOTHER.**
  `sb007Template.test.ts` had listed D39's two gates and D41's four inputs in `runsOnValue` for five
  sessions. That census grades **write-back cycles**; none of these six writes anything it reads, so
  it was **correct** to be silent. Three separate defects lived inside a green, honest instrument.
- 🔴 **D39 AND D41 WERE INVISIBLE TO EVERY GATE AND OBVIOUS TO ONE PAGE LOAD.**
  `sb006PublicSite.test.ts` asserts both answer Texts are authored `mounted: false` **and** wired to
  a decider. Both true; both beside the point. **What nothing asked was whether the decider publishes
  on load** — the same question, one node upstream. ✅ *The gates were green and the product told
  every visitor their message had been sent before they typed a word.*
- 🔴 **"BEHIND SOMETHING" AND "BELOW THE FOLD" ARE THE SAME READING —
  [D40](DEFECTS-THE-SITE-BUILDER-FOUND.md#d40).** `clickButton` refused the CTA as blocked; the
  blocker probe answered `outside-viewport` with an **empty ancestor chain**. The real finding is
  that **nothing on a published page scrolls**: `documentElement` `900/900`, `body` `0/0`, **no**
  scrollable element anywhere, `scrollTo(0,1200)` → `scrollY 0`, identical at 756×469 and 1280×900.
  Pre-existing, and it makes the **pre-existing `Send` button** unreachable too. ⚠️ **Bounded**: the
  members-area control that settles harness-vs-product has **not** been run, and it contradicts phase
  81's `unreachablePx: 0`. **Two instruments disagree; that is the first thing to settle.**
- ⚠️ **A BACKTICK IN A COMMENT INSIDE A TEMPLATE LITERAL** ended the literal and surfaced as a syntax
  error twenty lines away — phase 81 recorded this and it still cost a cycle.

### Gates

- **`sbr005-sections.look.ts` — 3/3**, real Chrome, anonymous, at a **stated** 1280×900. ⚠️ A
  harness, not a gate: outside `testMatch`, run deliberately.
- `sb006PublicSite` **57/57** · `sb005AdminPanel` **34/34** · `sb007Template` **62/62** (byte-identity
  against the regenerated artefact) · `sbr012RawColourGate` green — the six new components introduce
  **no** raw colour, **no** unresolved token and **no** unexempted dimension.
- `typecheck:mcp` **exit 0**. ⚠️ The look file is **not** typechecked locally
  (`typecheck:backend-tests` OOMs on this box, settled in phase 81); CI is the coverage.

---

## s37 (2026-09-01) — SBR-009 BUILT. The theme editor demos itself, and the browser found the defect

Full verdicts in [SBR-009 §5](SBR-009-THE-THEME-EDITOR-DEMOS-ITSELF.md). Board position: **three
tasks left unbuilt** (SBR-010, SBR-011, SBR-013), plus SBR-003's owed probe and SBR-014 last.

`/Pages/ThemeEditor` went from **22 nodes to 54** — three titled cards, a presets row generated from
`SITE_THEME_PRESETS`, and a live preview beside the fields. `/Admin/PresetChip` is a new component
placed three times; `/Admin/Shell` gained a Theme query and an applier. The template regenerates at
**31** components, from 30.

### 🔴 What s37 paid for, and would pay again

- 🔴 **A GATE THAT LOOKS LIKE A BLOCKER MAY ALREADY HAVE RULED FOR YOU — READ ITS OWN SCOPE FIRST.**
  SBR-012's raw-colour gate asserts `toEqual([])` over the artefact and refuses a hex anywhere in
  290 KB. A presets row is three palettes, so it could not be built. That reads as a ruling
  collision, and the move that settles those is to *ask*. Before asking: **SBR-012 §2 bullet 4
  already names the `designTokens`/`preset-data` blocks as the one allowed home for literals.** The
  gate shipped with an empty list because there was no preset-data block yet. The conflict was a
  clause nobody had re-read. ✅ **Read the blocking task's own scope, not only its code.**
- 🔴 **AN EXEMPTION ON A COLOUR IS WORTH LESS THAN ONE ON A DIMENSION, AND MUST BE PAIRED WITH A
  DERIVATION.** A raw width is exempt because the vocabulary has no name for a proportion; a raw hex
  is exempt only because it is *data*. That argument holds only while the bytes are the source's, so
  the row is asserted **beside** `presetHexesInArtefact() === presetHexesInSource()` — 24 hexes, in
  order. A drifted second copy of the palette satisfies the exemption and fails the derivation.
- 🔴 **THE DRIVE FOUND WHAT THE GRAPH COULD NOT, AND IT WAS THE SHAPE THIS PHASE ALREADY KNOWS.**
  Three preset chips publish their `name` **at mount**, so the picker ran three times before anybody
  clicked: the screen booted wearing **Night**, five boxes pre-filled, picked by nobody. **`run` is
  additive — wiring it does not stop a node running on its own.** D36, D39, D41 and now this: the
  fourth instance, and the first found by rendering rather than reading.
- 🔴 **"UNSTATED" DOES NOT MEAN "UNSET" IN THIS TEMPLATE.** DEF-007 §3.2's
  `pinRunOnValueChangeDefaults` writes `true` into the artefact for every governed checkbox the
  source leaves out. So leaving a box unstated here is an *active choice to run on arrival*, and the
  only way to say "wait for the signal" is to say `false`. ⚠️ This also **corrects s36's lesson as it
  applies to this template**: the unstated-box hazard cannot reach the shipped artefact — it reaches
  the *default the generator picks*, which is the opposite of silence.
- 🔴 **A CENSUS CAN LOSE A HAZARD WITHOUT THE HAZARD CHANGING.** `buildTokens`'s four rows left
  `sb007Template`'s write-back census when Save stopped running it — `statedInputs` only reaches a
  node whose control signal is **wired**, and that pass answers "what would the migration silence".
  The node still reads Theme and still writes it. ✅ **Name what the instrument cannot see, in the
  spec, at the moment the number moves.**
- 🔴 **A REPAIR REDDENS THE POSITIVE CONTROL THAT NAMED IT.** `/Pages/ThemeEditor` was
  `templateAppearance`'s only bare page and also the known-positive its CONTROL pointed at. Paying
  the debt broke the control, and the cheapest green would have been to put the debt back. ✅
  **Re-point the control at a constructed positive**; the floor is now `[]` for all three templates.
- 🔴 **A +1 AND A −1 THAT CANCEL ARE THE SHAPE A CENSUS CANNOT SEE.** `sb005AdminPanel`'s
  "code nodes that declare a signal port" stayed at **9** across this task: `presets` declares
  `out-picked` (+1) and `buildTokens` lost `Outputs.built()` (−1). The count said nothing; the loop
  beside it that names nodes is what would have caught a signal called and undeclared.
- ⚠️ **A `CSS Definition`'s `style` input is `allowEditOnly` in the catalog and takes a CONNECTION
  anyway** — the door accepted it and, measured in a browser, the runtime honours it from the first
  paint. Nothing in the repository said either way before this session.
- ⚠️ **Two editor-side censuses were already wrong at HEAD**, and it was measured rather than assumed
  by putting HEAD's artefact back for one run: components read **24** against a line saying 22, node
  ids **295** against a line saying 274. `test:main` is still the unwatched runner D19 named.
- ⚠️ **The one red in the `@noodl/mcp` suite is a PEER'S, mid-edit.** `tpl001Template` on
  `templates/members-area`, whose files were being written at 22:32 and 22:37 against a 22:40
  reading. ✅ **`stat` the artefact before attributing a red to your own diff.** For the same reason
  **D40's members-area control was NOT run this session** — it would have measured a half-edited
  template, and a reading like that is worse than none.

### Gates

- `sbr009ThemeEditor` **30/30** (artefact, off disk) · `sbr009ThemeEditorDrive` **6/6** (headless
  Chrome, real render, 1280×900) · `sbr012RawColourGate` **27/27** · `sb005AdminPanel` **34/34** ·
  `sb007Template` **62/62** (byte-identity against the regenerated artefact) · `templateAppearance`
  **24/24**.
- `@noodl/mcp` package suite **85 suites, 1116/1117**, file count reconciled against `jest
  --listTests` (**85**). The one red is the peer's members-area row above.
- `typecheck:mcp` **exit 0**. Editor `test:main` **6633 passed, 4 failed in 3 suites** — all four
  pre-existing and named in [SBR-009 §5.6](SBR-009-THE-THEME-EDITOR-DEMOS-ITSELF.md).

---

## s38 (2026-09-01) — 🟢 **SBR-010 BUILT. All four ACs driven — and the drive found the defect that had been shipping since SB-004**

Full verdicts in [SBR-010 §5](SBR-010-MESSAGES.md). Board position: **two tasks left unbuilt**
(SBR-011, SBR-013), plus SBR-003's owed probe and SBR-014 last.

The contact form has stored rows since SB-004 and **nothing had ever read one back**; the rail has
carried a *Messages* item since SBR-006 and it went nowhere. Both ends are now closed:
`/Pages/Messages` (11 nodes), `/Admin/MessageRow` (9 nodes), and `goMessages` + one wire on
`/Admin/Shell`. The template regenerates at **33** components from 31, and **7** pages from 6.

All four acceptance criteria are **driven** in `sbr010-messages-drive.test.ts` — 16 arms, ~4 minutes,
the whole template authored through the real MCP server, deployed to a real `BackendService` with
the shipped policy and enforcement ON, and three arms in an order that is itself the measurement.

### 🔴 What s38 paid for, and would pay again

- 🔴 **A WRITE NOBODY READS IS A WRITE NOBODY GRADES.** [D42](DEFECTS-THE-SITE-BUILDER-FOUND.md#d42):
  the template's one public endpoint stored **every enquiry twice**, and had since SB-004. Three
  clicks produced three `submitContactForm` runs — *the browser was never at fault* — and each run's
  step list read `compose → fallback → pick → save → fallback → pick → save → stored → mail → res`.
  One `compose`, one `res`, two `save`. The endpoint had been driven repeatedly **for its response**,
  and the response is correct on both paths; the duplicate lived only in a table no screen opened.
  ✅ **The first screen that reads a collection back is a measurement of everything that writes it.**
- 🔴 **THE COMMENT ARGUED FOR THE DEFECT, FROM A PREMISE ITS OWN FILE CONTRADICTS EIGHT LINES BELOW.**
  D42's node said *"the checkboxes are left TICKED here — measured, not assumed — **because this node
  has no `storageFetch` wire**"*, and `RECIPIENT_WIRES`' FIRST entry is that wire. The next paragraph
  of the same comment stated the consequence exactly (*"boxes on with a `storageFetch` wire fetches
  twice and runs everything downstream twice"*). ✅ **A comment's premise is a claim about the file;
  check it against the file, not against how carefully it is written.**
- 🔴 **`run` IS ADDITIVE — FOURTH INSTANCE, AND THIS ONE PRODUCED A SENTENCE THAT WAS A LIE.**
  [D43](DEFECTS-THE-SITE-BUILDER-FOUND.md#d43): a signed-out visitor's screen carried *three*
  sentences — *"You are not signed in"*, *"No messages yet…"* and *"Your messages could not be
  loaded"* — because `items` publishing an empty collection ran the count script with no successful
  query behind it, even though `run` was wired to `fetched`. **SBR-016's own defect, one state
  further along**: that task made *empty* distinguishable from *never asked*, and **refused** had
  quietly re-joined *empty*. ✅ `runOnChange-in-rows: false` — the only way to say "wait for the
  signal" is to say `false`.
- 🔴 **THE TWIN WAS LEFT ALONE ON PURPOSE, AND THE ROW IS A MEASUREMENT RATHER THAN A NOTE.**
  `/Pages/Admin`'s `count` is wired identically and still says `true`. It carries SBR-006's,
  SBR-015's and SBR-016's verified ACs, and a blind edit there would be a change to driven work
  without re-driving it. `sbr010Messages.test.ts` **asserts the twin's flag is still `true`**, so the
  day somebody fixes it the row reddens and gets closed rather than forgotten.
- 🔴 **THE ORDER OF THE ARMS IS THE MEASUREMENT.** AC3 is a pair — *empty says its sentence, full
  does not* — and AC1's real claim is *"the message this visitor sent, and it was not there before"*.
  So the owner reads the screen **before** anything is sent, the visitor sends, and the owner reads
  again. Three browser sessions rather than one, and the middle one has no session token at all,
  which is also AC2.
- 🔴 **A PORT WHOSE RUNTIME TYPE IS NOT ONE THING CANNOT BE TYPED.** `createdAt` is a `Date` when the
  class schema has loaded and declares it one, and the ISO **string** the wire carried when it has
  not — `cloudstore.js:345-356`, and the branch is keyed on the **schema**, not on the value. The
  port is `*` and the row's script accepts both; the spec asserts a `Date` and its own ISO string
  produce the **same** sentence. A `string` port would have been a claim about which of the two a row
  gets, and the row does not get to choose.
- ⚠️ **A DERIVED PORT LIST IS THE ONLY FORM OF "DON'T INVENT A PARALLEL CLASS" THAT CANNOT ROT.**
  The row's six ports are read out of `CONTACT_NODES`/`CONTACT_WIRES` — `save`'s `prop-*` parameters
  **and** its `prop-*` wires, because the cloud function uses both and a derivation reading one would
  have missed `handled`.
- ⚠️ **A SPEC THAT PINS A REALLOCATED ID REDDENS ON SOMEBODY ELSE'S SCREEN.**
  `def-004/completed-commits-unchecked.test.ts` asserted `toId: 'page-7'` in a **cloud** component
  and went red because two new browser components renumbered it to `page-8` — the door makes ids
  unique across the project (SB-004 F9). It now derives the id from the node's label, which the same
  spec already asserts two lines below.
- ⚠️ **`alignItems: 'baseline'` IS NOT AUTHORABLE.** The door refuses it — `invalid-parameter-value`,
  with the four options listed (`flex-start`, `flex-end`, `center`, `stretch`). The port is an enum
  over Noodl's alignment vocabulary, not CSS's. Nothing in the repository said so before.
- 🔴 **THE HANDOFF SAID NO TEST IN THIS REPOSITORY DRIVES WITH A BACKEND YET. IT DOES.**
  `packages/nodegx-backend/tests/` holds `sb008-public-site-drive`, `sbr006-unpublish-drive`,
  `sbr015-execution-steps-drive`, `tpl001-members-drive`, `tpl002-account-drive` and the
  `helpers/site-drive.ts` that authors the whole template, provisions a backend and binds them.
  🔴 **SBR-009's AC1 live half and AC3 are therefore NOT blocked on building an instrument** — they
  are one session's use of one that has existed for ten. ✅ **A relayed blocker is a claim about an
  artefact; re-derive it from the tree before pricing work around it.**

### ⚠️ Four reds in `test:main` that are NOT s38's — measured, not assumed

Baseline taken by putting **HEAD's artefact** back for one run (md5-checked in and out):

| suite | red at HEAD? |
|---|---|
| `sb-018 (1)` — `itemOutputSignal-Changed` for both row components (×2) | 🔴 **yes** — `/Admin/SectionRow` gained `DropAt`/`DropIndex` (SBR-007's drag) and the census was never moved |
| `sb-018 (3)` — the six wired `Text`s named | 🔴 **yes** — `/Site/SectionView body` has no standing value |
| `aib-007` — `noodl.cloud.listusersinrole` unclassified | 🔴 **yes**, and it reads no template at all |

`test:main` is still the unwatched runner **D19** named. Owner: `NONE`.


---

## s40 (2026-09-02) — 🟢 **D45 RUN TO GROUND. It was two defects: the leak is the harness (fixed), the delay is the product (D46), and AC3 is isolated**

**First job per the standing rule** — D45 blocked SBR-011 AC3, so it was the job rather than a row
to file. It is now answered, and the answer is that the row was **two defects producing one
symptom**, with two different owners.

### The register named a test. It was run, and it discriminated.

> *time the hello frame through the `/__backend` proxy against direct, in one run.*

`packages/nodegx-backend/tests/d45-realtime-proxy-timing.test.ts`, five arms, ~20 seconds:

| | reading |
|---|---|
| **§1** hello frame, one run | proxied **8ms**, direct **9ms** — the proxy was never holding a frame |
| **§2** close a proxied stream | `connectionCount` **unmoved for 10s**; the direct control on the same counter reaped at once |
| **§3** subscribe with 3 streams open, from Node | 200, `accepted: 1`, **22ms** |
| **§4** the browser's connection pool | 1–5 streams: an ordinary request in 2–6ms. **6 streams: never sent.** |

### ✅ FIXED — the leak, and it was the harness

`render-from-disk.js`'s `/__backend` proxy did `up.pipe(res)` and never destroyed its source, so a
proxied `GET /realtime` outlived the browser that opened it. `RealtimeHub` reaps on its response's
`close`; that close never came. One line — `res.on('close', () => p.destroy())`.

🔴 **Graded by mutation, not by the green**: removing that line reddens §2's proxied arm and leaves
§2's direct control green. And measured on the real thing — SBR-011's `openStreams` went **15 → 3**.

### 🔴 D46 — the delay is the product, and it is bigger than D45 was

Instrumenting the drive with **Resource Timing** was the reading that ended the argument. The
subscription POST: **`queued 15007ms, waited 5ms`**. Not slow — *never sent*, released at the exact
instant the deadline closed the streams. Three cycles, identically.

`SseTransport` opens one never-ending stream per subscription; the registration POST every one of
them requires competes for the same per-origin pool those streams are holding. **§4 prices that pool
at six.** So an app with six realtime subscriptions on one origin cannot make **any** other request
to its backend — not its queries, not its writes, not the POSTs for those subscriptions. Filed as
[D46](DEFECTS-THE-SITE-BUILDER-FOUND.md#d46) with the fix named and sized (one shared connection per
backend, a registry POSTing the union) and the two traps that fix must not walk into.

### ✅ AC3 isolated — it is not `Theme`

`liveCollections` reads `{Page: false, Section: false, Theme: false}`. All three equally dead in the
warm-up window, so the s39 pair's open question — *"is `Theme` specifically broken, or did AC3 lose
the race?"* — is settled as the race. AC3 stays **NOT MET**, blocked by D46 and nothing else.

### What this session learned that the next one needs

- 🔴 **A `queued` field is a different defect from a `wait` field, and only one instrument shows
  both.** Three sessions read "the subscription was not confirmed" and reasoned about the server and
  the proxy. `performance.getEntriesByType('resource')` said in one number that the request had
  never left the browser. **When a client-side timeout has no server-side counterpart, read the
  browser's own clock before theorising about the wire.**
- 🔴 **A symptom with two causes is closed by neither fix alone.** The leak fix took 15 streams to 3
  and changed the confirmation behaviour *not at all*. Had the drive only counted streams, the row
  would have been closed on a real fix that was not the fix.
- 🔴 **A neighbourhood check needs its own control.** Running D45's fix against the sibling drives
  found **24 red tests** — and the identical 24 are red with the fix reverted *and* with
  `render-from-disk.js` at committed HEAD. Filed as [D47](DEFECTS-THE-SITE-BUILDER-FOUND.md#d47).
  ⚠️ Without running those two controls this session would have reported a regression it did not
  cause, or worse, reverted a good fix.
- ⚠️ **`§4`'s first version had no cap and sat 174 seconds on the sixth stream**, killing the suite
  on its own timeout. A starved request is not slow; it is not sent, and an instrument measuring it
  must record the cap as the reading rather than wait it out.

## s39 (2026-09-02) — 🟡 **SBR-011 BUILT, AC1/AC2/AC4 DRIVEN. The template change is six lines; the work was a product defect that had made the feature impossible**

**Built:** three public-site queries hold a subscription open — `/Site/Nav pages` (AC1),
`/Pages/Site sections` (AC2), `/Pages/Site theme` (AC3). Query Records' own **Subscribe To Changes**
checkbox, not the standalone node: `subscribetochanges.ts` states in its own header that it does not
re-query and that the checkbox *"stays as the query-refreshing form"*. Template regenerates at 33
components — no new nodes, six new lines of parameters.

### 🔴 D44 — realtime had NEVER connected for the built-in backend. Fixed.

The first drive read every AC as failing. The reading that settled what was actually wrong was the
**hub's own `connectionCount`, taken in-process while the page sat open**: the browser had opened
**three** `EventSource`s and the hub held **zero**. *Never subscribed* and *subscribed and refused*
are the same picture from a browser and have opposite fixes.

`endpointBackendEntry` puts the Parse **Application Id** in `auth.publicToken`;
`RealtimeSubscription.token` returned `sessionToken || publicToken`; `SseTransport` puts that in
`?token=`; the server reads `?token=` as an `x-parse-session-token`. Measured with no browser:

```
GET /realtime                 → 200  event: connected
GET /realtime?token=<appId>   → 400  {"error":"Invalid session token","code":209}
```

Fixed by narrowing **by type** in `RealtimeSubscription.token` — on a Parse-wire backend, the
session token or nothing. BYOB backends keep the fallback, where `publicToken` genuinely is a token.

⚠️ **`realtime-transports.test.ts` had 357 green arms across five transports throughout**, because
not one asserted what ends up in the URL. Three arms now do; the mutation check reddens one with the
literal `?token=myapp` while the session arm and the PocketBase control stay green.

### 🔴 D45 — subscriptions retry forever and LEAK A STREAM EACH TIME. **AC3 is blocked on it.**

Run A: **six** streams for three subscriptions, three `not confirmed within 15000ms`, and it warmed
up in seconds. Run B, same code one run later: **fifteen** streams, the same messages repeating, and
**not one of the three collections live inside a 120-second window** — while AC1, AC2 and AC4 passed
later in the same run. The timing is unpredictable between runs of identical code, and the abandoned
streams are never reaped, which spends `realtimeMaxConnections` on dead connections.

Owner `NONE`; the discriminating test (time the hello frame through the `/__backend` proxy against
direct, in one run) is in the register. ⚠️ **It must not be closed by raising the deadline** — that
number is what made the failure visible.

### The AC verdicts, reported as a PAIR of runs

| | run A | run B | |
|---|---|---|---|
| AC1 publish → nav link | 🟢 | 🟢 | **MET** |
| AC2 section edit → open page | 🟢 | 🟢 | **MET** |
| AC3 theme save → repaint | 🔴 | 🔴 | **NOT MET** |
| AC4 draft silent, twin fires | 🟢 | 🟢 | **MET** |

🔴 **A criterion is called met only where both runs agree, and the drive is NOT yet a stable gate.**
AC3's cause is **not isolated**: the runs cannot separate *"the `Theme` subscription does not
deliver"* from *"AC3's window lost the race AC1 and AC2 won"*. Saying which is the first job of
whoever takes D45 — cheap now that the drive reports `liveCollections` by name.

### The lessons

- 🔴 **Read the SERVER's own count, not the client's silence.** One line
  (`service.realtime.connectionCount`) settled in seconds what an hour of reading the runtime source
  could not, because the failure path is silent by design — `raiseRuntimeError` goes to an error bus,
  not to the page.
- 🔴 **Arm the instrument before measuring with it.** A subscription is not live when the page
  renders. The drive now publishes a throwaway row and waits for it to appear **before** the first
  assertion; without that, three correct acceptance criteria read as failing.
- 🔴 **One warm-up per SUBSCRIPTION, not per page.** Warming up on `Page` alone still read AC3 as
  failing — AC3 is about `Theme`, a different node holding a different stream. The warm-up now names
  which of the three proved live, so a partial failure says **which**.
- 🔴 **The control needs the SAME budget as the subject.** The mutant gets the identical 90s; given
  less, it would come back empty because of the timeout and read as if it had proved something.
- 🔴 **A field that means two things breaks on `||`.** `publicToken` is an auth token on three
  backends and an application id on two.
- ⚠️ **`packages/nodegx-backend/tsconfig.json` excludes `**/*.test.ts`.** `npx tsc -p` over it
  typechecks **none** of the drives — two "typecheck clean" readings this session were vacuous, and a
  syntax error inside a template literal reached the runner. **The jest run is the typecheck.**
- ⚠️ **A JS comment inside a TS template literal must not contain backticks.** They close the
  literal; the error surfaces as `TS1005` fifty lines away.

### The gate that had to be widened, and the wrong way to widen it

`sb007Template.test.ts`'s SBR-016 control asserts every query parameter is in `PARAMETER_CHECKBOX`.
`realtime` was not, so it went red. **Adding it to that map would have been wrong**: shape 2 reads
that map as *"this parameter is stored, so the query runs with nobody involved"*, which would have
graded `sections` — the query carrying `NO_LOAD_TIME_FETCH` precisely so it cannot run before its
filter exists — as free. A second, disjoint `NOT_A_TRIGGER` map now holds `realtime`, because
`handleRealtimeChange` returns on the `init` frame **before** `scheduleFetch`.

### ⚠️ The viewer bundle was rebuilt

`npm run build:editor:_viewer`, because the drive serves `src/external/viewer/noodl.viewer.js` and
the D44 fix had to reach it. It went from a **14.5MB** artefact to the **1.5MB** production build.
Every render drive in the repo now runs against a minified viewer; nothing measured here suggests a
problem, but it is a shared artefact and the change is stated rather than left to be discovered.

---

## s41 (2026-09-02) — 🟢 **SBR-013 BUILT, all three ACs. The last never-started task in the phase**

**First job followed the standing rule**, not the register: two sessions had gone to defects (s39 →
D44, s40 → D45), so the rule's own arithmetic — *2 sessions, 0 ACs ⇒ the next MUST build* — pointed
at SBR-013, the one task nobody had ever started. D46 blocks SBR-011 AC3 and is still open; it was
not touched.

Verdict, measurements and the seam table live in
[SBR-013 §5](SBR-013-THE-DOCTRINE-RULE.md). What is worth carrying out of the session:

### 🔴 The rule existed. It existed in ONE of six places, and not the one that mattered

The task's trap says *"an instruction added in one of three surfaces is a third of a rule."* Counted
before touching anything: six doctrine strings reach a model, and **exactly one already stated the
order** — `DESIGN_PLANNING`, the in-editor planner's, shipped in phase 54 saying *"Decide the
project's identity ONCE, before the pages."*

The five an EXTERNAL agent reads did not, and the bound MCP `instructions` said the opposite in so
many words: *"THE ORDER … decide the component tree FIRST with create_plan"*, with
`get_style_vocabulary` named only in the per-component sentence three clauses later — the design
system met for the first time while writing the first leaf.

✅ **So "the repo teaches design-first" was TRUE and "the product teaches design-first" was FALSE**,
and reading the editor's own prompts would have confirmed the wrong one. **Grep the seam the
consumer reads, not the seam you remember writing.**

### 🔴 SIX TOKENS of headroom, and the fix was a MOVE

`toolDisclosure.test.ts` prints its margin on a passing run (CN-006 added that line for exactly this
reason). It read **8,274 against the 8,280 bar — 6 free**, and a paragraph costs ~30. The gate's own
header forbids a third renegotiation.

✅ The instruction change spends nothing because it is a **move**: `get_style_vocabulary` came out of
the per-component sentence and went to the front of THE ORDER. Same fact, earlier, one place.
**8,273 / 7 free** — a token given back, and the briefing is six characters shorter.

⚠️ The reasons ride in `get_project_info`'s `designDoctrine` instead, which is outside the budget —
**and that is not a workaround, it is where they had to go anyway**: `set_style_preset` and
`set_project_tokens` are in the DEFERRED `theme` group, so an instruction naming them would point at
tools absent from `tools/list`. The doctrine names them *and* the `find_tools({group:"theme"})` door.
The shipped drive walked exactly that path.

### 🔴 The acceptance criterion was green before the work. Two arms said so

AC2 asked that a cold session's "first tool calls include the style vocabulary before the first
`create_component`". **The control arm, built from committed HEAD, did that** — third call — and so
did the phase-55 haiku baseline in August. One arm would have certified the change by measuring
something the change did not cause.

The discriminator is not what was READ, it is what was **written down**:

| | control (HEAD) | shipped |
|---|---|---|
| `find_tools({group:"theme"})` | ❌ never called | ✅ |
| `set_style_preset` / `set_project_tokens` | ❌ neither, ever | ✅ both, before `create_plan` |
| **`metadata.designTokens` on disk** | **absent** | **present, 34 tokens** |

✅ **The criterion that works is the doctrine's own person sentence** — *somebody can read back the
accent, the surface ramp and the page list before a single component exists.* Full record:
[`measurements/SBR-013-COLD-DRIVE-2026-09-02.md`](measurements/SBR-013-COLD-DRIVE-2026-09-02.md).

### ⚠️ A cold-drive control has to be built, not just reverted

The drive loads `packages/noodl-mcp/dist/noodl-mcp.cjs`, which was **two days stale**. Reverting the
source and running would have measured the shipped build twice and reported it as a control. Both
arms were verified by grepping the built `.cjs` before the run (`decide the component tree FIRST` = 1
and `LOOK FIRST` = 0 for the control; the reverse after).

### ⚠️ zsh does not word-split an unquoted variable — a backup/restore loop ran ONCE on the whole string

`FILES="a b c"; for f in $FILES` iterates once with `f` set to the entire string. The `cp` and the
redirect both failed on a nonexistent path, so nothing was lost — but the same shape with a
`>` redirect that *does* resolve would have truncated a file with no error. `FILES=(a b c)` and
`"${FILES[@]}"`. Same family as the memory already carrying `-- $FILES` reads EMPTY in zsh.

### Suites

| suite | result |
|---|---|
| `noodl-mcp` (full, 88 files) | **1164 / 1165**, one flake — `projectOwnsBackend` provision race under parallelism, **green alone on re-run** |
| `sbr013Doctrine.test.ts` (new, 10) | ✅ — **8 red** with every seam reverted to HEAD |
| `tests-unit/sbr-013/doctrineOrder.test.ts` (new, 12) | ✅ — **10 red** at HEAD; the one that stayed green is `DESIGN_PLANNING`, which is the finding above |
| `phase-55/designAuthoringPrompt`, `phase-66/planDoctrineArm` | ✅ 34/34 — the neighbours that pin these same strings |
| `typecheck:mcp`, `typecheck:editor` | ✅ exit 0, 0 errors |

### Filed

- **[D48](DEFECTS-THE-SITE-BUILDER-FOUND.md#d48)** — owner `NONE`. The resident surface has **7
  tokens** free. The `$ref`ed node schema the gate's header names is now due, and it already blocks
  a real thing: `create_plan`'s description still says nothing about what must precede a plan. The
  row carries one measured, undriven way to buy ~39 tokens back.
