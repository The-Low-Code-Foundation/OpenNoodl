# POL-006 — New projects ship a font and an icon set

Covers reported item **8**.

## What was reported

> It seems like new projects get created with no Google font and no icon pack. Can we add a really
> nice basic Google Font by default to all new projects? Manually created or AI created. And add an
> icon pack so the icon node works. I really like Lucide icons for example, but you tell me if
> there's a better one.

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
