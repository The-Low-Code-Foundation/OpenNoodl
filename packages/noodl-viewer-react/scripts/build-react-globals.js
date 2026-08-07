/**
 * Builds script-tag-loadable React globals for the app runtime.
 *
 * The runtime delivers React as static files loaded via <script> tags before
 * the runtime bundle, with webpack `externals` mapping react/react-dom to the
 * `window.React` / `window.ReactDOM` globals (see webpack-configs/webpack.common.js).
 * React 18 shipped ready-made UMD builds for this; React 19 does not, so we
 * build our own from the installed npm packages.
 *
 * Output: static/shared-react19/react.production.min.js + react-dom.production.min.js
 * — same filenames as the React 18 set in static/shared/, so the index.html
 * script tags and deploy file lists stay identical and runtime selection is
 * purely a question of which directory gets copied.
 *
 * Correctness note: react-dom MUST NOT bundle its own copy of react — two
 * copies means two internal dispatchers and "Invalid hook call" at runtime.
 * The `alias` below redirects react-dom's `require('react')` to the
 * window.React global that react.production.min.js has already installed.
 *
 * Run: node scripts/build-react-globals.js   (from packages/noodl-viewer-react)
 */

const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');

const OUT_DIR = path.join(__dirname, '..', 'static', 'shared-react19');
const SHIM_DIR = path.join(__dirname, 'react-global-shims');

const reactVersion = require('react/package.json').version;
const reactDomVersion = require('react-dom/package.json').version;

if (reactVersion !== reactDomVersion) {
  throw new Error(`react (${reactVersion}) and react-dom (${reactDomVersion}) versions differ`);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(SHIM_DIR, { recursive: true });

// Entry/shim sources are generated so the script is self-contained.
fs.writeFileSync(
  path.join(SHIM_DIR, 'react-entry.js'),
  `import * as React from 'react';\nwindow.React = React;\n`
);
fs.writeFileSync(
  path.join(SHIM_DIR, 'react-dom-entry.js'),
  // react-dom/client carries createRoot/hydrateRoot; merging matches where the
  // React 18 UMD put them, which is the shape the runtime entry calls.
  `import * as ReactDOM from 'react-dom';\nimport * as ReactDOMClient from 'react-dom/client';\nwindow.ReactDOM = Object.assign({}, ReactDOM, ReactDOMClient);\n`
);
fs.writeFileSync(path.join(SHIM_DIR, 'react-global.js'), `module.exports = window.React;\n`);

function banner(pkg, version) {
  return `/**\n * @license React\n * ${pkg}.production.min.js (global build for NodeGX, react@${version})\n *\n * Copyright (c) Meta Platforms, Inc. and affiliates.\n * This source code is licensed under the MIT license.\n */`;
}

const common = {
  bundle: true,
  minify: true,
  format: 'iife',
  platform: 'browser',
  logLevel: 'warning',
  define: { 'process.env.NODE_ENV': '"production"' }
};

async function main() {
  await esbuild.build({
    ...common,
    entryPoints: [path.join(SHIM_DIR, 'react-entry.js')],
    outfile: path.join(OUT_DIR, 'react.production.min.js'),
    banner: { js: banner('react', reactVersion) }
  });

  await esbuild.build({
    ...common,
    entryPoints: [path.join(SHIM_DIR, 'react-dom-entry.js')],
    outfile: path.join(OUT_DIR, 'react-dom.production.min.js'),
    banner: { js: banner('react-dom', reactDomVersion) },
    // Point react-dom's own `require('react')` at the already-installed global
    // instead of bundling a second React (which would split the dispatcher).
    alias: { react: path.join(SHIM_DIR, 'react-global.js') }
  });

  fs.writeFileSync(
    path.join(OUT_DIR, 'VERSION'),
    `react ${reactVersion}\nbuilt from npm packages by scripts/build-react-globals.js\n`
  );

  const sizes = ['react.production.min.js', 'react-dom.production.min.js']
    .map((f) => `${f}: ${(fs.statSync(path.join(OUT_DIR, f)).size / 1024).toFixed(0)} KB`)
    .join(', ');
  console.log(`Built React ${reactVersion} globals into static/shared-react19/ (${sizes})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
