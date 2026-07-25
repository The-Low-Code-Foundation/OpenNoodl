# Authoring NodeGX library modules

A **module** is a zip of a Noodl project whose `noodl_modules/<name>/` folders get
copied into a target project on install. At preview/deploy time the module
loader ([`projectmodules.ts`](../../packages/noodl-editor/src/shared/utils/projectmodules.ts))
writes `<script>`/`<link>` tags into the runtime HTML; the module's `index.js`
calls `Noodl.defineModule(...)` and the viewer registers its nodes. Registration
is presence-on-disk — there is no separate install manifest.

This directory holds the **source** for each module the library ships. `library:build`
(LIB-001) zips `<slug>/project/` into the published artifact and reads `<slug>/library.json`
for the card metadata.

## Directory shape

```
library/modules/<slug>/
  library.json                 # library-card metadata (validated by scripts/library/schema.json)
  icon.png                     # card thumbnail (~680×384 works well)
  project/
    project.json               # a minimal Noodl project ("components": [])
    noodl_modules/<name>/
      manifest.json            # REQUIRED — how the loader injects/registers this module
      index.js                 # code modules only — the defineModule entry point
      styles.css, *.woff2, …   # iconset / asset files
```

`<slug>` (the directory under `library/modules/`) is the library-card identity.
`<name>` (the directory under `noodl_modules/`) is the module identity copied into
the user's project — keep it unique and stable.

## `library.json`

Card metadata. Schema: [`scripts/library/schema.json`](../../scripts/library/schema.json)
(enforced by `npm run library:check`). It is **strict** — `additionalProperties: false`,
so only the documented keys are allowed.

| Field | Req | Notes |
|-------|-----|-------|
| `label` | yes | Display name on the card. |
| `description` | yes | One line. A good place to name the bundled library + licence. |
| `type` | yes | `"module"` (or `"prefab"`). |
| `tags` | yes | e.g. `["UI"]`. |
| `version` | yes | Semver `x.y.z`. Bumping it changes the built zip filename (cache-correctness). |
| `icon` | no | Filename within the entry dir. |
| `docsPath` | no | Docs-site path for the "Read docs" link. |
| `minEditorVersion` / `runtimeVersion` | no | Semver. Compat gating. |
| `provenance` | no | `{ sourceUrl, importedAt }` **only**. For in-repo-authored modules, either point `sourceUrl` at the upstream library you vendored, or omit the block. Licence/attribution beyond this belongs in the code header + this README, since the schema has no `license` field. |

## `manifest.json`

The loader reads this from `noodl_modules/<name>/`. Schema (lenient,
`additionalProperties: true`): [`projectmodules.ts`](../../packages/noodl-editor/src/shared/utils/projectmodules.ts).
A malformed manifest produces a **named warning**, never a silent skip.

### Code module

```json
{ "main": "index.js", "dependencies": [] }
```

- `main` → injected as `<script src=".../index.js">` (into `<%modules_main%>`, after the
  runtime prelude has defined `Noodl.defineModule`).
- `dependencies[]` → extra `<script src>` tags (into `<%modules_dependencies%>`, **before**
  `main`). Entries starting with `http` are kept verbatim; anything else is resolved
  relative to the module dir. (Historically `startsWith` here had the
  [`startsWith['http']` bug](../../packages/noodl-editor/src/shared/utils/projectmodules.ts) —
  now fixed; http deps inject as URLs.)
- `runtimes` (optional, defaults to `["browser"]`) → only `browser`-runtime modules are
  injected into the deploy/preview HTML. Set it if a module can't span a runtime.

### iconset

Manifest-only — no `index.js`. Consumed by the editor icon picker and the runtime
`Icon`/control nodes.

```json
{
  "name": "Lucide",
  "type": "iconset",
  "browser": { "stylesheets": ["noodl_modules/lucide-icons/styles.css"] },
  "iconClass": "lucide",
  "codeAsClass": true,
  "icons": ["icon-a-arrow-down", "icon-heart", "…"]
}
```

- `browser.stylesheets[]` → `<link rel="stylesheet">` (http absolute, else prefixed). Ship the
  `@font-face` + glyph CSS here; font `src` URLs are resolved relative to the CSS file.
