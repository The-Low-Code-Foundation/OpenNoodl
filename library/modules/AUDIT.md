# Module audit & triage — LIB-003
> **2026-09-05 (later) — LBR-007: `pdf-viewer` was broken, and the fix is a dependency mechanism.**
> `modules/pdf-viewer` failed at runtime with `Can't find component model for module.inlineHtml` —
> it instantiates a node type only `modules/custom-html` registers, and **nothing installed it**.
> Fixed at the mechanism rather than the entry: `library.json` now takes a `dependencies` array,
> resolved at build time by `build.js::resolveDependencies` (which **fails the build** on an unknown
> slug, a self-reference or a cycle, and flattens the transitive closure dependency-first) and
> consumed by `ModuleLibraryModel._installWithDependencies` → `_installDependency`, which installs
> each dependency through the same `_install` a click uses. `pdf-viewer` is **1.2.0** and now
> installs Custom HTML in the same click.
>
> **Re-bundling `custom-html` into `pdf-viewer` was rejected**, and the reason is not the
> duplication: a bundled copy and the standalone module both land in
> `noodl_modules/custom-html-module/` in the installing project, and **whichever installs second
> wins with nothing saying which version you ended up with**. That is why LBR-006 removed the
> bundled copy in the first place, and it does not generalise — the next entry that wants to share
> an avatar or an icon set would hit the same silent overwrite.
>
> One design fix fell out: `_install` used to take `onBeforePopup`/`onAfterPopup` and hold the node
> picker blocked across its own body. A dependency chain reopens that gap one level up, so the hooks
> moved to `_installWithDependencies` and `_install` no longer accepts them. `installModule` /
> `installPrefab` keep their signatures, so no caller changed.
>
> ⚠️ **The render gate was blind to all of this.** `render-check.js` builds its scratch project from
> the entry's own `project/` only, so it rendered `pdf-viewer` as nobody will ever have it — and an
> instance of a type the dependency registers does not draw nothing, it **throws**
> (`noderegister.ts`: "Unknown node type with name …"). A gate blind to the mechanism it exists to
> protect is a hole shaped like the defect. `checkEntry` now resolves declared dependencies
> transitively, merges their components (they never become the showcase — the entry is what is being
> measured) and copies their `noodl_modules` **after** the starter set and **before** the entry's
> own, so an entry shipping its own copy still wins. Measured after the change: `pdf-viewer` renders
> with `dependencies: ["modules/custom-html"]` and **zero console errors**, where it previously
> failed to find the component model.
>
> ⚠️ **Load-bearing, do not tidy:** `check.ts` derives `providesNodes` from
> `fs.existsSync(project/noodl_modules)`, which is why `pdf-viewer` keeps an otherwise-empty
> `noodl_modules/` holding only a README. The honest rule is now "provides nodes **or** declares
> dependencies"; until someone changes it, that placeholder directory must stay. Related:
> `verify-dist.ts` stubs every import of `modulelibrarymodel.ts` except `moduleCompatibility`, so if
> it ever grows a dependency check it must stub `moduleDependencies` too or pass vacuously.
>
> **New this session:** `keyboard-shortcuts` 1.0.0 — a `mod+k`-style shortcut node on the
> first-class `nodes:` kit path (CN-012), not the minified SDK shim the older kits carry. It
> unregisters on unmount via the runtime's own `addDeleteListener` (the leak NDA-012 found in
> `Screen Resolution`), matches modifiers exactly so `cmd+k` does not fire on Cmd+Shift+K, and by
> default suppresses shortcuts inside text fields **except** Escape and any Cmd/Ctrl/Alt chord —
> pulsing `blockedInTextField` instead, so the suppression is observable rather than silent.


