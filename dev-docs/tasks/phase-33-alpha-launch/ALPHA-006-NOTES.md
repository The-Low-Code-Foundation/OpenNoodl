# ALPHA-006 — implementation notes for §1 and §6

**Run date:** 2026-08-03 · **Branch:** `wt-alpha-006`, based on `cline-dev` `bf35a9f4`
**Scope built:** §1 (retire the `##head##` fetch protocol) and §6 (repoint the Help Center, F69).
**Explicitly not built:** §2, §3, §4, §5. No `docs-site/`, no generator, no `MIGRATION.md`, no
change to `opennoodl-docs`, no `getContentEndpoint()` split.

Commits:

| | |
|---|---|
| `3dbd2914` | `feat(ALPHA-006 §1): node help reads the bundled catalog, not the web` |
| `bc0d15b0` | `fix(types): our JSX.Element annotations were Preact's, via Algolia` |
| `489c670d` | `feat(ALPHA-006 §6): the Help Center stops shipping Noodl (F69)` |

---

## What changed

### §1 — the help panel is off the network

A new module, [`packages/noodl-editor/src/editor/src/utils/nodeDocs.ts`](../../../packages/noodl-editor/src/editor/src/utils/nodeDocs.ts),
renders the bundled enriched catalog into help HTML. It is pure — no React, no Electron, no editor
singletons — and it returns a **site-relative** "read more" path rather than a URL, leaving the
origin to the renderer call sites. That is what keeps `@electron/remote` out of the `tests-unit`
runner, and it is also what keeps the legacy host out of the file as a literal: the path is derived
from whatever URL the catalog holds (`new URL(docs).pathname`), never string-replaced onto it.

The four consumers named in the spec:

| File | Was | Is |
|---|---|---|
| `utils/docs-parser.ts` | fetched raw `.md`, sliced `##head##` fences, resolved `@include` | **deleted** |
| `views/ConnectionPopup/DocsParser.ts` | fetched the page, scraped `##input:…##` markers | catalog lookup, keyed on canonical port name |
| `views/panels/propertyeditor/…/NodeLabel.tsx` | help button gated on `type.docs`, host string-replaced | present for every catalogued node; summary in the tooltip; page demoted to "read more" |
| `views/NodePicker/NodePicker.hooks.ts` | 250 ms debounce around a fetch per card | synchronous `useMemo` lookup |

Collateral in the same commit, because the fetch shape was baked into them:

- `ConnectionPopup/components/PortItem.tsx` — the display-name / name / longest-first-regexp
  cascade is gone. It existed because the old markdown markers were hand-keyed and sometimes
  wildcards; **zero** of the 735 enrichment port keys contain a regex metacharacter, so exact names
  are both sufficient and exact.
- `NodePicker/components/NodePickerPreview/NodePickerPreview.tsx` — `stripEmbeds()` deleted. Its
  entire job was removing YouTube iframes and a leading `<h1>` from fetched pages. Nothing fetches.
- `noodl-core-ui/…/HtmlRenderer.module.scss` — styles for `ul`/`li` and the two classes the new
  renderer emits (`.node-docs-summary`, `.node-docs-deprecated`). The fetched pages never used
  bullet lists; the enrichment's patterns and anti-patterns do.

### §6 — the Help Center

The menu is now: search the docs · getting started · guides · release notes · report a bug · report
a node behaving wrongly · suggest a feature. The first four go through `getDocsEndpoint()`, so
`useLocalDocs` reaches a local docs build for all of them; the last three are this repo's issue
forms. The Algolia client and the whole InstantSearch modal are deleted, along with the four now-dead
SCSS blocks and the `.ais-*` overrides.

`PRIVACY.md` updated in the same commit (criterion 7): the Algolia row leaves the data-flow table,
the "help search is the only request carrying anything you typed" claim becomes "nothing now does",
§1's offline node help is recorded, and the source-of-truth table gains `nodeDocs.ts`.

---

## Deviations from the spec, and why

