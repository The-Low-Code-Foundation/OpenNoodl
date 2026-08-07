# UIX-011: Legacy CSS-Background Icon Retirement

## Metadata

| Field | Value |
|-------|-------|
| **ID** | UIX-011 |
| **Phase** | Phase 23 — Visual Refresh (Track I) |
| **Tier** | 2 — surfaces (follow-up) |
| **Priority** | 🟠 High for correctness, Medium for looks — **these icons cannot theme** |
| **Difficulty** | 🟡 Medium (legacy imperative-view surgery, not drawing) |
| **Estimated Time** | 1–1.5 weeks |
| **Prerequisites** | UIX-007 (the `Icon` component + convention); UIX-008 (light theme, which is what exposes the defect) |
| **Branch** | `task/uix-011-legacy-css-icons` |
| **Recommended executor** | 🟠 **Opus 4.8** — the work is migrating imperative legacy `View` subclasses off CSS `url()`; the failure modes are layout-shaped and only visible live |

## Objective

Retire the editor's duplicate, theme-frozen icon set — 255 SVGs under
`packages/noodl-editor/src/assets/icons/` driven by CSS `url()` — onto the one
`currentColor` `Icon` component, and delete the originals.

## Background

UIX-007 unified iconography in `noodl-core-ui`. UIX-009's sweep found that the editor kept a
**second, parallel icon set** that the unification never touched, because it is not imported by
any component — it is referenced from stylesheets as `background-image: url(...)` and
`content: url(...)`.

**This is a correctness defect, not just an inconsistency.** An SVG referenced through CSS
`url()` is fetched and rendered as an *independent document*. It does not inherit anything from
the referencing element — `currentColor` inside it resolves against its own root, i.e. black.
Measured at task creation: **zero of the 142** files in `assets/icons/core-ui-temp/` contain
`currentColor`; they carry baked fills at a 25×25 viewBox. So every one of these glyphs is
frozen at its authored colour and **cannot respond to the light theme UIX-008 shipped**. They
render acceptably in dark because they were drawn for dark. That is luck, not design, and it is
the same class of latent light-theme landmine UIX-009 fixed in `style.css`.

The directory name `core-ui-temp` is itself the tell: a staging copy that outlived its migration.

## Current State

Inventory measured 2026-07-26:

| Location | SVGs | Notes |
|---|---|---|
| `packages/noodl-editor/src/assets/icons/core-ui-temp/` | 142 | Duplicates core-ui's `icon-component` set (`home`, `component`, `caret_down`, … all exist in both). Zero `currentColor`. |
| `packages/noodl-editor/src/assets/icons/` (root) | 86 | Mixed vintage |
| `packages/noodl-editor/src/assets/icons/editor/` | 27 | Editor-specific glyphs |

Thirteen legacy stylesheets consume them via `url()`:

| Stylesheet | `url()` refs |
|---|---|
| `src/assets/css/style.css` | 21 |
| `src/editor/src/styles/componentspanel.css` | 15 |
| `src/editor/src/styles/propertyeditor/propertyeditor.css` | 11 |
| `src/editor/src/styles/createnewnodepanel.css` | 6 |
| `src/editor/src/views/lessons/LessonLayerView.css` | 4 |
| `src/editor/src/styles/layoutpanel.css` · `propertyeditor/pages.css` · `views/DeployPopup/deploypopup.css` · `views/nodegrapheditor/InspectJSONView/InspectPopup.module.scss` | 2 each |
| `propertyeditor/{queryeditor,variantseditor,visualstates}.css` · `views/TextStylePicker/TextStylePicker.css` · `views/ConnectionPopup/ConnectionPopup.module.scss` · `views/panels/GitHubPanel/.../ConnectToGitHub.module.scss` | 1 each |

(`assets/lib/fontawesome/*` and `core-ui/src/styles/global.css` also match a `url()` grep — those
are font loads, **not** icons. Leave them.)

The consumers are imperative `View` subclasses, which is why this was deferred: replacing a
CSS background with a React `<Icon>` means finding the element's construction site in
hand-rolled DOM code, not editing JSX.

## Desired State

- Every icon in user-visible editor chrome rendered through the core-ui `Icon` component,
  inheriting `currentColor` and therefore theming correctly in both light and dark.
- `assets/icons/core-ui-temp/` **deleted entirely** — it is a duplicate; its glyphs already exist
  in core-ui.
- The root and `editor/` sets reduced to only those glyphs with no core-ui equivalent, migrated
  into core-ui's `icon-component/` under the UIX-007 convention (and thus inherited by UIX-010's
  redraw pass).
- Zero `url()`-to-SVG references left in editor stylesheets; a ratchet or lint rule keeps it that way.

## Scope

**In scope**

- The 13 stylesheets above and the imperative views that own their markup.
- All three icon directories under `packages/noodl-editor/src/assets/icons/`.
- Adding any genuinely-unique editor glyph to core-ui.

**Out of scope**

- Redrawing glyphs to the stroke grid — **UIX-010** owns drawing. Do not both edit
  `noodl-core-ui/src/assets/icons/icon-component/`. This task *moves* and *deletes*; if a
  migrated glyph is fill-drawn, hand it to UIX-010's list rather than redrawing it here.
- Font Awesome (a separate retirement question; note it, do not start it).
- The viewer-frame stylesheet (runtime, not editor chrome).
- Functional behaviour of any panel touched.

## Approach

1. **Map before moving.** For each `url()` reference: which glyph, which core-ui equivalent (by
   filename — most are exact duplicates), which view constructs the element. Put the table in
   NOTES.md before changing code; it is the whole risk of the task.
2. **Delete the free ones first.** Any `url()` whose glyph has an exact core-ui twin and whose
   consumer is already a React component is a cheap swap. Bank those, then face the imperative views.
3. **Migrate per view, not per stylesheet.** A stylesheet's icons often belong to several views;
   a view's icons are one coherent change you can verify by opening that panel.
4. **Watch layout.** A CSS background occupies the element's box; an inline `<Icon>` is a child
   with its own box. Naive swaps shift alignment by a few pixels in dozens of places — this is
   the failure mode that makes the task Medium rather than Easy. Compare against the corpus.
5. **Delete the directories last**, once the `url()` count is zero, and let the build prove it.

## Verification

- `npm run build` green; **zero** `url(` references to `.svg` remaining in editor `.css`/`.scss`
  (excluding fontawesome font loads) — assert it with a grep in CI alongside the hex ratchet.
- **Both-theme screenshot corpus** via the UIX-009 harness for every migrated surface. This is
  the point of the task: the acceptance test is that these glyphs now *change colour* between
  themes, which they provably cannot today.
- Panels open and function unchanged: components panel, property editor (+ pages, query,
  variants, visual states), create-new-node panel, layout panel, deploy popup, connection popup,
  text style picker, GitHub panel, inspect-JSON popup, lessons layer.
- No orphaned assets: the three icon directories are gone or contain only migrated-and-referenced glyphs.

## Notes

- Expect the count of *genuinely unique* editor glyphs to be small. The headline is that 142 of
  255 are a duplicate set — most of this task is deletion, which is the good kind of work.
- `LessonLayerView.css` is inside the Lessons subsystem, which carries the one documented
  hex-ratchet exemption. Do not widen that exemption; icons there migrate like everywhere else.
- If a consumer turns out to be dead code, deleting the view is a better outcome than migrating
  its icons. Check before you port.
