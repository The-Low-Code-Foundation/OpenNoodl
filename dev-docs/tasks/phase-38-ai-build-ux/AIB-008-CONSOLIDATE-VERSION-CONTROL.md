# AIB-008 — Consolidate version control and GitHub

| Field | Value |
|---|---|
| **Phase** | 38 — The AI Build Experience |
| **Priority** | 🟡 Medium |
| **Difficulty** | 🟡 Medium |
| **Recommended executor** | 🔵 Fable for the IA, 🟠 Opus to build |
| **Prerequisites** | none — independent of the rest of the phase |

## Objective

One panel for everything to do with the project's repository: local history, working changes,
branches, and the remote it pushes to.

## What happened

> *"I initialised the project as a github repo in my personal account, and that seems to work
> perfectly. But it makes me think that we should consolidate the version control and github
> panels."*

Note that this is the one report in the phase that starts with something **working**. It is a
proposal, not a defect, and the task should treat it that way: the GitHub integration earned its
place and this is about where it lives.

## Current state

Two sidebar panels over one git repository:

- `VersionControlPanel` (`versioncontrol`) — local history, changes, branches, merge
- `GitHubPanel` — remote, auth, repo creation, push

A user forming a mental model of "my project's version control" has to hold two icons and know which
question goes to which. There is no case where a user wants *only* the remote or *only* the local
half; a commit is followed by a push.

### ✅ Slice 1, done 2026-08-03 — and the line above is wrong about the GitHub panel

**`GitHubPanel` is an Issues and Pull Requests panel.** Remote, auth and repo creation are its
*empty state* (`ConnectToGitHubView`, reached only when there is no git, no remote, or a non-GitHub
remote). What it renders once connected is `SyncToolbar` + two tabs of `IssuesList` / `PRsList`, with
`IssueDetail` and `PRDetail` behind them — roughly 1,000 of its 1,900 lines.

That matters because **the proposed four-section shape has nowhere to put them**, and criterion 2
("every action available in either panel before is available after") cannot be met by
Repository/Changes/History/Branches alone. Resolved below.

**They do not share a git model — and the GitHub panel does not share one with itself.**

| | Git instance |
|---|---|
| `VersionControlPanel` | **one**, created in the panel, held in `VersionControlProvider` context |
| `GitHubPanel` | **seven** `new Git(…)` + `openRepository(…)` pairs across three files — one per operation in `useGitSyncStatus` (status, push, pull), one in `useGitHubRepository`, two in `ConnectToGitHubView` |

Slice 1 asks "whichever exists, the merged panel should have exactly one." The context one exists and
the merged panel adopts it.

**Four duplications, enumerated:**

| Duplicated | Version control | GitHub |
|---|---|---|
| **ahead / behind** | `fetch.localCommitCount` / `fetch.remoteCommitCount` (context) | `useGitSyncStatus`'s own `ahead` / `behind` |
| **push / pull** | `GitStatusButton` | `SyncToolbar` |
| **connect a remote** | `GitProviderPopout` → `CredentialsSection` | `ConnectToGitHubView` + `CreateRepoModal` / `SelectRepoModal` |
| **"is this a git project"** | `LocalProjectsModel.isGitProject` | `useGitHubRepository`'s `gitState` |

The ahead/behind row is the one criterion 3 asks to surface, and it is currently computed twice by
two different code paths — which is the product argument for the merge stated in mechanism rather
than in principle.

**Also found:** `GitHubPanel.tsx` logs on every mount and every render — `🔧 [GitHubPanel] useEffect
running`, `🎧 … Setting up useEventListener`, `🔔 … AUTH STATE CHANGED` — same family as
[AIB-009](AIB-009-FOUND-ALONG-THE-WAY.md) F6, and deleted with the shell.

### The shape that survives the audit

Sections top to bottom, under the `versioncontrol` id:

| Section | Contents | Comes from |
|---|---|---|
| **Repository** | remote, branch, **ahead/behind**, push/pull, connect-or-create when there is no remote | `GitStatusButton` + `BranchStatusButton` (kept) and `ConnectToGitHubView` (moved) |
| **Changes / History** | the existing two tabs | unchanged |
| **Issues & Pull Requests** | collapsed by default; rendered only when the remote is GitHub *and* the account is connected | `IssuesList` / `PRsList` (moved verbatim) |