> **2026-09-05 — LBR-003/004 ran. The shelf was rendered for the first time.**
> `npm run library:render` builds a page for every entry, seeds it with the Inter + Lucide modules
> a real new project ships, and measures what reaches the DOM. Two findings landed here:
>
> - **avatar is RETIRED and re-authored as `prefabs/avatar` 2.0.0.** Its 2018 prebuilt bundle
>   reaches into React's `__SECRET_INTERNALS…ReactCurrentDispatcher`, removed in React 19, so the
>   kit failed to load and *every* `Avatar` node rendered nothing —
>   `Kit "noodl-avatar" failed to load` in the console, `Can't find component model for Avatar`
>   after it. There was no source in the repo, only a 91KB bundle. The replacement is core nodes
>   only (clipped round Group + Image or initials + an overlapping Avatar Group with a `+N` badge),
>   so there is no bundle to go stale against the next React release, and it takes 9.6MB with it.
> - **pdf-viewer still fails on `module.inlineHtml`** — it depends on the standalone `custom-html`
>   module by README convention, and nothing installs it for you. `Can't find component model for
>   module.inlineHtml`, then `Unknown node id`. This is phase-65 follow-up #3 (no dependency
>   mechanism exists) with a measurement attached now.
>
> Everything else in `modules/` rendered or has no visual surface. See `library/prefabs/AUDIT.md`
> for the icon finding, which was the large one.

