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

## ⚠️ Landed 2026-08-06, 215 commits later — four premises below are now false

This branch sat unmerged while `cline-dev` advanced 215 commits. Phase 39's
**POL-002** (`d9c0f37c`, 2026-08-03 22:11 — three hours *after* `bc0d15b0`)
solved most of §6 independently and, in two places, better. Corrections, each
verified at file:line on the merge:

1. **Deviation 8 and register row 8 are resolved.** `algoliasearch` and
   `react-instantsearch` are gone from `packages/noodl-editor/package.json`;
   POL-002 was not under the "never run `npm install`" constraint this run was,
   and committed the regenerated lockfile. Nothing to do.
2. **Register row 3 is resolved.** `LauncherFooter.tsx:42–44` reads
   `EXTERNAL_LINKS` from `noodl-core-ui/src/constants/externalLinks.ts`; the
   `discord.gg/noodl` literal is gone.
3. **Deviation 6 is stale: there *is* now an "our Discord".**
   `EXTERNAL_LINKS.discord` is `https://discord.gg/dZw4w5pKf9`, and both the
   launcher footer and the `?` menu link to it. ALPHA-007's open question 4
   ("Discord — untouched") was answered by POL-002 rather than by this task.
4. **`bc0d15b0` landed as a no-op.** POL-002 found the same Preact `JSX`
   declaration by the same route (deleting the InstantSearch import) and made
   the identical `React.JSX.Element` rewrite. The finding below is still worth
   reading; the diff is not. Zero bare `JSX.Element` annotations remain in
   either package.

What survived the merge from §6: the three `issues/new?template=…` entries,
below a divider under POL-002's three links. What did **not**: the
`getDocsEndpoint()` deep links (`/search`, `/docs/getting-started/overview`,
`/docs/learn`, `/whats-new/`). POL-002 deleted the previous generation of docs
deep links because nothing verified they resolved, and `EXTERNAL_LINKS.docs` is
now the single source of truth the launcher shares — reintroducing per-page
paths would undo that. They were verified 200 on 2026-08-03 and can come back as
`EXTERNAL_LINKS` entries if someone wants them.

Register rows 1, 2, 4, 6 and 7 were re-checked on the merge and still hold:
`AiSettingsSection.tsx:333` and `projectmodel.editor.ts:44` still carry live
`noodl.net` links at exactly those lines, and `README.md:69` still names
`noodl.net/community`.

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

*(As built on this branch — see the ⚠️ block at the top for what actually
landed.)* The menu is now: search the docs · getting started · guides · release
notes · report a bug · report a node behaving wrongly · suggest a feature. The
first four go through `getDocsEndpoint()`, so `useLocalDocs` reaches a local docs
build for all of them; the last three are this repo's issue forms. The Algolia
client and the whole InstantSearch modal are deleted, along with the four
now-dead SCSS blocks and the `.ais-*` overrides.

**On the merge (2026-08-06)** the first four were dropped in favour of POL-002's
single `EXTERNAL_LINKS.docs` entry, which the launcher footer shares; the last
three landed unchanged, below a divider. `getDocsEndpoint()` is no longer
reachable from this file, so `useLocalDocs` no longer redirects the `?` menu — it
still redirects §1's "read more" links in `NodeLabel` and the node picker, which
is where it matters.

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
| 3 | ✅ **RESOLVED by POL-002 (`d9c0f37c`), verified on the merge 2026-08-06.** ~~The launcher footer links to `https://discord.gg/noodl`~~ — it reads `EXTERNAL_LINKS.discord` now | `packages/noodl-core-ui/src/preview/launcher/Launcher/components/LauncherFooter/LauncherFooter.tsx:42` |
| 4 | **`README.md` names `noodl.net/community` as the main support channel** | `README.md:69` |
| 5 | **`.github/ISSUE_TEMPLATE/config.yml` offers a Discussions link that 404s.** `has_discussions` is `false` on the repository, so the "Question or general discussion" contact link on the new-issue page goes nowhere. Either enable Discussions or remove the entry | `.github/ISSUE_TEMPLATE/config.yml` |
| 6 | **`npm run colors` is red on `cline-dev`**, entirely from `ProvenancePanel.module.scss` (+15 over baseline). Pre-dates this run | `packages/noodl-editor/src/editor/src/views/panels/ProvenancePanel/ProvenancePanel.module.scss` |
| 7 | **`npm run typecheck:core-ui` is red on `cline-dev`** — 86 errors, 75 of them `TS2307` unresolved editor path aliases, because `noodl-core-ui`'s tsconfig reaches editor and viewer sources without the editor's `paths`. Pre-dates this run | `packages/noodl-core-ui/tsconfig.json` |
| 8 | ✅ **RESOLVED by POL-002 (`d9c0f37c`), verified on the merge 2026-08-06.** ~~`algoliasearch` and `react-instantsearch` are now unreferenced dependencies~~ — both dropped, lockfile regenerated | `packages/noodl-editor/package.json` |

