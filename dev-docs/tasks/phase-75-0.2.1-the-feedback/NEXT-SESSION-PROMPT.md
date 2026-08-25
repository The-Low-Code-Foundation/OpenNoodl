# Phase 75 — next session

**State as of 2026-08-26 (session 40).** Richard's brief is still **speed: keep knocking out phase
75**, so this file leads with the queue. Take the top unblocked item; dip into the rest when it bites.

**Committed this session:** queue item 1 — **FB-005 T1**, the template registry settled. AC1 met.
The zip transport and its three providers are gone, `newProject` has one branch and it goes through
`templateRegistry`, and two live defects turned up on the way that had nothing to do with templates.
Read **[FB-005-SCOPE.md](FB-005-SCOPE.md) §4** before touching T2.

⚠️ **Peers.** `ListAgents` showed four other `opennoodl-*` sessions during this one. They are other
projects, **but every one of them runs its MCP server from *this* checkout's
`node_modules/electron/dist`**, so a sweep from any of them can match a `test:ci` electron. Nothing
went wrong this session; the run completed clean.

## The queue — unblocked, cheapest-first. Take the top one.

| # | item | size | state |
|---|---|---|---|
| 1 | *(cheap, unowned)* **bench search ANDs its terms** | **S** | 🔴 **now the cheapest thing on the board, and T4 is blocked behind it.** `websearch_to_tsquery` in `nodegx-community/src/lib/bench.ts`; **2/22 even in perfect vocabulary**. Real users, real miss |
| 2 | **FB-005 T2** — platform `project_templates` + list/detail/bundle routes | **M** | ✅ **unblocked** — T1 done, the editor side has a seam that takes a new provider. 🔴 **4 gates guard a new `/api/v1` route** (P73) and a **CHECK constraint passes on NULL** (TUT-004) |
| 3 | **FB-013** chat | **L** | 🔴 **ruled 08-22: OVERRULED, build it.** ⚠️ Its corpus does not exist either — FB-014 measured the bench at **3 posts, 2 threads, 1,369 chars** |

✅ **FB-014 is off the queue** — design phase done, AC1 + AC3 met, AC2 shown to be impossible. Its
external-processor question is with Richard.

## ✅ Item 1, closed: FB-005 T1 — and the root cause was a contract, not a bug

Full account in **[FB-005-SCOPE.md](FB-005-SCOPE.md) §4**. The recommended option was taken —
delete the zip path, keep the provider interface — but deletion was only half of it.

🔴 **`ITemplateProvider.download`'s own doc comment read *"@param destination The destination we
will save the ZIP file"*, and its one reachable implementation wrote a `project.json` into a
directory.** Both are `(url: string, destination: string) => Promise<void>`. The compiler had
nothing to say, and `TemplateRegistry.download` — written against the documented meaning — would
have tried to unzip a directory. **A type signature is not a contract.** The method is now
`install`, the contract is written on the interface, and the *rename* is the part that matters: it
is the only thing that stops a future provider satisfying the old meaning silently.

**What shipped.** Deleted: `HttpTemplateProvider`, `NoodlDocsTemplateProvider`, the unregistered
`LocalTemplateProvider`, `TemplateRegistry.download`'s download/unzip/cache, `ProgressCallback`,
and the never-read `useCloudServices`/`cloudServicesTemplateURL` fields. Added:
`TemplateRegistry.install`, which **does not swallow a failed install** — the version it replaces
wrapped the claim and the install in one `try/catch`, so a provider that claimed a URL and then
failed fell out of the loop and the caller was told *"Cannot find a valid template provider"*, a
message about the wrong thing entirely. And `models/template/createFromTemplate.ts`, the seam:
`newProject` reaches `electron-store`, `@noodl/git` and an `_addProject` that writes into
**Richard's real launcher list**, so it cannot be driven by a spec — the decisions moved to a module
plain-Node jest can. Precedent: `refusalPlan.ts`, s37.

✅ **`newProject` now has one branch.** `resolveTemplateUrl` turns the wizard's `''` — and a missing
argument — into `DEFAULT_PROJECT_TEMPLATE`, so *"no template"* and *"the default template"* stopped
being two code paths that had drifted apart. That drift **was** the outage: the `''` made the
registry branch unreachable, and the `else` reached the embedded provider directly.

## 🔴 The finding of this session: TWO LIVE DEFECTS, NEITHER OF THEM THE ONE T1 WAS ABOUT

Both were found by writing the seam, not by reading the code.

