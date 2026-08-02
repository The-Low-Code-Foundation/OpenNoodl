/**
 * WF-006: a jest runner for `src/main` — the Electron main process.
 *
 * The editor's existing test suite (`tests/`, entry `tests/index.ts`) is a
 * webpack+jasmine bundle that runs inside a real Electron *renderer* process
 * (see webpackconfigs/webpack.test.js) — it has never reached `src/main`,
 * which needs Node's `http`/`fs` and Electron's `ipcMain`, not a renderer.
 * There was no runner for main-process code before this task.
 *
 * Scoped tightly to `tests-main/` (a sibling of `tests/`, deliberately not
 * inside it) so this never collides with the jasmine suite: nothing in
 * `tests/index.ts` imports from here, and this config's testMatch doesn't
 * reach into `tests/`.
 *
 * OBS-002 adds a second directory, `tests-unit/`, for renderer-side code that is
 * nonetheless **pure** — no React, no Electron, no editor singletons. The
 * provenance walk engine is the first of these, and it is deliberately testable
 * here rather than in the jasmine suite: OBS-004 runs the same engine inside an
 * MCP server with no renderer around it, so a runner that needs Electron to
 * start would be testing it in the one environment it does not have to work in.
 * The two directories share this config because they share the constraint —
 * plain Node, no renderer — and differ only in which half of the app they reach.
 */
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.tests-main.json' }],
    '^.+\\.jsx?$': 'babel-jest'
  },
  testMatch: [
    '<rootDir>/tests-main/**/?(*.)+(spec|test).[jt]s?(x)',
    '<rootDir>/tests-unit/**/?(*.)+(spec|test).[jt]s?(x)'
  ],
  testPathIgnorePatterns: ['/node_modules/'],
  moduleNameMapper: {
    '^@noodl-viewer-cloud/execution-history$': '<rootDir>/../noodl-viewer-cloud/src/execution-history/index.ts'
  }
};
