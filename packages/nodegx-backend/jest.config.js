/**
 * Node-environment jest for the standalone backend service. TypeScript via
 * ts-jest; no DOM, no Electron.
 */
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json', isolatedModules: true }],
    // BAK-005: mirrors esbuild's `text` loader so the served dashboard's markup
    // and stylesheet load identically under jest and in the built bundle.
    '^.+\\.(html|css)$': '<rootDir>/tests/text-transformer.js'
  },
  moduleNameMapper: {
    // Mirrors the esbuild alias in scripts/build.js: the cloud runtime +
    // execution history are consumed from noodl-viewer-cloud/src.
    '^@cloud-runtime$': '<rootDir>/../noodl-viewer-cloud/src/index.ts',
    '^@cloud-runtime/(.*)$': '<rootDir>/../noodl-viewer-cloud/src/$1'
  },
  testMatch: ['**/tests/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/']
};
