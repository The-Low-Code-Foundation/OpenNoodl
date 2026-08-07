//config shared for both regular viewer and deploy versions
const { runtimePath, runtimeTsRule } = require('@noodl/runtime/webpack-ts-rule');

module.exports = {
  externals: {},
  resolve: {
    extensions: ['.ts', '.js']
  },
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
  performance: {
    hints: false,
    maxEntrypointSize: 512000,
    maxAssetSize: 512000
  }
};