> **2026-08-22 — phase-65 blitz supersedes parts of this record.** The module set is now **30
> entries**. RETIRED (Richard's ruling, no-integration-library policy): google-sheets,
> google-analytics, parse-cloud-function. RE-TYPED to prefabs (register zero nodes): image-cropper,
> panning-and-zooming-control, shake-detector. RE-AUTHORED: mapbox → **maplibre** 1.0.0 (BSD-3
> maplibre-gl 4.7.1 vendored, zero-config demo style — the proprietary-redistribution question is
> gone). UNBUNDLED: avatar 1.1.0 (embedded 1865-glyph material-icons removed — the picker fight is
> over; repeated-sibling-subtree fixed), pdf-viewer 1.1.0 (embedded custom-html removed; depends on
> the standalone module via README convention). LICENCE SWEEP: 22 LICENSE texts placed across 14
> entries; **no GPL/proprietary code found anywhere**. NEW wave-1 modules: clipboard, file-download,
> intl-format, virtual-list, drag-to-reorder, rich-text-editor (TipTap 3.30.2 vendored offline). The
> run-them-all residual (LBR-004) still stands. See `dev-docs/tasks/phase-65-the-library/TASKS.md`.

**Created:** 2026-07-25 (LIB-003 plumbing+inventory run)
**Source:** live module index
`https://the-low-code-foundation.github.io/opennoodl-docs/library/modules/index.json`
(26 modules, HTTP 200), cross-checked against the in-repo seed under
`library/modules/<slug>/` (LIB-001 seeded all 26).

## Status of this table

**These are triage _guesses_, not verdicts.** The real per-module audit —
install → inject → register → nodes function, on **both** React 18 and React 19
runtime pairings, in preview **and** a deploy build — is the residual tail of
LIB-003 and needs live preview+deploy verification on the primary checkout (the
`lerna exec` worktree trap makes a live run from this worktree lie). Nothing here
retires or ships anything; it is the map the live audit works down.

One machine-checked fact already: running the unified scanner's new ajv manifest
validation (`scanModuleManifests`) over all 26 seeded module packages produces
**0 warnings** — every seeded `manifest.json` parses and validates clean, so the
schema has no false positives against real content, and no module is malformed at
the manifest level.

## Triage legend

- **keep** — UI/utility, no API key or backend; expected to survive the audit.
- **fix** — keep the capability but likely needs repair/restyle or a dependency
  bump (e.g. a pinned CDN lib, React-19 global compat).
- **park/retire?** — integration/backend/API-key surface. Phase 21 policy is "no
  integration library, permanently" (these _predate_ that policy). The guess is
  to retire or hand off, but the call is deferred: some overlap the NodeGX
  backend work (Parse) or are pure client protocols (MQTT) and may stay.

## Triage table

| # | Module | Tags | Kind | Needs key/backend? | Triage (guess) | Note |
|---|--------|------|------|--------------------|----------------|------|
| 1 | PDF Viewer | UI | code (wraps custom-html) | no | **fix** | Built on the custom-html module; verify the PDF lib CDN still resolves. |
| 2 | Mapbox | UI, Service | code | **yes** (Mapbox token) | **park/retire?** | High-demand UI but needs a vendor token — integration surface. |
| 3 | Chart.js | UI | code | no | **keep** | The charting module. **Covers the "charts" expansion candidate — audit, don't re-author.** |
| 4 | Google Sheets | Service, Data | code | **yes** (Google auth) | **park/retire?** | Pure integration/data-source connector. |
| 5 | GraphQL | Data, Networking | code | endpoint, no vendor key | **fix** (review) | Generic query helper, not a specific backend — borderline; verify before parking. |
| 6 | QR Scanner | Device | code | no | **keep** | Scans QR from camera/image. Note: **there is no QR _generator/render_ module — that is a genuine gap** (see shortlist). |
| 7 | Custom HTML | UI, Code | code | no | **keep** | Foundational; other modules (PDF Viewer) build on it. |
| 8 | Simple Tooltips | UI | code | no | **keep** | Small, low-risk. |
| 9 | Marquee | UI | code | no | **keep** | Low value but harmless. |
| 10 | Form Validation | Data, Utility | code | no | **keep** | Utility node, no external deps. |
| 11 | Material Icons | UI | **iconset** | no (Google Fonts CSS) | **keep** | Ships with the new-project template. The `iconset` manifest reference case. |
| 12 | Font Awesome Brands | UI | **iconset** | no | **keep** | Icon set beyond Material — **the "icon set" candidate is partly already met.** |
| 13 | Font Awesome Solid | UI | **iconset** | no | **keep** | See above. |
| 14 | Markdown | Code | code | no | **keep** | **Covers the "markdown renderer" expansion candidate — audit, don't re-author.** |
| 15 | Avatar | UI | code (bundles material-icons) | no | **keep** | Verify the bundled material-icons copy doesn't collide with #11. |
| 16 | Image Cropper | UI, Utility | code (bundles material-icons) | no | **fix** | Common need (profile pics); check cropper lib + React-19 refs. |
| 17 | Panning and Zooming Control | UI, Utility | code (bundles material-icons) | no | **keep** | Large-image pan/zoom. |
| 18 | i18next Translation | Data, Utility | code | no | **keep** | i18n utility, no keys. |
| 19 | MQTT Module | Device, Networking | code | broker URL, no vendor key | **keep** (review) | Client protocol, not a hosted backend — likely stays. |
| 20 | Shake Detector | Device | code | no | **keep** | Niche accelerometer util. |
| 21 | Google Analytics | Service, Analytics | code | **yes** (GA id) | **park/retire?** | Tracking/service integration. |
| 22 | Lottie | UI, Animation | code | no | **keep** | **Covers the "Lottie/animation" expansion candidate — audit, don't re-author.** |
| 23 | Web Camera | Device | code | no | **keep** | getUserMedia wrapper. |
| 24 | Parse Cloud Function | Data, Networking | code | **yes** (Parse backend) | **park/retire?** | Overlaps the NodeGX backend track (WF-004 / phase-22 BAK). Reconcile there. |
| 25 | Geospatial Analysis | Data | code | no (Turf.js) | **keep** | Client-side GeoJSON utility. |
| 26 | Data Context | Data | code | no | **keep** | Share data down the component tree. Utility. |

### Triage tally (guess)

- **keep:** 16 · **fix:** 4 (PDF Viewer, GraphQL, Image Cropper, + Mapbox if kept) · **park/retire?:** 5 integration/key modules (Mapbox, Google Sheets, Google Analytics, Parse Cloud Function; MQTT & GraphQL under review).

## What this means for expansion

Three of the six expansion candidates in the LIB-003 spec **already exist live**
and only need auditing, not authoring:

- **charts** → Chart.js (#3)
- **markdown renderer** → Markdown (#14)
- **Lottie/animation** → Lottie (#22)

And "an icon set beyond Material" is **already partly met** by Font Awesome
Brands/Solid (#12, #13) via the `iconset` manifest type.

The genuine gaps in the candidate pool — high-leverage, no keys/backend, not
already present — are the expansion shortlist. That decision + rationale is
recorded in
[PROGRESS.md](../../dev-docs/tasks/phase-21-library-and-import/PROGRESS.md)
(Decisions, 2026-07-25 — Module expansion shortlist).

---

## LIB-003 module-tail work-log — 2026-07-25

Residual tail of LIB-003 (expansion authoring + docs). Plumbing half (startsWith
fix, scanner unification, manifest validation, inventory) was already merged; not
touched here. Worked in an isolated worktree — no live editor/deploy runs (the
`lerna exec`/`nx` trap makes them lie from a worktree).

### Modules authored (3, all no-keys/no-backend, self-contained)

| Slug | Kind | Node(s) | Bundled library | Licence | Icon |
|------|------|---------|-----------------|---------|------|
| `lucide-icons` | iconset (manifest-only) | — (icon picker glyphs) | lucide-static webfont, 1998 glyphs | **ISC** (Lucide Icons & Contributors) | placeholder |
| `qr-code` | code (React node) | `nodegx.qrcode` "QR Code" (Visual) | `qrcode-generator@1.4.4` | **MIT** (Kazuhiko Arase) | placeholder |
| `confetti` | code (trigger node) | `nodegx.confetti` "Confetti" (Utilities) | `canvas-confetti@1.9.3` | **MIT** (Kiril Vatev) | placeholder |

Notes:
- **lucide-icons** mirrors the font-awesome-solid iconset shape exactly: bundled
  `lucide.woff2` + `lucide.ttf`, a rewritten `styles.css` (`@font-face` → local font,
  a `.lucide` base class + 1998 `.icon-<name>::before{content}` glyph rules), and a
  manifest with `type:"iconset"`, `iconClass:"lucide"`, `codeAsClass:true`, and the
  full `icons` array. Renders as `<span class="lucide icon-heart">` per `Icon.tsx`.
  Lucide's own font CSS scopes the family to `[class^="icon-"]`; I added an explicit
  `.lucide` base class so it composes cleanly with the Noodl `iconClass` model.
- **qr-code** and **confetti** are **hand-authored, no build step**. Each `index.js`
  inlines the `@noodl/noodl-sdk` node-definition shim **verbatim** from the shipped
  custom-html/chart-js bundle (installs `Noodl.defineNode`/`defineReactNode` on top of
  the prelude's `defineModule`), then vendors the third-party lib inline and calls
  `Noodl.defineModule`. QR builds an inline SVG from the module matrix (styleable
  size/quiet-zone/fg/bg + L/M/Q/H error correction). Confetti is a `Celebrate` signal
  trigger with Burst/Fireworks/Cannon/Rain presets and count/spread/origin/colours
  inputs; the browser-only lib is wrapped in `if (typeof window !== 'undefined')` for
  SSR/SSG safety.
- **Icons are clearly-labelled procedural placeholders** (680×384 PNGs generated in
  this run: Lucide = purple square motif, QR = finder-pattern motif, Confetti =
  coloured dots). They are NOT the real rendered module output — replacing them with a
  proper render is a minor residual.

### Headless checks (both ran from the worktree; root+pkg node_modules symlinked)

- `npm run library:check` → **58/58 entries clean**, the three new modules `OK` with
  0 warnings. (First pass FAILed: `library.json` schema is strict — no `license` key,
  `provenance` must be exactly `{sourceUrl, importedAt}`. Fixed to conform; full
  licence/attribution kept in the code headers, README, and this log.)
- `npm run catalog:check` → **green, "Committed catalog is up to date"** (136 node
  types). Unchanged — see catalog decision below.
- All 9 new JSON files parse; both `index.js` files pass `node --check` and a
  stubbed-globals harness (registered node shape, QR SVG output, all 4 confetti
  presets + `Fired` signal verified headlessly).

### Catalog: RESIDUAL, not established (per SUB-004 policy)

Investigated whether module-registered nodes reach the build-time catalog: grepped
`packages/noodl-types/src/node-catalog.json` for chart-js's node — **0 hits**. The
catalog generator (`scripts/node-catalog/generate.js`) does not execute
`defineModule`, so **no mechanism exists** to get runtime module nodes into the
catalog. Per the task constraint I did **not** invent one. The three new modules'
nodes fall into SUB-004's documented dynamic-node **"skip port checks"** path (the
validator/AI stack tolerate them, can't type-check ports). `catalog:check` stays
green because nothing in the catalog changed.

### Docs

`library/modules/README.md` written: directory shape, `library.json` schema, code-
vs-iconset `manifest.json`, `defineModule`/`defineNode`/`defineReactNode`, the
`runtimes` field, the iconset `iconClass`/`codeAsClass` model, the no-build-step
hand-authoring pattern, the catalog skip-path note, and the dev loop (incl. the
worktree live-verify caveat).

### Residuals (cannot be completed from this worktree — must run on primary checkout)

1. **Live preview + deploy verification of each new module**, on **both** React 18
   and React 19 pairings (RUN-001 matrix): install → nodes appear in the picker →
   QR renders/updates, confetti fires each preset, Lucide glyphs show in the icon
   picker and on `Icon`/control nodes → same in a deploy build. Not attempted here.
2. **Real module icons** — replace the three procedural placeholder PNGs with actual
   rendered thumbnails.
3. **Existing 26-module live audit** — the triage table above is still read-level
   guesses; the install→inject→register→function pass on both pairings is unstarted.
4. **`library:build` + publish** of the three new zips (LIB-001 pipeline).
5. Optional: expose a QR data-URL **output** port (skipped — `outputProps` on React
   nodes unverified live; kept the node visual-only to stay safe).

---

## Static per-module audit — 2026-08-02 (LIB-003 headless half)

The 2026-07-25 table above is **triage guesses**, and says so. This section is the
**measured** static pass over all 29 entries: manifest correctness, licence
presence/accuracy, declared dependencies present on disk, dead/absent files,
http-dependency handling after the `startsWith` fix, version sanity, and — the
dimension nothing else in the repo checks — **which node types each module's
source actually registers**.

Everything here was obtained without an editor: the module bundles were run in a
browser-shaped `vm` sandbox with a `Noodl` stub recording
`defineModule`/`defineNode`/`defineReactNode`, and the deploy injector was driven
directly against the real deploy template. What that could *not* reach is listed
under "still needs the live pass".

### What each module actually registers

25 of 29 entries were exercised headlessly. **Four could not be**: their bundles
need a real React/DOM to reach their registration call, and the stub is not one.

| Module | v | Kind | Node types its source registers (measured) |
|---|---|---|---|
| Avatar | 1.0.1 | code+iconset | **not captured** — bundle needs real React (`ReactCurrentDispatcher`) |
| Chart.js | 1.4.3 | code | **not captured** — bundle needs real React (`ReactCurrentOwner`) |
| Confetti | 1.0.0 | code | `nodegx.confetti` |
| Custom HTML | 1.0.2 | code | `module.inlineHtml` |
| Data Context | 1.0.2 | code | `data_context.context`, `.getState`, `.setState`, `.subscriber` |
| Font Awesome Brands | 1.0.0 | iconset | — (467 glyphs) |
| Font Awesome Solid | 1.0.0 | iconset | — (1951 glyphs) |
| Form Validation | 1.3.0 | code | `noodl.net.validate` |
| Geospatial Analysis | 1.0.0 | code | `geospatial-analysis` (Turf.js API), `.turf.area`, `.turf.center`, `.turf.center-of-mass` |
| Google Analytics | 1.0.7 | code | `noodl.googleAnalyticsModule.sendAnalyticsData`, `.analyticsLoader` |
| Google Sheets | 1.7.0 | code | `noodl.gsheets.QuerySheetNode`, `.QuerySheetAggregateNode`, `.SheetRowNode` |
| GraphQL | 1.0.1 | code | `GraphQL Query` |
| i18next Translation | 1.0.3 | code | `i18next`, `Language Bundle`, `Translation` |
| Image Cropper | 1.4.0 | **iconset only** | — see "modules that register nothing" |
| Lottie | 1.0.1 | code | `Lottie` |
| Lucide Icons | 1.0.0 | iconset | — (1998 glyphs) |
| Mapbox | 2.0.0 | code | **not captured** — bundle throws in the stub |
| Markdown | 1.0.1 | code | `Markdown` |
| Marquee | 1.0.0 | code | `noodl.marquee` |
| Material Icons | 1.1.0 | iconset | — (2122 glyphs) |
| MQTT Module | 1.0.3 | code | `Send Message`, `Receive Message` |
| Panning and Zooming Control | 1.0.0 | **iconset only** | — see below |
| Parse Cloud Function | 1.0.0 | code | `net.noodl.parse-cloud-function` |
| PDF Viewer | 1.0.0 | code | `module.inlineHtml` (a **second copy** of Custom HTML) |
| QR Code | 1.0.0 | code | `nodegx.qrcode` |
| QR Scanner | 1.4.0 | code | `Camera QR Scanner`, `Image QR Scanner` |
| Shake Detector | 1.0.2 | **no module at all** | — see below |
| Simple Tooltips | 1.0.0 | code | **not captured** — bundle wants a real style target |
| Web Camera | 1.0.4 | code | `Web Camera` |

### Findings

**F1 — three "modules" register no nodes whatsoever.** The 2026-07-25 table calls
Image Cropper and Panning-and-Zooming-Control "code (bundles material-icons)".
That is **wrong**: neither ships any `main`/`index.js`. Their entire
`noodl_modules/` content is a `material-icons` iconset manifest; the functionality
lives in ordinary Noodl components in `project.json` built from core nodes.
**Shake Detector has no `noodl_modules/` folder at all** — it is `library.json` +
`icon.png` + `project.json`, three files. All three are prefabs wearing a module
label. They exercise none of the module code path. Not retired here — whether they
should be re-typed `prefab` is a product call, and `type` also drives install
routing.

**F2 — `material-icons` is bundled 4× in 2 mutually-incompatible versions.** The
standalone Material Icons module declares **2122** glyphs; the copies inside
Avatar, Image Cropper and Panning-and-Zooming-Control declare **1865**, and the
three copies' icon lists are byte-identical to each other. Neither list is a
subset of the other: the bundled list has **77** glyphs the standalone lacks, and
the standalone has **334** the bundled lacks. Since module identity is the folder
name and registration is presence-on-disk, installing one of these entries into a
project that already has Material Icons rewrites `noodl_modules/material-icons/`
— changing which glyphs the icon picker offers, in both directions. This is the
collision the old table guessed at for Avatar; it is real and it is four-way.

**F3 — `custom-html-module` is bundled twice, currently byte-identical.** Custom
HTML and PDF Viewer ship the same folder, same hash, both registering
`module.inlineHtml`. Benign today; it is a drift trap the moment either is updated
alone.

**F4 — two library versions were provably wrong, from one seeder bug (FIXED).**
`inferVersion` in `scripts/library/seed-from-live.js` matched only *dash*-separated
version tails and did not require a separator before the tail, so it silently
mis-read dot-separated upstream names:

| Entry | upstream zip | was | now |
|---|---|---|---|
| PDF Viewer | `pdf-viewer-1.0.0.zip` | `0.0.0` (matched the bare trailing `0`) | **1.0.0** |
| Shake Detector | `shake-detector-1.0.2.zip` | `2.0.0` (matched the bare trailing `2`) | **1.0.2** |
| *(prefab)* OAuth2 | `oauth2-0-2.zip` | `2.0.2` (ate the `2` out of the **slug**) | **not touched — prefabs are fenced; flagged to the prefab owner** |

The live index carries **no** version field, so the zip filename is the only
version signal — and `version` is what drives LIB-001's cache-busting zip name, so
a wrong one is exactly the forever-cache trap the schema warns about. The regex is
fixed (7/7 cases incl. both shapes and the slug-digit case); the two module
`library.json`s are corrected. **The OAuth2 prefab is still wrong.**

**F5 — licence coverage is adequate but uneven.** Corrected from a first pass that
only grepped `.js` and under-reported: the iconsets carry their notices as `/*! */`
banners in `styles.css` (Font Awesome Free 6.4.0 — CC BY 4.0 / SIL OFL 1.1 / MIT;
Lucide — ISC), Chart.js ships `index.js.LICENSE.txt`, and both hand-authored
modules carry accurate attribution headers. **Lucide's notice was inaccurate and is
fixed**: it read "Copyright (c) 2026 Lucide Icons and Contributors", a fabricated
year that also dropped the Feather/Cole Bemis portion; it now carries Lucide's
actual ISC notice. Still open: several seeded modules vendor substantial
third-party libraries with **no licence text anywhere** — Geospatial Analysis
(614 KB, Turf.js), Mapbox (1.2 MB), Markdown (313 KB), Lottie (270 KB), MQTT
(165 KB), QR Scanner (69 KB), i18next (58 KB), Simple Tooltips (87 KB), Form
Validation (72 KB). These are seeded third-party artefacts; asserting a licence on
their behalf is a human call, not one to invent here. **Mapbox additionally
references `api.mapbox.com` and bundles mapbox-gl assets — mapbox-gl v2+ is under
Mapbox's proprietary terms, so redistributing it in this library needs a legal
answer independent of the API-key policy.**

**F6 — the three new modules' `docsPath` 404s.** All 26 seeded entries' docs URLs
return 200; `lucide-icons`, `qr-code` and `confetti` return **404**. This is *not*
fixable in `library.json` — `scripts/library/build.js:101` falls back to
`/library/<type>/<slug>/`, the same path, when `docsPath` is omitted. These three
need real pages on the docs site (ALPHA-006 / LIB-001 publish territory).

### Checked and clean (no action)

- **Manifests**: all 27 manifests across the 29 entries parse and pass the ajv
  schema — 0 warnings from `scanModuleManifests`. No malformed manifest exists.
- **Declared dependencies**: every module declares `dependencies: []`; nothing is
  absent. No module relies on an http dependency URL, so the `startsWith` fix
  changed no shipped behaviour — it remains a latent-correctness fix, not one any
  current library entry depends on.
- **Stylesheets**: the iconsets' `browser.stylesheets` are **project-relative**
  (`noodl_modules/<name>/styles.css`), which is what `injectIntoHtml` expects —
  it applies `pathPrefix` only, never the module dir. Every local stylesheet and
  every `url()` font reference inside it resolves. Remote sheets (Google Fonts)
  stay verbatim.
- **Sourcemaps**: every bundle's trailing `//# sourceMappingURL=` resolves to a
  file that exists. (An earlier flag on Avatar was a false positive — inner
  concatenated bundle artefacts, not the file's own directive.)
- **Metadata fidelity**: label, description, tags and docsPath match the live
  index exactly for all 26 seeded entries — no drift.
- **Icons**: all 29 present; the three placeholders are replaced (see notes).

### Still needs the live pass — per module

Not mine: the editor is held by another session. Nothing below was attempted.

- **All 29**: install → inject → register → nodes usable, in preview **and** a
  deploy build, on **both** React 18 and React 19 pairings (RUN-001 matrix).
- **Avatar, Chart.js, Mapbox, Simple Tooltips** — *priority*: these four are the
  ones this pass could **not** exercise even headlessly. Their registration is
  unverified by any means. Chart.js especially: it is the charting module the
  expansion shortlist leans on.
- **Avatar, Image Cropper, Panning-and-Zooming-Control, Material Icons** — F2:
  install two of them into one project and confirm what happens to the icon set.
- **Custom HTML + PDF Viewer** — F3: install both, confirm `module.inlineHtml`
  double-registration is benign.
- **Mapbox, Google Sheets, Google Analytics, Parse Cloud Function** — still need
  the keep/park/retire decision the old table deferred; unchanged by this pass.
- **Lucide Icons, QR Code, Confetti** — the new three: picker glyphs, QR render/
  update, all four confetti presets, then the same in a deploy build.
