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
3. ✅ **Ruled 2026-08-22 — rewritten to the ruling.** Going from the rail panel to the launcher
   home **closes the project, says so before it does, and puts you back where you were when you
   reopen.** The control names the consequence (not "Community" alone), and reopening the project
   restores the component you had open. 🔴 The old wording — *"does not lose your project or your
   place"* — was written before anybody read `router.tsx:154–210` and asked for a persistence the
   router does not offer; it is kept here only so the change is legible.
4. `AskAboutNodeDialog` no longer ends at a browser: asking opens the thread in the editor.
5. **D6 is answered and visible.** Orgs, assignments and shelf items either have editor surfaces or
   have honest hand-offs — never a dead end and never a silent jump to Chrome.
6. D15 holds across the whole navigation graph: there is **no path** by which a refused viewer
   reaches a drawn community surface. This is a reachability claim over routes, so it is derived
   from the code and **driven**, not asserted from a component test.
7. 🔴 **The rail icon is not drawn for a viewer D15 refused.** `SidebarModel.instance.register` at
   [`router.setup.ts:262`](../../../packages/noodl-editor/src/editor/src/router.setup.ts) is
   synchronous at setup with no async predicate, so today every account gets a Community door —
   including the org-minor whose school switched the community off, who then finds a blank panel
   behind it. D15 says the surface is **ABSENT**, web *and* editor. Registration therefore has to
   learn a viewer, which means either a late/async registration or an unregister on viewer
   resolution — 🔴 **and whichever it is, drive it with a refused account and a permitted control
   beside it.** The two states must *disagree*; a spec where both draw nothing proves nothing.

## Traps

- 🔴 **A route is outside every sweep.** P67 learned this the expensive way: ruling that a place
  behaves does not check that it does, and a route-shaped surface is invisible to component specs.
  Derive the surface list **from disk** and drive it.
- 🔴 **The icon fix is a registration-order change, and the rail is not the only thing that reads
  it.** AC7 moved here from phase 67b on 2026-08-19; it was previously ruled out-of-scope for this
  task, and the reason it now belongs is that navigation cannot claim D15 reachability while the
  entry point itself ignores it. ⚠️ But `SidebarModel.register` is called at setup for **every**
  panel — making one registration conditional or late is a change to shared editor bootstrap, not
  a community change. Check what else depends on registration order and panel ids existing by the
  time the rail draws.
- ⚠️ **The tab ships even when empty** (D21 reversed D16). Navigation must not reintroduce a
  gate — no "unlock the community when…", no hidden nav entries pending a threshold.
- ⚠️ **Conditional UI in this editor goes through `mounted`, not `visible`** — a navigation model
  that hides panels by CSS keeps them alive, and a `BaseDialog` renders twice. Any spec counting
  what is on screen has to know both.
