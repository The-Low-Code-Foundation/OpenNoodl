# Phase 75 — next session

**State as of 2026-08-25 (session 33).** Richard's brief is still **speed: keep knocking out phase
75**, so this file leads with the queue. Take the top unblocked item; dip into the rest when it bites.

**Committed this session:** `6eaa6655` FB-002 (driven, both surfaces) · `cd6a7a86` FB-021 canvas +
scope 2 (canvas half driven).

⚠️ **Peers.** `3878` is **opennoodl-78**, this checkout. Other names are other projects.
🔴 **`SendMessage` to a cross-session peer needs the `[ref]`** — the bare name is rejected with the
ref in the error, so just re-send.

## The queue — unblocked, cheapest-first. Take the top one.

| # | item | size | state |
|---|---|---|---|
| 1 | **FB-021 scope 2 — the popup drive** | **XS** | ⬜ built + specced + committed; **never opened in a running editor** |
| 2 | **FIX-025 §5/§7/§12** (phase-74 dir) | **S/M** | **already built** — needs only the editor drive |
| 3 | **FIX-027 17, 19, 20** (phase-74 dir) | **S/M** | ⬜ unblocked, no ruling needed |
| 4 | **FB-014** search that survives renames | **M** | design + prototype only, pgvector |
| 5 | **FB-005** templates | **S then L+** | **scope doc first** — that doc is the unblocked part |
| 6 | **FB-013** chat | **L** | 🔴 **ruled 08-22: OVERRULED, build it.** Pulls in FB-014's 2nd corpus |

**Blocked on Richard, do not start:** FB-012 and FB-009 (both need *content*), FB-017 scope 2's
`Source Set`, FIX-026 (a)/(b), FIX-027 14/15/16 + 22, tsfixme baseline, prod `ANTHROPIC_API_KEY`
(⚠️ **intro pricing ends 2026-08-31 — six days**), the 15 lessons' prose, Discord's row in the `?`
menu, `/rfps` search.

✅ **Nothing is waiting to deploy.** ⚠️ The *stamp on the box* is still relayed from s19's SSH read —
re-read it before any deploy claim.

## Queue item 1 in full — what is actually left on FB-021

The canvas half is **done and driven in both directions** (table in the task file). What is left is
small and specific: **open the connection popup on a `Group` whose `Size Mode` is `Content Size`**
and confirm `width` is drawn inert, with the sentence, and *still listed* — Richard's *"mark, do not
hide"*.

🔴 **Two placements are the whole risk, and neither is covered by the copy specs:**
- the gate mark is applied **after** the `getConnectionStatus` loop (a gated port is normally
  *connectable*, so `p.disabled = !status.connectable` would wipe it);
- and **outside** the `if (sourcePort !== undefined)` guard (that loop only runs mid-drag, so
  opening the popup with no wire in flight would otherwise show the port as ordinary).

Both read correct and are exactly the shape that behaves wrong. ⚠️ Check **both** entry paths:
with a wire being dragged, and with none.

## ✅ The `test:ci` floor is re-measured, and the s32 debt is closed

`npm run test:ci` — **2849 specs / 4 failures**, all four `AIX-006 style vocabulary`, **matched by
name**. **Default ceiling, run alone on an idle machine, on committed code.** Completed 18:26.
⚠️ It grades the **FB-002** commit; the FB-021 edits landed after it and have **not** had a `test:ci`.

🔴 **Do not reach for `NOODL_TEST_TIMEOUT_MINUTES`.** s32 did and it was wrong. "Idle" is the
**pageout delta**, not swap-used — this session read **10 pages / 5 s** while swap still showed
11.7 G of 13.3 G used, and the run completed inside the default ceiling on the first attempt.

## 🔴 The trap that cost the most this session: THE PROBE WAS BROKEN, TWICE

Both times the false reading said *"the feature does not work"*, and both times it was believed for
minutes before being re-read with a different instrument.

1. **FB-002.** The two live threads are **indistinguishable by row text** — same title, and both
   render `no reply yet` because `firstReplyMinutes` is null on the accepted one too. So *"the pill
   flips and the row does not change"* looked exactly like a dead filter. ✅ Settled by reading the
   React **key**, which carries `thread.id`.
2. **FB-021.** `getWarningsForRef` returns a **wrapper**; `w.message || String(w)` rendered both an
   absence and a present warning as `[object Object]`, and "tightening" the reader to `.warning`
   then made a **real** warning read as `null`. ✅ `getAllWarningsForComponent` showed it plainly.

✅ **The rule: prefer the ENUMERATING reader over the MATCHING one.** A matching reader cannot say
*why* it matched nothing — refused and never-asked look identical. And check that a probe can tell
the two answers apart **before** trusting either.

## 🔴 A bounded query reports its bound — one letter cost an M

Session 31 recorded *"nothing re-evaluates connection health when a parameter changes"* and scoped a
new trigger with a hot-path guard. **The trigger already existed.** The grep was `parameterChanged`;
the event is **`parametersChanged`**.

```
setParameter → notifyListeners('parametersChanged') → shared/model.js:76 broadcasts
'Model.' + event globally → NodeGraphModel.bindModels → scheduleUpdateTypes → updateTypes
→ scheduleEvaluateHealth (2 s)
```

✅ **`model.js:76` broadcasts EVERY model event as `Model.<event>`.** If a model notifies it, the
dispatcher has it — worth knowing before scoping any "nothing listens for X" work.

## Other traps worth keeping

