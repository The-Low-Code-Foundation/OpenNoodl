# NAT-012 — The door, not the exit

| Field | Value |
|---|---|
| **Tier** | 4 |
| **Effort** | M |
| **Surface** | `editor`, `core-ui` |
| **Rulings** | ✅ **D6 SETTLED 2026-08-22** (launcher home, editor door) · ✅ **AC3 SETTLED 2026-08-22** — accept the close, label it, restore the component · inherits **D15**, **D21** |
| **Depends on** | **NAT-007** through **NAT-011** — this is the task that makes them one place |

## State, 2026-08-22 — D6 ruled, the launcher half shipped, AC4 built

**FB-006 did the launcher half of this tranche** (`5d31a567`): the community page is the web's
tabs — Bench · Tutorials · Replays · People — one section at a time. This task still owns the
navigation model and the editor's narrowing. ✅ **AC4 is done**; the rest is below, with what
reading the code changed about it.

### ✅ AC4 — asking about a node ends in the editor

`AskAboutNodeDialog` posted a question and then said *"Answers will appear on the Bench."* — a
sentence with nowhere to click, at the end of the one project-relevant verb D6 leaves in the
editor. It now offers **Open the thread**, which opens it in the rail panel and closes the dialog
behind itself.

- New seam: `utils/community/communityThreadRequest.ts`, modelled on `provenanceRequest` —
  **stash, emit, switch**. 🔴 An emit alone loses the *first* request of a session, because
  `SidePanel` does not construct a panel until the rail first switches to it, and this request is
  the most exposed shape of that bug rather than the least: the dialog is reached from a canvas
  right-click, so somebody asking their first question has by construction never opened the
  Community panel.
- `useCommunityThread` both **listens and claims the stash** — different cases, both needed — so
  the launcher tab honours a request too.
- 9 specs in `tests-unit/nat-012/community-thread-request.test.ts`, including the both-ends check
  (a request nobody claims is a dead end with extra steps).
- ⚠️ **UNDRIVEN, and the reason is not laziness**: watching this work end to end means **posting a
  real question to the live Bench** from a signed-in editor. That is Richard's call, not a side
  effect of a drive. The panel side of the path (a thread opening in place in the rail) was driven
  by NAT-007.

### ✅ AC3 is a ROUTER task, and the task file did not know that — ruled 2026-08-22

*"Going from the rail panel to the launcher home does not lose your project or your place."*
Read `router.tsx:154–210`: the editor and the launcher are **two routes in one window**, and
routing to `'projects'` **disposes the ProjectModel** — `disposed.dispose()`, then
`ProjectModel.instance = undefined` on the next tick. The only caller is `exitEditor`
(`EditorPage.tsx:178`), which also broadcasts `project-closed` and closes the viewer window.

So there is no "go to the launcher and come back" today; there is only **close the project**.
AC3 as written cannot be met by anything in the community code, and the two honest routes are:

1. **Teach the router to keep a project across a `'projects'` route** — a "keep" flag on the
   dispose branch plus a reopen on return. ⚠️ That dispose block already carries a fixed
   white-screen bug (a project → project route nulling the project that had just loaded); it is
   the most dangerous twenty lines in the file to touch.
2. **Accept that the door closes the project** — Richard's framing tolerates it (*"even if it
   means leaving your project to go look at the launcher main community page"*) — and pay the
   cost in honesty instead: the control says what it does, and reopening restores the component
   you were on.

✅ **RULED 2026-08-22: (2) — accept the close, and pay for it in honesty.** Richard took the
option that leaves `router.tsx`'s dispose branch alone; his framing already tolerated leaving the
project, and (1) would have put a keep-flag through the twenty lines that previously produced the
white-screen bug. So AC3 is met by **the control saying what it does** and **reopening putting you
back on the component you were on** — not by keeping the project alive across the route.

### 🔴 DRIVEN 2026-08-22 — AC3 passes, and half the code written for it was DEAD