---

## §5 — the endpoint split (code half), added 2026-08-07

**Run date:** 2026-08-07 · straight to `cline-dev`, no branch.
**Scope built:** the call-site half of §5 only — a new `getContentEndpoint()`,
and the six non-documentation payload consumers repointed at it.
**Explicitly not built:** the disposition half — `opennoodl-docs` still serves
everything, nothing was stripped, nothing was archived. That's B5, and it
needs a human decision on the 413 MB asset question before any of it moves.

`getDocsEndpoint()` had 12 real consumer files at HEAD (not the spec's ~10 —
`McpSettingsSection.tsx` is a genuinely new docs-page probe added after the
spec was written, and §1 already reduced the node-docs consumers from 4 to 2
by deleting `docs-parser.ts` outright and rewriting
`ConnectionPopup/DocsParser.ts` to a catalog lookup that no longer needs a
host at all).

`utils/getContentEndpoint.ts` is deliberately a sibling, not a wrapper —
identical body to `getDocsEndpoint.ts` today (same `useLocalDocs` global,
same fallback origin), because the spec is explicit that "both may resolve to
the same origin initially" and the value of the split is only realized when
they're free to diverge later.

Moved (6 payload types, 9 files):

| Payload | Files |
|---|---|
| Library | `models/modulelibrarymodel.ts`, `views/NodePicker/components/ModuleCard/ModuleCard.tsx` |
| Lessons | `models/lessontemplatesmodel.js`, `pages/ProjectsPage/ProjectsPage.tsx` (lesson thumbnails) |
| Tutorials | `models/tutorialsmodel.js` |
| What's-new | `whats-new.ts`, `views/NewsModal/NewsModal.tsx` |
| Project templates | `utils/forge/template/providers/noodl-docs-template-provider.ts` (constructor param renamed `getContentEndpoint`), rewired at its one call site in `utils/forge/index.ts` |

Stayed on `getDocsEndpoint()` (3 files, all genuine docs-page links, not
payload fetches): `NodeLabel.tsx` and `NodePicker.hooks.ts` (the "read more"
link §1 left behind after replacing the fetch with a catalog lookup), and
`McpSettingsSection.tsx` (`HEAD`-probes a real docs page to decide whether to
show an "MCP docs" link at all).

No data flow changed — same origin either way — so `PRIVACY.md` needed no
edit here, unlike §6's Algolia removal.

Gates: `typecheck:editor` clean, `npx jest` (from `packages/noodl-editor`)
933/933 across 67 suites, `lint:ci` 860 errors vs. the 3916 baseline,
`test:ci` (Jasmine) **2418 specs, 0 failures** — identical to the same-day
ALPHA-001 baseline, so this landed with zero regression.

**What this de-risks, per the suggested order:** §2 (site skeleton) and §3
(generator) can now be built without touching a single non-doc call site by
accident — `getDocsEndpoint()` unambiguously means "the docs site" from here
on. §4's disposition table and the actual repo strip still wait on B5.

## §2 and §3 — the site and the generator, added 2026-08-07