`SyncToolbar` and `useGitSyncStatus` are **deleted**: every action they offer is already on
`GitStatusButton`, driven by the context's single `Git`. That is the whole of the duplication removal
— the rest is relocation.

Issues and PRs stay a *section* rather than becoming a fourth tab, but they are the one part of this
panel where the design position's argument ("tabs would hide exactly the state that matters most")
does not apply: they are not local-vs-remote state, they are a long scrolling list of somebody else's
work. Collapsed-by-default is the compromise — present, findable, and not occupying the panel a user
opened to commit.

## The design position

**One panel, sections within it — not tabs.** The relationship between local and remote is
continuous (*ahead by 3, behind by 1*), and tabs would hide exactly the state that matters most.

Proposed shape, top to bottom:

| Section | Contents |
|---|---|
| **Repository** | remote name, branch, ahead/behind, connect-or-create when there is no remote |
| **Changes** | working-tree changes, stage, commit |
| **History** | commits, with the local/remote boundary marked in the list |
| **Branches** | switch, create, merge |

The ahead/behind indicator in the header is the piece that only exists once the panels are one
thing, and it is the main product argument for doing this at all.

## Scope

### Slice 1 — audit before merging

Both panels' full surface, listed: every action, every state, every error path. Two panels built at
different times over the same repo will have duplicated logic — status polling, refresh triggers,
error presentation — and merging without the audit produces one panel with two of everything.

Check specifically whether they share a git model or each hold their own. Whichever exists, the
merged panel should have exactly one.

### Slice 2 — the merged panel

Build it under the version-control id so existing layout persistence survives. Keep the GitHub
panel's code where it is useful as a section component; delete what duplicates.

### Slice 3 — the no-remote path

The single highest-value flow, because it is what Richard did and it worked: a local project gains a
GitHub remote in a few clicks. In the merged panel this becomes a `Repository` section that reads
*"No remote — Connect to GitHub"* rather than an entire separate panel the user has to know to look
in.

### Slice 4 — the rail

Removing an icon from the sidebar rail changes muscle memory for existing users. Alpha is the right
time for that. Confirm the icon that survives reads as *version control*, not as *GitHub* — the
panel must not look like it requires a GitHub account, because it does not.

## Acceptance criteria

1. One panel; the GitHub entry is gone from the rail.
2. Every action available in either panel before is available after — enumerated against slice 1's
   audit, not assessed by eye.
3. Ahead/behind is visible without changing section.
4. A project with no remote can be connected to GitHub from the same panel that shows its history.
5. A project with no git repository at all shows an honest empty state with one action.
6. Existing saved sidebar layouts do not break.
7. **Live**: init a local project, commit, connect a remote, push — all from the one panel.

## Traps

- **A `dugite` artefact hides the editor gate** (AIX-010) — git-touching changes can green a suite
  that never ran. Check the `Jasmine:` line.
- The panel is hidden-not-unmounted, so a merged panel polling git status must not poll while hidden
  and must refresh on becoming visible — the stale-hidden-panel class from WFA-002.
- OAuth scheme stays `noodl://` (REV-007) even though the product is NodeGX. Do not "fix" it.
- Per the launcher screenshot, GitHub repo probing already logs a 404 per repo on launch. Not this
  task's defect, but it is in the same subsystem — see [AIB-009](AIB-009-FOUND-ALONG-THE-WAY.md).

---

## ✅ What was built (2026-08-03)

All four slices. Criteria 1–6 met; criterion 7 (the live init → commit → connect → push) owed.

`GitHubPanel/` is deleted. Its contents moved into `VersionControlPanel/`:

| Was | Is |
|---|---|
| `GitHubPanel.tsx` + `.module.scss` | deleted — it was a shell around six early returns |
| `components/SyncToolbar/` | **deleted**; every action it offered is on `GitStatusButton` |
| `hooks/useGitSyncStatus.ts` | **deleted**; ahead/behind comes from the panel's one context |
| `components/ConnectToGitHub/` | `VersionControlPanel/components/github/ConnectToGitHub/` |
| `components/IssuesTab/`, `PullRequestsTab/` | `VersionControlPanel/components/github/` |
| `hooks/useGitHubRepository.ts`, `useIssues.ts`, `usePullRequests.ts` | `VersionControlPanel/hooks/` |

