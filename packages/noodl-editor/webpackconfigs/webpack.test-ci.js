const merge = require('webpack-merge').default;
const shared = require('./webpack.test.js');

const config = merge(shared, {
  watch: false,
  output: {
    // No dev server in CI — SpecRunner.html loads the bundle from disk.
    publicPath: ''
  },
  cache: {
    // Separate cache name: this config differs from webpack.test.js (publicPath),
    // and two configs sharing one cache name poison each other's entries.
    // webpack-merge concatenates buildDependencies.config, so the merged list
    // covers both files. Invalidation proven 2026-08-27: a broken spec still
    // failed by name on a warm cache (2,424 cached modules), and editing this
    // file produced a cold rebuild.
    name: 'test-ci',
    buildDependencies: { config: [__filename] }
  }
});

// Built by webpack-cli, not webpack-dev-server: there is no server to configure,
// and leaving onListening in place would try to spawn Electron from a build step.
delete config.devServer;

module.exports = config;
