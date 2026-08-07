const path = require('path');
const { runtimeVersion } = require('./constants.js');
const webpack = require('webpack');
const { runtimePath, runtimeTsRule } = require('@noodl/runtime/webpack-ts-rule');

const prefix = `const _noodl_cloud_runtime_version = "${runtimeVersion}";`;

module.exports = {
  mode: 'production',
  entry: './src/sandbox.isolate.js',
  target: 'node',
  module: {
    rules: [
      runtimeTsRule,
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: [/node_modules/, runtimePath]
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  output: {
    path: path.resolve(__dirname, '../dist')
  },
  plugins: [
    new webpack.BannerPlugin({
      banner: prefix,
      raw: true
    })
  ]
};
