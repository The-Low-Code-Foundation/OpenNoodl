const merge = require('webpack-merge').default;
const path = require('path');
const child_process = require('child_process');
const shared = require('./shared/webpack.renderer.shared.js');
const getExternalModules = require('./helpers/get-externals-modules');

module.exports = merge(shared, {
  entry: './tests/index.ts',
  output: {
    filename: 'index.bundle.js',
    path: path.resolve(__dirname, '..', 'tests'),
    // https://github.com/webpack/webpack/issues/1114
    libraryTarget: 'commonjs2',
    publicPath: `http://localhost:8081/`
  },
  target: 'electron-renderer',
  mode: 'development',
  devtool: 'eval-cheap-module-source-map',
  // GAT-003: without a filesystem cache every `test:ci` rebuilt the whole test
  // bundle from scratch — 93s per run, including re-runs of an unchanged tree.
  //
  // ⚠️ NOT node_modules/.cache (webpack's default): make-worktree.sh symlinks a
  // worktree's package node_modules to the primary checkout's, so the default
  // location would share one cache between worktrees building DIFFERENT trees.
  // A directory inside the package itself is real (not symlinked) in every
  // worktree, so each tree gets its own cache. Gitignored.
  //
  // `buildDependencies.config` makes a change to this config (or anything it
  // requires, webpack follows the require graph) invalidate the cache — without
  // it a config edit silently builds the OLD configuration.
  cache: {
    type: 'filesystem',
    name: 'test',
    cacheDirectory: path.resolve(__dirname, '..', '.webpack-cache'),
    buildDependencies: { config: [__filename] }
  },
  externals: getExternalModules({
    production: false
  }),
  devServer: {
    host: 'localhost', // Default: '0.0.0.0' that is causing issues on some OS / net interfaces
    port: 8081,
    onListening(devServer) {
      //start electron when the dev server has started
      console.log('webpack dev server listening, starting electron with tests');
      child_process
        .spawn('npm', ['run', 'test:_start_electron'], {
          shell: true,
          env: process.env,
          stdio: 'inherit'
        })
        .on('close', (code) => {
          // The dev server is the process the caller is waiting on, so it has to
          // carry Electron's exit code out — otherwise a failing suite reads green.
          devServer.stop().then(() => process.exit(code === null ? 1 : code));
        })
        .on('error', (spawnError) => {
          console.error(spawnError);
          devServer.stop().then(() => process.exit(1));
        });
    }
  }
});
