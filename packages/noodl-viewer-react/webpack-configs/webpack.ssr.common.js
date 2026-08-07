const path = require('path');
const { outPath } = require('./constants.js');

const CopyWebpackPlugin = require('copy-webpack-plugin');

const { runtimePath, runtimeTsRule } = require('@noodl/runtime/webpack-ts-rule');

const noodlEditorExternalDeployPath = path.join(outPath, 'ssr');

module.exports = {
  entry: {
    deploy: './index.ssr.js'
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
          from: 'static/ssr',
          to: '.',
          noErrorOnMissing: true,
          info: { minimized: true }
        }
      ]
    })
  ],
  externals: {
    react: 'React',
    'react-dom': 'ReactDOM'
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js'],
    fallback: {
      events: require.resolve('events/'),
    }
  },
  module: {
    rules: [
      {
        test: /\.(jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            babelrc: false,
            cacheDirectory: true,
            presets: ['@babel/preset-react']
          }
        }
      },
      runtimeTsRule,
      {
        test: /\.ts(x?)$/,
        exclude: [/node_modules/, runtimePath],
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      },
      {
        test: /\.css$/i,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              url: false,
              modules: {
                exportOnlyLocals: true
              }
            }
          }
        ]
      }
    ]
  }
};
