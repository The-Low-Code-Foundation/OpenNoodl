//shared config for regular (non-deploy) viewer

const path = require('path');
const { merge } = require('webpack-merge');
const { outPath } = require('./constants.js');
const common = require('./webpack.common.js');

const CopyWebpackPlugin = require('copy-webpack-plugin');

const noodlEditorExternalViewerPath = path.join(outPath, 'viewer');

module.exports = merge(common, {
  entry: {
    viewer: './index.viewer.js'
  },
  output: {
    filename: 'noodl.[name].js',
    path: noodlEditorExternalViewerPath,
    clean: true
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'static/shared',
          to: '.',
          noErrorOnMissing: true,
          info: { minimized: true }
        },
        {
          from: 'static/viewer',
          to: '.',
          noErrorOnMissing: true,
          info: { minimized: true }
        }
      ]
    })
  ]
});
