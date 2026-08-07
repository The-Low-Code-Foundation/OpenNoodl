const path = require('path');

const runtimePath = __dirname;

/**
 * webpack rule for compiling this package's TypeScript sources, for bundlers that consume
 * `@noodl/runtime` (the browser viewer and the cloud viewer).
 *
 * PLAT-003 converts the runtime to TypeScript file by file. The runtime is a CommonJS
 * package — its modules `require()` each other, and so do its consumers — so a converted
 * file exports with `export =`, which TypeScript only permits under `module: commonjs`.
 * Both viewers compile at `module: es6`/`es2020`, so the runtime's `.ts` files need their
 * own ts-loader instance pointed at the runtime's own tsconfig. Without it, `export =`
 * fails to compile; with a shared instance, the two configs fight over the same files.
 *
 * Consumers must (a) place this rule before their own `\.tsx?$` rule and (b) add
 * `runtimePath` to that rule's `exclude`.
 *
 * The runtime resolves through a `node_modules/@noodl/runtime` symlink, and webpack
 * resolves symlinks to their real path, so matching on the real package directory is what
 * fires — a `node_modules` pattern never would.
 */
module.exports = {
  runtimePath,
  runtimeTsRule: {
    test: /\.ts$/,
    include: runtimePath,
    use: [
      {
        loader: 'ts-loader',
        options: {
          instance: 'noodl-runtime',
          configFile: path.join(runtimePath, 'tsconfig.build.json')
        }
      }
    ]
  }
};
