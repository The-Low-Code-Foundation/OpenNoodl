# Module audit & triage — LIB-003

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