- 🔴 **A green suite is not a working feature, and a passing spec is not a spec that tested
  anything.** ✅ Drive it, then read the diff back. **A mutant that kills nothing is the finding.**
- 🔴 **Completion is the summary line, never an exit code.** Two notifications this session said
  *"exit code 0"*: one over a 7-byte `EXIT=1` log with no summary (measured nothing), one over a
  real `4 failures` run. **Sixth session.** ✅ Poll with `until grep -qE "Jasmine: [0-9]+ specs"`
  that also breaks on the pid dying.
- 🔴 **Resolve a token before believing a sentence about colour**; `--theme-color-notice` **aliases**
  `--theme-color-warning` in both themes.
- 🔴 **Compare failures BY NAME, never by count**, and never quote a floor without re-measuring.
- 🔴 `grep` for anything themed or bundled hits **`index.bundle.js`** — scope to `src/**` or the
  answer is a stale build. Cost a detour this session on `getConnectionHealth`.

## Driving — what worked, exactly

✅ **The full open-a-project sequence from the renderer**, since no editor global exists and
`require()` fails on the webpack aliases:

```js
let wr; window.webpackChunknoodl_editor.push([['probe'+Date.now()],{},r=>wr=r]);   // module registry
// wr.c is the loaded-module cache — scan exports for what you need
LocalProjectsModel.instance.openProjectFromFolder(dir)   // registers it
  → loadProject(entry) → router.route({to:'editor', project})
```
The router is found by walking fibers from `#root` for `memoizedProps.route.router` — **3 nodes in**.
🔴 **`projectFromDirectory` alone does NOT open a project**: it builds a `ProjectModel` and nothing
routes. ✅ Clean up with `removeProject(id)` + delete the copy.

- ✅ **Drive a COPY.** Both drives did; both cleaned up; `dev:stop` reported **27 processes** and
  spared all **8** MCP helpers, twice.
- ✅ **A graph built programmatically is a fine fixture** — `NodeGraphNode.fromJSON` +
  `graph.addRoot` + `graph.addConnection`, then `setParameter` through the ordinary path.
  🔴 Build the wire **first**, then flip the control; constructing after the flip passes on a
  broken implementation.
- ⚠️ **The eval context persists variables** — a second `const bench = …` throws
  `Identifier already declared`. Wrap probes in an IIFE.
- ⚠️ `cdp click` takes a **selector only**; there is no `--text` flag, and passing one silently
  clicks the first match instead.

## Gates, this tree (OpenNoodl, `cline-dev`) — 🔴 re-measure, never quote

- `npm run test:ci`: **2849 / 4 — THE FLOOR**, all `AIX-006`, by name. Default ceiling, alone,
  committed code, 18:26. ⚠️ Predates the FB-021 commit.
- `npm run test:main`: **335 files / 5438 specs / 0 failures**, after FB-021.
- `npm run typecheck:editor`: **0 errors**, after FB-021.
- `npm run catalog:check`: clean, 175 node types. Cheapest freshness proof in the repo (4 s).
- 🔴 **`npm run typecheck:core-ui` is a PRE-EXISTING DIRTY GATE: 44 errors, none ours.**
- Not run, nothing touched them: `typecheck:viewer`, `noodl-runtime`, all of `nodegx-community`.

## Still open, owned by nobody

- 🔴 **FB-002's selected pill is 1.16:1 against the panel** — the active fill, and 1.24:1 between the
  active and inactive label, while the border is **identical** in both states. Every individual
  label passes AA (7.9–8.5:1); *which pill is on* does not. **Text contrast is not the same
  measurement as state visibility.** It is NAT-008's shared `.FilterPill`, so the **people directory
  has the same invisible selection**. ✅ Cheapest real fix: move the state onto the **border**, the
  one edge already at 3.57:1 — not a brighter fill. ⚠️ Must be measured in **both** themes.
- ⚠️ **The platform sends `firstReplyMinutes: null` on a thread with `replyCount: 1`**, so the
  accepted thread reads *"no reply yet"* on every surface, web included. Unowned.
- ⚠️ **`MIRROR_THREAD_WINDOW = 100` is a copy of the platform's limit and nothing checks it.** If the
  platform *lowers* its limit the bound line silently stops drawing while the list really is
  partial. Three lines in `nodegx-community`'s `mirror.ts` + `route.ts` to send the window it used.
- ⚠️ `.property-port-gate-target`'s outline and `.Bench`'s gutter are both unmeasured in pixels.
- ⚠️ **Only `Group` was driven** for FB-021; the other 174 types are covered by the catalog sweep,
  which grades *sentences*, not rendering.
- ⚠️ FB-022's crosshair settled by mechanism, not pixels; **one commit in three dropped focus,
  uncharacterised**; FB-016's auto-margin branch never exercised in a running app.
- ⚠️ **`AskAboutNodeDialog.module.scss` uncommitted — thirteenth session.** Belongs to no session;
  Richard's call. Same for the phase-70/71/72 working files and the phase-50/68 notes.
- The highlighter's disposal bug: a **selected** node whose element has gone is never removed from
  `selectedNodes`, so it is revisited and `remove()`d every frame.
- Unchased: `SidebarModel.switch('PortEditor')` crashes the panel; Settings clips two rows; a
  `Number` node draws a group literally called `ADVANCED` beside the synthetic `Advanced CSS`;
  `getConnectionSourceLabel` returns nothing for the checkbox row; `check:css` in `nodegx-community`
  has one pre-existing non-ours violation.
- ⚠️ **Pre-existing, not ours**: the projects page logs `Encountered two children with the same key`
  for one project id, and `feed.json` 404s.
