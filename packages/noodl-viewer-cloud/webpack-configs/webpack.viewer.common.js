//shared config for regular (non-deploy) viewer

const path = require('path');
const { merge } = require('webpack-merge');
const { outPath, runtimeVersion } = require('./constants.js');
const common = require('./webpack.common.js');
const webpack = require('webpack');

const CopyWebpackPlugin = require('copy-webpack-plugin');
const GenerateJsonPlugin = require('generate-json-webpack-plugin');

const noodlEditorExternalViewerPath = path.join(outPath, 'cloudruntime');

const prefix = `const { ipcRenderer } = require('electron'); const _noodl_cloud_runtime_version = "${runtimeVersion}";`;

module.exports = merge(common, {
  entry: {
    sandbox: './src/sandbox.viewer.js'
  },
  output: {
    filename: 'sandbox.viewer.bundle.js',
    path: noodlEditorExternalViewerPath,
    clean: true
  },
  plugins: [
    new webpack.BannerPlugin({
      banner: prefix,
      raw: true
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'static/viewer',
          to: '.',
          noErrorOnMissing: true
        }
      ]
    }),
    new GenerateJsonPlugin('manifest.json', {
      version: runtimeVersion
    })
  ]
});