**Run date:** 2026-08-07, same session as §5 above · straight to `cline-dev`.
**Scope built:** a real `docs-site/` (Docusaurus 3, wired as an actual
workspace member, not just files on disk) and `scripts/generate-node-docs.js`.
**Explicitly not built:** §4 (the `MIGRATION.md` disposition table for
`opennoodl-docs`'s 431 files) and §5's disposition half (stripping that repo
down to the six payload types). Both need B5.

### §2 — the site

`docs-site/` at the repo root, per the spec's placement (not `packages/docs-site`
— checked first: root `workspaces` was `packages/*` only, so it had to be
added explicitly, in both `package.json` `workspaces` and `lerna.json`
`packages`, or nothing outside `packages/*` would be part of the install or
visible to `lerna`/`nx`). `npm install` at the root pulled the new deps in
without disturbing the existing 15 packages — editor's React 19 and
`docs-site`'s React 18 nest independently rather than conflicting, since npm
workspaces only force a single hoisted copy when ranges are compatible.

Carried over from `opennoodl-docs`, per the spec's explicit list: the search
plugin (`@easyops-cn/docusaurus-search-local`, replacing the Algolia
`docs_2-9` client §6 already deleted from the editor) — not the SCSS. The old
site's five `.scss` files (`navbar`, `sidebar`, `searchbar`, `markdown`,
`pagination`) are built for Noodl's retired branding and for the multi-plugin
docs/library/javascript/codebase/whats-new site structure this task
deliberately doesn't rebuild (those payloads stay on `getContentEndpoint()`,
per §5). `src/css/custom.css` is a genuinely light-touch pass instead: it
overrides Infima's primary-color custom properties with the editor's own
azure-500 (dark) / azure-700 (light) — `packages/noodl-core-ui/src/styles/
custom-properties/colors.css` — and leaves everything else to Infima's own
(already accessible, already light/dark-aware) defaults. If a fuller UIX-token
pass is wanted later, this is the file to extend, not replace.

Logo/favicon: no existing static SVG export of the "Noodle" mark existed
outside `Logo.tsx` (a React component using `currentColor`/CSS vars, which a
navbar `<img src>` can't resolve) and `build/icon.svg` (the app-icon treatment
with its rounded-square glow background — used as-is for the favicon, where a
square reads fine). Two new static files, `static/img/logo-{light,dark}.svg`,
bake the same geometry from `Logo.tsx`'s `<Mark>` into fixed colours for each
navbar background, since Docusaurus's `themeConfig.navbar.logo.src`/`srcDark`
needs two files, not one CSS-var-driven one.

Content: ALPHA-004's `docs-site-content/` (concepts, getting-started,
troubleshooting) copied into `docs-site/docs/` close to verbatim, exactly as
its own README predicted. One link fixed
(`concepts/README.md`→`concepts/index.md`, since Docusaurus's category-index
convention wants `index.md`, not `README.md`); `sidebar_position` frontmatter
added throughout so the autogenerated sidebar matches the reading order
`concepts/index.md`'s own numbered list already specified. **`docs-site-content/`
itself was not deleted** — the harness's permission classifier blocked
`git rm -r docs-site-content` as a destructive action mid-session. It's now a
stale duplicate; removing it needs a human `git rm -r docs-site-content` (or
explicit sign-off to let an agent do it).

⚠️ **`url`, `baseUrl`, `organizationName`, `projectName` in `docusaurus.config.js`
are marked provisional in a comment, on purpose.** Where this site actually
publishes to is entangled with B5 — does `opennoodl-docs`'s current GitHub
Pages URL keep serving *docs* (this site) while payload hosting moves
elsewhere, or does it become the content host and the docs move to a new URL?
The spec's own §2 text ("no change to `getDocsEndpoint()`") and §5's text
("the old repo becomes the content host") read as in tension with each other
on this point, and resolving that tension is a hosting decision, not an
engineering one — flagged rather than silently picked.

### §3 — the generator

