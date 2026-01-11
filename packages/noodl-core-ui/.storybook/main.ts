import path from 'path';
import { fileURLToPath } from 'url';
import type { StorybookConfig } from '@storybook/react-webpack5';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const editorDir = path.join(__dirname, '../../noodl-editor');
const coreLibDir = path.join(__dirname, '../');

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.mdx', '../src/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-measure'
  ],
  framework: {
    name: '@storybook/react-webpack5',
    options: {}
  },
  webpackFinal: (config) => {
    const destinationPath = path.resolve(__dirname, '../../noodl-editor');
    const addExternalPath = (rules: any[]) => {
      for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        if (rule.test && RegExp(rule.test).test('.tsx')) {
          if (rule.include?.length) rule.include.push(destinationPath);
          else rule.include = destinationPath;
        } else if (rule.test && RegExp(rule.test).test('.ts')) {
          if (rule.include?.length) rule.include.push(destinationPath);
          else rule.include = destinationPath;
        } else if (rule.oneOf) {
          addExternalPath(rule.oneOf);
        }
      }
    };

    if (config.module?.rules) {
      addExternalPath(config.module.rules as any[]);

      config.module.rules.push({
        test: /\.ts$/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      });
    }

    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias,
      '@noodl-core-ui': path.join(coreLibDir, 'src'),
      '@noodl-hooks': path.join(editorDir, 'src/editor/src/hooks'),
      '@noodl-utils': path.join(editorDir, 'src/editor/src/utils'),
      '@noodl-models': path.join(editorDir, 'src/editor/src/models'),
      '@noodl-constants': path.join(editorDir, 'src/editor/src/constants'),
      '@noodl-contexts': path.join(editorDir, 'src/editor/src/contexts'),
      '@noodl-types': path.join(editorDir, 'src/editor/src/types'),
      '@noodl-views': path.join(editorDir, 'src/editor/src/views')
    };

    return config;
  },
  typescript: {
    reactDocgen: 'react-docgen-typescript'
  }
};

export default config;
