const merge = require('webpack-merge').default;
const path = require('path');
const MinimizerPlugin = require('minimizer-webpack-plugin');
const shared = require('./shared/webpack.renderer.shared.js');
const getExternalModules = require('./helpers/get-externals-modules');

module.exports = merge(shared, {
  mode: 'production',
  /**
   * FLD-017, ruling **R5** (answered by Richard, 2026-09-10): minification is in
   * scope for 0.2.3.
   *
   * ## What it was, and why the line had no reason on it
   *
   * This file carried `minimize: false` with no comment and no linked issue from
   * the **initial fork commit** (`b9c60b07d`) until now — `git log -S'minimize: false'`
   * returned exactly that one commit. Nobody here chose it; it was inherited.
   *
   * ## Measured, not estimated
   *
   * Two full renderer builds, one variable changed:
   *
   * | build | the two renderer bundles |
   * |---|---|
   * | `minimize: false` | 55,600,724 B |
   * | this config | **26,033,417 B (−53.2%)** |
   * | full mangling, no `keep_*` | 24,966,424 B |
   *
   * **−29,567,307 B**, and the name-safety below costs **1,066,993 B of that —
   * 3.5%**, which is not a trade worth taking. On the archive FLD-017 left at
   * 198,017,608 B this is roughly another **−15%**.
   *
   * ## Why the risk is smaller than it looks
   *
   * 🔴 **`mode: 'production'` was ALREADY set above.** Tree-shaking, `usedExports`,
   * `sideEffects` and module concatenation have been live in every shipped build
   * all along; the only thing this changes is that terser now runs. Reading the
   * pair as "turning production mode on" overstates it by a lot.
   *
   * Measured on the surface mangling can actually reach: `constructor.name` has
   * **zero** call sites in the editor source, and the ~25 `.name ===` comparisons
   * are node-type, component and port names — **data strings out of project
   * JSON**, which terser never touches. Terser does not mangle property names
   * unless asked (`mangle.properties` is off by default). The two dynamic-eval
   * sites — `compilation/passes/sitemap.ts` (`new Function(codeText)`) and
   * `compilation/compilation.ts` (`eval(fileContent)`) — evaluate **external**
   * strings, project code and a build script read from disk, not identifiers out
   * of the surrounding mangled scope.
   *
   * ⚠️ `keep_classnames` and `keep_fnames` stay on anyway. They are the cheap
   * insurance against the one class of breakage nobody can grep for exhaustively,
   * and at 1 MB they are the least interesting number on this page.
   *
   * 🔴 **`minimizer-webpack-plugin`, NOT `terser-webpack-plugin`.** They are the
   * same code at the same version (5.6.1, `terser` underneath) and the first draft
   * of this used the wrong one. `terser-webpack-plugin` reaches this tree ONLY as
   * a transitive dependency of `docs-site`'s docusaurus and core-ui's Storybook —
   * `npm ls` says so — while `minimizer-webpack-plugin` is a **direct dependency
   * of webpack itself**, so it is present wherever webpack is. That matters here
   * more than usual: `scripts/noodl-editor/build-editor.ts` wipes `node_modules`
   * and reinstalls scoped to this package before every release build, and adding a
   * devDependency would mean touching `package-lock.json` — which is what left CI
   * blind for 34 days in September (register row **P30**). This adds no dependency
   * and no lockfile change.
   */
  optimization: {
    minimize: true,
    minimizer: [
      new MinimizerPlugin({
        terserOptions: {
          keep_classnames: true,
          keep_fnames: true
        }
      })
    ]
  },
  /**
   * 🔴 **Still generated, deliberately, even though FLD-017 stopped SHIPPING them.**
   *
   * `build.files` now excludes every `.map`, so none reaches a user — but a minified
   * bundle with no map anywhere is a stack trace nobody can read, and that is a
   * regression this task would otherwise have introduced into its own bug report
   * loop. The maps are build artefacts now: attach `index.bundle.js.map` to the
   * release so a trace from the field can still be symbolicated.
   */
  devtool: 'source-map',
  externals: getExternalModules({
    production: true
  }),
  output: {
    path: path.join(__dirname, '.././')
  }
});
