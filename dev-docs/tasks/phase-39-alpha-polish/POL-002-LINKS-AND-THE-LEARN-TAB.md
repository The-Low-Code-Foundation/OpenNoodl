# POL-002 — Three real links, and one tab that goes away

Covers reported items **1** (hide the Learn tab), **2** (launcher footer links) and **5** (the `?`
in the editor's bottom-right).

## What was reported

> The learn tab needs to be hidden. With all the changes the lessons are probably fucked until we do
> the new learn phase later.

> The links at the bottom left of the launcher need to be changed. […] documentation link can be
> `https://the-low-code-foundation.github.io/opennoodl-docs/` until I find a better domain. YouTube
> `https://www.youtube.com/@simple-rick-tutorials` and Discord `https://discord.gg/dZw4w5pKf9`.

> In the editor, there's a question mark icon in the bottom right. Change it to just have the same
> links as the launcher: docs, youtube, discord.

## The mechanism — confirmed

**The Learn tab** is an unconditional entry in
[`LauncherHeader.tsx:24-29`](../../../packages/noodl-core-ui/src/preview/launcher/Launcher/components/LauncherHeader/LauncherHeader.tsx#L24-L29).
It routes to `LearningCenter`, fed by a lesson catalogue loaded in
[`ProjectsPage.tsx:250`](../../../packages/noodl-editor/src/editor/src/pages/ProjectsPage/ProjectsPage.tsx#L250).

**The footer links** are three hardcoded `<FooterLink>` calls at
[`LauncherFooter.tsx:40-42`](../../../packages/noodl-core-ui/src/preview/launcher/Launcher/components/LauncherFooter/LauncherFooter.tsx#L40-L42):
`docs.noodl.net`, `youtube.com/@noodlapp`, `discord.gg/noodl`.

**The `?` menu** is [`HelpCenter.tsx`](../../../packages/noodl-editor/src/editor/src/views/HelpCenter/HelpCenter.tsx),
and it is in worse shape than the footer. It carries:

- an **Algolia search client with a hardcoded app id, API key and index name `docs_2-9`** — Noodl's
  documentation index, not ours (line 25/47);
- `docs.noodl.net/${version}/…` in four places, where `version` is `platform.getVersion().slice(0,3)`
  — i.e. `"0.1"`, so the URLs are `docs.noodl.net/0.1/...` and would 404 even if the domain were ours;
- `forum.noodl.net` and `noodl.net/support`;
- a full search modal (`SearchView`, `Hit`) that exists only to drive that Algolia index.

Nothing in this file survives contact with NodeGX.

## What to build

**Slice 1 — one module owns the three links.**

Create a single exported constant — `packages/noodl-core-ui/src/constants/externalLinks.ts` or
similar — holding:

```ts
export const EXTERNAL_LINKS = {
  docs: 'https://the-low-code-foundation.github.io/opennoodl-docs/',
  youtube: 'https://www.youtube.com/@simple-rick-tutorials',
  discord: 'https://discord.gg/dZw4w5pKf9'
} as const;
```

Both the launcher footer and the `?` menu read it. The domain is explicitly temporary
("until I find a better domain") — one constant is what makes the next change a one-line change.

**Slice 2 — the footer.** Three `FooterLink`s pointing at the constant. No other change; the layout
is already right.

**Slice 3 — the `?` menu.** Reduce to three items: Documentation, YouTube, Discord. That means
deleting:

- the `algoliasearch` import, the `InstantSearch`/`Configure`/`Hits` tree, `SearchView` and `Hit`;
- the `Modal` and its `isSearchModalVisible` state;
- every `docs.noodl.net`, `forum.noodl.net` and `noodl.net` URL.

Check whether `algoliasearch` and `react-instantsearch` have any other consumer; if not, drop them
from `package.json` too. **Verify the packaged build after removing a dependency** — a green dev
build proves nothing about externals hoisting.

**Slice 4 — the Learn tab.**

Remove the `learn` entry from `HEADER_TABS`. Prefer removal over a feature flag: a flag implies
someone will flip it, and the lessons need the rebuild that a later phase owns, not a switch.

Leave `LearningCenter.tsx`, `LauncherContext`'s lesson fields and the catalogue loader **in place
and compiling** — the same convention `router.setup.ts` uses for the shelved Topology and retired
Data Lineage panels. Add a comment at the removal site saying why and pointing at the future learn
phase. Confirm nothing else routes to `'learn'` (e.g. a deep link or a saved `activePageId`); if a
persisted `activePageId` can still be `'learn'`, it must fall back to `'projects'` rather than
render an empty page.

## What removing Algolia actually found — 2026-08-03

The spec warned that dropping the dependency could break a **packaged** build without breaking the
dev build. It broke the **type** build instead, in eighteen files that have nothing to do with the
help menu:

```
TS2503: Cannot find namespace 'JSX'.
  DialogLayerModel.tsx, PopupMenu.tsx, SelectStage.tsx, MigratingStep.tsx,
  ScanningStep.tsx, VariablesSection.tsx, Card.tsx, TreeView.tsx,
  BasicTreeView.tsx, ConfirmationDialog.hooks.tsx, LauncherApp.tsx,
  LauncherPage.tsx, DefaultApp.tsx, ToolbarButton.tsx, ErrorBoundary.stories.tsx
```

`@types/react` **19 no longer declares a global `JSX` namespace** — it lives at `React.JSX` now. The
only thing in the entire dependency tree still declaring one was
`instantsearch-ui-components/dist/es/types/Renderer.d.ts`, a transitive dependency of
`react-instantsearch`:

```ts
declare global {
  namespace JSX {
    interface Element extends VNode {}   // ← Preact's VNode
```

So every bare `JSX.Element` annotation in the editor and in `noodl-core-ui` was resolving against
**Preact's** element type, supplied by a search widget library, because a help menu nobody could use
imported it. It typechecked. It was wrong the whole time.

Fixed by rewriting all 22 annotations to `React.JSX.Element` — the React 19 form — which removes the
accidental dependency rather than replacing it with a shim of our own. `npx tsc --noEmit` is clean.

**The generalisation, which is the useful part:** a dependency's *ambient* declarations are part of
your build whether or not you import them. Removing a package can therefore change types in files
that never referenced it, and the failure surfaces nowhere near the edit. `grep -rl "declare global"`
over the removed package's tree is the cheap check before believing a dependency is inert.

## Criteria

1. The launcher footer's three links open the three URLs above in an external browser.
2. The `?` menu shows exactly three items, opening the same three URLs.
3. No `noodl.net` URL and no Algolia credential remains under `packages/noodl-editor/src` or
   `packages/noodl-core-ui/src` (excluding `index.bundle.js`, which is a build artifact).
4. The launcher shows Projects, Templates, GitHub — no Learn.
5. A stored `activePageId` of `'learn'` lands on Projects, not on nothing.
6. The **packaged** build still starts after any dependency removal.

## Traps

- `packages/noodl-editor/src/editor/index.bundle.js` is a committed build artifact and contains all
  the old URLs. Do not edit it; do not count it as a finding either.
- `HelpCenter` renders through a `Portal` into `.help-center-layer` and returns `null` if that
  element is absent. If the menu appears to do nothing after the edit, check the portal root before
  suspecting the menu.
- Deleting the Algolia dependency is the one part of this task that can break a packaged build
  without breaking the dev build. See the packaging-traps note.
