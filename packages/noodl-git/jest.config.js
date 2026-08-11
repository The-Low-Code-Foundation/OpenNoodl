/**
 * @noodl/git had no test runner before LEG-004. This config covers the plain
 * JavaScript under `src/textconv` only — the rest of the package needs an
 * Electron main process to import at all.
 *
 * ⚠️ Run it from this directory (`cd packages/noodl-git && npx jest`). Run from
 * the repo root, jest picks up the root babel config and reports every suite as
 * failing to run, which looks exactly like a broken branch.
 */
module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.test.js'],
  transform: {}
};
