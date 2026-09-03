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
    // LGC-008: a CSS-module import is a webpack artefact and there is no loader here, so a
    // module that names one would fail the suite *to run*. It does NOT make the renderer
    // reachable — a module that touches the DOM, React's runtime or an editor singleton still
    // fails here, loudly. What it makes reachable is the small set of view modules that build
    // React *elements* and nothing else, which is where the no-remount property lives: an
    // element tree is plain objects, and its keys and types are what decide a remount.
    '\\.(css|scss)$': '<rootDir>/tests-unit/support/styleMock.js',
    '^@noodl-viewer-cloud/execution-history$': '<rootDir>/../noodl-viewer-cloud/src/execution-history/index.ts',
    // WFA-007: the workflow proposal diff. `@noodl-versioning` (SUB-007) is
    // self-contained — its only imports are its own files — and the workflow
    // change-set modules under `@noodl-models/workflow` were written to import
    // nothing else from the editor, which is what makes them reachable from a
    // plain-Node runner. Mapping the alias does NOT make the renderer
    // importable: a module that reaches React or an editor singleton still
    // fails here, loudly, which is the boundary being enforced.
    '^@noodl-versioning$': '<rootDir>/src/editor/src/versioning/index.ts',
    '^@noodl-versioning/(.*)$': '<rootDir>/src/editor/src/versioning/$1',
    '^@noodl-models/(.*)$': '<rootDir>/src/editor/src/models/$1',
    // TUT-005: `models/lessonbackend` reaches `BackendServices/provisionBackend`
    // for the ONE ownership rule (`findReusableBackend`) rather than restating
    // it, and that module imports `@noodl-utils/ipc`. Mapping the alias does not
    // make the renderer importable — `ipc` is a thin `require('electron')`
    // wrapper and anything that touches React still fails here, loudly.
    '^@noodl-utils/(.*)$': '<rootDir>/src/editor/src/utils/$1',
    // EXP-013: the code-export badge reads `@nodegx/export`'s ledger module, whose only import is
    // the ledger JSON. Mapping the subpath (not the package root) is what keeps the rest of the
    // exporter — 14k lines of planner — out of this runner: `exportBadge.ts` names `ledger`
    // directly, and a spec that imported the root would compile the whole package to grade a
    // two-branch decision.
    '^@nodegx/export/(.*)$': '<rootDir>/../nodegx-export/src/$1',
    // …and the root, for the pre-flight modal's one value import (`plainReason`). Only the modal
    // spec reaches it, and that spec already compiles the exporter to build its summaries.
    '^@nodegx/export$': '<rootDir>/../nodegx-export/src/index.ts',
    // FIX-003: the AI link policy moved to its neutral home in core-ui
    // (`components/ai/AiMarkdown/linkActions`). Mapping the alias does NOT make
    // core-ui's components importable here — anything that names React or a
    // `.module.scss` still fails, loudly. What it makes reachable is the
    // import-free policy module the update-dialog spec grades.
    '^@noodl-core-ui/(.*)$': '<rootDir>/../noodl-core-ui/src/$1'
  }
};