1. 🔴 **`newProject` is not awaited by its caller.** `ProjectsPage` calls it callback-style, so any
   rejection was an **unhandled promise rejection**: the launcher's *"Creating new project"*
   activity toast was never hidden and `fn` was never called. **Create a project into a location
   you cannot write to and the launcher spins forever** on a creation that had already stopped.
   ⚠️ **Note the shape — it is s39's `unzipUrl` hang one layer up.** The failure that *was* handled
   was the fast, in-band one (`!project` from `projectFromDirectory`); the thrown one was not.
   ✅ It now returns a **string-discriminated** outcome and `fn()` is called on every path.
2. 🔴 **A failed agent configuration destroyed a correctly installed project.**
   `writeAgentConfigFor` was awaited in the same unguarded run as the template, so an unwritable
   `.mcp.json` refused the whole creation — a file `backfillProjectAgentConfig` writes again the
   next time the project is opened. Now outside the guard and non-fatal.

⚠️ **Left deliberately:** a refusal leaves the (empty) project directory behind. Deleting a
directory the caller chose is the more destructive of the two mistakes and the one caller passes a
`makeUniquePath`. AC2's *"a refusal leaves nothing on disk"* belongs to T2/T3, where a partial
install of a multi-file bundle is real rather than hypothetical.

## 🔴 Second: MY OWN SOURCE-ANALYSIS INSTRUMENT SAID "THE WIRING IS MISSING" ON CORRECT CODE

AC1 is explicit that a spec over `TemplateRegistry` alone *"stays green through exactly the outage
we are in now"* — and it would have. So
`tests-unit/fb-005/template-install-path.test.ts` asserts the **chain**: `ProjectsPage` →
`newProject` → `createProjectFromTemplate` → `templateRegistry.install`. A caller-grep made
executable. **27 specs, all green; 6 mutants, each killed by its own spec and no other.**

🔴 **The body extractor was wrong on its first run.** To prove `newProject` *calls* the registry
rather than merely importing it — it imported it throughout the outage — the spec brace-matches the
method body. `indexOf('{', afterSignature)` finds the **parameter list**: `options: { name?: string;
… }` is an inline object type, so it returned the type literal and both wiring assertions failed on
code that was right. ✅ **Walk the parentheses to the end of the parameter list first.** The control
that caught it is now shipped: a neighbouring method that must come back *without* the symbol,
proving the extractor discriminates rather than returning the whole file.

⚠️ **And the strip-comments control had to be re-anchored.** It first asserted that
`EmbeddedTemplateProvider` appears in the raw source and not in the stripped one — but the bypass
this file exists to forbid would contain that identifier too, so the control fired for **two**
different reasons and stopped being a control. It anchors on a **comment-only phrase** now.
Stripping matters here: `newProject`'s own doc comment names `templateRegistry` while explaining the
outage, so an unstripped grep passes on the prose.

## Gates — session 40 ran all three, this tree, `cline-dev`

🔴 **Re-measure, never quote.** These are s40's own runs, after the change.

- `npm run typecheck:editor`: **0 errors**.
- `npm run test:main`: **341 files / 5522 specs / 0 failures** (was 340/5495; +1 file, +27 specs).
- `npm run test:ci`: **`Jasmine: 2849 specs, 4 failures`** — the recorded floor, **all four AIX-006,
  by name**. ⚠️ Quoted from the summary line, not `$?`: the compound exited **0** while the log's
  own tail says `lerna ERR! npm run test:ci exited 1`. Both halves of that trap fired in one run.
  ⚠️ It needed **~11 minutes** and outlived a 600 s tool timeout — background it and poll `pgrep`.
- `npm run test:platform` was **not** run — nothing under `@noodl/platform-node` changed.
- `npm run tokens:css` was **not** run — no stylesheet changed.

## Driving — what worked, exactly

✅ **Everything in last session's driving section still holds.** New this session (s37), driving the
**connection popup**, which is harder to reach than most surfaces:

🔴 **Stage the drag instead of aiming at connector pixels.** `window.__nodeGraphEditor` is live;
`ed.connectionPopups` is on it. Set `ed.interaction.draggingConnection = {fromNode, toNode}` (node
*views* from `ed.forEachNode`, which ⚠️ **stops on a truthy return** — push in a statement, never
`return out.push(...)`) then call `ed.connectionPopups.open()`. Real components, real props, no
canvas arithmetic. `open()` is inside a `setTimeout`, so wait ~2s.

⚠️ **The target panel is INERT until a source port is picked** — that is the product's design, not a
blocker. Before picking, the only refusals are `gated` ones (the gate pass runs outside the drag
guard); after picking, the two folded blocks appear. Both are worth measuring; they exercise
different `refusalHeadline` branches.

