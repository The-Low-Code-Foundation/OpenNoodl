// Node environment, like every other runner in this tree (see nodegx-core's config for why there
// is deliberately no jsdom here). The generator is pure file-in/file-out code; nothing needs a DOM.
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }]
  }
};