1. **The spec's stated home for the catalog is wrong.** §1 says `node-catalog-enriched.json` "ships
   inside `@noodl/noodl-types`". There is no such package. It is `packages/noodl-types`, whose
   package name is **`@noodl/types`**, and the editor does not depend on it by name at all — it
   reaches it by relative path (`../../../../../noodl-types/src/…`), which is how
   `validation/enrichedCatalog.ts` and `validation/catalog.ts` already do it. Followed the file.

2. **The catalog has 153 node types, not 156.** Every acceptance-criterion-2 count in the spec says
   156. `enrichment.coverage` reports `153/153`. All 153 are documented; the coverage claim holds,
   the number does not.

3. **No new "help panel" was built.** §1 says "rewrite the four consumers … with the docs URL
   demoted to a read-more link", which is what was done. It does not ask for a new surface, and
   there is no existing in-editor node-help *panel* — the surfaces are the node picker's preview
   pane, the property panel's header button, and the connection popup's port hover. All three now
   read the catalog.

4. **`NodeLabel`'s help button is now shown for every catalogued node**, not only nodes with a
   `docs` URL. That is a behaviour change the spec implies but does not state. Without it the 17
   nodes with no URL would still have no affordance, which is half of what §1 exists to fix. The
   external page is offered only when there is one; the tooltip carries the summary either way.

5. **Inline markdown is rendered by hand, not by Remarkable.** 140 of 153 nodes use backticks and
   four use `**bold**`; nothing uses links, images, tables or fenced blocks. The text is HTML-escaped
   and then exactly two constructs are restored. Handing catalog text to Remarkable with `html: true`
   — which is what the deleted parser did — would make any future `<` in the catalog live markup,
   and Remarkable has a recorded habit in this repo of eating content it does not recognise.

6. **The Discord entry was deleted, not repointed.** §6 says "→ … and our Discord". There is no
   "our Discord": ALPHA-007's open question 4 records that the linked server is Noodl's and that a
   NodeGX one is an unmade decision. GitHub Discussions is not an alternative — the API reports
   `has_discussions: false` on the repository. **This needs Richard's decision**; the entry is
   trivially re-added once there is a URL that is ours.

7. **The in-editor search box was deleted rather than repointed at a local index**, which §6 offers
   as the alternative. There is no in-editor index to point at and building one is §2's job. The
   menu item opens the docs site's `/search` page instead (verified 200).

8. **`algoliasearch` and `react-instantsearch` are still in `packages/noodl-editor/package.json`.**
   Nothing imports them any more, so webpack will not bundle them, but removing them from
   `package.json` without regenerating the root `package-lock.json` (which references
   `algoliasearch` 11 times) would put the lockfile out of sync and `npm ci` would fail. This run
   was under a standing "never run `npm install`" constraint. **Someone who can run an install
   should drop both dependencies and commit the regenerated lockfile.**

9. **One out-of-scope file was touched:** `utils/forge/template/providers/noodl-docs-template-provider.ts`.
   Its `get name()` returned the hardcoded legacy host, so the two `console.error` messages in
   `template-registry` named an origin the provider has not fetched from since the fork. It now
   returns the endpoint it actually used. One line, no consumer other than those two log lines, and
   it removes a criterion-6 blocker. Strictly this is §5 territory.

---

## The defect this run found: our `JSX.Element` was Preact's

Deleting the Algolia import took `tsc -p packages/noodl-editor` from clean to **18
`TS2503: Cannot find namespace 'JSX'`** across ten files, none of which had been touched.

`@types/react` 19 removed the global `JSX` namespace — it is `React.JSX` now. The repo's 23 bare
`JSX.Element` annotations compiled anyway because `instantsearch-ui-components`, three levels below
`react-instantsearch`, ships in
`dist/es/types/Renderer.d.ts`:

```ts
declare global {
  namespace JSX {
    interface Element extends VNode {}
    interface IntrinsicElements {}
  }
}
```

`VNode` there is **Preact's**. So for as long as one editor file imported the Algolia search
widgets, every bare `JSX.Element` in `noodl-editor` and `noodl-core-ui` was typed as a Preact vnode,
and `JSX.IntrinsicElements` was that empty interface rather than React's element table.

