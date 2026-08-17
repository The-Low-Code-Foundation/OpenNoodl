# Phase 69 — next session

**Written 2026-08-17, session 20.** 🔴 **This file is a REWRITE, not an amendment.** It is
overwritten every session; if you find yourself prepending, rewrite it instead. Everything that
outlives the phase goes to memory, not here.

Read [TASKS.md](TASKS.md) and [RULINGS.md](RULINGS.md) first. **s20 fixed and drove the frozen kit
definition** — s19's biggest finding. The fix is smaller than the reasoning behind it, and the
reasoning is the part worth reading: §1.

---

## 0. Where the phase is

| Task | Built | Driven | Note |
|---|---|---|---|
| **CN-001** … **CN-006**, **CN-018**, **CN-019** | ✅ | ✅ | Closed sessions 4–15 |
| **CN-007** | ✅ s14 | ✅ s15 | AC1/3/4/5 met; **AC2 still not started** |
| **CN-008** | ✅ s16 | ⚠️ **AC1 needs a live model** | §4 |
| **CN-009** | ✅ s17 | ⚠️ **AC5's consequence needs a live model** | §4 |
| **CN-010** | ✅ s18 | ✅ AC1 s19 | **AC4 not started** |
| **CN-014** | ✅ **AC1's library half, s20** | ✅ **s20** | §1. AC1's 2nd clause + AC2/AC3 open |
| CN-006b, CN-011 … CN-017 | 📋 | — | §3 |

🔴 **The drive debt is still exactly one item: CN-008 AC1 + CN-009 AC5 are one drive, not two.**
Both want a live model authoring in a project that has a kit. ⚠️ **Read §4 before attempting it** —
there is a stale-build trap that would make the whole run grade the wrong code.

**Nothing is blocked on a decision.** The owed list is §5 and it got *shorter* this session.

## 1. What s20 did, and the one lesson worth carrying

**s19's finding — a kit node's definition is frozen after first delivery — was CN-014 AC1 verbatim.**
Not a new task. AC1 reads *"Rename a port in a kit; without restarting the editor, the property panel
shows the new name"*, and s19's other half (a new node appears) is **AC2**. Two sessions had already
done CN-014's mandatory measure-first pass without the task being open. ⚠️ **Before proposing a new
task for a finding, grep the phase's task files for the behaviour** — the finding arrives phrased in
the language of the drive that produced it, not of the task that owns it.

**Two causes, both in `NodeLibraryImporter`:** `mergeUpdates`' known-name branch carried
`// TODO: Update the node data?` and discarded the new definition; and `mergeInByName` **did**
replace the picker-index entry but never set `updated`, so nothing was published and
`NodeLibrary.instance.reload()` never ran.

### 🔴 The lesson: the obvious fix would have silently corrupted 84 built-ins

An unconditional replace looks right and passes any hand-written fixture. But the generated cloud
library merges once per session, shares **all 84** of its type names with the browser library, and
**all 84 definitions differ** — so it would capture `Expression`, `REST2`, `Model2` and 81 others and
invert a precedence that has always been first-writer-wins.

**Three candidate keys, two of them wrong in opposite directions:**

| key | why it fails |
|---|---|
| `runtimeTypes` contains the runtime | it is a **union**; after the cloud merge both runtimes are in it for those 84 ⇒ cloud captures them |
| `runtimeTypes.length === 1` ("sole owner") | the mirror failure — silently **stops refreshing exactly those 84** |
| `clientId` | an ordinary viewer mints a fresh `guid()` **per socket open** (`editorconnection.ts:194`); only a sandbox passes a fixed one ⇒ **never fires** |

✅ **The answer is a separate `dataOwner: Map<name, RuntimeType>`** — *whose report is this data?*,
which is a strictly different question from *where can this node run?*. **All three were measured
before anything was written**; the `clientId` one cost a single grep and would otherwise have cost a
whole build.

✅ **8 tests, 5/5 mutations killed.** `test:main` **3,601 / 234 suites**, `typecheck:editor` **0**.
🔴 **The precedence control asserts the two real payloads DISAGREE before asserting the browser's
survived** — overlap alone would have made it vacuous. That is the third time this phase a control
could not have failed; this one was built from the two payloads on disk for exactly that reason.

### 🚗 Driven, and the panel is a second surface

Observations written before launch: [notes/cn-014-ac1-drive.md](notes/cn-014-ac1-drive.md). One
write renamed a port **and** added a node; one viewer reload took the library **177 → 178 *and*
`Title` → `Panel Heading`** — the combination that was impossible before.

