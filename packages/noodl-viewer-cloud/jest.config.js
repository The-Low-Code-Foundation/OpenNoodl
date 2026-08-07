/**
 * WF-006: `tests/execution-history.test.ts` and `tests/execution-logger.test.ts`
 * existed before this task but had no runner wired anywhere in the repo — no
 * jest config, no "test" script, not picked up by any `lerna run test`. They
 * are genuinely well-written (per the salvage audit) but were never actually
 * exercised. This config, plus the "test" script in package.json, is what
 * makes "keep existing execution-history unit tests green" a real, checkable
 * statement instead of an assumption.
 *
 * Node environment: this package targets Node (webpack `target: 'node'`) and
 * its execution-history module touches no DOM APIs.
 */
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.tests.json' }]
  },
  testMatch: ['**/tests/**/?(*.)+(spec|test).[jt]s?(x)'],
  testPathIgnorePatterns: ['/node_modules/']
};
