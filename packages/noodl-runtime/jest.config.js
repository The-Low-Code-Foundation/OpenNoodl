/**
 * The runtime is framework-neutral and touches no DOM APIs, so the default
 * node environment is correct for every suite here.
 *
 * PLAT-003 converts this package to TypeScript incrementally, so both .js and
 * .ts sources must run side by side: ts-jest handles the converted files,
 * babel-jest passes the plain CommonJS .js through as before.
 */
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
    '^.+\\.jsx?$': 'babel-jest'
  },
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
  testPathIgnorePatterns: ['/node_modules/']
};