⚠️ **Residual: an open property panel does not re-render on `libraryUpdated`.** It showed the old
label through **six polls over 30 s untouched**, then updated on one re-selection — so the variable
is the selection change, not elapsed time. **Severity far below the bug behind it** (click any other
node and back; authoring does that constantly, whereas the frozen definition needed a restart *and*
mislabelled itself as "dynamic ports don't work"). **Wants a small follow-up, not a reopening.**

⚠️ **AC1's second clause — a connected port that disappears from a kit — is UNMEASURED, not working.**

## 2. Instrument notes from s20's drive, all reusable

- ⚠️ **`window.__req` is not present in this build.** Reconstruct it:
  `window.webpackChunknoodl_editor.push([['probe'], {}, r => { window.__req = r; }])` → 2,466 modules.
- ⚠️ **`selectNode` is on the NodeGraph, not on `ng.selector`** — `selector` exposes only
  `select` / `unselect` / `unselectNode` / `isActive`. Reach it via
  `NodeGraphContextTmp.nodeGraph` (`contexts/NodeGraphContext/NodeGraphContext.tsx`);
  `ng.getSelectedNodes()` is the read.
- ⚠️ **The editor opens in preview mode.** The node canvas needs the `ModeSegmentedButton` toggle
  before any property panel exists to measure at all.
- ⚠️ Property-panel labels are `[class*=PropertyPanelInput-module__Label]`.
- ✅ **Opening a project by path**: `LocalProjectsModel.instance.openProjectFromFolder(path)` puts it
  in the recent list; then click its `LauncherProjectCard` — but **`scrollIntoView` first**, the card
  was at y=4339 and a trusted click needs it in the viewport.

## 3. Picking the next build

