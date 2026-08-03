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