🔴 **Half the DOM is a measuring copy.** `[class*=refusedSummary]` returned **12 nodes, 4 real** —
the duplicates sit at `y≈1317` in a window `781` tall. Filter to `r.top>=0 && r.bottom<=innerHeight`
*and* re-query immediately before clicking; the list reflows under you between evals. The real rows
carry `aria-expanded`; the measuring copies do not, which is the cheaper discriminator.

✅ **`elementFromPoint` again, and it earned its place twice** — once catching that the target
panel's own disabled overlay was on top (correct behaviour), once confirming a row was reachable
after a reflow had moved it. ⚠️ Guard for `null` before `el.contains(top)`; it throws otherwise.

✅ **Hover via a dispatched `mouseover`,** not `cdp drag` — a real press on a refused row fires the
**redirect** and edits the project. `new MouseEvent('mouseover',{bubbles:true})` reaches React's
root listener; then wait ~2s for the async catalog lookup before reading `.popup-small-docs`.

⚠️ **`cdp click` wants a selector, not `"x,y"`.** Tag the element in an eval
(`el.setAttribute('data-drive','x')`) and click `[data-drive=x]`.

🔴 **`document.elementFromPoint` at the centre of every control you add.** See above. The two-line
version that found it:

```js
const b = el.getBoundingClientRect();
document.elementFromPoint(b.x + b.width/2, b.y + b.height/2)   // → 'popup-layer-blocker'
```

✅ **Contrast, measured live rather than from the token file** — walk the element's own
`backgroundColor`, falling back to the ancestor when it is `rgba(0, 0, 0, 0)`, and flip themes with
`document.documentElement.setAttribute('data-theme','light')`. ⚠️ Read it back in a **second**
eval; the same one still reports the old palette. `ThemeManager.instance.setMode()` threw from the
renderer — stamping the attribute is what the manager itself does (`ThemeManager.ts:175`).

🔴 **DRIVING A LESSON WRITES TO RICHARD'S OWN PROGRESS, and this session proved the restore.**
`cp -R` the whole `Learning` directory **and** `learning_folder.json` + `lessonProgress.json`,
restore after, verify by checksum:

```bash
find "$L" -type f -exec md5 -q {} \; | sort | md5 -q     # 57 files → c346394c169f9bff0baf8237c777e824
```

Both lessons back at `stepIndex: 3` afterwards, checksum identical. ⚠️ Stop the stack **before**
restoring — the running editor holds the register.

⚠️ **Tag launcher cards by the NEAREST unambiguous ancestor, not by walking N levels.** Walking up
8 parents from a *Continue* button reaches a container holding **both** lesson cards, so the tag
lands on the wrong lesson and you drive something else entirely — which I did, and only noticed
because the step count was 4 instead of 8. Walk up until an ancestor mentions one lesson **and not
the other**. ⚠️ And the button text is not stable: after a reset the card says **"Start"**, not
"Continue" — which is also a free confirmation that the reset landed.

✅ **`window.confirm = () => true` / `() => false`** to drive a native confirm, recording the
message. Drive the **cancel** arm first on anything destructive; both arms took one call each.

✅ **`PopupLayer.instance.hideModal()` alone was not enough** on a popup-only step — the view's
effect re-shows it on the next render. `hideModal()` **and** `hidePopouts(true)`, then measure in
the next call.

⚠️ **HMR did not pick up a new method on `LessonLayer.prototype`** — the live instance keeps its
old prototype. `npm run cdp -- reload` and re-open, then re-wrap; budget ~20s per cycle.

## Gate *traps* carried forward — the figures are in the s40 section above

🔴 **Figures older than the s40 section are superseded; the traps below are not.**
✅ For reference, `test:platform` was **5 suites / 27 passed / 3 skipped / 0 failures** at s39, and
`tokens:css` clean over 319 stylesheets at s37. Neither was implicated by s40's change.
⚠️ **`tokens:css` cannot see a contrast failure** — it checks that a `var(--…)` names a defined
property, nothing more. It would have passed the 1.91:1 this phase shipped.
- 🔴 **`tsc -p packages/noodl-editor/tsconfig.tests-main.json` is NOT a gate and reports 31 errors**
  — unchanged, none ours. It is only ts-jest's `tsconfig`; no npm script or workflow runs it.
