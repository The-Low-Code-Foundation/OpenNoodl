const path = require('path');
const merge = require('webpack-merge').default;
const shared = require('./shared/webpack.shared.js');
const getExternalModules = require('./helpers/get-externals-modules');

/**
 * Development build of the Electron main process.
 *
 * `npm run dev` only ever ran webpack-dev-server for the *renderer*, so
 * src/main/main.bundle.js — the app's actual entry point — was whatever had last
 * been produced by a production build. Main-process changes silently did nothing
 * in dev. This config exists so the dev launcher can rebuild it.
 */
module.exports = merge(shared, {
  mode: 'development',
  target: 'electron-main',
  // Source maps so main-process stack traces point at src/main/*.js, not the bundle.
  devtool: 'source-map',
  externals: getExternalModules({
    production: false
  }),
  entry: {
    './src/main/main': './src/main/main.js'
  },
  output: {
    path: path.join(__dirname, '.././'),
    filename: '[name].bundle.js',
    libraryTarget: 'commonjs2'
  }
});