All 23 sites are now `React.JSX.Element` (`bc0d15b0`). Worth recording because the failure mode is
invisible: a type annotation that means the wrong library is not caught by anything, and the thing
that *revealed* it was removing a dependency.

---

## Gates run, and their exact results

Only non-`lerna` scripts were run — `lerna exec --scope noodl-editor` executes the **main
checkout's** source, so `npm run dev:debug` and `npm run test:ci` would have graded a different
tree. They were not run.

| Gate | Result |
|---|---|
| `npx tsc -p packages/noodl-editor --noEmit` | **clean** (0 errors) |
| `npx jest` from `packages/noodl-editor` | **36/38 suites, 448/451 tests pass**. The 3 failures are `tests-main/execution-history/*` and are environmental: this machine runs Node 20.11.1, which has no `node:sqlite`. Files untouched by this run; fails identically at the base commit |
| `tests-unit/alpha-006/nodeDocs.test.ts` (new) | **18/18 pass** |
| `npm run lint:ci` | **pass** — 838 errors vs a 3916 baseline |
| `npm run catalog:merge:check` | **pass** — "153/153 nodes documented, 50 examples, compatibility present. Committed enriched catalog is up to date." |
| `npx tsc -p packages/noodl-core-ui --noEmit` | 86 errors, **all pre-existing**: 75 `TS2307` unresolved editor path aliases plus 7 module-syntax errors, in files untouched here. This run *removed* 8 errors from it (the `TS2503`s). The gate was already red at `bf35a9f4` |
| `npm run colors` | **red, and not from this run** — the entire +15 delta is `views/panels/ProvenancePanel/ProvenancePanel.module.scss`, untouched here (OBS-002/003 territory). Red at the base commit |

---

## Could not verify — needs the live editor

Nothing below was run; no Electron process was started, per the run's constraints.

1. **The node picker's preview pane renders the new HTML legibly** in a 292 px column — the
   `<h3>` sections, the bullet lists and the `<code>` runs. `HtmlRenderer.module.scss` gained
   `ul`/`li` rules and the two `.node-docs-*` classes, and no other consumer of `HtmlRenderer` was
   checked for regression from those additions.
2. **The property panel's help button** shows for nodes that previously had none, and its tooltip
   renders a full sentence at `UNSAFE_tooltipMaxWidth="320px"` without pushing the header row.
3. **The connection popup's port hover** still fires and positions. The lookup changed from display
   name to canonical name; a port whose docs used to resolve via the display-name branch will now
   resolve via its `name`, and any that resolved *only* through the wildcard-regexp branch will now
   show nothing. Worth hovering a few ports on `Group`, `Text Input` and a cloud-data node.
4. **`tooltip` still renders unchanged** in the property panel. Nothing in this diff reads or writes
   it, but the assertion the spec cares about is a visual one.
5. **The Help Center menu** — the seven items open the right pages in a browser, and the removal of
   the modal did not leave the `.help-center-layer` portal or the `?` button misplaced.
6. **The other six payload types (criterion 1)** — Library panel, Learn lessons, new-project
   templates, tutorials, news modal. Untouched by this run except for the template provider's
   `name` getter (a log string), but criterion 1 is explicit that they fail *silently* and must be
   seen populated, not reasoned about.
7. **`useLocalDocs`** — the `localhost:3000` override reaching all four Help Center docs links and
   the node "read more".
8. **Offline behaviour (criterion 2)** — asserted in jest, which proves the *lookup* needs no
   network. That the rendered panel needs none is the same claim, but seeing it with the machine
   offline is the criterion as written.

---

## Measurements taken during the run

The docs-origin numbers in the spec's Finding 1 were re-measured against the live site
(`https://the-low-code-foundation.github.io/opennoodl-docs`) rather than assumed:

- **133 distinct `docs` paths** across the 153 catalog nodes; **17 nodes carry no `docs` URL at all**.
- Of those 133, **99 return 200 and 34 return 404**. Node pages live at `/nodes/…` at the site root
  — the pathname the catalog already holds — so `nodeDocsPath()`'s derivation is correct against the
  real site and simply inherits the broken tail.
