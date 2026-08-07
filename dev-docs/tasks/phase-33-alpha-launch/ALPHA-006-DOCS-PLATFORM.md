# ALPHA-006: The docs platform, and the disposition of the old site

## Metadata

| Field | Value |
|-------|-------|
| **ID** | ALPHA-006 |
| **Phase** | Phase 33 — Alpha Launch (Track R) |
| **Tier** | 2 — makes the alpha worth running |
| **Priority** | 🟠 High — blocks [ALPHA-004](./ALPHA-004-USER-DOCS.md) |
| **Difficulty** | 🔴 Hard — not the writing. The docs site is the editor's content CDN for **seven** payload types, and only one of them is documentation |
| **Estimated Time** | 1.5–2 wks |
| **Prerequisites** | Phase 30 Tier 1 (the enriched catalog must be true before anything generates from it) |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🔵 **Opus/Fable 5** — the origin split is a decision with a long tail; getting it wrong silently empties three panels |

## Objective

Move NodeGX's documentation into this repository, generate the node reference from
the enriched catalog, and dispose of the old site's 431 files honestly — **without
breaking the six non-documentation payloads the editor fetches from the same
origin.**

## Why this task exists separately from ALPHA-004

ALPHA-004 says "generate the node reference" and "write the concept set". Both are
right, and neither is possible until someone decides where the site lives, what
serves it, and what happens to `opennoodl-docs`. That decision turned out to have a
much larger blast radius than the docs, so it is its own task.

ALPHA-004 keeps the writing. This task builds the thing it writes into.

## Current state — measured 2026-07-31

The site is `github.com/The-Low-Code-Foundation/opennoodl-docs`, a fork of
`noodlapp/noodl-docs` (~100 local commits), published to
`https://the-low-code-foundation.github.io/opennoodl-docs`.

**It is already a modern framework.** Docusaurus 3.1, MDX, SCSS,
`@easyops-cn/docusaurus-search-local`, a custom remark plugin for Noodl markup. There
is no framework upgrade to make here, and swapping generators would buy nothing and
cost the integrations below. *The content model is what needs replacing, not the
build tool.*

| | |
|---|---|
| Repo size | **413 MB** (GitHub API, 2026-07-31) |
| Files | 2,701 — 1,621 PNG, 315 MP4, 148 ZIP, 431 md/mdx, 50 GIF |
| Authored prose | ~206k words |
| Last push | **2025-12-06** — 8 months stale |

### Finding 1 — the coverage hole is exactly the NodeGX-era node library

Every `docs` URL in `node-catalog.json` cross-checked against the actual files in the
docs repo:

| Outcome | Count |
|---|---|
| Resolves to a real page | 102 |
| Points at the **wrong path** (page exists elsewhere) | 6 |
| Points at a page that **does not exist** | 33 |
| Node has **no `docs` URL at all** | 15 |

**54 of 156 nodes (35%) have no working documentation.** It is not a random 35%. It
is: all five BYOB data nodes, the entire realtime family (`SSE`, `WebSocket`,
`StreamBuffer`, `TextAccumulator`, `JSONStreamParser`, `PatternExtractor`), the whole
agentic-UI/state set (`GlobalStore` ×3, `ActionDispatcher`, `ActionHandler`,
`StateHistory` ×2, `StateSnapshot`, `OptimisticUpdate`), `Logic Builder`, the email
and verification nodes, `RequestMagicLink`, `SignInWith`, and `Sign File URL` —
i.e. **everything built since the revival began.**

The six wrong-path cases are worth naming because they are a link-integrity class,
not a content gap: `Button`/`Checkbox`/`Text Input` point at `nodes/visual/*` while
the pages live at `nodes/ui-controls/*`; `Model` points into the *JavaScript API*
reference; `Form` points at a **prefab**.