**CN-006b (the kits surface)** is still the one with the most behind it and no measurement debt — its
prerequisite (CN-018's provenance) is done, s19 read the property panels side by side and found no
difference attributable to kit-ness, and s20 has now made the surface it lists actually refresh.

⚠️ **Confirm rather than inherit — five sessions running now.** CN-008's two clauses, CN-009's
`find_tools` clause, CN-010's AC3 and AC1, and this session's: the handover called the frozen
definition *"small, well-located"* and *outside* CN-010's scope. It was neither — it was another
task's acceptance criterion, and the file carried a comment declaring the broken behaviour
deliberate. **Run the thing the task describes, over real data, and count what comes back.**

## 4. ⚠️ Before attempting CN-008 AC1 / CN-009 AC5

🔴 **A registered MCP server loads `/Applications/…`, not this checkout.** Driving the live `nodegx-*`
tools would grade the **old build**, so s18's and s17's work would not be under test at all. The
recorded route is to **spawn the bundle directly over stdio** — build to a *scratch* path with
esbuild (never over `packages/noodl-mcp/dist/`, which is what peers' registered servers load), pass
`--all-tools`, and read `inputSchema` from `tools/list` before calling.

⚠️ **Both criteria are about a *consequence*, and both say so.** CN-008 AC1: the graph the model
produces uses `Cashflow Lane` + `Money Pill` rather than a hand-rolled `Group` — *"the handout
appears in the prompt" is the mechanism and would be equally true of a broken feature*. CN-009 AC5:
an agent **places** a kit node it was not told about.

## 5. Owed by Richard

1. ✅ **RESOLVED, no longer owed** — s19's *"new task or fold into CN-014?"* is answered by evidence:
   it **was** CN-014 AC1, and it is done.
2. 🆕 **The open-panel refresh (§1).** Fold into CN-014's remaining scope, or leave as a known rough
   edge? It is genuinely minor and self-recovering.
3. 🆕 **What should `channelPort` do?** Unchanged from s19. **(a)** revive the editor-side manager;
   **(b)** have the exporter stop stripping the port; **(c)** reject it at kit-load with a
   diagnostic. ⚠️ **Doing nothing is the current state and it is the worst of the three** — the author
   gets no port and no message.
4. **Widen the project gate to check parameter values?** `checkParameterValues` has one production
   caller, so `validate:project` / `validate_project` check parameter values for **no node of any
   provenance**. `cn004.test.ts`'s last block asserts the silence deliberately — **replace it when
   the call is taken, do not delete it.**
5. **The ungated typechecks.** `packages/noodl-mcp`'s `tsc --noEmit` was red (8, s18) and runs in no
   CI job; seven of eleven `typecheck:*` scripts run nowhere, and `scripts/` is in none.
   ⚠️ `typecheck:runtime` red at 2, pre-existing. ⚠️ `typecheck:core-ui` reports **44 `TS2307`s**.
   ✅ `typecheck:editor` is **0** (measured s20).
6. **Should `project`'s `find_tools` purpose line name kits?** Costs resident tokens.
   `tests/kitTools.test.ts` has the control that fails when it changes. Narrowed by s17, unanswered.
7. **"Clean" is no longer "an empty diagnostics array" for any page** (s18's AC2). `Page` declares
   neither `title` nor `urlPath` statically, so **96 of 947 measured skips are `Page`**. `warnings`
   stays **0** and nothing blocks; same trade CN-002 made and you ruled for.

Open, not caused here, still wanting task numbers: 🔴 `render-from-disk.js` answers `/` and
`/index.html` and 404s everything else, **including the start page's own `urlPath`** · 🔴 the
`@noodl/mcp` provisioning flake (`provision.test.ts` red in a full run, green in isolation) · 🔴
`ViewerConnection.sendRefresh()` dead at both ends · ⚠️ `NodeLibraryDataNodeType` declares **seven**
fields and **neither `ports` nor `dynamicports`** (found s20; the CN-014 fix is field-agnostic by
construction, so nothing depends on widening it — but the next consumer that reads a declared field
off it will get the CN-010 `dp.note` treatment).

## 6. ⚠️ Carried, unresolved

🔴 **The cashflow kit is OUTSIDE the repo and only ONE copy is tokenised.** It lives in
`NodeGX test projects/cashflow-command-centre` — unversioned, covered by no gate — while
`cn001-kit-drive` and `cn019-drive` still carry the pre-D8 kit (0 × `var(--`, 6 × live `#1F8A4C`).
**Driving the wrong copy reads as "the change did not land".** D5 makes CN-007 depend on this kit
staying working and nothing enforces it. **Still wants a task number.** ⚠️ Read it via a `cp -R` into
a scratchpad; never write to it.

⚠️ **The token vocabulary gap (s14):** the semantic set has `--destructive` but **no `--success` and
no `--warning`**, so any kit with three status bands reaches into the palette scale for two of them.

⚠️ **Free and still unchecked:** whether the editor's colour picker paints a swatch for a `color`
port whose value is a `var(--token)` string. One eval with a project open.

⚠️ **From s13, still free:** `CodeFileDocument` renders **two toolbars** — its own `css.Topbar` above
`JavaScriptEditor`'s, with two separate Save buttons (`notes/cn019-driven.png`).

⚠️ **From s18:** `find_tools`' `query` matches tool *names* only while its `describe` text says
"names and descriptions" (noticed s17, still untouched — changing it costs resident tokens).

## 7. Checkout conditions

- 🔴 **An editor stack WAS launched and HAS been torn down.** `dev:debug --quiet` on 9222. Before
  launch: `dev:stop --list` clean, no `scripts/start.ts` running, **paired with a positive control
  matching 26 Electrons** so the zeros were attributable. `npm run dev:stop` reported **26 processes
  stopped**, and **45 peer MCP servers survived** — `NEVER_SWEEP` working as documented.
  **Nothing of mine is running.**
- ⚠️ **ONE repo source file was edited**: `NodeLibraryImporter.ts`. There was therefore a `test:ci`
  contamination window. `ListAgents` showed 22 peer sessions but **all started 1–3 days ago**, so no
  broadcast was sent; `test:main` (plain Node, safe beside a live stack) was used rather than
  `test:ci`. ⚠️ **If you are mid-`test:ci` and it went red in this file, that is why — re-run.**
- ✅ **The fixture is untouched**: the drive ran on a `cp -R` copy in the session scratchpad, and
  `git status packages/noodl-mcp/tests/fixtures/kit-dynports` was clean at the end.
- 🔴 **`test:ci` still stands where s12 left it** (`2843 / 6 @ 39393`); s13–s20's commits are not in
  it. **Re-measure before quoting.** Do not inherit s18's `noodl-mcp` numbers either.
- ⚠️ **Peer work live in the tree and not touched**: `dev-docs/tasks/phase-50-*`, `phase-65-*`,
  `phase-66-*` (a new `FIX-013` file appeared mid-session), `phase-68-*`,
  `packages/noodl-editor/src/.../AiAssistant/authoring/sandboxData.ts`,
  `packages/noodl-runtime/src/sandbox/*`, `scripts/library/check.ts`.
- Whoever you tell you are starting, tell you have stopped.
