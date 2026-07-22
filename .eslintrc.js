module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: ['eslint:recommended', 'plugin:react/recommended', 'plugin:@typescript-eslint/recommended'],
  // Mirrors the generated-bundle entries in .gitignore. Without this, a local build
  // (webpack output lands inside src/) makes `lint:ci`'s error count drift with
  // whatever's sitting on disk instead of what's in git — the vendored
  // parse-dashboard-public/bundles/ stay lint-covered on purpose, so this isn't a
  // blanket `*.bundle.js` ignore.
  ignorePatterns: [
    'packages/noodl-editor/src/editor/index.bundle.js',
    'packages/noodl-editor/src/frames/viewer-frame/index.bundle.js',
    'packages/noodl-editor/src/main/main.bundle.js',
    'packages/noodl-editor/src/external/**'
  ],
  overrides: [],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  plugins: ['react', '@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-namespace': 'off',
    'no-prototype-builtins': 'off'
  },
  settings: {
    react: {
      version: 'detect'
    }
  }
};
