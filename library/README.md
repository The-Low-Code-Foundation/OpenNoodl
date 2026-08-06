# NodeGX library — source of truth

This is the tracked source for the Prefabs and Modules libraries shown in the
editor's node picker. It replaces hand-maintained zips on the docs site: every
entry here is a real, reviewable, diffable project directory plus a metadata
file, with a build step and a CI-gated check. See
[dev-docs/tasks/phase-21-library-and-import/LIB-001-LIBRARY-PIPELINE.md](../dev-docs/tasks/phase-21-library-and-import/LIB-001-LIBRARY-PIPELINE.md)
for the full design, and
[PROGRESS.md](../dev-docs/tasks/phase-21-library-and-import/PROGRESS.md) for
the hosting decision and its rationale.

## Layout

```
library/
  prefabs/
    <slug>/
      library.json     # metadata — see scripts/library/schema.json
      icon.png          # card icon (optional; filename is whatever library.json.icon says)
      README.md         # optional — how to configure this entry after install (FH-023)
      project/           # unpacked Noodl project — project.json (+ assets), or a v2 directory
  modules/
    <slug>/
      library.json
      icon.png
      project/
```

`library.json` fields (schema: [`scripts/library/schema.json`](../scripts/library/schema.json)):

| Field | Required | Meaning |
|---|---|---|
| `label` | yes | Display name on the library card |
| `description` | yes | Short card description |
| `type` | yes | `"prefab"` or `"module"` |
| `tags` | yes | Array of tag strings (filter chips in the UI) |
| `icon` | no | Filename of the icon image within this entry's directory |
| `docsPath` | no | Docs-site path for the "Read docs" link, e.g. `/library/prefabs/date-picker/` |
| `version` | yes | Semver content version (`x.y.z`). Bump this on any content change. |
| `minEditorVersion` | no | Lowest NodeGX editor version this entry is known to work with |
| `runtimeVersion` | no | noodl-runtime version this entry was authored/verified against |
| `provenance` | no | `{ sourceUrl, importedAt }` — where seeded content came from (LIB-001 import only; entries authored directly here can omit it) |

## Why source lives in this monorepo

Recorded 2026-07-25 (see PROGRESS.md Decisions): the content source of truth is
`library/` at the repo root, not the docs site and not a separate content repo.
`library:check` needs the editor's SUB-006 semantic validator and project
loader, which live here; the agents/CI that maintain content work here; and
content fixes go through the same review flow as code. The docs site
(`the-low-code-foundation.github.io/opennoodl-docs`) stays a dumb CDN — the
editor's fetch endpoint (`getDocsEndpoint.ts`) never changes.

## Build

```
npm run library:build
```

Produces `library-dist/` (gitignored — a build artifact, not source), which
mirrors the docs repo's `library/` path 1:1:

```
library-dist/
  prefabs/
    index.json
    <slug>-<version>.zip
    <slug>-<version>.png        # if the entry has an icon
  modules/
    index.json
    <slug>-<version>.zip
    ...
```

The zip (and icon) filenames carry the entry's content `version`. This is
deliberate: the editor caches a downloaded library zip forever once its target
folder is non-empty (`getModuleTemplateRoot` in `modulelibrarymodel.ts`) — so a
same-URL republish of a fixed prefab silently does nothing for existing users.
Baking the version into the filename means a content change **is** a URL
change, which makes that forever-cache correct instead of a trap.

## Check

```
npm run library:check
```

For every entry under `library/{prefabs,modules}/<slug>/`:

1. `library.json` exists and validates against `scripts/library/schema.json`
   (and its `icon`, if set, points at a file that exists).
2. `project/` loads as a Noodl project (v2 decomposed or legacy monolithic) —
   the same loader `scripts/validate-project.ts` uses.
3. The SUB-006 semantic validator reports **zero errors** for the project.
4. **Fonts** (FH-006). No entry may reference a font file it does not ship, and
   no entry may ship or name a **retired** font family. The design system is
   Inter (POL-006: a new project gets Inter + Lucide); `Roboto` is retired.

This is wired into CI (`.github/workflows/pr.yml`, job `library`).

**Why the font rule exists:** the font picker lists every `ttf/otf/woff/woff2`
file it finds anywhere under the project directory, grouped by folder
(`fontItems.ts` → `loadFontItems`). So importing a prefab that bundles a stray
family puts a folder heading and an entry into the user's picker that they
never asked for and cannot explain — the whole seeded library shipped Roboto,
and a user's first prefab import produced a lone `fonts/Roboto` group. The rule
is deliberately enforced over the *whole entry*, not just its text styles: a
`fontFamily` sits on any node parameter, and a family name also hides in a CSS
string inside a Javascript node's `code` parameter (a JSON *value*, not a
`fontFamily` key) and in the minified bundle of a code module. All three forms
were live in this tree.

**Caveat the check does not cover:** the runtime derives a CSS family name from
the *filename* (`fontloader.ts` — `Inter-Medium.ttf` registers as family
`Inter-Medium`). A hand-written `font-family: Inter, …` in an injected CSS
string therefore does **not** resolve to the bundled TTF; it resolves only if
the viewer's machine has that family installed, and otherwise falls back. The
check enforces which family is *named*, not that a bare CSS name resolves.

**Errors vs. warnings:** content seeded from the live docs-site library
(LIB-001 step 3) is committed *as-is* — repairing or restyling it is
LIB-002/LIB-003's job, not this gate's. So `library:check` only fails on
validator **errors** (a broken reference: unknown node type, nonexistent
port); it reports warning counts but does not gate on them. New entries
authored directly in this repo going forward are expected to be
warning-clean too — nothing stops tightening this gate later once LIB-002/003
land.

## Publish

Publishing = copying the contents of `library-dist/` over the docs repo's
`library/` path:

```
library-dist/prefabs/*  ->  <docs-repo>/library/prefabs/
library-dist/modules/*  ->  <docs-repo>/library/modules/
```

This is a manual step today (no docs-repo write access from CI here). Record
every publish as a dated entry in
[PROGRESS.md](../dev-docs/tasks/phase-21-library-and-import/PROGRESS.md) under
**Log**, noting which entries changed version.

For local dev, `library:build`'s output can be served at the same path the
dev editor already knows how to point at (`useLocalDocs` → `localhost:3000`,
see `getDocsEndpoint.ts` / `main.js`) so content authors can preview unpublished
changes in a running editor without touching the live docs site.

## Seeding (LIB-001, one-time)

`scripts/library/seed-from-live.js` downloaded the live library on 2026-07-25
(prefabs + modules `index.json` and every referenced project zip + icon from
`the-low-code-foundation.github.io/opennoodl-docs`) and unpacked each into
`library/`, committed as-is. Every seeded entry's `library.json` carries a
`provenance` block recording its exact source URL and import date. This script
is not part of the regular build — it is not wired into any npm script — and
is kept only as a record of how the tree was seeded and in case a future
full re-import is ever needed.
