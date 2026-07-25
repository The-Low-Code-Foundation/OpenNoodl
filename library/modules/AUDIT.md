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