`scripts/generate-node-docs.js`, plain Node (no build step, matching the
convention of `scripts/lint-ratchet.js` and friends), wired as `npm run
docs:nodes` (write) / `docs:nodes:check` (staleness gate, same shape as
`cloud-library:check`). Reads `packages/noodl-types/src/node-catalog-enriched.json`
directly — the same file `nodeDocs.ts` reads for the in-editor help panel —
rather than going through `enrichedCatalog.ts`'s lazy-loaded `Map`, since a
one-shot build script has no reason to pay for memoisation across calls it
only makes once.

One page per node under `docs-site/docs/nodes/<category-slug>/<node-slug>.md`,
grouped by the catalog's own `category` field (17 categories at HEAD) — the
same field the node picker groups by, so the old site's `Button`-is-
`ui-controls`-but-catalog-says-`Visual` disagreement (Finding 1's six
wrong-path cases) is structurally impossible here: there's only one grouping,
because there's only one field. Per node: summary, description, when-to-use,
an at-a-glance table (category/type name/`availableIn`/SSR compat/provided-by),
inputs and outputs each split into Values / Signals / Failure outputs (a
"failure" port is `group === 'Error'` or a name matching `/error|failure/i` —
no catalog field marks this explicitly, so it's a heuristic, not a lookup),
dynamic-port mechanisms and declared port groups where present, patterns,
anti-patterns, examples (pulled from the catalog's own top-level `examples`
array by id — real prose, not invented), and related-node links that resolve
across category folders. Deprecated nodes get a warning admonition rather than
being silently dropped (spec rule 3: nothing is omitted without a recorded
disposition).

The gate deletes `docs-site/docs/nodes/` and regenerates from scratch on every
non-check run — deliberately, so a renamed or removed node can't leave an
orphaned page nothing would notice. `--check` mode generates in memory and
diffs against what's on disk, reporting `missing:`/`stale:`/`orphaned:` by
relative path and exiting 1 on any of them, rather than a bare pass/fail.
Generated pages are committed, not gitignored, matching how
`cloud-library:check`/`catalog:merge:check` treat their own generated
artifacts elsewhere in this repo — the alternative the spec offered
(gitignored) would mean nothing ever diffs it in review.

**The bug that only showed up at `docusaurus build`, not by reading the
generator's output:** Docusaurus 3 parses `.md` as MDX by default, and MDX is
a strict superset of Markdown that treats bare `<word>` as an unclosed JSX tag
and bare `{word}` as a JS expression. The catalog's enrichment prose was
authored for `nodeDocs.ts`'s hand-rolled HTML renderer (ALPHA-006 §1), which
never had this problem, and it genuinely contains sequences like `<name>`
placeholders and `{count}`/`{id}` template fragments — 55 of the 191 generated
files, by grep. The fix is one line in `docusaurus.config.js`
(`markdown.format: 'detect'`, which parses `.md` as plain CommonMark and
reserves MDX for actual `.mdx` files — this site has none), not 55 files' worth
of escaping in the generator. Found by actually running `npm run
docs-site:build` and reading the compiler's own errors, not by inspecting the
generated Markdown by eye — the Markdown was syntactically fine on its own
terms, and only breaks once a specific parser is pointed at it.

### Verification actually done

`npm run docs-site:build` succeeds with `onBrokenLinks: 'throw'` — every
internal link (concept-to-concept, node-to-related-node, sidebar) resolves, or
the build would have failed outright. Then served the built output
(`npx docusaurus serve`) and `curl`-checked real rendered HTML rather than
trusting the build log alone: a sample node page's headings, its 7 generated
tables (inputs/outputs × values/signals + one failure-outputs table), the
"Generated" info admonition rendering as `alert alert--info`, and the search
plugin's `search-index.json` all present. Not done: a real browser screenshot,
or navigating the rendered site by clicking rather than by URL — this was a
CLI-only session with no display.

### Gates re-run clean

`typecheck:runtime|cloud|viewer|editor|editor-tests` all clean ·
`catalog:check` (175 nodes — the *structural* catalog, a different file and a
different count from the *enriched* one §3 reads; see the PROGRESS.md log for
why these aren't the same number) · `cloud-library:check` clean ·
`library:check` 58/58 · `docs:nodes:check` clean (191 files match 172 catalog
nodes) · jest 933/933 across 67 suites · `lint:ci` 860 vs. 3916 baseline
(`docs-site/` and `scripts/generate-node-docs.js` are both outside
`.eslint-baseline.json`'s `targets`, confirmed unaffected) · **`test:ci`
(Jasmine): 2418 specs, 0 failures** — identical to every other measurement
taken today. `catalog:merge:check --require-coverage` still fails on the
same pre-existing 3-node enrichment gap noted earlier in today's log; not
caused by this work, not re-investigated.

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

## §4 — the migration table, added 2026-08-07

**Run date:** 2026-08-07, same session as §5/§2/§3 and B5's decision.
**Scope built:** `docs-site/MIGRATION.md` only. No file in `opennoodl-docs` touched — this
is classification against the local clone at `~/Documents/opennoodl-docs` (`7489e81`,
2025-12-06), not a migration. The actual strip waits on B5's two GitHub actions, per the
sequencing note in `HUMAN-GATED-ITEMS.md`.

A small classifier script (path-rule based, kept in the session scratchpad rather than
committed — this is a one-time disposition record, not a re-runnable generator like §3's)
walked all 431 authored `.md`/`.mdx` files. Rules follow the spec's own folder assignments
where it gave them (`nodes/` → generated, `javascript/` → port, the four named
`docs/guides/*` dirs → salvage, the named delete list); where the spec was silent, applied
its stated *reasoning* by analogy rather than guessing fresh — e.g.
`docs/guides/visualizing-data/` got the same "concept survives, screenshots don't" fate as
its sibling guide folders, and `docs/guides/deploy/{deploying-to-ios-and-android,embedding,
favicon,overview,project-structure,pwa}.md` got `Delete` not because they're wrong but
because phases 18/26 (code export, deployment) are explicitly post-alpha — publishing them
as current would assert something unverified.

**A fifth fate the spec's "four fates" framing never named**, but its own §5 text implies:
193 files that are neither migrated nor deleted. `library/` (179 files) is the obvious case
— §5 already says "leaves the library exactly where LIB-001 found it" — but the same logic
extends to `.github/` templates, the top-level `README.md`/`LICENSE.md`/`CODE_OF_CONDUCT.md`,
`project-templates/overview.mdx`, and `_prefab-docs-boilerplate/` (a template for *writing*
a prefab's own README): all of it is repo infrastructure or payload-coupled prose that stays
in the renamed content repo, not something with a fate among "generate/port/salvage/delete."

One exact duplicate worth naming: `static/docs/guides/navigation/encoding-parameters-in-urls/
README.md` is byte-identical to `docs/guides/navigation/encoding-parameters-in-urls.mdx` (the
`docs/` copy, salvaged) — a leftover of the old `##head##` fetch protocol's raw-markdown
serving. Classified `Delete`, not `Salvage`, so it isn't counted as a second thing to migrate.

Zero files unclassified. Counts: 112 generated (exact match to spec), 24 port (spec said 23
— `docs/guides/editor/keybindings.md` is a legitimate addition, not in the spec's named
`javascript/` count), 33 salvage (exact match, plus this run separately found 4 more in
`visualizing-data/` the spec didn't enumerate — same pattern, applied by analogy, not
double-counted against the 33), 69 delete (spec said "60+" — the gap is `build-alongs/` (5)
and `getting-started/` (8), neither named in the spec's delete list but both fit its own
stated criteria), 193 stays.

**Satisfies ALPHA-006 acceptance criterion 5.** Criterion 6 (no `noodl.net`/`docs_2-9`
strings outside gitignored bundles) is still open — the two remnants already on record
(`AiSettingsSection.tsx:333`, `projectmodel.editor.ts:44`) weren't touched; that's a
decision (remove the AI-docs card vs. write a real page), not this task's to make.
