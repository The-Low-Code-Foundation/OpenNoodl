# FH-010 — Create/Connect Repository shows an overlay and no dialog

**Status:** shipped. All four overlays portal out through
`VersionControlPanel/components/PanelOverlay.tsx`; criterion 4 is pinned by
`tests-unit/fh-010/inTreeFixedOverlays.test.ts`. Criteria 1–3 need a human at a
GitHub-authenticated editor — recipe at the end. Every premise below was checked
at file:line and held **except one**, corrected in place: there is no
`isolation: isolate` anywhere in the editor's stylesheets.

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
against the ~300-400px panel body, which is also `overflow: hidden`/`auto`. The backdrop paints
as the grey wash confined to the panel; the dialog box is centred in — and clipped/scrolled by —
that same small box. Not a missing registration, not a thrown error (a render throw would hit the
SidePanel ErrorBoundary, not produce a wash).

> ⚠️ **Corrected premise.** This paragraph originally read "a z-index-0 stacking context inside
> `isolation: isolate`". `isolation: isolate` appears **nowhere** in the editor's or core-ui's
> stylesheets — grep both, it is zero hits. And `.ChildrenContainer`'s `z-index: 0`
> (`BasePanel.module.scss:102`) is inert for stacking purposes, because that element is
> `position: static` and `z-index` only applies to positioned elements. The stacking context that
> does exist is `.Root`'s, created by the `contain: layout` that `container-type` implies — the
> same declaration that creates the containing block. So the mechanism is one property, not
> three, which makes the fix (escape the subtree) the only fix rather than one of several.

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

## What shipped

One seam, `VersionControlPanel/components/PanelOverlay.tsx`, used by all four. It
`createPortal`s the **backdrop** (not just the box) to `.dialog-layer-portal-target`, so each
overlay keeps its own layout — the two GitHub modals still centre their sheet, the two detail
drawers still pin theirs to the right edge — and only the escape is shared.

`BaseDialog` was considered and not used, for two reasons that only show up at these call sites:

- Two of the four are right-hand slide-out drawers. `CoreBaseDialog` centres whenever there is no
  `triggerRef`, so converting them would have changed what they are, not just where they live.
- `CoreBaseDialog` renders `children` **twice** — once inside a hidden `MeasuringContainer`
  (`BaseDialog.tsx:330-334`) and once for real. Every editor `Modal` already pays that, but these
  two components mount a second copy of an element with fixed `id`s and a second `useEffect` that
  calls the GitHub API, so `SelectRepoModal` would have listed every repository and every org
  twice on each open. That is a behavioural regression the doc's fallback path avoids for free.

Dismissal moved with it. All four used a backdrop `onClick` plus `stopPropagation()` on the box —
the exact shape PNL-002 fixed in `CoreBaseDialog`: a `click` is dispatched to the nearest common
ancestor of press and release, so a drag that begins *inside* the dialog and ends outside it fires
a click on the backdrop, misses the inner guard, and closes. Selecting a repository name or a line
of an issue body and releasing past the edge threw the dialog away, and it got far more reachable
the moment the backdrop grew from a panel-sized box to the whole window. `PanelOverlay` requires
both ends of the gesture to land on the backdrop, so children need no guard of their own; the four
`stopPropagation` handlers that existed only to pair with the old `onClick` are gone.

`isCreating` / `isConnecting` still hold the two modals open mid-operation — that is now expressed
as `onDismiss={isCreating ? undefined : onClose}` rather than a branch inside a click handler.

### Criterion 4

`packages/noodl-editor/tests-unit/fh-010/inTreeFixedOverlays.test.ts` — a **source** guard rather
than a rendered-DOM one. It walks every stylesheet under `VersionControlPanel/`, brace-parses out
each top-level class that declares `position: fixed`, and requires the component rendering that
class to hand it to `PanelOverlay` as `backdropClassName`. It also asserts it found the three
overlays it is meant to be guarding (a sweep matching nothing passes for the wrong reason), that
no component pins itself with an inline `style={{ position: 'fixed' }}` the stylesheet sweep
cannot see, and that no backdrop has gone back to an `onClick`. Falsified before it was trusted:
reverting `PRDetail` to the old markup turns exactly the `PRDetailOverlay` case red.

It lives in `tests-unit/` (plain-Node jest) rather than the jasmine suite on purpose — the jasmine
suite has never rendered React, and a rendered-DOM check for this would have had to introduce that
capability, mock `GitHubClient`, and still only cover the four instances rather than the class.

## Live QA — what a human must click

Requires a GitHub-authenticated editor: the buttons do not render unless
`GitHubOAuthService.instance.isAuthenticated()` is true, and the issue/PR drawers need a project
whose remote is a GitHub repo. **Do both passes in light and in dark theme** — the backdrop is
`rgba(0,0,0,0.5–0.6)` in both, and the sheet is `--theme-color-bg-2`, so the light-theme pass is
the one that would expose a backdrop that reads as a flat grey slab.

1. Open the **Version control** panel on a project with no git remote. Under the GitHub section,
   click **Create New Repository**. Expect: the backdrop dims the *whole editor* — canvas, top
   bar, the other panels — and a 420px sheet is centred in the window, not inside the panel.
2. Press inside the "Repository name" field, drag out over the canvas, release. Expect: the dialog
   is **still open** (this is the gesture fix; on the old code the click landed on the backdrop
   and closed it).
3. Click the backdrop cleanly (press and release both over the dimmed area). Expect: closes.
4. Fill a name and submit against a real account. Expect: the sheet stays put while it is creating
   — the backdrop is inert during `isCreating` — and the panel refreshes to the connected state.
5. Repeat 1–3 with **Connect Existing Repository** (560px sheet, repository list). Check the list
   scrolls inside the sheet and the sheet does not exceed 90vh.
6. On a project connected to a GitHub repo, open the GitHub section → **Issues**, click an issue.
   Expect: a 600px drawer slides in from the **right edge of the window**, full window height, not
   clipped to the panel. Select text in the body, drag past the drawer's left edge, release —
   expect the drawer stays open. Click the dimmed area to the left — expect it closes.
7. Repeat 6 on the **Pull requests** tab.
8. One DOM check, in devtools:
   `[...document.querySelectorAll('[class*=BasePanel] *')].filter(e => getComputedStyle(e).position === 'fixed')`
   → `[]`, with a dialog open.

## ⚠️ Concurrent-session note

`VersionControlPanel/**` has uncommitted changes from another session (DiffList, CommitChangesDiff,
StashChangesDiff, context/*). This task touched the two modals, the two detail components, their
three `.module.scss` files, and added `components/PanelOverlay.tsx` — none of those are in the
modified set. `ConnectToGitHubView.tsx` was *not* touched in the end: the modals portal
themselves, so their parent needed no change. Commit with an explicit pathspec, never
`git add -A`, never stash.
