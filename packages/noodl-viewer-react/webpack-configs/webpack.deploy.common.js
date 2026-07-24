const path = require('path');
const { merge } = require('webpack-merge');
const { outPath } = require('./constants.js');
const common = require('./webpack.common.js');

const CopyWebpackPlugin = require('copy-webpack-plugin');

const noodlEditorExternalDeployPath = path.join(outPath, 'deploy');

module.exports = merge(common, {
  entry: {
    deploy: './index.deploy.js'
  },
  output: {
    filename: 'noodl.[name].js',
    path: noodlEditorExternalDeployPath,
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
          from: 'static/shared-react19',
          to: 'react19',
          noErrorOnMissing: true,
          info: { minimized: true }
        },
        {
          from: 'static/deploy',
          to: '.',
          noErrorOnMissing: true,
          info: { minimized: true }
        }
      ]
    })
  ]
});
