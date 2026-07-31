/**
 * Types and frozen data — no DOM, no Electron, no server.
 *
 * @type {import('ts-jest/dist/types').InitialOptionsTsJest}
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  // `isolatedModules` lives in tsconfig.json, not here — ts-jest deprecated the
  // transform-level option.
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }]
  }
};
