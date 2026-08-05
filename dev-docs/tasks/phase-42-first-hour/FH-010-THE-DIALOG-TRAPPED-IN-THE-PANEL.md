# FH-010 — Create/Connect Repository shows an overlay and no dialog

Covers reported item **9** (dialog half — the black-on-black rows are
[FH-009](FH-009-THE-ACTIVE-LIST-ITEM-IS-UNREADABLE.md)).

## What was reported

> In the version control panel, when you click 'Create New Repository', the left panel gets a grey
> overlay but nothing comes up, same for Connect Existing Repository.

## The mechanism — a fixed-position modal inside a CSS container

`CreateRepoModal` and `SelectRepoModal` render **inline in the panel's React tree** (no portal)
as `position: fixed; inset: 0` backdrops (`ConnectToGitHub.module.scss:152-172`, rendered from
`ConnectToGitHubView.tsx:285-299`).

But `BasePanel` puts `container-type: inline-size` on the panel root — which implies
`contain: layout style inline-size` — so **the panel becomes the containing block for
`position: fixed` descendants**. `BasePanel.module.scss:23-30` documents this exact contract:

> Every full-screen overlay reachable from a panel escapes first — BaseDialog portals to
> `.dialog-layer-portal-target` … **Nothing fixed is left in-tree.**

These two modals (moved into the panel by AIB-008) violate that contract: `inset: 0` resolves
against the ~300-400px panel body, which is also `overflow: hidden`/`auto` and a z-index-0
stacking context inside `isolation: isolate`. The backdrop paints as the grey wash confined to
the panel; the dialog box is centred in — and clipped/scrolled by — that same small box. Not a
missing registration, not a thrown error (a render throw would hit the SidePanel ErrorBoundary,
not produce a wash).

Two more in-tree fixed overlays in the same panel have the same defect and should be fixed in the
same pass: `IssueDetail.module.scss:5-16` and `PRDetail.module.scss:6`.

## What to build

Portal all four to the dialog layer — preferably by converting to `BaseDialog` (which portals to
`.dialog-layer-portal-target` and matches the editor's dialog chrome; remember `DialogLayer` does
NOT centre, `CoreBaseDialog` does). If conversion is too invasive for the two GitHub modals, a
bare `createPortal(document.querySelector('.dialog-layer-portal-target'))` keeps their markup.

## Criteria

1. Create New Repository → a centred dialog over the whole editor, backdrop over the whole
   editor.
2. Connect Existing Repository → same; both submit paths still work against a connected GitHub
   account (reproduction requires `GitHubOAuthService.isAuthenticated()` — the buttons don't
   render otherwise).
3. Issue detail and PR detail overlays no longer confined to the panel.
4. Verified in the running editor; one DOM check that no `position: fixed` element remains inside
   `BasePanel`'s subtree for this panel (that's the contract the base component documents —
   consider a jasmine spec that walks rendered panel DOM for it, so the class can't return).

## ⚠️ Concurrent-session note

`VersionControlPanel/**` has uncommitted changes from another session (DiffList, CommitChangesDiff,
StashChangesDiff, context/*). This task touches `ConnectToGitHubView.tsx`, the two modals, and two
`.module.scss` files — none of those are in the modified set, but commit with an explicit
pathspec, never `git add -A`, never stash.