Two new components: `RepositorySection` (remote, branch, ahead/behind, connect) and
`github/GitHubSection` (the collapsed issues/PRs section).

**Git instances: seven `new Git(…)` on the GitHub side → zero.**

- The three in `useGitSyncStatus` went with the file.
- `useGitHubRepository` **reads the panel's context git** rather than opening its own, and is called
  once — by the panel — with its answer passed to both sections. That is what closes slice 1's
  "the merged panel should have exactly one".
- The two in `ConnectToGitHubView` remain and should: that component runs **before** the repository
  has a remote (and, on one path, before it is a repository at all), which is the one case the
  context cannot serve. Rewriting 300 lines of working OAuth flow to relocate it is how a
  consolidation becomes a regression.

Making `useGitHubRepository` context-bound has a consequence worth stating: it is now only callable
inside `VersionControlProvider`, which renders only once the project is a git repository. Its
`no-git` branch is therefore unreachable from the merged panel — the panel's own "Initialize Version
Control (git)" empty state stands in front of it, which is criterion 5, unchanged.

### Criterion 6 had a better answer than the one it asked for

The criterion is "existing saved sidebar layouts do not break", and keeping the `versioncontrol` id
satisfies it literally — `SidebarModel.switch()` on an unknown id throws into a catch that selects
the first visible panel, so nothing breaks.

But nothing breaking is not the same as landing where you left off, and **PNL-008 already built the
mechanism for this**: `RETIRED_PANEL_IDS` remaps a retired id and clears its stale width and
float-rect entries. `github → versioncontrol` is one line there, and it means a user who last closed
the editor on the GitHub panel opens on the panel that absorbed it. Pinned by
`tests/sidepanel/panelRetirement.spec.ts`.

### The spec lives in the jasmine suite, and that is the runner working

`tests-unit/` was the first home for the retirement spec and it refused the import:
`settingsPanelRoute.ts` reaches `SidebarModel`, and the plain-Node runner is scoped to code that
does not. That boundary is deliberate (see `jest.config.js`), so the spec moved rather than the
boundary.

### Live QA (2026-08-03) — and it found two defects a diff cannot show

Driven in the running editor against a scratch project.

| Criterion | Result |
|---|---|
| 1 — one panel, GitHub gone from the rail | `SidebarModel.getVisibleItems()` returns **12 ids, no `github`**, `versioncontrol` present |
| 5 — no git repository | *"This project is missing a git setup"* + one action, unchanged |
| 7 (first half) | **Initialize Version Control (git)** → the merged panel: Repository (`No remote` / `main` / **Connect to GitHub**), sync button, Active branch, Local Changes / History |
| 4 — connect from the panel that shows the history | **Create New Repository** / **Connect Existing Repository** render *inside* the version-control panel |

**Two defects, both only visible in a mount.**

1. **The connect view was a whole panel inside a section.** `ConnectToGitHubView` was written as a
   full-panel empty state — a 48px logo, a centred heading, `min-height: 300px`, 48px of padding.
   Embedded, it pushed Local Changes and History to the bottom edge of the panel. Same class as
   AIB-004's overflowing review topbar. It gained an `isCompact` mode: no logo, no heading, no
   height floor, left-aligned prose. The buttons and every error path are untouched.
2. **The trigger stayed live under the open view.** "Connect to GitHub" remained clickable above a
   connect flow it had already opened — two affordances for one thing, one of them a no-op. Hidden
   while the view is open, and the view gained a **Cancel** it did not have (as a panel it never
   needed one; as a section it does).

Both re-verified after a **restart** rather than through HMR: the fix turns on a new CSS-module
class, and HMR dropping CSS-module classes is the documented trap here.

### Owed

- **Criterion 3 (ahead/behind) and criterion 7's second half** — the figure needs a remote to be
  non-empty, and connecting one needs a real GitHub account. The code path is the context's
  `localCommitCount`/`remoteCommitCount`, which the panel has rendered since long before this task;
  what is unverified is the new label beside the branch.
- The scratch project used for this (`bcn010-live`) now has a `.git` from criterion 5's init step.
- **AIB-009 F6** — the 404-per-repo launch logging is in `services/github`, untouched by this task and
  still open. What *did* go with the shell is `GitHubPanel.tsx`'s own per-render `🔧`/`🎧`/`🔔`
  logging, which was a second, unrelated source of the same noise.
