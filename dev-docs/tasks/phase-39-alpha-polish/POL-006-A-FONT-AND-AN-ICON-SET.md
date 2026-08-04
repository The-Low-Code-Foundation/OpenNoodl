# POL-006 — New projects ship a font and an icon set

Covers reported item **8**. **Status: done.** All seven criteria measured in the running editor and
in a real deploy build. See [What was built](#what-was-built) at the bottom — and read
[the stale-premise note](#️-the-font-half-of-this-spec-is-stale--measured-2026-08-04) below before
the mechanism section, which is wrong about fonts.

## What was reported

> It seems like new projects get created with no Google font and no icon pack. Can we add a really
> nice basic Google Font by default to all new projects? Manually created or AI created. And add an
> icon pack so the icon node works. I really like Lucide icons for example, but you tell me if
> there's a better one.

## ⚠️ The font half of this spec is stale — measured 2026-08-04

**`--font-sans` is not dangling.** It is defined in
[`DefaultTokens.ts:357`](../../../packages/noodl-editor/src/editor/src/models/StyleTokensModel/DefaultTokens.ts#L357)
as the system stack, and REV-009 stamps the whole `:root` block into **both** surfaces:
`html-processor.ts:57` for a deploy, `PreviewTokenInjector` for the preview. Measured in the running
editor:

```
generateProjectTokenCss({ getMetaData: () => undefined })
  → "  --font-sans: ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji';"
```

So **criterion 5 was already met before this task started**, and the section below claiming the
family "resolves to nothing and the browser falls back to its default serif/sans" is wrong — it
resolves to the platform UI font (San Francisco on macOS). Whatever made Richard's component look
basic in POL-008, it was not a missing font family.

That does not make the task empty; it changes what it is. Richard asked for *"a really nice basic
Google Font by default"* — that is an improvement over the system stack, not the repair of a
dangling token. Slice 2 below is rewritten accordingly.

**Also measured:** a brand-new project (created through `LocalProjectsModel.newProject`, which is the
single path *both* the manual and the AI wizard take — so criterion 7 is one hook, not two) contains
exactly this and nothing else:

```
nodegx.project.json
components/_registry.json
components/App/{component,connections,nodes}.json
components/__page__/Home/{component,connections,nodes}.json
```

No fonts, no `noodl_modules/`, no assets of any kind. That half of the report stands.

**And two things the repo already has, which the spec did not know about:**

- **Inter is already vendored** — `packages/noodl-editor/src/assets/Inter/`, nine weights, with
  `LICENSE.txt` (SIL OFL). It is the editor's own UI font. TTF, not woff2, and there is no woff2
  encoder in the repo or on the machine (`woff2_compress`, `fonttools`, `pyftsubset` all absent), so
  TTF is what ships. `src/assets` is inside electron-builder's `files` allow-list, so it is on disk
  in a packaged build.
- **Lucide is already vendored** — `library/modules/lucide-icons/`, the full 1998-glyph ISC webfont,
  imported 2026-07-25 as an installable *library module*. Neither the icon set nor the font needs
  sourcing; both need wiring.

## The mechanism — confirmed, and worse than reported

### Fonts

The font picker offers eight system fonts (`COMMON_FONTS` in
[`fontItems.ts:6-15`](../../../packages/noodl-editor/src/editor/src/views/panels/propertyeditor/components/fontItems.ts#L6-L15)) plus any
`.otf/.ttf/.woff/.woff2` found in the project directory. A new project has none, so the list is
Arial, Helvetica, Times New Roman, Impact, Tahoma, Courier New, Lucida Console, Arial Black.

Worse: `TextConfig`, `ButtonConfig` and `TextInputConfig` all default
`fontFamily: 'var(--font-sans)'` — and **`--font-sans` is defined in exactly one file in the whole
repo**, `packages/nodegx-backend/deploy/artifact/app/index.html`. It is not defined in the viewer's
`static/viewer/index.html`, which instead `@font-face`s "Open Sans" and never exposes a token.

So in the editor preview and in a normal deploy, the default font family on every Text, Button and
Text Input resolves to nothing and the browser falls back to its default serif/sans. Richard's
"basic AF" component in POL-008 partly looks that way for this reason.

### Icon sets

The registration path already exists and works — `noodl_modules/<name>/manifest.json` with
`type: 'iconset'`, read by `scanModuleManifests` and shaped by
[`shared/utils/iconsets.ts`](../../../packages/noodl-editor/src/shared/utils/iconsets.ts).
Both consumers read it: the picker via `ProjectModel.listModules`, the preview and deploy HTML via
`injectIntoHtml`.

Nothing ships one. `NodeSharedPortDefinitions.addIconInputs` gives the Icon node its ports, the
picker opens, and there is nothing in it.

The file header records the asymmetry that decides the shape of this task: a **sprite** set is
self-describing (`{kind:'sprite', url, symbolId}`), needs no stylesheet injection, and
`noodl_modules/` ships verbatim in a deploy. A **font** set needs a stylesheet and a font file in
the document. **Ship Lucide as a sprite sheet** — it is the cheap, offline, no-CDN path, and it is
the path `iconsets.ts` says needs no registration work at all.

## Recommendation on the choices

**Icons: Lucide.** Richard named it, it is ISC-licensed, it is the same family POL-003 is taking
five editor glyphs from, and a single generated `sprite.svg` of `<symbol>`s is the whole
integration. Landing POL-003 and POL-006 together means one Lucide source in the repo, not two.

**Font: Inter.** SIL Open Font License, variable-weight, designed for UI at small sizes, and the
closest thing to a neutral default that will not date the projects people build this year.
Alternatives if you'd rather: **Figtree** (warmer, more character) or **Geist** (tighter, more
technical). Any of the three is defensible; Inter is the safe one.

**Ship it as files, not a CDN link.** A `<link>` to `fonts.googleapis.com` means a new project does
not render correctly offline, leaks the end user's IP to Google on every page load of every app
anyone builds, and breaks the moment someone deploys behind a firewall. Bundle the woff2s in the
project.

## What to build

**Slice 1 — a starter-assets bundle.** Decide where the files live so that both creation paths get
them. `EmbeddedTemplateProvider.download()` currently writes only `project.json`
([`EmbeddedTemplateProvider.ts:113-114`](../../../packages/noodl-editor/src/editor/src/models/template/EmbeddedTemplateProvider.ts#L113-L114));
it needs to copy a directory of assets too. Extend `ProjectTemplate` with an assets manifest rather
than hardcoding the copy — a template is the right owner of "what a project starts with".

**Slice 2 — the font.** Inter woff2s (400/500/600/700, or the variable font) into the project's
font folder, plus the `@font-face` declarations and a real `--font-sans` definition that the viewer
and the deploy HTML both see. **Fix the dangling `var(--font-sans)`**: either define the token in
`static/viewer/index.html` and the deploy template, or change the three ElementConfigs to name the
family directly. Defining the token is better — it keeps one place to change the project's font.

Confirm the font then appears in the property panel's font picker: `loadFontItems` reads the project
directory, so a bundled font should list itself with no picker change.

**Slice 3 — the icon set.** `noodl_modules/lucide/` with `manifest.json`
(`type: 'iconset'`, `iconSource: 'sprite'`, `sprite: 'icons/sprite.svg'`, `icons: [...]`) and the
generated sheet. Do **not** ship all ~1,500 Lucide glyphs — pick a curated set (100–200) covering
the common cases, or the picker becomes unusable and every project carries a large asset. Record the
selection criteria and the generator so the set can be regenerated.

**Slice 4 — both creation paths.** Richard asked for "manually created or AI created". Verify:
- launcher → New project → the embedded hello-world path;
- the launcher's AI scoping flow, whichever path it takes to `newProject`;
- a downloaded template (`templateRegistry.download`) — these ship their own files, so decide
  whether starter assets are merged in or whether a template is assumed complete. **Merged, but
  never overwriting** what the template brought.

**Slice 5 — the defaults actually apply.** A new project's Text node should *render* in Inter
without the author touching the font picker. Confirm in the preview, not in the property panel — the
declared-default rule (a declared `default` never runs its setter) has bitten this exact area twice
before.

## Criteria

1. A new project created from the launcher contains the font files and `noodl_modules/lucide/`.
2. A Text node in that project renders in Inter with no author action — verified in the preview.
3. The Icon node's picker opens with the Lucide set listed and glyphs previewing.
4. An icon chosen in the editor renders in the preview **and** in a deploy build.
5. `--font-sans` resolves in the viewer and in a deploy; no dangling `var()` remains in the three
   ElementConfigs.
6. Works offline — no request to `fonts.googleapis.com` or any CDN.
7. The AI-created path gets the same assets as the manual path.

## Traps

- **A green editor preview proves nothing about a deploy.** The preview and the deploy HTML take
  different injection routes; check both.
- `noodl_modules/` is absent from `build/ignore.ts`'s defaults, so it ships in a deploy — that is
  load-bearing for the sprite path and is worth re-confirming rather than trusting this sentence.
- `LocalProjectsModel.ts` is dirty in another session. See the concurrent-session note in the
  [README](README.md).
- Sprite URLs are stored **project-relative**; they must resolve in the editor preview and in a
  deploy, which share neither origin nor path prefix. `iconsets.ts` documents this — read it before
  choosing a URL shape.

## What was built

Two `noodl_modules/` installed into every new project by
[`starterAssets.ts`](../../../packages/noodl-editor/src/editor/src/models/template/starterAssets.ts),
called from the two branches of `LocalProjectsModel.newProject`. Verified end to end by
`scripts/pol39-live/pol006-starter-assets.js`, which creates a project, opens it, reads the running
preview and then runs a real deploy build — twelve checks, all green.

### The defect this task actually had, which nothing predicted

With the modules installed, the token resolving to Inter, and all four Inter faces registered in the
preview document, the Hello World text still rendered in **Times**.

```
el: { tag: "DIV", inlineFont: "", computed: "Times" }
rootFontSans: "Inter, ui-sans-serif, system-ui, sans-serif, …"
```

`TextConfig` *declares* `fontFamily: 'var(--font-sans)'` as a default, and **a declared default never
runs its setter** — the phase-30 class, hit here for the third time. The element reaches the DOM with
no font-family at all, and both viewer templates style `body` without setting one, so it inherits the
browser's serif.

So a font token needs an inherited floor, and there is exactly one artifact that reaches every
surface: `TokenResolver.generateCss`, which both `StyleTokensModel.generateCss` (preview, via
`PreviewTokenInjector`) and `generateProjectTokenCss` (deploy, via `html-processor`, shared with
SSR/SSG per RUN-002) come through. It now emits `body { font-family: var(--font-sans) }` after the
`:root` block. `body` is the weakest place to say it, so any node that sets its own family still
wins.

**Editing the two HTML templates instead would have been two copies of one decision** — which is
this spec's own first trap, and it would have been three copies once the cloud viewer was counted.

### The measurement that would have lied

`document.fonts.check('16px Inter')` returned **false** for four faces that were perfectly present.
A webface nothing has rendered yet sits at status `unloaded`, and `check()` answers false for it.
`await document.fonts.load(...)` first, then check. The first version of the driver reported a
missing font and a broken layout where there was neither.

Equally: `getComputedStyle(el).fontFamily` returns the *declared* stack, so it says `Inter, …`
whether or not a byte was fetched. Both are recorded by the driver; only the pair of them is
evidence.

### The two deliverables Richard asked for

**A curated set.** 212 glyphs, grouped by what a person is looking for, generated by
`scripts/library/make-starter-iconset.js` (`npm run starter-iconset:check` gates it in CI). Every
name is validated against the font, so a typo fails the build rather than shipping a blank box.

**And a way past it.** The manifest lists 212; the **stylesheet carries a rule for all 1998**. So
adding any glyph from lucide.dev is one line in one JSON file — no new asset, no regeneration, no
network. That split is the whole point, and it is why the stylesheet was *not* trimmed to the
curated set: 80KB saved would have made the expand story false. The icon picker says so in a footer,
which is where a person meets the limit, and it now has an empty state — before this it rendered a
blank box when a project had no sets, indistinguishable from a picker that failed to load.

### Decisions taken

- **Inter as TTF, four weights** (400/500/600/700 — exactly the four the shipped Text/Button defaults
  reference through `--font-normal`/`--font-medium`/`--font-semibold`/`--font-bold`). No woff2:
  `woff2_compress`, `fonttools` and `pyftsubset` are all absent from the repo and the machine, and a
  font nobody can regenerate is worse than a larger one. woff2 would take the 1.25MB to roughly
  400KB whenever that tooling lands.
- **Lucide as woff2 only.** The library module also ships an 844KB TTF for browser support no NodeGX
  target needs; the starter set drops it and the generator strips the matching `src:` entry, because
  a stylesheet naming a file that is not there is a 404 in every app anyone builds.
- **A new project is now 1.7MB**, up from ~30KB. That is the cost of rendering its own defaults
  correctly and working offline.
- **The Inter TTFs are not duplicated in the repo** — `starterAssets.ts` copies them from
  `src/assets/Inter/`, the editor's own UI font, which electron-builder already packages.
- **`--font-sans` names Inter for every project, not just new ones.** A project without the module
  simply falls through to the next name in the stack; nothing has to know whether it is there.
