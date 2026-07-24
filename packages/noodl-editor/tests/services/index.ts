// All specs here are Jasmine and run in the Electron suite.
//
// StyleAnalyzer.test and github/GitHubClient.test were Jest specs that ran
// nowhere (this package has no Jest runner); DEBT-005 converted them
// (2026-07-25). StyleAnalyzer coverage intentionally exists twice:
// tests/models/StyleAnalyzer.test.ts is REV-008's 17-spec rewrite, this
// directory's copy is the original 23-spec suite — they overlap in intent but
// assert different specifics (message format, cross-category ordering,
// threshold constants, token matching), so both stay.

// ProjectStructure tests are plain Jasmine specs (pure, in-memory FS).
export * from './ProjectStructure';
export * from './StyleAnalyzer.test';
export * from './github/GitHubClient.test';
