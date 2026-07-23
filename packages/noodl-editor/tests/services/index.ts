// NOTE: StyleAnalyzer.test uses @jest/globals and is a Jest-only test.
// It runs via `npm run test:editor`.
// Do NOT re-add it here - the Electron Jasmine runner will crash on import.

// ProjectStructure tests are plain Jasmine specs (pure, in-memory FS) — safe here.
export * from './ProjectStructure';