- The six wrong-path cases in Finding 1 are confirmed: `/nodes/visual/button` is a 404 and
  `/nodes/ui-controls/button` is a 200.
- Help *content* is unaffected by any of this: all 153 nodes have a summary, a description and
  when-to-use, and the "read more" link is only offered when the catalog has a URL.

Help Center destinations, all checked: `/search`, `/docs/getting-started/overview`, `/docs/learn`,
`/whats-new/` → **200**. The three `issues/new?template=…` forms → **200**.
`/discussions` → **404** (`has_discussions: false`).

---

## Out of scope, but found — for the defect register

| # | What | Where |
|---|---|---|
| 1 | **A live dead link to Noodl's site in the AI settings panel.** The "AI docs → Open docs" button opens `https://docs.noodl.net/#/docs/getting-started/noodl-ai/` — the real Noodl site, describing "Noodl AI", a product we do not ship (ours is provider-agnostic BYO-key). This is the same class as F69 and it **blocks acceptance criterion 6**. Not fixed here: it is neither §1 nor §6, it is AI-settings territory that AIB-009 touched recently, and there is no NodeGX AI docs page to point it at, so the fix is a decision (remove the card, or write the page) rather than a rewrite | `packages/noodl-editor/src/editor/src/views/panels/AiSettings/AiSettingsSection.tsx:333` |
| 2 | **A second live `noodl.net` link**, in the "project saved with a newer version" dialog: *"This project was saved with a newer version of Noodl. Click here to download"* → `https://noodl.net`. Also blocks criterion 6. **Not touched — the file is fenced**, another session has it dirty | `packages/noodl-editor/src/editor/src/models/projectmodel.editor.ts:44` |
| 3 | **The launcher footer links to `https://discord.gg/noodl`** — Noodl's server again, a third instance of F69's class outside the Help Center | `packages/noodl-core-ui/src/preview/launcher/Launcher/components/LauncherFooter/LauncherFooter.tsx:42` |
| 4 | **`README.md` names `noodl.net/community` as the main support channel** | `README.md:69` |
| 5 | **`.github/ISSUE_TEMPLATE/config.yml` offers a Discussions link that 404s.** `has_discussions` is `false` on the repository, so the "Question or general discussion" contact link on the new-issue page goes nowhere. Either enable Discussions or remove the entry | `.github/ISSUE_TEMPLATE/config.yml` |
| 6 | **`npm run colors` is red on `cline-dev`**, entirely from `ProvenancePanel.module.scss` (+15 over baseline). Pre-dates this run | `packages/noodl-editor/src/editor/src/views/panels/ProvenancePanel/ProvenancePanel.module.scss` |
| 7 | **`npm run typecheck:core-ui` is red on `cline-dev`** — 86 errors, 75 of them `TS2307` unresolved editor path aliases, because `noodl-core-ui`'s tsconfig reaches editor and viewer sources without the editor's `paths`. Pre-dates this run | `packages/noodl-core-ui/tsconfig.json` |
| 8 | **`algoliasearch` and `react-instantsearch` are now unreferenced dependencies** — see deviation 8 above; needs an install run to drop cleanly | `packages/noodl-editor/package.json` |

---

## What §3 inherits from this

§1 was ordered first because it decides the generator's shape, and it does:

- **The generator has no protocol to reproduce.** The `##head##` fences, the `##input:…##` markers
  and the `@include` transclusion have no reader left. Generated pages can be ordinary Docusaurus
  MDX.
- **The catalog is already the single source**, and §1 proves the editor can render it. §3's pages
  and the editor's help will not be two documents that can disagree — they are two renderings of
  one artifact.
- **The 34 broken `docs` paths should be fixed at source** (the `docs` field on the node
  definitions), not by a redirect table. `nodeDocsPath()` derives the path from that field, so a
  fix there fixes the editor's "read more" and the site's URL in one edit — which is what
  criterion 6's parenthetical anticipates.