A broken link is worse than a blank one here:
[`docs-parser.ts:75`](../../../packages/noodl-editor/src/editor/src/utils/docs-parser.ts#L75)
swallows the failure and the help panel simply shows nothing.

### Finding 2 — the docs origin is the editor's content CDN, not a docs site

[`getDocsEndpoint()`](../../../packages/noodl-editor/src/editor/src/utils/getDocsEndpoint.ts)
is a two-line function returning one origin. It has **10 call sites across 7 payload
types**, and six of the seven are not documentation:

| Path fetched | Consumer | What breaks if it 404s |
|---|---|---|
| `/nodes/**/*.md` + `/static/nodes/**` | [`docs-parser.ts`](../../../packages/noodl-editor/src/editor/src/utils/docs-parser.ts), [`ConnectionPopup/DocsParser.ts`](../../../packages/noodl-editor/src/editor/src/views/ConnectionPopup/DocsParser.ts), [`NodeLabel.tsx`](../../../packages/noodl-editor/src/editor/src/views/panels/propertyeditor/components/NodeLabel/NodeLabel.tsx), [`NodePicker.hooks.ts`](../../../packages/noodl-editor/src/editor/src/views/NodePicker/NodePicker.hooks.ts) | node help panel silently empty |
| `/library/{prefabs,modules}/index.json` + `/static/library/**` | [`modulelibrarymodel.ts`](../../../packages/noodl-editor/src/editor/src/models/modulelibrarymodel.ts), `ModuleCard.tsx` | **Library panel empty** (LIB-001 gave it an `error` status distinct from empty — use it) |
| `/lessons/index.json` + `/static/lessons/**` | [`lessontemplatesmodel.js`](../../../packages/noodl-editor/src/editor/src/models/lessontemplatesmodel.js) | **Learn has no lessons** |
| `/projecttemplates/index.json` + icons + project zips | [`noodl-docs-template-provider.ts`](../../../packages/noodl-editor/src/editor/src/utils/forge/template/providers/noodl-docs-template-provider.ts), `ProjectsPage.tsx` | **New-project templates gone** |
| `/tutorials/index.json` | [`tutorialsmodel.js`](../../../packages/noodl-editor/src/editor/src/models/tutorialsmodel.js) | tutorials list empty |
| `/whats-new/feed.json` | [`whats-new.ts`](../../../packages/noodl-editor/src/editor/src/whats-new.ts), `NewsModal.tsx` | news modal empty (this is also one of ALPHA-005's nine data flows) |
| `/docs/**`, `/javascript/**` | browser only | — |

On disk that is `static/library/` (634 files), `static/lessons/` (318, including
`project.zip` per lesson), `static/docs/` (918), `static/nodes/` (210),
`static/projecttemplates/` (40), `static/tutorials/` (13).

> **This is the finding that shapes the task.** "Move the docs into the repo" is not a
> docs change. Done naively it empties the Library panel, the Learn lesson list and
> the new-project template picker at once, and the failures are silent by design.

Two paths on the site have **no consumer in source** and are simply dead:
`static/nodepickerdefaults/` (8 files) and `static/version.json`.

### Finding 3 — the in-editor help panel depends on a bespoke markdown protocol

[`docs-parser.ts:34`](../../../packages/noodl-editor/src/editor/src/utils/docs-parser.ts#L34)
fetches the **raw `.md` source** over HTTP and renders only what sits between
`{/*##head##*/}` fences — returning `null` if they are absent. It then resolves a
homegrown `@include "../_id-source.md"` transclusion itself, and rewrites relative
image and anchor URLs against the endpoint.

143 files carry those markers; 35 use `@include`. Any generated page must either
reproduce this protocol exactly or the protocol must be retired first. **Retiring it
is in scope here** (§1) because it decides the generator's shape.

### Finding 4 — the Help Center still ships Noodl

Already filed as **F69**, restated here because this task owns it:
[`HelpCenter.tsx`](../../../packages/noodl-editor/src/editor/src/views/HelpCenter/HelpCenter.tsx)
opens `docs.noodl.net/${version}/...`, `forum.noodl.net`, `noodl.net/support` and
Noodl's YouTube channel — and none of those go through `getDocsEndpoint()`, so they
reach the *actual Noodl site*. Its "Quick search docs" box queries a hardcoded
Algolia index **`docs_2-9`** ([line 25](../../../packages/noodl-editor/src/editor/src/views/HelpCenter/HelpCenter.tsx#L25))
— Noodl 2.9's documentation, describing a product we do not ship. The docs repo
itself moved to local search; the editor never followed.

## The rules that shape this task

**1. Derive, never author twice.** Inherited verbatim from ALPHA-004. The node
reference is generated from `node-catalog-enriched.json` — which already carries
`summary`, `description`, `whenToUse`, per-port prose, `runtimeBehavior`, `examples`,
`patterns` and `relatedNodes` for **156/156 nodes**, written to
[`PORT-DESCRIPTION-STYLE.md`](../../reference/PORT-DESCRIPTION-STYLE.md) and gated by
`catalog:merge:check`. Hand-picking sentences out of the old node pages reintroduces
exactly the duplication ALPHA-004 criterion 3 forbids.

**2. Documentation and payload hosting are two jobs. Separate them.** They are fused
today only because Noodl put the prefab zips in a Docusaurus `static/` folder. 400 MB
of MP4s and project zips must not enter this monorepo to get a docs site out of it.

**3. Nothing is deleted without a recorded disposition.** §4's table is the deliverable,
not a summary of one. A file that turns out to have been load-bearing must be
traceable to the line that decided it wasn't.

## Scope

### 1. Retire the `##head##` fetch protocol (do this first)

The help panel should read the **bundled enriched catalog**, not fetch markdown.
`node-catalog-enriched.json` already ships inside `@noodl/noodl-types`, which the
editor already depends on.

Rewrite the four consumers (`docs-parser.ts`, `ConnectionPopup/DocsParser.ts`,
`NodeLabel.tsx`, `NodePicker.hooks.ts`) to render `enrichment.summary` /
`description` / `ports[…]` for the selected node, with the docs URL demoted to a
"read more" link.

Why first, and why it is a net simplification:

- it works **offline**, which the current panel does not;
- it **cannot disagree with the ports on the node**, because it is the same artifact
  the picker and validator read — the 6 wrong-path links become structurally
  impossible;
- it closes all 54 undocumented nodes immediately, before a single page is generated;
- it removes the tightest coupling between a shipped binary and a website;
- it deletes the `@include` resolver and the marker regex.

⚠️ The property panel's rich `tooltip` HTML is a **separate** field and must keep
working — `PORT-DESCRIPTION-STYLE.md` is explicit that `tooltip` and `description`
are two documents for two readers. Do not collapse them.

### 2. The site, in this repo

A fresh Docusaurus 3 site at **`docs-site/`** (repo root, its own `package.json`, an
nx project so `lerna`/`nx` see it — see the `project.json` trap in WF-004's notes).
Not `docs/`, which is developer reference and stays exactly where it is.

- Publish to **the same origin** the editor already points at, so
  `getDocsEndpoint()`'s docs half needs no change and older builds keep working.
- Carry over from the old site only: the search plugin, and whichever of the
  `src/css/*.scss` files are still needed. Restyle to the UIX design tokens.
- **No `docusaurus.config.js` inheritance.** The old one still says
  `title: 'Noodl'`, `tagline: 'Dinosaurs are cool'`.

### 3. The generated node reference

A build step, `npm run docs:nodes`, reading `node-catalog-enriched.json`:

- one page per node, **grouped by the picker's categories**, not the old site's tree
  (they disagree today — `Button` is `ui-controls` on the site and `Visual` in the
  catalog);
- per node: summary, description, when-to-use, ports with types/defaults/descriptions
  split into values and signals, failure outputs, dynamic-port behaviour,
  `availableIn`, SSR compatibility, related nodes;
- deprecated and non-picker nodes rendered as such rather than omitted;
- **a CI staleness gate** — same shape and same reason as `cloud-library:check`: a
  silent regeneration is how a node quietly appears or disappears.

Generated pages are `.gitignore`d or committed-and-gated, but **never hand-edited**.
The header of every generated page must say so.

### 4. Disposition of the old repo's 431 authored files

The deliverable is a table in `docs-site/MIGRATION.md`, every file assigned one of
four fates. Measured totals:

| Fate | Where | Words | Disposition |
|---|---|---|---|
| **Generated** | `nodes/` (112 files) | ~41k | Not migrated. Superseded wholesale by §3. Use the old pages as a **cross-check**: where a page says something the enrichment does not (`query-records` is 1,897 words), the gap is filed against `docs/node-catalog/enrichment/`, not copied into prose |
| **Port near-verbatim** | `javascript/` (23 files) | ~8k | Checked against [`noodl-js-api.ts`](../../../packages/noodl-viewer-react/src/noodl-js-api.ts): the real surface is 14 namespaces and the docs accurately cover 13. **Add `Config` and `Env`.** Mostly code samples, so the stale-screenshot problem does not apply |
| **Salvage concept, discard walkthrough** | `docs/guides/{data,business-logic,navigation,user-interfaces}` (33 files) | ~52k → expect ~10k | The concepts survive; every step and screenshot does not. `data/arrays.mdx` + `objects.mdx` + `variables.mdx` are the closest existing text to the signal-vs-value explanation ALPHA-004 calls its highest-value paragraph. `navigation/encoding-parameters-in-urls.mdx` **overlaps SUB-013** — reconcile against the encoding work, do not copy |
| **Delete** | see below (60+ files) | ~35k | Describes a product we do not ship |

The delete list, with the reason each is not merely stale:

- **`docs/guides/cloud-data/` (10 files) + `cloud-logic/` (5)** — every page is built
  on creating a "Noodl Cloud Service" and inspecting it in the **Dashboard**. WF-007
  deleted `noodl-parse-dashboard`; BCN-001…004 replaced the backend contract beneath
  it. The topics need re-teaching; not one paragraph survives.
- **`docs/guides/deploy/` backend guides (4)** — `setting-up-backend-on-aws`, `-gcp`,
  `using-an-external-backend`, `hosting-frontend`. Superseded by phase 19 (Docker
  Compose, one nginx origin) and phase 26.
- **`docs/guides/collaboration/` (3)** — `migrating-from-noodl-hosted-git` concerns a
  dead service; `version-control` claims "All versions are backed up in the cloud",
  which is **false for NodeGX**.
- **`docs/guides/user-interfaces/figma-plugin.md`** — advertises a Figma plugin.
  There are **zero** matches for `figma` in `packages/noodl-editor/src` and
  `packages/noodl-viewer-react/src`.
- **`codebase/` (17) + `sdk/` (2)** — contributor docs, superseded by the 30 files in
  [`dev-docs/reference/`](../../reference/) and never belonged on a user-facing site.
- **`whats-new/`** — one file, dated 2024-09-24. Replaced by §5's feed.

### 5. The content origin, and what stays behind

`opennoodl-docs` **is not archived**. It stops being a docs site and becomes the
content host, stripped to the payloads in Finding 2:

```
library/**  static/library/**        (Library panel + prefab README prose, ~60k words / 179 files)
static/lessons/**                    (Learn — note these are the OLD lesson.html format)
static/projecttemplates/**           (new-project templates)
tutorials/ static/tutorials/**       (tutorials list)
whats-new/feed.json                  (news modal)
```

Everything in §4's *generated*, *port* and *delete* rows is removed from it, along
with `static/docs/` (918 images), `static/nodes/` (210), and the two dead paths
(`static/nodepickerdefaults/`, `static/version.json`).

Then **split the endpoint**:

- `getDocsEndpoint()` → the new docs site (§2).
- a new `getContentEndpoint()` → the stripped payload host.

Both may resolve to the same origin initially — the point is that the *call sites*
stop being ambiguous, so the two can move independently later. Six consumers move to
`getContentEndpoint()`; four stay on `getDocsEndpoint()` (and §1 removes all four).
Keep `useLocalDocs`' `localhost:3000` override working for both.

⚠️ **The prefab `library/` prose (179 files, ~60k words — a third of all the words in
the repo) does not come into this monorepo.** It is content-coupled to the library
payload, not to the editor. Dragging it in brings the 413 MB back through the side
door.

### 6. Repoint the Help Center (F69)

Dead Noodl links → the new site, this repo's issue forms (added 2026-07-30), and our
Discord. Replace the hardcoded Algolia client and `docs_2-9` index with the new
site's local search, or delete the in-editor search box and link out. **Deleting the
Algolia client also removes one of ALPHA-005's nine declared data flows** — if it
goes, `PRIVACY.md` must be updated in the same commit.

## Out of scope

- **Writing the concept set, getting-started or troubleshooting.** ALPHA-004.
- **Re-recording any screenshot or video.** 1,621 PNGs and 315 MP4s show the
  pre-refresh editor and are all wrong after phases 23–28. The new site ships with
  few images and no video; ALPHA-004 decides which are worth taking.
- **Re-authoring lesson content.** LEARN-001 replaced the engine and format; the
  318 files under `static/lessons/` are the old format and are hosted, not migrated.
- **The library's own content.** Phase 21 owns it.

## Acceptance criteria

1. **Every one of the seven payload types in Finding 2 still works in a packaged
   build**, demonstrated by opening the Library panel, the Learn lesson list, the
   new-project template picker, the tutorials list and the news modal and seeing
   populated content — not by reading the code. Each of these fails *silently*, so
   "no error in the console" is not evidence.
2. The node help panel renders for **all 156 nodes**, including the 54 that have no
   page today, with the editor offline.
3. The node reference is generated, and CI fails when it is stale.
4. No node's ports are documented in two places (ALPHA-004 criterion 3, enforced here
   because §3 is where it could be violated).
5. `docs-site/MIGRATION.md` accounts for **all 431** authored files, one fate each.
6. No string `docs.noodl.net`, `forum.noodl.net`, `noodl.net` or `docs_2-9` remains
   in `packages/noodl-editor/src` outside gitignored bundles. *(The `docs` field on
   node definitions may keep the literal as a stable key rewritten at read time, as
   today — but if §1 lands, prefer fixing the 6 wrong paths at source.)*
7. `PRIVACY.md`'s data-flow table matches reality after §6.

## Relationship to other tasks

- **[ALPHA-004](./ALPHA-004-USER-DOCS.md)** — depends on this. Its prerequisites gain
  ALPHA-006; its scope §3 ("the node reference — generated") moves here, leaving it
  the authored concept set, getting-started and troubleshooting. Its acceptance
  criteria 1, 4 and 5 are unchanged and remain the real test.
- **[ALPHA-005](./ALPHA-005-LEGAL-SURFACE.md)** — complete, but §6 changes a declared
  data flow.
- **Phase 21 (Library & Import)** — §5 leaves the library exactly where LIB-001 found
  it. If phase 21 later moves library content, it moves `getContentEndpoint()`, and
  the docs site is unaffected. That is the whole point of the split.
- **Phase 17 (Learn)** — §5 preserves the lesson index contract untouched. LEARN-002
  and ALPHA-004 must share the concept vocabulary; this task supplies neither.
- **Phase 30** — the enriched catalog is the input. If phase 30 Tier 1 has not landed,
  §3 generates from something not yet true.

## Suggested order

1. §1 (help panel off the network) — self-contained, immediately closes the 54-node
   hole, and decides §3's shape.
2. §5's endpoint split — a mechanical rename that de-risks everything after it.
3. §2 site skeleton, then §3 generator.
4. §4 disposition table, then the strip of the old repo. **In that order** — the table
   is what makes the deletion reviewable.
5. §6 Help Center, with the `PRIVACY.md` edit in the same commit.
