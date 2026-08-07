const merge = require('webpack-merge').default;
const shared = require('./webpack.test.js');

const config = merge(shared, {
  watch: false,
  output: {
    // No dev server in CI — SpecRunner.html loads the bundle from disk.
    publicPath: ''
  }
});

// Built by webpack-cli, not webpack-dev-server: there is no server to configure,
// and leaving onListening in place would try to spawn Electron from a build step.
delete config.devServer;

module.exports = config;
