const webpack = require('webpack'); //this must be included for webpack to work
const child_process = require('child_process');
const merge = require('webpack-merge').default;
const shared = require('./shared/webpack.renderer.shared.js');
const getExternalModules = require('./helpers/get-externals-modules');

// Track if electron has been started to prevent multiple launches
let electronStarted = false;

module.exports = merge(shared, {
  mode: 'development',
  // Use faster sourcemap for development - 'eval-cheap-module-source-map' is much faster
  // than 'eval-source-map' while still providing decent debugging experience
  devtool: 'eval-cheap-module-source-map',

  // CRITICAL FIX: Disable ALL webpack caching in development
  // This ensures code changes are always picked up without requiring `npm run clean:all`
  cache: false,

  externals: getExternalModules({
    production: false
  }),
  output: {
    publicPath: `http://localhost:8080/`
  },
  devServer: {
    client: {
      logging: 'info',
      // show error overlay in the electron windows
      overlay: {
        errors: true,
        warnings: false,
        runtimeErrors: false
      }
    },
    hot: true,
    host: 'localhost', // Default: '0.0.0.0' that is causing issues on some OS / net interfaces
    port: 8080,
    // Disable server-side caching
    headers: {
      'Cache-Control': 'no-store'
    },
    onListening(devServer) {
      // Wait for webpack compilation to finish before starting Electron
      // This prevents the black screen issue where Electron opens before
      // the bundle is ready to be served
      devServer.compiler.hooks.done.tap('StartElectron', (stats) => {
        // Only start once, and only if compilation succeeded
        if (electronStarted) return;
        if (stats.hasErrors()) {
          console.error('Webpack compilation has errors - not starting Electron');
          return;
        }

        electronStarted = true;
        console.log('\n✓ Webpack compilation complete - launching Electron...\n');

        // Build timestamp canary for cache verification
        console.log(`🔥 BUILD TIMESTAMP: ${new Date().toISOString()}`);
        console.log('   (Check console for this timestamp to verify fresh code is running)\n');

        // ELECTRON_RUN_AS_NODE makes the Electron binary boot as plain Node, so
        // `electron.app` is undefined and the editor never opens a window. VS Code
        // sets it in integrated terminals — strip it here as well as in start.ts,
        // since this config is also reachable via `npm run start` in the package.
        const electronEnv = { ...process.env };
        delete electronEnv.ELECTRON_RUN_AS_NODE;

        child_process
          .spawn('npm', ['run', 'start:_dev'], {
            shell: true,
            env: electronEnv,
            stdio: 'inherit'
          })
          .on('close', (code) => {
            devServer.stop();
          })
          .on('error', (spawnError) => {
            console.error(spawnError);
            devServer.stop();
          });
      });
    }
  }
});
