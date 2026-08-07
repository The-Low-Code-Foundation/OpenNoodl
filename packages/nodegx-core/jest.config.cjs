/**
 * `testEnvironment: 'node'`, matching every other runner in the tree — there is no
 * `jest-environment-jsdom` here, and `packages/noodl-core-ui/jest.config.js` records why adding one
 * would leave every checkout failing until the next install.
 *
 * The React bindings are still covered: the logic that could be wrong (the selector snapshot cache)
 * is a DOM-free function in `src/selector.ts`, and the hooks themselves are rendered through
 * `react-dom/server`, which needs no DOM. What is *not* covered here is re-render-on-change through
 * a real commit, and live QA is where that gets looked at.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/**/*.test.ts', '<rootDir>/tests/**/*.test.tsx'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }]
  }
};
