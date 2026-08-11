// These specs were written against Jest and ran nowhere: the editor suite is
// Jasmine, and `import ... from '@jest/globals'` throws at module load, taking
// down the entire Electron run rather than just the one file. REV-008 converted
// them — Jasmine provides the globals, so no import is needed — and wired them
// back in one at a time, running `npm run test:ci` between each.
export * from './expression-parameter.test';
export * from './ElementConfigRegistry.test';
export * from './BYOBSchemaParsers.test';
export * from './BYOBRelationSync.test';
export * from './ByobFilterBuilder.test';
export * from './ProjectCreationWizard.test';
export * from './StyleAnalyzer.test';
export * from './EmbeddedTemplate.test';
export * from './StyleTokenCoverage.test';
export * from './StyleTokensUndo.test';
export * from './code-history.test';
export * from './BackendSecurity.test';
export * from './BackendSelection.test';
export * from './ProjectSettings.test';
export * from './ProjectIdentity.test';