The drive (fixture `nat012-drive`, two components) confirmed the door end to end: the label reads
*"Community home — closes your project"*, `ProjectModel.instance` goes **`undefined`**, the
launcher lands on **Community**, and reopening puts the canvas back on `/Probe`. The control that
makes the landing mean anything is the ordinary exit — *"Back to projects"* closes the project too
and lands on **Projects**.

🔴 **But the restore was not this task's.** The reopen-restores-your-component row passed with the
mechanism starved, so it was mutated three ways:

| Arm | What was changed | Canvas on reopen |
|---|---|---|
| baseline | nothing | `/Probe` |
| steal the stash | `takeEditorPlace(id)` called from the launcher (returned `"/Probe"`) | **`/Probe` anyway** |
| starve the other candidate | `selectedComponentName` cleared, stash left intact | **`/App`** |

Instrumenting `switchToComponent` named the winner. **Two calls on every open, in this order:**

1. `restoreEditorPlace` (`leaveForLauncher.ts` ← `NodeGraphContext.tsx`) → the stashed name
2. **`useSwitchToDefaultComponent` (`UseSetupNodeGraph.ts:26`) → the default, unconditionally**
3. (normally) `EditorDocument.tsx:432` → `selectedComponentName`, `replaceHistory: true`

So (1) was **always** overwritten by (2), and the restore AC3 promises is (3) — which predates
NAT-012, is keyed by the same `ProjectModel.id`, resolves by the same `getComponentWithName`,
applies the same `replaceHistory: true`, and is **persisted to `editorSettings.json`**, so it
survives an editor restart and covers *every* exit route rather than this one door.

✅ **`rememberEditorPlace` / `takeEditorPlace` / `restoreEditorPlace` are therefore deleted**, with
the reasoning kept in `launcherHandoff.ts`. The landing half stays — it is the only fact nothing
else knows, and the ordinary-exit control proves it load-bearing.

🔴 **The spec could not have caught this**, and that is the lesson worth carrying: it asserted the
*source text* `restoreEditorPlace(currentInstance);` was present. It was, and it meant nothing.
Its replacement asserts the door does **not** grow a second copy back, and pins `EditorDocument`
as the mechanism — both with mutation arms, and both beside a known-firing arm, because they read
files the old arm did not cover.

⚠️ **Still unpaid: AC4's other half** — posting a real question to the live Bench from a signed-in
editor. Richard's call, deliberately undriven.

⚠️ **AC3's wording therefore no longer describes what is built.** "Does not lose your project"
is false by ruling; "does not lose your place" is what survives, and it is now a *restore*
obligation rather than a *persistence* one. The criterion is rewritten below to match the ruling
rather than left as a bar nothing will clear.

### AC2 — the `openExternal` audit, taken 2026-08-22

26 live call sites across `noodl-editor/src/editor` and `noodl-core-ui/src` (comments excluded).
They fall into three groups, and only the third is this task's:

| Group | Sites | Verdict |
|---|---|---|
| **The editor genuinely cannot host it** | GitHub device flow (`GitHubOAuthService:218`, `github/GitHubAuth:81`), community device sign-in (`communitysignin:141` via an injected dep, called from `useCommunityAccount:99` and `AskAboutNodeDialog:373`), external docs (`AiSettingsSection:441,491`, `NodeLabel:225,236`, `McpSettingsSection:126`, `KitsSection:252`, `NodePickerPreview:123`), GitHub repo links (`VersionControlPanel:172`, `RepositorySection:96`), issue reports (`ReportProblemDialog:146`), release notes (`UpdateDialog:108`), the `?` menu and the launcher footer | **Keep.** A browser is the correct answer; every one is on a control that says where it goes |
| **Generic link plumbing** | `ExternalLink`, `PrimaryButton:112` / `TextButton:65` `href`, `AiMarkdown:52`, `ExplanationView:75`, and the two post-link handlers `useCommunityThread:329` / `useCommunityPeople:230` | **Keep.** A link inside a stranger's post must open in a browser — that is the sandbox, not a hand-off |
| 🔴 **D6 casualties** | `CommunityPanel:92` (`openCommunity`) behind the article rows, the replay rows and the "Open community.nodegx.io" button; `ProjectsPage:1365–1367` (the launcher tab's article, replay and open-community handlers) | **This task's decision.** In the editor the rows go away with the sections (below). In the launcher they are the D6 long tail and survive — but AC2 says `openExternal` lives on *an explicitly labelled "opens in your browser" control*, and **a row that silently jumps to Chrome is not one** |

### What the editor's narrowing removes, when it is built

`CommunityPanel.tsx` today draws: viewer + refresh · Discussions · People · installable Tutorials
(TUT-004) · Guides and tutorials · Call replays · the health readout · the browser button. D6
leaves the door: **Discussions** (the questions you asked and answered), the **thread pane** and
the **profile pane** that opens from a post's author line. ⚠️ Three things need saying out loud
before that diff is written:

- Removing **People** revises NAT-008 AC1's rail half; removing **Guides/Replays** revises
  NAT-005's panel. Name them, as FB-006 named NAT-005's page.
- 🔴 **TUT-004's installable Tutorials section is NOT community content** — it writes a lesson
  into your project, which is as project-relevant as anything in the rail. It stays, and TUT-004's
  AC1 ("above Guides and tutorials") loses the section it was positioned against.
- The health readout is a **community** number, not a project one: it goes to the launcher, where
  FB-006 already draws it.

## The job

By the time Tier 3 lands there are six community surfaces in the editor and no story about how you
move between them. Today's navigation is one tab, one rail icon, and `platform.openExternal`
everywhere else.

Decide and build the shape: **the launcher tab is the community's home** — where you browse people,
jobs, coaching, University and the full discussion list — and **the rail panel is the door from
inside a project**, showing what is relevant to what you are doing and opening the same views.

Richard's framing, which is the acceptance bar: *"whatever you do in the editor can be viewed and
solved in the editor, even if it means leaving your project to go look at the launcher main
community page."* Leaving your **project** for the launcher is fine. Leaving the **editor** is not.

## Acceptance criteria

1. One navigation model across both surfaces, with a real back/forward relationship. Opening a
   profile from a thread and returning to the thread works.
2. **`openExternal` survives on exactly one kind of affordance**: an explicitly labelled "opens in
   your browser" control, for the D6 long tail and for things the editor genuinely should not host
   (a video call, a payment). 🔴 An audit lists every remaining call site and the reason it is
   still there. A call site nobody can justify is deleted.
3. ✅ **Ruled 2026-08-22, DRIVEN 2026-08-22 — done.** Going from the rail panel to the launcher
   home **closes the project, says so before it does, and puts you back where you were when you
   reopen.** The control names the consequence (not "Community" alone), and reopening the project
   restores the component you had open. 🔴 The old wording — *"does not lose your project or your
   place"* — was written before anybody read `router.tsx:154–210` and asked for a persistence the
   router does not offer; it is kept here only so the change is legible. 🔴 **And the restore is
   `EditorDocument`'s, not this task's** — the drive above found the code written for it was
   overwritten on every open and deleted it.
4. `AskAboutNodeDialog` no longer ends at a browser: asking opens the thread in the editor.
5. **D6 is answered and visible.** Orgs, assignments and shelf items either have editor surfaces or
   have honest hand-offs — never a dead end and never a silent jump to Chrome.
6. D15 holds across the whole navigation graph: there is **no path** by which a refused viewer
   reaches a drawn community surface. This is a reachability claim over routes, so it is derived
   from the code and **driven**, not asserted from a component test.
7. ✅ **DONE 2026-08-23 — the rail icon is not drawn for a viewer D15 refused, and neither is
   the panel.** Built and driven; the two viewer states disagree on every row. What follows is
   what the work found, because the removal turned out to leak in **three** places, not one.

### ✅ AC7 — built and driven, 2026-08-23

**The shape of it.** Registration in `router.setup.ts` stays synchronous and unconditional (D21
ships the panel; making one entry in an eleven-panel list wait on a network read is a change to
everybody's boot). A gate then resolves the viewer and takes it back:

- `utils/community/communityRailGate.ts` — `resolveCommunityRail()` reads the session, asks
  `/api/v1/me`, and unregisters if D15 refuses. `installCommunityRailGate()` wraps it in an
  `onCommunityChanged('session')` subscription and is installed from `installSidePanel`, which
  **stops the previous gate first** — that function re-runs on every hot reload of `router.setup`.
- `mirrorview.ts` gained **`refusesCommunitySurface(me)`**, and `composeMirror` now calls it. 🔴
  One reading of D15, two consumers — the panel's contents and the panel's existence. That file's
  own header warns that two sources for one refusal is where a fix lands on only one of them, and
  a drift between these two is *precisely* a surface with no icon, or an icon with no surface.
- ⚠️ **Signed out is NOT refused, and that is the whole safety of it.** `/api/v1/me` answers
  **401 → `unauthenticated`** with no token, never `absent`, so a signed-out viewer keeps the
  panel D21 promised them. `refusesCommunitySurface` requires `ok` **and** `surface === 'absent'`.

**🔴 Only one direction is reachable, and there is deliberately no re-register.** Inside a mounted
editor the session can only go signed-out → signed-in: `signIntoCommunity` has an in-editor caller
(`AskAboutNodeDialog`), and `signOutOfCommunity` has exactly one caller anywhere —
`useCommunityAccount`, on the **launcher**, which AC3 established closes the project and unmounts
all of this. So the viewer can become refused while the editor is open and cannot become permitted
again. ⚠️ **If an in-editor sign-out is ever added this is wrong and it fails quietly**; the note
is in the module.

### 🔴 The removal leaked in THREE places, and only the first was predicted

The task file's measured table (2026-08-22) said the naive splice leaves the panel drawing. That
was right, and it was not the end of it.

| # | where | what it kept | how found |
|---|---|---|---|
| 1 | `SidebarModel.items` | the rail icon | predicted, measured 08-22 |
| 2 | `SidebarModel.panels[id]` + `activeId` | the **constructed, active panel** | predicted, measured 08-22 |
| 3 | 🔴 `SidePanel`'s own `panels` React state | the **mounted panel** | **found by DRIVING, 08-23** |

`SidebarModel.unregister` now does the first two (plus clearing `previousActiveId`, or
`hidePanels()` switches back into the hole through a different door). The third could not be
reached from the model at all: **`SidePanel` keeps its own copy**, added to on `activeChanged` and
never removed from, because until now nothing could be unregistered. `views/SidePanel/prunePanels.ts`
is the fix, called from an effect keyed on the registered ids.

🔴 **The third leak LOOKED correct, which is the dangerous part.** With the model unregistered the
mounted panel rendered *empty* — but only because `CommunityPanel` asks D15 itself and returns
`null`. The surface's absence was resting on the **second** reading of the refusal: change that
self-mask and a refused viewer gets the whole surface back with no icon on it, every rail-shaped
test still green. And it was not merely hypothetical — a mounted `CommunityPanel` keeps
`useCommunityMirror` polling `/me`, `/home` and `/threads` **once a minute**, for a viewer the
platform has said may not know the community exists.

### The drive, 2026-08-23 — `nat012-drive`, both viewer states

Signed in live as `@richardosborne14` (a real permitted account); the refused arm is the real gate
code fed D15's refusal on `/api/v1/me`, because no refused account exists to test with. **Only the
platform's answer was varied** — same editor, same session, same instrument.

| row | permitted | refused |
|---|---|---|
| `SidebarModel` registered | `true` | ✅ `false` |
| `getPanelComponent('community')` | `true` | ✅ `false` |
| `activeId` | `community` | ✅ `components` |
| rail icon `[data-test=community-panel]` | present | ✅ absent |
| `[data-panel-id=community]` **mounted** | present | ✅ **absent** |
| panel drawing | `true` | ✅ `false` |

🔴 **And the control that makes the table mean anything.** The naive splice (`items.splice` +
notify, nothing else) was run live against the same drawing panel:

| row | after naive splice |
|---|---|
| rail icon | **absent** ← a rail-only drive PASSES here |
| `getPanelComponent` | 🔴 `true` |
| `activeId` | 🔴 `community` |
| panel drawing | 🔴 **`true`** |

That reproduces the 08-22 table exactly, live, and proves the instrument can tell the two fixes
apart rather than passing on either.

⚠️ **Not driven**: the *install-time* refusal from a cold boot. The bootstrap path was exercised
with a permitted viewer (the panel correctly stayed) and `resolveCommunityRail()` — the exact
function bootstrap calls — was driven refused and permitted; persisting a fetch patch across a
reload is what was not done. The refused-at-install case is covered by spec.

### Specs — `tests-unit/nat-012/community-rail-gate.test.ts`, 21 rows

Mutation arms **measured, not estimated** (two of the first guesses were wrong, and one row was
vacuous on its first draft — both recorded in the file's header):

| mutation | reds |
|---|---|
| `unregister` a no-op | 9 |
| `unregister` reduced to the naive body | 5 |
| drop only `delete panels[id]` | 2 |
| drop only the switch-away | 2 |
| drop only the `previousActiveId` clear | 1 |
| 🔴 the gate unregisters **unconditionally** (both states agree) | 4 |
| `prunePanels` is the identity | 2 |
| `prunePanels` always returns a fresh object | 1 |

⚠️ **`uni-001`'s session-reader gate caught the new reader** and made it answer for itself before
the row was added — the gate works. The answer: this is the clearest case in that table of an
account making the editor do **less**, never more.

## Traps

- 🔴 **A route is outside every sweep.** P67 learned this the expensive way: ruling that a place
  behaves does not check that it does, and a route-shaped surface is invisible to component specs.
  Derive the surface list **from disk** and drive it.
- ✅ **The icon fix was NOT a registration-order change in the end** (2026-08-23). AC7 moved here
  from phase 67b on 2026-08-19; the trap warned that `SidebarModel.register` runs at setup for
  **every** panel, so making one registration conditional or late is a change to shared editor
  bootstrap. That warning is what chose the design: registration stays synchronous and
  unconditional for all eleven panels, and the viewer's refusal **unregisters afterwards**. Nothing
  waits on the network, and no other panel's boot moved. ⚠️ The cost is a visible window — a
  refused viewer sees the icon until `me()` answers — accepted rather than hidden, because the
  alternative leaks the whole rail's timing to the network. Driven: with the panel removed, the
  remaining 21 registrations and ordinary panel switching are unaffected.
- ⚠️ **The tab ships even when empty** (D21 reversed D16). Navigation must not reintroduce a
  gate — no "unlock the community when…", no hidden nav entries pending a threshold.
- 🔴 **Conditional UI in this editor goes through `mounted`, not `visible` — AND THIS TRAP FIRED,
  2026-08-23.** It is the third leak in the AC7 table above: `SidePanel` renders every panel it has
  ever opened and hides the inactive ones with `display: none`, so unregistering a panel in the
  model left it **mounted and polling**. ⚠️ It also nearly hid itself, because the mounted panel
  rendered *empty* — a reading of "is anything drawn?" said yes-it-is-gone while the component was
  alive. **Read `[data-panel-id]`, not innerText**: an empty panel and an absent one look identical
  from the text, and they are opposite answers. A `BaseDialog` still renders twice.