- `browser.head[]` (raw HTML) and `browser.styles[]` (inlined `<style>`) are also available.
- `iconClass` + `codeAsClass` decide how a picked icon renders
  ([`Icon.tsx`](../../packages/noodl-viewer-react/src/components/visual/Icon/Icon.tsx)):
  - `codeAsClass: true` → `<span class="{iconClass} {code}">` (class-per-glyph fonts:
    Font Awesome, **Lucide**). `iconClass` is the base class that sets `font-family`;
    each entry in `icons` is a glyph class with a `::before { content }` rule.
  - `codeAsClass` falsy → `<span class="{iconClass}">{code}</span>` (ligature fonts:
    Material Icons). Each `icons` entry is the ligature text.

## `defineModule` / node definitions

The runtime HTML prelude only defines **`Noodl.defineModule(m)`** (it pushes `m` into
`window.__noodl_modules`, which the viewer then registers). The node-definition helpers
— `defineNode`, `defineReactNode`, `defineCollectionNode`, `defineModelNode` — come from
**`@noodl/noodl-sdk`**, which each shipped module bundles (chart-js, custom-html, …).

A module's `index.js` ends with:

```js
Noodl.defineModule({
  nodes: [ /* Noodl.defineNode(...) results */ ],
  reactNodes: [ /* Noodl.defineReactNode(...) results — visual React nodes */ ],
  setup: function () {}
});
```

`nodes` register through `NoodlRuntime.registerModule`; `reactNodes` are wrapped by
`createNodeFromReactComponent` in the viewer first.

**`Noodl.defineNode({ name, displayName, category, color, inputs, signals, outputs, methods, initialize, setup })`**
— a plain node. `inputs`/`outputs` are `name → typeString` or `name → { type, displayName, group, default }`.
`signals` are input triggers; emit an output signal with `this.sendSignalOnOutput('Name')`.

**`Noodl.defineReactNode({ …, getReactComponent, inputProps, inputCss, outputProps })`**
— a visual node. `inputProps[name]` maps an input to a React prop (delivered as
`props[name]`, seeded from `default`); the component is what `getReactComponent()` returns.
`React` is a runtime global (loaded before modules).

Input port `type` accepts a string (`'string'`, `'number'`, `'boolean'`, `'color'`, …) or an
object, e.g. `{ name: 'enum', enums: [{ label, value }] }`.

### Hand-authored modules without a build step

The three LIB-003 expansion modules (`lucide-icons`, `qr-code`, `confetti`) are authored
directly in-repo with **no webpack/SDK build**. Their `index.js` files inline a small,
guarded copy of the `@noodl/noodl-sdk` node-definition shim (verbatim from the shipped
custom-html/chart-js bundles) that installs `Noodl.defineNode`/`defineReactNode` when only
`defineModule` is present, then vendor their third-party library (MIT / ISC) inline and
call `Noodl.defineModule`. This keeps them dependency-free, offline, and readable — the
reference pattern for a new utility/UI module. (Browser-only libraries are wrapped in
`if (typeof window !== 'undefined')` so SSR/SSG loading doesn't throw.)

## Catalog note

Nodes a module registers at runtime are **not** in the build-time node catalog
(`packages/noodl-types/src/node-catalog.json`) — the catalog generator does not execute
`defineModule`, and getting runtime-registered nodes into it is the non-trivial problem
SUB-004 documented. Module nodes therefore fall into the catalog's **dynamic-node
"skip port checks"** path: the semantic validator and AI stack tolerate them but can't
type-check their ports. Only static-shape *core* nodes get catalog entries. `catalog:check`
stays green regardless of modules added here.

## Dev loop

1. Author the folder as above.
2. `node -e "JSON.parse(require('fs').readFileSync('<file>','utf8'))"` each JSON, or lean on
   `npm run library:check` (validates every `library.json`) and the loader's ajv manifest
   validation (surfaces malformed manifests by name).
3. `node --check <index.js>` for syntax; a stubbed-globals harness
   (`global.Noodl`, `global.React`, `global.window`) will run `defineModule` and let you
   assert the registered node shape headlessly.
4. **Live verification** — install into a project, confirm the nodes appear and function in
   preview **and** in a deploy build, on **both** React 18 and React 19 runtime pairings
   (RUN-001). This needs the live editor from the primary checkout; it cannot be done from
   an isolated worktree (the `lerna exec`/`nx` trap resolves to the main checkout).
5. `npm run library:build` to produce the publishable zips (LIB-001).
```
