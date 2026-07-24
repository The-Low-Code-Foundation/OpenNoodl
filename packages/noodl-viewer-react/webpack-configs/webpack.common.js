//config shared for both regular viewer and deploy versions

const { runtimePath, runtimeTsRule } = require('@noodl/runtime/webpack-ts-rule');

module.exports = {
  externals: {
    react: 'React',
    'react-dom': 'ReactDOM'
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js'],
    fallback: {
      events: require.resolve('events/')
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
            // Disable cache to ensure fresh code loads during development
            cacheDirectory: false,
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
              url: false
              // modules: {
              //   exportOnlyLocals: true
              // }
            }
          }
        ]
      }
    ]
  }
};
