/**
 * Loaders for the Electron main-process bundle.
 *
 * Until SUB-007 the main bundle had no TypeScript loader at all, which is why
 * `utils/projectmerger.js` carried the note "this file has to be javascript
 * and require until the main process uses webpack+typescript" — the git merge
 * driver runs in main and could only require plain JS. The driver now uses the
 * typed graph merger in `src/editor/src/versioning/`, so main needs to compile
 * TypeScript.
 *
 * `transpileOnly` deliberately: types are checked once by `npm run typecheck`,
 * and making the main bundle re-check the whole reachable graph on every dev
 * rebuild would cost seconds per iteration for no extra safety.
 */
module.exports = {
  module: {
    rules: [
      {
        test: /\.ts(x?)$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true
            }
          }
        ]
      }
    ]
  }
};
