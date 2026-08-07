/**
 * CED-001 (A9): the first test runner in this package.
 *
 * `noodl-core-ui` had none — the code-editor subsystem in particular shipped with
 * zero coverage of its validator, its diff and its document-sync logic. Scoped to
 * `tests/`, a sibling of `src/`, so it never picks up a `.stories.tsx`.
 *
 * `testEnvironment: 'node'` deliberately: there is no `jest-environment-jsdom` in the
 * tree, and adding one would leave every checkout failing until the next
 * `npm install`. Everything covered here is therefore DOM-free — CodeMirror's
 * `EditorState`, transactions and parse trees all work headlessly. React components
 * and `EditorView` are out of scope for this runner and are covered by live QA.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.tests.json' }]
  },
  moduleNameMapper: {
    '^@noodl-core-ui/(.*)$': '<rootDir>/src/$1'
  }
};