- 🔴 **No gate in this repo compiles `LessonItem.jsx` or `LessonLayerView.jsx`.** They are `.jsx`,
  `tsconfig.json` has no `allowJs`, and neither is in the jasmine tests graph. **Running the app is
  the only thing that reads them** — which is why §19/§20's rules live in `lessonstepflow.ts` and
  `lessoninstructionopen.ts`, where jest can grade them.
- 🆕 ⚠️ **This repo's `tsconfig.json` sets no `strict`**, so `strictNullChecks` is off and a
  **boolean discriminant does not narrow a union**. `ResetAvailability` started as
  `{available:true} | {available:false; reason}` and a caller reading `.reason` would not compile.
  Use a **string** discriminant, as `ResetLessonOutcome` beside it already does. The specs found
  this, which is what they are for. 🆕 s40's `CreateFromTemplateOutcome` follows the same rule.

## Still open, owned by nobody

- 🆕 🔴 **The bench search ANDs its terms.** `websearch_to_tsquery` requires *every* bare word, so a
  conversational query matches **2/22 documents even in perfect vocabulary**. Anyone typing a
  sentence into the bench search gets nothing. Cheap (`plainto_tsquery` + ranking, or OR-ing terms),
  independent of pgvector, measured by FB-014's control. **Queue item 3.**
- 🆕 ⚠️ **`Set Record Properties` → `Update Record` (2026-08-01) created a live name collision** with
  the pre-existing `noodl.byob.UpdateRecord`. Two nodes now answer to one name in the picker and the
  catalog. Found by FB-014's rename mining; excluded from its eval because a query for that name has
  two honest answers.

- ⚠️ **A manually re-opened popout still covers the completion banner.** Inherent to popouts.
- 🔴 **FB-002's selected pill is 1.16:1 against the panel** — the active fill, and 1.24:1 between
  the active and inactive label, while the border is **identical** in both states. Every individual
  label passes AA (7.9–8.5:1); *which pill is on* does not. It is NAT-008's shared `.FilterPill`,
  so the **people directory has the same invisible selection**. ✅ Cheapest real fix: move the
  state onto the **border**, the one edge already at 3.57:1. ⚠️ Measure in **both** themes.
- ⚠️ Two small things FB-021 leaves undriven: the gated block is no longer given `canRedirect`, and
  the **mixed-group** case. Every group on a `Group` node was homogeneous.
- ⚠️ **The platform sends `firstReplyMinutes: null` on a thread with `replyCount: 1`**, so the
  accepted thread reads *"no reply yet"* everywhere, web included. It is **FIX-025 §7's second
  cause**. 🔴 Do not patch `replyLatency` without deciding the other half — the tab's count is
  wrong by the same data, and fixing only the row leaves the two disagreeing on screen.
- ⚠️ **`MIRROR_THREAD_WINDOW = 100` is a copy of the platform's limit and nothing checks it.**
- ⚠️ `.property-port-gate-target`'s outline and `.Bench`'s gutter are unmeasured in pixels.
- ⚠️ **Only `Group` was driven** for FB-021; the other 174 types are covered by the catalog sweep,
  which grades *sentences*, not rendering.
- ⚠️ FB-022's crosshair settled by mechanism, not pixels; **one commit in three dropped focus,
  uncharacterised**; FB-016's auto-margin branch never exercised in a running app.
- ⚠️ **`AskAboutNodeDialog.module.scss` uncommitted — sixteenth session.** Belongs to no session;
  Richard's call. Same for the phase-70/71/72 working files and the phase-50/68 notes.
- The highlighter's disposal bug: a **selected** node whose element has gone is never removed from
  `selectedNodes`, so it is revisited and `remove()`d every frame.
- Unchased: `SidebarModel.switch('PortEditor')` crashes the panel; Settings clips two rows; a
  `Number` node draws a group literally called `ADVANCED` beside the synthetic `Advanced CSS`;
  `getConnectionSourceLabel` returns nothing for the checkbox row; `check:css` in `nodegx-community`
  has one pre-existing non-ours violation.
- ⚠️ **Pre-existing, not ours**: the projects page logs `Encountered two children with the same key`
  for one project id, and `feed.json` 404s.
- ⚠️ **A wire warning is silent for two seconds after you draw it.** `EVALUATE_HEALTH_DEBOUNCE_MS`
  is 2000 and the urgent lane is 50; `con-type-unconverted` is deliberately on the lazy one.
- ⚠️ **A tooltip has no `max-width`,** so a long health message draws a very wide box — 1074 px in a
  1368 px window. `.popup-layer-tooltip-content p` caps at 268 px; bare inline markup is capped by
  nothing.
