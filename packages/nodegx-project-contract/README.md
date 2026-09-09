# `@nodegx/project-contract`

Facts about a NodeGX **project file** that more than one package has to agree on.

Two modules live here, and they are here for the same reason: each was owned by a package that
another package could not depend on, and the exporter needs both.

| module | was | why it moved |
|---|---|---|
| `tokens.ts` | `noodl-editor` `StyleTokensModel/DefaultTokens.ts` | `@nodegx/export` resolves a project's stored tokens against the shipped defaults. Reaching into the editor's source tree by relative path made the exporter unpublishable and coupled it to the editor's file layout (HLS-001 AC2). |
| `logic-builder-io.ts` | `@noodl/runtime` `nodes/std-library/logic-builder-io.ts` | Same reason, from the runtime side. |

## 🔴 The invariant that made the Logic Builder move delicate, and how it survives

`logic-builder-io.ts`'s original header explains why it lived in `@noodl/runtime`: dynamic ports are
announced from the **viewer** window, which cannot see anything the editor window put on `window`,
so the one piece of code both halves call had to ship inside the runtime bundle.

**That is still true, and it still holds.** `@noodl/runtime`'s `logic-builder-io.ts` is now a
re-export of this module, and webpack inlines it into the runtime bundle exactly as before — the
bundled output is the same code in the same bundle. What changed is only which directory the source
sits in.

Two measured facts make that safe, and both are worth keeping written down:

- **Workspace packages are not `node_modules` to a bundler.** `@noodl/runtime/webpack-ts-rule.js`
  says it in its own comment: webpack resolves the symlink to the real path under `packages/`, so
  an `exclude: /node_modules/` never fires on a workspace package. This package's TypeScript is
  compiled by the consumer's ordinary `.ts` rule.
- **This package is plain ESM TypeScript.** The runtime needs its own ts-loader instance because
  its modules use `export =` under `module: commonjs`. Nothing here does, so nothing here needs a
  bundler rule of its own.

## Shape

Modules sit at the package root rather than under `src/`, deliberately: several tsconfigs in this
repo still use `"moduleResolution": "node"`, which ignores an `exports` map entirely. A flat root
means `@nodegx/project-contract/tokens` resolves under classic node resolution and under bundler
resolution alike, with no `exports` map and no alias in any of the eight webpack, jest and tsconfig
files that would otherwise have needed one.

`private: true` for now: `@nodegx/export` bundles this package's source into its own `dist/` with
esbuild, so the published exporter is self-contained and does not depend on an unpublished package.
If it ever needs publishing in its own right, it is a manifest change and a `build.mjs` copied from
`@nodegx/core` — nothing here has to move again.
