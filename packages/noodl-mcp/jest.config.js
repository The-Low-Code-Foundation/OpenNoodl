/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  setupFiles: ['<rootDir>/tests/setupEnv.js'],
  // The enriched catalog import makes the first transform slow; keep workers modest.
  maxWorkers: 2,
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json', diagnostics: false }]
  },
  // HLS-008 — the second of the three resolvers that have to agree. `tsconfig.json`'s `paths`
  // teach the typechecker; jest resolves at runtime and reads none of them, so without this a
  // spec importing `@nodegx/export` loads `../nodegx-export/dist/index.cjs` — a build artefact
  // that is absent in a fresh checkout and stale after any edit to the exporter. The third is
  // `build.mjs`'s esbuild alias.
  moduleNameMapper: {
    '^@nodegx/export$': '<rootDir>/../nodegx-export/src/index.ts',
    '^@nodegx/export/(.*)$': '<rootDir>/../nodegx-export/src/$1'
  }
};
